import { createHash, randomBytes } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
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

const QA_REF = 'kpvvydthlxupjjqqdpxy'
const PRODUCTION_REF = 'wfxnwfcdjainpojhbdri'
const CP2B_MIGRATION = '20260723160000_client_portal_security_boundary.sql'
const CP3B0_MIGRATION = '20260728120000_portal_self_access_context.sql'
const CP3B2A_MIGRATION = '20260728160000_portal_reviewed_change_contract.sql'
const CP2B_SHA256 = 'ea10b4b3db30f6b27f60cd8fff6c8a7c711636e1d6ac439337966f5736cc6277'
const CP3B0_SHA256 = 'c6161ddb4d5d85e139aea98a47429feae21d20dd06c5e3d54b579f58c5468731'
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const migrationPath = path.join(repoRoot, 'supabase', 'migrations', CP3B2A_MIGRATION)
const cp2bPath = path.join(repoRoot, 'supabase', 'migrations', CP2B_MIGRATION)
const cp3b0Path = path.join(repoRoot, 'supabase', 'migrations', CP3B0_MIGRATION)
const reproducePath = path.join(
  repoRoot, 'scripts', 'client-portal', 'cp3b2a_reproduce_contract_gap.sql',
)
const matrixPath = path.join(
  repoRoot, 'scripts', 'client-portal', 'cp3b2a_reviewed_change_matrix.sql',
)
const reportPath = path.join(
  repoRoot, 'qa-reports', 'private', 'client-portal', 'cp3b2a-local-proof-latest.json',
)
const baselineOrder = [
  '20260721_qa_baseline_schema.sql',
  '20260707_fix_same_number_invoice_update_gap.sql',
  '20260721_rls_clients_properties_jobs_write_fix.sql',
  '20260722_close_anon_read_policies_qa_verified.sql',
  '20260722171428_public_quiz_providerless_abuse_protection.sql',
]
const syntheticUsers = [
  ['10000000-0000-4000-8000-000000000001', true],
  ['72000000-0000-4000-8000-000000000001', true],
  ['72000000-0000-4000-8000-000000000002', true],
  ['72000000-0000-4000-8000-000000000003', true],
  ['72000000-0000-4000-8000-000000000004', true],
  ['72000000-0000-4000-8000-000000000005', true],
  ['72000000-0000-4000-8000-000000000006', true],
  ['72000000-0000-4000-8000-000000000007', false],
]

function fail(message) {
  throw new Error(message)
}

function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
    timeout: 60_000,
    windowsHide: true,
    ...options,
  })
  if (result.error) fail(`${path.basename(executable)}:${result.error.message}`)
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    fail(`${path.basename(executable)} failed${detail ? `:\n${detail}` : ''}`)
  }
  return (result.stdout ?? '').trim()
}

function runAsync(executable, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: repoRoot,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk })
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve(stdout.trim())
      else reject(new Error(`concurrent_psql_failed:${stderr.trim()}`))
    })
  })
}

function runAsyncResult(executable, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: repoRoot,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk })
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => resolve({
      code,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    }))
  })
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

function assertLocalOnly() {
  const values = Object.entries(process.env)
    .filter(([name]) => /(DATABASE|POSTGRES|SUPABASE|PGHOST|PGURL|DB_URL|PROJECT_REF)/iu.test(name))
    .map(([, value]) => value ?? '')
    .join('\n')
  if (values.includes(QA_REF) || values.includes(PRODUCTION_REF)) fail('remote_target_rejected')
  const host = process.env.PGHOST?.trim().toLowerCase()
  if (host && !['127.0.0.1', 'localhost', '::1'].includes(host)) {
    fail('non_loopback_pg_host_rejected')
  }
}

