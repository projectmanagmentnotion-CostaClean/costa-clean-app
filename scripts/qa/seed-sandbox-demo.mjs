import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { readSupabaseProjectFingerprint } from './sandboxReadiness.mjs'

const EXPECTED_REF = 'kpvvydthlxupjjqqdpxy'
const MARKER = 'QA_DEMO_20260721'
const ID_PREFIX = 'qa-demo-20260721-'
const rootDir = process.cwd()
const privateSqlDir = path.join(rootDir, '.project-agent', 'private', 'schema-export')
const reportDir = path.join(rootDir, 'qa-reports', 'private')
const dbUrlPath = path.join(privateSqlDir, 'qa-db-url.txt')
const psqlPath = process.env.QA_PSQL_PATH?.trim() || 'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe'
const mode = process.argv.includes('--apply') ? 'apply' : process.argv.includes('--dry-run') ? 'dry-run' : null

const plannedCounts = Object.freeze({
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
  if (!mode) throw new Error('Choose exactly one mode: --dry-run or --apply.')
  if (process.argv.includes('--apply') && process.argv.includes('--dry-run')) {
    throw new Error('Seed modes are mutually exclusive.')
  }
  if (process.env.QA_ENV !== 'sandbox') {
    throw new Error('Seed blocked: QA_ENV must equal sandbox.')
  }
  if (process.env.QA_SANDBOX_PROJECT_REF !== EXPECTED_REF) {
    throw new Error(`Seed blocked: QA_SANDBOX_PROJECT_REF must equal ${EXPECTED_REF}.`)
  }
  if (readSupabaseProjectFingerprint(process.env.VITE_SUPABASE_URL) !== EXPECTED_REF) {
    throw new Error('Seed blocked: VITE_SUPABASE_URL does not target the authorized QA project.')
  }
  const privilegedNames = Object.keys(process.env).filter((name) =>
    /(SERVICE_ROLE|SUPABASE_SECRET)/iu.test(name) && String(process.env[name] ?? '').trim(),
  )
  if (privilegedNames.length > 0) {
    throw new Error('Seed blocked: privileged Supabase credentials are present but are not required.')
  }
}

function parsePrivateDbUrl(raw) {
  const value = String(raw ?? '').trim()
  const url = new URL(value)
  const username = decodeURIComponent(url.username)
  const password = decodeURIComponent(url.password)
  const database = decodeURIComponent(url.pathname.replace(/^\//u, '')) || 'postgres'
  const acceptedScheme = url.protocol === 'postgres:' || url.protocol === 'postgresql:'
  const acceptedHost = url.hostname.endsWith('.pooler.supabase.com')
  const acceptedPort = url.port === '5432' || url.port === '6543'
  if (!acceptedScheme || !acceptedHost || !acceptedPort || username !== `postgres.${EXPECTED_REF}` || !password) {
    throw new Error('Seed blocked: private DB URL is not an unambiguous QA pooler connection.')
  }
  return {
    host: url.hostname,
    port: url.port,
    username,
    password,
    database,
  }
}

function extractJson(raw) {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('Private psql result did not contain JSON.')
  return JSON.parse(raw.slice(start, end + 1))
}

async function runPsql(connection, sql, label) {
  await fs.mkdir(privateSqlDir, { recursive: true })
  const sqlPath = path.join(privateSqlDir, `sandbox-seed-${label}.sql`)
  const outputPath = path.join(privateSqlDir, `sandbox-seed-${label}.out`)
  const logPath = path.join(privateSqlDir, `sandbox-seed-${label}.log`)
  await fs.writeFile(sqlPath, sql, 'utf8')
  const result = spawnSync(psqlPath, ['-X', '-q', '-t', '-A', '--set=ON_ERROR_STOP=1', `--file=${sqlPath}`], {
    cwd: rootDir,
    env: {
      ...process.env,
      PGHOST: connection.host,
      PGPORT: connection.port,
      PGUSER: connection.username,
      PGPASSWORD: connection.password,
      PGDATABASE: connection.database,
      PGSSLMODE: 'require',
    },
    encoding: 'utf8',
    timeout: 120_000,
    windowsHide: true,
  })
  await fs.writeFile(outputPath, result.stdout ?? '', 'utf8')
  await fs.writeFile(logPath, result.stderr ?? '', 'utf8')
  if (result.status !== 0) {
    throw new Error(`Seed ${label} failed. Review the ignored private log.`)
  }
  return extractJson(result.stdout ?? '')
}

const snapshotSql = `
SELECT jsonb_build_object(
  'targetValidated', current_user IN ('postgres', 'postgres.${EXPECTED_REF}'),
  'markerCounts', jsonb_build_object(
    'leads', (SELECT count(*) FROM public.leads WHERE id IN ('${ID_PREFIX}lead-new', '${ID_PREFIX}lead-convertible') AND notes LIKE '%${MARKER}%'),
    'clients', (SELECT count(*) FROM public.clients WHERE id IN ('${ID_PREFIX}client-residential', '${ID_PREFIX}client-company') AND full_name LIKE 'QA Demo Cliente %'),
    'properties', (SELECT count(*) FROM public.properties WHERE id IN ('${ID_PREFIX}property-residential', '${ID_PREFIX}property-office') AND notes LIKE '%${MARKER}%'),
    'quotes', (SELECT count(*) FROM public.quotes WHERE id IN ('${ID_PREFIX}quote-draft', '${ID_PREFIX}quote-accepted') AND notes LIKE '%${MARKER}%'),
    'quote_lines', (SELECT count(*) FROM public.quote_lines WHERE id IN ('${ID_PREFIX}quote-line-draft', '${ID_PREFIX}quote-line-accepted') AND concept LIKE '%${MARKER}%'),
    'jobs', (SELECT count(*) FROM public.jobs WHERE id IN ('${ID_PREFIX}job-scheduled', '${ID_PREFIX}job-completed') AND notes LIKE '%${MARKER}%'),
    'job_lines', (SELECT count(*) FROM public.job_lines WHERE id IN ('${ID_PREFIX}job-line-scheduled', '${ID_PREFIX}job-line-completed') AND concept LIKE '%${MARKER}%'),
    'expenses', (SELECT count(*) FROM public.expenses WHERE reference_number = '${MARKER}-EXP-001' AND notes LIKE '%${MARKER}%')
  ),
  'tableCounts', jsonb_build_object(
    'leads', (SELECT count(*) FROM public.leads),
    'clients', (SELECT count(*) FROM public.clients),
    'properties', (SELECT count(*) FROM public.properties),
    'quotes', (SELECT count(*) FROM public.quotes),
    'quote_lines', (SELECT count(*) FROM public.quote_lines),
    'jobs', (SELECT count(*) FROM public.jobs),
    'job_lines', (SELECT count(*) FROM public.job_lines),
    'expenses', (SELECT count(*) FROM public.expenses),
    'invoices', (SELECT count(*) FROM public.invoices),
    'payments', (SELECT count(*) FROM public.payments),
    'quarterly_closings', (SELECT count(*) FROM public.quarterly_closings)
  )
)::text;
`

const applySql = `
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.leads WHERE id IN ('${ID_PREFIX}lead-new', '${ID_PREFIX}lead-convertible') AND notes NOT LIKE '%${MARKER}%') THEN RAISE EXCEPTION 'Seed ID collision in leads'; END IF;
  IF EXISTS (SELECT 1 FROM public.clients WHERE id IN ('${ID_PREFIX}client-residential', '${ID_PREFIX}client-company') AND full_name NOT LIKE 'QA Demo Cliente %') THEN RAISE EXCEPTION 'Seed ID collision in clients'; END IF;
  IF EXISTS (SELECT 1 FROM public.properties WHERE id IN ('${ID_PREFIX}property-residential', '${ID_PREFIX}property-office') AND notes NOT LIKE '%${MARKER}%') THEN RAISE EXCEPTION 'Seed ID collision in properties'; END IF;
  IF EXISTS (SELECT 1 FROM public.quotes WHERE id IN ('${ID_PREFIX}quote-draft', '${ID_PREFIX}quote-accepted') AND notes NOT LIKE '%${MARKER}%') THEN RAISE EXCEPTION 'Seed ID collision in quotes'; END IF;
  IF EXISTS (SELECT 1 FROM public.jobs WHERE id IN ('${ID_PREFIX}job-scheduled', '${ID_PREFIX}job-completed') AND notes NOT LIKE '%${MARKER}%') THEN RAISE EXCEPTION 'Seed ID collision in jobs'; END IF;
END
$$;

DELETE FROM public.job_lines WHERE id IN ('${ID_PREFIX}job-line-scheduled', '${ID_PREFIX}job-line-completed') AND concept LIKE '%${MARKER}%';
DELETE FROM public.jobs WHERE id IN ('${ID_PREFIX}job-scheduled', '${ID_PREFIX}job-completed') AND notes LIKE '%${MARKER}%';
DELETE FROM public.quote_lines WHERE id IN ('${ID_PREFIX}quote-line-draft', '${ID_PREFIX}quote-line-accepted') AND concept LIKE '%${MARKER}%';
DELETE FROM public.quotes WHERE id IN ('${ID_PREFIX}quote-draft', '${ID_PREFIX}quote-accepted') AND notes LIKE '%${MARKER}%';
DELETE FROM public.properties WHERE id IN ('${ID_PREFIX}property-residential', '${ID_PREFIX}property-office') AND notes LIKE '%${MARKER}%';
DELETE FROM public.clients WHERE id IN ('${ID_PREFIX}client-residential', '${ID_PREFIX}client-company') AND full_name LIKE 'QA Demo Cliente %';
DELETE FROM public.leads WHERE id IN ('${ID_PREFIX}lead-new', '${ID_PREFIX}lead-convertible') AND notes LIKE '%${MARKER}%';
DELETE FROM public.expenses WHERE reference_number = '${MARKER}-EXP-001' AND notes LIKE '%${MARKER}%';

INSERT INTO public.leads (id, created_at, updated_at, full_name, phone, email, service_type, property_type, city, postal_code, notes, status, display_code, normalized_phone, public_intake_metadata)
VALUES
  ('${ID_PREFIX}lead-new', '2026-07-21T10:00:00Z', '2026-07-21T10:00:00Z', 'QA Demo Lead Pendiente', '000000001', 'lead.pendiente@example.com', 'standard_cleaning', 'apartment', 'Ciudad Sandbox', '00000', '${MARKER} lead nuevo pendiente', 'new', '${MARKER}-LEAD-NEW', '000000001', '{"qa_seed_id":"${MARKER}","created_by_seed":true}'::jsonb),
  ('${ID_PREFIX}lead-convertible', '2026-07-21T10:05:00Z', '2026-07-21T10:05:00Z', 'QA Demo Lead Convertible', '000000002', 'lead.convertible@example.com', 'deep_cleaning', 'office', 'Ciudad Sandbox', '00000', '${MARKER} lead contactado convertible', 'contacted', '${MARKER}-LEAD-CONVERTIBLE', '000000002', '{"qa_seed_id":"${MARKER}","created_by_seed":true}'::jsonb);

INSERT INTO public.clients (id, created_at, updated_at, full_name, phone, email, tax_id, billing_address, status, display_code)
VALUES
  ('${ID_PREFIX}client-residential', '2026-07-21T10:10:00Z', '2026-07-21T10:10:00Z', 'QA Demo Cliente Residencial', '000000101', 'residencial@example.com', 'QA-DEMO-TAX-R', 'Calle QA Demo 1, Ciudad Sandbox', 'active', '${MARKER}-CLIENT-RES'),
  ('${ID_PREFIX}client-company', '2026-07-21T10:15:00Z', '2026-07-21T10:15:00Z', 'QA Demo Cliente Empresa', '000000102', 'empresa@example.com', 'QA-DEMO-TAX-E', 'Avenida Sandbox 2, Ciudad Sandbox', 'active', '${MARKER}-CLIENT-COMPANY');

INSERT INTO public.properties (id, created_at, updated_at, client_id, name, property_type, address, city, postal_code, notes, display_code, status)
VALUES
  ('${ID_PREFIX}property-residential', '2026-07-21T10:20:00Z', '2026-07-21T10:20:00Z', '${ID_PREFIX}client-residential', 'QA Demo Vivienda', 'apartment', 'Calle QA Demo 1', 'Ciudad Sandbox', '00000', '${MARKER} inmueble residencial ficticio', '${MARKER}-PROPERTY-RES', 'active'),
  ('${ID_PREFIX}property-office', '2026-07-21T10:25:00Z', '2026-07-21T10:25:00Z', '${ID_PREFIX}client-company', 'QA Demo Oficina', 'office', 'Avenida Sandbox 2', 'Ciudad Sandbox', '00000', '${MARKER} oficina ficticia', '${MARKER}-PROPERTY-OFFICE', 'active');

INSERT INTO public.quotes (id, created_at, updated_at, client_id, property_id, status, subtotal, tax_amount, total, notes, internal_notes, display_code, pricing_metadata)
VALUES
  ('${ID_PREFIX}quote-draft', '2026-07-21T10:30:00Z', '2026-07-21T10:30:00Z', '${ID_PREFIX}client-residential', '${ID_PREFIX}property-residential', 'draft', 50.00, 10.50, 60.50, '${MARKER} presupuesto borrador', '${MARKER} solo QA', '${MARKER}-QUOTE-DRAFT', '{"qa_seed_id":"${MARKER}","created_by_seed":true}'::jsonb),
  ('${ID_PREFIX}quote-accepted', '2026-07-18T10:35:00Z', '2026-07-18T10:35:00Z', '${ID_PREFIX}client-company', '${ID_PREFIX}property-office', 'accepted', 100.00, 21.00, 121.00, '${MARKER} presupuesto aceptado listo para conversion', '${MARKER} solo QA', '${MARKER}-QUOTE-ACCEPTED', '{"qa_seed_id":"${MARKER}","created_by_seed":true}'::jsonb);

INSERT INTO public.quote_lines (id, quote_id, sort_order, concept, quantity, unit, unit_price, line_subtotal, created_at)
VALUES
  ('${ID_PREFIX}quote-line-draft', '${ID_PREFIX}quote-draft', 1, '${MARKER} Limpieza residencial demo', 1, 'servicio', 50.00, 50.00, '2026-07-21T10:31:00Z'),
  ('${ID_PREFIX}quote-line-accepted', '${ID_PREFIX}quote-accepted', 1, '${MARKER} Limpieza oficina demo', 1, 'servicio', 100.00, 100.00, '2026-07-18T10:36:00Z');

INSERT INTO public.jobs (id, created_at, updated_at, display_code, client_id, property_id, scheduled_date, status, service_type, notes, billing_concept, billing_quantity, billing_unit, billing_unit_price)
VALUES
  ('${ID_PREFIX}job-scheduled', '2026-07-21T10:40:00Z', '2026-07-21T10:40:00Z', '${MARKER}-JOB-SCHEDULED', '${ID_PREFIX}client-residential', '${ID_PREFIX}property-residential', '2026-07-25', 'scheduled', 'standard_cleaning', '${MARKER} servicio programado', '${MARKER} Limpieza programada demo', 1, 'servicio', 50.00),
  ('${ID_PREFIX}job-completed', '2026-07-15T10:45:00Z', '2026-07-15T12:00:00Z', '${MARKER}-JOB-COMPLETED', '${ID_PREFIX}client-company', '${ID_PREFIX}property-office', '2026-07-15', 'completed', 'deep_cleaning', '${MARKER} servicio completado sin factura', '${MARKER} Limpieza completada demo', 1, 'servicio', 100.00);

INSERT INTO public.job_lines (id, job_id, sort_order, concept, quantity, unit, unit_price, line_subtotal, created_at)
VALUES
  ('${ID_PREFIX}job-line-scheduled', '${ID_PREFIX}job-scheduled', 1, '${MARKER} Linea servicio programado', 1, 'servicio', 50.00, 50.00, '2026-07-21T10:41:00Z'),
  ('${ID_PREFIX}job-line-completed', '${ID_PREFIX}job-completed', 1, '${MARKER} Linea servicio completado', 1, 'servicio', 100.00, 100.00, '2026-07-15T10:46:00Z');

INSERT INTO public.expenses (id, display_code, expense_number, expense_date, supplier_name, supplier_tax_id, category, description, document_type, reference_number, payment_method, payment_status, subtotal, tax_rate, tax_amount, total, notes, document_support_status, fiscal_review_status, fiscal_risk_level)
OVERRIDING SYSTEM VALUE
VALUES ('00000000-0000-4000-8000-202607210001', '${MARKER}-EXP-001', 202607210001, '2026-07-21', 'QA Demo Proveedor Ficticio', 'QA-DEMO-SUPPLIER', 'productos_limpieza', '${MARKER} material demo', 'ticket', '${MARKER}-EXP-001', 'card', 'paid', 10.00, 21.00, 2.10, 12.10, '${MARKER} gasto sintetico', 'ticket', 'pending', 'low');

DO $$
BEGIN
  IF (SELECT count(*) FROM public.leads WHERE id LIKE '${ID_PREFIX}%') <> 2 THEN RAISE EXCEPTION 'Unexpected seeded lead count'; END IF;
  IF (SELECT count(*) FROM public.clients WHERE id LIKE '${ID_PREFIX}%') <> 2 THEN RAISE EXCEPTION 'Unexpected seeded client count'; END IF;
  IF (SELECT count(*) FROM public.properties WHERE id LIKE '${ID_PREFIX}%') <> 2 THEN RAISE EXCEPTION 'Unexpected seeded property count'; END IF;
  IF (SELECT count(*) FROM public.quotes WHERE id LIKE '${ID_PREFIX}%') <> 2 THEN RAISE EXCEPTION 'Unexpected seeded quote count'; END IF;
  IF (SELECT count(*) FROM public.quote_lines WHERE id LIKE '${ID_PREFIX}%') <> 2 THEN RAISE EXCEPTION 'Unexpected seeded quote-line count'; END IF;
  IF (SELECT count(*) FROM public.jobs WHERE id LIKE '${ID_PREFIX}%') <> 2 THEN RAISE EXCEPTION 'Unexpected seeded job count'; END IF;
  IF (SELECT count(*) FROM public.job_lines WHERE id LIKE '${ID_PREFIX}%') <> 2 THEN RAISE EXCEPTION 'Unexpected seeded job-line count'; END IF;
  IF (SELECT count(*) FROM public.expenses WHERE reference_number = '${MARKER}-EXP-001' AND notes LIKE '%${MARKER}%') <> 1 THEN RAISE EXCEPTION 'Unexpected seeded expense count'; END IF;
  IF EXISTS (SELECT 1 FROM public.invoices WHERE id LIKE '${ID_PREFIX}%') THEN RAISE EXCEPTION 'Seed must not create invoices'; END IF;
  IF EXISTS (SELECT 1 FROM public.payments WHERE id LIKE '${ID_PREFIX}%') THEN RAISE EXCEPTION 'Seed must not create payments'; END IF;
END
$$;

COMMIT;

${snapshotSql}
`

async function writeReport(report) {
  await fs.mkdir(reportDir, { recursive: true })
  const jsonPath = path.join(reportDir, 'sandbox-seed-latest.json')
  const markdownPath = path.join(reportDir, 'sandbox-seed-latest.md')
  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  const lines = [
    '# Sandbox deterministic seed report',
    '',
    `- Timestamp: \`${report.generatedAt}\``,
    `- Mode: \`${report.mode}\``,
    `- Target: QA \`${EXPECTED_REF}\``,
    `- Marker: \`${MARKER}\``,
    `- Applied: ${report.applied ? 'yes' : 'no'}`,
    `- Planned counts: \`${JSON.stringify(plannedCounts)}\``,
    `- Before marker counts: \`${JSON.stringify(report.before.markerCounts)}\``,
    `- After marker counts: \`${JSON.stringify(report.after?.markerCounts ?? report.before.markerCounts)}\``,
    '- Real data: no',
    '- Production touched: no',
    '- Invoices created: 0',
    '- Payments created: 0',
    '- Full-submit: no',
    '- Destructive reset: no',
    '',
  ]
  await fs.writeFile(markdownPath, lines.join('\n'), 'utf8')
}

async function main() {
  assertGuardrails()
  const [rawDbUrl] = await Promise.all([
    fs.readFile(dbUrlPath, 'utf8').catch(() => {
      throw new Error('Seed blocked: missing ignored private QA DB URL.')
    }),
    fs.access(psqlPath).catch(() => {
      throw new Error('Seed blocked: PostgreSQL 17 psql was not found.')
    }),
  ])
  const connection = parsePrivateDbUrl(rawDbUrl)
  const before = await runPsql(connection, snapshotSql, 'before')
  if (!before.targetValidated) throw new Error('Seed blocked: live database target validation failed.')
  const after = mode === 'apply' ? await runPsql(connection, applySql, 'apply') : null
  const expectedMatches = Object.entries(plannedCounts).every(([table, count]) =>
    Number(after?.markerCounts?.[table] ?? 0) === count,
  )
  if (mode === 'apply' && !expectedMatches) {
    throw new Error('Seed apply completed but deterministic marker counts do not match the plan.')
  }
  const report = {
    generatedAt: new Date().toISOString(),
    mode,
    projectRef: EXPECTED_REF,
    marker: MARKER,
    affectedTables: Object.keys(plannedCounts),
    plannedCounts,
    before,
    after,
    applied: mode === 'apply',
    realData: false,
    productionTouched: false,
    invoicesCreated: 0,
    paymentsCreated: 0,
    fullSubmit: false,
    destructiveReset: false,
  }
  await writeReport(report)
  process.stdout.write([
    `Destino validado: QA ${EXPECTED_REF}`,
    `Seed mode: ${mode}`,
    `Marker: ${MARKER}`,
    `Affected tables: ${Object.keys(plannedCounts).join(', ')}`,
    `Planned records: ${Object.values(plannedCounts).reduce((sum, value) => sum + value, 0)}`,
    `Existing marked records: ${Object.values(before.markerCounts).reduce((sum, value) => sum + Number(value), 0)}`,
    `Applied: ${mode === 'apply' ? 'yes' : 'no'}`,
    'Production touched: no',
    'Invoices created: 0',
    'Payments created: 0',
    'Full-submit: no',
    '',
  ].join('\n'))
}

main().catch((error) => {
  process.stderr.write(`Sandbox seed blocked: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
