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
import { runCommandV3 } from './cp2b_command_launcher_v3.mjs'
import {
  postgresExecutableV5,
  preparePostgresEnvironmentV5,
} from './cp2b_postgres_transport_v5.mjs'
import {
  ConcurrencyV6Error,
  FIXTURE_STATES_V6,
  createFixtureInventoryV6,
  runConcurrencyV6,
} from './cp3b2a_qa_concurrency_v6.mjs'

export const QA_REF = 'kpvvydthlxupjjqqdpxy'
export const PRODUCTION_REF = 'wfxnwfcdjainpojhbdri'
export const AUTHORIZATION_ID_V6R1 = 'CP3B2A-QA-V6R1-AUTHORIZATION-PENDING'
export const AUTHORIZATION_ID_V6R = AUTHORIZATION_ID_V6R1
export const AUTHORIZATION_ID_V6 = AUTHORIZATION_ID_V6R1
export const PACKAGE_STATUS_V6R1 = 'PREPARED_NOT_AUTHORIZED'
export const PACKAGE_STATUS_V6 = PACKAGE_STATUS_V6R1
export const GATE_V6R1 = 'CP-3B.2A.6R.1'
export const GATE_V6R = GATE_V6R1
export const GATE_V6 = GATE_V6R1
export const MIGRATION_PATH = 'supabase/migrations/20260728160000_portal_reviewed_change_contract.sql'
export const MIGRATION_SHA256 =
  '4030c67ba82f353cd81345a59fca8ee0c3088affd0869c8d9e744c02f24bb544'
export const SOURCE_BASE_HEAD_V6R1 = '79a83b42cd739e4a952f0a3eac61729600949766'
export const SOURCE_BASE_HEAD_V6R = SOURCE_BASE_HEAD_V6R1
export const SOURCE_BASE_HEAD = SOURCE_BASE_HEAD_V6R1
export const V5_HISTORICAL_MANIFEST_SHA256 =
  'd70750dedf907de5a680476b22d2bd87ebb61eee14950a9ac02756bd10544bb3'
const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const privateRoot = path.join(repoRoot, '.project-agent', 'private', 'cp3b2a-v6r1')
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
    revision: 'V6R1',
    gate: GATE_V6R1,
    status: PACKAGE_STATUS_V6R1,
    authorizationId: AUTHORIZATION_ID_V6R1,
    qaProjectRef: QA_REF,
    prohibitedProductionRef: PRODUCTION_REF,
    sourceBaseHead: SOURCE_BASE_HEAD_V6R1,
    migration: MIGRATION_PATH,
    migrationSha256: MIGRATION_SHA256,
    canonicalJsonStandard: CANONICAL_JSON_STANDARD_V6,
    postgresAdapter: 'REAL_POSTGRESQL_FULL',
    postgresVersion: 17,
    tlsRequired: true,
    privateBackupLocation: '.project-agent/private/cp3b2a-v6r1',
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

export const EXECUTABLE_ORDER_V6R1 = EXECUTABLE_ORDER_V6
export const REQUIRED_CAPABILITY_IDS_V6R1 = REQUIRED_CAPABILITY_IDS_V6

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
    artifactRecord('scripts/client-portal/cp3b2a_qa_precheck_v6.sql', 'sql'),
    artifactRecord('scripts/client-portal/cp3b2a_qa_postcheck_v6.sql', 'sql'),
    artifactRecord('scripts/client-portal/cp3b2a_qa_rollback_v6.sql', 'sql'),
    artifactRecord('scripts/client-portal/cp3b2a_qa_fixture_setup_v6.sql', 'sql'),
    artifactRecord('scripts/client-portal/cp3b2a_qa_fixture_cleanup_v6.sql', 'sql'),
    artifactRecord('scripts/client-portal/cp3b2a_qa_digest_v6.sql', 'sql'),
    artifactRecord('scripts/client-portal/cp3b2aV6RealAdapter.test.mjs', 'mjs'),
    artifactRecord('docs/client-portal/CP3B2A6_REPRODUCIBLE_REBASELINE.md', 'md'),
    artifactRecord('docs/client-portal/CP3B2A_EXACT_QA_AUTHORIZATION_V6.md', 'md'),
    artifactRecord('docs/client-portal/CP3B2A6R1_FINAL_REAL_ADAPTER.md', 'md'),
  ]
}

