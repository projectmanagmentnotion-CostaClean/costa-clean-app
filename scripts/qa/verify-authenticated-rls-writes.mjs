import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  CdpConnection,
  assertExpectedAppIdentity,
  closeBrowserSession,
  detectBrowserExecutable,
  findFreePort,
  getQaPaths,
  launchQaBrowser,
  openBrowserSession,
  readAuthStateMetadata,
  waitForCdpEndpoint,
} from './auth/cdpHarness.mjs'
import { assertNoPrivilegedFrontendConfig, assertSandboxPublicConfig } from './qaEnvironmentGuardrails.mjs'
import { readSupabaseProjectFingerprint } from './sandboxReadiness.mjs'

export const EXPECTED_PROJECT_REF = 'kpvvydthlxupjjqqdpxy'
export const MARKER = 'QA_AUTH_RLS_WRITE_20260721'

const ID_PREFIX = 'qa-auth-rls-write-20260721-'
const IDS = Object.freeze({
  client: `${ID_PREFIX}client`,
  propertyCreate: `${ID_PREFIX}property-create`,
  propertyFixture: `${ID_PREFIX}property-fixture`,
  job: `${ID_PREFIX}job`,
  jobLine: `${ID_PREFIX}job-line`,
})
const DEMO = Object.freeze({
  clientResidential: 'qa-demo-20260721-client-residential',
  clientCompany: 'qa-demo-20260721-client-company',
  propertyOffice: 'qa-demo-20260721-property-office',
})
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
const MODE_FLAGS = Object.freeze({
  '--dry-run': 'dry-run',
  '--apply': 'apply',
  '--cleanup': 'cleanup',
  '--verify-clean': 'verify-clean',
})

const rootDir = process.cwd()
const privateDir = path.join(rootDir, '.project-agent', 'private', 'auth-rls-write')
const reportDir = path.join(rootDir, 'qa-reports', 'private', 'auth-rls-write')
const dbUrlPath = path.join(rootDir, '.project-agent', 'private', 'schema-export', 'qa-db-url.txt')
const psqlPath = process.env.QA_PSQL_PATH?.trim() || 'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe'

export function resolveAuthenticatedRlsMode(args) {
  const selected = Object.entries(MODE_FLAGS).filter(([flag]) => args.includes(flag))
  if (selected.length !== 1) {
    throw new Error('Choose exactly one mode: --dry-run, --apply, --cleanup, or --verify-clean.')
  }
  return selected[0][1]
}

export function buildAuthenticatedWriteHeaders(supabaseAnonKey, accessToken, extra = {}) {
  const normalizedToken = String(accessToken ?? '').trim()
  const normalizedAnonKey = String(supabaseAnonKey ?? '').trim()
  if (!normalizedToken) throw new Error('Authenticated QA session token is missing.')
  if (!normalizedAnonKey) throw new Error('Supabase anon key is missing.')
  if (normalizedToken === normalizedAnonKey) {
    throw new Error('Authenticated write blocked: anon key cannot be used as bearer.')
  }
  return {
    ...extra,
    apikey: normalizedAnonKey,
    Authorization: `Bearer ${normalizedToken}`,
  }
}

export function assertSafeSnapshot(snapshot, { requireCleanMarker }) {
  if (!snapshot?.targetValidated) throw new Error('QA database target validation failed.')
  for (const [table, expected] of Object.entries(EXPECTED_DEMO_COUNTS)) {
    if (Number(snapshot.demoMarkerCounts?.[table] ?? -1) !== expected) {
      throw new Error(`QA demo seed changed unexpectedly in ${table}.`)
    }
  }
  if (Number(snapshot.invoices ?? -1) !== 0
    || Number(snapshot.payments ?? -1) !== 0
    || Number(snapshot.quarterlyClosings ?? -1) !== 0) {
    throw new Error('Financial tables are not at the required 0/0/0 QA baseline.')
  }
  if (Number(snapshot.markerCollisionCount ?? -1) !== 0) {
    throw new Error('A deterministic QA auth/RLS ID exists without the required marker.')
  }
  if (requireCleanMarker && Number(snapshot.markerTotal ?? -1) !== 0) {
    throw new Error(`QA auth/RLS marker cleanup is incomplete: ${snapshot.markerTotal} row(s) remain.`)
  }
  return true
}

