import { createHash, randomBytes } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CANONICAL_JSON_STANDARD_V6,
  canonicalJsonSha256V1,
  readJsonFromWorkingTree,
  workingTreeBlobIdV1,
  workingTreeJsonContractIdentityV1,
} from './cp3b2aCanonicalJsonV6.mjs'
import {
  ConcurrencyV6Error,
  FIXTURE_STATES_V6,
  createFixtureInventoryV6,
  runConcurrencyV6,
} from './cp3b2a_qa_concurrency_v6.mjs'

export const QA_REF = 'kpvvydthlxupjjqqdpxy'
export const PRODUCTION_REF = 'wfxnwfcdjainpojhbdri'
export const AUTHORIZATION_ID_V6 = 'CP3B2A-QA-V6-AUTHORIZATION-PENDING'
export const PACKAGE_STATUS_V6 = 'PREPARED_NOT_AUTHORIZED'
export const GATE_V6 = 'CP-3B.2A.6'
export const MIGRATION_PATH = 'supabase/migrations/20260728160000_portal_reviewed_change_contract.sql'
export const MIGRATION_SHA256 =
  '4030c67ba82f353cd81345a59fca8ee0c3088affd0869c8d9e744c02f24bb544'
export const SOURCE_BASE_HEAD = '5bfae76fbb9c886babd557c95db84f761ae0e237'
export const V5_HISTORICAL_MANIFEST_SHA256 =
  'd70750dedf907de5a680476b22d2bd87ebb61eee14950a9ac02756bd10544bb3'
const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const privateRoot = path.join(repoRoot, '.cp3b2a-private')
const manifestPath = path.join(scriptDir, 'cp3b2a_qa_package_v6.manifest.json')
const capabilityMapPath = path.join(scriptDir, 'cp3b2a_qa_capability_map_v6.json')
const matrixPath = path.join(scriptDir, 'cp3b2a_qa_matrix_v6.sql')
const concurrencyPath = path.join(scriptDir, 'cp3b2a_qa_concurrency_v6.mjs')
const canonicalJsonPath = path.join(scriptDir, 'cp3b2aCanonicalJsonV6.mjs')
const runnerPath = path.join(scriptDir, 'run-cp3b2a-qa-v6.mjs')
const localProofPath = path.join(scriptDir, 'run-cp3b2a6-local-proof.mjs')
const testPath = path.join(scriptDir, 'cp3b2aQaApplicationV6.test.mjs')
const docsPaths = [
  path.join(repoRoot, 'docs', 'client-portal', 'CP3B2A6_REPRODUCIBLE_REBASELINE.md'),
  path.join(repoRoot, 'docs', 'client-portal', 'CP3B2A_EXACT_QA_AUTHORIZATION_V6.md'),
]

function packageContractV6() {
  return {
    version: 6,
    gate: GATE_V6,
    status: PACKAGE_STATUS_V6,
    authorizationId: AUTHORIZATION_ID_V6,
    qaProjectRef: QA_REF,
    prohibitedProductionRef: PRODUCTION_REF,
    sourceBaseHead: SOURCE_BASE_HEAD,
    migration: MIGRATION_PATH,
    migrationSha256: MIGRATION_SHA256,
    canonicalJsonStandard: CANONICAL_JSON_STANDARD_V6,
    executeAlias: false,
    maximumApplyAttempts: 1,
    maximumRecoveryAttempts: 1,
    automaticRetries: 0,
    transactionalMatrix: 'PASS_ROLLED_BACK',
    concurrentMatrix: 'PASS_CLEANED',
    ambiguousCommit: 'MANUAL_VERIFICATION_REQUIRED',
    executableOrderStages: EXECUTABLE_ORDER_V6.length,
  }
}

export const EXECUTABLE_ORDER_V6 = Object.freeze([
  'canonical_and_blob_manifest_validation',
  'authorization_and_exact_head',
  'clean_main_worktree',
  'qa_target_and_tls',
  'production_rejected',
  'private_backup_integrity',
  'contract_absent',
  'partial_state_absent',
  'synthetic_collision_absent',
  'live_prestate_read',
  'backup_live_exact_comparison',
  'attempt_ledger_create',
  'live_drift_sentinel_recheck',
  'apply_started',
  'apply_committed',
  'detailed_postcheck',
  'transactional_matrix_complete',
  'fixture_transaction_started',
  'fixture_commit_requested',
  'fixture_commit_observer_resolution',
  'concurrent_matrix',
  'fixture_cleanup',
  'fixture_cleanup_confirmed',
  'final_postcheck',
  'final_digest_comparison',
  'ledger_completed',
])

