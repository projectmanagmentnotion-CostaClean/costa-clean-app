import { describe, expect, it } from 'vitest'
import {
  QA_INTAKE_ENDPOINT,
  QA_PROJECT_REF,
  assertBaselineRestored,
  assertNoForbiddenReportContent,
  assertPublicResponseSafe,
  buildFixture,
  validatePreflight,
} from './certify-cp42b7.mjs'

const validEnv = {
  PUBLIC_LEAD_INTAKE_SECRET: 's'.repeat(48),
  PUBLIC_LEAD_INTAKE_ENV: 'qa',
  PUBLIC_LEAD_INTAKE_URL: QA_INTAKE_ENDPOINT,
  SUPABASE_QA_SERVICE_ROLE_KEY: 'qa-admin-placeholder',
}

describe('CP42B7 runtime harness preflight', () => {
  it('fails closed when the HMAC signer is missing', () => {
    expect(() => validatePreflight({ ...validEnv, PUBLIC_LEAD_INTAKE_SECRET: '' })).toThrow('HMAC_SIGNER_SECRET_UNAVAILABLE')
  })

  it('rejects the wrong environment and production endpoint', () => {
    expect(() => validatePreflight({ ...validEnv, PUBLIC_LEAD_INTAKE_ENV: 'production' })).toThrow('QA_ENVIRONMENT_INVALID')
    expect(() => validatePreflight({ ...validEnv, PUBLIC_LEAD_INTAKE_URL: 'https://wfxnwfcdjainpojhbdri.supabase.co/functions/v1/public-lead-intake' })).toThrow('PRODUCTION_TARGET_BLOCKED')
  })

  it('locks the exact QA project endpoint', () => {
    expect(validatePreflight(validEnv)).toMatchObject({ environment: 'qa', endpoint: QA_INTAKE_ENDPOINT })
    expect(QA_INTAKE_ENDPOINT).toContain(QA_PROJECT_REF)
    expect(() => validatePreflight({ ...validEnv, PUBLIC_LEAD_INTAKE_URL: 'https://other.supabase.co/functions/v1/public-lead-intake' })).toThrow('QA_TARGET_MISMATCH')
  })
})

describe('CP42B7 runtime harness safety assertions', () => {
  it('builds a fresh RES-C synthetic fixture without click IDs', () => {
    const fixture = buildFixture('11111111-1111-4111-8111-111111111117')
    expect(fixture.service).toBe('residential')
    expect(fixture.size).toBe('71-100')
    expect(fixture.cookieConsent).toEqual({ analytics: false, marketing: false })
    expect(fixture.attribution).not.toHaveProperty('gclid')
  })

  it('rejects public response leaks and accepts only the minimal success shape', () => {
    expect(assertPublicResponseSafe({ ok: true }, 200)).toBe(true)
    expect(() => assertPublicResponseSafe({ ok: true, seed_id: 'internal' }, 200)).toThrow('PUBLIC_RESPONSE_NOT_MINIMAL')
    expect(() => assertPublicResponseSafe({ ok: false, error: 'supabase' }, 503)).toThrow('WEB_HTTP_NOT_200')
  })

  it('fails when cleanup does not restore the baseline', () => {
    expect(assertBaselineRestored({ leads: 2, clients: 8 }, { leads: 2, clients: 8 })).toBe(true)
    expect(() => assertBaselineRestored({ leads: 2 }, { leads: 3 })).toThrow('BASELINE_NOT_RESTORED:leads')
  })

  it('keeps secrets and forbidden fields out of the report', () => {
    expect(assertNoForbiddenReportContent({ status: 'PASS', target: QA_PROJECT_REF }, ['secret-value'])).toBe(true)
    expect(() => assertNoForbiddenReportContent({ status: 'PASS', token: 'secret-value' }, ['secret-value'])).toThrow('REPORT_SECRET_LEAK')
  })
})
