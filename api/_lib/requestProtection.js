const minimumSubmissionAgeMs = 4_000
const maximumSubmissionAgeMs = 86_400_000
const ipWindowMs = 900_000
const maxSubmissionsPerIpWindow = 6
const ipAttempts = new Map()

function readString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function getClientIp(req) {
  const forwardedFor = req?.headers?.['x-forwarded-for']
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim()
  }

  const realIp = req?.headers?.['x-real-ip']
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim()
  }

  return readString(req?.socket?.remoteAddress) || null
}

export function isHoneypotTriggered(payload) {
  return readString(payload?.website).length > 0
}

export function validateSubmissionTiming({
  startedAt,
  submittedAt,
  nowMs = Date.now(),
}) {
  const startedAtMs = Date.parse(readString(startedAt))
  const submittedAtMs = Date.parse(readString(submittedAt))

  if (!Number.isFinite(startedAtMs) || !Number.isFinite(submittedAtMs) || submittedAtMs < startedAtMs) {
    return {
      ok: false,
      error: 'Solicitud invalida. Recarga la pagina y vuelve a intentarlo.',
    }
  }

  const ageMs = submittedAtMs - startedAtMs
  if (ageMs < minimumSubmissionAgeMs) {
    return {
      ok: false,
      error: 'No se pudo validar la solicitud. Espera unos segundos y vuelve a intentarlo.',
    }
  }

  if (nowMs - startedAtMs > maximumSubmissionAgeMs) {
    return {
      ok: false,
      error: 'La sesion del formulario ha caducado. Recarga la pagina y vuelve a intentarlo.',
    }
  }

  return { ok: true, error: null }
}

export function registerIpAttempt(clientIp, nowMs = Date.now()) {
  if (!clientIp) return true

  const activeTimestamps = (ipAttempts.get(clientIp) ?? []).filter(
    (timestamp) => nowMs - timestamp < ipWindowMs,
  )

  if (activeTimestamps.length >= maxSubmissionsPerIpWindow) {
    ipAttempts.set(clientIp, activeTimestamps)
    return false
  }

  activeTimestamps.push(nowMs)
  ipAttempts.set(clientIp, activeTimestamps)
  return true
}

export const requestProtectionConfig = {
  minimumSubmissionAgeMs,
  maximumSubmissionAgeMs,
  ipWindowMs,
  maxSubmissionsPerIpWindow,
}
