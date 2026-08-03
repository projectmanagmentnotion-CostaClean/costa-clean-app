import {
  constants,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
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
import {
  privateFixtureInventoryV5,
  runConcurrencyV5,
} from './cp3b2a_qa_concurrency_v5.mjs'

export const AUTHORIZATION_ID_V5 = 'CP3B2A-QA-V5-AUTHORIZATION-PENDING'
export const PACKAGE_STATUS_V5 = 'PREPARED_NOT_AUTHORIZED'
export const GATE_V5 = 'CP-3B.2A.5'
export const MAXIMUM_APPLY_ATTEMPTS_V5 = 1
export const MAXIMUM_RECOVERY_ATTEMPTS_V5 = 1
export const AUTOMATIC_RETRIES_V5 = 0

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const privateRoot = path.join(repoRoot, '.git', 'cp3b2a-private')
const manifestPath = path.join(scriptDir, 'cp3b2a_qa_package_v5.manifest.json')
const matrixPath = path.join(scriptDir, 'cp3b2a_qa_matrix_v5.sql')
const capabilityMapPath = path.join(scriptDir, 'cp3b2a_qa_capability_map_v5.json')
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
const expectedV5Artifacts = Object.freeze([
  'scripts/client-portal/cp3b2a_qa_matrix_v5.sql',
  'scripts/client-portal/cp3b2a_qa_concurrency_v5.mjs',
  'scripts/client-portal/run-cp3b2a-qa-v5.mjs',
  'scripts/client-portal/run-cp3b2a5-local-proof.mjs',
  'scripts/client-portal/cp3b2aQaApplicationV5.test.mjs',
  'scripts/client-portal/cp3b2a_qa_capability_map_v5.json',
  'docs/client-portal/CP3B2A5_FINAL_EXECUTABLE_PATH_CLOSURE.md',
  'docs/client-portal/CP3B2A_EXACT_QA_AUTHORIZATION_V5.md',
])
const frozenManifestPaths = Object.freeze({
  v1: path.join(scriptDir, 'cp3b2a_reviewed_change.manifest.json'),
  v2: path.join(scriptDir, 'cp3b2a_qa_package_v2.manifest.json'),
  v3: path.join(scriptDir, 'cp3b2a_qa_package_v3.manifest.json'),
  v4: path.join(scriptDir, 'cp3b2a_qa_package_v4.manifest.json'),
})
const allowedModes = new Set(['--plan', '--preflight', '--execute'])
const recoveryComparisonKeys = Object.freeze([
  'liveRead',
  'cp2bPrerequisite',
  'cp3b0Prerequisite',
  'portalTables',
  'targetFunctionCount',
  'targetColumnCount',
  'targetConstraintCount',
  'targetIndexCount',
  'broadCustomerPolicyCount',
  'legacyServiceGrantCount',
  'syntheticCollisions',
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
  'auditRows',
  'auditDigest',
  'rateRows',
  'rateDigest',
])
export const EXECUTABLE_ORDER_V5 = Object.freeze([
  'manifest_and_frozen_hashes',
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
  'postcheck',
  'transactional_matrix_complete',
  'fixture_transaction_started',
  'fixture_commit_requested',
  'fixture_commit_confirmed_by_observer',
  'concurrent_matrix',
  'fixture_cleanup',
  'fixture_cleanup_confirmed',
  'final_postcheck',
  'final_digest_comparison',
  'ledger_completed',
])

function fail(code, detail = {}) {
  throw new DiagnosticError(code, detail)
}

export function assertModeV5(argv) {
  if (argv.length !== 1 || !allowedModes.has(argv[0])) fail('V5_MODE_REJECTED')
  return argv[0]
}

export function parseEnvelopeV5(output, expectedKind) {
  const prefix = 'CP3B2A_V5_JSON:'
  const candidates = String(output)
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.startsWith(prefix))
  if (candidates.length !== 1) fail('V5_ENVELOPE_CARDINALITY_REJECTED')
  let envelope
  try {
    envelope = JSON.parse(candidates[0].slice(prefix.length))
  } catch {
    fail('V5_ENVELOPE_PARSE_REJECTED')
  }
  if (envelope.version !== 5 || envelope.kind !== expectedKind) {
    fail('V5_ENVELOPE_KIND_REJECTED')
  }
  return envelope
}