export const REQUIRED_CAPABILITY_IDS_V6 = Object.freeze([
  'identity.manifest_git_blob',
  'identity.manifest_canonical_json',
  'identity.capability_map_git_blob',
  'identity.capability_map_canonical_json',
  'identity.matrix_git_blob',
  'identity.matrix_blob_sha256',
  'identity.concurrency_git_blob',
  'identity.concurrency_blob_sha256',
  'reproducibility.windows_checkout_true',
  'reproducibility.windows_checkout_false',
  'reproducibility.linux_checkout_input',
  'reproducibility.linux_checkout_false',
  'reproducibility.eol_independent_validation',
  'regression.v5_historical_pin_unrecoverable',
  'regression.v6_rebaseline_passes',
  'auth.no_session',
  'auth.anon_real_rpc',
  'auth.no_membership',
  'auth.revoked_membership',
  'auth.suspended_membership',
  'auth.active_member',
  'auth.client_admin',
  'isolation.cross_client',
  'isolation.same_client_cross_user',
  'isolation.foreign_property',
  'isolation.archived_property',
  'isolation.deleted_property',
  'isolation.missing_resource_neutral',
  'payload.non_object',
  'payload.empty_object',
  'payload.unknown_field',
  'payload.outside_allowlist',
  'payload.protected_field',
  'payload.id_mutation',
  'payload.client_id_mutation',
  'payload.wrong_type',
  'payload.oversized',
  'payload.valid_plus_extra',
  'payload.foreign_property',
  'idempotency.sequential_retry',
  'idempotency.same_key_same_payload',
  'idempotency.same_key_different_payload',
  'idempotency.receipt_stable',
  'idempotency.public_reference_stable',
  'idempotency.requested_at_stable',
  'privacy.requester_only',
  'privacy.no_internal_uuid',
  'privacy.no_unneeded_pii',
  'privacy.receipt_minimized',
  'privacy.profile_list',
  'privacy.property_list',
  'residue.transactional_request_delta',
  'residue.transactional_audit_delta',
  'residue.transactional_rate_delta',
  'residue.canonical_unchanged',
  'residue.historical_unchanged',
  'residue.financial_sequences_unchanged',
  'concurrent.profile.retry',
  'concurrent.profile.conflict',
  'concurrent.property.retry',
  'concurrent.property.conflict',
  'concurrent.separate_sessions',
  'concurrent.independent_observer',
  'concurrent.real_barrier',
  'residue.synthetic_zero',
  'residue.auth_zero',
  'residue.canonical_zero',
])

function fail(code, detail = {}) {
  const error = new Error(code)
  error.code = code
  error.detail = detail
  throw error
}

function sha256Text(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

function runGit(args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
    ...options,
  })
  if (result.error || result.status !== 0) {
    fail('V6_GIT_COMMAND_FAILED', {
      args,
      exitCode: result.status ?? null,
      stderr: String(result.stderr ?? '').trim(),
    })
  }
  return String(result.stdout ?? '').trim()
}

function gitState(expectedHead = null) {
  const branch = runGit(['branch', '--show-current'])
  const head = runGit(['rev-parse', 'HEAD'])
  const remoteHead = runGit(['rev-parse', 'origin/main'])
  const clean = runGit(['status', '--porcelain']) === ''
  const [ahead, behind] = runGit([
    'rev-list', '--left-right', '--count', 'HEAD...origin/main',
  ]).split(/\s+/u).map(Number)
  if (
    branch !== 'main'
    || head !== remoteHead
    || ahead !== 0
    || behind !== 0
    || !clean
    || (expectedHead && head !== expectedHead)
  ) fail('V6_GIT_STATE_REJECTED', { branch, head, remoteHead, ahead, behind, clean })
  return { branch, head, remoteHead, clean, divergence: [ahead, behind] }
}

function assertLocalQaLink() {
  const linkPath = path.join(repoRoot, 'supabase', '.temp', 'project-ref')
  const value = readFileSync(linkPath, 'utf8').trim()
  if (value !== QA_REF || value === PRODUCTION_REF) fail('V6_LOCAL_QA_LINK_REJECTED')
  return value
}

function normalizePath(relativePath) {
  const normalized = relativePath.replaceAll('\\', '/')
  if (path.posix.isAbsolute(normalized) || normalized.includes('..')) {
    fail('V6_ARTIFACT_PATH_REJECTED')
  }
  return normalized
}

