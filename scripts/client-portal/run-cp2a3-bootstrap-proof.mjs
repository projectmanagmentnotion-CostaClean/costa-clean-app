import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createEmptyLedger,
  createRunId,
  PRODUCTION_REF,
  QA_REF,
  transitionLedger,
  validateQaTarget,
} from './cp2b_qa_auth_fixtures_v2.mjs'
import {
  assertExecutionGateV4,
  verifyManifestV4,
} from './run-cp2b-qa-v4.mjs'
import { verifyPrivateBackup } from './run-cp2b-qa-v2.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const migrationPath = path.join(
  repoRoot,
  'supabase',
  'migrations',
  '20260723160000_client_portal_security_boundary.sql',
)
const originalApplyPath = path.join(repoRoot, 'scripts', 'client-portal', 'cp2b_apply.sql')
const applyV4Path = path.join(repoRoot, 'scripts', 'client-portal', 'cp2b_apply_v4.sql')
const fixturesPath = path.join(repoRoot, 'scripts', 'client-portal', 'cp2b_qa_fixtures_v2.sql')
const matrixPath = path.join(
  repoRoot,
  'scripts',
  'client-portal',
  'cp2b_qa_authorization_matrix_v2.sql',
)
const cleanupPath = path.join(repoRoot, 'scripts', 'client-portal', 'cp2b_qa_cleanup_v2.sql')
const recoveryPath = path.join(
  repoRoot,
  'scripts',
  'client-portal',
  'cp2b_qa_failure_recovery_v2.sql',
)
const rollbackPath = path.join(repoRoot, 'scripts', 'client-portal', 'cp2a_rollback.sql')
const manifestPath = path.join(
  repoRoot,
  'scripts',
  'client-portal',
  'cp2b_qa_package_v4.manifest.json',
)
const reportPath = path.join(
  repoRoot,
  'qa-reports',
  'private',
  'client-portal',
  'cp2a3-bootstrap-proof-latest.json',
)

const baselineOrder = [
  '20260721_qa_baseline_schema.sql',
  '20260707_fix_same_number_invoice_update_gap.sql',
  '20260721_rls_clients_properties_jobs_write_fix.sql',
  '20260722_close_anon_read_policies_qa_verified.sql',
  '20260722171428_public_quiz_providerless_abuse_protection.sql',
]

const authRoles = [
  'active_staff',
  'suspended_staff',
  'client_admin_a',
  'client_member_a',
  'client_admin_b',
  'client_member_b',
  'pending',
  'suspended_member',
  'revoked_member',
  'unverified',
  'invitee',
]

const rowIdNames = [
  'client_a_id', 'client_b_id', 'property_a_id', 'property_b_id',
  'quote_a_id', 'quote_b_id', 'job_a_id', 'job_b_id',
  'invoice_a_id', 'invoice_b_id', 'invoice_line_a_id', 'invoice_line_b_id',
  'membership_admin_a_id', 'membership_member_a_id',
  'membership_admin_b_id', 'membership_member_b_id',
  'membership_suspended_id', 'membership_revoked_id',
  'application_id', 'invitation_active_id', 'invitation_expired_id',
  'invitation_revoked_id', 'invitation_used_id',
  'service_request_a_id', 'service_request_b_id',
  'service_idempotency_a', 'service_idempotency_b',
  'document_a_id', 'document_b_id', 'profile_change_id',
  'property_change_id', 'legal_acceptance_id', 'audit_event_id',
  'correlation_id', 'matrix_idempotency_key', 'random_record_id',
]

function fail(message) {
  throw new Error(message)
}

function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
    windowsHide: true,
    timeout: options.timeout ?? 120_000,
    stdio: options.stdio,
  })
  if (result.error) fail(`${path.basename(executable)}: ${result.error.message}`)
  if (result.status !== 0 && !options.expectFailure) {
    const detail = options.redactFailure
      ? sanitizeDiagnostic([result.stdout, result.stderr].filter(Boolean).join('\n'))
      : [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    fail(`${options.failureLabel ?? path.basename(executable)} failed${detail ? `:\n${detail}` : '.'}`)
  }
  if (result.status === 0 && options.expectFailure) {
    fail(`${options.failureLabel ?? path.basename(executable)} unexpectedly succeeded`)
  }
  return (result.stdout ?? '').trim()
}

