import { createHash, randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  AUTHORIZATION_ID_V5,
  assertAuthorizationV5,
  executeV5Core,
  parseEnvelopeV5,
  requiredCapabilityGapsV5,
  validateCapabilityEvidenceV5,
  verifyPackageManifestV5,
} from './run-cp3b2a-qa-v5.mjs'
import {
  parseEnvelopeV3,
  parseSingleJsonV3,
  validateDetailedPostcheckV3,
  verifyPackageManifestV3,
} from './run-cp3b2a-qa-v3.mjs'
import {
  validatePoststateV2,
  validatePrestateV2,
  verifyPackageManifestV2,
} from './run-cp3b2a-qa-v2.mjs'
import { runConcurrencyV5 } from './cp3b2a_qa_concurrency_v5.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const scriptsDir = path.join(repoRoot, 'scripts', 'client-portal')
const migrationsDir = path.join(repoRoot, 'supabase', 'migrations')
const reportPath = path.join(
  repoRoot,
  'qa-reports',
  'private',
  'client-portal',
  'cp3b2a5-local-proof-latest.json',
)
const QA_REF = 'kpvvydthlxupjjqqdpxy'
const PRODUCTION_REF = 'wfxnwfcdjainpojhbdri'
const baselineOrder = [
  '20260721_qa_baseline_schema.sql',
  '20260707_fix_same_number_invoice_update_gap.sql',
  '20260721_rls_clients_properties_jobs_write_fix.sql',
  '20260722_close_anon_read_policies_qa_verified.sql',
  '20260722171428_public_quiz_providerless_abuse_protection.sql',
]
const migrationPath = path.join(
  migrationsDir,
  '20260728160000_portal_reviewed_change_contract.sql',
)
const cp2bMigrationPath = path.join(
  migrationsDir,
  '20260723160000_client_portal_security_boundary.sql',
)
const cp3b0MigrationPath = path.join(
  migrationsDir,
  '20260728120000_portal_self_access_context.sql',
)
const precheckPath = path.join(scriptsDir, 'cp3b2a_qa_precheck_v3.sql')
const postcheckStatePath = path.join(scriptsDir, 'cp3b2a_qa_postcheck_v2.sql')
const postcheckDetailPath = path.join(scriptsDir, 'cp3b2a_qa_postcheck_v3.sql')
const matrixV5Path = path.join(scriptsDir, 'cp3b2a_qa_matrix_v5.sql')
const capabilityMapPath = path.join(scriptsDir, 'cp3b2a_qa_capability_map_v5.json')
const rollbackPath = path.join(scriptsDir, 'cp3b2a_qa_rollback_v3.sql')

function fail(code) {
  throw new Error(code)
}

function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    timeout: options.timeout ?? 180_000,
    maxBuffer: 60 * 1024 * 1024,
    ...options,
  })
  if (result.error || result.status !== 0) {
    const detail = options.redactFailure
      ? 'redacted'
      : [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    fail(`command_failed:${options.label ?? path.basename(executable)}:${detail}`)
  }
  return String(result.stdout ?? '').trim()
}

function assertLocalOnly() {
  const remoteEnvironment = Object.entries(process.env)
    .filter(([name]) => /(DATABASE|POSTGRES|SUPABASE|PGHOST|PGURL|PROJECT_REF)/iu.test(name))
    .map(([, value]) => value ?? '')
    .join('\n')
  if (remoteEnvironment.includes(QA_REF) || remoteEnvironment.includes(PRODUCTION_REF)) {
    fail('remote_environment_rejected')
  }
}

function postgresTools() {
  const bin = process.env.CP3B2A_PG_BIN
    ?? (process.platform === 'win32' ? 'C:\\Program Files\\PostgreSQL\\17\\bin' : '')
  const executable = (name) => process.platform === 'win32'
    ? path.join(bin, `${name}.exe`)
    : name
  const tools = {
    initdb: executable('initdb'),
    pgCtl: executable('pg_ctl'),
    psql: executable('psql'),
  }
  if (process.platform === 'win32' && !Object.values(tools).every(existsSync)) {
    fail('postgresql_17_tools_unavailable')
  }
  return tools
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close((error) => error ? reject(error) : resolve(port))
    })
  })
}

function connectionArgs(port) {
  return [
    '-X', '-h', '127.0.0.1', '-p', String(port), '-U', 'postgres',
    '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose',
  ]
}

