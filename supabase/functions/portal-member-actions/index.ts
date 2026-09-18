import { createPortalHandler } from '../_shared/portalHandler.ts'

type Runtime = typeof globalThis & {
  Deno?: {
    env: { get(name: string): string | undefined }
    serve(handler: (request: Request) => Response | Promise<Response>): void
  }
}

const runtime = globalThis as Runtime
if (!runtime.Deno) throw new Error('Supabase Edge runtime is unavailable.')

async function triggerInvitationDelivery(input: { invitationId: string }): Promise<boolean> {
  const supabaseUrl = runtime.Deno?.env.get('SUPABASE_URL')?.trim()
  const workerSecret = runtime.Deno?.env.get('PORTAL_INVITATION_DELIVERY_WORKER_SECRET')?.trim()
  if (!supabaseUrl || !workerSecret || workerSecret.length < 32) return false
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/portal-invitation-delivery-worker`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-portal-delivery-worker-key': workerSecret },
      body: JSON.stringify({ invitationId: input.invitationId }),
    })
    if (!response.ok) return false
    const body = await response.json().catch(() => null) as { ok?: unknown } | null
    return body?.ok === true
  } catch {
    return false
  }
}

function hasCompleteDeliveryConfiguration(): boolean {
  const required = [
    'TRANSACTIONAL_EMAIL_PROVIDER',
    'BREVO_API_KEY',
    'BREVO_SENDER_EMAIL',
    'BREVO_SENDER_NAME',
    'PORTAL_INVITATION_DELIVERY_KEY',
    'PORTAL_INVITATION_DELIVERY_KEY_VERSION',
    'PORTAL_INVITATION_DELIVERY_WORKER_SECRET',
    'PORTAL_INVITATION_ACCEPT_URL',
  ]
  return runtime.Deno?.env.get('TRANSACTIONAL_EMAIL_PROVIDER')?.trim().toLowerCase() === 'brevo'
    && required.every((name) => Boolean(runtime.Deno?.env.get(name)?.trim()))
}

runtime.Deno.serve(createPortalHandler('members', {
  env: (name) => runtime.Deno?.env.get(name),
  fetch: (input, init) => fetch(input, init),
  now: () => Date.now(),
  randomBytes: (length) => crypto.getRandomValues(new Uint8Array(length)),
  log: (event) => console.info(JSON.stringify(event)),
  // This invokes a server-only worker using only an opaque invitation ID.
  // Missing encryption/provider configuration fails closed in the handler.
  deliverInvitation: hasCompleteDeliveryConfiguration() ? triggerInvitationDelivery : undefined,
}))
