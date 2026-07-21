import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { assertNoPrivilegedFrontendConfig, assertSandboxPublicConfig } from './qaEnvironmentGuardrails.mjs'
import { readSupabaseProjectFingerprint } from './sandboxReadiness.mjs'
import {
  buildAuthenticatedWriteHeaders,
  parsePrivateDbUrl,
  runPrivateQaQuery,
  withAuthenticatedQaSession,
} from './verify-authenticated-rls-writes.mjs'

export const EXPECTED_PROJECT_REF = 'kpvvydthlxupjjqqdpxy'
export const MARKER = 'QA_RLS_FIX_20260721'
export const IDS = Object.freeze({
  client: 'qa-rls-fix-20260721-client',
  property: 'qa-rls-fix-20260721-property',
  job: 'qa-rls-fix-20260721-job',
  jobLine: 'qa-rls-fix-20260721-job-line',
})

const DEMO_CLIENT_DESTINATION = 'qa-demo-20260721-client-company'
const EXPECTED_DEMO_COUNTS = Object.freeze({
  leads: 2,
  clients: 2,
  properties: 2,
  quotes: 2,
  quoteLines: 2,
  jobs: 2,
  jobLines: 2,
  expenses: 1,
})
const MODES = Object.freeze({
  '--dry-run': 'dry-run',
  '--apply': 'apply',
  '--cleanup': 'cleanup',
  '--verify-clean': 'verify-clean',
})

const rootDir = process.cwd()
const dbUrlPath = path.join(rootDir, '.project-agent', 'private', 'schema-export', 'qa-db-url.txt')
const reportDir = path.join(rootDir, 'qa-reports', 'private', 'rls')

export function resolveMode(args) {
  const selected = Object.entries(MODES).filter(([flag]) => args.includes(flag))
  if (selected.length !== 1) throw new Error('Choose exactly one RLS fix mode.')
  return selected[0][1]
}

export function assertRlsFixSnapshot(snapshot, { requireClean }) {
  if (!snapshot?.targetValidated) throw new Error('QA target validation failed.')
  for (const [key, expected] of Object.entries(EXPECTED_DEMO_COUNTS)) {
    if (Number(snapshot.demoMarkerCounts?.[key] ?? -1) !== expected) {
      throw new Error(`QA demo seed changed unexpectedly in ${key}.`)
    }
  }
  if (Number(snapshot.oldMarkerTotal ?? -1) !== 0) {
    throw new Error('Previous QA_AUTH_RLS_WRITE_20260721 residue is present.')
  }
  if (Number(snapshot.invoices ?? -1) !== 0
    || Number(snapshot.payments ?? -1) !== 0
    || Number(snapshot.quarterlyClosings ?? -1) !== 0) {
    throw new Error('Financial QA baseline is not 0/0/0.')
  }
  if (Number(snapshot.markerCollisionCount ?? -1) !== 0) {
    throw new Error('A deterministic RLS fix id exists without the exact marker.')
  }
  if (requireClean && Number(snapshot.markerTotal ?? -1) !== 0) {
    throw new Error(`${MARKER} cleanup incomplete: ${snapshot.markerTotal} row(s).`)
  }
  return true
}

function assertRuntime(mode) {
  assertNoPrivilegedFrontendConfig(process.env)
  assertSandboxPublicConfig(process.env)
  if (process.env.QA_ENV !== 'sandbox') throw new Error('QA_ENV must be sandbox.')
  if (process.env.QA_SANDBOX_PROJECT_REF !== EXPECTED_PROJECT_REF) throw new Error('Unexpected QA project ref.')
  if (readSupabaseProjectFingerprint(process.env.VITE_SUPABASE_URL) !== EXPECTED_PROJECT_REF) {
    throw new Error('Supabase URL does not match the authorized QA project.')
  }
  if (!Object.values(MODES).includes(mode)) throw new Error('Unsupported RLS fix mode.')
}