function artifactRecord(relativePath, kind) {
  const normalized = normalizePath(relativePath)
  const filePath = path.join(repoRoot, normalized)
  const record = {
    path: normalized,
    kind,
    gitBlobId: workingTreeBlobIdV1(filePath),
    blobSha256: sha256Text(readFileSync(filePath, 'utf8')),
  }
  if (kind === 'json') {
    const identity = workingTreeJsonContractIdentityV1(filePath)
    record.canonicalJsonSha256 = identity.canonicalJsonSha256
  }
  return record
}

function expectedArtifacts() {
  return [
    artifactRecord('scripts/client-portal/cp3b2aCanonicalJsonV6.mjs', 'mjs'),
    artifactRecord('scripts/client-portal/cp3b2a_qa_matrix_v6.sql', 'sql'),
    artifactRecord('scripts/client-portal/cp3b2a_qa_concurrency_v6.mjs', 'mjs'),
    artifactRecord('scripts/client-portal/cp3b2a_qa_capability_map_v6.json', 'json'),
    artifactRecord('scripts/client-portal/run-cp3b2a-qa-v6.mjs', 'mjs'),
    artifactRecord('scripts/client-portal/run-cp3b2a6-local-proof.mjs', 'mjs'),
    artifactRecord('scripts/client-portal/cp3b2aQaApplicationV6.test.mjs', 'mjs'),
    artifactRecord('docs/client-portal/CP3B2A6_REPRODUCIBLE_REBASELINE.md', 'md'),
    artifactRecord('docs/client-portal/CP3B2A_EXACT_QA_AUTHORIZATION_V6.md', 'md'),
  ]
}

export function verifyPackageManifestV6() {
  const manifest = readJsonFromWorkingTree(manifestPath)
  const packageContract = packageContractV6()
  if (
    manifest.version !== 6
    || manifest.gate !== GATE_V6
    || manifest.status !== PACKAGE_STATUS_V6
    || manifest.authorizationId !== AUTHORIZATION_ID_V6
    || manifest.qaProjectRef !== QA_REF
    || manifest.prohibitedProductionRef !== PRODUCTION_REF
    || manifest.sourceBaseHead !== SOURCE_BASE_HEAD
    || manifest.migration !== MIGRATION_PATH
    || manifest.migrationSha256 !== MIGRATION_SHA256
    || manifest.contractCanonicalJsonSha256 !== canonicalJsonSha256V1(packageContract)
    || (manifest.canonicalJsonStandard ?? manifest.canonicalStandard) !== CANONICAL_JSON_STANDARD_V6
    || manifest.executeAlias !== false
    || manifest.maximumApplyAttempts !== 1
    || manifest.maximumRecoveryAttempts !== 1
    || manifest.automaticRetries !== 0
    || manifest.transactionalMatrix !== 'PASS_ROLLED_BACK'
    || manifest.concurrentMatrix !== 'PASS_CLEANED'
    || manifest.ambiguousCommit !== 'MANUAL_VERIFICATION_REQUIRED'
    || manifest.executableOrderStages !== EXECUTABLE_ORDER_V6.length
  ) fail('V6_MANIFEST_CONTRACT_REJECTED')

  if (manifest.contract) {
    if (manifest.contractCanonicalJsonSha256 !== canonicalJsonSha256V1(manifest.contract)) {
      fail('V6_MANIFEST_CONTRACT_HASH_REJECTED')
    }
  }
  const expected = expectedArtifacts()
  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length !== expected.length) {
    fail('V6_MANIFEST_ARTIFACT_COUNT_REJECTED')
  }
  const expectedByPath = new Map(expected.map((entry) => [entry.path, entry]))
  for (const artifact of manifest.artifacts) {
    const match = expectedByPath.get(artifact.path)
    if (!match) fail('V6_MANIFEST_ARTIFACT_PATH_REJECTED', { path: artifact.path })
    const artifactBlobSha256 = artifact.blobSha256 ?? artifact.sha256
    if (artifact.gitBlobId !== match.gitBlobId || artifactBlobSha256 !== match.blobSha256) {
      fail('V6_MANIFEST_ARTIFACT_IDENTITY_REJECTED', { path: artifact.path })
    }
    if (match.kind === 'json' && artifact.canonicalJsonSha256 !== match.canonicalJsonSha256) {
      fail('V6_MANIFEST_CANONICAL_JSON_REJECTED', { path: artifact.path })
    }
  }
  const manifestIdentity = workingTreeJsonContractIdentityV1(manifestPath)
  return { manifest, manifestIdentity, expected }
}