export const REQUIRED_CAPABILITY_IDS_V5 = Object.freeze([
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

export function requiredCapabilityGapsV5(capabilityMap, evidenceByStage) {
  const capabilities = Array.isArray(capabilityMap?.capabilities)
    ? capabilityMap.capabilities
    : []
  const gaps = []
  if (capabilities.length === 0) gaps.push('capability_map_empty')
  const assertionIds = capabilities.map((entry) => entry?.[2]).filter(Boolean)
  if (new Set(assertionIds).size !== assertionIds.length) {
    gaps.push('capability_assertion_id_duplicate')
  }
  const mappedIds = new Set(assertionIds)
  for (const requiredId of REQUIRED_CAPABILITY_IDS_V5) {
    if (!mappedIds.has(requiredId)) gaps.push(`required:${requiredId}`)
  }
  for (const entry of capabilities) {
    const [requirement, stage, assertionId, artifact] = entry
    if (
      !requirement
      || !stage
      || !assertionId
      || !artifact
      || capabilityMap.executedBy !== 'executeV5Core'
      || !evidenceByStage?.[stage]?.has(assertionId)
    ) gaps.push(requirement || assertionId || 'invalid_capability')
  }
  return gaps
}

export function validateCapabilityEvidenceV5(capabilityMap, transactional, concurrent) {
  const evidenceByStage = {
    transactional_matrix_complete: new Set(transactional?.assertionIds ?? []),
    concurrent_matrix: new Set(concurrent?.assertionIds ?? []),
  }
  const gaps = requiredCapabilityGapsV5(capabilityMap, evidenceByStage)
  if (gaps.length > 0) fail('V5_CAPABILITY_EVIDENCE_REJECTED', { gaps })
  return true
}

export function assertExactProtectedPrestateV5(
  expected,
  actual,
  code = 'V5_PROTECTED_PRESTATE_MISMATCH',
  stage = 'protected_prestate_comparison',
) {
  for (const key of recoveryComparisonKeys) {
    if (actual[key] !== expected[key]) {
      fail(code, { stage, key, remoteWrites: 0 })
    }
  }
  return true
}

export function assertRecoveredPrestateV5(expected, actual) {
  validatePrestateV2(actual)
  return assertExactProtectedPrestateV5(
    expected,
    actual,
    'V5_RECOVERY_PRESTATE_DRIFT',
    'recovery_prestate_comparison',
  )
}

export function verifyPackageManifestV5() {
  verifyPackageManifestV3()
  if (!existsSync(manifestPath)) fail('V5_MANIFEST_MISSING')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (
    manifest.version !== 5
    || manifest.gate !== GATE_V5
    || manifest.status !== PACKAGE_STATUS_V5
    || manifest.authorizationId !== AUTHORIZATION_ID_V5
    || manifest.qaProjectRef !== QA_REF
    || manifest.prohibitedProductionRef !== PRODUCTION_REF
    || manifest.sourceBaseHead !== 'de8f761ac9914321a97603009ce7242e500568bc'
    || manifest.migrationSha256 !== MIGRATION_SHA256
    || manifest.v1ManifestSha256 !== sha256(frozenManifestPaths.v1)
    || manifest.v2ManifestSha256 !== sha256(frozenManifestPaths.v2)
    || manifest.v3ManifestSha256 !== sha256(frozenManifestPaths.v3)
    || manifest.v4ManifestSha256 !== sha256(frozenManifestPaths.v4)
    || manifest.executeAlias !== false
    || manifest.maximumApplyAttempts !== MAXIMUM_APPLY_ATTEMPTS_V5
    || manifest.maximumRecoveryAttempts !== MAXIMUM_RECOVERY_ATTEMPTS_V5
    || manifest.automaticRetries !== AUTOMATIC_RETRIES_V5
    || manifest.transactionalMatrix !== 'PASS_ROLLED_BACK'
    || manifest.concurrentMatrix !== 'PASS_CLEANED'
    || !Array.isArray(manifest.artifacts)
    || JSON.stringify(manifest.artifacts.map((item) => item.path))
      !== JSON.stringify(expectedV5Artifacts)
  ) fail('V5_MANIFEST_CONTRACT_REJECTED')
  for (const artifact of manifest.artifacts) {
    const artifactPath = path.join(repoRoot, artifact.path)
    if (!existsSync(artifactPath) || sha256(artifactPath) !== artifact.sha256) {
      fail('V5_ARTIFACT_HASH_MISMATCH', { artifact: artifact.path })
    }
  }
  if (sha256(migrationPath) !== MIGRATION_SHA256) fail('V5_MIGRATION_HASH_MISMATCH')
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
    fail('V5_QA_DATABASE_TARGET_REJECTED')
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
  ) fail('V5_QA_DATABASE_TARGET_REJECTED')
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
    fail('V5_POSTGRES_SQL_ERROR', {
      stage,
      exitCode: result.status ?? null,
      timedOut: result.error?.code === 'ETIMEDOUT',
      artifact: path.relative(repoRoot, filePath).replaceAll('\\', '/'),
    })
  }
  return String(result.stdout ?? '').trim()
}

function runPsqlSql(environment, sql, stage) {
  const result = spawnSync(psqlExecutable(), [
    '-X', '-Atq', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose',
  ], {
    cwd: repoRoot,
    env: databaseEnvironment(environment),
    input: sql,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180_000,
    maxBuffer: 8 * 1024 * 1024,
  })
  if (result.error || result.status !== 0) {
    fail('V5_POSTGRES_SQL_ERROR', {
      stage,
      exitCode: result.status ?? null,
      timedOut: result.error?.code === 'ETIMEDOUT',
      artifact: 'inline_read_only_sql',
    })
  }
  return String(result.stdout ?? '').trim()
}

