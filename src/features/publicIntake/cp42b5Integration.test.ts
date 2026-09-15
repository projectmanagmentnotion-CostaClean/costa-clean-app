import { describe, expect, it } from 'vitest'
import { evaluatePublicQuoteRequest } from '../../../supabase/functions/_shared/quoteIntelligence'
import { validatePublicLeadRequest } from '../../../supabase/functions/_shared/publicLeadIntakeContract'
import { createPublicLeadIntakeHandler } from '../../../supabase/functions/_shared/publicLeadIntakeHandler'

const baseRequest = {
  version: 'cp42b-v2',
  environment: 'qa',
  source: 'public_web',
  submission_id: '3f6e8f2c-6f71-4d2c-9bd5-fecb7ca65f03',
  full_name: 'QA Synthetic',
  phone: '+34600000000',
  email: 'qa.invalid@example.invalid',
  service_type: 'residential',
  property_type: 'piso',
  city: 'Barcelona',
  postal_code: '08001',
  notes: {
    size: '41-70',
    bedrooms: '2',
    bathrooms: '1',
    frequency: 'weekly',
    dateIntent: 'flexible',
    timePreference: 'noche',
    responseChannel: 'whatsapp',
    needs: { standardCleaning: true },
  },
  privacy_acknowledged: true,
  marketing_contact_opt_in: false,
  analytics_consent: false,
  advertising_cookie_consent: false,
  attribution: { landing_path: '/presupuesto', utm_source: 'qa' },
}

describe('CP-4.2B.5 public intake v2 contract', () => {
  it('accepts the exact B.4-shaped v2 payload and rejects the deprecated alias', () => {
    expect(validatePublicLeadRequest(baseRequest)?.version).toBe('cp42b-v2')
    expect(validatePublicLeadRequest({ ...baseRequest, marketing_cookie_consent: false })).toBeNull()
    expect(validatePublicLeadRequest({
      ...baseRequest,
      attribution: { landing_path: '/presupuesto', gclid: 'must-be-gated' },
    })).toBeNull()
  })

  it('keeps the old v1 shape backward compatible without admitting v2 fields', () => {
    const v1: Record<string, unknown> = { ...baseRequest, version: 'cp42b-v1', marketing_cookie_consent: false }
    delete v1.advertising_cookie_consent
    expect(validatePublicLeadRequest(v1)?.version).toBe('cp42b-v1')
    expect(validatePublicLeadRequest({ ...baseRequest, version: 'cp42b-v1', marketing_cookie_consent: false })).toBeNull()
  })
})

describe('CP-4.2B.5 trusted estimate evaluator', () => {
  it.each([
    ['menos-40', 'RES-A', 1, 3, 3, 60, 30],
    ['41-70', 'RES-B', 1, 4, 4, 80, 40],
    ['71-100', 'RES-C', 2, 3, 6, 120, 60],
  ])('persists the approved %s workload row', (size, rule, operators, elapsed, operatorHours, base, labor) => {
    const result = evaluatePublicQuoteRequest({ ...baseRequest, notes: { ...baseRequest.notes, size } })
    expect(result).toMatchObject({ mode: 'tier_a', manual_review_required: false, confidence: 'high' })
    expect(result.estimate).toMatchObject({ rule_id: rule, operator_count: operators, elapsed_hours: elapsed, operator_hours: operatorHours, base_ex_vat: base, labor_cost: labor })
  })

  it.each(['deep_cleaning', 'tourist', 'office_commercial', 'gym', 'hotel', 'post_work_tenant_change', 'other'])('keeps %s manual', (service) => {
    const result = evaluatePublicQuoteRequest({ ...baseRequest, service_type: service })
    expect(result).toMatchObject({ mode: 'manual_review', manual_review_required: true, confidence: 'none', estimate: null })
  })

  it('keeps complex residential scope manual and never emits a customer price', () => {
    const result = evaluatePublicQuoteRequest({ ...baseRequest, notes: { ...baseRequest.notes, needs: { standardCleaning: true, deepCleaning: true } } })
    expect(result.mode).toBe('manual_review')
    expect(JSON.stringify(result)).not.toMatch(/customer_price|commercial_total|vat/i)
  })
})

describe('CP-4.2B.5 trusted Edge handoff', () => {
  it('routes v2 to the new RPC and keeps the public response identifier-free', async () => {
    const secret = 'qa-only-test-secret-with-at-least-32-characters'
    const now = 1_700_000_000_000
    const body = JSON.stringify(baseRequest)
    const bodyHash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body)))]
      .map((byte) => byte.toString(16).padStart(2, '0')).join('')
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const signature = [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`1700000000.qa.${bodyHash}`)))]
      .map((byte) => byte.toString(16).padStart(2, '0')).join('')
    let rpcUrl = ''
    let rpcPayload: Record<string, unknown> | null = null
    const handler = createPublicLeadIntakeHandler({
      env: (name) => ({
        PUBLIC_LEAD_INTAKE_SECRET: secret,
        SUPABASE_URL: 'https://kpvvydthlxupjjqqdpxy.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'qa-service-role-test-key',
      }[name]),
      now: () => now,
      log: () => undefined,
      fetch: async (input, init) => {
        rpcUrl = input
        rpcPayload = JSON.parse(String(init?.body)) as Record<string, unknown>
        return new Response(JSON.stringify({ ok: true, code: 'accepted', receipt_id: 'QA-CP42B-test' }), { status: 200 })
      },
    })
    const response = await handler(new Request('https://qa.invalid/functions/v1/public-lead-intake', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-costa-environment': 'qa',
        'x-costa-idempotency-key': baseRequest.submission_id,
        'x-costa-timestamp': '1700000000',
        'x-costa-signature': signature,
        'x-forwarded-for': '192.0.2.10',
      },
      body,
    }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, receiptId: 'QA-CP42B-test' })
    expect(rpcUrl).toContain('/rpc/submit_public_quote_request_qa')
    expect(rpcPayload).not.toBeNull()
    const payload = rpcPayload as unknown as Record<string, unknown>
    expect(payload.p_request).toMatchObject({ notes: { responseChannel: 'whatsapp' } })
    expect(payload.p_intelligence).toMatchObject({ engine: 'costa_clean_quote_intelligence@1.0.0', estimate: { rule_id: 'RES-B', base_ex_vat: 80 } })
  })
})