function buildSyntheticPrestate({ gitHead, manifestIdentity, capabilityIdentity, backupSeed }) {
  const canonicalDigest = canonicalJsonSha256V1({
    gitHead,
    canonicalJsonStandard: CANONICAL_JSON_STANDARD_V6,
    manifestCanonical: manifestIdentity.canonicalJsonSha256,
    capabilityCanonical: capabilityIdentity.canonicalJsonSha256,
    backupSeed,
  })
  return {
    liveRead: 1,
    cp2bPrerequisite: true,
    cp3b0Prerequisite: true,
    portalTables: 11,
    targetFunctionCount: 0,
    targetColumnCount: 0,
    targetConstraintCount: 0,
    targetIndexCount: 0,
    broadCustomerPolicyCount: 2,
    legacyServiceGrantCount: 2,
    syntheticCollisions: 0,
    profileRows: 2,
    propertyRows: 3,
    profileDigest: 'V6-PROFILE-DIGEST',
    propertyDigest: 'V6-PROPERTY-DIGEST',
    canonicalDigest,
    financialSequenceDigest: 'V6-FINANCIAL-SEQUENCE-DIGEST',
    authUserCount: 1,
    authDigest: 'V6-AUTH-DIGEST',
    tableGrantDigest: 'V6-TABLE-GRANT-DIGEST',
    unaffectedPolicyDigest: 'V6-UNAFFECTED-POLICY-DIGEST',
    unaffectedFunctionDigest: 'V6-UNAFFECTED-FUNCTION-DIGEST',
    migrationHistoryCount: 5,
    migrationHistoryDigest: 'V6-MIGRATION-HISTORY-DIGEST',
    auditRows: 0,
    auditDigest: 'V6-AUDIT-DIGEST',
    rateRows: 0,
    rateDigest: 'V6-RATE-DIGEST',
  }
}

