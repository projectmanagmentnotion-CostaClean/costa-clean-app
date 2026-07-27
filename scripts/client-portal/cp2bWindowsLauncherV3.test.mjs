import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildWindowsCmdCommand,
  preparePostgresInvocationV3,
  runCommandV3,
  runSupabaseCliV3,
  spawnSyncCompatV3,
} from './cp2b_command_launcher_v3.mjs'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const temporaryDirectories = []

function createBatchFixture({ exitCode = 0, delayMs = 0 } = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), 'cp2b v3 launcher '))
  temporaryDirectories.push(directory)
  const scriptPath = path.join(directory, 'fixture script.mjs')
  const batchPath = path.join(directory, 'fixture command.cmd')
  writeFileSync(
    scriptPath,
    delayMs > 0
      ? `setTimeout(() => process.stdout.write('done'), ${delayMs})\n`
      : `process.stdout.write(JSON.stringify(process.argv.slice(2)))\nprocess.exit(${exitCode})\n`,
    'utf8',
  )
  writeFileSync(
    batchPath,
    `@echo off\r\nnode "%~dp0fixture script.mjs" %*\r\n`,
    'utf8',
  )
  return { batchPath, directory }
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    rmSync(temporaryDirectories.pop(), { recursive: true, force: true })
  }
})

