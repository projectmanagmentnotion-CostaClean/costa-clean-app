import { describe, expect, it } from 'vitest'
import {
  buildPortalInvitationEmail,
  createDisabledTransactionalEmailProvider,
  toTransactionalEmailAuditEvent,
} from '../../supabase/functions/_shared/transactionalEmail.ts'

const INVITATION_URL = 'https://portal-qa.example.invalid/invitations/accept?token=synthetic-one-time-token'

function invitationInput(overrides = {}) {
  return {
    recipient: 'qa.portal.invitation@qa.invalid',
    locale: 'es-ES',
    invitationUrl: INVITATION_URL,
    expiresAt: '2026-09-23T12:00:00.000Z',
    idempotencyKey: 'invite:qa-correlation-1',
    correlationId: 'qa-correlation-1',
    ...overrides,
  }
}

describe('transactional email provider foundation', () => {
  it('builds the server-only PORTAL_INVITATION contract with explicit idempotency', () => {
    expect(buildPortalInvitationEmail(invitationInput())).toEqual({
      template: 'PORTAL_INVITATION',
      recipient: 'qa.portal.invitation@qa.invalid',
      locale: 'es-ES',
      variables: {
        invitationUrl: INVITATION_URL,
        expiresAt: '2026-09-23T12:00:00.000Z',
      },
      idempotencyKey: 'invite:qa-correlation-1',
      correlationId: 'qa-correlation-1',
    })
  })

  it('fails closed while no owner-approved provider is wired', async () => {
    const provider = createDisabledTransactionalEmailProvider()

    await expect(provider.sendTransactionalEmail(buildPortalInvitationEmail(invitationInput()))).resolves.toEqual({
      status: 'not_configured',
      retryable: false,
      providerCode: 'provider_not_approved',
    })
  })

  it('redacts recipient, invite URL and token-bearing variables from audit events', () => {
    const request = buildPortalInvitationEmail(invitationInput())
    const event = toTransactionalEmailAuditEvent(request, {
      status: 'accepted',
      retryable: false,
      providerCode: 'sandbox',
      providerMessageId: 'provider-message-1',
    })
    const serialized = JSON.stringify(event)

    expect(event).toEqual({
      template: 'PORTAL_INVITATION',
      correlationId: 'qa-correlation-1',
      status: 'accepted',
      retryable: false,
      providerCode: 'sandbox',
      hasProviderMessageId: true,
    })
    expect(serialized).not.toContain('qa.portal.invitation@qa.invalid')
    expect(serialized).not.toContain(INVITATION_URL)
    expect(serialized).not.toContain('synthetic-one-time-token')
  })
})