function query(psql, port, sql) {
  return run(psql, [...connectionArgs(port), '-Atq'], { input: sql })
}

function applyFile(psql, port, filePath, variables = {}, capture = false) {
  const args = [...connectionArgs(port), capture ? '-Atq' : '-q']
  for (const [name, value] of Object.entries(variables)) args.push('-v', `${name}=${value}`)
  args.push('-f', filePath)
  return run(psql, args, { label: path.basename(filePath) })
}

function setupSql() {
  return String.raw`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (
      id uuid primary key,
      email text,
      email_confirmed_at timestamptz,
      created_at timestamptz default clock_timestamp(),
      updated_at timestamptz default clock_timestamp()
    );
    create function auth.uid()
    returns uuid language sql stable set search_path=pg_catalog
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    insert into auth.users(id,email,email_confirmed_at)
    values (
      '10000000-0000-4000-8000-000000000001',
      'cp3b2a5-staff@example.invalid',
      clock_timestamp()
    );
    create schema storage;
    create table storage.buckets (
      id text primary key, name text not null, public boolean not null default false,
      file_size_limit bigint, allowed_mime_types text[]
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text not null references storage.buckets(id) on delete cascade,
      name text not null, owner uuid
    );
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated, service_role;
    grant select, insert, update, delete on storage.objects to authenticated;
    grant all on storage.objects, storage.buckets to service_role;
    insert into storage.buckets(id,name,public)
    values ('expense-receipts','expense-receipts',false);
    create policy "Allow authenticated read expense receipts"
    on storage.objects for select to authenticated
    using (bucket_id='expense-receipts');
    create schema supabase_migrations;
    create table supabase_migrations.schema_migrations (
      version text primary key, name text not null, statements text[]
    );
    insert into supabase_migrations.schema_migrations(version,name,statements)
    values ('20260700000000','synthetic_local_baseline',array[]::text[]);
  `
}

function historicalRowsSql() {
  return String.raw`
    set session_replication_role=replica;
    insert into public.clients(
      id,full_name,phone,email,tax_id,billing_address,status,display_code
    ) values (
      'CP3B2A-V5-HIST-CLIENT','QA Synthetic Historical','+34900000000',
      'historical-v5@example.invalid','HIST-V5','Historical','active','HIST-V5-CLIENT'
    );
    insert into public.properties(
      id,client_id,name,property_type,address,city,postal_code,status,display_code
    ) values (
      'CP3B2A-V5-HIST-PROPERTY','CP3B2A-V5-HIST-CLIENT',
      'QA Synthetic Historical Property','home','Historical',
      'Barcelona','08000','active','HIST-V5-PROPERTY'
    );
    insert into public.client_portal_profile_change_requests(
      client_id,requested_by,proposed_changes
    ) values (
      'CP3B2A-V5-HIST-CLIENT','10000000-0000-4000-8000-000000000001',
      '{"phone":"+34900000001"}'
    );
    insert into public.client_portal_property_change_requests(
      client_id,property_id,requested_by,proposed_changes
    ) values (
      'CP3B2A-V5-HIST-CLIENT','CP3B2A-V5-HIST-PROPERTY',
      '10000000-0000-4000-8000-000000000001','{"city":"Badalona"}'
    );
    set session_replication_role=origin;
  `
}

function comparePrestate(before, after) {
  for (const key of [
    'profileRows', 'propertyRows', 'profileDigest', 'propertyDigest',
    'canonicalDigest', 'financialSequenceDigest', 'authUserCount', 'authDigest',
    'tableGrantDigest', 'unaffectedPolicyDigest', 'unaffectedFunctionDigest',
    'migrationHistoryCount', 'migrationHistoryDigest',
  ]) {
    if (before[key] !== after[key]) fail(`recovery_drift:${key}`)
  }
}