const snapshotSql = `
select jsonb_build_object(
  'targetValidated', current_user in ('postgres', 'postgres.${EXPECTED_PROJECT_REF}'),
  'demoMarkerCounts', jsonb_build_object(
    'leads', (select count(*) from public.leads where coalesce(notes, '') like '%QA_DEMO_20260721%'),
    'clients', (select count(*) from public.clients where id in ('qa-demo-20260721-client-residential', 'qa-demo-20260721-client-company') and full_name like 'QA Demo Cliente %'),
    'properties', (select count(*) from public.properties where coalesce(notes, '') like '%QA_DEMO_20260721%'),
    'quotes', (select count(*) from public.quotes where coalesce(notes, '') like '%QA_DEMO_20260721%'),
    'quoteLines', (select count(*) from public.quote_lines where concept like '%QA_DEMO_20260721%'),
    'jobs', (select count(*) from public.jobs where coalesce(notes, '') like '%QA_DEMO_20260721%'),
    'jobLines', (select count(*) from public.job_lines where concept like '%QA_DEMO_20260721%'),
    'expenses', (select count(*) from public.expenses where coalesce(notes, '') like '%QA_DEMO_20260721%')
  ),
  'markerTotal',
    (select count(*) from public.clients where full_name like '%${MARKER}%')
    + (select count(*) from public.properties where coalesce(notes, '') like '%${MARKER}%')
    + (select count(*) from public.jobs where coalesce(notes, '') like '%${MARKER}%')
    + (select count(*) from public.job_lines where concept like '%${MARKER}%'),
  'oldMarkerTotal',
    (select count(*) from public.clients where full_name like '%QA_AUTH_RLS_WRITE_20260721%')
    + (select count(*) from public.properties where coalesce(notes, '') like '%QA_AUTH_RLS_WRITE_20260721%')
    + (select count(*) from public.jobs where coalesce(notes, '') like '%QA_AUTH_RLS_WRITE_20260721%')
    + (select count(*) from public.job_lines where concept like '%QA_AUTH_RLS_WRITE_20260721%'),
  'markerCollisionCount',
    (select count(*) from public.clients where id = '${IDS.client}' and full_name not like '%${MARKER}%')
    + (select count(*) from public.properties where id = '${IDS.property}' and coalesce(notes, '') not like '%${MARKER}%')
    + (select count(*) from public.jobs where id = '${IDS.job}' and coalesce(notes, '') not like '%${MARKER}%')
    + (select count(*) from public.job_lines where id = '${IDS.jobLine}' and concept not like '%${MARKER}%'),
  'clientState', (select jsonb_build_object('id', id, 'fullName', full_name, 'phone', phone) from public.clients where id = '${IDS.client}'),
  'propertyState', (select jsonb_build_object('id', id, 'clientId', client_id, 'name', name, 'city', city) from public.properties where id = '${IDS.property}'),
  'jobState', (select jsonb_build_object('id', id, 'status', status) from public.jobs where id = '${IDS.job}'),
  'jobLineCount', (select count(*) from public.job_lines where id = '${IDS.jobLine}' and job_id = '${IDS.job}'),
  'invoices', (select count(*) from public.invoices),
  'payments', (select count(*) from public.payments),
  'quarterlyClosings', (select count(*) from public.quarterly_closings)
)::text;
`

const cleanupSql = `
begin;
do $$
begin
  if exists (select 1 from public.clients where id = '${IDS.client}' and full_name not like '%${MARKER}%')
    or exists (select 1 from public.properties where id = '${IDS.property}' and coalesce(notes, '') not like '%${MARKER}%')
    or exists (select 1 from public.jobs where id = '${IDS.job}' and coalesce(notes, '') not like '%${MARKER}%')
    or exists (select 1 from public.job_lines where id = '${IDS.jobLine}' and concept not like '%${MARKER}%') then
    raise exception 'Cleanup blocked by deterministic id collision';
  end if;
end
$$;
delete from public.job_lines where id = '${IDS.jobLine}' and concept like '%${MARKER}%';
delete from public.jobs where id = '${IDS.job}' and notes like '%${MARKER}%';
delete from public.properties where id = '${IDS.property}' and notes like '%${MARKER}%';
delete from public.clients where id = '${IDS.client}' and full_name like '%${MARKER}%';
commit;
${snapshotSql}
`

