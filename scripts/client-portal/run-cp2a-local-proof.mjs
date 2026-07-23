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

const QA_REF = 'kpvvydthlxupjjqqdpxy'
const PRODUCTION_REF = 'wfxnwfcdjainpojhbdri'
const MIGRATION = '20260723160000_client_portal_security_boundary.sql'
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const migrationPath = path.join(repoRoot, 'supabase', 'migrations', MIGRATION)
const fixturesPath = path.join(repoRoot, 'scripts', 'client-portal', 'cp2a_fixtures.sql')
const matrixPath = path.join(repoRoot, 'scripts', 'client-portal', 'cp2a_authorization_matrix.sql')
const cleanupPath = path.join(repoRoot, 'scripts', 'client-portal', 'cp2a_cleanup.sql')
const rollbackPath = path.join(repoRoot, 'scripts', 'client-portal', 'cp2a_rollback.sql')
const reportPath = path.join(
  repoRoot,
  'qa-reports',
  'private',
  'client-portal',
  'cp2a-local-proof-latest.json',
)

const baselineOrder = [
  '20260721_qa_baseline_schema.sql',
  '20260707_fix_same_number_invoice_update_gap.sql',
  '20260721_rls_clients_properties_jobs_write_fix.sql',
  '20260722_close_anon_read_policies_qa_verified.sql',
  '20260722171428_public_quiz_providerless_abuse_protection.sql',
]

const syntheticUsers = [
  ['10000000-0000-4000-8000-000000000001', 'active-staff@example.invalid', true],
  ['10000000-0000-4000-8000-000000000002', 'suspended-staff@example.invalid', true],
  ['20000000-0000-4000-8000-000000000001', 'admin-a@example.invalid', true],
  ['20000000-0000-4000-8000-000000000002', 'member-a@example.invalid', true],
  ['20000000-0000-4000-8000-000000000003', 'admin-b@example.invalid', true],
  ['20000000-0000-4000-8000-000000000004', 'member-b@example.invalid', true],
  ['20000000-0000-4000-8000-000000000005', 'pending@example.invalid', true],
  ['20000000-0000-4000-8000-000000000006', 'suspended@example.invalid', true],
  ['20000000-0000-4000-8000-000000000007', 'revoked@example.invalid', true],
  ['20000000-0000-4000-8000-000000000008', 'unverified@example.invalid', false],
  ['20000000-0000-4000-8000-000000000009', 'invite-active@example.invalid', true],
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
    timeout: 60_000,
    ...options,
  })
  if (result.error) fail(`${path.basename(executable)}: ${result.error.message}`)
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    fail(`${path.basename(executable)} failed${detail ? `:\n${detail}` : '.'}`)
  }
  return (result.stdout ?? '').trim()
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex').toUpperCase()
}

function assertLocalOnlyEnvironment() {
  const environmentText = Object.entries(process.env)
    .filter(([name]) => /(DATABASE|POSTGRES|SUPABASE|PGHOST|PGURL|DB_URL|PROJECT_REF)/i.test(name))
    .map(([, value]) => value ?? '')
    .join('\n')
  for (const forbiddenRef of [QA_REF, PRODUCTION_REF]) {
    if (environmentText.includes(forbiddenRef)) {
      fail(`Refusing CP-2A proof: environment contains forbidden remote ref ${forbiddenRef}.`)
    }
  }
  const pgHost = process.env.PGHOST?.trim().toLowerCase()
  if (pgHost && !['127.0.0.1', 'localhost', '::1'].includes(pgHost)) {
    fail('Refusing CP-2A proof: PGHOST is not loopback.')
  }
}

function findPostgres17() {
  const candidates = [
    process.env.CP2A_PG_BIN,
    process.platform === 'win32' ? 'C:\\Program Files\\PostgreSQL\\17\\bin' : undefined,
  ].filter(Boolean)
  for (const bin of candidates) {
    const tools = {
      initdb: path.join(bin, process.platform === 'win32' ? 'initdb.exe' : 'initdb'),
      pgCtl: path.join(bin, process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl'),
      psql: path.join(bin, process.platform === 'win32' ? 'psql.exe' : 'psql'),
    }
    if (Object.values(tools).every(existsSync)) return tools
  }
  fail('PostgreSQL 17 initdb/pg_ctl/psql are unavailable.')
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
    '-X',
    '-v',
    'ON_ERROR_STOP=1',
    '-h',
    '127.0.0.1',
    '-p',
    String(port),
    '-U',
    'postgres',
    '-d',
    'postgres',
  ]
}