function localLivePrestate(psql, port, runId) {
  let prestate
  try {
    const v2RunId = `CP3B2A-V2-${runId.slice(-12)}`
    prestate = parseSingleJsonV3(applyFile(
      psql,
      port,
      precheckPath,
      {
        project_ref: QA_REF,
        run_id: runId,
        v2_run_id: v2RunId,
      },
      true,
    ))
  } catch (error) {
    fail(`local_prestate_capture:${error instanceof Error ? error.message : 'unknown'}`)
  }
  try {
    Object.assign(prestate, JSON.parse(query(psql, port, `
    select jsonb_build_object(
      'auditRows', (select count(*) from public.client_portal_audit_events),
      'auditDigest', (select md5(coalesce(string_agg(to_jsonb(r)::text, '|' order by r.id), ''))
        from public.client_portal_audit_events r),
      'rateRows', (select count(*) from public.client_portal_rate_limits),
      'rateDigest', (select md5(coalesce(string_agg(
        to_jsonb(r)::text, '|' order by r.action,r.subject_hash,r.window_started_at
      ), '')) from public.client_portal_rate_limits r)
    )::text;
    `)))
  } catch (error) {
    fail(`local_operational_capture:${error instanceof Error ? error.message : 'unknown'}`)
  }
  validatePrestateV2(prestate)
  return { prestate, boundaryDigest: 'local-disposable-boundary' }
}

function localPostcheck(psql, port, prestate) {
  validatePoststateV2(
    prestate,
    parseSingleJsonV3(applyFile(psql, port, postcheckStatePath, {}, true)),
  )
  validateDetailedPostcheckV3(parseEnvelopeV3(
    applyFile(psql, port, postcheckDetailPath, {}, true),
    'postcheck',
  ))
}

function localOperations({ psql, port, runId, baseline, capabilityMap }) {
  const databaseUrl = `postgresql://postgres@127.0.0.1:${port}/postgres`
  return {
    verifyManifest: () => ({ status: 'PREPARED_NOT_AUTHORIZED' }),
    authorize: () => ({ gitState: { head: 'local', remoteHead: 'local' } }),
    assertClean: () => true,
    assertQaTarget: () => true,
    assertProductionRejected: () => true,
    verifyBackup: () => structuredClone(baseline),
    readGuardState: () => localLivePrestate(psql, port, runId).prestate,
    assertContractAbsent: (guard) => validatePrestateV2(guard),
    assertPartialStateAbsent: (guard) => {
      if (
        guard.targetFunctionCount !== 0
        || guard.targetColumnCount !== 0
        || guard.targetConstraintCount !== 0
        || guard.targetIndexCount !== 0
      ) fail('local_partial_state')
    },
    assertSyntheticCollisionAbsent: (guard) => {
      if (guard.syntheticCollisions !== 0) fail('local_collision')
    },
    readLivePrestate: () => localLivePrestate(psql, port, runId),
    compareBackupLive: (backup, live) => {
      comparePrestate(backup.prestate, live.prestate)
    },
    createLedger: () => 'local-ledger',
    readDriftSentinel: () => localLivePrestate(psql, port, runId),
    compareDriftSentinel: (before, after) => comparePrestate(
      before.prestate,
      after.prestate,
    ),
    markApplyStarted: () => true,
    apply: () => applyFile(psql, port, migrationPath),
    postcheck: (state) => localPostcheck(psql, port, state.prestate),
    transactionalMatrix: () => parseEnvelopeV5(
      applyFile(psql, port, matrixV5Path, {
        project_ref: QA_REF,
        v3_run_id: `CP3B2A-V3-${runId.slice(-12)}`,
        v4_run_id: `CP3B2A-V4-${runId.slice(-12)}`,
        v5_run_id: runId,
      }, true),
      'transactional_matrix_complete',
    ),
    concurrentMatrix: (_state, onStage) => runConcurrencyV5({
      databaseUrl,
      runId,
      allowLocal: true,
      onStage,
    }),
    validateCapabilities: (transactional, concurrent) => (
      validateCapabilityEvidenceV5(capabilityMap, transactional, concurrent)
    ),
    finalPostcheck: (state) => localPostcheck(psql, port, state.prestate),
    finalDigestComparison: (state) => localPostcheck(psql, port, state.prestate),
    completeLedger: () => true,
    handleFailure: (error) => {
      throw error
    },
  }
}