function captureOperationalStateV5(environment, stage) {
  return parseSingleJsonV3(runPsqlSql(environment, String.raw`
    select jsonb_build_object(
      'auditRows', (select count(*) from public.client_portal_audit_events),
      'auditDigest', (select md5(coalesce(string_agg(to_jsonb(r)::text, '|' order by r.id), ''))
        from public.client_portal_audit_events r),
      'rateRows', (select count(*) from public.client_portal_rate_limits),
      'rateDigest', (select md5(coalesce(string_agg(
        to_jsonb(r)::text,
        '|' order by r.action, r.subject_hash, r.window_started_at
      ), '')) from public.client_portal_rate_limits r)
    )::text;
  `, stage))
}

function captureBoundaryDigestV5(environment, stage) {
  const digest = runPsqlSql(environment, String.raw`
    with target_policies as (
      select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      from pg_policies
      where schemaname='public' and policyname in (
        'Portal reads same-client profile requests',
        'Portal reads same-client property requests',
        'Internal staff manage profile requests',
        'Internal staff manage property requests'
      )
    ), target_grants as (
      select p.oid::regprocedure::text as signature,
        grantee.rolname as grantee, grantor.rolname as grantor,
        acl.privilege_type, acl.is_grantable
      from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace and n.nspname='public'
      join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
        on true
      join pg_roles grantor on grantor.oid=acl.grantor
      left join pg_roles grantee on grantee.oid=acl.grantee
      where p.oid in (
        'public.portal_submit_profile_change_trusted(uuid,text,jsonb,text,uuid)'::regprocedure,
        'public.portal_submit_property_change_trusted(uuid,text,text,jsonb,text,uuid)'::regprocedure
      ) and acl.privilege_type='EXECUTE'
    )
    select md5(
      coalesce((select string_agg(to_jsonb(p)::text, '|' order by tablename, policyname)
        from target_policies p), '')
      || '#'
      || coalesce((select string_agg(to_jsonb(g)::text, '|' order by signature, grantee)
        from target_grants g), '')
    );
  `, stage).trim()
  if (!/^[a-f0-9]{32}$/u.test(digest)) fail('V5_BOUNDARY_DIGEST_REJECTED')
  return digest
}

function captureRlsForceDigestV5(environment, stage) {
  const digest = runPsqlSql(environment, String.raw`
    select md5(coalesce(string_agg(
      n.nspname || '.' || c.relname || ':'
        || c.relrowsecurity::text || ':' || c.relforcerowsecurity::text,
      '|' order by n.nspname,c.relname
    ), ''))
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relname in (
        'client_portal_profile_change_requests',
        'client_portal_property_change_requests'
      )
      and c.relkind in ('r','p');
  `, stage).trim()
  if (!/^[a-f0-9]{32}$/u.test(digest)) fail('V5_RLS_FORCE_DIGEST_REJECTED')
  return digest
}

function v2RunId(runId) {
  return `CP3B2A-V2-${runId.slice(-12)}`
}

function captureLivePrestateV5(environment, runId, stage) {
  const prestate = parseSingleJsonV3(runPsql(environment, {
    filePath: precheckPath,
    variables: { project_ref: QA_REF, v2_run_id: v2RunId(runId) },
    stage,
  }))
  Object.assign(prestate, captureOperationalStateV5(environment, `${stage}_operational`))
  validatePrestateV2(prestate)
  return {
    prestate,
    boundaryDigest: captureBoundaryDigestV5(environment, `${stage}_boundary`),
    rlsForceDigest: captureRlsForceDigestV5(
      environment,
      `${stage}_rls_force`,
    ),
  }
}

export function backupPrestateV5(backupManifest) {
  const artifact = backupManifest.artifacts.find(
    (entry) => path.basename(entry.path) === 'catalog-prestate.json',
  )
  if (!artifact) fail('V5_PRIVATE_BACKUP_PRESTATE_MISSING')
  return JSON.parse(readFileSync(artifact.path, 'utf8'))
}

export function compareBackupLivePrestateV5(backupManifest, live) {
  const saved = backupPrestateV5(backupManifest)
  assertExactProtectedPrestateV5(
    saved,
    live.prestate,
    'V5_BACKUP_LIVE_PRESTATE_MISMATCH',
    'backup_live_exact_comparison',
  )
  if (backupManifest.boundaryDigest !== live.boundaryDigest) {
    fail('V5_BACKUP_LIVE_BOUNDARY_MISMATCH', {
      stage: 'backup_live_exact_comparison',
      remoteWrites: 0,
    })
  }
  if (backupManifest.rlsForceDigest !== live.rlsForceDigest) {
    fail('V5_BACKUP_LIVE_RLS_FORCE_MISMATCH', {
      stage: 'backup_live_exact_comparison',
      remoteWrites: 0,
    })
  }
  return true
}

