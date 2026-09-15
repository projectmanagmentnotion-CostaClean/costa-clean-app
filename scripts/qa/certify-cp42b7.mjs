import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

export const QA_PROJECT_REF = 'kpvvydthlxupjjqqdpxy'
export const PRODUCTION_PROJECT_REF = 'wfxnwfcdjainpojhbdri'
export const QA_SUPABASE_URL = `https://${QA_PROJECT_REF}.supabase.co`
export const QA_INTAKE_ENDPOINT = `${QA_SUPABASE_URL}/functions/v1/public-lead-intake`
export const DEFAULT_WEB_URL = 'http://127.0.0.1:3217'
export const REPORT_PATH = 'qa-reports/private/cp42b7-runtime.json'
export const EXPECTED_CONSENTS = [
  ['necessary_privacy', true],
  ['marketing_contact', false],
  ['analytics_cookie', false],
  ['advertising_cookie', false],
]
export const ZERO_DELTA_ENTITIES = ['clients', 'properties', 'jobs', 'quotes', 'invoices', 'payments']

const COUNT_TABLES = [
  'leads',
  'clients',
  'properties',
  'jobs',
  'quotes',
  'invoices',
  'payments',
  'public_lead_intake_requests',
  'public_quote_draft_seeds',
  'public_quote_intake_consents',
  'public_quote_intake_attribution',
  'public_quote_intake_audit',
]

const PUBLIC_RESPONSE_FORBIDDEN = [
  'lead_id',
  'seed_id',
  'receipt_id',
  'operator_count',
  'elapsed_hours',
  'operator_hours',
  'base_ex_vat',
  'labor_cost',
  'customer_price',
  'service_role',
  'supabase',
  'sql',
  'hmac',
]

const REPORT_FORBIDDEN = [
  'PUBLIC_LEAD_INTAKE_SECRET',
  'SUPABASE_QA_SERVICE_ROLE_KEY',
  'service_role',
  'access_token',
  'refresh_token',
  'cookie',
  'full_name',
  'phone',
  'email',
  'details',
  'notes',
  'postal_code',
  'gclid',
  'gbraid',
  'wbraid',
  'fbclid',
  'base_ex_vat',
  'labor_cost',
  'customer_price',
]

function failure(code) {
  const error = new Error(code)
  error.code = code
  return error
}

function normalized(value) {
  return String(value ?? '').trim()
}

export function validatePreflight(env = process.env) {
  const secret = normalized(env.PUBLIC_LEAD_INTAKE_SECRET)
  if (!secret || secret.length < 32) throw failure('HMAC_SIGNER_SECRET_UNAVAILABLE')
  if (normalized(env.PUBLIC_LEAD_INTAKE_ENV) !== 'qa') throw failure('QA_ENVIRONMENT_INVALID')

  const endpoint = normalized(env.PUBLIC_LEAD_INTAKE_URL)
  if (endpoint === `https://${PRODUCTION_PROJECT_REF}.supabase.co/functions/v1/public-lead-intake`) {
    throw failure('PRODUCTION_TARGET_BLOCKED')
  }
  if (endpoint !== QA_INTAKE_ENDPOINT) throw failure('QA_TARGET_MISMATCH')

  const webUrl = normalized(env.CP42B7_WEB_URL) || DEFAULT_WEB_URL
  let webOrigin
  try {
    webOrigin = new URL(webUrl)
  } catch {
    throw failure('WEB_ROUTE_UNAVAILABLE')
  }
  if (webOrigin.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(webOrigin.hostname)) {
    throw failure('NON_LOCAL_WEB_TARGET_BLOCKED')
  }

  const configuredValues = [endpoint, normalized(env.SUPABASE_QA_URL), webUrl]
  if (configuredValues.some((value) => value.includes(PRODUCTION_PROJECT_REF))) {
    throw failure('PRODUCTION_TARGET_BLOCKED')
  }
  if (Object.keys(env).some((key) => key.startsWith('NEXT_PUBLIC_') && /SECRET|SERVICE_ROLE|TOKEN/u.test(key))) {
    throw failure('PUBLIC_SECRET_CONFIGURATION_BLOCKED')
  }

  const adminKey = normalized(env.SUPABASE_QA_SERVICE_ROLE_KEY)
  if (!adminKey) throw failure('SUPABASE_QA_ADMIN_CHANNEL_UNAVAILABLE')

  return {
    endpoint,
    environment: 'qa',
    secret,
    webUrl: webOrigin.origin,
    adminKey,
    reportPath: REPORT_PATH,
  }
}