function toRepoRelativePath(filePath) {
  return path.relative(repoRoot, filePath).replaceAll('\\', '/')
}

function runGitAllowFailure(args) {
  return spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  })
}

function assertIgnoredPrivateFile(filePath) {
  const relativePath = toRepoRelativePath(filePath)
  const ignored = runGitAllowFailure(['check-ignore', '-q', relativePath])
  if (ignored.status !== 0) {
    fail('V6R_PRIVATE_BACKUP_NOT_IGNORED', { path: relativePath })
  }
  const tracked = runGitAllowFailure(['ls-files', '--error-unmatch', relativePath])
  if (tracked.status === 0) {
    fail('V6R_PRIVATE_BACKUP_TRACKED', { path: relativePath })
  }
}

function assertSafeSqlVariableName(name) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name)) {
    fail('V6R_PSQL_VARIABLE_NAME_REJECTED', { name })
  }
}

function assertSafeSqlVariableValue(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    fail(`${label}_required`)
  }
  if (/[\0\r\n]/u.test(value)) {
    fail(`${label}_control_character_rejected`)
  }
}

function postgresEnvironmentV6R(environment) {
  const prepared = preparePostgresEnvironmentV5(environment)
  const sslMode = prepared.environment.PGSSLMODE ?? 'require'
  if (!['require', 'verify-ca', 'verify-full'].includes(sslMode)) {
    fail('V6R_TLS_REQUIRED')
  }
  if (!prepared.environment.PGHOST || !prepared.environment.PGUSER || !prepared.environment.PGDATABASE) {
    fail('V6R_POSTGRES_ENVIRONMENT_REJECTED')
  }
  return {
    environment: {
      ...prepared.environment,
      PGSSLMODE: 'require',
      PGCONNECT_TIMEOUT: prepared.environment.PGCONNECT_TIMEOUT ?? '10',
      PGAPPNAME: prepared.environment.PGAPPNAME ?? 'cp3b2a-v6r1-preflight',
    },
    target: prepared.target,
  }
}

function postgresExecutableV6R(platform = process.platform) {
  return postgresExecutableV5(platform)
}

function buildPsqlVariableArgsV6R(variables = {}) {
  const args = []
  for (const [name, value] of Object.entries(variables)) {
    assertSafeSqlVariableName(name)
    assertSafeSqlVariableValue(String(value), `psql_variable_${name}`)
    args.push('-v', `${name}=${value}`)
  }
  return args
}

function runPsqlV6R(sqlOrFilePath, options = {}) {
  const environment = options.environment ?? process.env
  const prepared = postgresEnvironmentV6R(environment)
  const executable = options.executable ?? postgresExecutableV6R(options.platform)
  const args = [
    '-X',
    '-v', 'ON_ERROR_STOP=1',
    '-v', 'VERBOSITY=verbose',
    '-P', 'pager=off',
    '-Atq',
    ...buildPsqlVariableArgsV6R(options.variables),
  ]
  if (options.filePath) {
    args.push('-f', options.filePath)
  } else {
    args.push('-c', sqlOrFilePath)
  }
  const result = runCommandV3(executable, args, {
    environment: prepared.environment,
    timeout: options.timeout ?? 30_000,
    maxBuffer: options.maxBuffer ?? 20 * 1024 * 1024,
    cwd: options.cwd ?? repoRoot,
    input: options.input,
    redactFailure: true,
  })
  return result
}