async function proveP1FailureInjections(capabilityMap) {
  const transactionalIds = capabilityMap.capabilities
    .filter((entry) => entry[1] === 'transactional_matrix_complete')
    .map((entry) => entry[2])
  const concurrentIds = capabilityMap.capabilities
    .filter((entry) => entry[1] === 'concurrent_matrix')
    .map((entry) => entry[2])
  const makeOperations = (failure) => {
    const counters = {
      apply: 0,
      cleanup: 0,
      recovery: 0,
      rollbackDdl: 0,
      automaticRetries: 0,
      failureState: null,
    }
    const injectedFailure = (stage, detail = undefined) => {
      const error = new Error(`injected_${stage}_failure`)
      if (detail) error.detail = detail
      throw error
    }
    const confirmedCleanup = (onStage) => {
      onStage('fixture_cleanup')
      counters.cleanup += 1
      onStage('fixture_cleanup_confirmed')
    }
    const operations = {
      verifyManifest: () => true,
      authorize: () => true,
      assertClean: () => true,
      assertQaTarget: () => true,
      assertProductionRejected: () => true,
      verifyBackup: () => ({ prestate: { marker: 'same' } }),
      readGuardState: () => ({ syntheticCollisions: 0 }),
      assertContractAbsent: () => true,
      assertPartialStateAbsent: () => true,
      assertSyntheticCollisionAbsent: () => true,
      readLivePrestate: () => ({ prestate: { marker: 'same' } }),
      compareBackupLive: () => {
        if (failure === 'backup') throw new Error('backup_live_mismatch')
      },
      createLedger: () => 'ledger',
      readDriftSentinel: () => ({ prestate: { marker: 'same' } }),
      compareDriftSentinel: () => {
        if (failure === 'drift') throw new Error('drift_sentinel_mismatch')
      },
      markApplyStarted: () => true,
      apply: () => {
        counters.apply += 1
        if (failure === 'apply') injectedFailure('apply')
      },
      postcheck: () => {
        if (failure === 'postcheck' || failure === 'recovery') {
          injectedFailure('postcheck')
        }
        return true
      },
      transactionalMatrix: () => {
        if (failure === 'transactional') injectedFailure('transactional')
        return {
          assertionIds: transactionalIds,
          result: 'PASS',
          transaction: 'ROLLED_BACK',
        }
      },
      concurrentMatrix: (_state, onStage) => {
        onStage('fixture_transaction_started')
        if (failure === 'fixture_begin') injectedFailure('fixture_begin')
        onStage('fixture_commit_requested')
        if (failure === 'commit_not_applied') {
          injectedFailure('fixture_commit_not_applied', {
            commitState: 'COMMIT_NOT_APPLIED',
          })
        }
        if (['ambiguous', 'observer_timeout', 'partial'].includes(failure)) {
          injectedFailure(`fixture_${failure}`, {
            recovery: 'MANUAL_VERIFICATION_REQUIRED',
            commitState: 'COMMIT_AMBIGUOUS',
          })
        }
        onStage('fixture_commit_confirmed_by_observer')
        if (failure === 'commit_confirmed') {
          onStage('concurrent_matrix')
          confirmedCleanup(onStage)
          injectedFailure('fixture_commit_confirmed')
        }
        onStage('concurrent_matrix')
        if (failure === 'concurrent_retry' || failure === 'concurrent_conflict') {
          confirmedCleanup(onStage)
          injectedFailure(failure)
        }
        onStage('fixture_cleanup')
        counters.cleanup += 1
        if (failure === 'cleanup') {
          injectedFailure('fixture_cleanup_unverifiable', {
            recovery: 'MANUAL_VERIFICATION_REQUIRED',
            commitState: 'CLEANUP_STARTED',
          })
        }
        onStage('fixture_cleanup_confirmed')
        return {
          assertionIds: concurrentIds,
          result: 'PASS',
          cleanup: 'PASS_CLEANED',
        }
      },
      validateCapabilities: (transactional, concurrent) => (
        validateCapabilityEvidenceV5(capabilityMap, transactional, concurrent)
      ),
      finalPostcheck: () => true,
      finalDigestComparison: () => {
        if (failure === 'final_digest') injectedFailure('final_digest')
        return true
      },
      completeLedger: () => true,
      handleFailure: (error, state) => {
        counters.failureState = structuredClone(state)
        if (error?.detail?.recovery === 'MANUAL_VERIFICATION_REQUIRED') {
          error.manual = true
          throw error
        }
        if (counters.apply === 0) {
          error.blockedBeforeEffects = true
          throw error
        }
        counters.recovery += 1
        if (failure === 'recovery') {
          error.recoveryFailure = new Error('injected_recovery_failure')
          throw error
        }
        error.recovered = true
        throw error
      },
    }
    return { operations, counters }
  }
  const beforeApply = new Set(['backup', 'drift'])
  const manual = new Set(['ambiguous', 'observer_timeout', 'partial', 'cleanup'])
  const cleanupExpected = new Set([
    'commit_confirmed',
    'concurrent_retry',
    'concurrent_conflict',
    'cleanup',
    'final_digest',
  ])
  const failures = [
    'backup',
    'drift',
    'apply',
    'postcheck',
    'transactional',
    'fixture_begin',
    'commit_confirmed',
    'commit_not_applied',
    'ambiguous',
    'observer_timeout',
    'partial',
    'concurrent_retry',
    'concurrent_conflict',
    'cleanup',
    'final_digest',
    'recovery',
  ]
  for (const failure of failures) {
    const injected = makeOperations(failure)
    let error
    try {
      await executeV5Core({
        operations: injected.operations,
        runId: 'CP3B2A-V5-ABCDEF123456',
      })
    } catch (caught) {
      error = caught
    }
    if (!error) fail(`failure_injection_not_observed:${failure}`)
    if (beforeApply.has(failure)) {
      if (
        injected.counters.apply !== 0
        || injected.counters.recovery !== 0
        || error.blockedBeforeEffects !== true
      ) {
        fail(`${failure}_pre_effect_boundary_failed`)
      }
    } else if (manual.has(failure)) {
      if (
        injected.counters.apply !== 1
        || injected.counters.recovery !== 0
        || error.manual !== true
        || injected.counters.rollbackDdl !== 0
      ) {
        fail(`${failure}_manual_boundary_failed`)
      }
    } else if (
      injected.counters.apply !== 1
      || injected.counters.recovery !== 1
      || (failure !== 'recovery' && error.recovered !== true)
    ) {
      fail(`${failure}_single_recovery_boundary_failed`)
    }
    if (
      ['fixture_begin', 'commit_not_applied', 'ambiguous', 'observer_timeout', 'partial']
        .includes(failure)
      && injected.counters.cleanup !== 0
    ) {
      fail(`${failure}_unexpected_cleanup`)
    }
    if (cleanupExpected.has(failure) && injected.counters.cleanup !== 1) {
      fail(`${failure}_confirmed_cleanup_missing`)
    }
    if (
      failure === 'apply'
      && (
        injected.counters.failureState?.applyStarted !== true
        || injected.counters.failureState?.applyCommitted !== false
      )
    ) {
      fail('apply_ambiguity_state_not_preserved')
    }
    if (
      failure === 'recovery'
      && (
        error.message !== 'injected_postcheck_failure'
        || error.recoveryFailure?.message !== 'injected_recovery_failure'
      )
    ) {
      fail('primary_and_recovery_failure_not_separated')
    }
    if (injected.counters.automaticRetries !== 0) {
      fail(`${failure}_automatic_retry_detected`)
    }
  }
  return true
}