export function buildFixture(submissionId = randomUUID(), receivedAt = new Date().toISOString()) {
  return {
    submissionId,
    service: 'residential',
    propertyContext: 'piso',
    city: 'Barcelona',
    postalCode: '08001',
    size: '71-100',
    bedrooms: '3',
    bathrooms: '2',
    frequency: 'weekly',
    dateIntent: 'flexible',
    timePreference: 'noche',
    needs: { standardCleaning: true },
    attribution: {
      landing_path: '/presupuesto',
      utm_source: 'qa_b7_runtime',
      utm_medium: 'internal_qa',
      utm_campaign: 'cp42b7_certification',
    },
    contact: {
      name: 'QA CP42B7 Runtime',
      email: 'qa.cp42b7.runtime@qa.invalid',
      phone: '+34999999999',
      preference: 'whatsapp',
    },
    consentNecessary: true,
    consentMarketing: false,
    cookieConsent: { analytics: false, marketing: false },
    receivedAt,
  }
}

export function assertPublicResponseSafe(responseBody, status) {
  if (status !== 200 || !responseBody || responseBody.ok !== true) throw failure('WEB_HTTP_NOT_200')
  const keys = Object.keys(responseBody)
  if (keys.length !== 1 || keys[0] !== 'ok') throw failure('PUBLIC_RESPONSE_NOT_MINIMAL')
  const serialized = JSON.stringify(responseBody).toLowerCase()
  if (PUBLIC_RESPONSE_FORBIDDEN.some((term) => serialized.includes(term))) throw failure('PUBLIC_RESPONSE_LEAK')
  return true
}

export function assertBaselineRestored(before, after) {
  for (const table of Object.keys(before)) {
    if (before[table] !== after[table]) throw failure(`BASELINE_NOT_RESTORED:${table}`)
  }
  return true
}

export function assertNoForbiddenReportContent(report, secrets = []) {
  const serialized = JSON.stringify(report).toLowerCase()
  if (REPORT_FORBIDDEN.some((term) => serialized.includes(term.toLowerCase()))) throw failure('REPORT_PRIVACY_LEAK')
  if (secrets.some((secret) => secret && serialized.includes(secret))) throw failure('REPORT_SECRET_LEAK')
  return true
}