export function compareDriftSentinelV5(expected, actual) {
  assertExactProtectedPrestateV5(
    expected.prestate,
    actual.prestate,
    'V5_LIVE_DRIFT_SENTINEL_MISMATCH',
    'live_drift_sentinel_recheck',
  )
  if (expected.boundaryDigest !== actual.boundaryDigest) {
    fail('V5_LIVE_DRIFT_SENTINEL_MISMATCH', {
      stage: 'live_drift_sentinel_recheck',
      key: 'boundaryDigest',
      remoteWrites: 0,
    })
  }
  if (expected.rlsForceDigest !== actual.rlsForceDigest) {
    fail('V5_LIVE_DRIFT_SENTINEL_MISMATCH', {
      stage: 'live_drift_sentinel_recheck',
      key: 'rlsForceDigest',
      remoteWrites: 0,
    })
  }
  return true
}

export function assertRecoveredLivePrestateV5(expected, actual) {
  assertRecoveredPrestateV5(expected.prestate, actual.prestate)
  compareDriftSentinelV5(expected, actual)
  return true
}

function listPrivateBackupManifestsV5() {
  if (!existsSync(privateRoot)) return []
  return readdirSync(privateRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('backup-'))
    .map((entry) => path.join(
      privateRoot,
      entry.name,
      'private-backup-v3-manifest.json',
    ))
    .filter(existsSync)
}

export function resolveFreshPrivateBackupV5(previousPaths, expectedHead) {
  const candidates = listPrivateBackupManifestsV5()
    .filter((manifest) => !previousPaths.has(path.resolve(manifest)))
    .map((manifest) => ({
      path: manifest,
      value: verifyPrivateBackupV3(manifest, expectedHead),
    }))
    .filter(({ value }) => (
      value.version === 3
      && value.status === 'COMPLETE'
      && value.projectRef === QA_REF
      && value.gitHead === expectedHead
    ))
  if (candidates.length !== 1) fail('V5_FRESH_PRIVATE_BACKUP_REJECTED')
  return candidates[0]
}

export function verifyPrivateBackupV5(manifestPath, expectedHead) {
  const resolved = path.resolve(manifestPath ?? '')
  if (
    !resolved.startsWith(`${path.resolve(privateRoot)}${path.sep}`)
    || !existsSync(resolved)
  ) fail('V5_PRIVATE_BACKUP_PATH_REJECTED')
  const manifest = JSON.parse(readFileSync(resolved, 'utf8'))
  if (
    manifest.version !== 5
    || manifest.status !== 'COMPLETE'
    || manifest.projectRef !== QA_REF
    || manifest.gitHead !== expectedHead
    || manifest.migrationSha256 !== MIGRATION_SHA256
    || !/^[a-f0-9]{32}$/u.test(manifest.boundaryDigest ?? '')
    || !/^[a-f0-9]{32}$/u.test(manifest.rlsForceDigest ?? '')
  ) fail('V5_PRIVATE_BACKUP_REJECTED')
  const sourcePath = path.resolve(manifest.sourceManifest?.path ?? '')
  if (
    !sourcePath.startsWith(`${path.resolve(privateRoot)}${path.sep}`)
    || !existsSync(sourcePath)
    || sha256(sourcePath) !== manifest.sourceManifest?.sha256
  ) fail('V5_PRIVATE_BACKUP_SOURCE_REJECTED')
  const source = verifyPrivateBackupV3(sourcePath, expectedHead)
  if (
    manifest.boundaryDigest !== source.boundaryDigest
    || JSON.stringify(manifest.artifacts) !== JSON.stringify(source.artifacts)
  ) fail('V5_PRIVATE_BACKUP_SOURCE_CONTRACT_REJECTED')
  return manifest
}

export function createPrivateBackupV5(source, live, expectedHead) {
  const manifestPath = path.join(
    path.dirname(source.path),
    'private-backup-v5-manifest.json',
  )
  if (existsSync(manifestPath)) fail('V5_PRIVATE_BACKUP_ALREADY_EXISTS')
  const manifest = {
    version: 5,
    status: 'COMPLETE',
    projectRef: QA_REF,
    gitHead: expectedHead,
    migrationSha256: MIGRATION_SHA256,
    createdAt: new Date().toISOString(),
    boundaryDigest: source.value.boundaryDigest,
    rlsForceDigest: live.rlsForceDigest,
    artifacts: source.value.artifacts,
    sourceManifest: {
      path: source.path,
      sha256: sha256(source.path),
    },
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  })
  return {
    path: manifestPath,
    value: verifyPrivateBackupV5(manifestPath, expectedHead),
  }
}

