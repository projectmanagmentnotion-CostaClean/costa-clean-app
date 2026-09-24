import {
  parseRealtimePostgresChangeFrame,
  parseRealtimeReadinessFrame,
  REALTIME_READINESS_TOPIC,
} from './realtimeReadiness.mjs'

/**
 * Attaches to Playwright's WebSocket events without logging URLs, frames, or
 * browser credentials. Callers may expose only getResult()/format metrics.
 */
export function attachRealtimeReadinessProbe(page, {
  expectedTopic = REALTIME_READINESS_TOPIC,
  onReady = () => {},
  onPostgresChange = () => {},
} = {}) {
  const joinRefs = new Set()
  let readyAt = null
  const diagnostics = {
    websocketCount: 0,
    framesSent: 0,
    framesReceived: 0,
    joinRequests: 0,
    joinAcks: 0,
    joinErrors: 0,
  }

  const handleSentFrame = (frame) => {
    diagnostics.framesSent += 1
    const result = parseRealtimeReadinessFrame(frame, expectedTopic)
    if (result.kind === 'JOIN_REQUEST') {
      diagnostics.joinRequests += 1
      if (result.ref) joinRefs.add(result.ref)
    }
  }

  const handleReceivedFrame = (frame) => {
    diagnostics.framesReceived += 1
    const change = parseRealtimePostgresChangeFrame(frame, expectedTopic)
    if (change) onPostgresChange(change)

    const candidates = joinRefs.size > 0 ? [...joinRefs] : [null]
    for (const ref of candidates) {
      const result = parseRealtimeReadinessFrame(frame, expectedTopic, ref)
      if (result.kind === 'JOIN_ERROR') diagnostics.joinErrors += 1
      if (result.kind !== 'JOIN_ACK') continue
      diagnostics.joinAcks += 1
      if (!readyAt) {
        readyAt = new Date().toISOString()
        onReady({ readyAt })
      }
      return
    }
  }

  const handleWebSocket = (webSocket) => {
    diagnostics.websocketCount += 1
    webSocket.on('framesent', handleSentFrame)
    webSocket.on('framereceived', handleReceivedFrame)
  }

  page.on('websocket', handleWebSocket)

  return {
    getResult() {
      return {
        ready: readyAt !== null,
        readyAt,
      }
    },
    getDiagnostics() {
      return { ...diagnostics }
    },
    dispose() {
      page.off('websocket', handleWebSocket)
    },
  }
}