function assertArtifacts() {
  for (const filePath of [cp2bPath, cp3b0Path, migrationPath, reproducePath, matrixPath]) {
    if (!existsSync(filePath)) fail(`missing:${path.relative(repoRoot, filePath)}`)
  }
  if (sha256(cp2bPath) !== CP2B_SHA256) fail('cp2b_frozen_hash_mismatch')
  if (sha256(cp3b0Path) !== CP3B0_SHA256) fail('cp3b0_frozen_hash_mismatch')
  const migration = readFileSync(migrationPath, 'utf8')
  if (!/^\s*begin;/iu.test(migration) || !/commit;\s*$/iu.test(migration)) {
    fail('migration_transaction_boundary_missing')
  }
  if (/supabase_migrations|alter\s+table\s+auth\.users/iu.test(migration)) {
    fail('forbidden_migration_scope')
  }
}

function findPostgres17() {
  const candidates = [
    process.env.CP3B2A_PG_BIN,
    process.platform === 'win32' ? 'C:\\Program Files\\PostgreSQL\\17\\bin' : undefined,
  ].filter(Boolean)
  for (const bin of candidates) {
    const executable = (name) => path.join(
      bin, process.platform === 'win32' ? `${name}.exe` : name,
    )
    const tools = {
      initdb: executable('initdb'),
      pgCtl: executable('pg_ctl'),
      psql: executable('psql'),
    }
    if (Object.values(tools).every(existsSync)) return tools
  }
  fail('postgresql_17_tools_unavailable')
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
    '-X', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', String(port),
    '-U', 'postgres', '-d', 'postgres',
  ]
}

function query(psql, port, sql) {
  return run(psql, [...connectionArgs(port), '-Atqc', sql])
}

function applyFile(psql, port, filePath) {
  run(psql, [...connectionArgs(port), '-f', filePath])
}

function writeSql(workDir, name, chunks) {
  const filePath = path.join(workDir, name)
  writeFileSync(filePath, `${chunks.join('\n\n')}\n`, 'utf8')
  return filePath
}

function setupSql() {
  const authRows = syntheticUsers.map(([id, confirmed], index) => (
    `('${id}'::uuid,'cp3b2a-${index + 1}@example.invalid',`
    + `${confirmed ? 'clock_timestamp()' : 'null'})`
  )).join(',\n')
  return `
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (
      id uuid primary key, email text, email_confirmed_at timestamptz
    );
    create function auth.uid() returns uuid language sql stable
    set search_path = pg_catalog
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    insert into auth.users(id,email,email_confirmed_at) values ${authRows};
    create schema storage;
    create table storage.buckets (
      id text primary key, name text not null, public boolean not null default false,
      file_size_limit bigint, allowed_mime_types text[]
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(), bucket_id text not null
      references storage.buckets(id) on delete cascade, name text not null, owner uuid
    );
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated, service_role;
    grant select, insert, update, delete on storage.objects to authenticated;
    grant all on storage.objects, storage.buckets to service_role;
    insert into storage.buckets(id,name,public)
      values ('expense-receipts','expense-receipts',false);
    create policy "Allow authenticated read expense receipts"
      on storage.objects for select to authenticated using (bucket_id='expense-receipts');
    create policy "Allow authenticated upload expense receipts"
      on storage.objects for insert to authenticated with check (bucket_id='expense-receipts');
    create policy "Allow authenticated update expense receipts"
      on storage.objects for update to authenticated using (bucket_id='expense-receipts')
      with check (bucket_id='expense-receipts');
    create policy "Allow authenticated delete expense receipts"
      on storage.objects for delete to authenticated using (bucket_id='expense-receipts');
  `
}

function cp2bBootstrapSql() {
  return `
    create temp table cp2a_bootstrap_staff (user_id uuid primary key, role text not null);
    insert into cp2a_bootstrap_staff values
      ('10000000-0000-4000-8000-000000000001','owner');
  `
}

