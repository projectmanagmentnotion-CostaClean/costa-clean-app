import { createHash, randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const QA_REF = 'kpvvydthlxupjjqqdpxy'
const PRODUCTION_REF = 'wfxnwfcdjainpojhbdri'
const FORBIDDEN_REFS = [QA_REF, PRODUCTION_REF]
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const migrationsDir = path.join(repoRoot, 'supabase', 'migrations')
const reportPath = path.join(
  repoRoot,
  'qa-reports',
  'private',
  'migration-repair',
  'local-proof-latest.md',
)

const artifacts = [
  {
    alias: '20260721134926',
    file: '20260721_qa_baseline_schema.sql',
    sha256: '721F29026F4224DF3FEA68BCB086FB6C559599114CDE4FC9637CA0CDE5E44E57',
    kind: 'baseline',
    flag: 'never-push',
  },
  {
    alias: '20260707120336',
    file: '20260707_fix_same_number_invoice_update_gap.sql',
    sha256: '39A435EECE213AE73553C7F33B346A1B957C2A090858EA8F29CAA1026C8EC33D',
    kind: 'incremental',
    flag: 'repair-only',
  },
  {
    alias: '20260721183811',
    file: '20260721_rls_clients_properties_jobs_write_fix.sql',
    sha256: '8D330B87CDFF30DF88346E67C8C2B72801661686A0883432D1BAEBBB4E89EFA2',
    kind: 'incremental',
    flag: 'repair-only',
  },
  {
    alias: '20260722114751',
    file: '20260722_close_anon_read_policies_qa_verified.sql',
    sha256: '000E04348CD7E1DBA4CC1FE3F9C9F42526C3F1D3D35C0AE9D7B2D714A4FB0C02',
    kind: 'incremental',
    flag: 'repair-only',
  },
]

const incrementalAliases = artifacts
  .filter(({ kind }) => kind === 'incremental')
  .map(({ alias }) => alias)

function fail(message) {
  throw new Error(message)
}

function assertNoRemoteTarget() {
  const inspected = Object.entries(process.env)
    .filter(([name]) => /(DATABASE|POSTGRES|SUPABASE|PGHOST|PGURL|DB_URL|PROJECT_REF)/i.test(name))
    .map(([, value]) => value ?? '')
    .join('\n')

  for (const ref of FORBIDDEN_REFS) {
    if (inspected.includes(ref)) {
      fail(`Refusing proof: process environment contains forbidden remote ref ${ref}.`)
    }
  }

  const remoteHost = process.env.PGHOST
  if (remoteHost && !['127.0.0.1', 'localhost', '::1'].includes(remoteHost.toLowerCase())) {
    fail('Refusing proof: PGHOST is not loopback.')
  }
}

function findPgBin() {
  const candidates = [
    process.env.LOCAL_PROOF_PG_BIN,
    process.platform === 'win32' ? 'C:\\Program Files\\PostgreSQL\\17\\bin' : undefined,
    process.platform === 'win32' ? 'C:\\Program Files\\PostgreSQL\\16\\bin' : undefined,
  ].filter(Boolean)

  for (const candidate of candidates) {
    const initdb = path.join(candidate, process.platform === 'win32' ? 'initdb.exe' : 'initdb')
    const pgCtl = path.join(candidate, process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl')
    const psql = path.join(candidate, process.platform === 'win32' ? 'psql.exe' : 'psql')
    if (existsSync(initdb) && existsSync(pgCtl) && existsSync(psql)) {
      return { initdb, pgCtl, psql }
    }
  }

  const command = process.platform === 'win32' ? 'where.exe' : 'which'
  const located = spawnSync(command, ['initdb'], { encoding: 'utf8', windowsHide: true })
  if (located.status === 0) {
    const initdb = located.stdout.trim().split(/\r?\n/)[0]
    const bin = path.dirname(initdb)
    return {
      initdb,
      pgCtl: path.join(bin, process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl'),
      psql: path.join(bin, process.platform === 'win32' ? 'psql.exe' : 'psql'),
    }
  }

  fail('PostgreSQL initdb/pg_ctl/psql are unavailable; proof not executed.')
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    windowsHide: true,
    ...options,
  })
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    fail(`${path.basename(command)} failed${detail ? `:\n${detail}` : '.'}`)
  }
  return (result.stdout ?? '').trim()
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex').toUpperCase()
}

