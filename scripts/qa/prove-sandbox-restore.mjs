import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { readSupabaseProjectFingerprint } from './sandboxReadiness.mjs'

const EXPECTED_REF = 'kpvvydthlxupjjqqdpxy'
const DEMO_MARKER = 'QA_DEMO_20260721'
const PROOF_MARKER = 'QA_RESTORE_PROOF_20260721'
const PROOF_ID = 'qa-restore-proof-20260721-lead'
const rootDir = process.cwd()
const privateRoot = path.join(rootDir, '.project-agent', 'private')
const dbUrlPath = path.join(privateRoot, 'schema-export', 'qa-db-url.txt')
const restoreDir = path.join(privateRoot, 'qa-restore')
const reportDir = path.join(rootDir, 'qa-reports', 'private', 'qa-restore')
const dumpPath = path.join(restoreDir, 'qa-before-restore-proof.sql')
const psqlPath = process.env.QA_PSQL_PATH?.trim() || 'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe'
const pgDumpPath = process.env.QA_PG_DUMP_PATH?.trim() || 'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe'

const expectedSeedCounts = Object.freeze({
  leads: 2,
  clients: 2,
  properties: 2,
  quotes: 2,
  quote_lines: 2,
  jobs: 2,
  job_lines: 2,
  expenses: 1,
})

function assertGuardrails() {
  if (process.env.QA_ENV !== 'sandbox') {
    throw new Error('Restore proof blocked: QA_ENV must equal sandbox.')
  }
  if (process.env.QA_SANDBOX_PROJECT_REF !== EXPECTED_REF) {
    throw new Error(`Restore proof blocked: QA_SANDBOX_PROJECT_REF must equal ${EXPECTED_REF}.`)
  }
  if (readSupabaseProjectFingerprint(process.env.VITE_SUPABASE_URL) !== EXPECTED_REF) {
    throw new Error('Restore proof blocked: public configuration does not target the authorized QA project.')
  }
  const privilegedNames = Object.keys(process.env).filter((name) =>
    /(SERVICE_ROLE|SUPABASE_SECRET)/iu.test(name) && String(process.env[name] ?? '').trim(),
  )
  if (privilegedNames.length > 0) {
    throw new Error('Restore proof blocked: privileged Supabase credentials are present but are not required.')
  }
}

