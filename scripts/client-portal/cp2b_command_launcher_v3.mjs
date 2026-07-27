import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

const forbiddenControlPattern = /[\0\r\n]/u
const forbiddenCmdPattern = /["&|<>^%!]/u

export const sensitiveEnvironmentNames = Object.freeze([
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CP2B_QA_DATABASE_URL',
  'PORTAL_INVITATION_PEPPER',
  'PORTAL_RATE_LIMIT_PEPPER',
])

function assertSafeString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label}_required`)
  }
  if (forbiddenControlPattern.test(value)) {
    throw new Error(`${label}_control_character_rejected`)
  }
}

function assertSafeCommandToken(value, label) {
  assertSafeString(value, label)
  if (forbiddenCmdPattern.test(value)) {
    throw new Error(`${label}_cmd_metacharacter_rejected`)
  }
}

function assertNoSensitiveArguments(args, environment) {
  const secrets = sensitiveEnvironmentNames
    .map((name) => environment?.[name])
    .filter((value) => typeof value === 'string' && value.length > 0)

  for (const argument of args) {
    if (secrets.some((secret) => argument.includes(secret))) {
      throw new Error('sensitive_argument_rejected')
    }
  }
}

export function preparePostgresInvocationV3(executable, args, environment) {
  const basename = path.basename(executable).toLowerCase()
  const databaseUrl = environment?.CP2B_QA_DATABASE_URL
  if ((basename !== 'psql' && basename !== 'psql.exe')
    || typeof databaseUrl !== 'string'
    || args[0] !== databaseUrl) {
    return { args, environment }
  }

  let parsed
  try {
    parsed = new URL(databaseUrl)
  } catch {
    throw new Error('postgres_environment_invalid')
  }
  if ((parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:')
    || !parsed.hostname
    || !parsed.username
    || parsed.pathname.length <= 1) {
    throw new Error('postgres_environment_invalid')
  }

  const postgresEnvironment = {
    ...environment,
    PGHOST: parsed.hostname,
    PGPORT: parsed.port || '5432',
    PGUSER: decodeURIComponent(parsed.username),
    PGPASSWORD: decodeURIComponent(parsed.password),
    PGDATABASE: decodeURIComponent(parsed.pathname.slice(1)),
  }
  const parameterMappings = {
    sslmode: 'PGSSLMODE',
    sslrootcert: 'PGSSLROOTCERT',
    connect_timeout: 'PGCONNECT_TIMEOUT',
    application_name: 'PGAPPNAME',
    target_session_attrs: 'PGTARGETSESSIONATTRS',
  }
  for (const [parameter, environmentName] of Object.entries(parameterMappings)) {
    const value = parsed.searchParams.get(parameter)
    if (value) postgresEnvironment[environmentName] = value
  }
  return {
    args: args.slice(1),
    environment: postgresEnvironment,
  }
}

export function quoteWindowsCmdToken(value, label = 'command_token') {
  assertSafeCommandToken(value, label)
  return `"${value}"`
}

export function buildWindowsCmdCommand(executable, args = []) {
  assertSafeCommandToken(executable, 'executable')
  if (!Array.isArray(args)) throw new Error('arguments_array_required')
  return [
    quoteWindowsCmdToken(executable, 'executable'),
    ...args.map((argument, index) => quoteWindowsCmdToken(argument, `argument_${index}`)),
  ].join(' ')
}

export function spawnSyncCompatV3(
  executable,
  args = [],
  options = {},
  dependencies = {},
) {
  assertSafeString(executable, 'executable')
  if (!Array.isArray(args)) throw new Error('arguments_array_required')
  args.forEach((argument, index) => assertSafeString(argument, `argument_${index}`))

  const platform = dependencies.platform ?? process.platform
  const spawn = dependencies.spawnSync ?? spawnSync
  const prepared = preparePostgresInvocationV3(
    executable,
    args,
    options.env ?? process.env,
  )
  const spawnArgs = prepared.args
  assertNoSensitiveArguments(spawnArgs, options.env ?? process.env)
  const extension = path.extname(executable).toLowerCase()
  const spawnOptions = {
    ...options,
    env: prepared.environment,
    shell: false,
  }

  if (platform === 'win32' && (extension === '.cmd' || extension === '.bat')) {
    const comSpec = options.env?.ComSpec ?? process.env.ComSpec
    assertSafeString(comSpec, 'comspec')
    const command = `"${buildWindowsCmdCommand(executable, spawnArgs)}"`
    return spawn(comSpec, ['/d', '/s', '/c', command], {
      ...spawnOptions,
      windowsVerbatimArguments: true,
    })
  }

  return spawn(executable, spawnArgs, spawnOptions)
}

export function runCommandV3(executable, args = [], options = {}) {
  const environment = options.environment ?? process.env
  assertSafeString(executable, 'executable')
  if (!Array.isArray(args)) throw new Error('arguments_array_required')
  args.forEach((argument, index) => assertSafeString(argument, `argument_${index}`))
  assertNoSensitiveArguments(args, environment)

  const result = spawnSyncCompatV3(
    executable,
    args,
    {
      cwd: options.cwd,
      env: environment,
      encoding: 'utf8',
      windowsHide: true,
      timeout: options.timeout ?? 30_000,
      maxBuffer: options.maxBuffer ?? 20 * 1024 * 1024,
      input: options.input,
    },
    {
      platform: options.platform,
      spawnSync: options.spawnSync,
    },
  )

  const stdout = result.stdout ?? ''
  const stderr = result.stderr ?? ''
  const status = Number.isInteger(result.status) ? result.status : null
  if (result.error || status !== 0) {
    const detail = options.redactFailure
      ? 'redacted'
      : [stdout, stderr].filter(Boolean).join('\n').trim()
    const error = new Error(`command_failed:${path.basename(executable)}:${detail}`)
    error.code = result.error?.code ?? 'COMMAND_FAILED'
    error.status = status
    throw error
  }

  return {
    status,
    stdout,
    stderr,
  }
}

export function resolveSupabaseCliTarget(repoRoot) {
  assertSafeString(repoRoot, 'repo_root')
  const cliEntry = path.join(repoRoot, 'node_modules', 'supabase', 'dist', 'supabase.js')
  if (!existsSync(cliEntry)) throw new Error('supabase_cli_target_missing')
  return {
    executable: process.execPath,
    prefixArgs: [cliEntry],
  }
}

export function runSupabaseCliV3(args, options = {}) {
  if (!Array.isArray(args)) throw new Error('arguments_array_required')
  if (args.some((argument) => argument === '--debug' || argument.startsWith('--debug='))) {
    throw new Error('supabase_debug_rejected')
  }
  const repoRoot = options.repoRoot
  const target = resolveSupabaseCliTarget(repoRoot)
  return runCommandV3(
    target.executable,
    [...target.prefixArgs, ...args],
    {
      ...options,
      environment: options.environment ?? process.env,
    },
  )
}
