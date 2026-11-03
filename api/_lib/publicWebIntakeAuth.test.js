import { createHash, createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { isProductionSupabaseUrl, verifyPublicWebIntake } from './publicWebIntakeAuth.js'

function signedFixture(overrides = {}) {
  const secret = 'synthetic-test-secret-with-more-than-32-bytes'
  const body = { source: 'public_quote_form', submissionId: '11111111-1111-4111-8111-111111111111', normalizedInput: { consentQuoteProcessing: true } }
  const timestamp = '1760000000'
  const clientKey = createHmac('sha256', secret).update('client:synthetic-client').digest('hex')
  const bodyHash = createHash('sha256').update(JSON.stringify(body)).digest('hex')
  const signature = createHmac('sha256', secret).update(`${timestamp}.production.${bodyHash}.${body.submissionId}.${clientKey}`).digest('hex')
  return {
    body,
    secret,
    now: Number(timestamp),
    headers: {
      'x-costa-environment': 'production',
      'x-costa-submission-id': body.submissionId,
      'x-costa-client-key': clientKey,
      'x-costa-timestamp': timestamp,
      'x-costa-signature': signature,
      ...overrides,
    },
  }
}

describe('signed public web intake', () => {
  it('accepts an untampered, fresh Production request', () => {
    const fixture = signedFixture()
    expect(verifyPublicWebIntake(fixture.body, fixture.secret, fixture.headers, fixture.now)).toMatchObject({ ok: true, submissionId: fixture.body.submissionId })
  })

  it('rejects changed payloads, environment crossover, and replay', () => {
    const fixture = signedFixture()
    expect(verifyPublicWebIntake({ ...fixture.body, source: 'qa' }, fixture.secret, fixture.headers, fixture.now).ok).toBe(false)
    expect(verifyPublicWebIntake(fixture.body, fixture.secret, { ...fixture.headers, 'x-costa-environment': 'qa' }, fixture.now).ok).toBe(false)
    expect(verifyPublicWebIntake(fixture.body, fixture.secret, fixture.headers, fixture.now + 301).ok).toBe(false)
  })

  it('allows only the Production Supabase project URL', () => {
    expect(isProductionSupabaseUrl('https://wfxnwfcdjainpojhbdri.supabase.co')).toBe(true)
    expect(isProductionSupabaseUrl('https://kpvvydthlxupjjqqdpxy.supabase.co')).toBe(false)
    expect(isProductionSupabaseUrl('https://wfxnwfcdjainpojhbdri.supabase.co.evil.example')).toBe(false)
  })
})
