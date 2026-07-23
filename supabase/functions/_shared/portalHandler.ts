import {
  PORTAL_MAX_BODY_BYTES,
  PORTAL_SIGNED_URL_TTL_SECONDS,
  type PortalRequest,
  type PortalSurface,
  validatePortalRequest,
} from './portalContract.ts'

const QA_REF = 'kpvvydthlxupjjqqdpxy'
const PRODUCTION_REF = 'wfxnwfcdjainpojhbdri'

interface PortalUser {
  id: string
  email: string
  email_confirmed_at: string
  aal?: string
}

interface HandlerDependencies {
  env(name: string): string | undefined
  fetch(input: string, init: RequestInit): Promise<Response>
  now(): number
  randomBytes(length: number): Uint8Array
  log(event: { event: string; status: number; correlationId: string }): void
  deliverInvitation?(input: {
    email: string
    token: string
    expiresAt: string
    clientId: string
  }): Promise<boolean>
}

interface Configuration {
  supabaseUrl: string
  anonKey: string
  serviceKey: string
  invitationPepper: string
  rateLimitPepper: string
  allowedOrigin: string
}

export function createPortalHandler(surface: PortalSurface, dependencies: HandlerDependencies) {
  return async function handlePortalRequest(request: Request): Promise<Response> {
    const correlationId = crypto.randomUUID()
    const configuration = readConfiguration(dependencies)
    if (!configuration) {
      dependencies.log({ event: 'configuration_denied', status: 503, correlationId })
      return genericError(503, correlationId)
    }

    const corsHeaders = createCorsHeaders(configuration.allowedOrigin)
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }
    if (request.method !== 'POST') return genericError(405, correlationId, corsHeaders, { Allow: 'POST' })
    if (request.headers.get('origin') !== configuration.allowedOrigin) {
      dependencies.log({ event: 'origin_denied', status: 403, correlationId })
      return genericError(403, correlationId, corsHeaders)
    }
    if (request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
      return genericError(415, correlationId, corsHeaders)
    }
    const declaredLength = Number(request.headers.get('content-length') ?? '0')
    if (Number.isFinite(declaredLength) && declaredLength > PORTAL_MAX_BODY_BYTES) {
      return genericError(413, correlationId, corsHeaders)
    }

    const bearer = readBearer(request.headers.get('authorization'))
    if (!bearer) return genericError(401, correlationId, corsHeaders)
    const user = await readVerifiedUser(configuration, bearer, dependencies.fetch)
    if (!user) return genericError(401, correlationId, corsHeaders)

    const rawBody = await request.text().catch(() => '')
    if (!rawBody || new TextEncoder().encode(rawBody).byteLength > PORTAL_MAX_BODY_BYTES) {
      return genericError(400, correlationId, corsHeaders)
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(rawBody)
    } catch {
      return genericError(400, correlationId, corsHeaders)
    }
    const payload = validatePortalRequest(surface, parsed)
    if (!payload) return genericError(400, correlationId, corsHeaders)

    const networkValue = readNetworkValue(request.headers)
    if (!networkValue) return genericError(400, correlationId, corsHeaders)

    try {
      const response = await dispatch(
        payload,
        user,
        networkValue,
        correlationId,
        configuration,
        dependencies,
      )
      dependencies.log({ event: `${payload.action}_completed`, status: response.status, correlationId })
      return withHeaders(response, corsHeaders)
    } catch {
      dependencies.log({ event: `${payload.action}_denied`, status: 404, correlationId })
      return genericError(404, correlationId, corsHeaders)
    }
  }
}

