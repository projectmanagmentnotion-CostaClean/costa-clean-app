// cp43-runtime-refresh-20260918T093439Z-noop
import { createTransactionalEmailProviderFromEnvironment } from '../_shared/transactionalEmail.ts'
import {
  processPortalInvitationDelivery,
  type PortalInvitationDeliveryLease,
  type PortalInvitationDeliveryStore,
} from '../_shared/portalInvitationDeliveryWorker.ts'
import { requirePortalInvitationDeliveryFinalization } from '../_shared/portalInvitationDeliveryOutbox.ts'
import { requireQaInvitationDeliverySandbox } from '../_shared/portalInvitationDeliverySandbox.ts'

type Runtime = typeof globalThis & {
  Deno?: {
    env: { get(name: string): string | undefined }
    serve(handler: (request: Request) => Response | Promise<Response>): void
  }
}

interface WorkerConfiguration {
  supabaseUrl: string
  serviceRoleKey: string
  workerSecret: string
  encryptionKey: string
  invitationAcceptUrl: string
  qaRecipient: string
}

const runtime = globalThis as Runtime
if (!runtime.Deno) throw new Error('Supabase Edge runtime is unavailable.')

function readConfiguration(): WorkerConfiguration | null {
  const supabaseUrl = runtime.Deno?.env.get('SUPABASE_URL')?.trim() ?? ''
  const serviceRoleKey = runtime.Deno?.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? ''
  const workerSecret = runtime.Deno?.env.get('PORTAL_INVITATION_DELIVERY_WORKER_SECRET')?.trim() ?? ''
  const encryptionKey = runtime.Deno?.env.get('PORTAL_INVITATION_DELIVERY_KEY')?.trim() ?? ''
  const invitationAcceptUrl = runtime.Deno?.env.get('PORTAL_INVITATION_ACCEPT_URL')?.trim() ?? ''
  const environment = runtime.Deno?.env.get('PORTAL_INVITATION_DELIVERY_ENV')?.trim().toLowerCase() ?? ''
  const qaRecipient = runtime.Deno?.env.get('PORTAL_INVITATION_DELIVERY_QA_RECIPIENT')?.trim() ?? ''
  const brevoSandboxMode = runtime.Deno?.env.get('BREVO_SANDBOX_MODE')?.trim().toLowerCase() ?? ''
  if (!supabaseUrl || !serviceRoleKey || workerSecret.length < 32 || encryptionKey.length < 43
    || !invitationAcceptUrl || !qaRecipient || brevoSandboxMode !== 'drop') return null
  try {
    const sandbox = requireQaInvitationDeliverySandbox({ supabaseUrl, environment, recipient: qaRecipient, invitationAcceptUrl })
    return { supabaseUrl, serviceRoleKey, workerSecret, encryptionKey, qaRecipient: sandbox.recipient, invitationAcceptUrl: sandbox.invitationAcceptUrl }
  } catch {
    return null
  }
}

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))
}

async function hasWorkerSecret(expected: string, actual: string | null): Promise<boolean> {
  if (!actual || actual.length !== expected.length) return false
  const [expectedDigest, actualDigest] = await Promise.all([digest(expected), digest(actual)])
  let difference = 0
  for (let index = 0; index < expectedDigest.length; index += 1) difference |= expectedDigest[index] ^ actualDigest[index]
  return difference === 0
}

function serviceHeaders(configuration: WorkerConfiguration): HeadersInit {
  return {
    apikey: configuration.serviceRoleKey,
    Authorization: `Bearer ${configuration.serviceRoleKey}`,
    'Content-Type': 'application/json',
  }
}

function positiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 5 ? value : null
}

function readLease(value: unknown): PortalInvitationDeliveryLease | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (typeof row.invitation_id !== 'string' || typeof row.recipient !== 'string'
    || typeof row.expires_at !== 'string' || typeof row.idempotency_key !== 'string'
    || typeof row.correlation_id !== 'string' || typeof row.ciphertext !== 'string'
    || typeof row.nonce !== 'string' || typeof row.key_version !== 'string') return null
  const attemptCount = positiveInteger(row.attempt_count)
  if (attemptCount === null) return null
  return {
    invitationId: row.invitation_id,
    recipient: row.recipient,
    expiresAt: row.expires_at,
    idempotencyKey: row.idempotency_key,
    correlationId: row.correlation_id,
    attemptCount,
    payload: { ciphertext: row.ciphertext, nonce: row.nonce, keyVersion: row.key_version, createdAt: '', expiresAt: row.expires_at },
  }
}