describe('CP-2B V3 command launcher', () => {
  it.runIf(process.platform === 'win32')(
    'executes a real cmd shim with paths and arguments containing spaces',
    () => {
      const { batchPath, directory } = createBatchFixture()
      const result = runCommandV3(batchPath, ['alpha beta', 'gamma'], {
        cwd: directory,
        redactFailure: true,
      })
      expect(result.status).toBe(0)
      expect(JSON.parse(result.stdout)).toEqual(['alpha beta', 'gamma'])
    },
  )

  it('executes the real Supabase JavaScript target without the cmd shim', () => {
    const result = runSupabaseCliV3(['--version'], {
      repoRoot,
      cwd: repoRoot,
      redactFailure: true,
    })
    expect(result.status).toBe(0)
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/u)
  })

  it.runIf(process.platform === 'win32')(
    'patches the V2 child-process path before it imports spawnSync',
    () => {
      const preloadPath = path.join(
        repoRoot,
        'scripts',
        'client-portal',
        'cp2b_v3_preload.mjs',
      )
      const shimPath = path.join(repoRoot, 'node_modules', '.bin', 'supabase.cmd')
      const script = [
        "const { spawnSync } = require('node:child_process')",
        `const result = spawnSync(${JSON.stringify(shimPath)}, ['--version'], { encoding: 'utf8' })`,
        "if (result.error || result.status !== 0) process.exit(1)",
        'process.stdout.write(result.stdout)',
      ].join(';')
      const result = runCommandV3(process.execPath, [
        '--import',
        pathToFileURL(preloadPath).href,
        '-e',
        script,
      ], {
        cwd: repoRoot,
        redactFailure: true,
      })
      expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/u)
    },
  )

  it.runIf(Boolean(process.env.SUPABASE_ACCESS_TOKEN))(
    'lists projects and identifies only the linked QA project',
    () => {
      const result = runSupabaseCliV3(
        ['--workdir', repoRoot, 'projects', 'list', '--output', 'json'],
        {
          repoRoot,
          cwd: tmpdir(),
          environment: process.env,
          redactFailure: true,
          timeout: 120_000,
        },
      )
      const projects = JSON.parse(result.stdout)
      expect(projects).toContainEqual(expect.objectContaining({
        id: 'kpvvydthlxupjjqqdpxy',
        linked: true,
      }))
      expect(projects).not.toContainEqual(expect.objectContaining({
        id: 'wfxnwfcdjainpojhbdri',
        linked: true,
      }))
    },
  )

  it.each([
    ['NUL', 'bad\0argument'],
    ['CR', 'bad\rargument'],
    ['LF', 'bad\nargument'],
  ])('rejects %s control characters', (_label, argument) => {
    expect(() => runCommandV3(process.execPath, [argument])).toThrow(
      /control_character_rejected/u,
    )
  })

  it.runIf(process.platform === 'win32')('enforces timeout for cmd execution', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'cp2b v3 timeout '))
    temporaryDirectories.push(directory)
    const batchPath = path.join(directory, 'timeout.cmd')
    writeFileSync(batchPath, '@echo off\r\n:wait\r\ngoto wait\r\n', 'utf8')
    expect(() => runCommandV3(batchPath, [], {
      cwd: directory,
      timeout: 50,
      redactFailure: true,
    })).toThrow(/command_failed/u)
  })

  it.runIf(process.platform === 'win32')('reports nonzero cmd exit without leaking stderr', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'cp2b v3 failure '))
    temporaryDirectories.push(directory)
    const batchPath = path.join(directory, 'failure.cmd')
    writeFileSync(batchPath, '@echo off\r\necho PRIVATE_PROOF_VALUE 1>&2\r\nexit /b 7\r\n')
    expect(() => runCommandV3(batchPath, [], {
      cwd: directory,
      redactFailure: true,
    })).toThrow('command_failed:failure.cmd:redacted')
  })

  it('uses direct execution on non-Windows platforms', () => {
    const calls = []
    const result = spawnSyncCompatV3('/opt/tool', ['arg with space'], {
      encoding: 'utf8',
    }, {
      platform: 'linux',
      spawnSync(executable, args, options) {
        calls.push({ executable, args, options })
        return { status: 0, stdout: 'ok', stderr: '' }
      },
    })
    expect(result.status).toBe(0)
    expect(calls[0].executable).toBe('/opt/tool')
    expect(calls[0].args).toEqual(['arg with space'])
    expect(calls[0].options.shell).toBe(false)
  })

  it.each(['& whoami', '| more', '^escape', '%PATH%', '!VAR!', 'quote"break'])(
    'rejects cmd shell injection token %s',
    (argument) => {
      expect(() => buildWindowsCmdCommand('safe.cmd', [argument])).toThrow(
        /cmd_metacharacter_rejected/u,
      )
    },
  )

  it('rejects Supabase debug mode', () => {
    expect(() => runSupabaseCliV3(['--debug'], { repoRoot })).toThrow(
      'supabase_debug_rejected',
    )
  })

  it.each([
    'SUPABASE_ACCESS_TOKEN',
    'SUPABASE_SERVICE_ROLE_KEY',
    'CP2B_QA_DATABASE_URL',
  ])('rejects %s when copied into an argument', (name) => {
    const value = `private-${name.toLowerCase()}-value`
    expect(() => runCommandV3(process.execPath, [value], {
      environment: { ...process.env, [name]: value },
    })).toThrow('sensitive_argument_rejected')
  })

  it('moves the QA database URL from psql argv into PG environment variables', () => {
    const databaseUrl = 'postgresql://portal_user:private_password@qa.example.invalid:6543/postgres?sslmode=require'
    const environment = { CP2B_QA_DATABASE_URL: databaseUrl }
    const prepared = preparePostgresInvocationV3(
      'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe',
      [databaseUrl, '-X', '-q'],
      environment,
    )
    expect(prepared.args).toEqual(['-X', '-q'])
    expect(prepared.args).not.toContain(databaseUrl)
    expect(prepared.environment.PGHOST).toBe('qa.example.invalid')
    expect(prepared.environment.PGPORT).toBe('6543')
    expect(prepared.environment.PGUSER).toBe('portal_user')
    expect(prepared.environment.PGPASSWORD).toBe('private_password')
    expect(prepared.environment.PGDATABASE).toBe('postgres')
    expect(prepared.environment.PGSSLMODE).toBe('require')

    const calls = []
    spawnSyncCompatV3(
      'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe',
      [databaseUrl, '-X', '-q'],
      { env: environment, encoding: 'utf8' },
      {
        platform: 'win32',
        spawnSync(executable, args, options) {
          calls.push({ executable, args, options })
          return { status: 0, stdout: '', stderr: '' }
        },
      },
    )
    expect(calls[0].args).toEqual(['-X', '-q'])
    expect(calls[0].args).not.toContain(databaseUrl)
    expect(calls[0].options.env.PGPASSWORD).toBe('private_password')
  })

  it('never includes a rejected secret in the thrown error', () => {
    const secret = 'private-token-that-must-not-appear'
    let message = ''
    try {
      runCommandV3(process.execPath, [secret], {
        environment: { ...process.env, SUPABASE_ACCESS_TOKEN: secret },
      })
    } catch (error) {
      message = error.message
    }
    expect(message).toBe('sensitive_argument_rejected')
    expect(message).not.toContain(secret)
  })
})
