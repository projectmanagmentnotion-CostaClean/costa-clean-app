import { createClient } from '@supabase/supabase-js'
import { recoverAuthenticatedQaSession } from './auth/recoveredQaSession.mjs'
import { CdpConnection, waitForCdpEndpoint, openBrowserSession, waitForShellStable, readAuthStateMetadata, getQaPaths, buildViewUrl } from './auth/cdpHarness.mjs'

const runId = String(process.argv[2] ?? '').trim()
const cdpPort = Number(process.env.QA_CDP_PORT ?? 59285)
if (!/^[0-9a-f]{32}$/u.test(runId)) throw new Error('TRACE_REQUIRES_32_HEX_RUN_ID')
const rootDir = process.cwd()
const marker = `QA_N2_FUNC_${runId}`
const session = await recoverAuthenticatedQaSession(rootDir)
const supabase = createClient(session.supabaseUrl, session.supabaseAnonKey, { accessToken: async () => session.accessToken, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
const clientId = `CLIENT-${marker}-UIROOT`
const propertyId = `PROPERTY-${marker}-UIROOT`
const jobId = `JOB-${marker}-UIROOT`
const { data: dbJob, error: dbError } = await supabase.from('jobs').select('id,client_id,property_id,status,archived_at,deleted_at,cancelled_at').eq('id', jobId).maybeSingle()
if (dbError) throw dbError
const endpoint = await waitForCdpEndpoint(cdpPort, 5000)
const connection = new CdpConnection(endpoint.webSocketDebuggerUrl)
await connection.connect()
const appUrl = (await readAuthStateMetadata(getQaPaths(rootDir).stateFile)).appUrl
const page = await openBrowserSession(connection, buildViewUrl(appUrl, 'invoices'))
const jobsResponses = []
const responseBodies = new Map()
connection.on('Network.responseReceived', (params, eventSessionId) => {
  if (eventSessionId !== page.sessionId || !params.response?.url?.includes('/rest/v1/jobs')) return
  jobsResponses.push({ requestId: params.requestId, method: params.response.requestHeaders?.[':method'] ?? null, url: params.response.url, status: params.response.status })
})
connection.on('Network.loadingFinished', async (params, eventSessionId) => {
  if (eventSessionId !== page.sessionId) return
  const response = jobsResponses.find((entry) => entry.requestId === params.requestId)
  if (!response) return
  try {
    const body = await connection.send('Network.getResponseBody', { requestId: params.requestId }, page.sessionId)
    responseBodies.set(params.requestId, body.body)
  } catch {}
})
await connection.send('Network.enable', {}, page.sessionId)
await connection.send('Page.navigate', { url: buildViewUrl(appUrl, 'invoices') }, page.sessionId)
await waitForShellStable(connection, page.sessionId, 15000)
await new Promise((resolve) => setTimeout(resolve, 5000))
const matching = jobsResponses.find((entry) => responseBodies.has(entry.requestId))
let rows = []
if (matching) { try { rows = JSON.parse(responseBodies.get(matching.requestId)) } catch {} }
const browserSnapshot = await connection.send('Runtime.evaluate', { expression: `(() => ({ jobs: document.querySelectorAll('option').length, marker: document.body.innerText.includes(${JSON.stringify(marker)}) }))()`, returnByValue: true }, page.sessionId)
console.log(JSON.stringify({ runId, clientId, propertyId, jobId, dbJob, jobsNetwork: matching ? { method: matching.method, path: new URL(matching.url).pathname, query: new URL(matching.url).search, status: matching.status, rowCount: Array.isArray(rows) ? rows.length : null, traceJobPresent: Array.isArray(rows) && rows.some((row) => row.id === jobId), row: Array.isArray(rows) ? rows.find((row) => row.id === jobId) ?? null : null } : null, browserSnapshot: browserSnapshot.result?.value ?? null }, null, 2))
await connection.send('Page.close', {}, page.sessionId).catch(() => {})
await connection.close()
