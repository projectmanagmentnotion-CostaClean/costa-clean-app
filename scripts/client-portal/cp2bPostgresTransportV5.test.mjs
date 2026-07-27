import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { runCommandV3 } from './cp2b_command_launcher_v3.mjs'
import {
  preparePostgresEnvironmentV5,
  runPsqlV5,
} from './cp2b_postgres_transport_v5.mjs'
import {
  assertExecutionGateV5,
  preflightV5,
  runPreEffectOrderedV5,
} from './run-cp2b-qa-v5.mjs'

const QA_REF = 'kpvvydthlxupjjqqdpxy'
const PRODUCTION_REF = 'wfxnwfcdjainpojhbdri'
const encodedDatabaseUrl = [
  'postgresql://postgres%2Bqa:p%40ss%3Aword@',
  QA_REF,
  '.example.invalid:6543/postgres%2Ddb',
  '?sslmode=require&sslrootcert=root.pem&connect_timeout=12',
  '&application_name=cp2a4&target_session_attrs=read-write',
].join('')
const environment = {
  ...process.env,
  CP2B_PROJECT_REF: QA_REF,
  CP2B_EXECUTION_AUTHORIZED: 'false',
  CP2B_QA_DATABASE_URL: encodedDatabaseUrl,
  CP2B_ACTIVE_STAFF_USER_ID: '00000000-0000-4000-8000-000000000001',
  SUPABASE_ACCESS_TOKEN: 'synthetic-access-token-value',
  SUPABASE_URL: `https://${QA_REF}.supabase.co`,
  SUPABASE_ANON_KEY: 'synthetic-anon-key-value',
  SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-role-key-value',
  PORTAL_INVITATION_PEPPER: 'synthetic-invitation-pepper-value',
  PORTAL_RATE_LIMIT_PEPPER: 'synthetic-rate-limit-pepper-value',
  PORTAL_ALLOWED_ORIGIN: 'https://app.costacleanbcn.com',
}
const requiredPrivateInputs = [
  'CP2B_QA_DATABASE_URL',
  'CP2B_ACTIVE_STAFF_USER_ID',
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PORTAL_INVITATION_PEPPER',
  'PORTAL_RATE_LIMIT_PEPPER',
  'PORTAL_ALLOWED_ORIGIN',
]
const hasLiveEnvironment = requiredPrivateInputs.every((name) => process.env[name]?.trim())
  && process.env.CP2B_PROJECT_REF === QA_REF
let livePreflightPromise

function captureRun(args = ['-X', '-Atq', '-c', 'SELECT 1'], overrides = {}) {
  let captured
  const result = runPsqlV5(args, {
    environment,
    executable: overrides.executable,
    timeout: overrides.timeout,
    maxBuffer: overrides.maxBuffer,
    runCommand: (executable, childArgs, options) => {
      captured = { executable, args: childArgs, options }
      return { status: 0, stdout: '1\n', stderr: '' }
    },
  })
  return { captured, result }
}

function livePreflight() {
  livePreflightPromise ??= preflightV5(process.env)
  return livePreflightPromise
}