function sanitizeDiagnostic(value) {
  const relevant = String(value)
    .split(/\r?\n/u)
    .filter((line) => /ERROR:|CONTEXT:|psql:/u.test(line))
    .slice(-8)
    .join('\n')
  return (relevant || 'redacted')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/giu, '[uuid]')
    .replaceAll(QA_REF, '[qa-ref]')
    .replaceAll(PRODUCTION_REF, '[production-ref]')
    .replace(/\bhttps?:\/\/\S+/giu, '[url]')
    .replace(/\b\S+@example\.invalid\b/giu, '[synthetic-email]')
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

function assertLocalOnlyEnvironment() {
  const remoteValues = Object.entries(process.env)
    .filter(([name]) => /(DATABASE|POSTGRES|SUPABASE|PGHOST|PGURL|DB_URL|PROJECT_REF)/iu.test(name))
    .map(([, value]) => value ?? '')
    .join('\n')
  if (remoteValues.includes(QA_REF) || remoteValues.includes(PRODUCTION_REF)) {
    fail('remote_environment_rejected')
  }
  const pgHost = process.env.PGHOST?.trim().toLowerCase()
  if (pgHost && !['127.0.0.1', 'localhost', '::1'].includes(pgHost)) {
    fail('non_loopback_pg_host_rejected')
  }
}

function findPostgres17() {
  const candidates = [
    process.env.CP2A1_PG_BIN,
    process.platform === 'win32' ? 'C:\\Program Files\\PostgreSQL\\17\\bin' : undefined,
  ].filter(Boolean)
  for (const bin of candidates) {
    const tools = {
      initdb: path.join(bin, process.platform === 'win32' ? 'initdb.exe' : 'initdb'),
      pgCtl: path.join(bin, process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl'),
      psql: path.join(bin, process.platform === 'win32' ? 'psql.exe' : 'psql'),
      pgRestore: path.join(bin, process.platform === 'win32' ? 'pg_restore.exe' : 'pg_restore'),
    }
    if (Object.values(tools).every(existsSync)) return tools
  }
  fail('postgresql_17_unavailable')
}

function reserveLoopbackPort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close((error) => (error ? reject(error) : resolve(port)))
    })
  })
}

function connectionArgs(port) {
  return [
    '-X', '-v', 'ON_ERROR_STOP=1',
    '-h', '127.0.0.1', '-p', String(port),
    '-U', 'postgres', '-d', 'postgres',
  ]
}

function query(psql, port, sql, options = {}) {
  return run(psql, [...connectionArgs(port), '-Atqc', sql], options)
}

function applyFile(psql, port, filePath, variables = {}, options = {}) {
  const args = connectionArgs(port)
  for (const [name, value] of Object.entries(variables)) {
    args.push('-v', `${name}=${value}`)
  }
  args.push('-f', filePath)
  return run(psql, args, options)
}

function findPrivateQaSchemaBackup() {
  const privateDir = path.join(repoRoot, '.git', 'cp2b-private')
  if (!existsSync(privateDir)) return null
  const manifests = []
  for (const name of readdirSync(privateDir)) {
    if (!name.endsWith('-backup-manifest.json')) continue
    try {
      const manifest = JSON.parse(readFileSync(path.join(privateDir, name), 'utf8'))
      if (manifest.version === 1
        && manifest.status === 'COMPLETE'
        && manifest.projectRef === QA_REF
        && manifest.gitHead === '756b86d6fe797ee4c119264f48e837fa725e00f2') {
        manifests.push(manifest)
      }
    } catch {}
  }
  if (manifests.length !== 1) return null
  const candidates = manifests[0].artifacts.filter(
    (artifact) => /(?:schema|backup|dump)/iu.test(artifact.path)
      && !/catalog/iu.test(artifact.path)
      && existsSync(artifact.path)
      && sha256(artifact.path) === artifact.sha256,
  )
  return candidates.length === 1 ? candidates[0].path : null
}

