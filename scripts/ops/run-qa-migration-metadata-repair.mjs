import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const apply = process.argv.includes('--apply')
const verify = process.argv.includes('--verify')
const qaRef = 'kpvvydthlxupjjqqdpxy'
const productionRef = 'wfxnwfcdjainpojhbdri'
const runDate = '20260722'

const artifacts = [
  {
    version: '20260707120336',
    file: '20260707_fix_same_number_invoice_update_gap.sql',
    name: 'fix_same_number_invoice_update_gap',
    sha256: '39A435EECE213AE73553C7F33B346A1B957C2A090858EA8F29CAA1026C8EC33D',
  },
  {
    version: '20260721183811',
    file: '20260721_rls_clients_properties_jobs_write_fix.sql',
    name: 'rls_clients_properties_jobs_write_fix',
    sha256: '8D330B87CDFF30DF88346E67C8C2B72801661686A0883432D1BAEBBB4E89EFA2',
  },
  {
    version: '20260722114751',
    file: '20260722_close_anon_read_policies_qa_verified.sql',
    name: 'close_anon_read_policies_qa_verified',
    sha256: '000E04348CD7E1DBA4CC1FE3F9C9F42526C3F1D3D35C0AE9D7B2D714A4FB0C02',
  },
]

const baselineVersion = '20260721134926'
const publicTables = [
  'annual_closings',
  'audit_events',
  'clients',
  'expenses',
  'intake_submissions',
  'invoice_lines',
  'invoices',
  'job_lines',
  'jobs',
  'lead_drafts',
  'leads',
  'payments',
  'properties',
  'public_gym_manual_quiz_attempts',
  'quarterly_closings',
  'quote_lines',
  'quotes',
]

const privateDir = path.join(repoRoot, '.project-agent/private/migration-repair')
const reportDir = path.join(repoRoot, 'qa-reports/private/migration-repair')
const backupPath = path.join(privateDir, `qa-before-metadata-repair-${runDate}.sql`)
const beforePath = path.join(privateDir, `qa-before-metadata-repair-${runDate}.json`)
const afterPath = path.join(privateDir, `qa-after-metadata-repair-${runDate}.json`)
const applySqlPath = path.join(privateDir, `qa-metadata-repair-${runDate}.sql`)
const schemaBeforePath = path.join(privateDir, `qa-public-schema-before-${runDate}.sql`)
const schemaAfterPath = path.join(privateDir, `qa-public-schema-after-${runDate}.sql`)
const reportPath = path.join(reportDir, `qa-metadata-repair-${runDate}.md`)

function fail(message) {
  throw new Error(message)
}

function sha256(input) {
  return createHash('sha256').update(input).digest('hex').toUpperCase()
}

function parseEnvFile(filePath) {
  const values = {}
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match || match[1].startsWith('#')) continue
    values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
  }
  return values
}

function assertTarget() {
  const qaEnvPath = path.join(repoRoot, '.env.qa.local')
  const dbUrlPath = path.join(repoRoot, '.project-agent/private/schema-export/qa-db-url.txt')
  if (!existsSync(qaEnvPath) || !existsSync(dbUrlPath)) fail('QA private configuration is missing')

  const qaEnv = parseEnvFile(qaEnvPath)
  const publicUrl = new URL(qaEnv.VITE_SUPABASE_URL)
  if (qaEnv.QA_SANDBOX_PROJECT_REF !== qaRef || publicUrl.hostname !== `${qaRef}.supabase.co`) {
    fail('Public QA identity does not match the authorized project ref')
  }

  const rawDbUrl = readFileSync(dbUrlPath, 'utf8').trim()
  if (rawDbUrl.includes(productionRef)) fail('Production ref detected in QA database configuration')
  const dbUrl = new URL(rawDbUrl)
  if (!['postgres:', 'postgresql:'].includes(dbUrl.protocol)) fail('Unexpected QA database URL protocol')
  if (!dbUrl.hostname.endsWith('.pooler.supabase.com')) fail('Unexpected QA database host')
  if (decodeURIComponent(dbUrl.username) !== `postgres.${qaRef}`) fail('Private QA identity does not match the authorized project ref')
  if (!dbUrl.password) fail('QA database password is missing')
  if (dbUrl.pathname !== '/postgres') fail('Unexpected QA database name')

  return {
    PGHOST: dbUrl.hostname,
    PGPORT: dbUrl.port || '6543',
    PGDATABASE: 'postgres',
    PGUSER: decodeURIComponent(dbUrl.username),
    PGPASSWORD: decodeURIComponent(dbUrl.password),
    PGSSLMODE: 'require',
  }
}