function catalogSnapshot(psql, port) {
  return JSON.parse(query(psql, port, `
    select jsonb_build_object(
      'columns', (select count(*) from information_schema.columns
        where table_schema='public'
        and table_name in ('client_portal_profile_change_requests',
          'client_portal_property_change_requests')
        and column_name in ('idempotency_key','public_reference')),
      'indexes', (select count(*) from pg_indexes where schemaname='public'
        and indexname in ('client_portal_profile_change_v2_idempotency_uidx',
          'client_portal_property_change_v2_idempotency_uidx',
          'client_portal_profile_change_v2_public_reference_uidx',
          'client_portal_property_change_v2_public_reference_uidx')),
      'functions', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname in (
          'portal_submit_profile_change_request_v2',
          'portal_submit_property_change_request_v2',
          'portal_list_own_profile_change_requests_v2',
          'portal_list_own_property_change_requests_v2')),
      'customerPolicies', (select count(*) from pg_policies where schemaname='public'
        and policyname in ('Portal reads same-client profile requests',
          'Portal reads same-client property requests')),
      'legacyServiceGrants', (
        has_function_privilege('service_role',
          'public.portal_submit_profile_change_trusted(uuid,text,jsonb,text,uuid)','EXECUTE')::int
        + has_function_privilege('service_role',
          'public.portal_submit_property_change_trusted(uuid,text,text,jsonb,text,uuid)','EXECUTE')::int
      )
    );
  `))
}

function canonicalDigest(psql, port) {
  return query(psql, port, `
    select md5(
      coalesce((select string_agg(md5(row_to_json(t)::text),'|' order by t.id)
        from public.clients as t),'') || '#' ||
      coalesce((select string_agg(md5(row_to_json(t)::text),'|' order by t.id)
        from public.properties as t),'') || '#' ||
      coalesce((select string_agg(md5(row_to_json(t)::text),'|' order by t.id::text)
        from public.jobs as t),'') || '#' ||
      coalesce((select string_agg(md5(row_to_json(t)::text),'|' order by t.id::text)
        from public.invoices as t),'') || '#' ||
      coalesce((select string_agg(md5(row_to_json(t)::text),'|' order by t.id::text)
        from public.quotes as t),'') || '#' ||
      coalesce((select string_agg(md5(row_to_json(t)::text),'|' order by t.id::text)
        from public.payments as t),'') || '#' ||
      coalesce((select string_agg(
        sequencename||':'||coalesce(last_value::text,'null'),'|' order by sequencename)
        from pg_sequences where schemaname='public'
          and sequencename ~ '(invoice|payment|quote|closing|fiscal)'),'')
    );
  `)
}

function rollbackSql() {
  return `
    begin;
    do $rollback_guard$
    begin
      if exists (
        select 1 from public.client_portal_profile_change_requests
        where idempotency_key is not null or public_reference is not null
      ) or exists (
        select 1 from public.client_portal_property_change_requests
        where idempotency_key is not null or public_reference is not null
      ) then
        raise exception 'cp3b2a_rollback_requires_zero_v2_rows';
      end if;
    end;
    $rollback_guard$;
    drop function public.portal_submit_profile_change_request_v2(text,jsonb,uuid);
    drop function public.portal_submit_property_change_request_v2(text,text,jsonb,uuid);
    drop function public.portal_list_own_profile_change_requests_v2(text,integer);
    drop function public.portal_list_own_property_change_requests_v2(text,text,integer);
    drop function portal_private.reviewed_change_receipt_v2(text,text,timestamptz,jsonb,text);
    drop function portal_private.normalize_profile_change_v2(jsonb);
    drop function portal_private.normalize_property_change_v2(jsonb);
    create policy "Portal reads same-client profile requests"
      on public.client_portal_profile_change_requests for select to authenticated
      using (portal_private.has_active_portal_membership(auth.uid(), client_id));
    create policy "Portal reads same-client property requests"
      on public.client_portal_property_change_requests for select to authenticated
      using (portal_private.has_active_portal_membership(auth.uid(), client_id));
    grant execute on function
      public.portal_submit_profile_change_trusted(uuid,text,jsonb,text,uuid)
      to service_role;
    grant execute on function
      public.portal_submit_property_change_trusted(uuid,text,text,jsonb,text,uuid)
      to service_role;
    drop index public.client_portal_profile_change_v2_idempotency_uidx;
    drop index public.client_portal_property_change_v2_idempotency_uidx;
    drop index public.client_portal_profile_change_v2_public_reference_uidx;
    drop index public.client_portal_property_change_v2_public_reference_uidx;
    alter table public.client_portal_profile_change_requests
      drop constraint client_portal_profile_change_public_reference_format,
      drop column idempotency_key, drop column public_reference;
    alter table public.client_portal_property_change_requests
      drop constraint client_portal_property_change_public_reference_format,
      drop column idempotency_key, drop column public_reference;
    commit;
  `
}

