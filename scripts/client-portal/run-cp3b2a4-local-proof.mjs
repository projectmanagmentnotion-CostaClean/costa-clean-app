import { randomBytes } from 'node:crypto'
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
  AUTHORIZATION_ID_V4,
  assertAuthorizationV4,
  parseEnvelopeV4,
  requiredCapabilityGapsV4,
  verifyPackageManifestV4,
} from './run-cp3b2a-qa-v4.mjs'
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
import { runConcurrencyV4 } from './cp3b2a_qa_concurrency_v4.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const scriptsDir = path.join(repoRoot, 'scripts', 'client-portal')
const migrationsDir = path.join(repoRoot, 'supabase', 'migrations')
const reportPath = path.join(
  repoRoot,
  'qa-reports',
  'private',
  'client-portal',
  'cp3b2a4-local-proof-latest.json',
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
const matrixV3Path = path.join(scriptsDir, 'cp3b2a_qa_matrix_v3.sql')
const matrixV4Path = path.join(scriptsDir, 'cp3b2a_qa_matrix_v4.sql')
const concurrencyV4Path = path.join(scriptsDir, 'cp3b2a_qa_concurrency_v4.mjs')
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
      'cp3b2a4-staff@example.invalid',
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
      'CP3B2A-V4-HIST-CLIENT','QA Synthetic Historical','+34900000000',
      'historical-v4@example.invalid','HIST-V4','Historical','active','HIST-V4-CLIENT'
    );
    insert into public.properties(
      id,client_id,name,property_type,address,city,postal_code,status,display_code
    ) values (
      'CP3B2A-V4-HIST-PROPERTY','CP3B2A-V4-HIST-CLIENT',
      'QA Synthetic Historical Property','home','Historical',
      'Barcelona','08000','active','HIST-V4-PROPERTY'
    );
    insert into public.client_portal_profile_change_requests(
      client_id,requested_by,proposed_changes
    ) values (
      'CP3B2A-V4-HIST-CLIENT','10000000-0000-4000-8000-000000000001',
      '{"phone":"+34900000001"}'
    );
    insert into public.client_portal_property_change_requests(
      client_id,property_id,requested_by,proposed_changes
    ) values (
      'CP3B2A-V4-HIST-CLIENT','CP3B2A-V4-HIST-PROPERTY',
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

function proveAuthorizationGuards() {
  const head = 'a'.repeat(40)
  const base = {
    CP3B2A_V4_EXECUTION_AUTHORIZED: 'true',
    CP3B2A_PROJECT_REF: QA_REF,
    CP3B2A_V4_AUTHORIZATION_ID: AUTHORIZATION_ID_V4,
    CP3B2A_V4_AUTHORIZED_HEAD: head,
    CP3B2A_PRIVATE_BACKUP_MANIFEST: 'private',
  }
  const state = { head, remoteHead: head }
  assertAuthorizationV4(base, state, () => true)
  for (const mutation of [
    { CP3B2A_V4_AUTHORIZATION_ID: 'CP3B2A-QA-V3-AUTHORIZATION-PENDING' },
    { CP3B2A_V4_AUTHORIZED_HEAD: 'b'.repeat(40) },
    { CP3B2A_PROJECT_REF: PRODUCTION_REF },
    { CP3B2A_V3_EXECUTION_AUTHORIZED: 'true' },
    { CP3B2A_V1_AUTHORIZATION_ID: 'CP3B2A-QA-V1-AUTHORIZATION-STALE' },
  ]) {
    let rejected = false
    try {
      assertAuthorizationV4({ ...base, ...mutation }, state, () => true)
    } catch {
      rejected = true
    }
    if (!rejected) fail('authorization_guard_missing')
  }
  let staleRejected = false
  try {
    assertAuthorizationV4(base, state, () => { throw new Error('stale') })
  } catch {
    staleRejected = true
  }
  if (!staleRejected) fail('stale_backup_guard_missing')
}

async function main() {
  assertLocalOnly()
  verifyPackageManifestV2()
  verifyPackageManifestV3()
  verifyPackageManifestV4()
  proveAuthorizationGuards()
  const v3Matrix = readFileSync(matrixV3Path, 'utf8')
  const v3Runner = readFileSync(
    path.join(scriptsDir, 'run-cp3b2a-qa-v3.mjs'),
    'utf8',
  )
  const v4Matrix = readFileSync(matrixV4Path, 'utf8')
  const v4Concurrency = readFileSync(concurrencyV4Path, 'utf8')
  if (requiredCapabilityGapsV4(v3Matrix, v3Runner).length < 5) {
    fail('v3_negative_control_not_proven')
  }
  if (requiredCapabilityGapsV4(v4Matrix, v4Concurrency).length !== 0) {
    fail('v4_capability_contract_incomplete')
  }

  const tools = postgresTools()
  const workDir = mkdtempSync(path.join(tmpdir(), 'costa-clean-cp3b2a4-'))
  const clusterDir = path.join(workDir, 'cluster')
  const logPath = path.join(workDir, 'postgres.log')
  const cp2bApplyPath = path.join(workDir, 'cp2b-apply.sql')
  const port = await reservePort()
  const runId = `CP3B2A-V4-${randomBytes(6).toString('hex').toUpperCase()}`
  const secondRunId = `CP3B2A-V4-${randomBytes(6).toString('hex').toUpperCase()}`
  let started = false
  const result = {
    gate: 'CP-3B.2A.4',
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
    recoveryV4: 'NOT_RUN',
    reapplyV4: 'NOT_RUN',
    syntheticResidue: null,
    authResidue: null,
    auditResidue: null,
    rateResidue: null,
    automaticRetries: 0,
    remoteContacts: 0,
    result: 'FAIL',
  }
  try {
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

    const variables = {
      project_ref: QA_REF,
      run_id: runId,
      v2_run_id: `CP3B2A-V2-${runId.slice(-12)}`,
    }
    const prestate = parseSingleJsonV3(
      applyFile(tools.psql, port, precheckPath, variables, true),
    )
    validatePrestateV2(prestate)
    applyFile(tools.psql, port, migrationPath)
    validatePoststateV2(
      prestate,
      parseSingleJsonV3(applyFile(
        tools.psql,
        port,
        postcheckStatePath,
        {},
        true,
      )),
    )
    validateDetailedPostcheckV3(parseEnvelopeV3(
      applyFile(tools.psql, port, postcheckDetailPath, {}, true),
      'postcheck',
    ))
    result.frozenHashes = 'V1_V2_V3_V4_AND_MIGRATION_PASS'

    const transactional = parseEnvelopeV4(
      applyFile(tools.psql, port, matrixV4Path, variables, true),
      'transactional_matrix',
    )
    if (
      transactional.result !== 'PASS'
      || transactional.transaction !== 'ROLLED_BACK'
      || transactional.anonActualRpcInvocations !== 4
      || transactional.noMembershipActualRpcInvocations !== 4
      || transactional.revokedMembershipActualRpcInvocations !== 4
      || transactional.suspendedMembershipActualRpcInvocations !== 4
      || transactional.invalidPayloadActualRpcInvocations !== 21
    ) fail('transactional_matrix_v4_failed')
    result.transactionalMatrix = 'PASS_ROLLED_BACK'

    const databaseUrl = `postgresql://postgres@127.0.0.1:${port}/postgres`
    const concurrent = await runConcurrencyV4({
      databaseUrl,
      runId,
      allowLocal: true,
    })
    if (
      concurrent.result !== 'PASS'
      || concurrent.cleanup !== 'PASS_CLEANED'
      || concurrent.races.length !== 4
      || concurrent.races.some(
        (race) => race.separateBackendCount !== 2 || race.barrierWaiters !== 2,
      )
    ) fail('concurrent_matrix_v4_failed')
    result.concurrentMatrix = 'PASS_CLEANED'
    result.separateSessions = 'PASS'
    result.barrier = 'PASS_TWO_UNGRANTED_ROW_EXCLUSIVE_LOCKS'
    result.retry = 'PASS_PROFILE_AND_PROPERTY'
    result.conflict = 'PASS_PROFILE_AND_PROPERTY'

    const rollbackOutput = applyFile(tools.psql, port, rollbackPath, {}, true)
    if (
      parseSingleJsonV3(rollbackOutput).result !== 'PASS'
      || parseEnvelopeV3(rollbackOutput, 'rollback').result !== 'PASS'
    ) fail('recovery_v4_failed')
    const restored = parseSingleJsonV3(
      applyFile(tools.psql, port, precheckPath, variables, true),
    )
    validatePrestateV2(restored)
    comparePrestate(prestate, restored)
    result.recoveryV4 = 'PASS'

    applyFile(tools.psql, port, migrationPath)
    const secondVariables = {
      project_ref: QA_REF,
      run_id: secondRunId,
      v2_run_id: `CP3B2A-V2-${secondRunId.slice(-12)}`,
    }
    const secondTransactional = parseEnvelopeV4(
      applyFile(tools.psql, port, matrixV4Path, secondVariables, true),
      'transactional_matrix',
    )
    if (secondTransactional.result !== 'PASS') fail('reapply_transactional_failed')
    const secondConcurrent = await runConcurrencyV4({
      databaseUrl,
      runId: secondRunId,
      allowLocal: true,
    })
    if (secondConcurrent.cleanup !== 'PASS_CLEANED') fail('reapply_concurrency_failed')
    result.reapplyV4 = 'PASS'

    applyFile(tools.psql, port, rollbackPath)
    const finalRestored = parseSingleJsonV3(
      applyFile(tools.psql, port, precheckPath, secondVariables, true),
    )
    validatePrestateV2(finalRestored)
    comparePrestate(prestate, finalRestored)
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
  if (result.result !== 'PASS') fail('cp3b2a4_local_proof_failed')
  console.log('PASS: CP-3B.2A.4 PostgreSQL 17 disposable proof completed.')
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
