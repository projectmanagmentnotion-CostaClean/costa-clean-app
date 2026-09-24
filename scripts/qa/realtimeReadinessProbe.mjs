import {
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
} = {}) {
  const joinRefs = new Set()
  let readyAt = null

  const handleSentFrame = (frame) => {
    const result = parseRealtimeReadinessFrame(frame, expectedTopic)
    if (result.kind === 'JOIN_REQUEST' && result.ref) joinRefs.add(result.ref)
  }

  const handleReceivedFrame = (frame) => {
    const candidates = [...joinRefs]
    for (const ref of candidates) {
      const result = parseRealtimeReadinessFrame(frame, expectedTopic, ref)
      if (result.kind !== 'JOIN_ACK') continue
      if (!readyAt) {
        readyAt = new Date().toISOString()
        onReady({ readyAt })
      }
      return
    }
  }

  const handleWebSocket = (webSocket) => {
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
    dispose() {
      page.off('websocket', handleWebSocket)
    },
  }
}
