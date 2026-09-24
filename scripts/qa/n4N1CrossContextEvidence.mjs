import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import {
  CdpConnection,
  closeBrowserSession,
  delay,
  evaluateJson,
  navigateAndWait,
  openBrowserSession,
  readAuthStateMetadata,
  waitForCdpEndpoint,
  waitForShellStable,
  waitForViewReady,
} from './auth/cdpHarness.mjs'
import { loadSupabasePublicEnv } from './qaCleanupRegistry.mjs'
import { recoverAuthenticatedQaSession } from './auth/recoveredQaSession.mjs'

const MAX_RUN_MS = 45_000
const rootDir = process.cwd()
const reportPath = path.join(rootDir, 'qa-reports', 'private', 'n4-n1-cross-context-latest.json')
const startedAt = Date.now()
let lastCompletedStage = 'START'
let connection = null
let observer = null
let writer = null
let cleanupClient = null
let runId = crypto.randomBytes(16).toString('hex')
let planId = null
let occurrenceDate = '2026-09-28'
let exactJobId = null
let exactJobDisplayCode = null
let generatedAtMs = null
let realtimeEventAtMs = null
let canonicalRefetchAtMs = null
let domVisibleAtMs = null
let observerReady = false
let observerNavigationsAfterReady = 0
let manualReloadUsed = false
let observerRealtimeEvent = false
let observerCanonicalRefetch = false
let observerCanonicalResponseContainsExactJob = false
let observerDomContainsExactJob = false
let appStatePropagation = 'NOT_AVAILABLE'
let duplicateLiveRows = null
let fixtureResidue = null
let secondCleanupActions = null
let cleanupCompleted = false
const networkFailures = []
const responseBodies = new Map()
const pendingJobResponseIds = []

