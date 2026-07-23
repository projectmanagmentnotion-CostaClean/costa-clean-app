import {
  PUBLIC_QUIZ_MAX_BODY_BYTES,
  type PublicQuizErrorCode,
  type PublicQuizResponse,
  validatePublicQuizRequest,
} from './publicQuizContract.ts'

const AUTHORIZED_PROJECT_REFS = new Set([
  'kpvvydthlxupjjqqdpxy',
  'wfxnwfcdjainpojhbdri',
])
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
}

export interface PublicQuizHandlerDependencies {
  env(name: string): string | undefined
  fetch(input: string, init: RequestInit): Promise<Response>
  now(): number
  log(event: { event: string; status: number }): void
}

export function createPublicQuizHandler(dependencies: PublicQuizHandlerDependencies) {
  return async function handlePublicQuiz(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
    if (request.method !== 'POST') return errorResponse(405, 'invalid_request', 'Solicitud no válida.', { Allow: 'POST' })
    const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
    if (contentType !== 'application/json') return errorResponse(415, 'invalid_request', 'Solicitud no válida.')

    const declaredLength = Number(request.headers.get('content-length') ?? '0')
    if (Number.isFinite(declaredLength) && declaredLength > PUBLIC_QUIZ_MAX_BODY_BYTES) {
      return errorResponse(413, 'invalid_request', 'Solicitud no válida.')
    }

    let rawBody = ''
    try {
      rawBody = await request.text()
    } catch {
      return errorResponse(400, 'invalid_request', 'Solicitud no válida.')
    }
    if (new TextEncoder().encode(rawBody).byteLength > PUBLIC_QUIZ_MAX_BODY_BYTES) {
      return errorResponse(413, 'invalid_request', 'Solicitud no válida.')
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(rawBody)
    } catch {
      return errorResponse(400, 'invalid_request', 'Solicitud no válida.')
    }
    const payload = validatePublicQuizRequest(parsed, dependencies.now())
    if (!payload) return errorResponse(400, 'invalid_request', 'Solicitud no válida.')

    const supabaseUrl = dependencies.env('SUPABASE_URL')?.trim()
    const serviceKey = dependencies.env('SUPABASE_SERVICE_ROLE_KEY')?.trim()
    const pepper = dependencies.env('PUBLIC_QUIZ_FINGERPRINT_PEPPER')?.trim()
    const projectRef = readProjectRef(supabaseUrl)
    const clientIp = readTrustedClientIp(request.headers)
    if (!supabaseUrl || !serviceKey || !pepper || pepper.length < 43 || !clientIp
      || !projectRef || !AUTHORIZED_PROJECT_REFS.has(projectRef)) {
      dependencies.log({ event: 'configuration_denied', status: 503 })
      return errorResponse(503, 'temporarily_unavailable', 'El servicio no está disponible. Inténtalo más tarde.')
    }

    try {
      const [fingerprintHash, nonceHash] = await Promise.all([
        hmacHex(pepper, `network:${clientIp}`),
        hmacHex(pepper, `nonce:${payload.requestNonce}`),
      ])
      const rpcResponse = await dependencies.fetch(
        `${supabaseUrl}/rest/v1/rpc/submit_public_gym_manual_quiz_attempt_private`,
        {
          method: 'POST',
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            p_request: payload,
            p_fingerprint_hash: fingerprintHash,
            p_nonce_hash: nonceHash,
          }),
        },
      )
      if (!rpcResponse.ok) {
        dependencies.log({ event: 'database_error', status: 503 })
        return errorResponse(503, 'temporarily_unavailable', 'El servicio no está disponible. Inténtalo más tarde.')
      }
      const rpcBody = await rpcResponse.json().catch(() => null) as PublicQuizResponse | null
      if (!rpcBody || typeof rpcBody !== 'object' || typeof rpcBody.ok !== 'boolean') {
        dependencies.log({ event: 'invalid_database_response', status: 503 })
        return errorResponse(503, 'temporarily_unavailable', 'El servicio no está disponible. Inténtalo más tarde.')
      }
      if (!rpcBody.ok) {
        dependencies.log({ event: 'submission_limited', status: 429 })
        return errorResponse(429, 'rate_limited', 'Espera antes de volver a intentarlo.', { 'Retry-After': '60' }, 60)
      }
      dependencies.log({ event: 'submission_accepted', status: 200 })
      return jsonResponse(rpcBody, 200)
    } catch {
      dependencies.log({ event: 'handler_error', status: 503 })
      return errorResponse(503, 'temporarily_unavailable', 'El servicio no está disponible. Inténtalo más tarde.')
    }
  }
}

function readProjectRef(url: string | undefined): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.hostname.endsWith('.supabase.co') ? parsed.hostname.split('.')[0].toLowerCase() : null
  } catch {
    return null
  }
}

function readTrustedClientIp(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for')?.split(',', 1)[0].trim()
  if (!forwarded || forwarded.length > 64 || !/^[0-9a-f:.]+$/iu.test(forwarded)) return null
  return forwarded.toLowerCase()
}

async function hmacHex(secret: string, value: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value))
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function errorResponse(
  status: number,
  code: PublicQuizErrorCode,
  message: string,
  extraHeaders: Record<string, string> = {},
  retryAfterSeconds?: number,
): Response {
  const body: PublicQuizResponse = {
    ok: false,
    error: { code, message },
    ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
  }
  return jsonResponse(body, status, extraHeaders)
}

function jsonResponse(body: PublicQuizResponse, status: number, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, ...extraHeaders } })
}
