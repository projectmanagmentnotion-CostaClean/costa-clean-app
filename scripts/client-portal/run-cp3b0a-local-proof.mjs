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
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const scriptsDir = path.join(repoRoot, 'scripts', 'client-portal')
const cp2bMigrationPath = path.join(
  repoRoot,
  'supabase',
  'migrations',
  '20260723160000_client_portal_security_boundary.sql',
)
const migrationPath = path.join(
  repoRoot,
  'supabase',
  'migrations',
  '20260728120000_portal_self_access_context.sql',
)
const precheckPath = path.join(scriptsDir, 'cp3b0_qa_precheck_v2.sql')
const postcheckPath = path.join(scriptsDir, 'cp3b0_qa_postcheck_v2.sql')
const matrixPath = path.join(scriptsDir, 'cp3b0_qa_matrix_v2.sql')
const rollbackPath = path.join(scriptsDir, 'cp3b0_qa_rollback_v2.sql')
const reportPath = path.join(
  repoRoot,
  'qa-reports',
  'private',
  'client-portal',
  'cp3b0a-local-proof-latest.json',
)
const baselineOrder = [
  '20260721_qa_baseline_schema.sql',
  '20260707_fix_same_number_invoice_update_gap.sql',
  '20260721_rls_clients_properties_jobs_write_fix.sql',
  '20260722_close_anon_read_policies_qa_verified.sql',
  '20260722171428_public_quiz_providerless_abuse_protection.sql',
]

function fail(code) {
  throw new Error(code)
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    timeout: options.timeout ?? 120_000,
    maxBuffer: 50 * 1024 * 1024,
    ...options,
  })
  if (result.error || result.status !== 0) {
    const detail = options.redactFailure
      ? 'redacted'
      : [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    fail(`command_failed:${path.basename(executable)}:${detail}`)
  }
  return (result.stdout ?? '').trim()
}

function assertLocalOnlyEnvironment() {
  const values = Object.entries(process.env)
    .filter(([name]) => /(DATABASE|POSTGRES|SUPABASE|PGHOST|PGURL|PROJECT_REF)/iu.test(name))
    .map(([, value]) => value ?? '')
    .join('\n')
  if (values.includes(QA_REF) || values.includes(PRODUCTION_REF)) {
    fail('remote_environment_rejected')
  }
}

function findPostgres17() {
  const bin = process.env.CP3B0_PG_BIN
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

function reserveLoopbackPort() {
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
    '-X', '-h', '127.0.0.1', '-p', String(port),
    '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1',
  ]
}

function query(psql, port, sql) {
  return run(psql, [...connectionArgs(port), '-Atq', '-c', sql])
}

function applyFile(psql, port, filePath, variables = {}) {
  const args = [...connectionArgs(port), '-q']
  for (const [name, value] of Object.entries(variables)) {
    args.push('-v', `${name}=${value}`)
  }
  args.push('-f', filePath)
  return run(psql, args)
}