export function createStageTrackerV5(onStage = () => {}) {
  let index = 0
  return {
    advance(stage) {
      if (EXECUTABLE_ORDER_V5[index] !== stage) {
        fail('V5_EXECUTABLE_ORDER_REJECTED', {
          expected: EXECUTABLE_ORDER_V5[index],
          actual: stage,
        })
      }
      index += 1
      onStage(stage)
    },
    complete() {
      if (index !== EXECUTABLE_ORDER_V5.length) {
        fail('V5_EXECUTABLE_ORDER_INCOMPLETE', {
          expected: EXECUTABLE_ORDER_V5.length,
          actual: index,
        })
      }
      return true
    },
    stages() {
      return EXECUTABLE_ORDER_V5.slice(0, index)
    },
  }
}

function makeRunId() {
  return `CP3B2A-V5-${randomBytes(6).toString('hex').toUpperCase()}`
}

function gitStateV5(expectedHead = null) {
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
  ) fail('V5_GIT_STATE_REJECTED')
  return state
}

function assertLocalQaLinkV5() {
  const linkPath = path.join(repoRoot, 'supabase', '.temp', 'project-ref')
  if (
    !existsSync(linkPath)
    || readFileSync(linkPath, 'utf8').trim() !== QA_REF
  ) fail('V5_LOCAL_QA_LINK_REJECTED')
  return true
}

export function assertAuthorizationV5(environment, gitState) {
  const legacyValues = [
    environment.CP3B2A_V1_EXECUTION_AUTHORIZED,
    environment.CP3B2A_EXECUTION_AUTHORIZED,
    environment.CP3B2A_V2_EXECUTION_AUTHORIZED,
    environment.CP3B2A_V3_EXECUTION_AUTHORIZED,
    environment.CP3B2A_V4_EXECUTION_AUTHORIZED,
    environment.CP3B2A_V1_AUTHORIZATION_ID,
    environment.CP3B2A_AUTHORIZATION_ID,
    environment.CP3B2A_V2_AUTHORIZATION_ID,
    environment.CP3B2A_V3_AUTHORIZATION_ID,
    environment.CP3B2A_V4_AUTHORIZATION_ID,
  ].filter(Boolean)
  if (
    legacyValues.length > 0
    || environment.CP3B2A_V5_EXECUTION_AUTHORIZED !== 'true'
    || environment.CP3B2A_PROJECT_REF !== QA_REF
    || environment.CP3B2A_V5_AUTHORIZATION_ID !== AUTHORIZATION_ID_V5
    || environment.CP3B2A_V5_AUTHORIZED_HEAD !== gitState.head
    || gitState.head !== gitState.remoteHead
    || typeof environment.CP3B2A_PRIVATE_BACKUP_MANIFEST !== 'string'
    || environment.CP3B2A_PRIVATE_BACKUP_MANIFEST.trim() === ''
  ) fail('V5_EXECUTION_AUTHORIZATION_REJECTED')
  return true
}

