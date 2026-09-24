export const REALTIME_READINESS_TOPIC = 'realtime:costaclean-app-sync'

function parseJsonFrame(frame) {
  if (typeof frame !== 'string') return frame

  try {
    return JSON.parse(frame)
  } catch {
    return null
  }
}

function normalizeFrame(frame) {
  const parsed = parseJsonFrame(frame)

  if (Array.isArray(parsed)) {
    if (parsed.length < 5) return null
    return {
      ref: typeof parsed[1] === 'string' ? parsed[1] : null,
      topic: typeof parsed[2] === 'string' ? parsed[2] : null,
      event: typeof parsed[3] === 'string' ? parsed[3] : null,
      payload: parsed[4],
    }
  }

  if (!parsed || typeof parsed !== 'object') return null
  const record = parsed
  return {
    ref: typeof record.ref === 'string' ? record.ref : null,
    topic: typeof record.topic === 'string' ? record.topic : null,
    event: typeof record.event === 'string' ? record.event : null,
    payload: record.payload,
  }
}

export function parseRealtimeReadinessFrame(frame, expectedTopic = REALTIME_READINESS_TOPIC, expectedRef = null) {
  const normalized = normalizeFrame(frame)
  if (!normalized || normalized.topic !== expectedTopic) return { kind: 'IGNORE' }
  if (expectedRef !== null && normalized.ref !== expectedRef) return { kind: 'IGNORE' }

  if (normalized.event === 'phx_join') return { kind: 'JOIN_REQUEST', ref: normalized.ref }
  if (normalized.event !== 'phx_reply') return { kind: 'IGNORE' }

  const payload = normalized.payload
  if (!payload || typeof payload !== 'object') return { kind: 'INVALID' }
  if (payload.status === 'ok') return { kind: 'JOIN_ACK', ref: normalized.ref }
  if (payload.status === 'error') return { kind: 'JOIN_ERROR' }
  return { kind: 'INVALID' }
}

export function formatRealtimeReadinessMetrics(readyAt = null) {
  return [
    `OBSERVER_REALTIME_READY=${readyAt ? 'PASS' : 'FAIL'}`,
    ...(readyAt ? [`OBSERVER_REALTIME_READY_AT=${readyAt}`] : []),
  ].join('\n')
}