function captureFile(psql, port, filePath, variables = {}) {
  const args = [...connectionArgs(port), '-Atq']
  for (const [name, value] of Object.entries(variables)) {
    args.push('-v', `${name}=${value}`)
  }
  args.push('-f', filePath)
  const output = run(psql, args)
  const lines = output.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean)
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(lines[index])
    } catch {
      // Ignore psql status lines.
    }
  }
  fail('json_output_missing')
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
    returns uuid language sql stable set search_path = pg_catalog
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    insert into auth.users(id, email, email_confirmed_at)
      values (
        '10000000-0000-4000-8000-000000000001',
        'cp3b0a-staff@example.invalid',
        clock_timestamp()
      );

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

    create schema supabase_migrations;
    create table supabase_migrations.schema_migrations (
      version text primary key,
      name text not null,
      statements text[]
    );
    insert into supabase_migrations.schema_migrations(version, name, statements)
      values ('20260700000000', 'synthetic_local_baseline', array[]::text[]);
  `
}

function assertPoststate(prestate, poststate) {
  if (
    poststate.signatureCount !== 1
    || poststate.parameterCount !== 0
    || poststate.returnType !== 'jsonb'
    || poststate.stable !== true
    || poststate.securityDefiner !== true
    || poststate.owner !== 'postgres'
    || poststate.fixedSearchPath !== true
    || poststate.publicExecute !== false
    || poststate.anonExecute !== false
    || poststate.authenticatedExecute !== true
    || poststate.serviceRoleExecute !== false
    || poststate.commentPresent !== true
  ) fail('postcheck_contract_failed')
  for (const key of [
    'portalRowCount',
    'tableGrantDigest',
    'policyDigest',
    'otherPortalFunctionCount',
    'otherPortalFunctionDigest',
    'migrationHistoryCount',
    'migrationHistoryDigest',
  ]) {
    if (poststate[key] !== prestate[key]) fail(`postcheck_drift:${key}`)
  }
}

async function main() {
  assertLocalOnlyEnvironment()
  if (
    sha256(migrationPath)
    !== 'c6161ddb4d5d85e139aea98a47429feae21d20dd06c5e3d54b579f58c5468731'
  ) fail('migration_hash_mismatch')

  const postgres = findPostgres17()
  const port = await reserveLoopbackPort()
  const workDir = mkdtempSync(
    path.join(tmpdir(), `costa-clean-cp3b0a-${randomBytes(5).toString('hex')}-`),
  )
  const clusterDir = path.join(workDir, 'cluster')
  const logPath = path.join(workDir, 'postgres.log')
  const cp2bApplyPath = path.join(workDir, 'cp2b-apply.sql')
  const runId = `CP3B0-V2-${randomBytes(6).toString('hex').toUpperCase()}`
  const result = {
    result: 'FAIL',
    postgresVersion: null,
    migrationSha256: sha256(migrationPath),
    preEffectOrder: [
      'manifest_and_hashes',
      'authorization_and_head',
      'clean_worktree',
      'private_backup',
      'local_qa_link',
      'supabase_cli_qa_link',
      'production_not_linked',
      'postgres_live_read',
      'postgres_qa_target',
      'cp2b_prerequisite',
      'function_absent',
      'catalog_prestate',
      'grants_and_policy_digest',
      'synthetic_collision_check',
      'postgres_pre_effect_check',
      'apply',
    ],
    applicationAttempts: 0,
    recoveryAttempts: 0,
    matrix: 'NOT_RUN',
    residue: null,
    clusterDiscarded: false,
    qaRemoteWrites: 0,
    productionWrites: 0,
  }
  let started = false

  try {
    run(postgres.initdb, [
      '-D', clusterDir, '--username=postgres', '--auth=trust',
      '--encoding=UTF8', '--no-locale',
    ])
    run(postgres.pgCtl, [
      '-D', clusterDir, '-l', logPath,
      '-o', `-F -p ${port} -h 127.0.0.1`, '-w', 'start',
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
    writeFileSync(cp2bApplyPath, [
      'create temp table cp2a_bootstrap_staff (',
      'user_id uuid primary key, role text not null);',
      "insert into cp2a_bootstrap_staff values ('10000000-0000-4000-8000-000000000001','owner');",
      readFileSync(cp2bMigrationPath, 'utf8'),
    ].join('\n'), 'utf8')
    applyFile(postgres.psql, port, cp2bApplyPath)

    const variables = { project_ref: QA_REF, run_id: runId }
    const prestate = captureFile(postgres.psql, port, precheckPath, variables)
    if (
      prestate.liveRead !== 1
      || prestate.cp2bPrerequisite !== true
      || prestate.selfContextCount !== 0
      || prestate.portalTables !== 11
      || prestate.syntheticCollisions !== 0
    ) fail('local_prestate_failed')

    result.applicationAttempts += 1
    applyFile(postgres.psql, port, migrationPath)
    const poststate = captureFile(postgres.psql, port, postcheckPath)
    assertPoststate(prestate, poststate)

    const matrix = captureFile(postgres.psql, port, matrixPath, variables)
    if (matrix.result !== 'PASS' || matrix.transaction !== 'ROLLED_BACK') {
      fail('transactional_matrix_failed')
    }
    result.matrix = 'PASS_ROLLED_BACK'
    result.residue = captureFile(
      postgres.psql,
      port,
      precheckPath,
      variables,
    ).syntheticCollisions
    if (result.residue !== 0) fail('fixture_residue_detected')

    const rollback = captureFile(postgres.psql, port, rollbackPath)
    result.recoveryAttempts += 1
    if (rollback.functionAbsent !== true) fail('rollback_failed')
    const restored = captureFile(postgres.psql, port, precheckPath, variables)
    for (const key of [
      'portalRowCount',
      'tableGrantDigest',
      'policyDigest',
      'otherPortalFunctionCount',
      'otherPortalFunctionDigest',
      'migrationHistoryCount',
      'migrationHistoryDigest',
    ]) {
      if (restored[key] !== prestate[key]) fail(`rollback_drift:${key}`)
    }

    result.applicationAttempts += 1
    applyFile(postgres.psql, port, migrationPath)
    let simulatedFailure = false
    try {
      fail('simulated_post_apply_failure')
    } catch {
      simulatedFailure = true
      const recovered = captureFile(postgres.psql, port, rollbackPath)
      result.recoveryAttempts += 1
      if (recovered.functionAbsent !== true) fail('simulated_recovery_failed')
    }
    if (!simulatedFailure || result.applicationAttempts !== 2 || result.recoveryAttempts !== 2) {
      fail('retry_or_recovery_count_failed')
    }
    const finalState = captureFile(postgres.psql, port, precheckPath, variables)
    if (finalState.selfContextCount !== 0 || finalState.syntheticCollisions !== 0) {
      fail('final_residue_failed')
    }
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
        result.error = [
          result.error,
          error instanceof Error ? error.message : String(error),
        ].filter(Boolean).join(';')
      }
    }
    try {
      rmSync(workDir, { recursive: true, force: true })
      result.clusterDiscarded = !existsSync(workDir)
    } catch {
      result.result = 'FAIL'
      result.error = 'cluster_discard_failed'
    }
    mkdirSync(path.dirname(reportPath), { recursive: true })
    writeFileSync(reportPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  }

  if (result.result !== 'PASS' || !result.clusterDiscarded) {
    fail(result.error ?? 'cp3b0a_local_proof_failed')
  }
  console.log('PASS: CP-3B.0A PostgreSQL 17 disposable proof completed.')
  console.log('Apply/postcheck, QA matrix rollback and exact recovery passed.')
  console.log('Simulated post-apply failure recovered once with no automatic retry.')
  console.log('Zero residue; QA and production were not contacted.')
}

main().catch((error) => {
  console.error(`BLOCKED: ${error instanceof Error ? error.message : 'unknown_error'}`)
  process.exitCode = 1
})