function proveAuthorizationGuards() {
  const head = 'a'.repeat(40)
  const base = {
    CP3B2A_V5_EXECUTION_AUTHORIZED: 'true',
    CP3B2A_PROJECT_REF: QA_REF,
    CP3B2A_V5_AUTHORIZATION_ID: AUTHORIZATION_ID_V5,
    CP3B2A_V5_AUTHORIZED_HEAD: head,
    CP3B2A_PRIVATE_BACKUP_MANIFEST: 'private',
  }
  const state = { head, remoteHead: head }
  assertAuthorizationV5(base, state)
  for (const mutation of [
    { CP3B2A_V5_AUTHORIZATION_ID: 'CP3B2A-QA-V3-AUTHORIZATION-PENDING' },
    { CP3B2A_V5_AUTHORIZED_HEAD: 'b'.repeat(40) },
    { CP3B2A_PROJECT_REF: PRODUCTION_REF },
    { CP3B2A_V3_EXECUTION_AUTHORIZED: 'true' },
    { CP3B2A_V1_AUTHORIZATION_ID: 'CP3B2A-QA-V1-AUTHORIZATION-STALE' },
  ]) {
    let rejected = false
    try {
      assertAuthorizationV5({ ...base, ...mutation }, state)
    } catch {
      rejected = true
    }
    if (!rejected) fail('authorization_guard_missing')
  }
  let missingBackupRejected = false
  try {
    assertAuthorizationV5(
      { ...base, CP3B2A_PRIVATE_BACKUP_MANIFEST: '' },
      state,
    )
  } catch {
    missingBackupRejected = true
  }
  if (!missingBackupRejected) fail('missing_backup_reference_guard')
}