function findPostgresTool(name) {
  const candidates = [
    `C:/Program Files/PostgreSQL/17/bin/${name}.exe`,
    `C:/Program Files/PostgreSQL/16/bin/${name}.exe`,
    name,
  ]
  for (const candidate of candidates) {
    if (candidate === name || existsSync(candidate)) return candidate
  }
  fail(`${name} was not found`)
}

function runTool(command, args, pgEnv, input) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: { ...process.env, ...pgEnv },
    input,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    windowsHide: true,
  })
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || 'unknown database error').trim()
    fail(`${path.basename(command)} failed: ${detail}`)
  }
  return result.stdout
}

function query(psql, pgEnv, sql) {
  return runTool(psql, ['-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], pgEnv, sql).trim()
}

function dumpPublicSchema(pgDump, pgEnv) {
  return runTool(
    pgDump,
    ['--schema-only', '--schema=public', '--no-owner', '--no-privileges', '--restrict-key=QAMetadataRepair20260722'],
    pgEnv,
  )
}

function qLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`
}

function loadArtifacts() {
  return artifacts.map((artifact) => {
    const filePath = path.join(repoRoot, 'supabase/migrations', artifact.file)
    const content = readFileSync(filePath, 'utf8')
    const actualHash = sha256(Buffer.from(content, 'utf8'))
    if (actualHash !== artifact.sha256) fail(`Canonical hash mismatch for ${artifact.file}`)
    return { ...artifact, content }
  })
}

function snapshotSql() {
  const counts = publicTables
    .map((table) => `${qLiteral(table)}, (select count(*) from public.${table})`)
    .join(',\n        ')
  return `
select jsonb_build_object(
  'currentUser', current_user,
  'sessionAccepted', current_user in ('postgres', 'postgres.${qaRef}'),
  'serverMajor', current_setting('server_version_num')::integer / 10000,
  'schemaExists', exists(select 1 from pg_namespace where nspname='supabase_migrations'),
  'tableExists', to_regclass('supabase_migrations.schema_migrations') is not null,
  'publicTables', (select count(*) from pg_tables where schemaname='public'),
  'tableNames', (select jsonb_agg(tablename order by tablename) from pg_tables where schemaname='public'),
  'rowCounts', jsonb_build_object(${counts}),
  'invoiceSentinel', (
    select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='save_invoice_with_lines'
      and pg_get_functiondef(p.oid) like '%v_is_same_number_existing_update%'
  ),
  'authenticatedPolicies', (
    select count(*) from pg_policies where schemaname='public' and policyname='Authenticated read access'
  ),
  'legacyAnonWritePolicies', (
    select count(*) from pg_policies
    where schemaname='public'
      and tablename=any(array['leads','invoices','invoice_lines','payments','quotes','quote_lines','public_gym_manual_quiz_attempts'])
      and roles && array['public'::name,'anon'::name]
      and cmd in ('INSERT','UPDATE','DELETE')
  )
);
`
}

function assertExpectedSnapshot(snapshot, expectMetadata) {
  if (!snapshot.sessionAccepted || snapshot.serverMajor < 16) fail('Live QA session identity/version guard failed')
  if (snapshot.publicTables !== publicTables.length) fail('Unexpected public table count')
  if (JSON.stringify(snapshot.tableNames) !== JSON.stringify(publicTables)) fail('Unexpected public table inventory')
  if (snapshot.invoiceSentinel !== 1) fail('Invoice migration sentinel diverged')
  if (snapshot.authenticatedPolicies !== 10) fail('Authenticated policy sentinel diverged')
  if (snapshot.legacyAnonWritePolicies !== 0) fail('Legacy anon write policies were detected')
  if (expectMetadata !== snapshot.tableExists || expectMetadata !== snapshot.schemaExists) {
    fail('Migration metadata presence diverged from the gate expectation')
  }
}

function rollbackSql() {
  const versions = artifacts.map(({ version }) => qLiteral(version)).join(', ')
  return `-- QA-only rollback artifact for migration metadata repair gate (${runDate}).
-- Target: ${qaRef}. Production is forbidden.
-- Pre-gate state had no supabase_migrations schema. This script removes only the exact gate-created schema.
begin;
set local lock_timeout = '4s';
set local statement_timeout = '60s';
do $$
begin
  if current_user not in ('postgres', 'postgres.${qaRef}') then
    raise exception 'QA identity guard failed';
  end if;
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise exception 'Expected metadata table is absent';
  end if;
  if (select count(*) from supabase_migrations.schema_migrations) <> 3
     or (select count(*) from supabase_migrations.schema_migrations where version in (${versions})) <> 3
     or exists(select 1 from supabase_migrations.schema_migrations where version='${baselineVersion}') then
    raise exception 'Metadata contents are not the exact gate-created set';
  end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='supabase_migrations' and c.relkind in ('r','p','v','m','S','f')) <> 1 then
    raise exception 'Migration schema contains unexpected relations';
  end if;
end $$;
drop schema supabase_migrations cascade;
commit;
`
}

function repairSql(loadedArtifacts) {
  const values = loadedArtifacts.map((artifact, index) => {
    const tag = `$migration_${index + 1}$`
    if (artifact.content.includes(tag)) fail(`Unsafe dollar quote collision in ${artifact.file}`)
    return `(${qLiteral(artifact.version)}, ${qLiteral(artifact.name)}, array[${tag}${artifact.content}${tag}]::text[])`
  }).join(',\n')
  const versions = artifacts.map(({ version }) => qLiteral(version)).join(', ')
  const hashChecks = artifacts.map(({ version, sha256: expected }) => `
    or not exists (
      select 1 from supabase_migrations.schema_migrations
      where version='${version}' and cardinality(statements)=1
        and upper(encode(extensions.digest(convert_to(statements[1], 'UTF8'), 'sha256'), 'hex'))='${expected}'
    )`).join('')
  return `begin;
set local lock_timeout = '4s';
set local statement_timeout = '60s';
do $$
begin
  if current_user not in ('postgres', 'postgres.${qaRef}') then raise exception 'QA identity guard failed'; end if;
  if exists(select 1 from pg_namespace where nspname='supabase_migrations') then raise exception 'Migration schema already exists'; end if;
  if (select count(*) from pg_tables where schemaname='public') <> 17 then raise exception 'Public table count guard failed'; end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='save_invoice_with_lines'
        and pg_get_functiondef(p.oid) like '%v_is_same_number_existing_update%') <> 1 then
    raise exception 'Invoice sentinel guard failed';
  end if;
  if (select count(*) from pg_policies where schemaname='public' and policyname='Authenticated read access') <> 10 then
    raise exception 'Policy sentinel guard failed';
  end if;
  if (select count(*) from pg_policies
      where schemaname='public'
        and tablename=any(array['leads','invoices','invoice_lines','payments','quotes','quote_lines','public_gym_manual_quiz_attempts'])
        and roles && array['public'::name,'anon'::name]
        and cmd in ('INSERT','UPDATE','DELETE')) <> 0 then
    raise exception 'Legacy anon write policy guard failed';
  end if;