async function executeWrites(accessToken) {
  const headers = buildAuthenticatedWriteHeaders(
    process.env.VITE_SUPABASE_ANON_KEY,
    accessToken,
    { 'Content-Type': 'application/json' },
  )
  const request = async (label, rpc, payload) => {
    const response = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/rpc/${rpc}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
    const raw = await response.text().catch(() => '')
    let body = null
    try { body = raw ? JSON.parse(raw) : null } catch { body = raw.slice(0, 1000) }
    return {
      label,
      rpc,
      status: response.status,
      httpOk: response.ok,
      ok: response.ok,
      detail: response.ok ? null : body,
      authenticatedBearer: headers.Authorization !== `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`,
    }
  }

  const authResponse = await fetch(`${process.env.VITE_SUPABASE_URL}/auth/v1/user`, { headers })
  const result = {
    auth: {
      ok: authResponse.ok,
      status: authResponse.status,
      authenticatedBearer: headers.Authorization !== `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`,
    },
    operations: [],
  }
  if (!authResponse.ok) return result

  result.operations.push(await request('client-create', 'create_client', {
    p_client: {
      id: IDS.client,
      full_name: `${MARKER} Cliente temporal`,
      phone: '000000221',
      email: 'qa-rls-fix@example.invalid',
      status: 'active',
    },
  }))
  result.operations.push(await request('client-update', 'update_client', {
    p_client: { id: IDS.client, phone: '000000222' },
  }))
  result.operations.push(await request('property-create', 'create_property', {
    p_property: {
      id: IDS.property,
      client_id: IDS.client,
      name: `${MARKER} Propiedad temporal`,
      property_type: 'apartment',
      address: 'Calle QA RLS Fix 1',
      city: 'Ciudad Sandbox',
      postal_code: '00000',
      notes: `${MARKER} property`,
    },
  }))
  result.operations.push(await request('property-update', 'update_property', {
    p_property: { id: IDS.property, name: `${MARKER} Propiedad editada`, city: 'Ciudad Sandbox Editada' },
  }))
  result.operations.push(await request('property-reassign', 'reassign_property_client_authenticated', {
    p_property_id: IDS.property,
    p_client_id: DEMO_CLIENT_DESTINATION,
  }))
  result.operations.push(await request('job-create', 'save_job_with_lines', {
    p_job: {
      id: IDS.job,
      client_id: DEMO_CLIENT_DESTINATION,
      property_id: IDS.property,
      quote_id: null,
      scheduled_date: '2026-07-30',
      status: 'scheduled',
      service_type: 'standard_cleaning',
      billing_concept: `${MARKER} Servicio temporal`,
      billing_quantity: 1,
      billing_unit: 'servicio',
      billing_unit_price: 1,
      notes: `${MARKER} job`,
    },
    p_lines: [{
      id: IDS.jobLine,
      sort_order: 1,
      concept: `${MARKER} Linea temporal`,
      quantity: 1,
      unit: 'servicio',
      unit_price: 1,
      line_subtotal: 1,
    }],
  }))
  result.operations.push(await request('job-status-update', 'update_job_status', {
    p_job_id: IDS.job,
    p_status: 'in_progress',
  }))
  return result
}

export function reconcileResults(result, snapshot) {
  const persisted = {
    'client-create': snapshot.clientState?.id === IDS.client,
    'client-update': snapshot.clientState?.phone === '000000222',
    'property-create': snapshot.propertyState?.id === IDS.property,
    'property-update': snapshot.propertyState?.name === `${MARKER} Propiedad editada` && snapshot.propertyState?.city === 'Ciudad Sandbox Editada',
    'property-reassign': snapshot.propertyState?.clientId === DEMO_CLIENT_DESTINATION,
    'job-create': snapshot.jobState?.id === IDS.job && Number(snapshot.jobLineCount) === 1,
    'job-status-update': snapshot.jobState?.status === 'in_progress',
  }
  result.operations = result.operations.map((operation) => ({
    ...operation,
    persistedStateVerified: Boolean(persisted[operation.label]),
    ok: operation.httpOk && Boolean(persisted[operation.label]),
  }))
  return result
}