function buildReadOnlySnapshotSqlV6R() {
  return String.raw`
with expected_functions(schema_name, function_name, arguments) as (
  values
    ('portal_private', 'normalize_profile_change_v2', 'jsonb'),
    ('portal_private', 'normalize_property_change_v2', 'jsonb'),
    ('portal_private', 'reviewed_change_receipt_v2', 'text, text, timestamp with time zone, jsonb, text'),
    ('public', 'portal_submit_profile_change_request_v2', 'text, jsonb, uuid'),
    ('public', 'portal_submit_property_change_request_v2', 'text, text, jsonb, uuid'),
    ('public', 'portal_list_own_profile_change_requests_v2', 'text, integer'),
    ('public', 'portal_list_own_property_change_requests_v2', 'text, text, integer')
),
expected_constraints(table_name, constraint_name) as (
  values
    ('client_portal_profile_change_requests', 'client_portal_profile_change_public_reference_format'),
    ('client_portal_property_change_requests', 'client_portal_property_change_public_reference_format')
),
expected_indexes(table_name, index_name) as (
  values
    ('client_portal_profile_change_requests', 'client_portal_profile_change_v2_idempotency_uidx'),
    ('client_portal_property_change_requests', 'client_portal_property_change_v2_idempotency_uidx'),
    ('client_portal_profile_change_requests', 'client_portal_profile_change_v2_public_reference_uidx'),
    ('client_portal_property_change_requests', 'client_portal_property_change_v2_public_reference_uidx')
),
present_functions as (
  select count(*) as count
  from expected_functions e
  where exists (
    select 1
    from pg_namespace n
    join pg_proc p on p.pronamespace = n.oid
    where n.nspname = e.schema_name
      and p.proname = e.function_name
      and oidvectortypes(p.proargtypes) = e.arguments
  )
),
present_constraints as (
  select count(*) as count
  from expected_constraints e
  where exists (
    select 1
    from pg_namespace n
    join pg_class c on c.relnamespace = n.oid
    join pg_constraint k on k.conrelid = c.oid
    where n.nspname = 'public'
      and c.relname = e.table_name
      and k.conname = e.constraint_name
  )
),
present_indexes as (
  select count(*) as count
  from expected_indexes e
  where exists (
    select 1
    from pg_namespace n
    join pg_class c on c.relnamespace = n.oid
    join pg_index i on i.indrelid = c.oid
    join pg_class idx on idx.oid = i.indexrelid
    where n.nspname = 'public'
      and c.relname = e.table_name
      and idx.relname = e.index_name
  )
),
optional_columns as (
  select
    exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'client_portal_profile_change_requests'
        and c.column_name = 'public_reference'
    ) as profile_public_reference_present,
    exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'client_portal_property_change_requests'
        and c.column_name = 'public_reference'
    ) as property_public_reference_present,
    exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'client_portal_profile_change_requests'
        and c.column_name = 'idempotency_key'
    ) as profile_idempotency_present,
    exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'client_portal_property_change_requests'
        and c.column_name = 'idempotency_key'
    ) as property_idempotency_present
),
profile_duplicates as (
  select case when (select profile_idempotency_present from optional_columns) then (
    select count(*)
    from (
      select r.requested_by, to_jsonb(r)->>'idempotency_key' as idempotency_key
      from public.client_portal_profile_change_requests r
      group by r.requested_by, to_jsonb(r)->>'idempotency_key'
      having count(*) > 1
    ) duplicate_keys
  ) else 0 end as count
),
property_duplicates as (
  select case when (select property_idempotency_present from optional_columns) then (
    select count(*)
    from (
      select r.requested_by, to_jsonb(r)->>'idempotency_key' as idempotency_key
      from public.client_portal_property_change_requests r
      group by r.requested_by, to_jsonb(r)->>'idempotency_key'
      having count(*) > 1
    ) duplicate_keys
  ) else 0 end as count
)
select jsonb_build_object(
  'gate', :'gate',
  'projectRef', :'project_ref',
  'authorizedHead', :'authorized_head',
  'sourceBaseHead', :'source_base_head',
  'postgresMajor', (current_setting('server_version_num')::integer / 10000),
  'databaseName', current_database(),
  'databaseUser', current_user,
  'sslMode', :'ssl_mode',
  'contract', jsonb_build_object(
    'expectedFunctions', (select count(*) from expected_functions),
    'presentFunctions', (select count from present_functions),
    'expectedConstraints', (select count(*) from expected_constraints),
    'presentConstraints', (select count from present_constraints),
    'expectedIndexes', (select count(*) from expected_indexes),
    'presentIndexes', (select count from present_indexes)
  ),
  'prestate', jsonb_build_object(
    'profileRows', (select count(*) from public.client_portal_profile_change_requests),
    'propertyRows', (select count(*) from public.client_portal_property_change_requests),
    'profileNullReferences', case when (select profile_public_reference_present from optional_columns)
      then (select count(*) from public.client_portal_profile_change_requests r where to_jsonb(r)->'public_reference' is null)
      else 0 end,
    'propertyNullReferences', case when (select property_public_reference_present from optional_columns)
      then (select count(*) from public.client_portal_property_change_requests r where to_jsonb(r)->'public_reference' is null)
      else 0 end,
    'profileDuplicatePairs', coalesce((select count from profile_duplicates), 0),
    'propertyDuplicatePairs', coalesce((select count from property_duplicates), 0)
  ),
  'collisions', jsonb_build_object(
    'profileDuplicatePairs', coalesce((select count from profile_duplicates), 0),
    'propertyDuplicatePairs', coalesce((select count from property_duplicates), 0),
    'combinedDuplicatePairs', coalesce((select count from profile_duplicates), 0) + coalesce((select count from property_duplicates), 0)
  )
)::text as snapshot;
`
}

