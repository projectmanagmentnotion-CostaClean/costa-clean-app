import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const apply = process.argv.includes('--apply')
const verify = process.argv.includes('--verify')
const productionRef = 'wfxnwfcdjainpojhbdri'
const qaRef = 'kpvvydthlxupjjqqdpxy'
const baselineVersion = '20260721134926'
const expectedPublicSchemaSha256 = 'B4681AF0CD27471D5495E5A3C70A9916720F340653557EE6C46080B9C8C93847'

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

const publicTables = [
  'annual_closings', 'audit_events', 'clients', 'expenses', 'intake_submissions',
  'invoice_lines', 'invoices', 'job_lines', 'jobs', 'lead_drafts', 'leads',
  'payments', 'properties', 'public_gym_manual_quiz_attempts',
  'quarterly_closings', 'quote_lines', 'quotes',
]

const privateDir = path.join(repoRoot, '.project-agent/private/migration-repair')
const reportDir = path.join(repoRoot, 'qa-reports/private/migration-repair')
const backupPath = path.join(privateDir, 'prod-before-metadata-repair-20260722.sql')
const beforePath = path.join(privateDir, 'prod-before-metadata-repair-20260722.json')
const afterPath = path.join(privateDir, 'prod-after-metadata-repair-20260722.json')
const schemaBeforePath = path.join(privateDir, 'prod-public-schema-before-metadata-repair-20260722.sql')
const schemaAfterPath = path.join(privateDir, 'prod-public-schema-after-metadata-repair-20260722.sql')
const applySqlPath = path.join(privateDir, 'prod-metadata-repair-20260722.sql')
const reportPath = path.join(reportDir, 'prod-metadata-repair-20260722.md')

function fail(message) {
  throw new Error(message)
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex').toUpperCase()
}

function parseEnvFile(filePath) {
  const values = {}
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match) continue
    values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
  }
  return values
}

function assertTarget() {
  const publicEnvPath = path.join(repoRoot, '.env.local')
  const dbUrlPath = path.join(repoRoot, '.project-agent/private/schema-export/prod-db-url.txt')
  if (!existsSync(publicEnvPath) || !existsSync(dbUrlPath)) fail('Private production configuration is missing')

  const publicEnv = parseEnvFile(publicEnvPath)
  const publicUrl = new URL(publicEnv.VITE_SUPABASE_URL)
  if (publicUrl.hostname !== `${productionRef}.supabase.co` || publicUrl.hostname.includes(qaRef)) {
    fail('Public production identity guard failed')
  }

  const rawDbUrl = readFileSync(dbUrlPath, 'utf8').trim()
  if (rawDbUrl.includes(qaRef)) fail('QA ref detected in production database configuration')
  const dbUrl = new URL(rawDbUrl)
  if (!['postgres:', 'postgresql:'].includes(dbUrl.protocol)) fail('Unexpected production database protocol')
  if (!dbUrl.hostname.endsWith('.pooler.supabase.com')) fail('Unexpected production database host')
  if (decodeURIComponent(dbUrl.username) !== `postgres.${productionRef}`) fail('Private production identity guard failed')
  if (!dbUrl.password || dbUrl.pathname !== '/postgres') fail('Incomplete production database configuration')

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
  return candidates.find((candidate) => candidate === name || existsSync(candidate)) ?? fail(`${name} was not found`)
}

function runTool(command, args, pgEnv, input) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: { ...process.env, ...pgEnv },
    input,
    encoding: 'utf8',
    maxBuffer: 25 * 1024 * 1024,
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
  return `'${String(value).replaceAll("'", "''")}'`
}

function loadArtifacts() {
  return artifacts.map((artifact) => {
    const filePath = path.join(repoRoot, 'supabase/migrations', artifact.file)
    const content = readFileSync(filePath, 'utf8')
    if (sha256(Buffer.from(content, 'utf8')) !== artifact.sha256) fail(`Canonical hash mismatch for ${artifact.file}`)
    return { ...artifact, content }
  })
}

function rowCountSql() {
  return publicTables
    .map((table) => `${qLiteral(table)}, (select count(*) from public.${table})`)
    .join(',\n    ')
}

