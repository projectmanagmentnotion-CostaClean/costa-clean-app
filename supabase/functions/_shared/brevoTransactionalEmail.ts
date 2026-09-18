import type {
  TransactionalEmailProvider,
  TransactionalEmailRequest,
  TransactionalEmailResult,
} from './transactionalEmail.ts'

export const BREVO_TRANSACTIONAL_EMAIL_ENDPOINT = 'https://api.brevo.com/v3/smtp/email'
const DEFAULT_TIMEOUT_MS = 10_000

export interface BrevoTransactionalEmailConfig {
  apiKey: string
  senderEmail: string
  senderName: string
  replyToEmail?: string
  sandboxMode?: boolean
  timeoutMs?: number
}

export interface BrevoTransactionalEmailDependencies {
  fetch(input: string, init: RequestInit): Promise<Response>
  setTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout>
  clearTimeout(timer: ReturnType<typeof setTimeout>): void
}

interface BrevoEmailPayload {
  sender: { email: string; name: string }
  to: Array<{ email: string }>
  replyTo?: { email: string }
  subject: string
  textContent: string
  htmlContent: string
  tags: string[]
  headers?: { 'X-Sib-Sandbox': 'drop' }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character)
}

function isEmail(value: string | undefined): value is string {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
}

function isConfigured(config: BrevoTransactionalEmailConfig): boolean {
  return Boolean(config.apiKey.trim() && config.senderName.trim() && isEmail(config.senderEmail)
    && (!config.replyToEmail || isEmail(config.replyToEmail)))
}

function isSafeInvitationUrl(value: string): boolean {
  try {
    const url = new URL(value)
    if (url.protocol === 'https:') return true
    return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  } catch { return false }
}

function renderPortalInvitation(request: TransactionalEmailRequest): Omit<BrevoEmailPayload, 'sender' | 'to' | 'replyTo'> | null {
  if (request.template !== 'PORTAL_INVITATION') return null
  const invitationUrl = request.variables.invitationUrl
  const expiresAt = request.variables.expiresAt
  if (!invitationUrl || !expiresAt || !isSafeInvitationUrl(invitationUrl)) return null
  const safeUrl = escapeHtml(invitationUrl)
  const safeExpiry = escapeHtml(expiresAt)
  const subject = 'Tu acceso al Portal de Costa Clean'
  const textContent = [
    'Costa Clean te ha invitado a acceder al Portal de Costa Clean.', '',
    `Tu enlace de acceso personal caduca el ${expiresAt}. No lo compartas.`, '',
    `Accede al Portal: ${invitationUrl}`, '', 'Si necesitas ayuda, responde a este correo.',
  ].join('\n')
  const htmlContent = [
    '<!doctype html>', '<html lang="es">', '<body>',
    '<p>Costa Clean te ha invitado a acceder al Portal de Costa Clean.</p>',
    `<p><a href="${safeUrl}">Acceder al Portal</a></p>`,
    `<p>Tu enlace de acceso personal caduca el ${safeExpiry}. No lo compartas.</p>`,
    `<p>Si el botón no funciona, copia esta dirección: <a href="${safeUrl}">${safeUrl}</a></p>`,
    '<p>Si necesitas ayuda, responde a este correo.</p>', '</body>', '</html>',
  ].join('')
  return { subject, textContent, htmlContent, tags: ['portal_invitation'] }
}

function failure(status: TransactionalEmailResult['status'], retryable: boolean, providerCode: string): TransactionalEmailResult {
  return { status, retryable, providerCode }
}

export function createBrevoTransactionalEmailProvider(
  config: BrevoTransactionalEmailConfig,
  dependencies: BrevoTransactionalEmailDependencies = { fetch: (input, init) => fetch(input, init), setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay), clearTimeout: (timer) => globalThis.clearTimeout(timer) },
): TransactionalEmailProvider {
  return {
    async sendTransactionalEmail(request): Promise<TransactionalEmailResult> {
      if (!isConfigured(config)) return failure('not_configured', false, 'brevo_configuration_invalid')

      let content: ReturnType<typeof renderPortalInvitation>
      try {
        content = renderPortalInvitation(request)
      } catch {
        return failure('failed', false, 'brevo_render_exception')
      }
      if (!content) return failure('rejected', false, 'invalid_invitation_url')

      let controller: AbortController
      try {
        controller = new AbortController()
      } catch {
        return failure('failed', false, 'brevo_abort_controller_exception')
      }

      let timedOut = false
      let timer: ReturnType<typeof setTimeout> | undefined
      const timeoutMs = config.timeoutMs && config.timeoutMs > 0 ? config.timeoutMs : DEFAULT_TIMEOUT_MS
      try {
        timer = dependencies.setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
      } catch {
        return failure('failed', false, 'brevo_timer_exception')
      }

      let payload: BrevoEmailPayload
      try {
        payload = {
          sender: { email: config.senderEmail.trim(), name: config.senderName.trim() },
          to: [{ email: request.recipient }],
          ...(config.replyToEmail ? { replyTo: { email: config.replyToEmail.trim() } } : {}),
          ...(config.sandboxMode ? { headers: { 'X-Sib-Sandbox': 'drop' as const } } : {}),
          ...content,
        }
      } catch {
        if (timer !== undefined) { try { dependencies.clearTimeout(timer) } catch { /* best-effort cleanup */ } }
        return failure('failed', false, 'brevo_payload_exception')
      }

      try {
        const response = await dependencies.fetch(BREVO_TRANSACTIONAL_EMAIL_ENDPOINT, {
          method: 'POST',
          headers: { 'api-key': config.apiKey, 'content-type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })
        if (response.status === 429) return failure('failed', true, 'rate_limited')
        if (response.status >= 500) return failure('failed', true, 'provider_unavailable')
        if (!response.ok) {
          const providerCode = response.status === 400 ? 'invalid_request'
            : response.status === 401 ? 'authentication_failed'
              : response.status === 403 ? 'authorization_denied' : 'provider_rejected'
          return failure('rejected', false, providerCode)
        }
        let body: unknown
        try { body = await response.json() } catch { return failure('failed', false, 'malformed_success_response') }
        const messageId = body && typeof body === 'object' && typeof (body as { messageId?: unknown }).messageId === 'string'
          ? (body as { messageId: string }).messageId.trim() : ''
        return messageId
          ? { status: 'accepted', providerMessageId: messageId, retryable: false }
          : failure('failed', false, 'malformed_success_response')
      } catch {
        return failure('failed', false, timedOut ? 'brevo_fetch_timeout' : 'brevo_fetch_exception')
      } finally {
        if (timer !== undefined) { try { dependencies.clearTimeout(timer) } catch { /* best-effort cleanup */ } }
      }
    },
  }
}
