import {
  constants,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  DiagnosticError,
  MIGRATION_SHA256,
  PRODUCTION_REF,
  QA_REF,
  buildFailureEnvelopeV3,
  parseEnvelopeV3,
  parseSingleJsonV3,
  persistPrivateFailureEnvelopeV3,
  publicFailureSummaryV3,
  sanitizeFailureV3,
  sha256,
  updatePrivateFailureEnvelopeV3,
  validateDetailedPostcheckV3,
  verifyPackageManifestV3,
  verifyPrivateBackupV3,
  verifyPrivateFailureEnvelopeV3,
} from './run-cp3b2a-qa-v3.mjs'
import {
  currentGitStateV2,
  validatePoststateV2,
  validatePrestateV2,
} from './run-cp3b2a-qa-v2.mjs'
import { runConcurrencyV4 } from './cp3b2a_qa_concurrency_v4.mjs'

export const AUTHORIZATION_ID_V4 = 'CP3B2A-QA-V4-AUTHORIZATION-PENDING'
export const PACKAGE_STATUS_V4 = 'PREPARED_NOT_AUTHORIZED'
export const GATE_V4 = 'CP-3B.2A.4'
export const MAXIMUM_APPLY_ATTEMPTS_V4 = 1
export const MAXIMUM_RECOVERY_ATTEMPTS_V4 = 1
export const AUTOMATIC_RETRIES_V4 = 0

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const privateRoot = path.join(repoRoot, '.git', 'cp3b2a-private')
const manifestPath = path.join(scriptDir, 'cp3b2a_qa_package_v4.manifest.json')
const matrixPath = path.join(scriptDir, 'cp3b2a_qa_matrix_v4.sql')
const migrationPath = path.join(
  repoRoot,
  'supabase',
  'migrations',
  '20260728160000_portal_reviewed_change_contract.sql',
)
const precheckPath = path.join(scriptDir, 'cp3b2a_qa_precheck_v3.sql')
const postcheckStatePath = path.join(scriptDir, 'cp3b2a_qa_postcheck_v2.sql')
const postcheckDetailPath = path.join(scriptDir, 'cp3b2a_qa_postcheck_v3.sql')
const rollbackPath = path.join(scriptDir, 'cp3b2a_qa_rollback_v3.sql')
const expectedV4Artifacts = Object.freeze([
  'scripts/client-portal/cp3b2a_qa_matrix_v4.sql',
  'scripts/client-portal/cp3b2a_qa_concurrency_v4.mjs',
  'scripts/client-portal/run-cp3b2a-qa-v4.mjs',
  'scripts/client-portal/run-cp3b2a4-local-proof.mjs',
  'scripts/client-portal/cp3b2aQaApplicationV4.test.mjs',
  'docs/client-portal/CP3B2A4_AUTHORIZATION_CONCURRENCY_MATRIX.md',
  'docs/client-portal/CP3B2A_EXACT_QA_AUTHORIZATION_V4.md',
])
const frozenManifestPaths = Object.freeze({
  v1: path.join(scriptDir, 'cp3b2a_reviewed_change.manifest.json'),
  v2: path.join(scriptDir, 'cp3b2a_qa_package_v2.manifest.json'),
  v3: path.join(scriptDir, 'cp3b2a_qa_package_v3.manifest.json'),
})
const allowedModes = new Set(['--plan', '--preflight', '--execute'])
const recoveryComparisonKeys = Object.freeze([
  'profileRows',
  'propertyRows',
  'profileDigest',
  'propertyDigest',
  'canonicalDigest',
  'financialSequenceDigest',
  'authUserCount',
  'authDigest',
  'tableGrantDigest',
  'unaffectedPolicyDigest',
  'unaffectedFunctionDigest',
  'migrationHistoryCount',
  'migrationHistoryDigest',
])

function fail(code, detail = {}) {
  throw new DiagnosticError(code, detail)
}

export function assertModeV4(argv) {
  if (argv.length !== 1 || !allowedModes.has(argv[0])) fail('V4_MODE_REJECTED')
  return argv[0]
}