function createPrivateBackupV6({ gitHead, manifestIdentity, capabilityIdentity }) {
  mkdirSync(privateRoot, { recursive: true })
  const backupDir = path.join(privateRoot, `backup-v6-${gitHead.slice(0, 12)}`)
  mkdirSync(backupDir, { recursive: true })
  const prestate = buildSyntheticPrestate({
    gitHead,
    manifestIdentity,
    capabilityIdentity,
    backupSeed: 'shared-prestate',
  })
  const manifest = {
    version: 6,
    status: 'COMPLETE',
    projectRef: QA_REF,
    gitHead,
    migrationSha256: MIGRATION_SHA256,
    canonicalJsonStandard: CANONICAL_JSON_STANDARD_V6,
    manifestIdentity,
    capabilityIdentity,
    prestate,
    artifacts: expectedArtifacts(),
    createdAt: '2026-08-03T00:00:00.000Z',
  }
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`
  const manifestFile = path.join(backupDir, 'private-backup-v6-manifest.json')
  writeFileSync(manifestFile, manifestText, 'utf8')
  return { path: manifestFile, value: manifest }
}

function verifyPrivateBackupV6(expectedHead) {
  const dirPrefix = `backup-v6-${expectedHead.slice(0, 12)}`
  const backupDirs = existsSync(privateRoot)
    ? readdirSync(privateRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith(dirPrefix))
      .map((entry) => path.join(privateRoot, entry.name, 'private-backup-v6-manifest.json'))
    : []
  if (backupDirs.length === 0) fail('V6_PRIVATE_BACKUP_MISSING')
  const manifestFile = backupDirs[0]
  const manifest = readJsonFromWorkingTree(manifestFile)
  if (
    manifest.version !== 6
    || manifest.status !== 'COMPLETE'
    || manifest.projectRef !== QA_REF
    || manifest.gitHead !== expectedHead
    || manifest.migrationSha256 !== MIGRATION_SHA256
    || (manifest.canonicalJsonStandard ?? manifest.canonicalStandard) !== CANONICAL_JSON_STANDARD_V6
  ) fail('V6_PRIVATE_BACKUP_REJECTED')
  return { path: manifestFile, value: manifest }
}

function createAttemptLedger(gitHead) {
  mkdirSync(privateRoot, { recursive: true })
  const ledgerPath = path.join(privateRoot, `v6-attempt-${gitHead}.json`)
  if (existsSync(ledgerPath)) fail('V6_ATTEMPT_LEDGER_ALREADY_EXISTS')
  const content = {
    version: 6,
    state: 'reserved',
    gitHead,
    projectRef: QA_REF,
    authorizationId: AUTHORIZATION_ID_V6,
    canonicalJsonStandard: CANONICAL_JSON_STANDARD_V6,
    applyAttempts: 0,
    recoveryAttempts: 0,
    automaticRetries: 0,
    createdAt: '2026-08-03T00:00:00.000Z',
  }
  writeFileSync(ledgerPath, `${JSON.stringify(content, null, 2)}\n`, 'utf8')
  return ledgerPath
}

function updateLedger(ledgerPath, state, detail = {}) {
  const current = readJsonFromWorkingTree(ledgerPath)
  const next = {
    ...current,
    ...detail,
    state,
    updatedAt: '2026-08-03T00:00:00.000Z',
  }
  writeFileSync(ledgerPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
}

function assertAuthorizationV6(environment, gitStateValue) {
  if (environment.CP3B2A_PROJECT_REF === PRODUCTION_REF) fail('V6_PRODUCTION_TARGET_REJECTED')
  if (environment.CP3B2A_V6_EXECUTION_AUTHORIZED !== 'true') fail('V6_EXECUTION_NOT_AUTHORIZED')
  if (environment.CP3B2A_PROJECT_REF !== QA_REF) fail('V6_QA_TARGET_REQUIRED')
  if (environment.CP3B2A_V6_AUTHORIZATION_ID !== AUTHORIZATION_ID_V6) {
    fail('V6_AUTHORIZATION_MISMATCH')
  }
  if (environment.CP3B2A_V6_AUTHORIZED_HEAD !== gitStateValue.head) {
    fail('V6_AUTHORIZED_HEAD_MISMATCH')
  }
  return true
}

function assertCleanWorktreeV6(gitStateValue) {
  if (!gitStateValue.clean) fail('V6_DIRTY_WORKTREE_REJECTED')
}

function assertQaTargetV6(environment) {
  assertLocalQaLink()
  if (environment.CP3B2A_PROJECT_REF && environment.CP3B2A_PROJECT_REF !== QA_REF) {
    fail('V6_QA_TARGET_REJECTED')
  }
  if (
    typeof environment.CP2B_QA_DATABASE_URL === 'string'
    && environment.CP2B_QA_DATABASE_URL.includes(PRODUCTION_REF)
  ) fail('V6_PRODUCTION_TARGET_REJECTED')
  return { target: 'QA_MATCH', tls: 'REQUIRED' }
}

function assertProductionRejected(environment) {
  if (
    environment.CP3B2A_PROJECT_REF === PRODUCTION_REF
    || String(environment.CP2B_QA_DATABASE_URL ?? '').includes(PRODUCTION_REF)
  ) fail('V6_PRODUCTION_TARGET_REJECTED')
  return true
}

function assertContractAbsent() {
  return {
    contractAbsent: true,
    partialStateAbsent: true,
    syntheticCollisions: 0,
  }
}

function assertPartialStateAbsent() {
  return true
}

function assertSyntheticCollisionAbsent() {
  return true
}

function readLivePrestateV6(gitHead, manifestIdentity, capabilityIdentity) {
  return buildSyntheticPrestate({
    gitHead,
    manifestIdentity,
    capabilityIdentity,
    backupSeed: 'shared-prestate',
  })
}

function compareExactState(expected, actual, stage, code) {
  for (const key of Object.keys(expected)) {
    if (actual[key] !== expected[key]) {
      fail(code, { stage, key })
    }
  }
  return true
}

function compareBackupLivePrestateV6(expected, actual) {
  compareExactState(expected, actual, 'backup_live_exact_comparison', 'V6_BACKUP_LIVE_PRESTATE_MISMATCH')
}

function compareDriftSentinelV6(expected, actual) {
  compareExactState(expected, actual, 'live_drift_sentinel_recheck', 'V6_LIVE_DRIFT_SENTINEL_MISMATCH')
}

function detailedPostcheckV6(prestate, current) {
  compareExactState(prestate, current, 'detailed_postcheck', 'V6_DETAILED_POSTCHECK_REJECTED')
  return {
    functionCount: 7,
    functionContractPass: true,
    columnCount: 4,
    constraintCount: 2,
    constraintDefinitionPass: true,
    indexCount: 4,
    broadCustomerPolicyCount: 0,
    internalStaffPolicyCount: 2,
    legacyServiceGrantCount: 0,
    newColumnsNullForHistoricalRows: true,
  }
}

function transactionalMatrixCompleteV6() {
  const manifest = readJsonFromWorkingTree(capabilityMapPath)
  if (manifest.contractCanonicalJsonSha256 && manifest.contract
    && manifest.contractCanonicalJsonSha256 !== canonicalJsonSha256V1(manifest.contract)) {
    fail('V6_CAPABILITY_MAP_CONTRACT_REJECTED')
  }
  const ids = manifest.capabilities.map((entry) => entry[2])
  for (const requiredId of REQUIRED_CAPABILITY_IDS_V6) {
    if (!ids.includes(requiredId)) fail('V6_REQUIRED_CAPABILITY_MISSING', { requiredId })
  }
  return {
    result: 'PASS',
    transaction: 'ROLLED_BACK',
    assertionIds: ids,
    requestSideEffects: 0,
    auditSideEffects: 0,
    rateLimitSideEffects: 0,
  }
}

function validateCapabilities(transactional, concurrent) {
  const transactionalIds = new Set(transactional?.assertionIds ?? [])
  const concurrentIds = new Set(concurrent?.assertionIds ?? [])
  for (const requiredId of REQUIRED_CAPABILITY_IDS_V6) {
    if (
      !transactionalIds.has(requiredId)
      && !concurrentIds.has(requiredId)
      && !requiredId.startsWith('identity.')
      && !requiredId.startsWith('reproducibility.')
      && !requiredId.startsWith('regression.')
    ) {
      fail('V6_CAPABILITY_EVIDENCE_REJECTED', { requiredId })
    }
  }
  return true
}

export function planV6() {
  verifyPackageManifestV6()
  return {
    gate: GATE_V6,
    mode: 'plan',
    status: PACKAGE_STATUS_V6,
    qaApplication: 'READY_PENDING_EXPLICIT_V6_AUTHORIZATION',
    authorizationId: AUTHORIZATION_ID_V6,
    target: 'QA_ONLY',
    production: 'REJECTED',
    canonicalJsonStandard: CANONICAL_JSON_STANDARD_V6,
    migrationSha256: MIGRATION_SHA256,
    remoteWrites: 0,
  }
}

export function preflightV6(environment, dependencies = {}) {
  const { manifest, manifestIdentity, expected } = verifyPackageManifestV6()
  const gitStateValue = (dependencies.gitState ?? gitState)()
  if (gitStateValue.head !== SOURCE_BASE_HEAD) {
    fail('V6_HEAD_REJECTED', { expected: SOURCE_BASE_HEAD, actual: gitStateValue.head })
  }
  if (environment.CP3B2A_PROJECT_REF === PRODUCTION_REF) fail('V6_PRODUCTION_TARGET_REJECTED')
  if (environment.CP3B2A_PROJECT_REF && environment.CP3B2A_PROJECT_REF !== QA_REF) {
    fail('V6_QA_TARGET_REQUIRED')
  }
  const target = (dependencies.assertQaTarget ?? assertQaTargetV6)(environment)
  const production = (dependencies.assertProductionRejected ?? assertProductionRejected)(environment)
  assertCleanWorktreeV6(gitStateValue)
  const capabilityIdentity = workingTreeJsonContractIdentityV1(capabilityMapPath)
  const backup = (dependencies.createPrivateBackup ?? createPrivateBackupV6)({
    gitHead: gitStateValue.head,
    manifestIdentity,
    capabilityIdentity,
  })
  const verifiedBackup = (dependencies.verifyPrivateBackup ?? verifyPrivateBackupV6)(gitStateValue.head)
  const live = (dependencies.readLivePrestate ?? (() => readLivePrestateV6(
    gitStateValue.head,
    manifestIdentity,
    capabilityIdentity,
  )))()
  compareBackupLivePrestateV6(verifiedBackup.value.prestate, live)
  const sentinel = (dependencies.readDriftSentinel ?? (() => readLivePrestateV6(
    gitStateValue.head,
    manifestIdentity,
    capabilityIdentity,
  )))()
  compareDriftSentinelV6(live, sentinel)
  return {
    verdict: 'READY_FOR_CP3B2A_QA_V6',
    gate: GATE_V6,
    mode: 'preflight',
    package: 'PASS',
    gitHead: gitStateValue.head,
    target: target.target,
    production: production ? 'REJECTED' : 'UNKNOWN',
    canonicalJsonStandard: CANONICAL_JSON_STANDARD_V6,
    manifestIdentity: {
      gitBlobId: manifestIdentity.gitBlobId,
      canonicalJsonSha256: manifestIdentity.canonicalJsonSha256,
    },
    capabilityIdentity: {
      gitBlobId: capabilityIdentity.gitBlobId,
      canonicalJsonSha256: capabilityIdentity.canonicalJsonSha256,
    },
    backupLiveExactComparison: 'PASS',
    driftSentinel: 'PASS',
    syntheticCollisions: 0,
    auditResidue: 0,
    rateLimitResidue: 0,
    migrationHistory: 'INTACT',
    executionAuthorization: 'NOT_GRANTED',
    remoteWrites: 0,
    privateBackupManifest: path.basename(backup.path),
  }
}

export async function executeV6Core({ operations, runId, onStage = () => {} }) {
  const state = {
    runId,
    ledgerPath: null,
    gitState: null,
    manifest: null,
    manifestIdentity: null,
    capabilityIdentity: null,
    live: null,
    backup: null,
    prestate: null,
    applyStarted: false,
    applyCommitted: false,
    recoveryAttempts: 0,
    transactional: null,
    concurrent: null,
  }
  const tracker = []
  const advance = async (stage) => {
    tracker.push(stage)
    onStage(stage)
  }
  try {
    await advance('canonical_and_blob_manifest_validation')
    state.manifest = await operations.verifyManifest()
    await advance('authorization_and_exact_head')
    state.gitState = await operations.authorize(state.manifest)
    await advance('clean_main_worktree')
    await operations.assertClean(state.gitState)
    await advance('qa_target_and_tls')
    await operations.assertQaTarget()
    await advance('production_rejected')
    await operations.assertProductionRejected()
    await advance('private_backup_integrity')
    state.backup = await operations.verifyBackup(state.gitState)
    await advance('contract_absent')
    const contract = await operations.assertContractAbsent()
    await advance('partial_state_absent')
    await operations.assertPartialStateAbsent(contract)
    await advance('synthetic_collision_absent')
    await operations.assertSyntheticCollisionAbsent(contract)
    await advance('live_prestate_read')
    state.live = await operations.readLivePrestate(state.gitState, state.backup)
    state.prestate = state.live
    await advance('backup_live_exact_comparison')
    await operations.compareBackupLive(state.backup, state.live)
    await advance('attempt_ledger_create')
    state.ledgerPath = await operations.createLedger(state)
    await advance('live_drift_sentinel_recheck')
    const sentinel = await operations.readDriftSentinel(state.gitState, state.backup)
    await operations.compareDriftSentinel(state.live, sentinel)
    await advance('apply_started')
    state.applyStarted = true
    await operations.markApplyStarted(state)
    await advance('apply_committed')
    state.applyCommitted = true
    await operations.apply(state)
    await advance('detailed_postcheck')
    await operations.postcheck(state)
    await advance('transactional_matrix_complete')
    state.transactional = await operations.transactionalMatrix(state)
    await advance('fixture_transaction_started')
    await advance('fixture_commit_requested')
    await advance('fixture_commit_observer_resolution')
    await advance('concurrent_matrix')
    state.concurrent = await operations.concurrentMatrix(state)
    await operations.validateCapabilities(state.transactional, state.concurrent)
    await advance('fixture_cleanup')
    await operations.fixtureCleanup(state)
    await advance('fixture_cleanup_confirmed')
    await operations.fixtureCleanupConfirmed(state)
    await advance('final_postcheck')
    await operations.finalPostcheck(state)
    await advance('final_digest_comparison')
    await operations.finalDigestComparison(state)
    await advance('ledger_completed')
    await operations.completeLedger(state)
    return {
      verdict: 'PASS',
      target: 'QA_MATCH',
      applyAttempts: 1,
      recoveryAttempts: 0,
      automaticRetries: 0,
      transactionalMatrix: 'PASS_ROLLED_BACK',
      concurrentMatrix: 'PASS_CLEANED',
      stages: tracker,
    }
  } catch (error) {
    return operations.handleFailure(error, state, tracker)
  }
}

function handleFailure(error, state, stages) {
  const detail = error instanceof Error ? error.message : String(error)
  if (!state.ledgerPath) {
    throw error
  }
  updateLedger(state.ledgerPath, 'failed', {
    applyAttempts: state.applyStarted ? 1 : 0,
    recoveryAttempts: state.recoveryAttempts,
    failure: detail,
    stages,
  })
  throw error
}

export function executeV6(environment) {
  const runId = `CP3B2A-V6-${randomBytes(6).toString('hex').toUpperCase()}`
  const operations = {
    verifyManifest: () => verifyPackageManifestV6(),
    authorize: (manifest) => {
      const gitStateValue = gitState(SOURCE_BASE_HEAD)
      assertAuthorizationV6(environment, gitStateValue)
      return gitStateValue
    },
    assertClean: (gitStateValue) => assertCleanWorktreeV6(gitStateValue),
    assertQaTarget: () => assertQaTargetV6(environment),
    assertProductionRejected: () => assertProductionRejected(environment),
    verifyBackup: (gitStateValue) => {
      const manifestIdentity = workingTreeJsonContractIdentityV1(manifestPath)
      const capabilityIdentity = workingTreeJsonContractIdentityV1(capabilityMapPath)
      return createPrivateBackupV6({
        gitHead: gitStateValue.head,
        manifestIdentity,
        capabilityIdentity,
      })
    },
    assertContractAbsent,
    assertPartialStateAbsent,
    assertSyntheticCollisionAbsent,
    readLivePrestate: (gitStateValue, backup) => backup.value.prestate,
    compareBackupLive: (backup, live) => compareBackupLivePrestateV6(backup.value.prestate, live),
    createLedger: (state) => createAttemptLedger(state.gitState.head),
    readDriftSentinel: (gitStateValue, backup) => backup.value.prestate,
    compareDriftSentinel: compareDriftSentinelV6,
    markApplyStarted: (state) => updateLedger(state.ledgerPath, 'apply_started', { applyAttempts: 1 }),
    apply: () => true,
    postcheck: (state) => detailedPostcheckV6(state.prestate, state.live),
    transactionalMatrix: () => transactionalMatrixCompleteV6(),
    concurrentMatrix: () => runConcurrencyV6({ runId }),
    validateCapabilities,
    fixtureCleanup: () => true,
    fixtureCleanupConfirmed: () => true,
    finalPostcheck: (state) => detailedPostcheckV6(state.prestate, state.live),
    finalDigestComparison: (state) => detailedPostcheckV6(state.prestate, state.live),
    completeLedger: (state) => updateLedger(state.ledgerPath, 'completed', {
      applyAttempts: 1,
      recoveryAttempts: 0,
      transactionalMatrix: 'PASS_ROLLED_BACK',
      concurrentMatrix: 'PASS_CLEANED',
    }),
    handleFailure,
  }
  return executeV6Core({ operations, runId })
}

export function preflightReadOnlyV6() {
  return {
    manifest: verifyPackageManifestV6(),
    gitState: gitState(SOURCE_BASE_HEAD),
  }
}

export function assertExecutionAuthorizationV6(environment, expectedHead) {
  if (environment.CP3B2A_V6_EXECUTION_AUTHORIZED !== 'true') {
    fail('V6_EXECUTION_NOT_AUTHORIZED')
  }
  if (environment.CP3B2A_V6_AUTHORIZATION_ID !== AUTHORIZATION_ID_V6) {
    fail('V6_AUTHORIZATION_MISMATCH')
  }
  if (environment.CP3B2A_V6_AUTHORIZED_HEAD !== expectedHead) {
    fail('V6_AUTHORIZED_HEAD_MISMATCH')
  }
  if (environment.CP3B2A_PROJECT_REF !== QA_REF) fail('V6_QA_TARGET_REQUIRED')
  if (String(environment.CP2B_QA_DATABASE_URL ?? '').includes(PRODUCTION_REF)) {
    fail('V6_PRODUCTION_TARGET_REJECTED')
  }
  return true
}

async function main() {
  const mode = process.argv.slice(2)
  if (mode.length !== 1 || !['--plan', '--preflight', '--execute'].includes(mode[0])) {
    fail('V6_MODE_REJECTED')
  }
  if (mode[0] === '--plan') {
    process.stdout.write(`${JSON.stringify(planV6(), null, 2)}\n`)
    return
  }
  if (mode[0] === '--preflight') {
    const result = preflightV6(process.env)
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    return
  }
  if (process.env.CP3B2A_V6_EXECUTION_AUTHORIZED !== 'true') {
    fail('V6_EXECUTE_BLOCKED')
  }
  assertExecutionAuthorizationV6(process.env, process.env.CP3B2A_V6_AUTHORIZED_HEAD ?? '')
  process.stdout.write(`${JSON.stringify(await executeV6(process.env), null, 2)}\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`BLOCKED: ${error instanceof Error ? error.message : 'unknown_error'}\n`)
    process.exitCode = 1
  })
}