async function proveUnexpectedInventoryObserver(psql, port, runId) {
  let inventory
  let rejected = false
  let observerRanAfterCommit = false
  try {
    await runConcurrencyV5({
      databaseUrl: `postgresql://postgres@127.0.0.1:${port}/postgres`,
      runId,
      allowLocal: true,
      onInventory: (value) => {
        inventory = value
      },
      observeCommittedFixture: ({ observe }) => {
        const committed = Number(query(psql, port, `
          select count(*) from public.clients
          where id='${runId}-CLIENT';
        `))
        if (committed !== 1) fail('post_commit_observer_ran_before_commit')
        observerRanAfterCommit = true
        query(psql, port, `
          insert into public.clients(
            id,full_name,phone,email,tax_id,billing_address,status,display_code
          ) values (
            '${runId}-UNEXPECTED','QA Synthetic Unexpected','+34900000499',
            '${runId.toLowerCase()}-unexpected@example.invalid',
            '${runId}-UNEXPECTED-TAX','QA Synthetic Unexpected',
            'active','${runId}-UNEXPECTED'
          );
        `)
        return observe()
      },
    })
  } catch (error) {
    rejected = error?.code === 'V5_FIXTURE_COMMIT_AMBIGUOUS'
      && error?.detail?.recovery === 'MANUAL_VERIFICATION_REQUIRED'
  }
  if (!rejected || !observerRanAfterCommit || !inventory) {
    fail('post_commit_ambiguous_observer_not_fail_closed')
  }
  const preserved = JSON.parse(query(psql, port, `
    select jsonb_build_object(
      'authUsers',(select count(*) from auth.users
        where id='${inventory.userId}'::uuid),
      'clients',(select count(*) from public.clients
        where id in ('${inventory.clientId}','${runId}-UNEXPECTED')),
      'properties',(select count(*) from public.properties
        where id='${inventory.propertyId}'),
      'memberships',(select count(*) from public.client_portal_memberships
        where id='${inventory.membershipId}'::uuid),
      'contractPresent',to_regprocedure(
        'public.portal_submit_profile_change_request_v2(text,jsonb,uuid)'
      ) is not null
    )::text;
  `))
  if (
    preserved.authUsers !== 1
    || preserved.clients !== 2
    || preserved.properties !== 1
    || preserved.memberships !== 1
    || preserved.contractPresent !== true
  ) fail('post_commit_ambiguous_state_was_mutated')
  const profileHash = createHash('sha256')
    .update(`profile_change_v2:${inventory.userId}:${inventory.clientId}`).digest('hex')
  const propertyHash = createHash('sha256')
    .update(`property_change_v2:${inventory.userId}:${inventory.clientId}`).digest('hex')
  query(psql, port, `
    begin;
    delete from public.client_portal_audit_events
      where actor_user_id='${inventory.userId}'::uuid;
    delete from public.client_portal_rate_limits
      where subject_hash in (
        '${profileHash}',
        '${propertyHash}'
      );
    delete from public.client_portal_property_change_requests
      where requested_by='${inventory.userId}'::uuid;
    delete from public.client_portal_profile_change_requests
      where requested_by='${inventory.userId}'::uuid;
    delete from public.client_portal_memberships
      where id='${inventory.membershipId}'::uuid;
    delete from public.properties where id='${inventory.propertyId}';
    delete from public.clients
      where id in ('${inventory.clientId}','${runId}-UNEXPECTED');
    set local session_replication_role=replica;
    delete from auth.users where id='${inventory.userId}'::uuid;
    set local session_replication_role=origin;
    commit;
  `)
  const residue = Number(query(psql, port, `
    select
      (select count(*) from auth.users where id='${inventory.userId}'::uuid)
      +(select count(*) from public.clients where id like '${runId}-%')
      +(select count(*) from public.properties where id like '${runId}-%')
      +(select count(*) from public.client_portal_memberships
        where user_id='${inventory.userId}'::uuid);
  `))
  if (residue !== 0) fail('unexpected_fixture_observer_residue')
  return true
}