export function parseEnvelopeV4(output, expectedKind) {
  const prefix = 'CP3B2A_V4_JSON:'
  const candidates = String(output)
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.startsWith(prefix))
  if (candidates.length !== 1) fail('V4_ENVELOPE_CARDINALITY_REJECTED')
  let envelope
  try {
    envelope = JSON.parse(candidates[0].slice(prefix.length))
  } catch {
    fail('V4_ENVELOPE_PARSE_REJECTED')
  }
  if (envelope.version !== 4 || envelope.kind !== expectedKind) {
    fail('V4_ENVELOPE_KIND_REJECTED')
  }
  return envelope
}

export function requiredCapabilityGapsV4(matrixSource, concurrencySource) {
  const checks = {
    anonActualRpc: /set\s+local\s+role\s+anon[\s\S]*anon\.profile\.submit[\s\S]*anon\.property\.list/iu,
    noMembershipRpc: /no_membership[\s\S]*membership_denials/iu,
    revokedMembershipRpc: /'revoked'[\s\S]*revoked_at/iu,
    invalidPayloadRpc: /profile\.array[\s\S]*property\.foreign/iu,
    outsideAllowlistRpc: /valid_plus_extra/iu,
    exactSqlstateEvidence: /returned_sqlstate[\s\S]*message_text/iu,
    separateSessions: /startPsql[\s\S]*separateBackendCount:\s*2/iu,
    realBarrier: /RowExclusiveLock[\s\S]*blockedByCoordinator/iu,
    simultaneousRetry: /mode:\s*'retry'/iu,
    simultaneousConflict: /mode:\s*'conflict'/iu,
    exactCleanup: /cleanupFixture[\s\S]*assertStateEqual/iu,
  }
  return Object.entries(checks)
    .filter(([name, pattern]) => !pattern.test(
      name.endsWith('Sessions')
        || ['realBarrier', 'simultaneousRetry', 'simultaneousConflict', 'exactCleanup']
          .includes(name)
        ? concurrencySource
        : matrixSource,
    ))
    .map(([name]) => name)
}

export function assertRecoveredPrestateV4(expected, actual) {
  validatePrestateV2(actual)
  for (const key of recoveryComparisonKeys) {
    if (actual[key] !== expected[key]) {
      fail('V4_RECOVERY_PRESTATE_DRIFT', { key })
    }
  }
  return true
}

export function verifyPackageManifestV4() {
  verifyPackageManifestV3()
  if (!existsSync(manifestPath)) fail('V4_MANIFEST_MISSING')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (
    manifest.version !== 4
    || manifest.gate !== GATE_V4
    || manifest.status !== PACKAGE_STATUS_V4
    || manifest.authorizationId !== AUTHORIZATION_ID_V4
    || manifest.qaProjectRef !== QA_REF
    || manifest.prohibitedProductionRef !== PRODUCTION_REF
    || manifest.sourceBaseHead !== '793118454f6bd419ecd289ec99e893301ddd2276'
    || manifest.migrationSha256 !== MIGRATION_SHA256
    || manifest.v1ManifestSha256 !== sha256(frozenManifestPaths.v1)
    || manifest.v2ManifestSha256 !== sha256(frozenManifestPaths.v2)
    || manifest.v3ManifestSha256 !== sha256(frozenManifestPaths.v3)
    || manifest.executeAlias !== false
    || manifest.maximumApplyAttempts !== MAXIMUM_APPLY_ATTEMPTS_V4
    || manifest.maximumRecoveryAttempts !== MAXIMUM_RECOVERY_ATTEMPTS_V4
    || manifest.automaticRetries !== AUTOMATIC_RETRIES_V4
    || manifest.transactionalMatrix !== 'PASS_ROLLED_BACK'
    || manifest.concurrentMatrix !== 'PASS_CLEANED'
    || !Array.isArray(manifest.artifacts)
    || JSON.stringify(manifest.artifacts.map((item) => item.path))
      !== JSON.stringify(expectedV4Artifacts)
  ) fail('V4_MANIFEST_CONTRACT_REJECTED')
  for (const artifact of manifest.artifacts) {
    const artifactPath = path.join(repoRoot, artifact.path)
    if (!existsSync(artifactPath) || sha256(artifactPath) !== artifact.sha256) {
      fail('V4_ARTIFACT_HASH_MISMATCH', { artifact: artifact.path })
    }
  }
  if (sha256(migrationPath) !== MIGRATION_SHA256) fail('V4_MIGRATION_HASH_MISMATCH')
  return manifest
}