function sequenceStateSql() {
  return `coalesce((select jsonb_agg(jsonb_build_object(
    'schema', schemaname, 'name', sequencename, 'lastValue', last_value::text,
    'startValue', start_value::text, 'incrementBy', increment_by::text
  ) order by schemaname, sequencename) from pg_sequences where schemaname='public'), '[]'::jsonb)`
}

function invoiceFingerprintSql() {
  return `upper(encode(extensions.digest(convert_to(coalesce((
    select string_agg(coalesce(id,'') || '|' || coalesce(invoice_number,'') || '|' || coalesce(display_code,''), E'\\n' order by id)
    from public.invoices
  ), ''), 'UTF8'), 'sha256'), 'hex'))`
}

function snapshotSql() {
  return `begin read only;
select jsonb_build_object(
  'currentUser', current_user,
  'sessionAccepted', current_user in ('postgres', 'postgres.${productionRef}'),
  'serverMajor', current_setting('server_version_num')::integer / 10000,
  'schemaExists', exists(select 1 from pg_namespace where nspname='supabase_migrations'),
  'tableExists', to_regclass('supabase_migrations.schema_migrations') is not null,
  'publicTables', (select count(*) from pg_tables where schemaname='public'),
  'tableNames', (select jsonb_agg(tablename order by tablename) from pg_tables where schemaname='public'),
  'rowCounts', jsonb_build_object(${rowCountSql()}),
  'sequenceState', ${sequenceStateSql()},
  'invoiceIdentifierFingerprint', ${invoiceFingerprintSql()},
  'invoiceSentinel', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='save_invoice_with_lines'
      and pg_get_functiondef(p.oid) like '%v_is_same_number_existing_update%'),
  'rlsFunctionSet', (select count(distinct p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=any(array['require_authenticated_write','create_client','update_client','create_property','update_property','update_job_status','reassign_property_client_authenticated'])),
  'removedRlsPoliciesRemaining', (select count(*) from pg_policies where schemaname='public'
    and policyname=any(array['Allow public insert access on clients','Allow public update access on clients','Allow public insert access on properties','Allow public update access on properties','Allow public insert access on jobs','Allow public update access on jobs'])),
  'authenticatedPolicies', (select count(*) from pg_policies where schemaname='public' and policyname='Authenticated read access'),
  'legacyAnonWritePolicies', (select count(*) from pg_policies where schemaname='public'
    and tablename=any(array['leads','invoices','invoice_lines','payments','quotes','quote_lines','public_gym_manual_quiz_attempts'])
    and roles && array['public'::name,'anon'::name] and cmd in ('INSERT','UPDATE','DELETE')),
  'scopedAnonSelectPolicies', (select count(*) from pg_policies where schemaname='public'
    and tablename=any(array['clients','properties','leads','invoices','invoice_lines','payments','quotes','quote_lines','public_gym_manual_quiz_attempts','jobs'])
    and cmd='SELECT' and roles && array['public'::name,'anon'::name]),
  'closureFunctions', (select count(distinct p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=any(array['create_lead','update_lead','submit_public_gym_manual_quiz_attempt']))
);
rollback;`
}

function assertExpectedSnapshot(snapshot, expectMetadata) {
  if (!snapshot.sessionAccepted || snapshot.serverMajor !== 17) fail('Live production session guard failed')
  if (snapshot.publicTables !== 17 || JSON.stringify(snapshot.tableNames) !== JSON.stringify(publicTables)) fail('Public table inventory diverged')
  if (snapshot.invoiceSentinel !== 1 || snapshot.rlsFunctionSet !== 7 || snapshot.closureFunctions !== 3) fail('Migration material sentinels diverged')
  if (snapshot.removedRlsPoliciesRemaining !== 0 || snapshot.authenticatedPolicies !== 10
      || snapshot.legacyAnonWritePolicies !== 0 || snapshot.scopedAnonSelectPolicies !== 0) fail('Policy material sentinels diverged')
  if (snapshot.schemaExists !== expectMetadata || snapshot.tableExists !== expectMetadata) fail('Migration history state diverged')
}

