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
const CP2B_MIGRATION = '20260723160000_client_portal_security_boundary.sql'
const CP3B0_MIGRATION = '20260728120000_portal_self_access_context.sql'
const CP2B_FROZEN_SHA256 = 'ea10b4b3db30f6b27f60cd8fff6c8a7c711636e1d6ac439337966f5736cc6277'
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const cp2bMigrationPath = path.join(repoRoot, 'supabase', 'migrations', CP2B_MIGRATION)
const cp3b0MigrationPath = path.join(repoRoot, 'supabase', 'migrations', CP3B0_MIGRATION)
const reproducePath = path.join(
  repoRoot,
  'scripts',
  'client-portal',
  'cp3b0_reproduce_block.sql',
)
const matrixPath = path.join(
  repoRoot,
  'scripts',
  'client-portal',
  'cp3b0_self_access_context_matrix.sql',
)
const reportPath = path.join(
  repoRoot,
  'qa-reports',
  'private',
  'client-portal',
  'cp3b0-local-proof-latest.json',
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
  ['62000000-0000-4000-8000-000000000001', true],
  ['62000000-0000-4000-8000-000000000002', true],
  ['62000000-0000-4000-8000-000000000003', true],
  ['62000000-0000-4000-8000-000000000004', true],
  ['62000000-0000-4000-8000-000000000005', true],
  ['62000000-0000-4000-8000-000000000006', true],
  ['62000000-0000-4000-8000-000000000007', true],
  ['62000000-0000-4000-8000-000000000008', true],
  ['62000000-0000-4000-8000-000000000009', true],
  ['62000000-0000-4000-8000-000000000010', true],
  ['62000000-0000-4000-8000-000000000011', true],
  ['62000000-0000-4000-8000-000000000012', false],
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

  if (result.error) fail(`${path.basename(executable)}: ${result.error.message}`)
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    fail(`${path.basename(executable)} failed${detail ? `:\n${detail}` : '.'}`)
  }

  return (result.stdout ?? '').trim()
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

function assertLocalOnlyEnvironment() {
  const remoteEnvironment = Object.entries(process.env)
    .filter(([name]) => /(DATABASE|POSTGRES|SUPABASE|PGHOST|PGURL|DB_URL|PROJECT_REF)/iu.test(name))
    .map(([, value]) => value ?? '')
    .join('\n')

  if (remoteEnvironment.includes(QA_REF) || remoteEnvironment.includes(PRODUCTION_REF)) {
    fail('remote_project_ref_rejected')
  }

  const pgHost = process.env.PGHOST?.trim().toLowerCase()
  if (pgHost && !['127.0.0.1', 'localhost', '::1'].includes(pgHost)) {
    fail('non_loopback_pg_host_rejected')
  }
}