function psqlExecutable() {
  return process.platform === 'win32'
    ? 'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe'
    : 'psql'
}

function databaseEnvironment(environment) {
  const raw = environment.CP2B_QA_DATABASE_URL
  let parsed
  try {
    parsed = new URL(raw)
  } catch {
    fail('V4_QA_DATABASE_TARGET_REJECTED')
  }
  const username = decodeURIComponent(parsed.username)
  const direct = parsed.hostname === `db.${QA_REF}.supabase.co`
    && username === 'postgres'
    && (parsed.port === '' || parsed.port === '5432')
  const pooler = /^[a-z0-9-]+[.]pooler[.]supabase[.]com$/u.test(parsed.hostname)
    && username === `postgres.${QA_REF}`
    && ['5432', '6543'].includes(parsed.port)
  if (
    !['postgres:', 'postgresql:'].includes(parsed.protocol)
    || (!direct && !pooler)
    || parsed.pathname !== '/postgres'
    || parsed.searchParams.get('sslmode') !== 'require'
    || !parsed.password
    || raw.includes(PRODUCTION_REF)
  ) fail('V4_QA_DATABASE_TARGET_REJECTED')
  const childEnvironment = Object.fromEntries(
    [
      'PATH', 'Path', 'PATHEXT', 'SystemRoot', 'WINDIR', 'COMSPEC',
      'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HOME',
    ]
      .filter((name) => typeof environment[name] === 'string')
      .map((name) => [name, environment[name]]),
  )
  Object.assign(childEnvironment, {
    PGHOST: parsed.hostname,
    PGPORT: parsed.port || '5432',
    PGDATABASE: 'postgres',
    PGUSER: username,
    PGPASSWORD: decodeURIComponent(parsed.password),
    PGSSLMODE: 'require',
  })
  return childEnvironment
}

function runPsql(environment, { filePath, variables = {}, stage, capture = true }) {
  const args = [
    '-X', capture ? '-Atq' : '-q', '-v', 'ON_ERROR_STOP=1',
    '-v', 'VERBOSITY=verbose',
  ]
  for (const [name, value] of Object.entries(variables)) args.push('-v', `${name}=${value}`)
  args.push('-f', filePath)
  const result = spawnSync(psqlExecutable(), args, {
    cwd: repoRoot,
    env: databaseEnvironment(environment),
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180_000,
    maxBuffer: 8 * 1024 * 1024,
  })
  if (result.error || result.status !== 0) {
    fail('V4_POSTGRES_SQL_ERROR', {
      stage,
      exitCode: result.status ?? null,
      timedOut: result.error?.code === 'ETIMEDOUT',
      artifact: path.relative(repoRoot, filePath).replaceAll('\\', '/'),
    })
  }
  return String(result.stdout ?? '').trim()
}

function makeRunId() {
  return `CP3B2A-V4-${randomBytes(6).toString('hex').toUpperCase()}`
}

function gitStateV4(expectedHead = null) {
  const state = currentGitStateV2()
  const divergence = Array.isArray(state.divergence)
    ? state.divergence
    : String(state.divergence).split(/\s+/u).map(Number)
  const clean = typeof state.clean === 'boolean' ? state.clean : state.status === ''
  if (
    state.branch !== 'main'
    || state.head !== state.remoteHead
    || divergence[0] !== 0
    || divergence[1] !== 0
    || !clean
    || (expectedHead && state.head !== expectedHead)
  ) fail('V4_GIT_STATE_REJECTED')
  return state
}