function query(psql, port, sql) {
  return run(psql, [...connectionArgs(port), '-Atqc', sql])
}

function applyFile(psql, port, filePath) {
  run(psql, [...connectionArgs(port), '-f', filePath])
}

function writeCombinedFile(workDir, name, chunks) {
  const target = path.join(workDir, name)
  writeFileSync(target, chunks.join('\n\n'), 'utf8')
  return target
}

function assertArtifacts() {
  for (const filePath of [migrationPath, fixturesPath, matrixPath, cleanupPath, rollbackPath]) {
    if (!existsSync(filePath)) fail(`Required CP-2A artifact missing: ${filePath}`)
  }
  const migration = readFileSync(migrationPath, 'utf8')
  if (!/^\s*begin;/iu.test(migration) || !/commit;\s*$/iu.test(migration)) {
    fail('CP-2A migration lacks explicit BEGIN/COMMIT.')
  }
  if (/supabase_migrations\.schema_migrations|invoice_number\s*=|display_code\s*=/iu.test(migration)) {
    fail('CP-2A migration contains a prohibited history/numbering mutation.')
  }
  if (!/^\d{14}_.+\.sql$/u.test(MIGRATION)) {
    fail('CP-2A migration does not use a unique 14-digit version.')
  }
}

function setupSql() {
  const values = syntheticUsers.map(([id, email, confirmed]) =>
    `('${id}'::uuid, '${email}', ${confirmed ? 'clock_timestamp()' : 'null'})`,
  ).join(',\n')
  return `
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (
      id uuid primary key,
      email text,
      email_confirmed_at timestamptz
    );
    create function auth.uid() returns uuid language sql stable
      set search_path = pg_catalog
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    insert into auth.users(id, email, email_confirmed_at) values ${values};

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

function bootstrapSql() {
  return `
    create temp table cp2a_bootstrap_staff (
      user_id uuid primary key,
      role text not null
    );
    insert into cp2a_bootstrap_staff(user_id, role)
      values ('10000000-0000-4000-8000-000000000001', 'owner');
  `
}

function proofSql(workDir) {
  const dummyPdf = path.join(workDir, 'QA-CP2-DUMMY-NOT-FISCAL.pdf')
  writeFileSync(dummyPdf, '%PDF-1.4\n% QA-CP2 synthetic non-fiscal document\n%%EOF\n', 'utf8')
  return {
    dummyPdf,
    file: writeCombinedFile(workDir, 'cp2a-proof.sql', [
      `begin;
       set local app.cp2a.local_disposable = 'true';
       set local app.cp2a.project_ref = 'local-disposable';
       create temp table cp2a_sequence_snapshot as
         select sequencename as sequence_name, last_value
         from pg_sequences
         where schemaname = 'public';`,
      readFileSync(fixturesPath, 'utf8'),
      readFileSync(matrixPath, 'utf8'),
      readFileSync(cleanupPath, 'utf8'),
      `commit;`,
    ]),
  }
}

function rollbackSql(workDir, name) {
  return writeCombinedFile(workDir, name, [
    `set app.cp2a.allow_legacy_restore = 'true';`,
    readFileSync(rollbackPath, 'utf8'),
  ])
}

function postMigrationCatalog(psql, port) {
  return JSON.parse(query(psql, port, `
    select jsonb_build_object(
      'portalTables', (
        select count(*) from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relkind = 'r'
          and c.relname = any (array[
            'internal_staff_memberships', 'client_portal_invitations',
            'client_portal_memberships', 'client_portal_applications',
            'client_portal_profile_change_requests',
            'client_portal_property_change_requests', 'client_service_requests',
            'client_portal_audit_events', 'client_portal_rate_limits',
            'invoice_document_records', 'client_portal_legal_acceptances'
          ])
      ),
      'forcedPortalTables', (
        select count(*) from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relforcerowsecurity
          and c.relname like any (array['client_portal_%', 'client_service_requests', 'invoice_document_records', 'internal_staff_memberships'])
      ),
      'anyAuthenticatedPolicies', (
        select count(*) from pg_policies
        where schemaname = 'public'
          and roles && array['authenticated'::name]
          and (
            lower(coalesce(qual, '')) in ('true', '(true)', '((auth.uid() is not null))')
            or lower(coalesce(with_check, '')) in ('true', '(true)', '((auth.uid() is not null))')
            or lower(coalesce(qual, '')) like '%(select auth.uid()) is not null%'
          )
      ),
      'portalFunctions', (
        select count(*) from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname like 'portal_%'
      ),
      'securityDefinersWithoutPath', (
        select count(*) from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('public', 'portal_private')
          and p.prosecdef
          and (
            p.proconfig is null
            or not exists (
              select 1 from unnest(p.proconfig) setting
              where setting like 'search_path=%'
            )
          )
      ),
      'invoiceBucketPrivate', (
        select not public from storage.buckets where id = 'invoice-documents'
      ),
      'inventory', jsonb_build_object(
        'tables', (
          select jsonb_agg(jsonb_build_object(
            'schema', n.nspname,
            'name', c.relname,
            'owner', r.rolname,
            'rls', c.relrowsecurity,
            'forceRls', c.relforcerowsecurity,
            'grants', c.relacl
          ) order by n.nspname, c.relname)
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          join pg_roles r on r.oid = c.relowner
          where n.nspname in ('public', 'portal_private', 'storage')
            and c.relkind in ('r', 'p', 'v', 'm')
        ),
        'policies', (
          select jsonb_agg(to_jsonb(p) order by schemaname, tablename, policyname)
          from pg_policies p
          where schemaname in ('public', 'portal_private', 'storage')
        ),
        'functions', (
          select jsonb_agg(jsonb_build_object(
            'schema', n.nspname,
            'signature', p.oid::regprocedure::text,
            'owner', r.rolname,
            'securityDefiner', p.prosecdef,
            'configuration', p.proconfig,
            'grants', p.proacl
          ) order by p.oid::regprocedure::text)
          from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
          join pg_roles r on r.oid = p.proowner
          where n.nspname in ('public', 'portal_private')
        ),
        'sequences', (
          select jsonb_agg(to_jsonb(s) order by schemaname, sequencename)
          from pg_sequences s
          where schemaname = 'public'
        ),
        'triggers', (
          select jsonb_agg(jsonb_build_object(
            'table', t.tgrelid::regclass::text,
            'name', t.tgname,
            'definition', pg_get_triggerdef(t.oid)
          ) order by t.tgrelid::regclass::text, t.tgname)
          from pg_trigger t
          where not t.tgisinternal
            and t.tgrelid::regclass::text like 'public.%'
        ),
        'defaultPrivileges', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'owner', r.rolname,
            'schema', coalesce(n.nspname, '*'),
            'objectType', d.defaclobjtype,
            'grants', d.defaclacl
          ) order by r.rolname, n.nspname, d.defaclobjtype), '[]'::jsonb)
          from pg_default_acl d
          join pg_roles r on r.oid = d.defaclrole
          left join pg_namespace n on n.oid = d.defaclnamespace
        )
      )
    );
  `))
}

async function main() {
  assertLocalOnlyEnvironment()
  assertArtifacts()
  const postgres = findPostgres17()
  const port = await reserveLoopbackPort()
  const workDir = mkdtempSync(path.join(tmpdir(), `costa-clean-cp2a-${randomBytes(5).toString('hex')}-`))
  const clusterDir = path.join(workDir, 'cluster')
  const logPath = path.join(workDir, 'postgres.log')
  const result = {
    result: 'FAIL',
    postgresVersion: null,
    migration: MIGRATION,
    migrationSha256: sha256(migrationPath),
    fixturesSha256: sha256(fixturesPath),
    matrixSha256: sha256(matrixPath),
    cleanupSha256: sha256(cleanupPath),
    rollbackSha256: sha256(rollbackPath),
    qaModified: false,
    productionModified: false,
    remoteWrites: 0,
    syntheticFixtureRowsAfterCleanup: null,
    dummyDocumentsAfterCleanup: null,
    reapplyProof: false,
    rollbackProof: false,
    clusterDiscarded: false,
  }
  let started = false

  try {
    run(postgres.initdb, [
      '-D',
      clusterDir,
      '--username=postgres',
      '--auth=trust',
      '--encoding=UTF8',
      '--no-locale',
    ])
    run(postgres.pgCtl, [
      '-D',
      clusterDir,
      '-l',
      logPath,
      '-o',
      `-F -p ${port} -h 127.0.0.1`,
      '-w',
      'start',
    ], { stdio: 'ignore' })
    started = true
    result.postgresVersion = query(postgres.psql, port, `show server_version`)

    query(postgres.psql, port, setupSql())
    for (const file of baselineOrder) {
      applyFile(postgres.psql, port, path.join(repoRoot, 'supabase', 'migrations', file))
    }
    query(postgres.psql, port, `
      grant all on all tables in schema public to service_role;
      grant usage, select on all sequences in schema public to service_role;
    `)

    const migrationApply = writeCombinedFile(workDir, 'cp2a-migration-apply.sql', [
      bootstrapSql(),
      readFileSync(migrationPath, 'utf8'),
    ])
    applyFile(postgres.psql, port, migrationApply)
    result.catalog = postMigrationCatalog(postgres.psql, port)
    if (
      result.catalog.portalTables !== 11
      || result.catalog.forcedPortalTables !== 11
      || result.catalog.anyAuthenticatedPolicies !== 0
      || result.catalog.securityDefinersWithoutPath !== 0
      || result.catalog.invoiceBucketPrivate !== true
    ) {
      fail(`Post-migration catalog invariant failed: ${JSON.stringify(result.catalog)}`)
    }

    const proof = proofSql(workDir)
    applyFile(postgres.psql, port, proof.file)
    rmSync(proof.dummyPdf, { force: true })
    result.syntheticFixtureRowsAfterCleanup = query(postgres.psql, port, `
      select
        (select count(*) from public.client_portal_memberships)
        + (select count(*) from public.client_portal_invitations)
        + (select count(*) from public.client_service_requests)
        + (select count(*) from public.invoice_document_records);
    `)
    result.dummyDocumentsAfterCleanup = existsSync(proof.dummyPdf) ? 1 : 0
    if (result.syntheticFixtureRowsAfterCleanup !== '0' || result.dummyDocumentsAfterCleanup !== 0) {
      fail('Synthetic cleanup did not return to zero.')
    }

    applyFile(postgres.psql, port, rollbackSql(workDir, 'cp2a-rollback-first.sql'))
    result.rollbackProof = query(postgres.psql, port, `
      select (
        to_regnamespace('portal_private') is null
        and (
          select count(*) from pg_policies
          where schemaname = 'public' and policyname = 'Authenticated read access'
        ) = 10
      )::text;
    `) === 'true'
    if (!result.rollbackProof) fail('Rollback proof failed.')

    const migrationReapply = writeCombinedFile(workDir, 'cp2a-migration-reapply.sql', [
      bootstrapSql(),
      readFileSync(migrationPath, 'utf8'),
    ])
    applyFile(postgres.psql, port, migrationReapply)
    const reapplyCleanup = writeCombinedFile(workDir, 'cp2a-reapply-cleanup.sql', [
      `begin;
       set local app.cp2a.local_disposable = 'true';
       set local app.cp2a.project_ref = 'local-disposable';`,
      readFileSync(cleanupPath, 'utf8'),
      `commit;`,
    ])
    applyFile(postgres.psql, port, reapplyCleanup)
    applyFile(postgres.psql, port, rollbackSql(workDir, 'cp2a-rollback-second.sql'))
    result.reapplyProof = query(postgres.psql, port, `
      select (
        to_regnamespace('portal_private') is null
        and not exists (
          select 1 from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relname = 'client_portal_memberships'
        )
      )::text;
    `) === 'true'
    if (!result.reapplyProof) fail('Safe reapply proof failed.')

    query(postgres.psql, port, `
      delete from auth.users
      where email like '%@example.invalid';
    `)
    if (query(postgres.psql, port, `select count(*) from auth.users`) !== '0') {
      fail('Synthetic Auth stub cleanup failed.')
    }
    result.result = 'PASS'
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
  } finally {
    if (started) {
      try {
        run(postgres.pgCtl, ['-D', clusterDir, '-m', 'fast', '-w', 'stop'], { stdio: 'ignore' })
      } catch (error) {
        result.result = 'FAIL'
        result.error = `${result.error ? `${result.error}; ` : ''}${error instanceof Error ? error.message : String(error)}`
      }
    }
    try {
      rmSync(workDir, { recursive: true, force: true })
      result.clusterDiscarded = !existsSync(workDir)
    } catch (error) {
      result.result = 'FAIL'
      result.error = `${result.error ? `${result.error}; ` : ''}${error instanceof Error ? error.message : String(error)}`
    }
    mkdirSync(path.dirname(reportPath), { recursive: true })
    writeFileSync(reportPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  }

  if (result.result !== 'PASS' || !result.clusterDiscarded) {
    fail(result.error ?? 'CP-2A local proof failed.')
  }

  console.log('PASS: CP-2A disposable PostgreSQL proof completed.')
  console.log(`PostgreSQL ${result.postgresVersion}; migration, matrix, cleanup, rollback and reapply passed.`)
  console.log('Fixtures, dummy documents, memberships, invitations and requests returned to zero.')
  console.log('Temporary cluster discarded. QA and production were not contacted.')
  console.log(`Private report: ${path.relative(repoRoot, reportPath)}`)
}

main().catch((error) => {
  console.error(`BLOCKED: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
