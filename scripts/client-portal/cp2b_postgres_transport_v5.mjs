import path from 'node:path'
import { runCommandV3 } from './cp2b_command_launcher_v3.mjs'
import { PRODUCTION_REF, QA_REF } from './cp2b_qa_auth_fixtures_v2.mjs'

const controlPattern = /[\0\r\n]/u
const postgresProtocols = new Set(['postgres:', 'postgresql:'])
const postgresParameterMappings = Object.freeze({
  sslmode: 'PGSSLMODE',
  sslrootcert: 'PGSSLROOTCERT',
  connect_timeout: 'PGCONNECT_TIMEOUT',
  application_name: 'PGAPPNAME',
  target_session_attrs: 'PGTARGETSESSIONATTRS',
})
const safeEnvironmentNames = Object.freeze([
  'PATH',
  'SystemRoot',
  'WINDIR',
  'ComSpec',
  'PATHEXT',
  'TEMP',
  'TMP',
  'LANG',
  'LC_ALL',
  'TZ',
])
const forbiddenChildEnvironmentNames = Object.freeze([
  'CP2B_QA_DATABASE_URL',
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PORTAL_INVITATION_PEPPER',
  'PORTAL_RATE_LIMIT_PEPPER',
])

function assertSafeValue(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label}_required`)
  }
  if (controlPattern.test(value)) {
    throw new Error(`${label}_control_character_rejected`)
  }
}

function decodeComponent(value, label) {
  try {
    const decoded = decodeURIComponent(value)
    assertSafeValue(decoded, label)
    return decoded
  } catch (error) {
    if (error instanceof Error && error.message.endsWith('_control_character_rejected')) {
      throw error
    }
    throw new Error('postgres_environment_invalid')
  }
}

export function preparePostgresEnvironmentV5(environment) {
  const databaseUrl = environment?.CP2B_QA_DATABASE_URL
  assertSafeValue(databaseUrl, 'postgres_database_url')
  if (databaseUrl.includes(PRODUCTION_REF)) throw new Error('production_target_rejected')
  if (!databaseUrl.includes(QA_REF)) throw new Error('database_target_rejected')

  let parsed
  try {
    parsed = new URL(databaseUrl)
  } catch {
    throw new Error('postgres_environment_invalid')
  }
  if (!postgresProtocols.has(parsed.protocol)
    || !parsed.hostname
    || !parsed.username
    || parsed.pathname.length <= 1) {
    throw new Error('postgres_environment_invalid')
  }

  const childEnvironment = {}
  for (const name of safeEnvironmentNames) {
    const value = environment[name]
    if (typeof value === 'string' && value.length > 0) childEnvironment[name] = value
  }
  childEnvironment.PGHOST = decodeComponent(parsed.hostname, 'postgres_host')
  childEnvironment.PGPORT = parsed.port || '5432'
  childEnvironment.PGUSER = decodeComponent(parsed.username, 'postgres_user')
  childEnvironment.PGPASSWORD = decodeComponent(parsed.password, 'postgres_password')
  childEnvironment.PGDATABASE = decodeComponent(parsed.pathname.slice(1), 'postgres_database')

  for (const [parameter, environmentName] of Object.entries(postgresParameterMappings)) {
    const value = parsed.searchParams.get(parameter)
    if (value !== null && value !== '') {
      childEnvironment[environmentName] = decodeComponent(value, `postgres_${parameter}`)
    }
  }
  for (const name of forbiddenChildEnvironmentNames) delete childEnvironment[name]

  return {
    environment: childEnvironment,
    target: 'QA_MATCH',
  }
}

export function runPsqlV5(args = [], options = {}) {
  if (!Array.isArray(args)) throw new Error('arguments_array_required')
  if (args.some((argument) => typeof argument !== 'string' || controlPattern.test(argument))) {
    throw new Error('psql_argument_control_character_rejected')
  }
  if (args.some((argument) => argument === '--debug' || argument.startsWith('--debug='))) {
    throw new Error('psql_debug_rejected')
  }

  const sourceEnvironment = options.environment ?? process.env
  const prepared = preparePostgresEnvironmentV5(sourceEnvironment)
  const sensitiveValues = [
    sourceEnvironment.CP2B_QA_DATABASE_URL,
    sourceEnvironment.SUPABASE_ACCESS_TOKEN,
    sourceEnvironment.SUPABASE_ANON_KEY,
    sourceEnvironment.SUPABASE_SERVICE_ROLE_KEY,
    sourceEnvironment.PORTAL_INVITATION_PEPPER,
    sourceEnvironment.PORTAL_RATE_LIMIT_PEPPER,
    prepared.environment.PGPASSWORD,
  ].filter((value) => typeof value === 'string' && value.length > 0)
  if (args.some((argument) => sensitiveValues.some((value) => argument.includes(value)))) {
    throw new Error('sensitive_argument_rejected')
  }

  const executable = options.executable ?? (
    process.platform === 'win32'
      ? 'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe'
      : 'psql'
  )
  assertSafeValue(executable, 'psql_executable')
  const runCommand = options.runCommand ?? runCommandV3
  return runCommand(executable, args, {
    cwd: options.cwd,
    environment: prepared.environment,
    timeout: options.timeout ?? 30_000,
    maxBuffer: options.maxBuffer ?? 20 * 1024 * 1024,
    input: options.input,
    redactFailure: true,
  })
}

export function postgresExecutableV5(platform = process.platform) {
  return platform === 'win32'
    ? 'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe'
    : path.basename('psql')
}
