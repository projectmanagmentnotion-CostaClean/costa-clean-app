import { describe, expect, it } from 'vitest'
import {
  isAuthorizedQaInvitationRecipient,
  requireQaInvitationDeliverySandbox,
} from '../../supabase/functions/_shared/portalInvitationDeliverySandbox.ts'

const target = 'https://kpvvydthlxupjjqqdpxy.supabase.co'
const recipient = 'qa.delivery.owner@qa.invalid'
const acceptanceUrl = 'https://portal-qa.example.invalid/portal/invitacion'

describe('QA invitation delivery sandbox contract', () => {
  it('accepts only the exact QA project, canonical acceptance URL and one normalized recipient', () => {
    expect(requireQaInvitationDeliverySandbox({
      supabaseUrl: target, environment: 'qa', recipient, invitationAcceptUrl: acceptanceUrl,
    })).toEqual({ recipient, invitationAcceptUrl: acceptanceUrl })
    expect(isAuthorizedQaInvitationRecipient(recipient, recipient)).toBe(true)
    expect(isAuthorizedQaInvitationRecipient('different@qa.invalid', recipient)).toBe(false)
  })

  it.each([
    { supabaseUrl: target, environment: 'production', recipient, invitationAcceptUrl: acceptanceUrl },
    { supabaseUrl: 'https://wfxnwfcdjainpojhbdri.supabase.co', environment: 'qa', recipient, invitationAcceptUrl: acceptanceUrl },
    { supabaseUrl: target, environment: 'qa', recipient: 'first@qa.invalid,second@qa.invalid', invitationAcceptUrl: acceptanceUrl },
    { supabaseUrl: target, environment: 'qa', recipient, invitationAcceptUrl: '' },
    { supabaseUrl: target, environment: 'qa', recipient, invitationAcceptUrl: 'https://portal-qa.example.invalid/portal/invitacion?token=unsafe' },
    { supabaseUrl: target, environment: 'qa', recipient, invitationAcceptUrl: 'https://portal-qa.example.invalid/other' },
  ])('fails closed for an invalid sandbox input', (input) => {
    expect(() => requireQaInvitationDeliverySandbox(input)).toThrow()
  })
})