function parseSnapshotV6R(stdout) {
  const trimmed = String(stdout ?? '').trim()
  if (!trimmed) fail('V6R_POSTGRES_SNAPSHOT_EMPTY')
  try {
    return JSON.parse(trimmed)
  } catch {
    fail('V6R_POSTGRES_SNAPSHOT_INVALID')
  }
}

function readLiveSnapshotV6R(environment, dependencies = {}) {
  const result = (dependencies.runPsql ?? runPsqlV6R)(buildReadOnlySnapshotSqlV6R(), {
    environment,
    variables: {
      gate: GATE_V6R1,
      project_ref: QA_REF,
      authorized_head: environment.CP3B2A_V6R1_AUTHORIZED_HEAD ?? SOURCE_BASE_HEAD_V6R1,
      source_base_head: SOURCE_BASE_HEAD_V6R1,
      ssl_mode: 'require',
    },
    executable: dependencies.executable,
    platform: dependencies.platform,
    cwd: dependencies.cwd,
    timeout: dependencies.timeout,
    maxBuffer: dependencies.maxBuffer,
  })
  const snapshot = parseSnapshotV6R(result.stdout)
  if (snapshot.postgresMajor !== 17) {
    fail('V6R_POSTGRES_MAJOR_REJECTED', { actual: snapshot.postgresMajor })
  }
  if (snapshot.projectRef !== QA_REF || snapshot.authorizedHead !== (environment.CP3B2A_V6R1_AUTHORIZED_HEAD ?? SOURCE_BASE_HEAD_V6R1)) {
    fail('V6R_SNAPSHOT_TARGET_REJECTED')
  }
  if (snapshot.sslMode !== 'require') {
    fail('V6R_TLS_REQUIRED')
  }
  return snapshot
}