async function dispatch(
  payload: PortalRequest,
  user: PortalUser,
  networkValue: string,
  correlationId: string,
  configuration: Configuration,
  dependencies: HandlerDependencies,
): Promise<Response> {
  const subject = await hmacHex(
    configuration.rateLimitPepper,
    `${payload.action}:${user.id}:${'clientId' in payload ? payload.clientId : 'account'}:${networkValue}`,
  )
  const correlationUuid = normalizeCorrelationId(correlationId)

  switch (payload.action) {
    case 'submitApplication':
      await rpc(configuration, dependencies.fetch, 'portal_submit_application_trusted', {
        p_actor_user_id: user.id,
        p_email_normalized: user.email.trim().toLowerCase(),
        p_contact_name: payload.contactName,
        p_company_name: payload.companyName,
        p_contact_phone: payload.contactPhone,
        p_privacy_notice_version: payload.privacyNoticeVersion,
        p_rate_limit_subject_hash: subject,
        p_correlation_id: correlationUuid,
      })
      return accepted()
    case 'acceptInvitation': {
      const tokenHash = await hmacHex(configuration.invitationPepper, payload.token)
      const result = await rpc(configuration, dependencies.fetch, 'portal_accept_invitation_trusted', {
        p_actor_user_id: user.id,
        p_token_hash: tokenHash,
        p_rate_limit_subject_hash: subject,
        p_correlation_id: correlationUuid,
      })
      return jsonResponse({ ok: true, result }, 200)
    }
    case 'submitProfileChange': {
      const id = await rpc(configuration, dependencies.fetch, 'portal_submit_profile_change_trusted', {
        p_actor_user_id: user.id,
        p_client_id: payload.clientId,
        p_proposed_changes: payload.changes,
        p_rate_limit_subject_hash: subject,
        p_correlation_id: correlationUuid,
      })
      return jsonResponse({ ok: true, requestId: id }, 201)
    }
    case 'submitPropertyChange': {
      const id = await rpc(configuration, dependencies.fetch, 'portal_submit_property_change_trusted', {
        p_actor_user_id: user.id,
        p_client_id: payload.clientId,
        p_property_id: payload.propertyId,
        p_proposed_changes: payload.changes,
        p_rate_limit_subject_hash: subject,
        p_correlation_id: correlationUuid,
      })
      return jsonResponse({ ok: true, requestId: id }, 201)
    }
    case 'submitServiceRequest': {
      const result = await rpc(configuration, dependencies.fetch, 'portal_submit_service_request_trusted', {
        p_actor_user_id: user.id,
        p_client_id: payload.clientId,
        p_property_id: payload.propertyId,
        p_service_type: payload.serviceType,
        p_preferred_date: payload.preferredDate,
        p_preferred_time_window: payload.preferredTimeWindow,
        p_notes: payload.notes,
        p_idempotency_key: payload.idempotencyKey,
        p_rate_limit_subject_hash: subject,
        p_correlation_id: correlationUuid,
      })
      return jsonResponse({ ok: true, result }, 201)
    }
    case 'cancelServiceRequest': {
      const result = await rpc(configuration, dependencies.fetch, 'portal_cancel_service_request_trusted', {
        p_actor_user_id: user.id,
        p_client_id: payload.clientId,
        p_request_id: payload.requestId,
        p_expected_version: payload.expectedVersion,
        p_rate_limit_subject_hash: subject,
        p_correlation_id: correlationUuid,
      })
      return jsonResponse({ ok: true, result }, 200)
    }
    case 'inviteMember': {
      if (dependencies.env('PORTAL_REQUIRE_AAL2_FOR_ADMIN') === 'true' && user.aal !== 'aal2') {
        throw new Error('denied')
      }
      if (!dependencies.deliverInvitation) throw new Error('delivery_unavailable')
      const token = base64Url(dependencies.randomBytes(32))
      const tokenHash = await hmacHex(configuration.invitationPepper, token)
      const expiresAt = new Date(dependencies.now() + 72 * 60 * 60 * 1000).toISOString()
      const invitationId = await rpc(configuration, dependencies.fetch, 'portal_create_invitation_trusted', {
        p_actor_user_id: user.id,
        p_client_id: payload.clientId,
        p_email_normalized: payload.email,
        p_role: payload.role,
        p_token_hash: tokenHash,
        p_expires_at: expiresAt,
        p_rate_limit_subject_hash: subject,
        p_correlation_id: correlationUuid,
      })
      const delivered = await dependencies.deliverInvitation({
        email: payload.email,
        token,
        expiresAt,
        clientId: payload.clientId,
      })
      if (!delivered) throw new Error('delivery_unavailable')
      return jsonResponse({ ok: true, invitationId }, 202)
    }
    case 'revokeMember':
      if (dependencies.env('PORTAL_REQUIRE_AAL2_FOR_ADMIN') === 'true' && user.aal !== 'aal2') {
        throw new Error('denied')
      }
      await rpc(configuration, dependencies.fetch, 'portal_revoke_member_trusted', {
        p_actor_user_id: user.id,
        p_client_id: payload.clientId,
        p_target_membership_id: payload.membershipId,
        p_rate_limit_subject_hash: subject,
        p_correlation_id: correlationUuid,
      })
      return accepted()
    case 'downloadInvoice': {
      const authorization = await rpc(configuration, dependencies.fetch, 'portal_get_invoice_download_authorization_trusted', {
        p_actor_user_id: user.id,
        p_client_id: payload.clientId,
        p_invoice_id: payload.invoiceId,
        p_document_id: payload.documentId,
        p_rate_limit_subject_hash: subject,
        p_correlation_id: correlationUuid,
      }) as { objectKey?: unknown; expiresIn?: unknown }
      if (typeof authorization?.objectKey !== 'string'
        || authorization.expiresIn !== PORTAL_SIGNED_URL_TTL_SECONDS
        || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/u.test(authorization.objectKey)) {
        throw new Error('denied')
      }
      const signed = await signExactObject(configuration, authorization.objectKey, dependencies.fetch)
      return jsonResponse({
        ok: true,
        signedUrl: signed,
        expiresIn: PORTAL_SIGNED_URL_TTL_SECONDS,
      }, 200)
    }
  }
}

