import { describe, expect, it, vi } from 'vitest'
import {
  decryptPortalInvitationDeliveryToken,
  encryptPortalInvitationDeliveryToken,
} from '../../supabase/functions/_shared/portalInvitationDeliveryPayload.ts'
import { processPortalInvitationDelivery } from '../../supabase/functions/_shared/portalInvitationDeliveryWorker.ts'
import { readFileSync } from 'node:fs'

const key = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8'
const expiresAt = '2030-09-16T14:00:00.000Z'
const invitationId = 'b3b891f7-4fca-4c9c-9c63-f09a6ef420b4'
const token = 'synthetic-one-time-token-should-never-be-persisted'

async function lease() {
  return {
    invitationId,
    recipient: 'qa.delivery.owner@qa.invalid',
    expiresAt,
    idempotencyKey: 'delivery:invitation:qa-1',
    correlationId: '3f3a7a5a-60b8-4290-82f5-4d3328030a2b',
    attemptCount: 0,
    payload: await encryptPortalInvitationDeliveryToken({
      token,
      invitationId,
      keyVersion: 'qa-v1',
      expiresAt,
      encryptionKey: key,
      now: () => new Date('2030-09-16T12:00:00.000Z'),
    }),
  }
}

describe('encrypted invitation delivery payload', () => {
  it('uses AES-GCM ciphertext bound to invitation ID, key version and expiry', async () => {
    const payload = (await lease()).payload
    const serialized = JSON.stringify(payload)

    expect(serialized).not.toContain(token)
    await expect(decryptPortalInvitationDeliveryToken({ payload, invitationId, encryptionKey: key, now: () => new Date('2030-09-16T12:01:00.000Z') }))
      .resolves.toBe(token)
    await expect(decryptPortalInvitationDeliveryToken({ payload, invitationId: 'c3b891f7-4fca-4c9c-9c63-f09a6ef420b4', encryptionKey: key, now: () => new Date('2030-09-16T12:01:00.000Z') }))
      .rejects.toThrow('portal_invitation_delivery_payload_invalid')
  })

  it('rejects payload encryption after the invitation lifecycle has expired', async () => {
    await expect(encryptPortalInvitationDeliveryToken({
      token,
      invitationId,
      keyVersion: 'qa-v1',
      expiresAt: '2030-09-16T12:00:00.000Z',
      encryptionKey: key,
      now: () => new Date('2030-09-16T12:01:00.000Z'),
    })).rejects.toThrow('portal_invitation_delivery_payload_expired')
  })
})

describe('trusted invitation delivery worker', () => {
  it('sends one claimed lease and destroys the encrypted payload after acceptance', async () => {
    const queued = await lease()
    const finalize = vi.fn().mockResolvedValue(undefined)
    const provider = { sendTransactionalEmail: vi.fn().mockResolvedValue({ status: 'accepted', retryable: false, providerMessageId: 'provider-private-id' }) }

    const result = await processPortalInvitationDelivery({
      store: { claimNext: vi.fn().mockResolvedValue(queued), finalize },
      provider,
      encryptionKey: key,
      invitationAcceptUrl: 'https://portal-qa.example.invalid/portal/invitacion',
      qaRecipient: queued.recipient,
      now: () => new Date('2030-09-16T12:01:00.000Z'),
    })

    expect(provider.sendTransactionalEmail).toHaveBeenCalledTimes(1)
    expect(provider.sendTransactionalEmail.mock.calls[0][0].variables.invitationUrl)
      .toBe('https://portal-qa.example.invalid/portal/invitacion#token=synthetic-one-time-token-should-never-be-persisted')
    expect(finalize).toHaveBeenCalledWith(expect.objectContaining({
      invitationId,
      transition: expect.objectContaining({ status: 'provider_accepted', attemptCount: 1 }),
    }))
    expect(JSON.stringify(result)).not.toContain(token)
    expect(JSON.stringify(result)).not.toContain('provider-private-id')
  })

  it('keeps a payload only for an explicit rate-limit retry', async () => {
    const finalize = vi.fn().mockResolvedValue(undefined)
    await processPortalInvitationDelivery({
      store: { claimNext: vi.fn().mockResolvedValue(await lease()), finalize },
      provider: { sendTransactionalEmail: vi.fn().mockResolvedValue({ status: 'failed', retryable: true, providerCode: 'rate_limited' }) },
      encryptionKey: key,
      invitationAcceptUrl: 'https://portal-qa.example.invalid/portal/invitacion',
      qaRecipient: 'qa.delivery.owner@qa.invalid',
      now: () => new Date('2030-09-16T12:01:00.000Z'),
    })

    expect(finalize).toHaveBeenCalledWith(expect.objectContaining({
      transition: expect.objectContaining({ status: 'retry_scheduled', attemptCount: 1 }),
    }))
  })

  it('blocks ambiguous provider outcomes and destroys their payload', async () => {
    const finalize = vi.fn().mockResolvedValue(undefined)
    await processPortalInvitationDelivery({
      store: { claimNext: vi.fn().mockResolvedValue(await lease()), finalize },
      provider: { sendTransactionalEmail: vi.fn().mockResolvedValue({ status: 'failed', retryable: false, providerCode: 'delivery_outcome_unknown' }) },
      encryptionKey: key,
      invitationAcceptUrl: 'https://portal-qa.example.invalid/portal/invitacion',
      qaRecipient: 'qa.delivery.owner@qa.invalid',
      now: () => new Date('2030-09-16T12:01:00.000Z'),
    })

    expect(finalize).toHaveBeenCalledWith(expect.objectContaining({
      transition: expect.objectContaining({ status: 'blocked', providerCode: 'delivery_outcome_unknown' }),
    }))
  })

  it('keeps the Edge worker server-only and never returns sensitive worker state', () => {
    const source = readFileSync('supabase/functions/portal-invitation-delivery-worker/index.ts', 'utf8')

    expect(source).toContain("PORTAL_INVITATION_DELIVERY_WORKER_SECRET")
    expect(source).toContain("PORTAL_INVITATION_DELIVERY_KEY")
    expect(source).toContain("PORTAL_INVITATION_DELIVERY_ENV")
    expect(source).toContain("PORTAL_INVITATION_DELIVERY_QA_RECIPIENT")
    expect(source).toContain("BREVO_SANDBOX_MODE")
    expect(source).toContain("requireQaInvitationDeliverySandbox")
    expect(source).toContain("JSON.stringify({ ok: accepted })")
    expect(source).not.toMatch(/console\.info\([^\n]*(serviceRoleKey|encryptionKey|workerSecret|recipient|ciphertext|nonce)/u)
  })

  it('blocks a recipient outside the QA allowlist before decrypting or sending', async () => {
    const queued = await lease()
    const provider = { sendTransactionalEmail: vi.fn() }
    const finalize = vi.fn().mockResolvedValue(undefined)

    await processPortalInvitationDelivery({
      store: { claimNext: vi.fn().mockResolvedValue(queued), finalize },
      provider,
      encryptionKey: key,
      invitationAcceptUrl: 'https://portal-qa.example.invalid/portal/invitacion',
      qaRecipient: 'another-owner@qa.invalid',
      now: () => new Date('2030-09-16T12:01:00.000Z'),
    })

    expect(provider.sendTransactionalEmail).not.toHaveBeenCalled()
    expect(finalize).toHaveBeenCalledWith(expect.objectContaining({
      transition: expect.objectContaining({ status: 'blocked', providerCode: 'qa_recipient_not_allowed' }),
    }))
  })
})