async function concurrencyProof(psql, port) {
  query(psql, port, `
    insert into public.clients(id,full_name,phone,email,tax_id,billing_address,status)
    values ('CP3B2A-CONCURRENT','Concurrent Client','+34000000111',
      'concurrent@example.invalid','B00000111','Concurrent Street','active');
    insert into public.client_portal_memberships(id,user_id,client_id,role,status)
    values ('75000000-0000-4000-8000-000000000001',
      '72000000-0000-4000-8000-000000000001',
      'CP3B2A-CONCURRENT','client_admin','active');
  `)
  const sql = [
    'begin;',
    'set role authenticated;',
    "set local request.jwt.claim.sub='72000000-0000-4000-8000-000000000001';",
    "select public.portal_submit_profile_change_request_v2('CP3B2A-CONCURRENT',",
    `'{"fullName":"Concurrent Updated"}'::jsonb,`,
    "'76000000-0000-4000-8000-000000000001');",
    'commit;',
  ].join(' ')
  const args = [...connectionArgs(port), '-Atq', '-c', sql]
  const [first, second] = await Promise.all([
    runAsync(psql, args),
    runAsync(psql, args),
  ])
  if (JSON.stringify(JSON.parse(first)) !== JSON.stringify(JSON.parse(second))) {
    fail('concurrent_receipt_mismatch')
  }
  const counts = query(psql, port, `
    select
      (select count(*) from public.client_portal_profile_change_requests
        where idempotency_key='76000000-0000-4000-8000-000000000001') || ':' ||
      (select count(*) from public.client_portal_audit_events
        where actor_user_id='72000000-0000-4000-8000-000000000001'
        and client_id='CP3B2A-CONCURRENT' and event_type='profile_change_requested');
  `)
  if (counts !== '1:1') fail(`concurrent_cardinality_failed:${counts}`)
  query(psql, port, `
    delete from public.client_portal_audit_events where client_id='CP3B2A-CONCURRENT';
    delete from public.client_portal_rate_limits where action='profile_change_v2';
    delete from public.client_portal_profile_change_requests
      where client_id='CP3B2A-CONCURRENT';
    delete from public.client_portal_memberships where client_id='CP3B2A-CONCURRENT';
    delete from public.clients where id='CP3B2A-CONCURRENT';
  `)
}

async function authorizationLockProof(psql, port) {
  query(psql, port, `
    insert into public.clients(id,full_name,phone,email,tax_id,billing_address,status)
    values ('CP3B2A-LOCK','Lock Client','+34000000112',
      'lock@example.invalid','B00000112','Lock Street','active');
    insert into public.properties(
      id,client_id,name,property_type,address,city,postal_code,status
    ) values ('CP3B2A-LOCK-PROP','CP3B2A-LOCK','Lock home','home',
      'Lock Street','Barcelona','08006','active');
    insert into public.client_portal_memberships(id,user_id,client_id,role,status)
    values ('75000000-0000-4000-8000-000000000002',
      '72000000-0000-4000-8000-000000000001',
      'CP3B2A-LOCK','client_admin','active');
  `)
  const submitSql = [
    'begin;',
    'set role authenticated;',
    "set local request.jwt.claim.sub='72000000-0000-4000-8000-000000000001';",
    "select public.portal_submit_property_change_request_v2('CP3B2A-LOCK',",
    "'CP3B2A-LOCK-PROP','{\"city\":\"Girona\"}'::jsonb,",
    "'76000000-0000-4000-8000-000000000002');",
    'select pg_sleep(1);',
    'rollback;',
  ].join(' ')
  const submitPromise = runAsyncResult(
    psql, [...connectionArgs(port), '-Atq', '-c', submitSql],
  )
  await new Promise((resolve) => setTimeout(resolve, 150))
  const archiveResult = await runAsyncResult(psql, [
    ...connectionArgs(port), '-Atq', '-c',
    "set lock_timeout='300ms'; update public.properties "
      + "set archived_at=clock_timestamp() where id='CP3B2A-LOCK-PROP';",
  ])
  const submitResult = await submitPromise
  if (
    submitResult.code !== 0
    || archiveResult.code === 0
    || !/lock timeout/iu.test(archiveResult.stderr)
  ) {
    fail('canonical_authorization_lock_failed')
  }
  const invariant = query(psql, port, `
    select
      (select archived_at is null from public.properties
        where id='CP3B2A-LOCK-PROP') || ':' ||
      (select count(*) from public.client_portal_property_change_requests
        where client_id='CP3B2A-LOCK');
  `)
  if (invariant !== 'true:0' && invariant !== 't:0') {
    fail(`canonical_authorization_lock_residue:${invariant}`)
  }
  query(psql, port, `
    delete from public.client_portal_rate_limits where action='property_change_v2';
    delete from public.client_portal_memberships where client_id='CP3B2A-LOCK';
    delete from public.properties where id='CP3B2A-LOCK-PROP';
    delete from public.clients where id='CP3B2A-LOCK';
  `)
}