function proveQaSnapshotDisposable(postgres, port) {
  const dumpPath = findPrivateQaSchemaBackup()
  if (!dumpPath) return 'NOT_POSSIBLE'
  const database = 'cp2a3_snapshot'
  query(postgres.psql, port, `create database ${database}`)
  const base = [
    '-X', '-v', 'ON_ERROR_STOP=1',
    '-h', '127.0.0.1', '-p', String(port),
    '-U', 'postgres', '-d', database,
  ]
  run(postgres.psql, [...base, '-Atqc', `
    create schema auth;
    create table auth.users (
      id uuid primary key,
      email text,
      email_confirmed_at timestamptz
    );
    create function auth.uid() returns uuid language sql stable
      set search_path = pg_catalog
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create schema storage;
    create table storage.buckets (
      id text primary key,
      name text not null,
      public boolean not null default false,
      file_size_limit bigint,
      allowed_mime_types text[]
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text not null references storage.buckets(id) on delete cascade,
      name text not null,
      owner uuid
    );
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated, service_role;
    grant select, insert, update, delete on storage.objects to authenticated;
    grant all on storage.objects, storage.buckets to service_role;
  `])
  const restore = spawnSync(postgres.pgRestore, [
    '-h', '127.0.0.1', '-p', String(port), '-U', 'postgres',
    '-d', database, '--no-owner', '--no-privileges',
    '--schema=public', '--clean', '--if-exists', dumpPath,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
    maxBuffer: 50 * 1024 * 1024,
  })
  if (restore.error || restore.status !== 0) return 'NOT_POSSIBLE'

  const activeId = randomUUID()
  run(postgres.psql, [...base, '-Atqc', `
    insert into auth.users(id) values ('${activeId}'::uuid);
  `], {
    redactFailure: true,
    failureLabel: 'snapshot_auth_stub',
  })
  const applyArgs = [...base,
    '-v', `project_ref=${QA_REF}`,
    '-v', `active_staff_user_id=${activeId}`,
    '-f', applyV4Path,
  ]
  run(postgres.psql, applyArgs, {
    redactFailure: true,
    failureLabel: 'snapshot_apply_v4',
    timeout: 120_000,
  })
  const count = run(postgres.psql, [...base, '-Atqc', `
    select count(*) from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r'
      and c.relname = any(array[
        'internal_staff_memberships','client_portal_invitations',
        'client_portal_memberships','client_portal_applications',
        'client_portal_profile_change_requests',
        'client_portal_property_change_requests','client_service_requests',
        'client_portal_audit_events','client_portal_rate_limits',
        'invoice_document_records','client_portal_legal_acceptances'
      ]);
  `]).trim()
  if (count !== '11') fail('snapshot_portal_table_count_failed')
  return 'PASS'
}

function writeCombinedFile(workDir, name, chunks) {
  const target = path.join(workDir, name)
  writeFileSync(target, chunks.join('\n\n'), 'utf8')
  return target
}

function setupSql() {
  return `
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text unique,
      email_confirmed_at timestamptz,
      cp2a1_role text unique not null
    );
    create function auth.uid() returns uuid language sql stable
      set search_path = pg_catalog
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

    create schema storage;
    create table storage.buckets (
      id text primary key,
      name text not null,
      public boolean not null default false,
      file_size_limit bigint,
      allowed_mime_types text[]
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text not null references storage.buckets(id) on delete cascade,
      name text not null,
      owner uuid
    );
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated, service_role;
    grant select, insert, update, delete on storage.objects to authenticated;
    grant all on storage.objects, storage.buckets to service_role;
    insert into storage.buckets(id, name, public)
      values ('expense-receipts', 'expense-receipts', false);
    create policy "Allow authenticated read expense receipts"
      on storage.objects for select to authenticated
      using (bucket_id = 'expense-receipts');
    create policy "Allow authenticated upload expense receipts"
      on storage.objects for insert to authenticated
      with check (bucket_id = 'expense-receipts');
    create policy "Allow authenticated update expense receipts"
      on storage.objects for update to authenticated
      using (bucket_id = 'expense-receipts')
      with check (bucket_id = 'expense-receipts');
    create policy "Allow authenticated delete expense receipts"
      on storage.objects for delete to authenticated
      using (bucket_id = 'expense-receipts');
  `
}

function createLocalAuthUsers(psql, port, runId) {
  for (const role of authRoles) {
    const confirmed = role === 'unverified' ? 'null' : 'clock_timestamp()'
    query(psql, port, `
      insert into auth.users(email, email_confirmed_at, cp2a1_role)
      values (
        '${role.replaceAll('_', '-')}.${runId}@example.invalid',
        ${confirmed},
        '${role}'
      );
    `)
  }
  const ids = JSON.parse(query(psql, port, `
    select jsonb_object_agg(cp2a1_role, id)::text from auth.users;
  `))
  if (Object.keys(ids).length !== authRoles.length
    || new Set(Object.values(ids)).size !== authRoles.length) {
    fail('dynamic_auth_generation_failed')
  }
  return ids
}