function verifyManifest() {
  const manifest = readFileSync(
    path.join(repoRoot, 'docs', 'SUPABASE_MIGRATION_MANIFEST_20260722.md'),
    'utf8',
  )
  for (const artifact of artifacts) {
    const filePath = path.join(migrationsDir, artifact.file)
    if (!existsSync(filePath)) fail(`Manifest artifact missing: ${artifact.file}`)
    const actual = sha256(filePath)
    if (actual !== artifact.sha256) {
      fail(`Fingerprint mismatch for ${artifact.file}: expected ${artifact.sha256}, got ${actual}.`)
    }
    for (const token of [artifact.alias, artifact.file, artifact.sha256, artifact.flag]) {
      if (!manifest.includes(token)) fail(`Canonical manifest does not contain ${token}.`)
    }
  }

  if (new Set(incrementalAliases).size !== incrementalAliases.length) {
    fail('Incremental aliases are not unique.')
  }
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

function query(psql, port, sql) {
  return run(psql, [
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
    '-Atqc',
    sql,
  ])
}

function applyFile(psql, port, filePath) {
  run(psql, [
    '-X',
    '-v',
    'ON_ERROR_STOP=1',
    '--single-transaction',
    '-h',
    '127.0.0.1',
    '-p',
    String(port),
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-f',
    filePath,
  ])
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) fail(`${label}: expected ${expected}, got ${actual || '<empty>'}.`)
}

function writePrivateReport(result) {
  mkdirSync(path.dirname(reportPath), { recursive: true })
  const appliedLines = result.applied.map((item, index) => `${index + 1}. \`${item}\``).join('\n')
  const hashLines = artifacts.map(({ file, sha256: hash }) => `- \`${file}\`: \`${hash}\``).join('\n')
  writeFileSync(reportPath, `# Local disposable PostgreSQL migration repair proof\n\n` +
    `- Timestamp: ${new Date().toISOString()}\n` +
    `- Result: **${result.ok ? 'PASS' : 'FAIL'}**\n` +
    `- PostgreSQL: \`${result.pgVersion ?? 'unavailable'}\`\n` +
    `- Target: generated loopback-only temporary cluster\n` +
    `- QA official modified: **NO**\n` +
    `- Production modified: **NO**\n` +
    `- Remote schema/data modified: **NO**\n` +
    `- Real migration repair/db push: **NO**\n` +
    `- Temporary cluster discarded: **${result.discarded ? 'YES' : 'NO'}**\n\n` +
    `## Applied order\n\n${appliedLines || '- Proof stopped before apply.'}\n\n` +
    `## Verified fingerprints\n\n${hashLines}\n\n` +
    `## Database checks\n\n` +
    `- Public tables after baseline/incrementals: ${result.publicTables ?? 'not verified'}\n` +
    `- Invoice fix sentinel: ${result.invoiceSentinel ?? 'not verified'}\n` +
    `- Authenticated read policies: ${result.authenticatedPolicies ?? 'not verified'}\n` +
    `- Simulated incremental versions: ${result.metadataVersions ?? 'not verified'}\n` +
    `- Baseline present in simulated metadata: ${result.baselineInMetadata ?? 'not verified'}\n\n` +
    `## Error\n\n${result.error ? `\`${result.error.replaceAll('`', "'")}\`` : 'None.'}\n`,
  )
}