export function assertAuthorizationV4(environment, gitState, backupVerifier = verifyPrivateBackupV3) {
  const legacyValues = [
    environment.CP3B2A_V1_EXECUTION_AUTHORIZED,
    environment.CP3B2A_EXECUTION_AUTHORIZED,
    environment.CP3B2A_V2_EXECUTION_AUTHORIZED,
    environment.CP3B2A_V3_EXECUTION_AUTHORIZED,
    environment.CP3B2A_V1_AUTHORIZATION_ID,
    environment.CP3B2A_AUTHORIZATION_ID,
    environment.CP3B2A_V2_AUTHORIZATION_ID,
    environment.CP3B2A_V3_AUTHORIZATION_ID,
  ].filter(Boolean)
  if (
    legacyValues.length > 0
    || environment.CP3B2A_V4_EXECUTION_AUTHORIZED !== 'true'
    || environment.CP3B2A_PROJECT_REF !== QA_REF
    || environment.CP3B2A_V4_AUTHORIZATION_ID !== AUTHORIZATION_ID_V4
    || environment.CP3B2A_V4_AUTHORIZED_HEAD !== gitState.head
    || gitState.head !== gitState.remoteHead
  ) fail('V4_EXECUTION_AUTHORIZATION_REJECTED')
  backupVerifier(environment.CP3B2A_PRIVATE_BACKUP_MANIFEST, gitState.head)
  return true
}

function createAttemptLedger(gitHead, manifestSha256, backupPath) {
  mkdirSync(privateRoot, { recursive: true })
  const ledgerPath = path.join(privateRoot, `v4-attempt-${gitHead}.json`)
  let handle
  try {
    handle = openSync(
      ledgerPath,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
      0o600,
    )
    writeFileSync(handle, `${JSON.stringify({
      version: 4,
      state: 'reserved',
      gitHead,
      projectRef: QA_REF,
      authorizationId: AUTHORIZATION_ID_V4,
      manifestSha256,
      backupPath: path.resolve(backupPath),
      applyAttempts: 0,
      recoveryAttempts: 0,
      automaticRetries: 0,
      createdAt: new Date().toISOString(),
    }, null, 2)}\n`)
  } catch {
    fail('V4_SECOND_ATTEMPT_REJECTED')
  } finally {
    if (handle !== undefined) {
      try {
        closeSync(handle)
      } catch {
        // A descriptor close failure is a hard local stop on the next ledger transition.
      }
    }
  }
  return ledgerPath
}

function updateLedger(ledgerPath, state, detail = {}) {
  const current = JSON.parse(readFileSync(ledgerPath, 'utf8'))
  const next = {
    ...current,
    ...detail,
    state,
    updatedAt: new Date().toISOString(),
  }
  writeFileSync(ledgerPath, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 })
}

export function planV4() {
  verifyPackageManifestV4()
  return {
    gate: GATE_V4,
    mode: 'plan',
    status: PACKAGE_STATUS_V4,
    qaApplication: 'READY_PENDING_EXPLICIT_V4_AUTHORIZATION',
    authorizationId: AUTHORIZATION_ID_V4,
    priorAuthorizationsReusable: false,
    target: 'QA_ONLY',
    production: 'REJECTED',
    migrationSha256: MIGRATION_SHA256,
    transactionalMatrix: 'PASS_ROLLED_BACK',
    concurrentMatrix: 'PASS_CLEANED',
    separatePostgresSessions: 2,
    barrier: 'TWO_UNGRANTED_ROW_EXCLUSIVE_LOCKS',
    maximumApplyAttempts: 1,
    maximumRecoveryAttempts: 1,
    automaticRetries: 0,
    remoteWrites: 0,
  }
}