end $$;
create schema supabase_migrations;
create table supabase_migrations.schema_migrations (
  version text not null primary key,
  statements text[],
  name text
);
insert into supabase_migrations.schema_migrations(version, name, statements) values
${values};
do $$
begin
  if (select count(*) from supabase_migrations.schema_migrations) <> 3
     or (select count(*) from supabase_migrations.schema_migrations where version in (${versions})) <> 3
     or exists(select 1 from supabase_migrations.schema_migrations where version='${baselineVersion}')${hashChecks} then
    raise exception 'Migration metadata verification failed';
  end if;
end $$;
commit;
`
}

function metadataSql() {
  return `select coalesce(jsonb_agg(jsonb_build_object(
    'version', version,
    'name', name,
    'statementCount', cardinality(statements),
    'sha256', upper(encode(extensions.digest(convert_to(statements[1], 'UTF8'), 'sha256'), 'hex'))
  ) order by version), '[]'::jsonb)
  from supabase_migrations.schema_migrations;`
}

function assertMetadata(metadata) {
  const expected = artifacts.map(({ version, name, sha256 }) => ({ version, name, statementCount: 1, sha256 }))
  if (metadata.length !== expected.length || metadata.some((row, index) =>
    row.version !== expected[index].version
    || row.name !== expected[index].name
    || row.statementCount !== expected[index].statementCount
    || row.sha256 !== expected[index].sha256
  )) fail('Post-commit metadata does not match the canonical set')
  if (metadata.some(({ version }) => version === baselineVersion)) fail('Never-push baseline was registered')
}

function verifyCurrentState(psql, pgDump, pgEnv, before) {
  const after = JSON.parse(query(psql, pgEnv, snapshotSql()))
  assertExpectedSnapshot(after, true)
  const schemaAfter = dumpPublicSchema(pgDump, pgEnv)
  after.publicSchemaSha256 = sha256(Buffer.from(schemaAfter, 'utf8'))
  const metadata = JSON.parse(query(psql, pgEnv, metadataSql()))
  after.metadata = metadata
  assertMetadata(metadata)

  if (before.publicSchemaSha256 !== after.publicSchemaSha256) fail('Public schema fingerprint changed')
  if (JSON.stringify(before.rowCounts) !== JSON.stringify(after.rowCounts)) fail('Business table row counts changed')
  for (const key of ['publicTables', 'tableNames', 'invoiceSentinel', 'authenticatedPolicies', 'legacyAnonWritePolicies']) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) fail(`Public sentinel changed: ${key}`)
  }

  writeFileSync(afterPath, `${JSON.stringify(after, null, 2)}\n`, { mode: 0o600 })
  writeFileSync(schemaAfterPath, schemaAfter, { mode: 0o600 })
  const report = `# QA Official Migration Metadata Repair Gate\n\n` +
    `- Result: PASS\n` +
    `- Target: QA \`${qaRef}\`\n` +
    `- Production touched: no\n` +
    `- Metadata created: \`supabase_migrations.schema_migrations\`\n` +
    `- Registered incremental versions: ${artifacts.map(({ version }) => `\`${version}\``).join(', ')}\n` +
    `- Never-push baseline registered: no\n` +
    `- Public schema SHA-256 before/after: \`${before.publicSchemaSha256}\`\n` +
    `- Public table counts changed: no\n` +
    `- Backup/rollback artifact: private, exact pre-gate restoration\n`
  writeFileSync(reportPath, report, { mode: 0o600 })

  console.log('QA official migration metadata repair gate: PASS')
  console.log(`Registered versions: ${artifacts.map(({ version }) => version).join(', ')}`)
  console.log(`Public schema fingerprint unchanged: ${after.publicSchemaSha256}`)
  console.log('Business table row counts unchanged: yes')
  console.log('Never-push baseline registered: no')
}

