import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const PUBLIC_WEB_INTAKE_MAX_BODY_BYTES = 50_000
export const PUBLIC_WEB_INTAKE_REPLAY_WINDOW_SECONDS = 300

export function verifyPublicWebIntake(body, secret, headers, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!secret || secret.length < 32) return { ok: false, status: 503 }
  const timestamp = headers['x-costa-timestamp']
  const environment = headers['x-costa-environment']
  const submissionId = headers['x-costa-submission-id']
  const clientKey = headers['x-costa-client-key']
  const signature = headers['x-costa-signature']
  const timestampSeconds = Number(timestamp)
  if (environment !== 'production' || !Number.isSafeInteger(timestampSeconds) || Math.abs(nowSeconds - timestampSeconds) > PUBLIC_WEB_INTAKE_REPLAY_WINDOW_SECONDS) return { ok: false, status: 401 }
  if (!/^[0-9a-f-]{36}$/i.test(submissionId || '') || submissionId !== body?.submissionId || !/^[0-9a-f]{64}$/i.test(clientKey || '')) return { ok: false, status: 401 }

  const bodyHash = createHash('sha256').update(JSON.stringify(body), 'utf8').digest('hex')
  const expected = createHmac('sha256', secret).update(`${timestamp}.production.${bodyHash}.${submissionId}.${clientKey}`, 'utf8').digest()
  const actual = Buffer.from(typeof signature === 'string' ? signature : '', 'hex')
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return { ok: false, status: 401 }
  return { ok: true, clientKey, submissionId }
}

export function isProductionSupabaseUrl(value) {
  try {
    const url = new URL(value)
    return url.origin === 'https://wfxnwfcdjainpojhbdri.supabase.co' && url.pathname === '/' && !url.search && !url.hash
  } catch { return false }
}