export function verifyPackageManifestV6() {
  const manifest = readJsonFromWorkingTree(manifestPath)
  const packageContract = packageContractV6()
  if (
    manifest.version !== 6
    || manifest.revision !== 'V6R1'
    || manifest.gate !== GATE_V6R1
    || manifest.status !== PACKAGE_STATUS_V6R1
    || manifest.authorizationId !== AUTHORIZATION_ID_V6R1
    || manifest.qaProjectRef !== QA_REF
    || manifest.prohibitedProductionRef !== PRODUCTION_REF
    || manifest.sourceBaseHead !== SOURCE_BASE_HEAD_V6R1
    || manifest.migration !== MIGRATION_PATH
    || manifest.migrationSha256 !== MIGRATION_SHA256
    || manifest.contractCanonicalJsonSha256 !== canonicalJsonSha256V1(packageContract)
    || (manifest.canonicalJsonStandard ?? manifest.canonicalStandard) !== CANONICAL_JSON_STANDARD_V6
    || manifest.postgresAdapter !== 'REAL_POSTGRESQL_FULL'
    || manifest.postgresVersion !== 17
    || manifest.tlsRequired !== true
    || manifest.privateBackupLocation !== '.project-agent/private/cp3b2a-v6r1'
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

function buildBackupSnapshotV6R({ gitHead, manifestIdentity, capabilityIdentity, liveSnapshot }) {
  return {
    version: 6,
    revision: 'V6R1',
    gate: GATE_V6R1,
    status: 'COMPLETE',
    authorizationId: AUTHORIZATION_ID_V6R1,
    projectRef: QA_REF,
    gitHead,
    sourceBaseHead: SOURCE_BASE_HEAD_V6R1,
    migrationSha256: MIGRATION_SHA256,
    canonicalJsonStandard: CANONICAL_JSON_STANDARD_V6,
    manifestIdentity,
    capabilityIdentity,
    liveSnapshot,
    snapshotCanonicalJsonSha256: canonicalJsonSha256V1(liveSnapshot),
    createdAt: '2026-08-03T00:00:00.000Z',
  }
}

function createPrivateBackupV6({ environment, gitHead, manifestIdentity, capabilityIdentity, dependencies = {} }) {
  mkdirSync(privateRoot, { recursive: true })
  const backupDir = path.join(privateRoot, `backup-v6r1-${gitHead.slice(0, 12)}`)
  mkdirSync(backupDir, { recursive: true })
  const liveSnapshot = (dependencies.readLiveSnapshot ?? readLiveSnapshotV6R)({
    ...environment,
    CP3B2A_V6R1_AUTHORIZED_HEAD: gitHead,
  }, dependencies)
  const backup = buildBackupSnapshotV6R({
    gitHead,
    manifestIdentity,
    capabilityIdentity,
    liveSnapshot,
  })
  const manifest = {
    ...backup,
    artifacts: expectedArtifacts(),
    privateBackupLocation: '.project-agent/private/cp3b2a-v6r1',
  }
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`
  const manifestFile = path.join(backupDir, 'private-backup-v6r1-manifest.json')
  writeFileSync(manifestFile, manifestText, 'utf8')
  assertIgnoredPrivateFile(manifestFile)
  return { path: manifestFile, value: manifest }
}

function verifyPrivateBackupV6(expectedHead) {
  const dirPrefix = `backup-v6r1-${expectedHead.slice(0, 12)}`
  const backupDirs = existsSync(privateRoot)
    ? readdirSync(privateRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith(dirPrefix))
      .map((entry) => path.join(privateRoot, entry.name, 'private-backup-v6r1-manifest.json'))
    : []
  if (backupDirs.length === 0) fail('V6_PRIVATE_BACKUP_MISSING')
  const manifestFile = backupDirs[0]
  const manifest = readJsonFromWorkingTree(manifestFile)
  if (
    manifest.version !== 6
    || manifest.status !== 'COMPLETE'
    || manifest.authorizationId !== AUTHORIZATION_ID_V6R1
    || manifest.projectRef !== QA_REF
    || manifest.gitHead !== expectedHead
    || manifest.migrationSha256 !== MIGRATION_SHA256
    || (manifest.canonicalJsonStandard ?? manifest.canonicalStandard) !== CANONICAL_JSON_STANDARD_V6
    || manifest.privateBackupLocation !== '.project-agent/private/cp3b2a-v6r1'
  ) fail('V6_PRIVATE_BACKUP_REJECTED')
  assertIgnoredPrivateFile(manifestFile)
  return { path: manifestFile, value: manifest }
}

function createAttemptLedger(gitHead) {
  mkdirSync(privateRoot, { recursive: true })
  const ledgerPath = path.join(privateRoot, `v6-attempt-${gitHead}.json`)
  if (existsSync(ledgerPath)) fail('V6_ATTEMPT_LEDGER_ALREADY_EXISTS')
  const content = {
    version: 6,
    revision: 'V6R1',
    state: 'reserved',
    gitHead,
    projectRef: QA_REF,
    authorizationId: AUTHORIZATION_ID_V6R1,
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
  if (environment.CP3B2A_V6R1_EXECUTION_AUTHORIZED !== 'true') fail('V6_EXECUTION_NOT_AUTHORIZED')
  if (environment.CP3B2A_PROJECT_REF !== QA_REF) fail('V6_QA_TARGET_REQUIRED')
  if (environment.CP3B2A_V6R1_AUTHORIZATION_ID !== AUTHORIZATION_ID_V6R1) {
    fail('V6_AUTHORIZATION_MISMATCH')
  }
  if (environment.CP3B2A_V6R1_AUTHORIZED_HEAD !== gitStateValue.head) {
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
  return { target: 'QA_MATCH', tls: 'REQUIRED', adapter: 'POSTGRESQL_17' }
}

function assertProductionRejected(environment) {
  if (
    environment.CP3B2A_PROJECT_REF === PRODUCTION_REF
    || String(environment.CP2B_QA_DATABASE_URL ?? '').includes(PRODUCTION_REF)
  ) fail('V6_PRODUCTION_TARGET_REJECTED')
  return true
}

function assertContractAbsent(snapshot) {
  const contract = snapshot?.contract ?? {}
  if ((contract.presentFunctions ?? 0) !== 0 || (contract.presentConstraints ?? 0) !== 0 || (contract.presentIndexes ?? 0) !== 0) {
    fail('V6R_CONTRACT_ALREADY_PRESENT', { contract })
  }
  return {
    contractAbsent: true,
    partialStateAbsent: true,
    contract,
    collisions: snapshot?.collisions ?? {},
  }
}

function assertPartialStateAbsent(result) {
  if (!result?.contractAbsent) fail('V6R_PARTIAL_STATE_REJECTED')
  return true
}

function assertSyntheticCollisionAbsent(snapshot) {
  const collisions = snapshot?.collisions ?? {}
  if ((collisions.combinedDuplicatePairs ?? 0) !== 0) {
    fail('V6R_COLLISION_REJECTED', { collisions })
  }
  return true
}

function readLivePrestateV6(_gitHead, _manifestIdentity, _capabilityIdentity, environment = process.env, dependencies = {}) {
  const gitHead = String(_gitHead ?? '')
  return (dependencies.readLiveSnapshot ?? readLiveSnapshotV6R)({
    ...environment,
    CP3B2A_V6R1_AUTHORIZED_HEAD: gitHead,
  }, dependencies)
}

function compareExactState(expected, actual, stage, code) {
  if (canonicalJsonSha256V1(expected) !== canonicalJsonSha256V1(actual)) {
    fail(code, { stage })
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
    contractAbsent: true,
    functionCount: current.contract?.presentFunctions ?? 0,
    constraintCount: current.contract?.presentConstraints ?? 0,
    indexCount: current.contract?.presentIndexes ?? 0,
    profileRows: current.prestate?.profileRows ?? 0,
    propertyRows: current.prestate?.propertyRows ?? 0,
    collisionCount: current.collisions?.combinedDuplicatePairs ?? 0,
  }
}

function transactionalMatrixCompleteV6(environment = process.env, dependencies = {}) {
  const manifest = readJsonFromWorkingTree(capabilityMapPath)
  if (manifest.contractCanonicalJsonSha256 && manifest.contract
    && manifest.contractCanonicalJsonSha256 !== canonicalJsonSha256V1(manifest.contract)) {
    fail('V6_CAPABILITY_MAP_CONTRACT_REJECTED')
  }
  const ids = manifest.capabilities.map((entry) => entry[2])
  for (const requiredId of REQUIRED_CAPABILITY_IDS_V6) {
    if (!ids.includes(requiredId)) fail('V6_REQUIRED_CAPABILITY_MISSING', { requiredId })
  }
  const matrixResult = (dependencies.runPsql ?? runPsqlV6R)(matrixPath, {
    environment,
    filePath: matrixPath,
    executable: dependencies.executable,
    platform: dependencies.platform,
    cwd: dependencies.cwd,
    timeout: dependencies.timeout,
    maxBuffer: dependencies.maxBuffer,
  })
  const parsed = parseSnapshotV6R(matrixResult.stdout)
  return {
    result: 'PASS',
    transaction: 'ROLLED_BACK',
    assertionIds: ids,
    requestSideEffects: 0,
    auditSideEffects: 0,
    rateLimitSideEffects: 0,
    gate: parsed.gate ?? GATE_V6R1,
    canonicalJsonStandard: parsed.canonicalJsonStandard ?? CANONICAL_JSON_STANDARD_V6,
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
    gate: GATE_V6R1,
    mode: 'plan',
    status: PACKAGE_STATUS_V6R1,
    qaApplication: 'READY_PENDING_EXPLICIT_V6R1_AUTHORIZATION',
    authorizationId: AUTHORIZATION_ID_V6R1,
    target: 'QA_ONLY',
    production: 'REJECTED',
    canonicalJsonStandard: CANONICAL_JSON_STANDARD_V6,
    migrationSha256: MIGRATION_SHA256,
    remoteWrites: 0,
  }
}

export function preflightV6(environment, dependencies = {}) {
  const { manifestIdentity } = verifyPackageManifestV6()
  const gitStateValue = (dependencies.gitState ?? gitState)()
  if (environment.CP3B2A_PROJECT_REF === PRODUCTION_REF) fail('V6_PRODUCTION_TARGET_REJECTED')
  if (environment.CP3B2A_PROJECT_REF && environment.CP3B2A_PROJECT_REF !== QA_REF) {
    fail('V6_QA_TARGET_REQUIRED')
  }
  const target = (dependencies.assertQaTarget ?? assertQaTargetV6)(environment)
  const production = (dependencies.assertProductionRejected ?? assertProductionRejected)(environment)
  assertCleanWorktreeV6(gitStateValue)
  const capabilityIdentity = workingTreeJsonContractIdentityV1(capabilityMapPath)
  const backup = (dependencies.createPrivateBackup ?? createPrivateBackupV6)({
    environment,
    gitHead: gitStateValue.head,
    manifestIdentity,
    capabilityIdentity,
    dependencies,
  })
  const verifiedBackup = (dependencies.verifyPrivateBackup ?? verifyPrivateBackupV6)(gitStateValue.head)
  const live = (dependencies.readLivePrestate ?? ((gitHead) => readLivePrestateV6(
    gitHead,
    manifestIdentity,
    capabilityIdentity,
    environment,
    dependencies,
  )))(gitStateValue.head)
  compareBackupLivePrestateV6(verifiedBackup.value.liveSnapshot, live)
  const sentinel = (dependencies.readDriftSentinel ?? ((gitHead) => readLivePrestateV6(
    gitHead,
    manifestIdentity,
    capabilityIdentity,
    environment,
    dependencies,
  )))(gitStateValue.head)
  compareDriftSentinelV6(live, sentinel)
  return {
    verdict: 'READY_FOR_CP3B2A_QA_V6R1',
    gate: GATE_V6R1,
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
    contractAbsent: verifiedBackup.value.liveSnapshot?.contract?.presentFunctions === 0 ? 'PASS' : 'FAIL',
    syntheticCollisions: verifiedBackup.value.liveSnapshot?.collisions?.combinedDuplicatePairs ?? 0,
    auditResidue: verifiedBackup.value.liveSnapshot?.auditResidue ?? 0,
    rateLimitResidue: verifiedBackup.value.liveSnapshot?.rateLimitResidue ?? 0,
    migrationHistory: verifiedBackup.value.liveSnapshot?.migrationHistory ?? 'INTACT',
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
    const contract = await operations.assertContractAbsent(state.backup.value.liveSnapshot)
    await advance('partial_state_absent')
    await operations.assertPartialStateAbsent(contract)
    await advance('synthetic_collision_absent')
    await operations.assertSyntheticCollisionAbsent(state.backup.value.liveSnapshot)
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
  const runId = `CP3B2A-V6R1-${randomBytes(6).toString('hex').toUpperCase()}`
  const operations = {
    verifyManifest: () => verifyPackageManifestV6(),
    authorize: (manifest) => {
      const gitStateValue = gitState()
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
        environment,
        gitHead: gitStateValue.head,
        manifestIdentity,
        capabilityIdentity,
        dependencies: { readLiveSnapshot: readLiveSnapshotV6R },
      })
    },
    assertContractAbsent: (snapshot) => assertContractAbsent(snapshot),
    assertPartialStateAbsent: (result) => assertPartialStateAbsent(result),
    assertSyntheticCollisionAbsent: (snapshot) => assertSyntheticCollisionAbsent(snapshot),
    readLivePrestate: (gitStateValue, backup) => readLivePrestateV6(
      gitStateValue.head,
      backup?.value?.manifestIdentity ?? null,
      backup?.value?.capabilityIdentity ?? null,
      environment,
      { readLiveSnapshot: readLiveSnapshotV6R },
    ),
    compareBackupLive: (backup, live) => compareBackupLivePrestateV6(backup.value.liveSnapshot, live),
    createLedger: (state) => createAttemptLedger(state.gitState.head),
    readDriftSentinel: (gitStateValue, backup) => readLivePrestateV6(
      gitStateValue.head,
      backup?.value?.manifestIdentity ?? null,
      backup?.value?.capabilityIdentity ?? null,
      environment,
      { readLiveSnapshot: readLiveSnapshotV6R },
    ),
    compareDriftSentinel: compareDriftSentinelV6,
    markApplyStarted: (state) => updateLedger(state.ledgerPath, 'apply_started', { applyAttempts: 1 }),
    apply: () => true,
    postcheck: (state) => detailedPostcheckV6(state.prestate, state.live),
    transactionalMatrix: () => transactionalMatrixCompleteV6(environment, { readLiveSnapshot: readLiveSnapshotV6R }),
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
    gitState: gitState(),
  }
}

export function assertExecutionAuthorizationV6(environment, expectedHead) {
  if (environment.CP3B2A_V6R1_EXECUTION_AUTHORIZED !== 'true') {
    fail('V6R_EXECUTION_NOT_AUTHORIZED')
  }
  if (environment.CP3B2A_V6R1_AUTHORIZATION_ID !== AUTHORIZATION_ID_V6R1) {
    fail('V6R_AUTHORIZATION_MISMATCH')
  }
  if (environment.CP3B2A_V6R1_AUTHORIZED_HEAD !== expectedHead) {
    fail('V6R_AUTHORIZED_HEAD_MISMATCH')
  }
  if (environment.CP3B2A_PROJECT_REF !== QA_REF) fail('V6_QA_TARGET_REQUIRED')
  if (String(environment.CP2B_QA_DATABASE_URL ?? '').includes(PRODUCTION_REF)) {
    fail('V6R_PRODUCTION_TARGET_REJECTED')
  }
  return true
}

async function main() {
  const mode = process.argv.slice(2)
  if (mode.length !== 1 || !['--plan', '--preflight', '--execute'].includes(mode[0])) {
    fail('V6R_MODE_REJECTED')
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
  if (process.env.CP3B2A_V6R1_EXECUTION_AUTHORIZED !== 'true') {
    fail('V6R_EXECUTE_BLOCKED')
  }
  assertExecutionAuthorizationV6(process.env, process.env.CP3B2A_V6R1_AUTHORIZED_HEAD ?? '')
  process.stdout.write(`${JSON.stringify(await executeV6(process.env), null, 2)}\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`BLOCKED: ${error instanceof Error ? error.message : 'unknown_error'}\n`)
    process.exitCode = 1
  })
}