function rollbackSql() {
  const versions = artifacts.map(({ version }) => qLiteral(version)).join(', ')
  return `-- Fresh production metadata rollback artifact generated ${new Date().toISOString()}.
-- Target: ${productionRef}. QA and all business schema/data are forbidden.
-- Pre-gate state had no supabase_migrations schema.
begin;
set local lock_timeout = '4s';
set local statement_timeout = '60s';
do $$
begin
  if current_user not in ('postgres', 'postgres.${productionRef}') then raise exception 'Production identity guard failed'; end if;
  if to_regclass('supabase_migrations.schema_migrations') is null then raise exception 'Expected metadata table is absent'; end if;
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

function repairSql(loadedArtifacts, before) {
  const values = loadedArtifacts.map((artifact, index) => {
    const tag = `$production_migration_${index + 1}$`
    if (artifact.content.includes(tag)) fail(`Dollar quote collision in ${artifact.file}`)
    return `(${qLiteral(artifact.version)}, ${qLiteral(artifact.name)}, array[${tag}${artifact.content}${tag}]::text[])`
  }).join(',\n')
  const versions = artifacts.map(({ version }) => qLiteral(version)).join(', ')
  const hashChecks = artifacts.map(({ version, sha256: expected }) => `
    or not exists(select 1 from supabase_migrations.schema_migrations where version='${version}'
      and cardinality(statements)=1
      and upper(encode(extensions.digest(convert_to(statements[1], 'UTF8'), 'sha256'), 'hex'))='${expected}')`).join('')
  const countChecks = publicTables.map((table) => `
  if (select count(*) from public.${table}) <> ${before.rowCounts[table]} then raise exception 'Row count changed: ${table}'; end if;`).join('')
  const sequenceJson = qLiteral(JSON.stringify(before.sequenceState))
  return `begin isolation level serializable;
set local lock_timeout = '4s';
set local statement_timeout = '60s';
do $$
begin
  if current_user not in ('postgres', 'postgres.${productionRef}') then raise exception 'Production identity guard failed'; end if;
  if exists(select 1 from pg_namespace where nspname='supabase_migrations') then raise exception 'Migration schema already exists'; end if;
  if (select count(*) from pg_tables where schemaname='public') <> 17 then raise exception 'Public table count changed'; end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
      and p.proname='save_invoice_with_lines' and pg_get_functiondef(p.oid) like '%v_is_same_number_existing_update%') <> 1 then
    raise exception 'Invoice sentinel changed';
  end if;
  if ${invoiceFingerprintSql()} <> '${before.invoiceIdentifierFingerprint}' then raise exception 'Invoice identifiers changed'; end if;
  if ${sequenceStateSql()} <> ${sequenceJson}::jsonb then raise exception 'Sequence state changed'; end if;${countChecks}
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
  if ${invoiceFingerprintSql()} <> '${before.invoiceIdentifierFingerprint}' then raise exception 'Invoice identifiers changed before commit'; end if;
  if ${sequenceStateSql()} <> ${sequenceJson}::jsonb then raise exception 'Sequence state changed before commit'; end if;${countChecks}
end $$;
commit;`
}

function metadataSql() {
  return `begin read only;
