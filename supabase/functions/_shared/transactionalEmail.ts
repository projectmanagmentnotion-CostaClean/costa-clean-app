/**
 * Server-only transactional email port. Provider selection and delivery wiring
 * remain an explicit later approval; this module must never be imported by UI code.
 */
export const TRANSACTIONAL_EMAIL_TEMPLATES = ['PORTAL_INVITATION'] as const

export type TransactionalEmailTemplate = typeof TRANSACTIONAL_EMAIL_TEMPLATES[number]
export type TransactionalEmailStatus = 'accepted' | 'rejected' | 'not_configured' | 'failed'

export interface TransactionalEmailRequest {
  template: TransactionalEmailTemplate
  recipient: string
  locale: string
  variables: Readonly<Record<string, string>>
  idempotencyKey: string
  correlationId: string
}

export interface TransactionalEmailResult {
  status: TransactionalEmailStatus
  providerMessageId?: string
  retryable: boolean
  providerCode?: string
}

export interface TransactionalEmailProvider {
  sendTransactionalEmail(input: TransactionalEmailRequest): Promise<TransactionalEmailResult>
}

export interface PortalInvitationEmailInput {
  recipient: string
  locale: string
  invitationUrl: string
  expiresAt: string
  idempotencyKey: string
  correlationId: string
}

function requireNonEmpty(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) {
    throw new Error(`transactional_email_${field}_required`)
  }
  return normalized
}

export function buildPortalInvitationEmail(input: PortalInvitationEmailInput): TransactionalEmailRequest {
  return {
    template: 'PORTAL_INVITATION',
    recipient: requireNonEmpty(input.recipient, 'recipient'),
    locale: requireNonEmpty(input.locale, 'locale'),
    // The URL contains the one-time token. It is passed only to a future provider adapter.
    variables: {
      invitationUrl: requireNonEmpty(input.invitationUrl, 'invitation_url'),
      expiresAt: requireNonEmpty(input.expiresAt, 'expires_at'),
    },
    idempotencyKey: requireNonEmpty(input.idempotencyKey, 'idempotency_key'),
    correlationId: requireNonEmpty(input.correlationId, 'correlation_id'),
  }
}

/**
 * Safe default until an owner approves a provider, domain, credentials and delivery policy.
 */
export function createDisabledTransactionalEmailProvider(
  providerCode = 'provider_not_approved',
): TransactionalEmailProvider {
  return {
    async sendTransactionalEmail(): Promise<TransactionalEmailResult> {
      return {
        status: 'not_configured',
        retryable: false,
        providerCode,
      }
    },
  }
}

/**
 * Audit payload deliberately excludes recipient and variables, which may contain PII or invite tokens.
 */
export function toTransactionalEmailAuditEvent(
  input: TransactionalEmailRequest,
  result: TransactionalEmailResult,
) {
  return {
    template: input.template,
    correlationId: input.correlationId,
    status: result.status,
    retryable: result.retryable,
    providerCode: result.providerCode,
    hasProviderMessageId: Boolean(result.providerMessageId),
  }
}