describe('CP-2A.4 PostgreSQL secret transport V5', () => {
  it('1 reproduces V4 sensitive_argument_rejected before spawn', () => {
    let spawned = 0
    expect(() => runCommandV3('psql', [encodedDatabaseUrl, '-c', 'SELECT 1'], {
      environment,
      platform: 'linux',
      spawnSync: () => {
        spawned += 1
        return { status: 0, stdout: '', stderr: '' }
      },
    })).toThrow('sensitive_argument_rejected')
    expect(spawned).toBe(0)
  })

  it('2 never sends the URL to runCommandV3', () => {
    expect(captureRun().captured.args).not.toContain(encodedDatabaseUrl)
  })

  it('3 never places the URL in child arguments', () => {
    expect(captureRun().captured.args.join(' ')).not.toContain('postgresql://')
  })

  it('4 never places the decoded password in child arguments', () => {
    expect(captureRun().captured.args.join(' ')).not.toContain('p@ss:word')
  })

  it('5 never places Supabase keys in child arguments', () => {
    const serialized = captureRun().captured.args.join(' ')
    expect(serialized).not.toContain(environment.SUPABASE_ANON_KEY)
    expect(serialized).not.toContain(environment.SUPABASE_SERVICE_ROLE_KEY)
  })

  it('6 never places peppers in child arguments', () => {
    const serialized = captureRun().captured.args.join(' ')
    expect(serialized).not.toContain(environment.PORTAL_INVITATION_PEPPER)
    expect(serialized).not.toContain(environment.PORTAL_RATE_LIMIT_PEPPER)
  })

  it('7 removes CP2B_QA_DATABASE_URL from the child environment', () => {
    expect(captureRun().captured.options.environment)
      .not.toHaveProperty('CP2B_QA_DATABASE_URL')
  })

  it('8 maps PGHOST', () => {
    expect(preparePostgresEnvironmentV5(environment).environment.PGHOST)
      .toBe(`${QA_REF}.example.invalid`)
  })

  it('9 maps PGPORT', () => {
    expect(preparePostgresEnvironmentV5(environment).environment.PGPORT).toBe('6543')
  })

  it('10 decodes PGUSER', () => {
    expect(preparePostgresEnvironmentV5(environment).environment.PGUSER).toBe('postgres+qa')
  })

  it('11 decodes PGPASSWORD', () => {
    expect(preparePostgresEnvironmentV5(environment).environment.PGPASSWORD)
      .toBe('p@ss:word')
  })

  it('12 decodes PGDATABASE', () => {
    expect(preparePostgresEnvironmentV5(environment).environment.PGDATABASE)
      .toBe('postgres-db')
  })

  it('13 maps sslmode', () => {
    expect(preparePostgresEnvironmentV5(environment).environment.PGSSLMODE).toBe('require')
  })

  it('14 maps every allowlisted PostgreSQL parameter', () => {
    expect(preparePostgresEnvironmentV5(environment).environment).toMatchObject({
      PGSSLROOTCERT: 'root.pem',
      PGCONNECT_TIMEOUT: '12',
      PGAPPNAME: 'cp2a4',
      PGTARGETSESSIONATTRS: 'read-write',
    })
  })

  it('15 rejects production', () => {
    expect(() => preparePostgresEnvironmentV5({
      ...environment,
      CP2B_QA_DATABASE_URL: `postgresql://private:masked@${PRODUCTION_REF}.example.invalid/postgres`,
    })).toThrow('production_target_rejected')
  })

  it('16 rejects an unknown target', () => {
    expect(() => preparePostgresEnvironmentV5({
      ...environment,
      CP2B_QA_DATABASE_URL: 'postgresql://private:masked@unknown.example.invalid/postgres',
    })).toThrow('database_target_rejected')
  })

  it('17 rejects an invalid protocol', () => {
    expect(() => preparePostgresEnvironmentV5({
      ...environment,
      CP2B_QA_DATABASE_URL: `https://private:masked@${QA_REF}.example.invalid/postgres`,
    })).toThrow('postgres_environment_invalid')
  })

  it('18 rejects a malformed URL', () => {
    expect(() => preparePostgresEnvironmentV5({
      ...environment,
      CP2B_QA_DATABASE_URL: `postgresql://${QA_REF}`,
    })).toThrow('postgres_environment_invalid')
  })

  it('19 rejects CR, LF and NUL', () => {
    for (const suffix of ['\r', '\n', '\0']) {
      expect(() => preparePostgresEnvironmentV5({
        ...environment,
        CP2B_QA_DATABASE_URL: `${encodedDatabaseUrl}${suffix}`,
      })).toThrow(/control_character_rejected/u)
    }
  })

  it('20 forces redacted failures', () => {
    expect(captureRun().captured.options.redactFailure).toBe(true)
  })

  it('21 preserves timeout and maxBuffer', () => {
    const { captured } = captureRun(undefined, {
      timeout: 4567,
      maxBuffer: 7654,
    })
    expect(captured.options.timeout).toBe(4567)
    expect(captured.options.maxBuffer).toBe(7654)
  })

  it('22 propagates a nonzero exit as a redacted error', () => {
    expect(() => runPsqlV5(['-e', 'process.exit(9)'], {
      environment,
      executable: process.execPath,
    })).toThrow(/command_failed:.*:redacted/iu)
  })

  it('23 supports a psql path with spaces', () => {
    const executable = 'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe'
    expect(captureRun(undefined, { executable }).captured.executable).toBe(executable)
  })

  it('24 preserves SQL arguments with spaces', () => {
    const args = ['-X', '-c', 'SELECT 1 AS safe value']
    expect(captureRun(args).captured.args).toEqual(args)
  })

  it('25 keeps shell injection inert and uses no eval or shell true', () => {
    const source = readFileSync('scripts/client-portal/cp2b_postgres_transport_v5.mjs', 'utf8')
    expect(captureRun(['-c', "SELECT '&|<>^%!';"]).captured.args)
      .toEqual(['-c', "SELECT '&|<>^%!';"])
    expect(source).not.toMatch(/shell\s*:\s*true|\beval\s*\(|Invoke-Expression/iu)
  })

  it('26 rejects debug', () => {
    expect(() => runPsqlV5(['--debug'], { environment })).toThrow('psql_debug_rejected')
  })

  it.skipIf(!hasLiveEnvironment)('27 runs real psql SELECT 1 against QA', async () => {
    expect((await livePreflight()).liveQaRead).toBe('PASS')
  })

  it.skipIf(!hasLiveEnvironment)('28 verifies active staff by exact UUID', async () => {
    expect((await livePreflight()).activeStaffId).toBe('MANUALLY_CONFIRMED')
  })

  it('29 blocks connectivity failure before ledger creation', async () => {
    let ledgerCalls = 0
    await expect(runPreEffectOrderedV5({
      preEffectCheck: async () => {
        throw new Error('connectivity_failed')
      },
      createLedger: async () => {
        ledgerCalls += 1
      },
      createAuth: async () => {},
    })).rejects.toThrow('connectivity_failed')
    expect(ledgerCalls).toBe(0)
  })

  it('30 blocks connectivity failure before Auth Admin API', async () => {
    let authCalls = 0
    await expect(runPreEffectOrderedV5({
      preEffectCheck: async () => {
        throw new Error('connectivity_failed')
      },
      createLedger: async () => {},
      createAuth: async () => {
        authCalls += 1
      },
    })).rejects.toThrow('connectivity_failed')
    expect(authCalls).toBe(0)
  })

  it.skipIf(!hasLiveEnvironment)('31 performs a read-only live preflight', async () => {
    expect(await livePreflight()).toMatchObject({
      remoteWrites: 0,
      portalTables: 0,
      portalSchema: 'ABSENT',
      syntheticAuthUsers: 0,
      portalEdgeFunctions: '0/4',
      portalBucket: 'ABSENT',
      syntheticStorageObjects: 0,
    })
  })

  it('32 blocks execute without authorization', () => {
    expect(() => assertExecutionGateV5({
      environment,
      manifest: { authorizationId: 'CP2B-V5-AUTHORIZATION-PENDING' },
      gitHead: 'head',
      clean: true,
    })).toThrow('execution_not_authorized')
  })

  it('33 blocks an invalid private backup', () => {
    expect(() => assertExecutionGateV5({
      environment: {
        ...environment,
        CP2B_EXECUTION_AUTHORIZED: 'true',
        CP2B_V5_AUTHORIZATION_ID: 'CP2B-V5-AUTHORIZATION-PENDING',
        CP2B_V5_AUTHORIZED_HEAD: 'head',
        CP2B_PRIVATE_BACKUP_MANIFEST: 'missing-private-manifest',
      },
      manifest: { authorizationId: 'CP2B-V5-AUTHORIZATION-PENDING' },
      gitHead: 'head',
      clean: true,
    })).toThrow('private_backup_missing')
  })

  it('34 creates a new run id instead of reusing a prior ledger', () => {
    const source = readFileSync('scripts/client-portal/run-cp2b-qa-v5.mjs', 'utf8')
    expect(source).toContain('const runId = createRunId()')
    expect(source).toContain('`${runId}.ledger.json`')
    expect(source).not.toMatch(/readdirSync[\s\S]*ledger\.json/iu)
  })

  it('35 preserves frozen V2 recovery through V5 transport', () => {
    const source = readFileSync('scripts/client-portal/run-cp2b-qa-v5.mjs', 'utf8')
    expect(source).toContain("'cp2b_qa_failure_recovery_v2.sql'")
    expect(source).toContain('psqlFile(environment, recoveryPath, variables)')
  })

  it('proves the exact pre-effect order', async () => {
    const stages = []
    await runPreEffectOrderedV5({
      preEffectCheck: async () => 'prestate',
      createLedger: async () => 'ledger',
      createAuth: async () => 'auth',
      onStage: (stage) => stages.push(stage),
    })
    expect(stages).toEqual([
      'postgres_pre_effect_check',
      'ledger_create',
      'auth_create',
    ])
  })
})
