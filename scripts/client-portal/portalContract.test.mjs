import { describe, expect, it } from 'vitest'
import {
  PORTAL_MAX_BODY_BYTES,
  PORTAL_SIGNED_URL_TTL_SECONDS,
  validatePortalRequest,
} from '../../supabase/functions/_shared/portalContract.ts'

const CLIENT_A = 'QA-CP2-CLIENT-A'
const PROPERTY_A = 'QA-CP2-PROPERTY-A'
const UUID_A = '11111111-1111-4111-8111-111111111111'

describe('client portal strict contracts', () => {
  it('freezes body and signed URL limits', () => {
    expect(PORTAL_MAX_BODY_BYTES).toBe(12_288)
    expect(PORTAL_SIGNED_URL_TTL_SECONDS).toBe(60)
  })

  it('accepts a valid idempotent service request', () => {
    expect(validatePortalRequest('service', {
      action: 'submitServiceRequest',
      clientId: CLIENT_A,
      propertyId: PROPERTY_A,
      serviceType: 'regular_cleaning',
      preferredDate: '2026-08-01',
      preferredTimeWindow: 'morning',
      notes: null,
      idempotencyKey: UUID_A,
    })).toMatchObject({ action: 'submitServiceRequest', clientId: CLIENT_A })
  })

  it('rejects unknown fields, wrong surfaces, missing context and arbitrary changes', () => {
    const base = {
      action: 'submitServiceRequest',
      clientId: CLIENT_A,
      propertyId: PROPERTY_A,
      serviceType: 'regular_cleaning',
      preferredDate: '2026-08-01',
      preferredTimeWindow: null,
      notes: null,
      idempotencyKey: UUID_A,
    }
    expect(validatePortalRequest('service', { ...base, internalNotes: 'forbidden' })).toBeNull()
    expect(validatePortalRequest('account', base)).toBeNull()
    expect(validatePortalRequest('service', { ...base, clientId: undefined })).toBeNull()
    expect(validatePortalRequest('service', {
      action: 'submitProfileChange',
      clientId: CLIENT_A,
      changes: { margin: 'forbidden' },
    })).toBeNull()
  })

  it('allows only portal roles and runtime-shaped invitation tokens', () => {
    expect(validatePortalRequest('members', {
      action: 'inviteMember',
      clientId: CLIENT_A,
      email: 'member@example.invalid',
      role: 'client_member',
    })).not.toBeNull()
    expect(validatePortalRequest('members', {
      action: 'inviteMember',
      clientId: CLIENT_A,
      email: 'member@example.invalid',
      role: 'internal_admin',
    })).toBeNull()
    expect(validatePortalRequest('account', { action: 'acceptInvitation', token: 'too-short' })).toBeNull()
  })
})