async function main() {
  assertLocalOnly()
  assertArtifacts()
  const postgres = findPostgres17()
  const port = await reserveLoopbackPort()
  const workDir = mkdtempSync(
    path.join(tmpdir(), `costa-clean-cp3b2a-${randomBytes(5).toString('hex')}-`),
  )
  const clusterDir = path.join(workDir, 'cluster')
  const result = {
    result: 'FAIL',
    postgresVersion: null,
    rootCauseReproduced: false,
    migration: CP3B2A_MIGRATION,
    migrationSha256: sha256(migrationPath),
    cp2bMigrationSha256: sha256(cp2bPath),
    cp3b0MigrationSha256: sha256(cp3b0Path),
    matrixSha256: sha256(matrixPath),
    concurrencyProof: false,
    concurrencyRuns: 0,
    authorizationLockProof: false,
    rollbackProof: false,
    reapplyProof: false,
    fixtureResidue: null,
    canonicalWrites: null,
    qaRemoteWrites: 0,
    productionWrites: 0,
    migrationHistoryWrites: 0,
    clusterDiscarded: false,
  }
  let started = false
  try {
    run(postgres.initdb, [
      '-D', clusterDir, '--username=postgres', '--auth=trust',
      '--encoding=UTF8', '--no-locale',
    ])
    run(postgres.pgCtl, [
      '-D', clusterDir, '-l', path.join(workDir, 'postgres.log'),
      '-o', `-F -p ${port} -h 127.0.0.1`, '-w', 'start',
    ], { stdio: 'ignore' })
    started = true
    result.postgresVersion = query(postgres.psql, port, 'show server_version')
    if (!result.postgresVersion.startsWith('17.')) fail('postgresql_17_required')

    query(postgres.psql, port, setupSql())
    for (const migration of baselineOrder) {
      applyFile(
        postgres.psql, port,
        path.join(repoRoot, 'supabase', 'migrations', migration),
      )
    }
    query(postgres.psql, port, `
      grant all on all tables in schema public to service_role;
      grant usage, select on all sequences in schema public to service_role;
    `)
    applyFile(postgres.psql, port, writeSql(workDir, 'cp2b-apply.sql', [
      cp2bBootstrapSql(), readFileSync(cp2bPath, 'utf8'),
    ]))
    applyFile(postgres.psql, port, cp3b0Path)
    applyFile(postgres.psql, port, reproducePath)
    result.rootCauseReproduced = true

    const canonicalBefore = canonicalDigest(postgres.psql, port)
    const authCount = query(postgres.psql, port, 'select count(*) from auth.users')
    applyFile(postgres.psql, port, migrationPath)
    const catalog = catalogSnapshot(postgres.psql, port)
    if (
      catalog.columns !== 4 || catalog.indexes !== 4 || catalog.functions !== 4
      || catalog.customerPolicies !== 0 || catalog.legacyServiceGrants !== 0
    ) {
      fail(`catalog_invariant_failed:${JSON.stringify(catalog)}`)
    }
    applyFile(postgres.psql, port, matrixPath)
    await authorizationLockProof(postgres.psql, port)
    result.authorizationLockProof = true
    await concurrencyProof(postgres.psql, port)
    result.concurrencyProof = true
    result.concurrencyRuns += 1

    result.fixtureResidue = Number(query(postgres.psql, port, `
      select
        (select count(*) from public.clients where id like 'CP3B2A-%')
        + (select count(*) from public.properties where id like 'CP3B2A-%')
        + (select count(*) from public.client_portal_memberships
          where id::text like '73%' or id::text like '75%')
        + (select count(*) from public.client_portal_profile_change_requests
          where public_reference like 'CC-PR-%')
        + (select count(*) from public.client_portal_property_change_requests
          where public_reference like 'CC-PT-%')
        + (select count(*) from public.client_portal_audit_events
          where client_id like 'CP3B2A-%')
        + (select count(*) from public.client_portal_rate_limits
          where action in ('profile_change_v2','property_change_v2'));
    `))
    if (result.fixtureResidue !== 0) fail('synthetic_fixture_residue')
    if (query(postgres.psql, port, 'select count(*) from auth.users') !== authCount) {
      fail('auth_user_residue')
    }
    result.canonicalWrites = canonicalDigest(postgres.psql, port) === canonicalBefore ? 0 : 1
    if (result.canonicalWrites !== 0) fail('canonical_or_financial_sequence_drift')

    query(postgres.psql, port, rollbackSql())
    const rolledBack = catalogSnapshot(postgres.psql, port)
    result.rollbackProof = (
      rolledBack.columns === 0 && rolledBack.indexes === 0 && rolledBack.functions === 0
      && rolledBack.customerPolicies === 2 && rolledBack.legacyServiceGrants === 2
    )
    if (!result.rollbackProof) fail('rollback_failed')

    applyFile(postgres.psql, port, migrationPath)
    applyFile(postgres.psql, port, matrixPath)
    await concurrencyProof(postgres.psql, port)
    result.concurrencyRuns += 1
    const reapplied = catalogSnapshot(postgres.psql, port)
    result.reapplyProof = (
      reapplied.columns === 4 && reapplied.indexes === 4 && reapplied.functions === 4
      && reapplied.customerPolicies === 0 && reapplied.legacyServiceGrants === 0
    )
    if (!result.reapplyProof) fail('reapply_failed')
    if (result.concurrencyRuns !== 2) fail('concurrency_not_reproved_after_reapply')
    result.result = 'PASS'
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
  } finally {
    if (started) {
      try {
        run(postgres.pgCtl, ['-D', clusterDir, '-m', 'fast', '-w', 'stop'], {
          stdio: 'ignore',
        })
      } catch (error) {
        result.result = 'FAIL'
        result.error = [result.error, error instanceof Error ? error.message : String(error)]
          .filter(Boolean).join(';')
      }
    }
    try {
      rmSync(workDir, { recursive: true, force: true })
      result.clusterDiscarded = !existsSync(workDir)
    } catch (error) {
      result.result = 'FAIL'
      result.error = [result.error, error instanceof Error ? error.message : String(error)]
        .filter(Boolean).join(';')
    }
    mkdirSync(path.dirname(reportPath), { recursive: true })
    writeFileSync(reportPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  }
  if (result.result !== 'PASS' || !result.clusterDiscarded) {
    fail(result.error ?? 'cp3b2a_local_proof_failed')
  }
  console.log('PASS: CP-3B.2A disposable PostgreSQL 17 proof completed.')
  console.log('Contract gap, security matrix, concurrency, rollback and reapply passed.')
  console.log('Zero synthetic residue; QA and production were not contacted.')
  console.log(`Private report: ${path.relative(repoRoot, reportPath)}`)
}

main().catch((error) => {
  console.error(`BLOCKED: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