function assertArtifacts() {
  for (const artifactPath of [
    cp2bMigrationPath,
    cp3b0MigrationPath,
    reproducePath,
    matrixPath,
  ]) {
    if (!existsSync(artifactPath)) {
      fail(`required_artifact_missing:${path.relative(repoRoot, artifactPath)}`)
    }
  }

  if (sha256(cp2bMigrationPath) !== CP2B_FROZEN_SHA256) {
    fail('cp2b_frozen_migration_hash_mismatch')
  }

  const migration = readFileSync(cp3b0MigrationPath, 'utf8')
  if (!/^\s*begin;/iu.test(migration) || !/commit;\s*$/iu.test(migration)) {
    fail('cp3b0_transaction_boundary_missing')
  }
  if (/supabase_migrations|portal_get_account_context\s*\(/iu.test(migration)) {
    fail('cp3b0_forbidden_existing_contract_or_history_change')
  }
}

function findPostgres17() {
  const candidates = [
    process.env.CP3B0_PG_BIN,
    process.platform === 'win32' ? 'C:\\Program Files\\PostgreSQL\\17\\bin' : undefined,
  ].filter(Boolean)

  for (const bin of candidates) {
    const executable = (name) => path.join(
      bin,
      process.platform === 'win32' ? `${name}.exe` : name,
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

function writeSql(workDir, name, chunks) {
  const filePath = path.join(workDir, name)
  writeFileSync(filePath, `${chunks.join('\n\n')}\n`, 'utf8')
  return filePath
}

function setupSql() {
  const authRows = syntheticUsers.map(([id, confirmed], index) => [
    `('${id}'::uuid, 'cp3b0-${index + 1}@example.invalid',`,
    `${confirmed ? 'clock_timestamp()' : 'null'})`,
  ].join(' ')).join(',\n')

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
    create function auth.uid()
    returns uuid
    language sql
    stable
    set search_path = pg_catalog
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    insert into auth.users(id, email, email_confirmed_at) values ${authRows};

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

function cp2bBootstrapSql() {
  return `
    create temp table cp2a_bootstrap_staff (
      user_id uuid primary key,
      role text not null
    );
    insert into cp2a_bootstrap_staff(user_id, role)
      values ('10000000-0000-4000-8000-000000000001', 'owner');
  `
}

function catalogSnapshot(psql, port) {
  return JSON.parse(query(psql, port, `
    select jsonb_build_object(
      'parameterCount', p.pronargs,
      'returnType', pg_get_function_result(p.oid),
      'stable', p.provolatile = 's',
      'securityDefiner', p.prosecdef,
      'owner', r.rolname,
      'fixedSearchPath', coalesce(p.proconfig, '{}'::text[])
        @> array['search_path=pg_catalog'],
      'publicExecute', has_function_privilege('public', p.oid, 'EXECUTE'),
      'anonExecute', has_function_privilege('anon', p.oid, 'EXECUTE'),
      'authenticatedExecute', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
      'serviceRoleExecute', has_function_privilege('service_role', p.oid, 'EXECUTE'),
      'commentPresent', obj_description(p.oid, 'pg_proc') is not null
    )
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    join pg_roles as r on r.oid = p.proowner
    where n.nspname = 'public'
      and p.proname = 'portal_resolve_self_access_context'
      and p.pronargs = 0;
  `))
}

function grantPolicyDigest(psql, port) {
  return query(psql, port, `
    select md5(
      coalesce((
        select string_agg(
          c.oid::regclass::text || ':' || coalesce(c.relacl::text, ''),
          '|' order by c.oid::regclass::text
        )
        from pg_class as c
        join pg_namespace as n on n.oid = c.relnamespace
        where n.nspname in ('public', 'storage')
          and c.relkind in ('r', 'p', 'v', 'm')
      ), '')
      || '#'
      || coalesce((
        select string_agg(
          schemaname || '.' || tablename || ':' || policyname || ':'
            || coalesce(qual, '') || ':' || coalesce(with_check, ''),
          '|' order by schemaname, tablename, policyname
        )
        from pg_policies
        where schemaname in ('public', 'storage')
      ), '')
    );
  `)
}

async function main() {
  assertLocalOnlyEnvironment()
  assertArtifacts()

  const postgres = findPostgres17()
  const port = await reserveLoopbackPort()
  const workDir = mkdtempSync(
    path.join(tmpdir(), `costa-clean-cp3b0-${randomBytes(5).toString('hex')}-`),
  )
  const clusterDir = path.join(workDir, 'cluster')
  const logPath = path.join(workDir, 'postgres.log')
  const result = {
    result: 'FAIL',
    postgresVersion: null,
    rootCause: 'CLIENT_CONTEXT_NOT_SELF_DISCOVERABLE',
    originalBlockReproduced: false,
    migration: CP3B0_MIGRATION,
    migrationSha256: sha256(cp3b0MigrationPath),
    cp2bMigrationSha256: sha256(cp2bMigrationPath),
    matrixSha256: sha256(matrixPath),
    rollbackProof: false,
    reapplyProof: false,
    fixtureResidue: null,
    policyOrTableGrantChanges: null,
    qaRemoteWrites: 0,
    productionWrites: 0,
    migrationHistoryWrites: 0,
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
    result.postgresVersion = query(postgres.psql, port, 'show server_version')

    query(postgres.psql, port, setupSql())
    for (const migration of baselineOrder) {
      applyFile(
        postgres.psql,
        port,
        path.join(repoRoot, 'supabase', 'migrations', migration),
      )
    }
    query(postgres.psql, port, `
      grant all on all tables in schema public to service_role;
      grant usage, select on all sequences in schema public to service_role;
    `)

    const cp2bApplyPath = writeSql(workDir, 'cp2b-apply.sql', [
      cp2bBootstrapSql(),
      readFileSync(cp2bMigrationPath, 'utf8'),
    ])
    applyFile(postgres.psql, port, cp2bApplyPath)
    applyFile(postgres.psql, port, reproducePath)
    result.originalBlockReproduced = true

    const boundaryDigest = grantPolicyDigest(postgres.psql, port)
    applyFile(postgres.psql, port, cp3b0MigrationPath)

    result.catalog = catalogSnapshot(postgres.psql, port)
    if (
      result.catalog.parameterCount !== 0
      || result.catalog.returnType !== 'jsonb'
      || result.catalog.stable !== true
      || result.catalog.securityDefiner !== true
      || result.catalog.owner !== 'postgres'
      || result.catalog.fixedSearchPath !== true
      || result.catalog.publicExecute !== false
      || result.catalog.anonExecute !== false
      || result.catalog.authenticatedExecute !== true
      || result.catalog.serviceRoleExecute !== false
      || result.catalog.commentPresent !== true
    ) {
      fail(`catalog_invariant_failed:${JSON.stringify(result.catalog)}`)
    }

    result.policyOrTableGrantChanges = boundaryDigest === grantPolicyDigest(postgres.psql, port)
      ? 0
      : 1
    if (result.policyOrTableGrantChanges !== 0) {
      fail('table_grant_or_policy_drift')
    }

    const matrixApplyPath = writeSql(workDir, 'cp3b0-matrix-apply.sql', [
      `set app.cp3b0.local_disposable = 'true';
       set app.cp3b0.project_ref = 'local-disposable';`,
      readFileSync(matrixPath, 'utf8'),
    ])
    applyFile(postgres.psql, port, matrixApplyPath)

    result.fixtureResidue = Number(query(postgres.psql, port, `
      select
        (select count(*) from public.clients where id like 'CP3B0-%')
        + (select count(*) from public.client_portal_memberships
           where id::text like '63000000-%')
        + (select count(*) from public.client_portal_applications
           where id::text like '64000000-%');
    `))
    if (result.fixtureResidue !== 0) fail('synthetic_fixture_residue')

    query(
      postgres.psql,
      port,
      'drop function public.portal_resolve_self_access_context();',
    )
    result.rollbackProof = query(
      postgres.psql,
      port,
      `select to_regprocedure('public.portal_resolve_self_access_context()') is null;`,
    ) === 't'
    if (!result.rollbackProof) fail('local_rollback_failed')

    applyFile(postgres.psql, port, cp3b0MigrationPath)
    applyFile(postgres.psql, port, matrixApplyPath)
    result.reapplyProof = catalogSnapshot(postgres.psql, port).authenticatedExecute === true
    if (!result.reapplyProof) fail('local_reapply_failed')

    result.result = 'PASS'
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
  } finally {
    if (started) {
      try {
        run(
          postgres.pgCtl,
          ['-D', clusterDir, '-m', 'fast', '-w', 'stop'],
          { stdio: 'ignore' },
        )
      } catch (error) {
        result.result = 'FAIL'
        result.error = [
          result.error,
          error instanceof Error ? error.message : String(error),
        ].filter(Boolean).join('; ')
      }
    }

    try {
      rmSync(workDir, { recursive: true, force: true })
      result.clusterDiscarded = !existsSync(workDir)
    } catch (error) {
      result.result = 'FAIL'
      result.error = [
        result.error,
        error instanceof Error ? error.message : String(error),
      ].filter(Boolean).join('; ')
    }

    mkdirSync(path.dirname(reportPath), { recursive: true })
    writeFileSync(reportPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  }

  if (result.result !== 'PASS' || !result.clusterDiscarded) {
    fail(result.error ?? 'cp3b0_local_proof_failed')
  }

  console.log('PASS: CP-3B.0 disposable PostgreSQL proof completed.')
  console.log(`PostgreSQL ${result.postgresVersion}; original block, six states and grants passed.`)
  console.log('Rollback, reapply and zero synthetic residue passed; cluster discarded.')
  console.log('QA and production were not contacted.')
  console.log(`Private report: ${path.relative(repoRoot, reportPath)}`)
}

main().catch((error) => {
  console.error(`BLOCKED: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