async function main() {
  assertLocalOnly()
  verifyPackageManifestV2()
  verifyPackageManifestV3()
  verifyPackageManifestV5()
  proveAuthorizationGuards()
  const capabilityMap = JSON.parse(readFileSync(capabilityMapPath, 'utf8'))
  const allByStage = Object.fromEntries(
    ['transactional_matrix_complete', 'concurrent_matrix'].map((stage) => [
      stage,
      new Set(
        capabilityMap.capabilities
          .filter((entry) => entry[1] === stage)
          .map((entry) => entry[2]),
      ),
    ]),
  )
  if (requiredCapabilityGapsV5(capabilityMap, allByStage).length !== 0) {
    fail('v5_capability_contract_incomplete')
  }
  const v4Source = readFileSync(
    path.join(scriptsDir, 'run-cp3b2a-qa-v4.mjs'),
    'utf8',
  )
  const v4Concurrency = readFileSync(
    path.join(scriptsDir, 'cp3b2a_qa_concurrency_v4.mjs'),
    'utf8',
  )
  if (
    !/fixture\s*=\s*createFixture/u.test(v4Concurrency)
    || !/if\s*[(]fixture[)]/u.test(v4Concurrency)
    || /matrix_v3[.]sql/u.test(v4Source)
    || /compareBackupLivePrestate/u.test(v4Source)
  ) fail('v4_three_p1_negative_control_not_proven')

  const tools = postgresTools()
  const workDir = mkdtempSync(path.join(tmpdir(), 'costa-clean-cp3b2a5-'))
  const clusterDir = path.join(workDir, 'cluster')
  const logPath = path.join(workDir, 'postgres.log')
  const cp2bApplyPath = path.join(workDir, 'cp2b-apply.sql')
  const port = await reservePort()
  const runId = `CP3B2A-V5-${randomBytes(6).toString('hex').toUpperCase()}`
  const secondRunId = `CP3B2A-V5-${randomBytes(6).toString('hex').toUpperCase()}`
  const observerRunId = `CP3B2A-V5-${randomBytes(6).toString('hex').toUpperCase()}`
  let started = false
  const result = {
    gate: 'CP-3B.2A.5',
    postgresMajor: null,
    frozenHashes: 'NOT_RUN',
    v3NegativeControl: 'PASS',
    authorizationGuards: 'PASS',
    transactionalMatrix: 'NOT_RUN',
    concurrentMatrix: 'NOT_RUN',
    separateSessions: 'NOT_RUN',
    barrier: 'NOT_RUN',
    retry: 'NOT_RUN',
    conflict: 'NOT_RUN',
    failureInjectionMatrix: 'NOT_RUN',
    unexpectedInventoryObserver: 'NOT_RUN',
    recoveryV5: 'NOT_RUN',
    reapplyV5: 'NOT_RUN',
    syntheticResidue: null,
    authResidue: null,
    auditResidue: null,
    rateResidue: null,
    automaticRetries: 0,
    remoteContacts: 0,
    result: 'FAIL',
  }
  try {
    await proveP1FailureInjections(capabilityMap)
    result.failureInjectionMatrix = 'PASS'
    run(tools.initdb, [
      '-D', clusterDir, '--username=postgres', '--auth=trust',
      '--encoding=UTF8', '--no-locale',
    ])
    run(tools.pgCtl, [
      '-D', clusterDir, '-l', logPath,
      '-o', `-F -p ${port} -h 127.0.0.1`, '-w', 'start',
    ], { stdio: 'ignore' })
    started = true
    result.postgresMajor = Number(query(
      tools.psql,
      port,
      "select current_setting('server_version_num')::integer/10000",
    ))
    if (result.postgresMajor !== 17) fail('postgres_major_rejected')
    query(tools.psql, port, setupSql())
    for (const migration of baselineOrder) {
      applyFile(tools.psql, port, path.join(migrationsDir, migration))
    }
    query(tools.psql, port, `
      grant all on all tables in schema public to service_role;
      grant usage,select on all sequences in schema public to service_role;
    `)
    writeFileSync(cp2bApplyPath, [
      'create temp table cp2a_bootstrap_staff (',
      'user_id uuid primary key, role text not null);',
      "insert into cp2a_bootstrap_staff values ('10000000-0000-4000-8000-000000000001','owner');",
      readFileSync(cp2bMigrationPath, 'utf8'),
    ].join('\n'), 'utf8')
    applyFile(tools.psql, port, cp2bApplyPath)
    applyFile(tools.psql, port, cp3b0MigrationPath)
    query(tools.psql, port, historicalRowsSql())

    const baseline = localLivePrestate(tools.psql, port, runId)
    const first = await executeV5Core({
      operations: localOperations({
        psql: tools.psql,
        port,
        runId,
        baseline,
        capabilityMap,
      }),
      runId,
    })
    if (
      first.verdict !== 'PASS'
      || first.transactionalMatrix !== 'PASS_ROLLED_BACK'
      || first.concurrentMatrix !== 'PASS_CLEANED'
    ) fail('execute_v5_core_local_failed')
    result.frozenHashes = 'V1_V2_V3_V4_V5_AND_MIGRATION_PASS'
    result.transactionalMatrix = 'PASS_ROLLED_BACK'
    result.concurrentMatrix = 'PASS_CLEANED'
    result.separateSessions = 'PASS'
    result.barrier = 'PASS_TWO_UNGRANTED_ROW_EXCLUSIVE_LOCKS'
    result.retry = 'PASS_PROFILE_AND_PROPERTY'
    result.conflict = 'PASS_PROFILE_AND_PROPERTY'
    await proveUnexpectedInventoryObserver(tools.psql, port, observerRunId)
    result.unexpectedInventoryObserver =
      'PASS_POST_COMMIT_MANUAL_NO_CLEANUP_OR_DDL_RECOVERY'

    const rollbackOutput = applyFile(tools.psql, port, rollbackPath, {}, true)
    if (
      parseSingleJsonV3(rollbackOutput).result !== 'PASS'
      || parseEnvelopeV3(rollbackOutput, 'rollback').result !== 'PASS'
    ) fail('recovery_v5_failed')
    const restored = localLivePrestate(tools.psql, port, runId)
    comparePrestate(baseline.prestate, restored.prestate)
    result.recoveryV5 = 'PASS'

    const secondBaseline = localLivePrestate(tools.psql, port, secondRunId)
    const second = await executeV5Core({
      operations: localOperations({
        psql: tools.psql,
        port,
        runId: secondRunId,
        baseline: secondBaseline,
        capabilityMap,
      }),
      runId: secondRunId,
    })
    if (second.verdict !== 'PASS') fail('reapply_execute_v5_core_failed')
    result.reapplyV5 = 'PASS'

    applyFile(tools.psql, port, rollbackPath)
    const finalRestored = localLivePrestate(tools.psql, port, secondRunId)
    comparePrestate(baseline.prestate, finalRestored.prestate)
    const residue = query(tools.psql, port, `
      select jsonb_build_object(
        'synthetic',(
          (select count(*) from auth.users
            where email like '${runId.toLowerCase()}%@example.invalid'
               or email like '${secondRunId.toLowerCase()}%@example.invalid')
          +(select count(*) from public.clients
            where id like '${runId}%' or id like '${secondRunId}%')
          +(select count(*) from public.properties
            where id like '${runId}%' or id like '${secondRunId}%')
        ),
        'auth',(
          select count(*) from auth.users
          where email like '${runId.toLowerCase()}%@example.invalid'
             or email like '${secondRunId.toLowerCase()}%@example.invalid'
        ),
        'audit',(select count(*) from public.client_portal_audit_events),
        'rate',(select count(*) from public.client_portal_rate_limits)
      )::text;
    `)
    const counts = JSON.parse(residue)
    if (Object.values(counts).some((count) => count !== 0)) fail('final_residue_detected')
    result.syntheticResidue = 0
    result.authResidue = 0
    result.auditResidue = 0
    result.rateResidue = 0
    result.result = 'PASS'
  } finally {
    if (started) {
      try {
        run(tools.pgCtl, ['-D', clusterDir, '-m', 'fast', '-w', 'stop'], {
          stdio: 'ignore',
        })
      } catch {
        result.result = 'FAIL'
      }
    }
    rmSync(workDir, { recursive: true, force: true })
    mkdirSync(path.dirname(reportPath), { recursive: true })
    writeFileSync(reportPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  }
  if (result.result !== 'PASS') fail('cp3b2a5_local_proof_failed')
  console.log('PASS: CP-3B.2A.5 PostgreSQL 17 disposable proof completed.')
  console.log('Actual RPC denials, two-session barriers, retries and conflicts passed.')
  console.log('Recovery, reapply, frozen hashes and zero residue passed.')
  console.log('Zero automatic retries and zero remote contacts.')
}

main().catch((error) => {
  const stage = typeof error?.detail?.stage === 'string'
    ? `:${error.detail.stage}`
    : ''
  console.error(`BLOCKED: ${error instanceof Error ? error.message : 'unknown_error'}${stage}`)
  process.exitCode = 1
})