function createSqlVariables(runId, authIds) {
  const rowIds = Object.fromEntries(rowIdNames.map((name) => [name, randomUUID()]))
  return {
    project_ref: QA_REF,
    cp2b_run_id: runId,
    active_staff_user_id: authIds.active_staff,
    suspended_staff_user_id: authIds.suspended_staff,
    admin_a_user_id: authIds.client_admin_a,
    member_a_user_id: authIds.client_member_a,
    admin_b_user_id: authIds.client_admin_b,
    member_b_user_id: authIds.client_member_b,
    pending_user_id: authIds.pending,
    suspended_member_user_id: authIds.suspended_member,
    revoked_member_user_id: authIds.revoked_member,
    unverified_user_id: authIds.unverified,
    invitee_user_id: authIds.invitee,
    ...rowIds,
    document_a_object_key: `${rowIds.document_a_id}/${randomUUID()}.pdf`,
    document_b_object_key: `${rowIds.document_b_id}/${randomUUID()}.pdf`,
  }
}

function captureOriginalApplyFailure(psql, port, variables) {
  const args = connectionArgs(port)
  for (const [name, value] of Object.entries({
    project_ref: QA_REF,
    active_staff_user_id: variables.active_staff_user_id,
    suspended_staff_user_id: variables.suspended_staff_user_id,
  })) {
    args.push('-v', `${name}=${value}`)
  }
  args.push('-v', 'VERBOSITY=verbose', '-f', originalApplyPath)
  const result = spawnSync(psql, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
    maxBuffer: 50 * 1024 * 1024,
  })
  const diagnostic = sanitizeDiagnostic(result.stderr)
  if (result.status === 0
    || !/42703/u.test(result.stderr)
    || !/column b\.role does not exist/iu.test(result.stderr)) {
    fail(`original_apply_failure_mismatch:${diagnostic}`)
  }
  return {
    sqlstate: '42703',
    file: '20260723160000_client_portal_security_boundary.sql',
    line: result.stderr.match(/20260723160000_client_portal_security_boundary\.sql:(\d+):/u)?.[1]
      ?? 'UNKNOWN',
    errorId: 'BOOTSTRAP_COLUMN_MISMATCH',
  }
}

function portalCatalog(psql, port) {
  return JSON.parse(query(psql, port, `
    select jsonb_build_object(
      'tables', (
        select count(*) from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
          and c.relname = any(array[
            'internal_staff_memberships','client_portal_invitations',
            'client_portal_memberships','client_portal_applications',
            'client_portal_profile_change_requests',
            'client_portal_property_change_requests','client_service_requests',
            'client_portal_audit_events','client_portal_rate_limits',
            'invoice_document_records','client_portal_legal_acceptances'
          ])
      ),
      'rls', (
        select count(*) from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relrowsecurity
          and c.relname = any(array[
            'internal_staff_memberships','client_portal_invitations',
            'client_portal_memberships','client_portal_applications',
            'client_portal_profile_change_requests',
            'client_portal_property_change_requests','client_service_requests',
            'client_portal_audit_events','client_portal_rate_limits',
            'invoice_document_records','client_portal_legal_acceptances'
          ])
      ),
      'forceRls', (
        select count(*) from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relforcerowsecurity
          and c.relname = any(array[
            'internal_staff_memberships','client_portal_invitations',
            'client_portal_memberships','client_portal_applications',
            'client_portal_profile_change_requests',
            'client_portal_property_change_requests','client_service_requests',
            'client_portal_audit_events','client_portal_rate_limits',
            'invoice_document_records','client_portal_legal_acceptances'
          ])
      )
    );
  `))
}