function parsePrivateDbUrl(raw) {
  const url = new URL(String(raw ?? '').trim())
  const username = decodeURIComponent(url.username)
  const password = decodeURIComponent(url.password)
  const database = decodeURIComponent(url.pathname.replace(/^\//u, '')) || 'postgres'
  const acceptedScheme = url.protocol === 'postgres:' || url.protocol === 'postgresql:'
  const acceptedHost = url.hostname.endsWith('.pooler.supabase.com')
  const acceptedPort = url.port === '5432' || url.port === '6543'
  if (!acceptedScheme || !acceptedHost || !acceptedPort || username !== `postgres.${EXPECTED_REF}` || !password) {
    throw new Error('Restore proof blocked: private DB URL is not an unambiguous QA pooler connection.')
  }
  return { host: url.hostname, port: url.port, username, password, database }
}

function privatePgEnv(connection) {
  return {
    ...process.env,
    PGHOST: connection.host,
    PGPORT: connection.port,
    PGUSER: connection.username,
    PGPASSWORD: connection.password,
    PGDATABASE: connection.database,
    PGSSLMODE: 'require',
  }
}

function extractJson(raw) {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('Private psql result did not contain JSON.')
  return JSON.parse(raw.slice(start, end + 1))
}

async function runPsql(connection, sql, label) {
  const sqlPath = path.join(restoreDir, `${label}.sql`)
  const outputPath = path.join(restoreDir, `${label}.out`)
  const logPath = path.join(restoreDir, `${label}.log`)
  await fs.writeFile(sqlPath, sql, 'utf8')
  const result = spawnSync(psqlPath, ['-X', '-q', '-t', '-A', '--set=ON_ERROR_STOP=1', `--file=${sqlPath}`], {
    cwd: rootDir,
    env: privatePgEnv(connection),
    encoding: 'utf8',
    timeout: 120_000,
    windowsHide: true,
  })
  await fs.writeFile(outputPath, result.stdout ?? '', 'utf8')
  await fs.writeFile(logPath, result.stderr ?? '', 'utf8')
  if (result.status !== 0) throw new Error(`Restore proof ${label} failed. Review the ignored private log.`)
  return extractJson(result.stdout ?? '')
}

const countSql = `
CREATE TEMP TABLE qa_restore_table_counts (table_name text PRIMARY KEY, row_count bigint NOT NULL);
DO $$
DECLARE
  item record;
  current_count bigint;
BEGIN
  FOR item IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', item.tablename) INTO current_count;
    INSERT INTO qa_restore_table_counts VALUES (item.tablename, current_count);
  END LOOP;
END
$$;
SELECT jsonb_build_object(
  'targetValidated', current_user IN ('postgres', 'postgres.${EXPECTED_REF}'),
  'tableCounts', (SELECT jsonb_object_agg(table_name, row_count ORDER BY table_name) FROM qa_restore_table_counts),
  'totalPublicRows', (SELECT sum(row_count) FROM qa_restore_table_counts),
  'demoMarkerCounts', jsonb_build_object(
    'leads', (SELECT count(*) FROM public.leads WHERE id LIKE 'qa-demo-20260721-%' AND notes LIKE '%${DEMO_MARKER}%'),
    'clients', (SELECT count(*) FROM public.clients WHERE id LIKE 'qa-demo-20260721-%' AND full_name LIKE 'QA Demo Cliente %'),
    'properties', (SELECT count(*) FROM public.properties WHERE id LIKE 'qa-demo-20260721-%' AND notes LIKE '%${DEMO_MARKER}%'),
    'quotes', (SELECT count(*) FROM public.quotes WHERE id LIKE 'qa-demo-20260721-%' AND notes LIKE '%${DEMO_MARKER}%'),
    'quote_lines', (SELECT count(*) FROM public.quote_lines WHERE id LIKE 'qa-demo-20260721-%' AND concept LIKE '%${DEMO_MARKER}%'),
    'jobs', (SELECT count(*) FROM public.jobs WHERE id LIKE 'qa-demo-20260721-%' AND notes LIKE '%${DEMO_MARKER}%'),
    'job_lines', (SELECT count(*) FROM public.job_lines WHERE id LIKE 'qa-demo-20260721-%' AND concept LIKE '%${DEMO_MARKER}%'),
    'expenses', (SELECT count(*) FROM public.expenses WHERE reference_number = '${DEMO_MARKER}-EXP-001' AND notes LIKE '%${DEMO_MARKER}%')
  ),
  'proofMarkerCount', (SELECT count(*) FROM public.leads WHERE id = '${PROOF_ID}' AND notes LIKE '%${PROOF_MARKER}%'),
  'invoices', (SELECT count(*) FROM public.invoices),
  'payments', (SELECT count(*) FROM public.payments),
  'quarterlyClosings', (SELECT count(*) FROM public.quarterly_closings)
)::text;
`

const mutateSql = `
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.leads WHERE id = '${PROOF_ID}') THEN
    RAISE EXCEPTION 'Restore proof ID already exists';
  END IF;
END
$$;
INSERT INTO public.leads (
  id, created_at, updated_at, full_name, phone, email, service_type, property_type,
  city, postal_code, notes, status, display_code, normalized_phone, public_intake_metadata
)
VALUES (
  '${PROOF_ID}', '2026-07-21T12:00:00Z', '2026-07-21T12:00:00Z',
  'QA Restore Proof Temporal', '000000099', 'restore.proof@example.com',
  'standard_cleaning', 'apartment', 'Ciudad Sandbox', '00000',
  '${PROOF_MARKER} temporary lead', 'new', '${PROOF_MARKER}-LEAD', '000000099',
  '{"qa_restore_proof":"${PROOF_MARKER}"}'::jsonb
);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.leads WHERE id = '${PROOF_ID}' AND notes LIKE '%${PROOF_MARKER}%') <> 1 THEN
    RAISE EXCEPTION 'Restore proof mutation did not create exactly one marked row';
  END IF;
  IF (SELECT count(*) FROM public.leads) <> 3 THEN
    RAISE EXCEPTION 'Restore proof mutation found an unexpected lead count';
  END IF;
  IF (SELECT count(*) FROM public.invoices) <> 0
    OR (SELECT count(*) FROM public.payments) <> 0
    OR (SELECT count(*) FROM public.quarterly_closings) <> 0 THEN
    RAISE EXCEPTION 'Restore proof mutation found unexpected financial rows';
  END IF;
END
$$;
COMMIT;
${countSql}
`

const cleanupSql = `
BEGIN;
DO $$
DECLARE
  affected_rows integer;
BEGIN
  DELETE FROM public.leads
  WHERE id = '${PROOF_ID}'
    AND notes = '${PROOF_MARKER} temporary lead'
    AND public_intake_metadata ->> 'qa_restore_proof' = '${PROOF_MARKER}';
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 1 THEN
    RAISE EXCEPTION 'Restore proof cleanup expected exactly one row, got %', affected_rows;
  END IF;
END
$$;
COMMIT;
${countSql}
`

function assertBaseline(snapshot) {
  if (!snapshot.targetValidated) throw new Error('Restore proof blocked: live target validation failed.')
  for (const [table, expected] of Object.entries(expectedSeedCounts)) {
    if (Number(snapshot.demoMarkerCounts?.[table] ?? -1) !== expected) {
      throw new Error(`Restore proof blocked: ${table} demo marker count is not the approved baseline.`)
    }
    if (Number(snapshot.tableCounts?.[table] ?? -1) !== expected) {
      throw new Error(`Restore proof blocked: ${table} contains rows outside the approved synthetic baseline.`)
    }
  }
  if (Number(snapshot.totalPublicRows) !== 15) {
    throw new Error('Restore proof blocked: public schema contains rows outside the 15-row synthetic baseline.')
  }
  if (Number(snapshot.proofMarkerCount) !== 0) throw new Error('Restore proof blocked: stale proof marker exists.')
  if (Number(snapshot.invoices) !== 0 || Number(snapshot.payments) !== 0 || Number(snapshot.quarterlyClosings) !== 0) {
    throw new Error('Restore proof blocked: financial or closing rows are not zero.')
  }
}

function assertMutation(before, afterMutation) {
  if (Number(afterMutation.proofMarkerCount) !== 1) throw new Error('Temporary proof row was not created exactly once.')
  for (const [table, count] of Object.entries(before.tableCounts)) {
    const expected = table === 'leads' ? Number(count) + 1 : Number(count)
    if (Number(afterMutation.tableCounts?.[table]) !== expected) {
      throw new Error(`Unexpected row-count change in ${table}.`)
    }
  }
}

function assertRestored(before, afterCleanup) {
  if (Number(afterCleanup.proofMarkerCount) !== 0) throw new Error('Temporary proof row remains after cleanup.')
  if (JSON.stringify(afterCleanup.tableCounts) !== JSON.stringify(before.tableCounts)) {
    throw new Error('Post-cleanup table counts do not match the baseline.')
  }
  if (JSON.stringify(afterCleanup.demoMarkerCounts) !== JSON.stringify(before.demoMarkerCounts)) {
    throw new Error('Deterministic demo seed changed during restore proof.')
  }
}

async function captureDump(connection) {
  const logPath = path.join(restoreDir, 'snapshot-capture.log')
  const result = spawnSync(pgDumpPath, [
    '--format=plain',
    '--schema=public',
    '--no-owner',
    '--no-privileges',
    `--file=${dumpPath}`,
  ], {
    cwd: rootDir,
    env: privatePgEnv(connection),
    encoding: 'utf8',
    timeout: 180_000,
    windowsHide: true,
  })
  await fs.writeFile(logPath, `${result.stdout ?? ''}${result.stderr ?? ''}`, 'utf8')
  if (result.status !== 0) throw new Error('Private QA dump failed. Review the ignored private log.')
  const bytes = await fs.readFile(dumpPath)
  if (bytes.length === 0) throw new Error('Private QA dump is empty.')
  return { sizeBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }
}

async function writeJsonAndMarkdown(baseName, report, title, lines) {
  await fs.writeFile(path.join(reportDir, `${baseName}.json`), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await fs.writeFile(path.join(reportDir, `${baseName}.md`), [`# ${title}`, '', ...lines, ''].join('\n'), 'utf8')
}

async function main() {
  assertGuardrails()
  await Promise.all([fs.mkdir(restoreDir, { recursive: true }), fs.mkdir(reportDir, { recursive: true })])
  const [rawDbUrl] = await Promise.all([
    fs.readFile(dbUrlPath, 'utf8').catch(() => { throw new Error('Restore proof blocked: missing ignored private QA DB URL.') }),
    fs.access(psqlPath).catch(() => { throw new Error('Restore proof blocked: PostgreSQL 17 psql was not found.') }),
    fs.access(pgDumpPath).catch(() => { throw new Error('Restore proof blocked: PostgreSQL 17 pg_dump was not found.') }),
  ])
  const connection = parsePrivateDbUrl(rawDbUrl)
  const before = await runPsql(connection, countSql, 'baseline-before')
  assertBaseline(before)
  const dump = await captureDump(connection)
  const capturedAt = new Date().toISOString()
  const captureReport = { generatedAt: capturedAt, method: 'private-pg-dump-public', projectRef: EXPECTED_REF, before, dump, productionTouched: false }
  await writeJsonAndMarkdown('snapshot-capture-latest', captureReport, 'QA restore snapshot capture', [
    `- Timestamp: \`${capturedAt}\``,
    '- Method: private `pg_dump` of QA `public` schema and its synthetic data',
    `- Project ref: \`${EXPECTED_REF}\``,
    `- Total public rows: \`${before.totalPublicRows}\` (all deterministic synthetic seed)`,
    `- Dump size: \`${dump.sizeBytes}\` bytes`,
    `- Dump SHA-256: \`${dump.sha256}\``,
    '- Production touched: NO',
  ])

  const afterMutation = await runPsql(connection, mutateSql, 'proof-mutation')
  assertMutation(before, afterMutation)
  await fs.writeFile(path.join(reportDir, 'restore-proof-mutation-latest.md'), [
    '# QA restore proof mutation', '',
    `- Timestamp: \`${new Date().toISOString()}\``,
    `- Project ref: \`${EXPECTED_REF}\``,
    `- Marker: \`${PROOF_MARKER}\``,
    '- Change: one temporary non-financial lead inserted',
    `- Leads before/after: \`${before.tableCounts.leads}/${afterMutation.tableCounts.leads}\``,
    '- Invoices/payments/closings: `0/0/0`',
    '- Production touched: NO', '',
  ].join('\n'), 'utf8')

  const afterCleanup = await runPsql(connection, cleanupSql, 'proof-cleanup')
  assertRestored(before, afterCleanup)
  const completedAt = new Date().toISOString()
  const proofReport = {
    generatedAt: completedAt,
    method: 'deterministic-marker-cleanup',
    scope: 'one temporary lead only',
    projectRef: EXPECTED_REF,
    marker: PROOF_MARKER,
    before,
    afterMutation,
    afterCleanup,
    dump,
    fullRestoreProven: false,
    logicalCleanupProven: true,
    destructiveReset: false,
    productionTouched: false,
  }
  await writeJsonAndMarkdown('restore-proof-latest', proofReport, 'QA restore proof result', [
    `- Timestamp: \`${completedAt}\``,
    '- Mechanism proven: deterministic marker cleanup (classification C)',
    '- Full provider/dump restore proven: NO',
    '- Temporary lead created and removed: YES',
    `- Leads before/mutated/after: \`${before.tableCounts.leads}/${afterMutation.tableCounts.leads}/${afterCleanup.tableCounts.leads}\``,
    `- Total public rows before/mutated/after: \`${before.totalPublicRows}/${afterMutation.totalPublicRows}/${afterCleanup.totalPublicRows}\``,
    '- Demo seed intact: YES',
    '- Invoices/payments/closings: `0/0/0`',
    '- Destructive reset: NO',
    '- Production touched: NO',
  ])

  process.stdout.write([
    `Destino validado: QA ${EXPECTED_REF}`,
    'Private public-schema dump captured: yes',
    `Synthetic public rows captured: ${before.totalPublicRows}`,
    `Temporary marker rows before/mutated/after: ${before.proofMarkerCount}/${afterMutation.proofMarkerCount}/${afterCleanup.proofMarkerCount}`,
    `Leads before/mutated/after: ${before.tableCounts.leads}/${afterMutation.tableCounts.leads}/${afterCleanup.tableCounts.leads}`,
    'Logical cleanup proof: passed',
    'Full provider/dump restore proof: no',
    'Invoices/payments/closings: 0/0/0',
    'Destructive reset: no',
    'Production touched: no',
    '',
  ].join('\n'))
}

main().catch((error) => {
  process.stderr.write(`Sandbox restore proof blocked: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
