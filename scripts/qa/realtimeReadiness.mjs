export const REALTIME_READINESS_TOPIC = 'realtime:costaclean-app-sync'

function parseJsonFrame(frame) {
  if (frame instanceof Uint8Array) {
    try {
      return JSON.parse(new TextDecoder().decode(frame))
    } catch {
      return null
    }
  }

  if (typeof frame !== 'string') return frame

  try {
    return JSON.parse(frame)
  } catch {
    return null
  }
}

function normalizeFrame(frame) {
  let parsed = parseJsonFrame(frame)

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && !parsed.topic && !parsed.event && !parsed.ref && parsed.payload !== undefined) {
    const unwrapped = parseJsonFrame(parsed.payload)
    if (unwrapped && typeof unwrapped === 'object') parsed = unwrapped
  }

  if (Array.isArray(parsed)) {
    if (parsed.length === 4) {
      return {
        ref: typeof parsed[0] === 'string' ? parsed[0] : null,
        topic: typeof parsed[1] === 'string' ? parsed[1] : null,
        event: typeof parsed[2] === 'string' ? parsed[2] : null,
        payload: parsed[3],
      }
    }
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

export function parseRealtimePostgresChangeFrame(frame, expectedTopic = REALTIME_READINESS_TOPIC) {
  const normalized = normalizeFrame(frame)
  if (!normalized || normalized.topic !== expectedTopic || normalized.event !== 'postgres_changes') return null

  const payload = normalized.payload
  const data = payload && typeof payload === 'object' && payload.data && typeof payload.data === 'object'
    ? Array.isArray(payload.data) ? payload.data[0] : payload.data
    : payload
  if (!data || typeof data !== 'object') return null

  const record = data.new && typeof data.new === 'object'
    ? data.new
    : data.record && typeof data.record === 'object'
      ? data.record
      : null
  return {
    kind: 'POSTGRES_CHANGE',
    table: typeof data.table === 'string' ? data.table : null,
    eventType: typeof data.eventType === 'string' ? data.eventType : typeof data.type === 'string' ? data.type : null,
    recordId: record && typeof record.id === 'string' ? record.id : null,
  }
}

export function formatRealtimeReadinessMetrics(readyAt = null) {
  return [
    `OBSERVER_REALTIME_READY=${readyAt ? 'PASS' : 'FAIL'}`,
    ...(readyAt ? [`OBSERVER_REALTIME_READY_AT=${readyAt}`] : []),
  ].join('\n')
}