export function preflightV4(environment, dependencies = {}) {
  verifyPackageManifestV4()
  const preflight = (dependencies.preflightV3 ?? (async () => {
    const module = await import('./run-cp3b2a-qa-v3.mjs')
    return module.preflightV3(environment, dependencies)
  }))()
  return Promise.resolve(preflight).then((result) => ({
    gate: GATE_V4,
    mode: 'preflight',
    status: 'READY_FOR_CP3B2A_QA_V4',
    target: result.target,
    gitHead: result.gitHead,
    originalHashes: result.originalHashes,
    v2Hashes: result.v2Hashes,
    v3Hashes: result.v3Hashes,
    v4Hashes: 'PASS',
    prestate: result.prestate,
    privateBackup: result.privateBackup,
    authorization: 'NOT_GRANTED',
    remoteWrites: 0,
  }))
}

export async function executeV4(environment) {
  const manifest = verifyPackageManifestV4()
  const gitState = gitStateV4(environment.CP3B2A_V4_AUTHORIZED_HEAD)
  assertAuthorizationV4(environment, gitState)
  databaseEnvironment(environment)
  const v3 = await import('./run-cp3b2a-qa-v3.mjs')
  const preflight = await v3.preflightV3(environment)
  if (preflight.status !== 'READY_FOR_CP3B2A_QA_V3') fail('V4_PRE_EFFECT_REJECTED')
  verifyPrivateBackupV3(environment.CP3B2A_PRIVATE_BACKUP_MANIFEST, gitState.head)
  const runId = makeRunId()
  const prestate = parseSingleJsonV3(runPsql(environment, {
    filePath: precheckPath,
    variables: { project_ref: QA_REF, v2_run_id: `CP3B2A-V2-${runId.slice(-12)}` },
    stage: 'precheck',
  }))
  validatePrestateV2(prestate)
  const ledgerPath = createAttemptLedger(
    gitState.head,
    sha256(manifestPath),
    environment.CP3B2A_PRIVATE_BACKUP_MANIFEST,
  )
  const stages = []
  let currentStage = 'apply'
  let applyCommitted = false
  let recoveryAttempts = 0
  try {
    updateLedger(ledgerPath, 'apply_started', { applyAttempts: 1 })
    runPsql(environment, {
      filePath: migrationPath,
      stage: 'apply',
      capture: false,
    })
    applyCommitted = true
    stages.push('apply_committed')
    currentStage = 'postcheck'
    const poststate = parseSingleJsonV3(runPsql(environment, {
      filePath: postcheckStatePath,
      stage: 'postcheck_state',
    }))
    validatePoststateV2(prestate, poststate)
    validateDetailedPostcheckV3(parseEnvelopeV3(runPsql(environment, {
      filePath: postcheckDetailPath,
      stage: 'postcheck_detail',
    }), 'postcheck'))
    stages.push('postcheck_validated')
    currentStage = 'transactional_matrix'
    const transactional = parseEnvelopeV4(runPsql(environment, {
      filePath: matrixPath,
      variables: { project_ref: QA_REF, run_id: runId },
      stage: 'transactional_matrix',
    }), 'transactional_matrix')
    if (
      transactional.result !== 'PASS'
      || transactional.transaction !== 'ROLLED_BACK'
      || transactional.requestSideEffects !== 0
      || transactional.auditSideEffects !== 0
      || transactional.rateLimitSideEffects !== 0
    ) fail('V4_TRANSACTIONAL_MATRIX_REJECTED')
    stages.push('transactional_matrix_pass_rolled_back')
    currentStage = 'concurrent_matrix'
    const concurrent = await runConcurrencyV4({
      databaseUrl: environment.CP2B_QA_DATABASE_URL,
      environment,
      runId,
    })
    if (concurrent.result !== 'PASS' || concurrent.cleanup !== 'PASS_CLEANED') {
      fail('V4_CONCURRENT_MATRIX_REJECTED')
    }
    stages.push('concurrent_matrix_pass_cleaned')
    currentStage = 'final_postcheck'
    validatePoststateV2(prestate, parseSingleJsonV3(runPsql(environment, {
      filePath: postcheckStatePath,
      stage: 'final_postcheck_state',
    })))
    validateDetailedPostcheckV3(parseEnvelopeV3(runPsql(environment, {
      filePath: postcheckDetailPath,
      stage: 'final_postcheck_detail',
    }), 'postcheck'))
    updateLedger(ledgerPath, 'completed', {
      applyAttempts: 1,
      recoveryAttempts: 0,
      transactionalMatrix: 'PASS_ROLLED_BACK',
      concurrentMatrix: 'PASS_CLEANED',
    })
    return {
      verdict: 'PASS',
      target: 'QA_MATCH',
      applyAttempts: 1,
      recoveryAttempts: 0,
      automaticRetries: 0,
      stages,
    }
  } catch (error) {
    const envelope = buildFailureEnvelopeV3({
      error,
      stage: currentStage,
      runId,
      stages,
      runtime: {
        applyStarted: true,
        applyCommitted,
        postcheckStarted: stages.includes('apply_committed'),
        matrixStarted: stages.includes('postcheck_validated'),
        ledgerCompleted: false,
      },
      sensitiveValues: [
        environment.CP2B_QA_DATABASE_URL,
        environment.SUPABASE_ACCESS_TOKEN,
      ].filter(Boolean),
    })
    const failurePath = persistPrivateFailureEnvelopeV3(envelope)
    verifyPrivateFailureEnvelopeV3(failurePath, runId)
    if (!applyCommitted || error?.detail?.recovery === 'MANUAL_VERIFICATION_REQUIRED') {
      updateLedger(ledgerPath, 'manual_verification_required')
      updatePrivateFailureEnvelopeV3(failurePath, { recoveryOutcome: 'failed' })
      fail('V4_EXECUTION_FAILED', {
        publicFailure: publicFailureSummaryV3(
          JSON.parse(readFileSync(failurePath, 'utf8')),
        ),
      })
    }
    recoveryAttempts = 1
    updateLedger(ledgerPath, 'recovery_started', { recoveryAttempts })
    try {
      const rollback = runPsql(environment, {
        filePath: rollbackPath,
        stage: 'recovery',
      })
      const legacy = parseSingleJsonV3(rollback)
      const detail = parseEnvelopeV3(rollback, 'rollback')
      if (
        legacy.result !== 'PASS'
        || legacy.contractAbsent !== true
        || detail.result !== 'PASS'
      ) fail('V4_RECOVERY_REJECTED')
      const restored = parseSingleJsonV3(runPsql(environment, {
        filePath: precheckPath,
        variables: { project_ref: QA_REF, v2_run_id: `CP3B2A-V2-${runId.slice(-12)}` },
        stage: 'recovery_precheck',
      }))
      assertRecoveredPrestateV4(prestate, restored)
      updateLedger(ledgerPath, 'blocked_recovered', { recoveryAttempts })
      updatePrivateFailureEnvelopeV3(failurePath, {
        recoveryStarted: true,
        recoveryOutcome: 'restored',
      })
    } catch (recoveryError) {
      updateLedger(ledgerPath, 'manual_verification_required', { recoveryAttempts })
      updatePrivateFailureEnvelopeV3(failurePath, {
        recoveryStarted: true,
        recoveryOutcome: 'failed',
        recoveryFailure: sanitizeFailureV3(recoveryError, 'recovery'),
      })
    }
    fail('V4_EXECUTION_FAILED', {
      publicFailure: publicFailureSummaryV3(
        JSON.parse(readFileSync(failurePath, 'utf8')),
      ),
    })
  }
}

async function main() {
  const mode = assertModeV4(process.argv.slice(2))
  if (mode === '--plan') {
    process.stdout.write(`${JSON.stringify(planV4(), null, 2)}\n`)
    return
  }
  if (mode === '--preflight') {
    process.stdout.write(`${JSON.stringify(await preflightV4(process.env), null, 2)}\n`)
    return
  }
  process.stdout.write(`${JSON.stringify(await executeV4(process.env), null, 2)}\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const publicFailure = error instanceof DiagnosticError
      ? error.detail?.publicFailure
      : null
    if (publicFailure) process.stderr.write(`${JSON.stringify(publicFailure)}\n`)
    else process.stderr.write(`BLOCKED: ${sanitizeFailureV3(error, 'entrypoint').failureCode}\n`)
    process.exitCode = 1
  })
}