async function writeReport(report) {
  await fs.mkdir(reportDir, { recursive: true })
  const jsonPath = path.join(reportDir, `rls-fix-${report.mode}-latest.json`)
  const markdownPath = path.join(reportDir, `rls-fix-${report.mode}-latest.md`)
  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  if (report.mode === 'verify-clean') {
    await fs.writeFile(path.join(reportDir, 'rls-fix-verify-latest.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  }
  await fs.writeFile(markdownPath, [
    '# QA RLS fix verification',
    '',
    `- Mode: \`${report.mode}\``,
    `- Project: \`${EXPECTED_PROJECT_REF}\``,
    `- Marker: \`${MARKER}\``,
    `- Auth: HTTP ${report.auth?.status ?? 'not required'}`,
    ...(report.operations ?? []).map((operation) => `- ${operation.label}: HTTP ${operation.status} ${operation.ok ? 'pass' : 'fail'}`),
    `- Marker rows after command: ${report.after.markerTotal}`,
    `- Seed intact: ${report.seedIntact ? 'yes' : 'no'}`,
    `- invoices/payments/quarterly_closings: ${report.after.invoices}/${report.after.payments}/${report.after.quarterlyClosings}`,
    '- Production touched: no',
    '- Service role used: no',
    '',
  ].join('\n'), 'utf8')
}

async function main() {
  const mode = resolveMode(process.argv.slice(2))
  assertRuntime(mode)
  const connection = parsePrivateDbUrl(await fs.readFile(dbUrlPath, 'utf8'))
  const before = await runPrivateQaQuery(connection, snapshotSql, `rls-fix-${mode}-before`)
  assertRlsFixSnapshot(before, { requireClean: mode !== 'cleanup' })

  let auth = null
  let operations = []
  let after = before
  if (mode === 'apply') {
    const authenticated = await withAuthenticatedQaSession(executeWrites)
    auth = authenticated.auth
    operations = authenticated.operations
    after = await runPrivateQaQuery(connection, snapshotSql, 'rls-fix-apply-after')
    reconcileResults(authenticated, after)
    operations = authenticated.operations
  } else if (mode === 'cleanup') {
    after = await runPrivateQaQuery(connection, cleanupSql, 'rls-fix-cleanup')
    assertRlsFixSnapshot(after, { requireClean: true })
  } else if (mode === 'verify-clean') {
    assertRlsFixSnapshot(after, { requireClean: true })
  }

  const seedIntact = Object.entries(EXPECTED_DEMO_COUNTS).every(([key, expected]) =>
    Number(after.demoMarkerCounts?.[key] ?? -1) === expected,
  )
  const report = {
    generatedAt: new Date().toISOString(),
    mode,
    projectRef: EXPECTED_PROJECT_REF,
    marker: MARKER,
    before,
    auth,
    operations,
    after,
    seedIntact,
    productionTouched: false,
    serviceRoleUsed: false,
    financialWrites: false,
  }
  await writeReport(report)

  process.stdout.write([
    `Destination: QA ${EXPECTED_PROJECT_REF}`,
    `Mode: ${mode}`,
    `Marker: ${MARKER}`,
    ...(auth ? [`Auth session: HTTP ${auth.status}`, `Bearer differs from anon: ${auth.authenticatedBearer ? 'yes' : 'no'}`] : []),
    ...operations.map((operation) => `${operation.label}: HTTP ${operation.status} ${operation.ok ? 'pass' : 'fail'}`),
    `Marker rows after command: ${after.markerTotal}`,
    `QA demo seed intact: ${seedIntact ? 'yes' : 'no'}`,
    `Invoices/payments/quarterly_closings: ${after.invoices}/${after.payments}/${after.quarterlyClosings}`,
    'Production touched: no',
    '',
  ].join('\n'))

  if (mode === 'apply' && (!auth?.ok || operations.some((operation) => !operation.ok))) {
    throw new Error('One or more authenticated RPC writes failed. Run cleanup before continuing.')
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((error) => {
    process.stderr.write(`RLS fix verification failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
