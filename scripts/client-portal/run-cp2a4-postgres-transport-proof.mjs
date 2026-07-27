import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runCommandV3 } from './cp2b_command_launcher_v3.mjs'
import {
  preparePostgresEnvironmentV5,
  runPsqlV5,
} from './cp2b_postgres_transport_v5.mjs'
import {
  assertExecutionGateV5,
  preflightV5,
  runPreEffectOrderedV5,
  verifyManifestV5,
} from './run-cp2b-qa-v5.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const privateRoot = path.join(repoRoot, '.git', 'cp2b-private')
const QA_REF = 'kpvvydthlxupjjqqdpxy'
const PRODUCTION_REF = 'wfxnwfcdjainpojhbdri'
const requiredInputs = [
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

function ledgerCount() {
  return readdirSync(privateRoot).filter((name) => name.endsWith('.ledger.json')).length
}

function reproduceV4Failure() {
  const databaseUrl = `postgresql://synthetic:masked@${QA_REF}.example.invalid/postgres`
  let spawned = 0
  try {
    runCommandV3('psql', [databaseUrl, '-X', '-c', 'SELECT 1'], {
      environment: {
        CP2B_QA_DATABASE_URL: databaseUrl,
      },
      platform: 'linux',
      spawnSync: () => {
        spawned += 1
        return { status: 0, stdout: '', stderr: '' }
      },
      redactFailure: true,
    })
  } catch (error) {
    if (error instanceof Error
      && error.message === 'sensitive_argument_rejected'
      && spawned === 0) {
      return true
    }
    throw error
  }
  return false
}

function inspectChildBoundary(environment) {
  let captured
  runPsqlV5(['-X', '-Atq', '-c', 'SELECT 1'], {
    environment,
    runCommand: (executable, args, options) => {
      captured = { executable, args, environment: options.environment }
      return { status: 0, stdout: '1\n', stderr: '' }
    },
  })
  const forbiddenArguments = [
    environment.CP2B_QA_DATABASE_URL,
    environment.SUPABASE_ACCESS_TOKEN,
    environment.SUPABASE_ANON_KEY,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    environment.PORTAL_INVITATION_PEPPER,
    environment.PORTAL_RATE_LIMIT_PEPPER,
    captured.environment.PGPASSWORD,
  ]
  return {
    urlInArgs: captured.args.some((argument) => (
      argument.includes(environment.CP2B_QA_DATABASE_URL)
    )),
    secretInArgs: captured.args.some((argument) => (
      forbiddenArguments.some((value) => argument.includes(value))
    )),
    databaseUrlInChildEnvironment: Object.hasOwn(
      captured.environment,
      'CP2B_QA_DATABASE_URL',
    ),
  }
}

async function proveOrdering() {
  const stages = []
  await runPreEffectOrderedV5({
    preEffectCheck: async () => ({ liveRead: 1 }),
    createLedger: async () => 'private-ledger',
    createAuth: async () => ({ ids: {} }),
    onStage: (stage) => stages.push(stage),
  })
  let ledgerCalls = 0
  let authCalls = 0
  try {
    await runPreEffectOrderedV5({
      preEffectCheck: async () => {
        throw new Error('connectivity_failed')
      },
      createLedger: async () => {
        ledgerCalls += 1
      },
      createAuth: async () => {
        authCalls += 1
      },
    })
  } catch {}
  return {
    passed: stages.join('>') === 'postgres_pre_effect_check>ledger_create>auth_create',
    failureLedgerCalls: ledgerCalls,
    failureAuthCalls: authCalls,
  }
}

async function main() {
  const missing = requiredInputs.filter((name) => !process.env[name]?.trim())
  if (missing.length > 0) throw new Error(`private_inputs_missing:${missing.join(',')}`)
  if (process.env.CP2B_PROJECT_REF !== QA_REF
    || process.env.CP2B_EXECUTION_AUTHORIZED === 'true') {
    throw new Error('proof_environment_rejected')
  }

  const manifest = JSON.parse(readFileSync(
    path.join(repoRoot, 'scripts', 'client-portal', 'cp2b_qa_package_v5.manifest.json'),
    'utf8',
  ))
  verifyManifestV5(manifest)
  const ledgersBefore = ledgerCount()
  const v4Failure = reproduceV4Failure()
  const boundary = inspectChildBoundary(process.env)
  const ordering = await proveOrdering()
  const productionRejected = (() => {
    try {
      preparePostgresEnvironmentV5({
        ...process.env,
        CP2B_QA_DATABASE_URL: `postgresql://private:masked@${PRODUCTION_REF}.example.invalid/postgres`,
      })
    } catch (error) {
      return error instanceof Error && error.message === 'production_target_rejected'
    }
    return false
  })()
  const preflight = await preflightV5(process.env)
  let unauthorizedBlocked = false
  try {
    assertExecutionGateV5({
      environment: {
        ...process.env,
        CP2B_EXECUTION_AUTHORIZED: 'false',
      },
      manifest,
      gitHead: 'unauthorized-proof-head',
      clean: true,
    })
  } catch (error) {
    unauthorizedBlocked = error instanceof Error && error.message === 'execution_not_authorized'
  }
  const ledgersAfter = ledgerCount()

  const passed = v4Failure
    && !boundary.urlInArgs
    && !boundary.secretInArgs
    && !boundary.databaseUrlInChildEnvironment
    && ordering.passed
    && ordering.failureLedgerCalls === 0
    && ordering.failureAuthCalls === 0
    && productionRejected
    && unauthorizedBlocked
    && preflight.liveQaRead === 'PASS'
    && preflight.databaseTarget === 'QA_MATCH'
    && preflight.activeStaffId === 'MANUALLY_CONFIRMED'
    && ledgersAfter === ledgersBefore

  const result = {
    gate: 'CP-2A.4',
    status: passed ? 'PASS' : 'FAIL',
    v4FailureReproduced: v4Failure ? 'PASS' : 'FAIL',
    v5PostgresTransport: !boundary.urlInArgs
      && !boundary.secretInArgs
      && !boundary.databaseUrlInChildEnvironment ? 'PASS' : 'FAIL',
    liveQaRead: preflight.liveQaRead,
    databaseTarget: preflight.databaseTarget,
    activeStaffUuid: preflight.activeStaffId,
    portalTables: preflight.portalTables,
    portalSchema: preflight.portalSchema,
    portalEdgeFunctions: preflight.portalEdgeFunctions,
    portalBucket: preflight.portalBucket,
    syntheticAuthUsers: preflight.syntheticAuthUsers,
    syntheticStorageObjects: preflight.syntheticStorageObjects,
    preEffectOrdering: ordering.passed ? 'PASS' : 'FAIL',
    connectivityFailureBeforeLedger: ordering.failureLedgerCalls === 0 ? 'PASS' : 'FAIL',
    connectivityFailureBeforeAuth: ordering.failureAuthCalls === 0 ? 'PASS' : 'FAIL',
    urlInChildArgs: boundary.urlInArgs ? 'YES' : 'NO',
    secretInChildArgs: boundary.secretInArgs ? 'YES' : 'NO',
    databaseUrlInChildEnvironment: boundary.databaseUrlInChildEnvironment ? 'YES' : 'NO',
    productionRejected: productionRejected ? 'PASS' : 'FAIL',
    executeWithoutAuthorization: unauthorizedBlocked ? 'BLOCKED' : 'FAIL',
    qaRemoteWrites: 0,
    productionWrites: 0,
    newLedgerCreated: ledgersAfter - ledgersBefore,
    authUsersCreated: 0,
    edgeDeploys: 0,
    storageMutations: 0,
    cp2bExecuted: false,
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (!passed) process.exitCode = 1
}

main().catch((error) => {
  process.stderr.write(`BLOCKED: ${error instanceof Error ? error.message : 'unknown_error'}\n`)
  process.exitCode = 1
})