function jsonHeaders(adminKey) {
  return {
    apikey: adminKey,
    Authorization: `Bearer ${adminKey}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
}

function restUrl(path) {
  return `${QA_SUPABASE_URL}/rest/v1/${path}`
}

async function fetchJson(url, options = {}) {
  let response
  try {
    response = await fetch(url, options)
  } catch {
    throw failure('QA_DATABASE_UNAVAILABLE')
  }
  const data = await response.json().catch(() => null)
  if (!response.ok) throw failure('QA_DATABASE_REQUEST_FAILED')
  return { response, data }
}

async function countTable(adminKey, table) {
  const { response } = await fetchJson(restUrl(`${table}?select=*&limit=0`), {
    headers: { ...jsonHeaders(adminKey), Prefer: 'count=exact' },
  })
  const range = response.headers.get('content-range') ?? ''
  const match = range.match(/\/(\d+)$/u)
  if (!match) throw failure(`QA_COUNT_UNAVAILABLE:${table}`)
  return Number(match[1])
}

async function counts(adminKey) {
  const result = {}
  for (const table of COUNT_TABLES) result[table] = await countTable(adminKey, table)
  return result
}

async function rows(adminKey, query) {
  const { data } = await fetchJson(restUrl(query), { headers: jsonHeaders(adminKey) })
  if (!Array.isArray(data)) throw failure('QA_ROWS_INVALID')
  return data
}

async function deleteExact(adminKey, table, filter) {
  let response
  try {
    response = await fetch(restUrl(`${table}?${filter}`), {
      method: 'DELETE',
      headers: { ...jsonHeaders(adminKey), Prefer: 'return=minimal' },
    })
  } catch {
    throw failure(`QA_CLEANUP_FAILED:${table}`)
  }
  if (!response.ok) throw failure(`QA_CLEANUP_FAILED:${table}`)
}

async function cleanupFixture(adminKey, submissionId, leadId) {
  const encodedSubmission = encodeURIComponent(submissionId)
  const intake = await rows(adminKey, `public_lead_intake_requests?select=lead_id&submission_id=eq.${encodedSubmission}`)
  const exactLeadId = leadId || intake[0]?.lead_id
  if (!exactLeadId) return { status: 'no_fixture_found' }

  await deleteExact(adminKey, 'public_quote_intake_audit', `submission_id=eq.${encodedSubmission}`)
  await deleteExact(adminKey, 'public_quote_draft_seeds', `submission_id=eq.${encodedSubmission}`)
  await deleteExact(adminKey, 'public_quote_intake_attribution', `submission_id=eq.${encodedSubmission}`)
  await deleteExact(adminKey, 'public_quote_intake_consents', `submission_id=eq.${encodedSubmission}`)
  await deleteExact(adminKey, 'public_lead_intake_requests', `submission_id=eq.${encodedSubmission}`)
  await deleteExact(adminKey, 'leads', `id=eq.${encodeURIComponent(exactLeadId)}`)
  return { status: 'cleaned' }
}

async function waitForWeb(webProcess, webUrl) {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (webProcess.exitCode !== null) throw failure('WEB_ROUTE_UNAVAILABLE')
    try {
      const response = await fetch(`${webUrl}/api/quote`, { signal: AbortSignal.timeout(3_000) })
      if (response.status === 405) return
    } catch {
      // The Next dev server needs a short warm-up after its process starts.
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw failure('WEB_ROUTE_UNAVAILABLE')
}

function startWebRuntime(webRoot, config, port) {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const childEnv = { ...process.env }
  delete childEnv.SUPABASE_QA_SERVICE_ROLE_KEY
  delete childEnv.SUPABASE_SERVICE_ROLE_KEY
  delete childEnv.SUPABASE_SECRET_KEY
  const child = spawn(npmCommand, ['run', 'dev', '--', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: webRoot,
    env: {
      ...childEnv,
      PUBLIC_LEAD_INTAKE_URL: config.endpoint,
      PUBLIC_LEAD_INTAKE_ENV: config.environment,
      PUBLIC_LEAD_INTAKE_SECRET: config.secret,
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: 'ignore',
    windowsHide: true,
  })
  return child
}

function stopProcess(child) {
  if (!child || child.exitCode !== null) return
  child.kill('SIGTERM')
}

async function postQuote(webUrl, fixture) {
  let response
  try {
    response = await fetch(`${webUrl}/api/quote`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: webUrl },
      body: JSON.stringify(fixture),
      signal: AbortSignal.timeout(30_000),
    })
  } catch {
    throw failure('WEB_REQUEST_FAILED')
  }
  const body = await response.json().catch(() => null)
  assertPublicResponseSafe(body, response.status)
  return { status: response.status, body }
}

function expectedEstimate(seed) {
  const estimate = seed.estimate
  if (!estimate || estimate.rule_id !== 'RES-C') throw failure('RES_C_ESTIMATE_MISMATCH')
  const expected = { operator_count: 2, elapsed_hours: 3, operator_hours: 6, base_ex_vat: 120, labor_cost: 60 }
  for (const [key, value] of Object.entries(expected)) {
    if (estimate[key] !== value) throw failure(`RES_C_ESTIMATE_MISMATCH:${key}`)
  }
  return true
}

function assertDatabaseEvidence(evidence, fixture) {
  if (evidence.leads.length !== 1 || evidence.intakes.length !== 1 || evidence.seeds.length !== 1) throw failure('ENTITY_COUNT_MISMATCH')
  const intake = evidence.intakes[0]
  const seed = evidence.seeds[0]
  if (intake.submission_id !== fixture.submissionId || intake.contract_version !== 'cp42b-v2' || intake.processing_status !== 'pending_review') throw failure('INTAKE_CONTRACT_MISMATCH')
  if (seed.submission_id !== fixture.submissionId || seed.schema_version !== 'quote_draft_seed_v1' || seed.contract_version !== 'costa_clean_quote_intelligence@1.0.0' || seed.estimate_model_version !== 'estimate_v1' || seed.seed_version !== 'quote_draft_seed_v1') throw failure('SEED_CONTRACT_MISMATCH')
  expectedEstimate(seed)
  const commercial = seed.commercial_draft ?? {}
  if (commercial.status !== 'needs_review' || commercial.reviewer_required !== true || commercial.customer_price !== null || commercial.vat !== null || commercial.commercial_total !== null) throw failure('COMMERCIAL_DRAFT_MISMATCH')
  if (evidence.consents.length !== 4) throw failure('CONSENT_COUNT_MISMATCH')
  const consentPairs = evidence.consents.map((row) => [row.consent_type, row.granted]).sort(([left], [right]) => left.localeCompare(right))
  const expectedPairs = [...EXPECTED_CONSENTS].sort(([left], [right]) => left.localeCompare(right))
  if (JSON.stringify(consentPairs) !== JSON.stringify(expectedPairs)) throw failure('CONSENT_VALUES_MISMATCH')
  if (evidence.attribution.length !== 1) throw failure('ATTRIBUTION_COUNT_MISMATCH')
  const attribution = evidence.attribution[0]
  if (attribution.utm_source !== 'qa_b7_runtime' || attribution.utm_medium !== 'internal_qa' || attribution.utm_campaign !== 'cp42b7_certification') throw failure('UTM_PERSISTENCE_MISMATCH')
  if (['gclid', 'gbraid', 'wbraid', 'fbclid'].some((key) => attribution[key] !== null)) throw failure('CLICK_ID_GATING_MISMATCH')
  const forbidden = /full_name|phone|email|details|notes|postal_code|gclid|gbraid|wbraid|fbclid|client_id|property_id/iu
  for (const value of [seed.intelligence, seed.pricing_support, seed.estimate, seed.attribution_summary]) {
    if (forbidden.test(JSON.stringify(value))) throw failure('SEED_PRIVACY_LEAK')
  }
  const events = new Set(evidence.audit.map((row) => row.event_type))
  for (const event of ['submission_accepted', 'lead_created', 'seed_created', 'review_initialized']) {
    if (!events.has(event)) throw failure('AUDIT_LIFECYCLE_MISMATCH')
  }
  return true
}

async function loadB6Aggregator() {
  const module = await import('../../src/features/publicQuoteIntelligence/aggregation.ts')
  return module.buildPublicQuoteDemandIntelligence
}

async function assertBiPath(evidence) {
  const buildReport = await loadB6Aggregator()
  const seed = evidence.seeds[0]
  const lead = evidence.leads[0]
  const report = buildReport([{
    submissionId: seed.submission_id,
    source: 'public_web',
    createdAt: seed.created_at,
    operationalSummary: seed.operational_summary,
    attributionSummary: seed.attribution_summary,
    estimate: seed.estimate,
    review: seed.review,
    leadStatus: lead.status,
  }])
  const service = report.serviceBreakdown.find((row) => row.serviceFamily === 'residential')
  const city = report.geographyBreakdown.find((row) => row.key === 'barcelona')
  const recurrence = report.recurrenceBreakdown.find((row) => row.key === 'recurring')
  const expectedMonth = seed.created_at.slice(0, 7)
  const expectedWeek = report.timeBreakdown.find((row) => row.key !== 'unknown')
  if (!service || service.tierAShare !== 1 || !city || !recurrence || report.period.startMonth !== expectedMonth || !expectedWeek) throw failure('BI_RUNTIME_CLASSIFICATION_MISMATCH')
  if (report.utmSourceBreakdown.length !== 0 || report.utmCampaignBreakdown.length !== 0 || report.campaignBreakdown.length !== 0 || report.attributionBreakdown.length !== 0) throw failure('BI_K3_SUPPRESSION_MISMATCH')
  assertNoForbiddenReportContent(report)
  return report
}

async function evidenceForSubmission(adminKey, submissionId) {
  const encoded = encodeURIComponent(submissionId)
  const intakes = await rows(adminKey, `public_lead_intake_requests?select=submission_id,lead_id,receipt_id,contract_version,processing_status,operational_request&submission_id=eq.${encoded}`)
  const leads = intakes[0]?.lead_id
    ? await rows(adminKey, `leads?select=id,status,public_intake_last_submission_id,converted_client_id&id=eq.${encodeURIComponent(intakes[0].lead_id)}`)
    : []
  const seeds = await rows(adminKey, `public_quote_draft_seeds?select=submission_id,schema_version,contract_version,estimate_model_version,seed_version,operational_summary,estimate,pricing_support,review,commercial_draft,attribution_summary,intelligence,created_at&submission_id=eq.${encoded}`)
  const consents = await rows(adminKey, `public_quote_intake_consents?select=consent_type,granted&submission_id=eq.${encoded}`)
  const attribution = await rows(adminKey, `public_quote_intake_attribution?select=utm_source,utm_medium,utm_campaign,gclid,gbraid,wbraid,fbclid&submission_id=eq.${encoded}`)
  const audit = await rows(adminKey, `public_quote_intake_audit?select=event_type&submission_id=eq.${encoded}`)
  return { intakes, leads, seeds, consents, attribution, audit }
}

function countDelta(before, after, table, expected) {
  return after[table] - before[table] === expected
}

export async function runCertification({ env = process.env, appRoot = process.cwd(), webRoot = process.env.COSTA_CLEAN_WEB_ROOT || 'C:\\Users\\USUARIO\\costa-clean-web' } = {}) {
  const config = validatePreflight(env)
  const baseline = {}
  const fixture = buildFixture()
  let webProcess
  let leadId = null
  let cleaned = false
  try {
    baseline.before = await counts(config.adminKey)
    const port = new URL(config.webUrl).port || '3217'
    webProcess = startWebRuntime(webRoot, config, port)
    await waitForWeb(webProcess, config.webUrl)
    await postQuote(config.webUrl, fixture)
    const first = await evidenceForSubmission(config.adminKey, fixture.submissionId)
    leadId = first.intakes[0]?.lead_id ?? null
    assertDatabaseEvidence(first, fixture)
    if (!countDelta(baseline.before, await counts(config.adminKey), 'leads', 1)) throw failure('LEAD_COUNT_MISMATCH')
    const replay = await postQuote(config.webUrl, fixture)
    const replayCounts = await counts(config.adminKey)
    for (const [table, expected] of [['leads', 1], ['public_lead_intake_requests', 1], ['public_quote_draft_seeds', 1]]) {
      if (!countDelta(baseline.before, replayCounts, table, expected)) throw failure(`IDEMPOTENCY_MISMATCH:${table}`)
    }
    const replayEvidence = await evidenceForSubmission(config.adminKey, fixture.submissionId)
    if (replayEvidence.leads.length !== 1 || replayEvidence.intakes.length !== 1 || replayEvidence.seeds.length !== 1) throw failure('IDEMPOTENCY_DUPLICATE')
    const biReport = await assertBiPath(replayEvidence)
    const afterWrite = replayCounts
    for (const table of ZERO_DELTA_ENTITIES) {
      if (afterWrite[table] !== baseline.before[table]) throw failure(`ZERO_DELTA_MISMATCH:${table}`)
    }
    const cleanup = await cleanupFixture(config.adminKey, fixture.submissionId, leadId)
    cleaned = cleanup.status === 'cleaned'
    const afterCleanup = await counts(config.adminKey)
    assertBaselineRestored(baseline.before, afterCleanup)
    const report = {
      status: 'PASS',
      target: QA_PROJECT_REF,
      edgeVersion: 'verified externally before run; not queried by runner',
      submissionId: fixture.submissionId,
      http: { first: 200, replay: replay.status },
      assertions: {
        publicResponseMinimal: true,
        database: true,
        resC: true,
        consents: true,
        attribution: true,
        audit: true,
        idempotency: true,
        bi: true,
        k3Suppression: true,
        zeroDelta: true,
        cleanup: cleaned,
        baselineRestored: true,
      },
      counts: { before: baseline.before, replay: replayCounts, afterCleanup },
      bi: { service: 'residential', city: 'barcelona', recurrence: 'recurring', estimateRule: 'RES-C', campaignSuppressed: biReport.campaignBreakdown.length === 0 },
    }
    assertNoForbiddenReportContent(report, [config.secret, config.adminKey])
    await writeReport(config.reportPath, report)
    return report
  } catch (error) {
    if (leadId || fixture) {
      try {
        await cleanupFixture(config.adminKey, fixture.submissionId, leadId)
      } catch {
        // The report below preserves the original blocker; cleanup is rechecked on the next run.
      }
    }
    const blocker = error?.code || 'CP42B7_RUNTIME_FAILED'
    const report = {
      status: 'FAIL',
      target: QA_PROJECT_REF,
      submissionId: fixture.submissionId,
      blocker,
      counts: baseline,
    }
    try {
      assertNoForbiddenReportContent(report, [config.secret, config.adminKey])
      await writeReport(config.reportPath, report)
    } catch {
      // Reporting must never replace the original certification blocker.
    }
    throw error
  } finally {
    stopProcess(webProcess)
  }
}

async function writeReport(reportPath, report) {
  await mkdir(dirname(reportPath), { recursive: true })
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
}

async function main() {
  try {
    const report = await runCertification()
    console.log(`CP-4.2B.7 runtime: ${report.status}; target=${report.target}; submission=${report.submissionId}`)
  } catch (error) {
    const code = error?.code || 'CP42B7_RUNTIME_FAILED'
    console.error(`CP-4.2B.7 runtime blocked: ${code}`)
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
