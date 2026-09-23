import { CdpConnection, buildViewUrl, closeBrowserSession, delay, openBrowserSession, readAuthStateMetadata, waitForCdpEndpoint, waitForShellStable } from './auth/cdpHarness.mjs'
import { recoverAuthenticatedQaSession } from './auth/recoveredQaSession.mjs'

const runId = process.argv[2]
const port = Number(process.env.QA_CDP_PORT || 59285)
const marker = `QA_N2_FUNC_${runId}`
const recovered = await recoverAuthenticatedQaSession()
const metadata = await readAuthStateMetadata(`${process.cwd()}/.auth/costa-clean-storage-state.json`)
const endpoint = await waitForCdpEndpoint(port, 10000)
const connection = new CdpConnection(endpoint.webSocketDebuggerUrl)
await connection.connect()

const pages = {}
const sessionToView = new Map()
for (const view of ['invoices', 'jobs', 'payments']) {
  const session = await openBrowserSession(connection, buildViewUrl(metadata.appUrl, view))
  await waitForShellStable(connection, session.sessionId)
  pages[view] = session
  sessionToView.set(session.sessionId, view)
}

await delay(1500)
const armedAt = Date.now()
const postArmRequests = []
connection.on('Network.requestWillBeSent', (params, sessionId) => {
  if (Date.now() < armedAt || !sessionToView.has(sessionId)) return
  if (params.request?.url?.includes('/rest/v1/')) {
    postArmRequests.push({ view: sessionToView.get(sessionId), url: params.request.url, atMs: Date.now() - armedAt })
  }
})
const startedAt = armedAt
const hits = {}
while (Date.now() - startedAt < 30000 && Object.keys(hits).length < 3) {
  for (const [view, session] of Object.entries(pages)) {
    if (hits[view]) continue
    const response = await connection.send('Runtime.evaluate', {
      expression: `document.body?.innerText?.includes(${JSON.stringify(marker)}) === true`,
      returnByValue: true,
    }, session.sessionId)
    if (response.result?.value === true) hits[view] = Date.now() - startedAt
  }
  await delay(250)
}

const result = { runId, marker, observer: 'context-b', views: Object.keys(hits), hits, postArmRequests, realtimeObserved: postArmRequests.length > 0 }
process.stdout.write(`${JSON.stringify(result)}\n`)
for (const session of Object.values(pages)) await closeBrowserSession(connection, session.targetId, session.sessionId)
await connection.close()