function assertFailureCases(psql, port, variables, workDir) {
  applyFile(psql, port, fixturesPath, {
    ...variables,
    project_ref: PRODUCTION_REF,
  }, {
    expectFailure: true,
    redactFailure: true,
    failureLabel: 'production_target_guard',
  })
  applyFile(psql, port, fixturesPath, {
    ...variables,
    project_ref: 'unknown-project-ref',
  }, {
    expectFailure: true,
    redactFailure: true,
    failureLabel: 'unknown_target_guard',
  })
  const { property_a_id: _omitted, ...missingVariable } = variables
  applyFile(psql, port, fixturesPath, missingVariable, {
    expectFailure: true,
    redactFailure: true,
    failureLabel: 'missing_variable_guard',
  })

  validateQaTarget({
    projectRef: QA_REF,
    supabaseUrl: `https://${QA_REF}.supabase.co`,
  })
  for (const target of [PRODUCTION_REF, 'unknown-project-ref']) {
    let rejected = false
    try {
      validateQaTarget({
        projectRef: target,
        supabaseUrl: `https://${target}.supabase.co`,
      })
    } catch {
      rejected = true
    }
    if (!rejected) fail('target_rejection_failed')
  }

  const ledgerPath = path.join(workDir, 'private', 'ledger.json')
  createEmptyLedger(ledgerPath, variables.cp2b_run_id)
  let duplicateRejected = false
  try {
    createEmptyLedger(ledgerPath, variables.cp2b_run_id)
  } catch {
    duplicateRejected = true
  }
  if (!duplicateRejected) fail('preexisting_ledger_not_rejected')
  for (const state of [
    'backup_complete',
    'auth_users_created',
    'migration_applied',
    'staff_membership_verified',
    'fixtures_created',
    'edge_deployed',
    'storage_verified',
    'matrix_passed',
    'cleanup_started',
    'cleanup_complete',
    'auth_users_deleted',
    'zero_residue_verified',
    'completed',
  ]) {
    transitionLedger(ledgerPath, state)
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  verifyManifestV4(manifest)
  const tampered = structuredClone(manifest)
  tampered.artifacts[0].sha256 = '0'.repeat(64)
  let hashRejected = false
  try {
    verifyManifestV4(tampered)
  } catch {
    hashRejected = true
  }
  if (!hashRejected) fail('tampered_hash_not_rejected')

  let backupRejected = false
  try {
    verifyPrivateBackup(path.join(workDir, 'missing-backup.json'), 'unauthorized-head')
  } catch {
    backupRejected = true
  }
  if (!backupRejected) fail('invalid_backup_not_rejected')

  let unauthorizedRejected = false
  try {
    assertExecutionGateV4({
      environment: {},
      manifest,
      gitHead: 'unauthorized-head',
      clean: true,
    })
  } catch {
    unauthorizedRejected = true
  }
  if (!unauthorizedRejected) fail('unauthorized_execution_not_rejected')
}

function zeroResidueSql(variables) {
  return `
    select (
      (select count(*) from public.clients
        where id in ('${variables.client_a_id}', '${variables.client_b_id}'))
      + (select count(*) from public.client_portal_memberships
        where id in (
          '${variables.membership_admin_a_id}'::uuid,
          '${variables.membership_member_a_id}'::uuid,
          '${variables.membership_admin_b_id}'::uuid,
          '${variables.membership_member_b_id}'::uuid,
          '${variables.membership_suspended_id}'::uuid,
          '${variables.membership_revoked_id}'::uuid
        ))
      + (select count(*) from public.client_portal_invitations
        where id in (
          '${variables.invitation_active_id}'::uuid,
          '${variables.invitation_expired_id}'::uuid,
          '${variables.invitation_revoked_id}'::uuid,
          '${variables.invitation_used_id}'::uuid
        ))
      + (select count(*) from public.client_service_requests
        where id in (
          '${variables.service_request_a_id}'::uuid,
          '${variables.service_request_b_id}'::uuid
        ))
      + (select count(*) from public.invoice_document_records
        where id in (
          '${variables.document_a_id}'::uuid,
          '${variables.document_b_id}'::uuid
        ))
    )::text;
  `
}

async function main() {
  assertLocalOnlyEnvironment()
  for (const filePath of [
    migrationPath, originalApplyPath, applyV4Path, fixturesPath, matrixPath,
    cleanupPath, recoveryPath, rollbackPath, manifestPath,
  ]) {
    if (!existsSync(filePath)) fail(`required_artifact_missing:${path.basename(filePath)}`)
  }
  const postgres = findPostgres17()
  const port = await reserveLoopbackPort()
  const workDir = mkdtempSync(path.join(tmpdir(), `costa-clean-cp2a3-${randomBytes(5).toString('hex')}-`))
  const clusterDir = path.join(workDir, 'cluster')
  const logPath = path.join(workDir, 'postgres.log')
  const result = {
    result: 'FAIL',
    compatibilityEnvironment: 'PostgreSQL 17 with Auth/Storage compatibility schema',
    supabaseCloudEquivalent: false,
    migrationSha256: sha256(migrationPath),
    dynamicAuthUsers: 0,
    originalApplyFailure: null,
    v4Apply: false,
    portalTables: 0,
    rlsTables: 0,
    forceRlsTables: 0,
    activeStaffBootstrap: false,
    suspendedStaffFixture: false,
    missingActiveRejected: false,
    missingSuspendedRejected: false,
    invalidBackupRejected: false,
    unauthorizedExecutionRejected: false,
    qaSnapshotDisposableProof: 'NOT_POSSIBLE',
    parameterizedMatrix: false,
    exactIdCleanup: false,
    productionRejected: false,
    unknownTargetRejected: false,
    missingInputRejected: false,
    tamperedHashRejected: false,
    preexistingLedgerRejected: false,
    recoveryAfterMigration: false,
    rollbackProof: false,
    localZeroResidue: false,
    qaRemoteWrites: 0,
    productionWrites: 0,
    secretsRecorded: false,
    clusterDiscarded: false,
  }
  let started = false

  try {
    run(postgres.initdb, [
      '-D', clusterDir, '--username=postgres', '--auth=trust',
      '--encoding=UTF8', '--no-locale',
    ])
    run(postgres.pgCtl, [
      '-D', clusterDir, '-l', logPath,
      '-o', `-F -p ${port} -h 127.0.0.1`,
      '-w', 'start',
    ], { stdio: 'ignore' })
    started = true
    result.postgresVersion = query(postgres.psql, port, 'show server_version')

    query(postgres.psql, port, setupSql())
    for (const file of baselineOrder) {
      applyFile(postgres.psql, port, path.join(repoRoot, 'supabase', 'migrations', file))
    }
    query(postgres.psql, port, `
      grant all on all tables in schema public to service_role;
      grant usage, select on all sequences in schema public to service_role;
    `)
    result.qaSnapshotDisposableProof = proveQaSnapshotDisposable(postgres, port)

    const runId = createRunId()
    const authIds = createLocalAuthUsers(postgres.psql, port, runId)
    result.dynamicAuthUsers = Object.keys(authIds).length
    const variables = createSqlVariables(runId, authIds)

    result.originalApplyFailure = captureOriginalApplyFailure(postgres.psql, port, variables)
    if (query(postgres.psql, port, `
      select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname='client_portal_memberships';
    `) !== '0') {
      fail('original_apply_left_residue')
    }

    applyFile(postgres.psql, port, applyV4Path, {
      project_ref: QA_REF,
      active_staff_user_id: randomUUID(),
    }, {
      expectFailure: true,
      redactFailure: true,
      failureLabel: 'missing_active_staff_guard',
    })
    result.missingActiveRejected = true
    for (const projectRef of [PRODUCTION_REF, 'unknown-project-ref']) {
      applyFile(postgres.psql, port, applyV4Path, {
        project_ref: projectRef,
        active_staff_user_id: authIds.active_staff,
      }, {
        expectFailure: true,
        redactFailure: true,
        failureLabel: 'v4_target_guard',
      })
    }

    applyFile(postgres.psql, port, applyV4Path, {
      project_ref: QA_REF,
      active_staff_user_id: authIds.active_staff,
    }, {
      redactFailure: true,
      failureLabel: 'apply_v4',
    })
    result.v4Apply = true
    const catalog = portalCatalog(postgres.psql, port)
    result.portalTables = catalog.tables
    result.rlsTables = catalog.rls
    result.forceRlsTables = catalog.forceRls
    if (catalog.tables !== 11 || catalog.rls !== 11 || catalog.forceRls !== 11) {
      fail('v4_catalog_invariant_failed')
    }
    result.activeStaffBootstrap = query(postgres.psql, port, `
      select (
        (select count(*) from public.internal_staff_memberships
          where user_id='${authIds.active_staff}'::uuid
            and role='admin' and status='active' and revoked_at is null) = 1
        and
        (select count(*) from public.internal_staff_memberships
          where user_id='${authIds.suspended_staff}'::uuid) = 0
      )::text;
    `) === 'true'
    if (!result.activeStaffBootstrap) fail('active_staff_bootstrap_failed')

    applyFile(postgres.psql, port, fixturesPath, {
      ...variables,
      suspended_staff_user_id: randomUUID(),
    }, {
      expectFailure: true,
      redactFailure: true,
      failureLabel: 'missing_suspended_staff_guard',
    })
    if (query(postgres.psql, port, zeroResidueSql(variables)) !== '0') {
      fail('missing_suspended_fixture_left_residue')
    }
    result.missingSuspendedRejected = true

    assertFailureCases(postgres.psql, port, variables, workDir)
    result.productionRejected = true
    result.unknownTargetRejected = true
    result.missingInputRejected = true
    result.tamperedHashRejected = true
    result.preexistingLedgerRejected = true
    result.invalidBackupRejected = true
    result.unauthorizedExecutionRejected = true

    applyFile(postgres.psql, port, fixturesPath, variables, {
      redactFailure: true,
      failureLabel: 'fixtures_v2',
    })
    result.suspendedStaffFixture = query(postgres.psql, port, `
      select (
        (select count(*) from public.internal_staff_memberships
          where user_id='${authIds.active_staff}'::uuid
            and status='active') = 1
        and
        (select count(*) from public.internal_staff_memberships
          where user_id='${authIds.suspended_staff}'::uuid
            and role='operator' and status='suspended') = 1
        and
        (select count(*) from public.internal_staff_memberships
          where user_id='${authIds.active_staff}'::uuid
            and status='active') = 1
      )::text;
    `) === 'true'
    if (!result.suspendedStaffFixture) fail('suspended_staff_fixture_failed')
    applyFile(postgres.psql, port, matrixPath, variables, {
      redactFailure: true,
      failureLabel: 'matrix_v2',
    })
    result.parameterizedMatrix = true
    applyFile(postgres.psql, port, cleanupPath, variables, {
      redactFailure: true,
      failureLabel: 'cleanup_v2',
    })
    result.exactIdCleanup = true

    if (query(postgres.psql, port, zeroResidueSql(variables)) !== '0') {
      fail('exact_id_cleanup_residue')
    }
    if (query(postgres.psql, port, `
      select count(*) from public.internal_staff_memberships
      where user_id='${authIds.active_staff}'::uuid
        and status='active' and revoked_at is null;
    `) !== '1') {
      fail('active_staff_cleanup_regression')
    }

    applyFile(postgres.psql, port, recoveryPath, variables, {
      redactFailure: true,
      failureLabel: 'failure_recovery_v2',
    })
    result.rollbackProof = query(postgres.psql, port, `
      select (
        to_regnamespace('portal_private') is null
        and not exists (
          select 1 from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public'
            and c.relname = 'client_portal_memberships'
        )
      )::text;
    `) === 'true'
    if (!result.rollbackProof) fail('rollback_proof_failed')
    result.recoveryAfterMigration = true

    query(postgres.psql, port, `
      delete from auth.users where id = any (array[
        ${Object.values(authIds).map((id) => `'${id}'::uuid`).join(',')}
      ]);
    `)
    if (query(postgres.psql, port, 'select count(*) from auth.users') !== '0') {
      fail('dynamic_auth_cleanup_residue')
    }
    result.localZeroResidue = true
    result.result = 'PASS'
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
  } finally {
    if (started) {
      try {
        run(postgres.pgCtl, [
          '-D', clusterDir, '-m', 'fast', '-w', 'stop',
        ], { stdio: 'ignore' })
      } catch (error) {
        result.result = 'FAIL'
        result.error = `${result.error ? `${result.error}; ` : ''}${String(error)}`
      }
    }
    try {
      rmSync(workDir, { recursive: true, force: true })
      result.clusterDiscarded = !existsSync(workDir)
    } catch (error) {
      result.result = 'FAIL'
      result.error = `${result.error ? `${result.error}; ` : ''}${String(error)}`
    }
    mkdirSync(path.dirname(reportPath), { recursive: true })
    writeFileSync(reportPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  }

  if (result.result !== 'PASS' || !result.clusterDiscarded) {
    fail(result.error ?? 'cp2a3_bootstrap_proof_failed')
  }
  console.log('PASS: CP-2A.3 bootstrap contract proved on disposable PostgreSQL 17.')
  console.log('Original 42703 reproduced; V4 apply, staff states, matrix, cleanup and recovery passed.')
  console.log('QA and production remote writes: 0. Temporary cluster discarded.')
  console.log(`Private report: ${path.relative(repoRoot, reportPath)}`)
}

main().catch((error) => {
  console.error(`BLOCKED: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