function withTimeout(label, promise, timeoutMs) {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label}_TIMEOUT`)), timeoutMs)
    }),
  ]).finally(() => clearTimeout(timer))
}

function stage(name) {
  lastCompletedStage = name
  console.log(name)
}

async function writeReport(status, error = null) {
  const report = {
    status,
    lastCompletedStage,
    observerReady,
    writerGeneration: Boolean(generatedAtMs && exactJobId),
    planId,
    occurrenceDate,
    exactJobId,
    exactJobDisplayCode,
    observerRealtimeEvent,
    observerCanonicalRefetch,
    observerCanonicalResponseContainsExactJob,
    appStateDirectIntrospection: 'NOT_AVAILABLE',
    appStatePropagation,
    observerDomContainsExactJob,
    duplicateLiveRows,
    generatedAtMs,
    realtimeEventAtMs,
    canonicalRefetchAtMs,
    domVisibleAtMs,
    latencyMs: generatedAtMs && domVisibleAtMs ? domVisibleAtMs - generatedAtMs : null,
    manualReloadUsed,
    observerNavigationsAfterReady,
    fixtureResidue,
    secondCleanupActions,
    reportWritten: false,
    runnerExited: true,
    errorCategory: error ? String(error.message || error).replace(/[^A-Z0-9_:-]/gi, '_').slice(0, 160) : null,
    maxRunMs: MAX_RUN_MS,
  }
  await fs.mkdir(path.dirname(reportPath), { recursive: true })
  report.reportWritten = true
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  return report
}

async function cleanup() {
  if (!cleanupClient || cleanupCompleted) return
  cleanupCompleted = true
  const planner = await withTimeout('cleanup_plan', cleanupClient.rpc('qa_n4_func_teardown_plan', { p_run_id: runId }), 10_000)
  if (planner.error) throw new Error(`CLEANUP_PLAN_${planner.error.code || 'ERROR'}`)
  if (planner.data?.safe_to_clean !== true || Number(planner.data?.untracked_relations) !== 0 || Number(planner.data?.real_record_matches) !== 0 || Number(planner.data?.generated_job_external_references) !== 0 || Number(planner.data?.financial_references) !== 0) {
    throw new Error('CLEANUP_UNSAFE')
  }
  const cleaned = await withTimeout('cleanup', cleanupClient.rpc('qa_n4_func_teardown', { p_run_id: runId }), 10_000)
  if (cleaned.error) throw new Error(`CLEANUP_${cleaned.error.code || 'ERROR'}`)
  const second = await withTimeout('cleanup_second', cleanupClient.rpc('qa_n4_func_teardown', { p_run_id: runId }), 10_000)
  if (second.error) throw new Error(`CLEANUP_SECOND_${second.error.code || 'ERROR'}`)
  fixtureResidue = 0
  secondCleanupActions = Number(second.data?.deleted?.plans || 0) + Number(second.data?.deleted?.slots || 0) + Number(second.data?.deleted?.occurrences || 0) + Number(second.data?.deleted?.jobs || 0)
  if (secondCleanupActions !== 0) throw new Error('CLEANUP_NOT_IDEMPOTENT')
  stage('STAGE_09_CLEANUP_COMPLETE')
}

async function main() {
  const watchdog = setTimeout(() => { throw new Error('MAX_RUN_TIMEOUT') }, MAX_RUN_MS)
  try {
    const recovered = await withTimeout('auth_recovery', recoverAuthenticatedQaSession(rootDir), 8_000)
    if (!recovered.authenticatedUserPresent || recovered.projectRef !== 'kpvvydthlxupjjqqdpxy') throw new Error('AUTH_OR_PROJECT_GATE_FAILED')
    const { supabaseUrl, supabaseAnonKey } = await loadSupabasePublicEnv(rootDir)
    cleanupClient = createClient(supabaseUrl, supabaseAnonKey, { accessToken: async () => recovered.accessToken, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
    const meta = await readAuthStateMetadata(`${rootDir}/.auth/costa-clean-storage-state.json`)
    const endpoint = await withTimeout('cdp_endpoint', waitForCdpEndpoint(Number(process.env.QA_REMOTE_DEBUGGING_PORT || 61497), 5_000), 5_500)
    connection = new CdpConnection(endpoint.webSocketDebuggerUrl)
    await withTimeout('cdp_connect', connection.connect(), 5_000)
    stage('STAGE_01_CDP_CONNECTED')

    observer = await withTimeout('observer_attach', openBrowserSession(connection, meta.appUrl), 5_000)
    await withTimeout('observer_navigate', navigateAndWait(connection, observer.sessionId, `${meta.appUrl}&view=jobs&n1=dedicated-observer`, 1_500), 8_000)
    await withTimeout('observer_shell', waitForShellStable(connection, observer.sessionId, 12_000), 12_500)
    await withTimeout('observer_view', waitForViewReady(connection, observer.sessionId, 'jobs', 12_000), 12_500)
    await delay(1_000)
    const observerReadyState = await evaluateJson(connection, observer.sessionId, `(() => ({ ready: document.readyState === 'complete', upcoming: Boolean(document.querySelector('[data-tab-value="upcoming"]')) }))()`)
    if (!observerReadyState?.ready || !observerReadyState?.upcoming) throw new Error('OBSERVER_NOT_READY')
    await evaluateJson(connection, observer.sessionId, `(() => { document.querySelector('[data-tab-value="upcoming"]')?.click(); return true })()`)
    await connection.send('Network.enable', {}, observer.sessionId)
    connection.on('Network.webSocketFrameReceived', (params, sessionId) => {
      if (sessionId !== observer.sessionId || !generatedAtMs || Date.now() < generatedAtMs) return
      const payload = String(params.response?.payloadData || '')
      if (/jobs|recurring_service_occurrences|postgres_changes/i.test(payload) || payload.includes(exactJobId)) {
        observerRealtimeEvent = true
        realtimeEventAtMs ??= Date.now()
      }
    })
    connection.on('Network.responseReceived', async (params, sessionId) => {
      if (sessionId !== observer.sessionId || !generatedAtMs || Date.now() < generatedAtMs) return
      const url = String(params.response?.url || '')
      if (!/\/rest\/v1\/jobs(?:\?|$)/i.test(url)) return
      observerCanonicalRefetch = true
      canonicalRefetchAtMs ??= Date.now()
      pendingJobResponseIds.push(params.requestId)
      try {
        const body = await connection.send('Network.getResponseBody', { requestId: params.requestId }, observer.sessionId)
        if (String(body.body || '').includes(exactJobId)) observerCanonicalResponseContainsExactJob = true
      } catch {
        // The response may already have been released; the next canonical read is still observed.
      }
    })
    observerReady = true
    stage('STAGE_02_OBSERVER_READY')

    writer = await withTimeout('writer_attach', openBrowserSession(connection, meta.appUrl), 5_000)
    await withTimeout('writer_navigate', navigateAndWait(connection, writer.sessionId, `${meta.appUrl}&view=jobs&n1=dedicated-writer`, 1_500), 8_000)
    await withTimeout('writer_shell', waitForShellStable(connection, writer.sessionId, 12_000), 12_500)
    stage('STAGE_03_WRITER_READY')

    const marker = `QA_N4_N1_${runId}`
    const teardownToken = `QA_N4_FUNC_${runId}`
    planId = `PLAN-${teardownToken}-ROOT`
    const propertyResult = await withTimeout('root_read', cleanupClient.from('properties').select('id,client_id').limit(1), 10_000)
    if (propertyResult.error || !propertyResult.data?.[0]?.client_id) throw new Error('ROOT_READ_FAILED')
    const property = propertyResult.data[0]
    const save = await withTimeout('rpc_save', cleanupClient.rpc('save_recurring_service_plan', { p_plan: { id: planId, client_id: property.client_id, property_id: property.id, title: marker, service_type: 'standard_cleaning', status: 'active', schedule_kind: 'weekly', weekdays: [1], start_date: occurrenceDate, end_date: occurrenceDate, billing_concept: marker, billing_quantity: 1, billing_unit: 'servicio', billing_unit_price: 90, notes: teardownToken, internal_notes: `${teardownToken}|${marker}`, template_lines: [{ sort_order: 1, concept: marker, quantity: 1, unit: 'servicio', unit_price: 90, line_subtotal: 90 }] } }), 10_000)
    if (save.error) throw new Error(`RPC_SAVE_${save.error.code || 'ERROR'}`)
    const schedule = await withTimeout('rpc_schedule', cleanupClient.rpc('save_recurring_service_plan_schedule', { p_plan_id: planId, p_slots: [{ weekday: 1, start_time: '09:00', duration_minutes: 120, workers_required: 1 }] }), 10_000)
    if (schedule.error) throw new Error(`RPC_SCHEDULE_${schedule.error.code || 'ERROR'}`)
    stage('STAGE_04_FIXTURE_CREATED')

    const baseline = new Set(await evaluateJson(connection, observer.sessionId, `Array.from(document.querySelectorAll('[aria-label*="Abrir servicio"],[data-qa*="job"]')).map(n => n.getAttribute('aria-label') || n.textContent || '').filter(Boolean)`))
    generatedAtMs = Date.now()
    const occurrence = await withTimeout('rpc_generate', cleanupClient.rpc('generate_recurring_service_occurrences', { p_plan_id: planId, p_from_date: occurrenceDate, p_through_date: occurrenceDate }), 10_000)
    if (occurrence.error || Number(occurrence.data?.created_count) !== 1) throw new Error(`RPC_GENERATE_${occurrence.error?.code || 'COUNT'}`)
    const generated = await withTimeout('generated_job_read', cleanupClient.from('jobs').select('id,display_code,recurring_occurrence_date').eq('recurring_service_plan_id', planId), 10_000)
    if (generated.error || generated.data?.length !== 1) throw new Error('GENERATED_JOB_READ_FAILED')
    exactJobId = generated.data[0].id
    exactJobDisplayCode = generated.data[0].display_code || exactJobId
    if (baseline.has(exactJobDisplayCode) || baseline.has(exactJobId)) throw new Error('TARGET_PREEXISTS')
    for (const requestId of pendingJobResponseIds) {
      try {
        const body = await connection.send('Network.getResponseBody', { requestId }, observer.sessionId)
        if (String(body.body || '').includes(exactJobId)) observerCanonicalResponseContainsExactJob = true
      } catch {
        // Ignore responses that have already been released.
      }
    }
    stage('STAGE_05_JOB_GENERATED')

    const observerWaitStart = Date.now()
    while (Date.now() - observerWaitStart < 20_000 && !observerDomContainsExactJob) {
      const domState = await evaluateJson(connection, observer.sessionId, `(() => { const code=${JSON.stringify(exactJobDisplayCode)}; const text=document.body?.innerText || ''; const labels=Array.from(document.querySelectorAll('[aria-label]')).map(node => node.getAttribute('aria-label') || '').join('\\n'); return { count: text.split(code).length - 1 + labels.split(code).length - 1 } })()`)
      observerDomContainsExactJob = Number(domState?.count) === 1
      if (observerDomContainsExactJob) domVisibleAtMs = Date.now()
      await delay(250)
    }
    if (!observerRealtimeEvent) throw new Error('OBSERVER_REALTIME_EVENT_NOT_OBSERVED')
    if (!observerCanonicalRefetch || !observerCanonicalResponseContainsExactJob) throw new Error('OBSERVER_CANONICAL_REFETCH_NOT_PROVEN')
    if (!observerDomContainsExactJob) throw new Error('OBSERVER_DOM_JOB_NOT_VISIBLE')
    appStatePropagation = 'PASS_BY_CERTIFIED_RENDER_CHAIN'
    duplicateLiveRows = 0
    stage('STAGE_08_DOM_UPDATED')
    await cleanup()
    const report = await writeReport('PASS')
    stage('STAGE_10_REPORT_WRITTEN')
    await withTimeout('cdp_close', connection.close(), 3_000)
    stage('STAGE_11_CDP_CLOSED')
    clearTimeout(watchdog)
    console.log('N4_N1_CROSS_CONTEXT_RESULT=PASS')
    return report
  } catch (error) {
    try { await cleanup() } catch (cleanupError) { fixtureResidue = 'UNKNOWN' }
    try { await writeReport('BLOCKED', error) } catch {}
    try { if (connection) await withTimeout('cdp_close', connection.close(), 3_000) } catch {}
    clearTimeout(watchdog)
    console.log('N4_N1_CROSS_CONTEXT_RESULT=BLOCKED')
    process.exitCode = 1
    return null
  } finally {
    try { if (observer) await withTimeout('observer_close', closeBrowserSession(connection, observer.targetId, observer.sessionId), 3_000) } catch {}
    try { if (writer) await withTimeout('writer_close', closeBrowserSession(connection, writer.targetId, writer.sessionId), 3_000) } catch {}
  }
}

await main()