select coalesce(jsonb_agg(jsonb_build_object(
  'version', version, 'name', name, 'statementCount', cardinality(statements),
  'sha256', upper(encode(extensions.digest(convert_to(statements[1], 'UTF8'), 'sha256'), 'hex'))
) order by version), '[]'::jsonb) from supabase_migrations.schema_migrations;
rollback;`
}

function assertMetadata(metadata) {
  if (metadata.length !== artifacts.length) fail('Unexpected production metadata entry count')
  for (let index = 0; index < artifacts.length; index += 1) {
    const actual = metadata[index]
    const expected = artifacts[index]
    if (actual.version !== expected.version || actual.name !== expected.name
      || actual.statementCount !== 1 || actual.sha256 !== expected.sha256) fail('Production metadata does not match the canonical set')
  }
  if (metadata.some(({ version }) => version === baselineVersion)) fail('Never-push baseline was registered')
}

function verifyCurrentState(psql, pgDump, pgEnv, before) {
  const after = JSON.parse(query(psql, pgEnv, snapshotSql()).split(/\r?\n/).find((line) => line.startsWith('{')))
  assertExpectedSnapshot(after, true)
  const schemaAfter = dumpPublicSchema(pgDump, pgEnv)
  after.publicSchemaSha256 = sha256(Buffer.from(schemaAfter, 'utf8'))
  after.metadata = JSON.parse(query(psql, pgEnv, metadataSql()).split(/\r?\n/).find((line) => line.startsWith('[')))
  assertMetadata(after.metadata)

  for (const key of ['publicSchemaSha256', 'publicTables', 'tableNames', 'rowCounts', 'sequenceState',
    'invoiceIdentifierFingerprint', 'invoiceSentinel', 'rlsFunctionSet', 'removedRlsPoliciesRemaining',
    'authenticatedPolicies', 'legacyAnonWritePolicies', 'scopedAnonSelectPolicies', 'closureFunctions']) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) fail(`Post-repair state changed: ${key}`)
  }

  writeFileSync(afterPath, `${JSON.stringify(after, null, 2)}\n`, { mode: 0o600 })
  writeFileSync(schemaAfterPath, schemaAfter, { mode: 0o600 })
  writeFileSync(reportPath, `# Production Migration Metadata Repair\n\n- Result: PASS\n- Target: ${productionRef}\n- Versions: ${artifacts.map(({ version }) => version).join(', ')}\n- Baseline registered: no\n- Public schema SHA-256: ${after.publicSchemaSha256}\n- Business counts, sequences and invoice identifiers changed: no\n`, { mode: 0o600 })
  console.log('Production migration metadata repair gate: PASS')
  console.log(`Registered versions: ${artifacts.map(({ version }) => version).join(', ')}`)
  console.log(`Public schema fingerprint unchanged: ${after.publicSchemaSha256}`)
  console.log('Business counts, sequences and invoice identifiers unchanged: yes')
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
    if (!existsSync(beforePath)) fail('Private production pre-repair evidence is missing')
    const savedBefore = JSON.parse(readFileSync(beforePath, 'utf8'))
    if (savedBefore.schemaExists || savedBefore.tableExists) fail('Saved production pre-state was not metadata-empty')
    verifyCurrentState(psql, pgDump, pgEnv, savedBefore)
    return
  }

  const beforeOutput = query(psql, pgEnv, snapshotSql())
  const before = JSON.parse(beforeOutput.split(/\r?\n/).find((line) => line.startsWith('{')))
  assertExpectedSnapshot(before, false)
  const schemaBefore = dumpPublicSchema(pgDump, pgEnv)
  before.publicSchemaSha256 = sha256(Buffer.from(schemaBefore, 'utf8'))
  if (before.publicSchemaSha256 !== expectedPublicSchemaSha256) fail('Production public schema fingerprint diverged from the authorization package')

  writeFileSync(beforePath, `${JSON.stringify(before, null, 2)}\n`, { mode: 0o600 })
  writeFileSync(schemaBeforePath, schemaBefore, { mode: 0o600 })
  writeFileSync(backupPath, rollbackSql(), { mode: 0o600 })
  writeFileSync(applySqlPath, repairSql(loadedArtifacts, before), { mode: 0o600 })

  const backup = readFileSync(backupPath, 'utf8')
  if (statSync(backupPath).size <= 0 || /postgres(?:ql)?:\/\/|password\s*=|^COPY |^INSERT INTO public\./im.test(backup)) {
    fail('Private production backup safety review failed')
  }

  if (!apply) {
    console.log('Production migration metadata repair preflight: PASS (dry run; no remote write)')
    console.log(`Public schema fingerprint: ${before.publicSchemaSha256}`)
    console.log(`Private backup bytes: ${statSync(backupPath).size}`)
    return
  }

  query(psql, pgEnv, readFileSync(applySqlPath, 'utf8'))
  verifyCurrentState(psql, pgDump, pgEnv, before)
}

try {
  main()
} catch (error) {
  console.error(`Production migration metadata repair gate: FAIL - ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