function nextRetryAt(attemptCount: number): string {
  const delaySeconds = Math.min(60 * 2 ** Math.max(attemptCount - 1, 0), 15 * 60)
  return new Date(Date.now() + delaySeconds * 1000).toISOString()
}

function createStore(configuration: WorkerConfiguration): PortalInvitationDeliveryStore {
  return {
    async claimNext(invitationId) {
      const response = await fetch(`${configuration.supabaseUrl}/rest/v1/rpc/portal_claim_invitation_delivery_trusted`, {
        method: 'POST', headers: serviceHeaders(configuration), body: JSON.stringify({ p_invitation_id: invitationId ?? null, p_lease_seconds: 120 }),
      })
      if (!response.ok) throw new Error('delivery_worker_claim_failed')
      const rows = await response.json().catch(() => null)
      if (!Array.isArray(rows) || rows.length === 0) return null
      return readLease(rows[0])
    },
    async finalize(input) {
      const retryAt = input.transition.status === 'retry_scheduled'
        ? nextRetryAt(input.transition.attemptCount)
        : null
      const payloadPolicy = requirePortalInvitationDeliveryFinalization({
        status: input.transition.status,
        attemptCount: input.transition.attemptCount,
        previousAttemptCount: input.transition.attemptCount - 1,
        nextAttemptAt: retryAt ? new Date(retryAt) : null,
      })
      const response = await fetch(`${configuration.supabaseUrl}/rest/v1/rpc/portal_finalize_invitation_delivery_trusted`, {
        method: 'POST',
        headers: serviceHeaders(configuration),
        body: JSON.stringify({
          p_invitation_id: input.invitationId,
          p_status: input.transition.status,
          p_attempt_count: input.transition.attemptCount,
          p_provider_message_id: input.transition.providerMessageId ?? null,
          p_provider_code: input.transition.providerCode ?? null,
          p_next_attempt_at: retryAt,
          p_destroy_payload: payloadPolicy.destroyPayload,
        }),
      })
      if (!response.ok) throw new Error('delivery_worker_finalize_failed')
    },
  }
}

runtime.Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } })
  const configuration = readConfiguration()
  if (!configuration || !await hasWorkerSecret(configuration.workerSecret, request.headers.get('x-portal-delivery-worker-key'))) {
    return new Response(JSON.stringify({ ok: false }), { status: 404, headers: { 'Content-Type': 'application/json' } })
  }
  try {
    const body = await request.json().catch(() => null) as { invitationId?: unknown } | null
    const invitationId = typeof body?.invitationId === 'string'
      && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(body.invitationId)
      ? body.invitationId
      : undefined
    const result = await processPortalInvitationDelivery({
      store: createStore(configuration),
      provider: createTransactionalEmailProviderFromEnvironment((name) => runtime.Deno?.env.get(name)),
      encryptionKey: configuration.encryptionKey,
      invitationAcceptUrl: configuration.invitationAcceptUrl,
      qaRecipient: configuration.qaRecipient,
      invitationId,
    })
    const audit = result.audit
    console.info(JSON.stringify({ event: 'portal_invitation_delivery_processed', status: result.status, correlationId: audit?.correlationId }))
    const accepted = audit?.status === 'provider_accepted' || audit?.status === 'retry_scheduled'
    return new Response(JSON.stringify({ ok: accepted }), { status: accepted ? 200 : 503, headers: { 'Content-Type': 'application/json' } })
  } catch {
    console.info(JSON.stringify({ event: 'portal_invitation_delivery_failed', status: 'failed' }))
    return new Response(JSON.stringify({ ok: false }), { status: 503, headers: { 'Content-Type': 'application/json' } })
  }
})