async function main() {
  assertNoRemoteTarget()
  verifyManifest()
  const pg = findPgBin()
  const port = await reserveLoopbackPort()
  const nonce = randomBytes(6).toString('hex')
  const clusterDir = mkdtempSync(path.join(tmpdir(), `costa-clean-migration-proof-${nonce}-`))
  const result = { ok: false, discarded: false, applied: [] }
  let started = false

  try {
    run(pg.initdb, ['-D', clusterDir, '--username=postgres', '--auth=trust', '--encoding=UTF8', '--no-locale'])
    run(pg.pgCtl, [
      '-D',
      clusterDir,
      '-l',
      path.join(clusterDir, 'postgres.log'),
      '-o',
      `-F -p ${port} -h 127.0.0.1`,
      '-w',
      'start',
    ], { stdio: 'ignore' })
    started = true
    result.pgVersion = query(pg.psql, port, "select current_setting('server_version')")

    query(pg.psql, port, `
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    `)

    const baseline = artifacts.find(({ kind }) => kind === 'baseline')
    applyFile(pg.psql, port, path.join(migrationsDir, baseline.file))
    result.applied.push(`${baseline.alias} ${baseline.file} (${baseline.flag}, outside metadata)`)
    assertEqual(query(pg.psql, port, "select count(*) from pg_tables where schemaname='public'"), '17', 'Baseline public table count')

    for (const artifact of artifacts.filter(({ kind }) => kind === 'incremental')) {
      applyFile(pg.psql, port, path.join(migrationsDir, artifact.file))
      result.applied.push(`${artifact.alias} ${artifact.file}`)
    }

    query(pg.psql, port, `
      create schema supabase_migrations;
      create table supabase_migrations.schema_migrations (
        version text primary key,
        statements text[] not null default '{}',
        name text
      );
      insert into supabase_migrations.schema_migrations(version, name) values
        ('20260707120336', 'fix_same_number_invoice_update_gap'),
        ('20260721183811', 'rls_clients_properties_jobs_write_fix'),
        ('20260722114751', 'close_anon_read_policies_qa_verified');
    `)

    result.publicTables = query(pg.psql, port, "select count(*) from pg_tables where schemaname='public'")
    result.invoiceSentinel = query(pg.psql, port, `
      select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='save_invoice_with_lines'
        and pg_get_functiondef(p.oid) like '%v_is_same_number_existing_update%'
    `)
    result.authenticatedPolicies = query(pg.psql, port, `
      select count(*) from pg_policies
      where schemaname='public' and policyname='Authenticated read access'
    `)
    result.metadataVersions = query(pg.psql, port, `
      select string_agg(version, ',' order by version)
      from supabase_migrations.schema_migrations
    `)
    result.baselineInMetadata = query(pg.psql, port, `
      select count(*) from supabase_migrations.schema_migrations where version='20260721134926'
    `)

    assertEqual(result.publicTables, '17', 'Final public table count')
    assertEqual(result.invoiceSentinel, '1', 'Invoice fix sentinel count')
    assertEqual(result.authenticatedPolicies, '10', 'Authenticated read policy count')
    assertEqual(result.metadataVersions, incrementalAliases.join(','), 'Simulated metadata order')
    assertEqual(result.baselineInMetadata, '0', 'Baseline metadata exclusion')
    result.ok = true
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
  } finally {
    if (started) {
      try {
        run(pg.pgCtl, ['-D', clusterDir, '-m', 'fast', '-w', 'stop'], { stdio: 'ignore' })
      } catch (error) {
        result.error = `${result.error ? `${result.error}; ` : ''}${error instanceof Error ? error.message : String(error)}`
        result.ok = false
      }
    }
    try {
      rmSync(clusterDir, { recursive: true, force: true })
      result.discarded = !existsSync(clusterDir)
    } catch (error) {
      result.error = `${result.error ? `${result.error}; ` : ''}${error instanceof Error ? error.message : String(error)}`
      result.ok = false
    }
    writePrivateReport(result)
  }

  if (!result.ok || !result.discarded) {
    fail(result.error ?? 'Local disposable proof failed or did not discard its cluster.')
  }

  console.log('PASS: local disposable PostgreSQL migration repair proof completed.')
  console.log(`PostgreSQL ${result.pgVersion}; 17 public tables; 3 unique simulated incremental versions.`)
  console.log('Temporary cluster discarded. QA and production were not contacted.')
  console.log(`Private report: ${path.relative(repoRoot, reportPath)}`)
}

main().catch((error) => {
  console.error(`BLOCKED: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
