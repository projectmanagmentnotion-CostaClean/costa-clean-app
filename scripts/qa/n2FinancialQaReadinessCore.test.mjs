import { describe, expect, it } from 'vitest'
import {
  CLEANUP_DEPENDENCY_ORDER,
  N2_QA_ISSUER,
  assertBaselineRestored,
  assertDraftFixturePlan,
  assertN2QaIdentity,
  assertN2QaProjectUrl,
  assertReadinessPlan,
  assertRollbackHarnessResult,
  isQaCertClientFixture,
  isQaN2ClientFixture,
} from './n2FinancialQaReadinessCore.mjs'

function tokenWithIssuer(issuer) {
  const payload = Buffer.from(JSON.stringify({ iss: issuer })).toString('base64url')
  return `header.${payload}.signature`
}

describe('N2 zero-cost QA readiness contracts', () => {
  const qaUrl = 'https://kpvvydthlxupjjqqdpxy.supabase.co'

  it('accepts only the canonical QA URL paired with a QA-issued authenticated token', () => {
    expect(assertN2QaIdentity({ supabaseUrl: qaUrl, accessToken: tokenWithIssuer(N2_QA_ISSUER) })).toMatchObject({
      projectRef: 'kpvvydthlxupjjqqdpxy',
      productionRejected: true,
      signedQaIssuerVerified: true,
    })
  })

  it('rejects Production and unknown project URLs before any fixture work', () => {
    expect(() => assertN2QaIdentity({
      supabaseUrl: 'https://wfxnwfcdjainpojhbdri.supabase.co',
      accessToken: tokenWithIssuer(N2_QA_ISSUER),
    })).toThrow('N2_PRODUCTION_TARGET_REJECTED')
    expect(() => assertN2QaIdentity({
      supabaseUrl: 'https://unknown.supabase.co',
      accessToken: tokenWithIssuer('https://unknown.supabase.co/auth/v1'),
    })).toThrow('N2_UNKNOWN_PROJECT_REJECTED')
  })

  it('rejects any non-QA endpoint before a client can attempt authentication', () => {
    expect(() => assertN2QaProjectUrl('https://wfxnwfcdjainpojhbdri.supabase.co')).toThrow('N2_PRODUCTION_TARGET_REJECTED')
    expect(() => assertN2QaProjectUrl('https://unknown.supabase.co')).toThrow('N2_UNKNOWN_PROJECT_REJECTED')
    expect(assertN2QaProjectUrl(qaUrl)).toBe('kpvvydthlxupjjqqdpxy')
  })

  it('rejects a QA URL paired with an auth token issued by another project', () => {
    expect(() => assertN2QaIdentity({
      supabaseUrl: qaUrl,
      accessToken: tokenWithIssuer('https://wfxnwfcdjainpojhbdri.supabase.co/auth/v1'),
    })).toThrow('N2_AUTH_ISSUER_MISMATCH')
  })

  it('matches QA_N2 fixtures only when both the exact namespace and synthetic email marker agree', () => {
    const valid = { full_name: 'QA_N2_CLIENT_run_123_PRIMARY', email: 'qa_n2+run_123@qa.invalid' }
    expect(isQaN2ClientFixture(valid, 'run_123')).toBe(true)
    expect(isQaN2ClientFixture({ ...valid, email: 'real@example.com' }, 'run_123')).toBe(false)
    expect(isQaN2ClientFixture({ ...valid, full_name: 'Customer QA_N2_CLIENT_run_123' }, 'run_123')).toBe(false)
    expect(isQaN2ClientFixture({ ...valid, full_name: 'QA_N2_CLIENT_other_PRIMARY' }, 'run_123')).toBe(false)
  })

  it('preserves QA_CERT matching while refusing normal clients', () => {
    expect(isQaCertClientFixture({ full_name: 'QA_CERT_run_123_client' }, 'run_123')).toBe(true)
    expect(isQaCertClientFixture({ full_name: 'Client QA_CERT_run_123' }, 'run_123')).toBe(false)
    expect(isQaCertClientFixture({ full_name: 'Costa Clean Client' }, 'run_123')).toBe(false)
  })

  it('uses foreign-key-safe cleanup dependency order', () => {
    expect(CLEANUP_DEPENDENCY_ORDER).toEqual([
      'payments', 'invoice_lines', 'invoices', 'recurring_invoice_plans',
      'job_lines', 'jobs', 'quote_lines', 'quotes', 'properties', 'clients',
    ])
  })

  it('fails readiness closed for missing auth, residue, dependencies, or rollback proof', () => {
    const ready = {
      authorized_internal_admin: true,
      qa_auth_issuer_verified: true,
      cleanup_rpc_present: true,
      rollback_harness_present: true,
      transaction_supported: true,
      missing_tables: [],
      missing_functions: [],
      missing_n1_migrations: [],
      readiness: true,
      qa_n2_residue: 0,
    }
    expect(assertReadinessPlan(ready)).toBe(true)
    for (const invalid of [
      { ...ready, authorized_internal_admin: false },
      { ...ready, readiness: false },
      { ...ready, qa_n2_residue: 1 },
      { ...ready, cleanup_rpc_present: false },
      { ...ready, transaction_supported: false },
      { ...ready, missing_functions: ['public.save_job_with_lines(jsonb,jsonb)'] },
    ]) expect(() => assertReadinessPlan(invalid)).toThrow()
  })

  it('requires the exact safe draft graph shape and no payment', () => {
    expect(assertDraftFixturePlan({ clients: 1, properties: 1, quotes: 1, quote_lines: 1, jobs: 1, job_lines: 1, invoices: 1, invoice_lines: 1, payments: 0 })).toBe(true)
    expect(() => assertDraftFixturePlan({ clients: 1, properties: 1, quotes: 1, quote_lines: 1, jobs: 1, job_lines: 1, invoices: 1, invoice_lines: 1, payments: 1 })).toThrow('N2_FIXTURE_PLAN_MISMATCH_PAYMENTS')
  })

  it('requires rollback checks to prove issued invoices, payments, and fiscal state leave no residue', () => {
    expect(assertRollbackHarnessResult({
      passed: true,
      rolled_back_jobs: 4,
      rolled_back_issued_invoices: 3,
      rolled_back_settlements: 2,
      fiscal_numbering_rows_unchanged: true,
      fiscal_number_mapping_unchanged: true,
      next_fiscal_number_unchanged: true,
      duplicate_settlement_idempotent: true,
      payment_rows_unchanged: true,
      stages: ['after_job', 'after_invoice', 'after_payment', 'duplicate_settlement'],
    })).toBe(true)
    expect(() => assertRollbackHarnessResult({ passed: true, rolled_back_jobs: 0 })).toThrow('N2_TRANSACTION_ROLLBACK_HARNESS_FAILED')
  })

  it('fails if any baseline table, invariant, or QA_N2 residue differs after teardown', () => {
    const before = { clients: 10, properties: 3, quotes: 4, jobs: 0, invoices: 8, payments: 0, invariants: { mismatches: 0 } }
    expect(assertBaselineRestored(before, { ...before, qa_n2_residue: 0 })).toBe(true)
    expect(() => assertBaselineRestored(before, { ...before, clients: 11, qa_n2_residue: 0 })).toThrow('N2_QA_BASELINE_NOT_RESTORED_CLIENTS')
    expect(() => assertBaselineRestored(before, { ...before, invariants: { mismatches: 1 }, qa_n2_residue: 0 })).toThrow('N2_QA_INVARIANT_CHANGED_MISMATCHES')
    expect(() => assertBaselineRestored(before, { ...before, qa_n2_residue: 1 })).toThrow('N2_QA_RESIDUE_PRESENT_AFTER_CLEANUP')
  })
})