function assertRuntimeGuardrails(mode) {
  assertNoPrivilegedFrontendConfig(process.env)
  assertSandboxPublicConfig(process.env)
  if (process.env.QA_ENV !== 'sandbox') {
    throw new Error('Authenticated RLS verification requires QA_ENV=sandbox.')
  }
  if (process.env.QA_SANDBOX_PROJECT_REF !== EXPECTED_PROJECT_REF) {
    throw new Error(`QA_SANDBOX_PROJECT_REF must equal ${EXPECTED_PROJECT_REF}.`)
  }
  if (readSupabaseProjectFingerprint(process.env.VITE_SUPABASE_URL) !== EXPECTED_PROJECT_REF) {
    throw new Error('VITE_SUPABASE_URL does not target the authorized QA project.')
  }
  if (!Object.values(MODE_FLAGS).includes(mode)) throw new Error(`Unsupported mode ${mode}.`)
}

export function parsePrivateDbUrl(raw) {
  const url = new URL(String(raw ?? '').trim())
  const username = decodeURIComponent(url.username)
  const password = decodeURIComponent(url.password)
  const database = decodeURIComponent(url.pathname.replace(/^\//u, '')) || 'postgres'
  const acceptedScheme = url.protocol === 'postgres:' || url.protocol === 'postgresql:'
  const acceptedHost = url.hostname.endsWith('.pooler.supabase.com')
  const acceptedPort = url.port === '5432' || url.port === '6543'
  if (!acceptedScheme || !acceptedHost || !acceptedPort || username !== `postgres.${EXPECTED_PROJECT_REF}` || !password) {
    throw new Error('Private cleanup connection is not an unambiguous QA pooler target.')
  }
  return { host: url.hostname, port: url.port, username, password, database }
}

export function privatePgEnv(connection) {
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
  if (start < 0 || end <= start) throw new Error('Private QA query did not return JSON.')
  return JSON.parse(raw.slice(start, end + 1))
}

export async function runPrivateQaQuery(connection, sql, label) {
  await fs.mkdir(privateDir, { recursive: true })
  const sqlPath = path.join(privateDir, `${label}.sql`)
  const outputPath = path.join(privateDir, `${label}.out`)
  const logPath = path.join(privateDir, `${label}.log`)
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
  if (result.status !== 0) {
    throw new Error(`Private QA ${label} failed. Review the ignored private log.`)
  }
  return extractJson(result.stdout ?? '')
}

const snapshotSql = `
SELECT jsonb_build_object(
  'targetValidated', current_user IN ('postgres', 'postgres.${EXPECTED_PROJECT_REF}'),
  'demoMarkerCounts', jsonb_build_object(
    'leads', (SELECT count(*) FROM public.leads WHERE id LIKE 'qa-demo-20260721-%' AND notes LIKE '%QA_DEMO_20260721%'),
    'clients', (SELECT count(*) FROM public.clients WHERE id IN ('qa-demo-20260721-client-residential', 'qa-demo-20260721-client-company') AND full_name LIKE 'QA Demo Cliente %'),
    'properties', (SELECT count(*) FROM public.properties WHERE id LIKE 'qa-demo-20260721-%' AND notes LIKE '%QA_DEMO_20260721%'),
    'quotes', (SELECT count(*) FROM public.quotes WHERE id LIKE 'qa-demo-20260721-%' AND notes LIKE '%QA_DEMO_20260721%'),
    'quoteLines', (SELECT count(*) FROM public.quote_lines WHERE id LIKE 'qa-demo-20260721-%' AND concept LIKE '%QA_DEMO_20260721%'),
    'jobs', (SELECT count(*) FROM public.jobs WHERE id LIKE 'qa-demo-20260721-%' AND notes LIKE '%QA_DEMO_20260721%'),
    'jobLines', (SELECT count(*) FROM public.job_lines WHERE id LIKE 'qa-demo-20260721-%' AND concept LIKE '%QA_DEMO_20260721%'),
    'expenses', (SELECT count(*) FROM public.expenses WHERE reference_number = 'QA_DEMO_20260721-EXP-001' AND notes LIKE '%QA_DEMO_20260721%')
  ),
  'markerCounts', jsonb_build_object(
    'clients', (SELECT count(*) FROM public.clients WHERE id = '${IDS.client}' AND full_name LIKE '%${MARKER}%'),
    'properties', (SELECT count(*) FROM public.properties WHERE id IN ('${IDS.propertyCreate}', '${IDS.propertyFixture}') AND notes LIKE '%${MARKER}%'),
    'jobs', (SELECT count(*) FROM public.jobs WHERE id = '${IDS.job}' AND notes LIKE '%${MARKER}%'),
    'jobLines', (SELECT count(*) FROM public.job_lines WHERE id = '${IDS.jobLine}' AND concept LIKE '%${MARKER}%')
  ),
  'markerTotal',
    (SELECT count(*) FROM public.clients WHERE id = '${IDS.client}' AND full_name LIKE '%${MARKER}%')
    + (SELECT count(*) FROM public.properties WHERE id IN ('${IDS.propertyCreate}', '${IDS.propertyFixture}') AND notes LIKE '%${MARKER}%')
    + (SELECT count(*) FROM public.jobs WHERE id = '${IDS.job}' AND notes LIKE '%${MARKER}%')
    + (SELECT count(*) FROM public.job_lines WHERE id = '${IDS.jobLine}' AND concept LIKE '%${MARKER}%'),
  'markerCollisionCount',
    (SELECT count(*) FROM public.clients WHERE id = '${IDS.client}' AND full_name NOT LIKE '%${MARKER}%')
    + (SELECT count(*) FROM public.properties WHERE id IN ('${IDS.propertyCreate}', '${IDS.propertyFixture}') AND coalesce(notes, '') NOT LIKE '%${MARKER}%')
    + (SELECT count(*) FROM public.jobs WHERE id = '${IDS.job}' AND coalesce(notes, '') NOT LIKE '%${MARKER}%')
    + (SELECT count(*) FROM public.job_lines WHERE id = '${IDS.jobLine}' AND concept NOT LIKE '%${MARKER}%'),
  'clientState', (SELECT jsonb_build_object('id', id, 'fullName', full_name) FROM public.clients WHERE id = '${IDS.client}'),
  'propertyCreateState', (SELECT jsonb_build_object('id', id, 'name', name, 'clientId', client_id) FROM public.properties WHERE id = '${IDS.propertyCreate}'),
  'propertyFixtureState', (SELECT jsonb_build_object('id', id, 'name', name, 'city', city, 'clientId', client_id) FROM public.properties WHERE id = '${IDS.propertyFixture}'),
  'jobState', (SELECT jsonb_build_object('id', id, 'status', status, 'notes', notes) FROM public.jobs WHERE id = '${IDS.job}'),
  'jobLineCount', (SELECT count(*) FROM public.job_lines WHERE id = '${IDS.jobLine}' AND job_id = '${IDS.job}' AND concept LIKE '%${MARKER}%'),
  'invoices', (SELECT count(*) FROM public.invoices),
  'payments', (SELECT count(*) FROM public.payments),
  'quarterlyClosings', (SELECT count(*) FROM public.quarterly_closings)
)::text;
`

const cleanupSql = `
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.clients WHERE id = '${IDS.client}' AND full_name NOT LIKE '%${MARKER}%')
    OR EXISTS (SELECT 1 FROM public.properties WHERE id IN ('${IDS.propertyCreate}', '${IDS.propertyFixture}') AND coalesce(notes, '') NOT LIKE '%${MARKER}%')
    OR EXISTS (SELECT 1 FROM public.jobs WHERE id = '${IDS.job}' AND coalesce(notes, '') NOT LIKE '%${MARKER}%')
    OR EXISTS (SELECT 1 FROM public.job_lines WHERE id = '${IDS.jobLine}' AND concept NOT LIKE '%${MARKER}%') THEN
    RAISE EXCEPTION 'Cleanup blocked by deterministic ID collision';
  END IF;
END
$$;
DELETE FROM public.job_lines WHERE id = '${IDS.jobLine}' AND job_id = '${IDS.job}' AND concept LIKE '%${MARKER}%';
DELETE FROM public.jobs WHERE id = '${IDS.job}' AND notes LIKE '%${MARKER}%';
DELETE FROM public.properties WHERE id IN ('${IDS.propertyCreate}', '${IDS.propertyFixture}') AND notes LIKE '%${MARKER}%';
DELETE FROM public.clients WHERE id = '${IDS.client}' AND full_name LIKE '%${MARKER}%';
COMMIT;
${snapshotSql}
`

const prepareFixtureSql = `
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.properties WHERE id IN ('${IDS.propertyCreate}', '${IDS.propertyFixture}')) THEN
    RAISE EXCEPTION 'Property test fixture IDs must be absent before apply';
  END IF;
END
$$;
INSERT INTO public.properties (
  id, client_id, name, property_type, address, city, postal_code, notes, display_code, status
) VALUES (
  '${IDS.propertyFixture}', '${DEMO.clientResidential}', '${MARKER} Property operator fixture',
  'apartment', 'Calle QA Auth RLS Fixture 1', 'Ciudad Sandbox', '00000',
  '${MARKER} operator fixture for authenticated edit/reassign only', '${MARKER}-PROPERTY-FIXTURE', 'active'
);
COMMIT;
${snapshotSql}
`

function readSessionFromStorageEntries(entries) {
  for (const [key, raw] of entries) {
    if (!key.startsWith('sb-') || !key.endsWith('-auth-token')) continue
    try {
      const parsed = JSON.parse(raw)
      const session = parsed?.currentSession ?? parsed?.session ?? parsed
      const accessToken = session?.access_token || ''
      const refreshToken = session?.refresh_token || ''
      if (accessToken) return { key, parsed, session, accessToken, refreshToken }
    } catch {
      continue
    }
  }
  throw new Error('Authenticated QA session is not available in the sandbox browser profile.')
}

async function refreshQaSession(refreshToken) {
  if (!refreshToken) throw new Error('QA session is expired and no refresh token is available.')
  const response = await fetch(`${process.env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      apikey: process.env.VITE_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  if (!response.ok) throw new Error(`QA session refresh failed with HTTP ${response.status}.`)
  const refreshed = await response.json()
  if (!refreshed?.access_token || !refreshed?.refresh_token) {
    throw new Error('QA session refresh did not return a complete session.')
  }
  return refreshed
}

function mergeRefreshedSession(storedSession, refreshed) {
  if (storedSession.parsed?.currentSession) {
    return { ...storedSession.parsed, currentSession: { ...storedSession.session, ...refreshed } }
  }
  if (storedSession.parsed?.session) {
    return { ...storedSession.parsed, session: { ...storedSession.session, ...refreshed } }
  }
  return { ...storedSession.parsed, ...refreshed }
}

async function executeAuthenticatedOperations(mode, accessToken) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
  const baseHeaders = buildAuthenticatedWriteHeaders(supabaseAnonKey, accessToken, {
    'Content-Type': 'application/json',
  })
  async function request(label, requestPath, init = {}) {
    const response = await fetch(`${supabaseUrl}${requestPath}`, {
      ...init,
      headers: { ...baseHeaders, ...(init.headers ?? {}) },
    })
    const rawBody = await response.text().catch(() => '')
    let parsedBody = null
    let detail = null
    if (rawBody) {
      try {
        parsedBody = JSON.parse(rawBody)
      } catch {
        parsedBody = rawBody.slice(0, 1000)
      }
    }
    if (!response.ok) detail = parsedBody
    return {
      label,
      ok: response.ok,
      httpOk: response.ok,
      status: response.status,
      statusText: response.statusText,
      detail,
      returnedRows: Array.isArray(parsedBody) ? parsedBody.length : null,
      authenticatedBearer: baseHeaders.Authorization !== `Bearer ${supabaseAnonKey}`,
    }
  }

  const authResponse = await request('auth-session', '/auth/v1/user', { method: 'GET' })
  const result = {
    auth: {
      ok: authResponse.ok,
      status: authResponse.status,
      authenticatedBearer: authResponse.authenticatedBearer,
    },
    operations: [],
  }
  if (!authResponse.ok || mode !== 'apply') return result

  const clientCreate = await request('client-create', '/rest/v1/clients?select=id', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      id: IDS.client,
      full_name: `${MARKER} Cliente temporal`,
      phone: '000000201',
      email: 'qa-auth-rls-write@example.com',
      status: 'active',
    }),
  })
  result.operations.push(clientCreate)

  const propertyCreate = await request('property-create', '/rest/v1/properties?select=id,client_id,name,city', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      id: IDS.propertyCreate,
      client_id: DEMO.clientResidential,
      name: `${MARKER} Propiedad temporal`,
      property_type: 'apartment',
      address: 'Calle QA Auth RLS 1',
      city: 'Ciudad Sandbox',
      postal_code: '00000',
      notes: `${MARKER} property create`,
    }),
  })
  result.operations.push(propertyCreate)

  result.operations.push(await request('property-edit', `/rest/v1/properties?id=eq.${encodeURIComponent(IDS.propertyFixture)}&select=id,name,city`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ name: `${MARKER} Propiedad editada`, city: 'Ciudad Sandbox Editada' }),
  }))
  result.operations.push(await request('property-reassign', '/rest/v1/rpc/reassign_property_client', {
    method: 'POST',
    body: JSON.stringify({ p_property_id: IDS.propertyFixture, p_client_id: DEMO.clientCompany }),
  }))

  const jobCreate = await request('job-create-rpc', '/rest/v1/rpc/save_job_with_lines', {
    method: 'POST',
    body: JSON.stringify({
      p_job: {
        id: IDS.job,
        client_id: DEMO.clientCompany,
        property_id: DEMO.propertyOffice,
        quote_id: null,
        scheduled_date: '2026-07-30',
        status: 'scheduled',
        service_type: 'standard_cleaning',
        billing_concept: `${MARKER} Servicio temporal`,
        billing_quantity: 1,
        billing_unit: 'servicio',
        billing_unit_price: 1,
        notes: `${MARKER} job create`,
      },
      p_lines: [{
        id: IDS.jobLine,
        job_id: IDS.job,
        sort_order: 1,
        concept: `${MARKER} Linea temporal`,
        quantity: 1,
        unit: 'servicio',
        unit_price: 1,
        line_subtotal: 1,
      }],
    }),
  })
  result.operations.push(jobCreate)

  if (jobCreate.ok) {
    result.operations.push(await request('job-status-update', `/rest/v1/jobs?id=eq.${encodeURIComponent(IDS.job)}&select=id,status`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ status: 'in_progress' }),
    }))
  } else {
    result.operations.push({ label: 'job-status-update', ok: false, skipped: true, reason: 'job-create-rpc failed' })
  }
  return result
}

export function reconcileAuthenticatedApplyResults(browser, snapshot) {
  const verificationByLabel = {
    'client-create': Boolean(snapshot.clientState?.id === IDS.client),
    'property-create': Boolean(snapshot.propertyCreateState?.id === IDS.propertyCreate),
    'property-edit': Boolean(
      snapshot.propertyFixtureState?.name === `${MARKER} Propiedad editada`
      && snapshot.propertyFixtureState?.city === 'Ciudad Sandbox Editada',
    ),
    'property-reassign': Boolean(snapshot.propertyFixtureState?.clientId === DEMO.clientCompany),
    'job-create-rpc': Boolean(snapshot.jobState?.id === IDS.job && Number(snapshot.jobLineCount) === 1),
    'job-status-update': Boolean(snapshot.jobState?.status === 'in_progress'),
  }
  browser.operations = browser.operations.map((operation) => {
    const verified = verificationByLabel[operation.label]
    if (typeof verified !== 'boolean') return operation
    return {
      ...operation,
      ok: Boolean(operation.httpOk ?? operation.ok) && verified,
      persistedStateVerified: verified,
      verificationError: verified ? null : 'Expected persisted state was not observed.',
    }
  })
  return browser
}

export async function withAuthenticatedQaSession(execute) {
  const qaPaths = getQaPaths(rootDir)
  const storedState = await readAuthStateMetadata(qaPaths.stateFile).catch(() => {
    throw new Error('Missing sandbox auth metadata. Run npm run qa:auth:sandbox first.')
  })
  const appUrl = process.env.QA_APP_URL?.trim() || storedState.appUrl
  const browser = await detectBrowserExecutable()
  const remoteDebuggingPort = Number.parseInt(process.env.QA_REMOTE_DEBUGGING_PORT ?? '', 10) || await findFreePort()
  const browserLaunch = process.env.QA_REMOTE_DEBUGGING_PORT
    ? { remoteDebuggingPort, reusedExistingBrowser: true }
    : await launchQaBrowser({
      executablePath: browser.executablePath,
      profileDir: storedState.profileDir,
      remoteDebuggingPort,
      startUrl: appUrl,
      headless: process.argv.includes('--headless'),
    })
  const endpoint = await waitForCdpEndpoint(browserLaunch.remoteDebuggingPort, 20_000)
  const connection = new CdpConnection(endpoint.webSocketDebuggerUrl)
  let session = null
  let storageSession = null
  try {
    await connection.connect()
    session = await openBrowserSession(connection, appUrl)
    await assertExpectedAppIdentity(connection, session.sessionId)
    const authOrigin = new URL(storedState.appUrl).origin
    storageSession = await openBrowserSession(connection, 'about:blank')
    await connection.send('Fetch.enable', {
      patterns: [{ urlPattern: `${authOrigin}/*`, resourceType: 'Document', requestStage: 'Request' }],
    }, storageSession.sessionId)
    const isolatedDocumentReady = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out creating isolated auth storage frame.')), 10_000)
      connection.on('Fetch.requestPaused', (params) => {
        if (!params?.request?.url?.startsWith(authOrigin)) return
        void connection.send('Fetch.fulfillRequest', {
          requestId: params.requestId,
          responseCode: 200,
          responseHeaders: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }],
          body: Buffer.from('<!doctype html><title>QA auth storage isolation</title>').toString('base64'),
        }, storageSession.sessionId).then(() => {
          clearTimeout(timeout)
          resolve()
        }).catch((error) => {
          clearTimeout(timeout)
          reject(error)
        })
      })
    })
    await connection.send('Page.navigate', { url: `${authOrigin}/` }, storageSession.sessionId)
    await isolatedDocumentReady
    await connection.send('DOMStorage.enable', {}, storageSession.sessionId)
    const storage = await connection.send('DOMStorage.getDOMStorageItems', {
      storageId: { securityOrigin: authOrigin, isLocalStorage: true },
    }, storageSession.sessionId)
    const storedSession = readSessionFromStorageEntries(storage.entries ?? [])
    let result = await execute(storedSession.accessToken)
    if (!result.auth.ok && storedSession.refreshToken) {
      const refreshed = await refreshQaSession(storedSession.refreshToken)
      await connection.send('DOMStorage.setDOMStorageItem', {
        storageId: { securityOrigin: authOrigin, isLocalStorage: true },
        key: storedSession.key,
        value: JSON.stringify(mergeRefreshedSession(storedSession, refreshed)),
      }, storageSession.sessionId)
      result = await execute(refreshed.access_token)
    }
    return result
  } finally {
    if (storageSession) await closeBrowserSession(connection, storageSession.targetId, storageSession.sessionId)
    if (session) await closeBrowserSession(connection, session.targetId, session.sessionId)
    await connection.close()
  }
}

async function runAuthenticatedBrowserChecks(mode) {
  return withAuthenticatedQaSession((accessToken) => executeAuthenticatedOperations(mode, accessToken))
}

async function writeReport(report) {
  await fs.mkdir(reportDir, { recursive: true })
  const jsonPath = path.join(reportDir, 'authenticated-rls-write-latest.json')
  const markdownPath = path.join(reportDir, 'authenticated-rls-write-latest.md')
  const modeJsonPath = path.join(reportDir, `authenticated-rls-write-${report.mode}.json`)
  const modeMarkdownPath = path.join(reportDir, `authenticated-rls-write-${report.mode}.md`)
  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  const operationLines = report.browser.operations.length > 0
    ? report.browser.operations.map((operation) =>
      `- ${operation.label}: ${operation.skipped ? `skipped (${operation.reason})` : `HTTP ${operation.status} ${operation.ok ? 'pass' : 'fail'}`}`,
    )
    : ['- No write operations executed.']
  const lines = [
    '# Authenticated RLS write verification',
    '',
    `- Generated: \`${report.generatedAt}\``,
    `- Mode: \`${report.mode}\``,
    `- Project: QA \`${EXPECTED_PROJECT_REF}\``,
    `- Marker: \`${MARKER}\``,
    `- Auth endpoint: HTTP ${report.browser.auth.status}`,
    `- Authenticated bearer differs from anon: ${report.browser.auth.authenticatedBearer ? 'yes' : 'no'}`,
    ...operationLines,
    `- Marker rows after command: ${report.after.markerTotal}`,
    `- Demo seed intact: ${report.seedIntact ? 'yes' : 'no'}`,
    `- Invoices/payments/quarterly closings: ${report.after.invoices}/${report.after.payments}/${report.after.quarterlyClosings}`,
    '- Production touched: no',
    '- Service role used: no',
    '- Financial writes: no',
    '',
  ]
  await fs.writeFile(markdownPath, lines.join('\n'), 'utf8')
  await fs.writeFile(modeJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await fs.writeFile(modeMarkdownPath, lines.join('\n'), 'utf8')
}

async function main() {
  const mode = resolveAuthenticatedRlsMode(process.argv.slice(2))
  assertRuntimeGuardrails(mode)
  const [rawDbUrl] = await Promise.all([
    fs.readFile(dbUrlPath, 'utf8').catch(() => {
      throw new Error('Missing ignored private QA cleanup connection.')
    }),
    fs.access(psqlPath).catch(() => {
      throw new Error('PostgreSQL 17 psql was not found.')
    }),
  ])
  const connection = parsePrivateDbUrl(rawDbUrl)
  const before = await runPrivateQaQuery(connection, snapshotSql, `${mode}-before`)
  assertSafeSnapshot(before, { requireCleanMarker: mode === 'dry-run' || mode === 'apply' || mode === 'verify-clean' })
  let fixtureSnapshot = null
  if (mode === 'apply') {
    fixtureSnapshot = await runPrivateQaQuery(connection, prepareFixtureSql, 'apply-prepare-fixture')
  }
  const browser = await runAuthenticatedBrowserChecks(mode)
  if (!browser?.auth?.ok || browser.auth.status !== 200 || !browser.auth.authenticatedBearer) {
    throw new Error(`Real authenticated Supabase session validation failed with HTTP ${browser?.auth?.status ?? 'unknown'}.`)
  }

  let after = before
  if (mode === 'cleanup') {
    after = await runPrivateQaQuery(connection, cleanupSql, 'cleanup-apply')
    assertSafeSnapshot(after, { requireCleanMarker: true })
  } else if (mode === 'apply') {
    after = await runPrivateQaQuery(connection, snapshotSql, 'apply-after')
    reconcileAuthenticatedApplyResults(browser, after)
  } else if (mode === 'verify-clean') {
    after = await runPrivateQaQuery(connection, snapshotSql, 'verify-clean-after')
    assertSafeSnapshot(after, { requireCleanMarker: true })
  }

  const seedIntact = Object.entries(EXPECTED_DEMO_COUNTS).every(([table, expected]) =>
    Number(after.demoMarkerCounts?.[table] ?? -1) === expected,
  )
  const report = {
    generatedAt: new Date().toISOString(),
    mode,
    projectRef: EXPECTED_PROJECT_REF,
    marker: MARKER,
    before,
    fixtureSnapshot,
    browser,
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
    `Auth session: HTTP ${browser.auth.status}`,
    `Authenticated bearer differs from anon: ${browser.auth.authenticatedBearer ? 'yes' : 'no'}`,
    ...browser.operations.map((operation) =>
      `${operation.label}: ${operation.skipped ? `skipped (${operation.reason})` : `HTTP ${operation.status} ${operation.ok ? 'pass' : 'fail'}`}`,
    ),
    `Marker rows after command: ${after.markerTotal}`,
    `QA demo seed intact: ${seedIntact ? 'yes' : 'no'}`,
    `Invoices/payments/quarterly_closings: ${after.invoices}/${after.payments}/${after.quarterlyClosings}`,
    'Production touched: no',
    'Service role used: no',
    '',
  ].join('\n'))

  if (mode === 'apply') {
    const failures = browser.operations.filter((operation) => !operation.ok)
    if (failures.length > 0) {
      throw new Error(`Authenticated RLS apply found ${failures.length} failed or skipped operation(s). Run cleanup before continuing.`)
    }
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((error) => {
    process.stderr.write(`Authenticated RLS verification failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
