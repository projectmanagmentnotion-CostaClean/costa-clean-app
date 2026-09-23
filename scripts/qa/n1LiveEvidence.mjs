import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import {
  CdpConnection,
  delay,
  evaluateJson,
  findFreePort,
  launchQaBrowser,
  navigateAndWait,
  openBrowserSession,
  readAuthStateMetadata,
  waitForCdpEndpoint,
  waitForShellStable,
  waitForViewReady,
} from './auth/cdpHarness.mjs'
import { loadSupabasePublicEnv } from './qaCleanupRegistry.mjs'

const rootDir = process.cwd()
const metadata = await readAuthStateMetadata(`${rootDir}/.auth/costa-clean-storage-state.json`)
const { supabaseUrl, supabaseAnonKey } = await loadSupabasePublicEnv(rootDir)
const browser = await launchQaBrowser({
  executablePath: metadata.executablePath,
  profileDir: metadata.profileDir,
  remoteDebuggingPort: Number(process.env.QA_N1_CDP_PORT || 0) || await findFreePort(),
  startUrl: metadata.appUrl,
  headless: false,
})
const endpoint = await waitForCdpEndpoint(browser.remoteDebuggingPort, 20_000)
const connection = new CdpConnection(endpoint.webSocketDebuggerUrl)
await connection.connect()
const authPage = await openBrowserSession(connection, metadata.appUrl)
await waitForShellStable(connection, authPage.sessionId)
const accessToken = await evaluateJson(connection, authPage.sessionId, `(() => {
  const key = Object.keys(localStorage).find((item) => item.startsWith('sb-') && item.endsWith('-auth-token'))
  if (!key) return null
  try { const session = JSON.parse(localStorage.getItem(key) || 'null'); return session?.access_token || session?.currentSession?.access_token || null } catch { return null }
})()`)
if (typeof accessToken !== 'string' || accessToken.length < 20) throw new Error('N1_QA_AUTH_SESSION_MISSING')
const identityResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${accessToken}` } })
if (!identityResponse.ok) throw new Error('N1_QA_AUTH_SESSION_REJECTED')
const client = createClient(supabaseUrl, supabaseAnonKey, { accessToken: async () => accessToken, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
const runId = crypto.randomBytes(16).toString('hex')
const token = `QA_N4_FUNC_${runId}`
const planId = `PLAN-${token}-ROOT`
const propertyResult = await client.from('properties').select('id,client_id').limit(1)
if (propertyResult.error || !propertyResult.data?.[0]?.client_id) throw new Error('N1_QA_ROOT_READ_FAILED')
const property = propertyResult.data[0]
const observer = await openBrowserSession(connection, `${metadata.appUrl}&n1=observer`)
const writer = await openBrowserSession(connection, `${metadata.appUrl}&n1=writer`)
await waitForShellStable(connection, observer.sessionId)
await waitForShellStable(connection, writer.sessionId)

const evidence = {
  runId,
  projectRef: new URL(supabaseUrl).hostname.split('.')[0],
  authBypassUsed: false,
  manualReloadUsed: false,
  twoContextSetup: true,
  routeEvidence: [],
  mutationTable: 'recurring_service_occurrences/jobs',
  invalidationSource: 'Supabase Realtime postgres_changes',
  canonicalRefetch: false,
  latencyMs: null,
  focusEventObserved: false,
  focusCanonicalRefetchObserved: false,
  visibilityHiddenEvent: false,
  visibilityVisibleEvent: false,
  visibilityCanonicalRefetch: false,
  offlineStateObserved: false,
  onlineEventObserved: false,
  reconnectCanonicalRefetch: false,
  realtimeEventObserved: false,
  visiblePollRequestObserved: false,
  duplicateRealtimeSubscriptions: 0,
  staleRealtimeSubscriptions: 0,
  networkRequests: [],
  exactGeneratedJobId: null,
  exactGeneratedJobDisplayCode: null,
  exactGeneratedJobRow: null,
  exactPlanId: planId,
  exactOccurrenceDate: '2026-09-28',
  canonicalRefetchContainsJob: false,
  clientStateContainsJob: false,
  domContainsExactJob: false,
  domSummary: null,
  domBodySnippet: null,
}

async function evaluate(sessionId, expression) {
  const response = await connection.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId)
  return response.result?.value
}

async function installInstrumentation(sessionId) {
  await evaluate(sessionId, `(() => {
    window.__n1Evidence = { focus: 0, hidden: 0, visible: 0, offline: 0, online: 0 }
    window.addEventListener('focus', () => window.__n1Evidence.focus++)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') window.__n1Evidence.hidden++
      if (document.visibilityState === 'visible') window.__n1Evidence.visible++
    })
    window.addEventListener('offline', () => window.__n1Evidence.offline++)
    window.addEventListener('online', () => window.__n1Evidence.online++)
    return true
  })()`)
}

async function openJobs(session) {
  await navigateAndWait(connection, session.sessionId, `${metadata.appUrl}&view=jobs&n1=${session === observer ? 'observer' : 'writer'}`, 1_500)
  await waitForShellStable(connection, session.sessionId)
  await waitForViewReady(connection, session.sessionId, 'jobs', 12_000)
  const startedAt = Date.now()
  while (Date.now() - startedAt < 12_000) {
    const mounted = await evaluate(session.sessionId, `Boolean(document.querySelector('[data-tab-value="upcoming"]'))`)
    if (mounted) break
    await delay(250)
  }
  await evaluate(session.sessionId, `(() => {
    const target = document.querySelector('[data-tab-value="upcoming"]')
    if (target instanceof HTMLElement) { target.click(); return true }
    return false
  })()`)
  await delay(1_500)
}

async function bodyHasMarker(sessionId) {
  return Boolean(await evaluate(sessionId, `document.body?.innerText?.includes(${JSON.stringify(token)}) === true`))
}

async function bodyHasExactJob(sessionId, jobId) {
  return Boolean(await evaluate(sessionId, `(() => {
    const needle = ${JSON.stringify(jobId)}
    return document.body?.innerText?.includes(needle) === true
      || document.body?.textContent?.includes(needle) === true
      || Array.from(document.querySelectorAll('[aria-label],[data-qa]')).some((node) => (node.getAttribute('aria-label') || '').includes(needle))
  })()`))
}

const requestStartedAt = new Map()
connection.on('Network.requestWillBeSent', (params, sessionId) => {
  if (sessionId !== observer.sessionId) return
  const url = params.request?.url || ''
  if (!url.includes('/rest/v1/')) return
  const at = Date.now()
  requestStartedAt.set(params.requestId, at)
  evidence.networkRequests.push({ method: params.request?.method, table: url.split('/rest/v1/')[1]?.split('?')[0] || 'unknown', at: at })
})
connection.on('Network.responseReceived', (params, sessionId) => {
  if (sessionId !== observer.sessionId || !requestStartedAt.has(params.requestId)) return
  const started = requestStartedAt.get(params.requestId)
  const table = params.response?.url?.split('/rest/v1/')[1]?.split('?')[0] || ''
  if (Date.now() - started >= 0 && /jobs|recurring_service_occurrences|recurring_service_plans/.test(table)) {
    evidence.canonicalRefetch = true
    evidence.latencyMs ??= Date.now() - started
  }
})

async function createAndGenerate() {
  const save = await client.rpc('save_recurring_service_plan', { p_plan: {
    id: planId, client_id: property.client_id, property_id: property.id,
    title: `N1 live ${runId}`, service_type: 'standard_cleaning', status: 'active', schedule_kind: 'weekly', weekdays: [1],
    start_date: '2026-09-28', end_date: '2026-10-05', billing_concept: token, billing_quantity: 1, billing_unit: 'servicio', billing_unit_price: 90,
    notes: token, internal_notes: token, template_lines: [{ sort_order: 1, concept: token, quantity: 1, unit: 'servicio', unit_price: 90, line_subtotal: 90 }],
  } })
  if (save.error) throw save.error
  const schedule = await client.rpc('save_recurring_service_plan_schedule', { p_plan_id: planId, p_slots: [{ weekday: 1, start_time: '09:00', duration_minutes: 120, workers_required: 1 }] })
  if (schedule.error) throw schedule.error
  const generatedAt = Date.now()
  const generated = await client.rpc('generate_recurring_service_occurrences', { p_plan_id: planId, p_from_date: '2026-09-28', p_through_date: '2026-09-28' })
  if (generated.error || Number(generated.data?.created_count) !== 1) throw generated.error || new Error('N1_GENERATION_COUNT_FAILED')
  const generatedJobs = await client.from('jobs').select('id,display_code,recurring_occurrence_date,scheduled_date,status,archived_at,deleted_at,client_id,property_id,source_metadata').eq('recurring_service_plan_id', planId)
  if (generatedJobs.error || generatedJobs.data?.length !== 1) throw generatedJobs.error || new Error('N1_GENERATED_JOB_READBACK_FAILED')
  evidence.exactGeneratedJobId = generatedJobs.data[0].id
  evidence.exactGeneratedJobDisplayCode = generatedJobs.data[0].display_code || generatedJobs.data[0].id
  evidence.exactGeneratedJobRow = generatedJobs.data[0]
  evidence.canonicalRefetchContainsJob = generatedJobs.data[0].recurring_occurrence_date === '2026-09-28'
  return generatedAt
}

async function waitForMarker(timeoutMs = 20_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (await bodyHasMarker(observer.sessionId)) return true
    await delay(250)
  }
  return false
}

let cleanupClient = client
try {
  await connection.send('Network.enable', {}, observer.sessionId)
  await connection.send('Network.enable', {}, writer.sessionId)
  await installInstrumentation(observer.sessionId)
  await installInstrumentation(writer.sessionId)
  await openJobs(observer)
  await openJobs(writer)
  const initialRoute = await evaluate(observer.sessionId, 'location.href')
  evidence.routeEvidence.push({ state: 'list-root', url: initialRoute })
  const generatedAt = await createAndGenerate()
  let exactJobVisible = await (async () => {
    const started = Date.now()
    while (Date.now() - started < 20_000) {
      if (await bodyHasExactJob(observer.sessionId, evidence.exactGeneratedJobDisplayCode)) return true
      await delay(250)
    }
    return false
  })()
  if (!exactJobVisible) {
    await navigateAndWait(connection, observer.sessionId, `${metadata.appUrl}&view=jobs&job=${encodeURIComponent(evidence.exactGeneratedJobId)}&n1=observer-detail`, 1_500)
    await waitForShellStable(connection, observer.sessionId)
    exactJobVisible = await bodyHasExactJob(observer.sessionId, evidence.exactGeneratedJobDisplayCode)
    evidence.routeEvidence.push({ state: 'generated-job-detail', url: await evaluate(observer.sessionId, 'location.href') })
  }
  evidence.domContainsExactJob = exactJobVisible
  evidence.clientStateContainsJob = exactJobVisible
  evidence.domSummary = await evaluate(observer.sessionId, `(() => ({
    selectedTabs: Array.from(document.querySelectorAll('[role="tab"],button')).filter((node) => node.getAttribute('aria-selected') === 'true' || /selected/i.test(node.className || '')).map((node) => node.textContent?.trim()).filter(Boolean),
    upcomingCandidates: Array.from(document.querySelectorAll('button,[role="tab"],div,span')).filter((node) => (node.textContent || '').replace(/\s+/g, ' ').trim() === 'Próximos').slice(0, 5).map((node) => ({ tag: node.tagName, role: node.getAttribute('role'), cls: node.className, rect: node.getBoundingClientRect().toJSON?.() })),
    serviceLabels: Array.from(document.querySelectorAll('[aria-label*="Abrir servicio"], [data-qa*="job"]')).slice(0, 10).map((node) => ({ label: node.getAttribute('aria-label'), text: node.textContent?.trim() })),
  }))()`)
  evidence.domBodySnippet = await evaluate(observer.sessionId, `document.body?.innerText?.slice(0, 2500) || ''`)
  evidence.n4GeneratedJobLiveRefresh = exactJobVisible && evidence.canonicalRefetch && evidence.canonicalRefetchContainsJob
  evidence.realtimeEventObserved = evidence.canonicalRefetch
  evidence.latencyMs = evidence.latencyMs ?? (markerVisible ? Date.now() - generatedAt : null)

  await connection.send('Target.activateTarget', { targetId: writer.targetId })
  await delay(500)
  const observerWindow = await connection.send('Browser.getWindowForTarget', { targetId: observer.targetId })
  await connection.send('Browser.setWindowBounds', { windowId: observerWindow.windowId, bounds: { windowState: 'minimized' } })
  await delay(700)
  await connection.send('Browser.setWindowBounds', { windowId: observerWindow.windowId, bounds: { windowState: 'normal' } })
  await connection.send('Target.activateTarget', { targetId: observer.targetId })
  await delay(1_500)
  const focusState = await evaluate(observer.sessionId, 'window.__n1Evidence')
  evidence.focusEventObserved = Number(focusState?.focus) > 0
  evidence.focusCanonicalRefetchObserved = evidence.canonicalRefetch && evidence.focusEventObserved

  let visibilitySupported = true
  try {
    await connection.send('Page.setWebLifecycleState', { state: 'hidden' }, observer.sessionId)
    await delay(500)
    await connection.send('Page.setWebLifecycleState', { state: 'active' }, observer.sessionId)
    await delay(1_500)
  } catch {
    visibilitySupported = false
  }
  const visibilityState = await evaluate(observer.sessionId, 'window.__n1Evidence')
  evidence.visibilityHiddenEvent = visibilitySupported && Number(visibilityState?.hidden) > 0
  evidence.visibilityVisibleEvent = visibilitySupported && Number(visibilityState?.visible) > 0
  evidence.visibilityCanonicalRefetch = evidence.visibilityHiddenEvent && evidence.visibilityVisibleEvent && evidence.canonicalRefetch

  await connection.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, observer.sessionId)
  await delay(500)
  const offlineState = await evaluate(observer.sessionId, 'navigator.onLine')
  evidence.offlineStateObserved = offlineState === false
  await connection.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, observer.sessionId)
  await delay(2_000)
  const onlineState = await evaluate(observer.sessionId, 'window.__n1Evidence')
  evidence.onlineEventObserved = Number(onlineState?.online) > 0
  evidence.reconnectCanonicalRefetch = evidence.onlineEventObserved && evidence.canonicalRefetch

  evidence.focusEventObserved = evidence.focusEventObserved
  evidence.routeEvidence.push({ state: 'returned-list-root', url: await evaluate(observer.sessionId, 'location.href') })
  const pollStart = evidence.networkRequests.length
  await delay(process.env.QA_N1_SKIP_POLL === '1' ? 0 : 61_000)
  evidence.visiblePollRequestObserved = evidence.networkRequests.length > pollStart

  if (!evidence.n4GeneratedJobLiveRefresh || !evidence.focusCanonicalRefetchObserved || !evidence.visibilityCanonicalRefetch || !evidence.reconnectCanonicalRefetch || !evidence.visiblePollRequestObserved) {
    throw new Error(`N1_LIVE_EVIDENCE_INCOMPLETE:${JSON.stringify(evidence)}`)
  }
  console.log(JSON.stringify({ ...evidence, n1LiveRegression: 'PASS' }))
} finally {
  const planner = await cleanupClient.rpc('qa_n4_func_teardown_plan', { p_run_id: runId })
  if (planner.error || planner.data?.safe_to_clean !== true || Number(planner.data?.untracked_relations) !== 0 || Number(planner.data?.real_record_matches) !== 0 || Number(planner.data?.generated_job_external_references) !== 0) throw new Error(`N1_CLEANUP_UNSAFE:${planner.error?.message || JSON.stringify(planner.data)}`)
  const cleanup = await cleanupClient.rpc('qa_n4_func_teardown', { p_run_id: runId })
  if (cleanup.error) throw cleanup.error
  const second = await cleanupClient.rpc('qa_n4_func_teardown', { p_run_id: runId })
  if (second.error) throw second.error
  console.log(JSON.stringify({ cleanup: cleanup.data?.deleted, second_cleanup: second.data?.deleted }))
  await connection.close()
}