function readConfiguration(dependencies: HandlerDependencies): Configuration | null {
  const supabaseUrl = dependencies.env('SUPABASE_URL')?.trim()
  const anonKey = dependencies.env('SUPABASE_ANON_KEY')?.trim()
  const serviceKey = dependencies.env('SUPABASE_SERVICE_ROLE_KEY')?.trim()
  const invitationPepper = dependencies.env('PORTAL_INVITATION_PEPPER')?.trim()
  const rateLimitPepper = dependencies.env('PORTAL_RATE_LIMIT_PEPPER')?.trim()
  const allowedOrigin = dependencies.env('PORTAL_ALLOWED_ORIGIN')?.trim()
  const projectRef = projectRefFromUrl(supabaseUrl)
  if (!supabaseUrl || !anonKey || !serviceKey || !invitationPepper || !rateLimitPepper
    || invitationPepper.length < 43 || rateLimitPepper.length < 43
    || !allowedOrigin || projectRef !== QA_REF || projectRef === PRODUCTION_REF) return null
  return { supabaseUrl, anonKey, serviceKey, invitationPepper, rateLimitPepper, allowedOrigin }
}

async function readVerifiedUser(
  configuration: Configuration,
  bearer: string,
  fetchImpl: HandlerDependencies['fetch'],
): Promise<PortalUser | null> {
  const response = await fetchImpl(`${configuration.supabaseUrl}/auth/v1/user`, {
    method: 'GET',
    headers: {
      apikey: configuration.anonKey,
      Authorization: `Bearer ${bearer}`,
    },
  })
  if (!response.ok) return null
  const body = await response.json().catch(() => null) as Record<string, unknown> | null
  if (!body || typeof body.id !== 'string' || typeof body.email !== 'string'
    || typeof body.email_confirmed_at !== 'string') return null
  return {
    id: body.id,
    email: body.email,
    email_confirmed_at: body.email_confirmed_at,
    aal: typeof body.aal === 'string' ? body.aal : undefined,
  }
}

async function rpc(
  configuration: Configuration,
  fetchImpl: HandlerDependencies['fetch'],
  functionName: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const response = await fetchImpl(`${configuration.supabaseUrl}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      apikey: configuration.serviceKey,
      Authorization: `Bearer ${configuration.serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error('rpc_denied')
  return response.json().catch(() => null)
}

async function signExactObject(
  configuration: Configuration,
  objectKey: string,
  fetchImpl: HandlerDependencies['fetch'],
): Promise<string> {
  const encodedKey = objectKey.split('/').map(encodeURIComponent).join('/')
  const response = await fetchImpl(
    `${configuration.supabaseUrl}/storage/v1/object/sign/invoice-documents/${encodedKey}`,
    {
      method: 'POST',
      headers: {
        apikey: configuration.serviceKey,
        Authorization: `Bearer ${configuration.serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: PORTAL_SIGNED_URL_TTL_SECONDS }),
    },
  )
  if (!response.ok) throw new Error('sign_denied')
  const body = await response.json().catch(() => null) as { signedURL?: unknown; signedUrl?: unknown } | null
  const signedUrl = body?.signedURL ?? body?.signedUrl
  if (typeof signedUrl !== 'string' || signedUrl.length > 4096) throw new Error('sign_denied')
  return signedUrl
}

function projectRefFromUrl(value: string | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.hostname.endsWith('.supabase.co') ? url.hostname.split('.')[0].toLowerCase() : null
  } catch {
    return null
  }
}

function readBearer(value: string | null): string | null {
  if (!value?.startsWith('Bearer ')) return null
  const bearer = value.slice(7).trim()
  return bearer && bearer.length <= 8192 ? bearer : null
}

function readNetworkValue(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for')?.split(',', 1)[0].trim().toLowerCase()
  if (!forwarded || forwarded.length > 64 || !/^[0-9a-f:.]+$/iu.test(forwarded)) return null
  return forwarded
}

async function hmacHex(secret: string, value: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value))
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function base64Url(value: Uint8Array): string {
  let binary = ''
  for (const byte of value) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

function normalizeCorrelationId(value: string): string {
  return /^[0-9a-f-]{36}$/u.test(value) ? value : crypto.randomUUID()
}

function accepted(): Response {
  return jsonResponse({ ok: true }, 202)
}

function genericError(
  status: number,
  correlationId: string,
  headers: Record<string, string> = {},
  extraHeaders: Record<string, string> = {},
): Response {
  return jsonResponse(
    { ok: false, error: { code: 'request_unavailable', message: 'No se pudo completar la solicitud.' }, correlationId },
    status,
    { ...headers, ...extraHeaders },
  )
}

function jsonResponse(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Cache-Control': 'no-store, private',
      'Content-Type': 'application/json; charset=utf-8',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  })
}

function createCorsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

function withHeaders(response: Response, headers: Record<string, string>): Response {
  const combined = new Headers(response.headers)
  for (const [name, value] of Object.entries(headers)) combined.set(name, value)
  return new Response(response.body, { status: response.status, headers: combined })
}