function main() {
  const pgEnv = assertTarget()
  const psql = findPostgresTool('psql')
  const pgDump = findPostgresTool('pg_dump')
  const loadedArtifacts = loadArtifacts()
  mkdirSync(privateDir, { recursive: true })
  mkdirSync(reportDir, { recursive: true })

  if (verify) {
    if (!existsSync(beforePath)) fail('Private pre-repair evidence is missing')
    const savedBefore = JSON.parse(readFileSync(beforePath, 'utf8'))
    if (savedBefore.schemaExists || savedBefore.tableExists) fail('Saved pre-repair evidence is not metadata-empty')
    verifyCurrentState(psql, pgDump, pgEnv, savedBefore)
    return
  }

  const before = JSON.parse(query(psql, pgEnv, snapshotSql()))
  assertExpectedSnapshot(before, false)
  const schemaBefore = dumpPublicSchema(pgDump, pgEnv)
  before.publicSchemaSha256 = sha256(Buffer.from(schemaBefore, 'utf8'))
  writeFileSync(beforePath, `${JSON.stringify(before, null, 2)}\n`, { mode: 0o600 })
  writeFileSync(schemaBeforePath, schemaBefore, { mode: 0o600 })
  writeFileSync(backupPath, rollbackSql(), { mode: 0o600 })
  writeFileSync(applySqlPath, repairSql(loadedArtifacts), { mode: 0o600 })

  if (!apply) {
    console.log('QA migration metadata repair preflight: PASS (dry run; no remote write)')
    console.log(`Public schema fingerprint: ${before.publicSchemaSha256}`)
    return
  }

  query(psql, pgEnv, readFileSync(applySqlPath, 'utf8'))
  verifyCurrentState(psql, pgDump, pgEnv, before)
}

try {
  main()
} catch (error) {
  console.error(`QA migration metadata repair gate: FAIL - ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