function createAttemptLedger(gitHead, manifestSha256, backupPath) {
  mkdirSync(privateRoot, { recursive: true })
  const ledgerPath = path.join(privateRoot, `v5-attempt-${gitHead}.json`)
  let handle
  try {
    handle = openSync(
      ledgerPath,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
      0o600,
    )
    writeFileSync(handle, `${JSON.stringify({
      version: 5,
      state: 'reserved',
      gitHead,
      projectRef: QA_REF,
      authorizationId: AUTHORIZATION_ID_V5,
      manifestSha256,
      backupPath: path.resolve(backupPath),
      applyAttempts: 0,
      recoveryAttempts: 0,
      automaticRetries: 0,
      createdAt: new Date().toISOString(),
    }, null, 2)}\n`)
  } catch {
    fail('V5_SECOND_ATTEMPT_REJECTED')
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

export function planV5() {
  verifyPackageManifestV5()
  return {
    gate: GATE_V5,
    mode: 'plan',
    status: PACKAGE_STATUS_V5,
    qaApplication: 'READY_PENDING_EXPLICIT_V5_AUTHORIZATION',
    authorizationId: AUTHORIZATION_ID_V5,
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

export function preflightV5(environment, dependencies = {}) {
  verifyPackageManifestV5()
  const previousBackups = new Set(
    (dependencies.listPrivateBackupManifests ?? listPrivateBackupManifestsV5)()
      .map((manifest) => path.resolve(manifest)),
  )
  const preflight = (dependencies.preflightV3 ?? (async () => {
    const module = await import('./run-cp3b2a-qa-v3.mjs')
    return module.preflightV3(environment, dependencies)
  }))()
  return Promise.resolve(preflight).then((result) => {
    const ledgerPath = path.join(privateRoot, `v5-attempt-${result.gitHead}.json`)
    if (existsSync(ledgerPath)) fail('V5_ATTEMPT_LEDGER_ALREADY_EXISTS')
    const freshV3 = (
      dependencies.resolveFreshBackup ?? resolveFreshPrivateBackupV5
    )(previousBackups, result.gitHead)
    const runId = makeRunId()
    const capture = dependencies.captureLivePrestate
      ?? ((stage) => captureLivePrestateV5(environment, runId, stage))
    const live = capture('v5_preflight_live')
    const freshV5 = (
      dependencies.createPrivateBackup ?? createPrivateBackupV5
    )(freshV3, live, result.gitHead)
    ;(dependencies.compareBackupLive ?? compareBackupLivePrestateV5)(
      freshV5.value,
      live,
    )
    const sentinel = capture('v5_preflight_drift_sentinel')
    ;(dependencies.compareDriftSentinel ?? compareDriftSentinelV5)(live, sentinel)
    return ({
    gate: GATE_V5,
    mode: 'preflight',
    status: 'READY_FOR_CP3B2A_QA_V5',
    target: result.target,
    gitHead: result.gitHead,
    originalHashes: result.originalHashes,
    v2Hashes: result.v2Hashes,
    v3Hashes: result.v3Hashes,
    v4Hashes: 'PASS',
    v5Hashes: 'PASS',
    prestate: result.prestate,
    privateBackup: result.privateBackup,
    privateBackupHead: freshV5.value.gitHead,
    backupLiveExactComparison: 'PASS',
    driftSentinel: 'PASS',
    authorization: 'NOT_GRANTED',
    remoteWrites: 0,
    })
  })
}

export async function executeV5Core({ operations, runId, onStage = () => {} }) {
  const tracker = createStageTrackerV5(onStage)
  const state = {
    runId,
    ledgerPath: null,
    prestate: null,
    live: null,
    applyStarted: false,
    applyCommitted: false,
    recoveryAttempts: 0,
    transactional: null,
    concurrent: null,
  }
  try {
    tracker.advance('manifest_and_frozen_hashes')
    state.manifest = await operations.verifyManifest()
    tracker.advance('authorization_and_exact_head')
    state.identity = await operations.authorize(state.manifest)
    tracker.advance('clean_main_worktree')
    await operations.assertClean(state.identity)
    tracker.advance('qa_target_and_tls')
    await operations.assertQaTarget()
    tracker.advance('production_rejected')
    await operations.assertProductionRejected()
    tracker.advance('private_backup_integrity')
    state.backup = await operations.verifyBackup(state.identity)
    tracker.advance('contract_absent')
    state.guard = await operations.readGuardState()
    await operations.assertContractAbsent(state.guard)
    tracker.advance('partial_state_absent')
    await operations.assertPartialStateAbsent(state.guard)
    tracker.advance('synthetic_collision_absent')
    await operations.assertSyntheticCollisionAbsent(state.guard)
    tracker.advance('live_prestate_read')
    state.live = await operations.readLivePrestate()
    state.prestate = state.live.prestate
    tracker.advance('backup_live_exact_comparison')
    await operations.compareBackupLive(state.backup, state.live)
    tracker.advance('attempt_ledger_create')
    state.ledgerPath = await operations.createLedger(state)
    tracker.advance('live_drift_sentinel_recheck')
    const sentinel = await operations.readDriftSentinel()
    await operations.compareDriftSentinel(state.live, sentinel)
    tracker.advance('apply_started')
    await operations.markApplyStarted(state)
    state.applyStarted = true
    await operations.apply(state)
    state.applyCommitted = true
    tracker.advance('apply_committed')
    tracker.advance('postcheck')
    await operations.postcheck(state)
    tracker.advance('transactional_matrix_complete')
    state.transactional = await operations.transactionalMatrix(state)
    state.concurrent = await operations.concurrentMatrix(state, (stage) => tracker.advance(stage))
    await operations.validateCapabilities(state.transactional, state.concurrent)
    tracker.advance('final_postcheck')
    await operations.finalPostcheck(state)
    tracker.advance('final_digest_comparison')
    await operations.finalDigestComparison(state)
    tracker.advance('ledger_completed')
    await operations.completeLedger(state)
    tracker.complete()
    return {
      verdict: 'PASS',
      target: 'QA_MATCH',
      applyAttempts: 1,
      recoveryAttempts: 0,
      automaticRetries: 0,
      transactionalMatrix: 'PASS_ROLLED_BACK',
      concurrentMatrix: 'PASS_CLEANED',
      stages: tracker.stages(),
    }
  } catch (error) {
    return operations.handleFailure(error, state, tracker.stages())
  }
}

export function normalizeExecutionFailureV5(error) {
  if (!(error instanceof DiagnosticError)) {
    return new DiagnosticError(
      typeof error?.code === 'string' && error.code.startsWith('V5_')
        ? error.code
        : 'V5_UNCLASSIFIED_FAILURE',
      {
        ...(error?.detail ?? {}),
        expected: 'V5_EXECUTABLE_CONTRACT',
        actual: typeof error?.code === 'string'
          ? error.code
          : error instanceof Error ? error.message : 'unknown_failure',
      },
    )
  }
  return error
}

function handleExecutionFailureV5(error, state, stages, environment) {
  error = normalizeExecutionFailureV5(error)
  if (!state.ledgerPath) throw error
  const envelope = buildFailureEnvelopeV3({
    error,
    stage: stages.at(-1) ?? 'pre_effect',
    runId: state.runId,
    stages,
    runtime: {
      applyStarted: state.applyStarted,
      applyCommitted: state.applyCommitted,
      postcheckStarted: stages.includes('postcheck'),
      matrixStarted: stages.includes('transactional_matrix_complete'),
      ledgerCompleted: false,
    },
    sensitiveValues: [
      environment.CP2B_QA_DATABASE_URL,
      environment.SUPABASE_ACCESS_TOKEN,
    ].filter(Boolean),
  })
  const failurePath = persistPrivateFailureEnvelopeV3(envelope)
  verifyPrivateFailureEnvelopeV3(failurePath, state.runId)
  if (!state.applyStarted) {
    updateLedger(state.ledgerPath, 'blocked_before_remote_effects', {
      applyAttempts: 0,
      recoveryAttempts: 0,
    })
    updatePrivateFailureEnvelopeV3(failurePath, {
      recoveryStarted: false,
      recoveryOutcome: 'not_required',
    })
    fail('V5_BLOCKED_BEFORE_REMOTE_EFFECTS', {
      publicFailure: publicFailureSummaryV3(
        JSON.parse(readFileSync(failurePath, 'utf8')),
      ),
    })
  }
  if (error?.detail?.recovery === 'MANUAL_VERIFICATION_REQUIRED') {
    updateLedger(state.ledgerPath, 'manual_verification_required', {
      recoveryAttempts: 0,
      fixtureState: error.detail?.commitState ?? 'UNVERIFIABLE',
    })
    updatePrivateFailureEnvelopeV3(failurePath, {
      recoveryStarted: false,
      recoveryOutcome: 'failed',
    })
    fail('V5_MANUAL_VERIFICATION_REQUIRED', {
      publicFailure: publicFailureSummaryV3(
        JSON.parse(readFileSync(failurePath, 'utf8')),
      ),
    })
  }
  state.recoveryAttempts = 1
  updateLedger(state.ledgerPath, 'recovery_started', { recoveryAttempts: 1 })
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
    ) fail('V5_RECOVERY_REJECTED')
    const restored = captureLivePrestateV5(
      environment,
      state.runId,
      'recovery_precheck',
    )
    assertRecoveredLivePrestateV5(state.live, restored)
    updateLedger(state.ledgerPath, 'blocked_recovered', { recoveryAttempts: 1 })
    updatePrivateFailureEnvelopeV3(failurePath, {
      recoveryStarted: true,
      recoveryOutcome: 'restored',
    })
  } catch (recoveryError) {
    updateLedger(state.ledgerPath, 'manual_verification_required', {
      recoveryAttempts: 1,
    })
    updatePrivateFailureEnvelopeV3(failurePath, {
      recoveryStarted: true,
      recoveryOutcome: 'failed',
      recoveryFailure: sanitizeFailureV3(recoveryError, 'recovery'),
    })
  }
  fail('V5_EXECUTION_FAILED', {
    publicFailure: publicFailureSummaryV3(
      JSON.parse(readFileSync(failurePath, 'utf8')),
    ),
  })
}

export async function executeV5(environment) {
  const runId = makeRunId()
  let gitState
  const capabilityMap = JSON.parse(readFileSync(capabilityMapPath, 'utf8'))
  const operations = {
    verifyManifest: () => verifyPackageManifestV5(),
    authorize: (manifest) => {
      gitState = gitStateV5(environment.CP3B2A_V5_AUTHORIZED_HEAD)
      assertAuthorizationV5(environment, gitState)
      return { manifest, gitState }
    },
    assertClean: () => gitStateV5(environment.CP3B2A_V5_AUTHORIZED_HEAD),
    assertQaTarget: () => {
      assertLocalQaLinkV5()
      return databaseEnvironment(environment)
    },
    assertProductionRejected: () => {
      if (
        environment.CP3B2A_PROJECT_REF !== QA_REF
        || environment.CP2B_QA_DATABASE_URL.includes(PRODUCTION_REF)
      ) fail('V5_PRODUCTION_TARGET_REJECTED')
      return true
    },
    verifyBackup: () => verifyPrivateBackupV5(
      environment.CP3B2A_PRIVATE_BACKUP_MANIFEST,
      gitState.head,
    ),
    readGuardState: () => parseSingleJsonV3(runPsql(environment, {
      filePath: precheckPath,
      variables: { project_ref: QA_REF, v2_run_id: v2RunId(runId) },
      stage: 'guard_prestate',
    })),
    assertContractAbsent: (guard) => validatePrestateV2(guard),
    assertPartialStateAbsent: (guard) => {
      if (
        guard.targetFunctionCount !== 0
        || guard.targetColumnCount !== 0
        || guard.targetConstraintCount !== 0
        || guard.targetIndexCount !== 0
      ) fail('V5_PARTIAL_STATE_REJECTED')
      return true
    },
    assertSyntheticCollisionAbsent: (guard) => {
      if (guard.syntheticCollisions !== 0) fail('V5_SYNTHETIC_COLLISION_REJECTED')
      return true
    },
    readLivePrestate: () => captureLivePrestateV5(environment, runId, 'live_prestate'),
    compareBackupLive: compareBackupLivePrestateV5,
    createLedger: (state) => createAttemptLedger(
      gitState.head,
      sha256(manifestPath),
      environment.CP3B2A_PRIVATE_BACKUP_MANIFEST,
      state,
    ),
    readDriftSentinel: () => captureLivePrestateV5(
      environment,
      runId,
      'live_drift_sentinel',
    ),
    compareDriftSentinel: compareDriftSentinelV5,
    markApplyStarted: (state) => updateLedger(
      state.ledgerPath,
      'apply_started',
      { applyAttempts: 1 },
    ),
    apply: () => runPsql(environment, {
      filePath: migrationPath,
      stage: 'apply',
      capture: false,
    }),
    postcheck: (state) => {
      validatePoststateV2(state.prestate, parseSingleJsonV3(runPsql(environment, {
        filePath: postcheckStatePath,
        stage: 'postcheck_state',
      })))
      validateDetailedPostcheckV3(parseEnvelopeV3(runPsql(environment, {
        filePath: postcheckDetailPath,
        stage: 'postcheck_detail',
      }), 'postcheck'))
    },
    transactionalMatrix: () => {
      const suffix = runId.slice(-12)
      const result = parseEnvelopeV5(runPsql(environment, {
        filePath: matrixPath,
        variables: {
          project_ref: QA_REF,
          v3_run_id: `CP3B2A-V3-${suffix}`,
          v4_run_id: `CP3B2A-V4-${suffix}`,
          v5_run_id: runId,
        },
        stage: 'transactional_matrix_complete',
      }), 'transactional_matrix_complete')
      if (
        result.result !== 'PASS'
        || result.transaction !== 'ROLLED_BACK'
        || result.requestSideEffects !== 0
        || result.auditSideEffects !== 0
        || result.rateLimitSideEffects !== 0
      ) fail('V5_TRANSACTIONAL_MATRIX_REJECTED')
      return result
    },
    concurrentMatrix: (state, onConcurrencyStage) => runConcurrencyV5({
      databaseUrl: environment.CP2B_QA_DATABASE_URL,
      environment,
      runId: state.runId,
      onStage: onConcurrencyStage,
      onInventory: (inventory) => updateLedger(
        state.ledgerPath,
        'fixture_inventory_reserved',
        { fixtureInventory: privateFixtureInventoryV5(inventory) },
      ),
    }),
    validateCapabilities: (transactional, concurrent) => (
      validateCapabilityEvidenceV5(capabilityMap, transactional, concurrent)
    ),
    finalPostcheck: (state) => {
      validatePoststateV2(state.prestate, parseSingleJsonV3(runPsql(environment, {
        filePath: postcheckStatePath,
        stage: 'final_postcheck_state',
      })))
      validateDetailedPostcheckV3(parseEnvelopeV3(runPsql(environment, {
        filePath: postcheckDetailPath,
        stage: 'final_postcheck_detail',
      }), 'postcheck'))
    },
    finalDigestComparison: (state) => {
      const final = parseSingleJsonV3(runPsql(environment, {
        filePath: postcheckStatePath,
        stage: 'final_digest_contract',
      }))
      validatePoststateV2(state.prestate, final)
      return true
    },
    completeLedger: (state) => updateLedger(state.ledgerPath, 'completed', {
      applyAttempts: 1,
      recoveryAttempts: 0,
      transactionalMatrix: 'PASS_ROLLED_BACK',
      concurrentMatrix: 'PASS_CLEANED',
    }),
    handleFailure: (error, state, stages) => handleExecutionFailureV5(
      error,
      state,
      stages,
      environment,
    ),
  }
  return executeV5Core({ operations, runId })
}

async function main() {
  const mode = assertModeV5(process.argv.slice(2))
  if (mode === '--plan') {
    process.stdout.write(`${JSON.stringify(planV5(), null, 2)}\n`)
    return
  }
  if (mode === '--preflight') {
    process.stdout.write(`${JSON.stringify(await preflightV5(process.env), null, 2)}\n`)
    return
  }
  process.stdout.write(`${JSON.stringify(await executeV5(process.env), null, 2)}\n`)
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
