import {
  PUBLIC_LEAD_INTAKE_MAX_BODY_BYTES,
  PUBLIC_LEAD_INTAKE_REPLAY_WINDOW_SECONDS,
  type PublicLeadDatabaseResponse,
  type PublicLeadErrorCode,
  type PublicLeadRequest,
  type PublicLeadResponse,
  validatePublicLeadRequest,
} from './publicLeadIntakeContract.ts'

const QA_PROJECT_REF = 'kpvvydthlxupjjqqdpxy'
const corsHeaders = {
  'Access-Control-Allow-Origin': 'null',
  'Access-Control-Allow-Headers': 'content-type, x-costa-environment, x-costa-idempotency-key, x-costa-signature, x-costa-timestamp',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
}

export interface PublicLeadIntakeHandlerDependencies {
  env(name: string): string | undefined
  fetch(input: string, init: RequestInit): Promise<Response>
  now(): number
  log(event: { event: string; status: number }): void
}

export function createPublicLeadIntakeHandler(dependencies: PublicLeadIntakeHandlerDependencies) {
  return async function handlePublicLeadIntake(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
    if (request.method !== 'POST') return errorResponse(405, 'invalid_request', 'Solicitud no válida.', { Allow: 'POST' })
    const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
    if (contentType !== 'application/json') return errorResponse(415, 'invalid_request', 'Solicitud no válida.')

    const declaredLength = Number(request.headers.get('content-length') ?? '0')
    if (Number.isFinite(declaredLength) && declaredLength > PUBLIC_LEAD_INTAKE_MAX_BODY_BYTES) {
      return errorResponse(413, 'invalid_request', 'Solicitud no válida.')
    }

    let rawBody = ''
    try {
      rawBody = await request.text()
    } catch {
      return errorResponse(400, 'invalid_request', 'Solicitud no válida.')
    }
    if (new TextEncoder().encode(rawBody).byteLength > PUBLIC_LEAD_INTAKE_MAX_BODY_BYTES) {
      return errorResponse(413, 'invalid_request', 'Solicitud no válida.')
    }

    const timestamp = request.headers.get('x-costa-timestamp')
    const environment = request.headers.get('x-costa-environment')
    const idempotencyKey = request.headers.get('x-costa-idempotency-key')
    const signature = request.headers.get('x-costa-signature')
    const secret = dependencies.env('PUBLIC_LEAD_INTAKE_SECRET')?.trim()
    const supabaseUrl = dependencies.env('SUPABASE_URL')
    const serviceRoleKey = dependencies.env('SUPABASE_SERVICE_ROLE_KEY')?.trim()
    const projectRef = readProjectRef(supabaseUrl)
    if (!secret || secret.length < 32 || !timestamp || !environment || !idempotencyKey || !signature
      || environment !== 'qa' || projectRef !== QA_PROJECT_REF || !serviceRoleKey) {
      dependencies.log({ event: 'configuration_or_auth_denied', status: 503 })
      return errorResponse(503, 'temporarily_unavailable', 'El servicio no está disponible. Inténtalo más tarde.')
    }

    const payload = parsePayload(rawBody)
    if (!payload || payload.environment !== environment || payload.submission_id !== idempotencyKey) {
      return errorResponse(400, 'invalid_request', 'Solicitud no válida.')
    }

    const timestampSeconds = Number(timestamp)
    if (!Number.isSafeInteger(timestampSeconds) || Math.abs(Math.floor(dependencies.now() / 1_000) - timestampSeconds) > PUBLIC_LEAD_INTAKE_REPLAY_WINDOW_SECONDS) {
      dependencies.log({ event: 'expired_request', status: 401 })
      return errorResponse(401, 'invalid_request', 'Solicitud no válida.')
    }

    try {
      const bodyHash = await sha256Hex(rawBody)
      const expectedSignature = await hmacHex(secret, `${timestamp}.${environment}.${bodyHash}`)
      if (!constantTimeEqualHex(signature, expectedSignature)) {
        dependencies.log({ event: 'signature_rejected', status: 401 })
        return errorResponse(401, 'invalid_request', 'Solicitud no válida.')
      }

      const abuseKey = await hmacHex(secret, `network:${readClientNetworkKey(request.headers)}`)
      const rpcResponse = await dependencies.fetch(
        `${supabaseUrl}/rest/v1/rpc/submit_public_lead_intake_qa`,
        {
          method: 'POST',
          headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            p_request: {
              ...payload,
              legal_context: { environment: 'qa', status: 'PREVIEW / REVIEW_REQUIRED', version: 'cp42b-qa-preview-v1' },
              received_at: new Date(dependencies.now()).toISOString(),
            },
            p_abuse_key: abuseKey,
            p_payload_sha256: bodyHash,
          }),
        },
      )
      if (!rpcResponse.ok) {
        dependencies.log({ event: 'database_error', status: 503 })
        return errorResponse(503, 'temporarily_unavailable', 'El servicio no está disponible. Inténtalo más tarde.')
      }
      const rpcBody = await rpcResponse.json().catch(() => null) as PublicLeadDatabaseResponse | null
      if (!rpcBody || typeof rpcBody !== 'object' || typeof rpcBody.ok !== 'boolean') {
        dependencies.log({ event: 'invalid_database_response', status: 503 })
        return errorResponse(503, 'temporarily_unavailable', 'El servicio no está disponible. Inténtalo más tarde.')
      }
      if (!rpcBody.ok && rpcBody.code === 'rate_limited') {
        dependencies.log({ event: 'submission_limited', status: 429 })
        return errorResponse(429, 'rate_limited', 'Espera antes de volver a intentarlo.', { 'Retry-After': '60' }, 60)
      }
      if (!rpcBody.ok || !rpcBody.receipt_id) {
        dependencies.log({ event: 'submission_rejected', status: 409 })
        return errorResponse(409, 'invalid_request', 'Solicitud no válida.')
      }
      dependencies.log({ event: rpcBody.code === 'idempotent' ? 'submission_replayed' : 'submission_accepted', status: 200 })
      return jsonResponse({ ok: true, receiptId: rpcBody.receipt_id }, 200)
    } catch {
      dependencies.log({ event: 'handler_error', status: 503 })
      return errorResponse(503, 'temporarily_unavailable', 'El servicio no está disponible. Inténtalo más tarde.')
    }
  }
}

function parsePayload(rawBody: string): PublicLeadRequest | null {
  try { return validatePublicLeadRequest(JSON.parse(rawBody)) } catch { return null }
}

function readProjectRef(url: string | undefined): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.hostname.endsWith('.supabase.co') ? parsed.hostname.split('.')[0].toLowerCase() : null
  } catch { return null }
}

function readClientNetworkKey(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',', 1)[0].trim()
  if (forwarded && forwarded.length <= 64 && /^[0-9a-f:.]+$/iu.test(forwarded)) return forwarded.toLowerCase()
  return 'anonymous'
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function constantTimeEqualHex(left: string, right: string): boolean {
  if (!/^[0-9a-f]{64}$/iu.test(left) || !/^[0-9a-f]{64}$/iu.test(right)) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return difference === 0
}

function errorResponse(status: number, code: PublicLeadErrorCode, message: string, extraHeaders: Record<string, string> = {}, retryAfterSeconds?: number): Response {
  const body: PublicLeadResponse = { ok: false, error: { code, message }, ...(retryAfterSeconds ? { retryAfterSeconds } : {}) }
  return jsonResponse(body, status, extraHeaders)
}

function jsonResponse(body: PublicLeadResponse, status: number, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, ...extraHeaders } })
}
