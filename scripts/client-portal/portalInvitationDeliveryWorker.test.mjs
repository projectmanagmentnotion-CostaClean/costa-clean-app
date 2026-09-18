import { describe, expect, it, vi } from 'vitest'
import { encryptPortalInvitationDeliveryToken } from '../../supabase/functions/_shared/portalInvitationDeliveryPayload.ts'
import { processPortalInvitationDelivery } from '../../supabase/functions/_shared/portalInvitationDeliveryWorker.ts'

const INVITATION_ID = '11111111-1111-4111-8111-111111111111'
const RECIPIENT = 'costacleanbcn@gmail.com'
const KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const ACCEPT_URL = 'https://portal-qa.example.invalid/portal/invitacion'

async function lease(recipient = RECIPIENT) {
  const expiresAt = '2026-09-20T12:00:00.000Z'
  const payload = await encryptPortalInvitationDeliveryToken({
    token: 'A'.repeat(43),
    invitationId: INVITATION_ID,
    keyVersion: 'qa-v1',
    expiresAt,
    encryptionKey: KEY,
    now: () => new Date('2026-09-18T12:00:00.000Z'),
  })
  return {
    invitationId: INVITATION_ID,
    recipient,
    expiresAt,
    idempotencyKey: 'portal-invitation:test-1',
    correlationId: '22222222-2222-4222-8222-222222222222',
    attemptCount: 0,
    payload,
  }
}

describe('CP-4.3C invitation delivery worker', () => {
  it('finalizes provider acceptance without exposing the invitation token in audit metadata', async () => {
    const finalized = []
    const store = {
      claimNext: vi.fn().mockResolvedValue(await lease()),
      finalize: vi.fn(async (input) => finalized.push(input)),
    }
    const provider = {
      sendTransactionalEmail: vi.fn().mockResolvedValue({
        status: 'accepted',
        providerMessageId: 'brevo-message-accepted',
        retryable: false,
      }),
    }

    const result = await processPortalInvitationDelivery({
      store,
      provider,
      encryptionKey: KEY,
      invitationAcceptUrl: ACCEPT_URL,
      qaRecipient: RECIPIENT,
      invitationId: INVITATION_ID,
      now: () => new Date('2026-09-18T12:00:00.000Z'),
    })

    expect(result.status).toBe('processed')
    expect(finalized[0].transition).toEqual({
      status: 'provider_accepted',
      attemptCount: 1,
      retryable: false,
      providerMessageId: 'brevo-message-accepted',
    })
    const request = provider.sendTransactionalEmail.mock.calls[0][0]
    expect(request.variables.invitationUrl).toMatch(/^https:\/\/portal-qa\.example\.invalid\/portal\/invitacion#token=/u)
    const observableAudit = JSON.stringify({ audit: result.audit, emailAudit: result.emailAudit })
    expect(observableAudit).not.toContain(RECIPIENT)
    expect(observableAudit).not.toContain('#token=')
  })

  it('blocks any recipient outside the exact QA recipient before calling the provider', async () => {
    const finalized = []
    const store = {
      claimNext: vi.fn().mockResolvedValue(await lease('other@example.invalid')),
      finalize: vi.fn(async (input) => finalized.push(input)),
    }
    const provider = { sendTransactionalEmail: vi.fn() }

    const result = await processPortalInvitationDelivery({
      store,
      provider,
      encryptionKey: KEY,
      invitationAcceptUrl: ACCEPT_URL,
      qaRecipient: RECIPIENT,
      invitationId: INVITATION_ID,
      now: () => new Date('2026-09-18T12:00:00.000Z'),
    })

    expect(result.status).toBe('processed')
    expect(provider.sendTransactionalEmail).not.toHaveBeenCalled()
    expect(finalized[0].transition).toMatchObject({
      status: 'blocked',
      attemptCount: 1,
      retryable: false,
      providerCode: 'qa_recipient_not_allowed',
    })
  })

  it('preserves diagnostic provider codes and does not retry non-retryable provider failures', async () => {
    const finalized = []
    const store = {
      claimNext: vi.fn().mockResolvedValue(await lease()),
      finalize: vi.fn(async (input) => finalized.push(input)),
    }
    const provider = {
      sendTransactionalEmail: vi.fn().mockResolvedValue({
        status: 'failed',
        retryable: false,
        providerCode: 'brevo_timer_exception',
      }),
    }

    await processPortalInvitationDelivery({
      store,
      provider,
      encryptionKey: KEY,
      invitationAcceptUrl: ACCEPT_URL,
      qaRecipient: RECIPIENT,
      invitationId: INVITATION_ID,
      now: () => new Date('2026-09-18T12:00:00.000Z'),
    })

    expect(finalized[0].transition).toMatchObject({
      status: 'blocked',
      attemptCount: 1,
      retryable: false,
      providerCode: 'brevo_timer_exception',
    })
  })
})
