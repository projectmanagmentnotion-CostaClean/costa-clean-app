import { describe, expect, it } from 'vitest'
import {
  awaitConcurrentSettlementRequests,
  assertConcurrentSettlement,
  assertDraftInvoiceFixture,
  assertExpectedFixtureCleanup,
  assertIdempotentCleanup,
  assertQaSnapshotRestored,
  countCleanupActions,
} from './n2ConcurrentSettlementCore.mjs'

const fixtureSnapshot = {
  fiscal_mapping_hash: 'mapping-a',
  real_qa_business_rows_hash: 'business-a',
  sequence_last_value: 17,
  sequence_is_called: true,
  invoice_count: 22,
  payment_count: 9,
  qa_n2_clients: 0,
  qa_n2_properties: 0,
  qa_n2_jobs: 0,
  qa_n2_invoices: 0,
  qa_n2_payments: 0,
}

describe('N2 true settlement concurrency contracts', () => {
  it('waits for both in-flight RPCs before reporting a rejected request', async () => {
    let slowRequestFinished = false
    const failingRequest = Promise.reject(new Error('synthetic request failure'))
    const slowRequest = new Promise((resolve) => {
      setTimeout(() => {
        slowRequestFinished = true
        resolve({ created_payment: false })
      }, 15)
    })

    await expect(awaitConcurrentSettlementRequests([failingRequest, slowRequest]))
      .rejects.toThrow('N2_CONCURRENT_SETTLEMENT_REQUEST_FAILED')
    expect(slowRequestFinished).toBe(true)
  })

  it('accepts two overlapping HTTP request intervals with one payment and no overpayment', () => {
    expect(assertConcurrentSettlement({
      results: [{ created_payment: true }, { created_payment: false }],
      requestIntervals: [{ startMs: 10, endMs: 42 }, { startMs: 12, endMs: 45 }],
      paymentRows: [{ amount: 100 }],
      invoice: { total: 100, status: 'paid' },
    })).toEqual({
      overlapped: true,
      calls: 2,
      paymentsCreated: 1,
      duplicates: 0,
      overpayment: 0,
      outstanding: 0,
    })
  })

  it('rejects sequentially completed calls masquerading as concurrency', () => {
    expect(() => assertConcurrentSettlement({
      results: [{ created_payment: true }, { created_payment: false }],
      requestIntervals: [{ startMs: 10, endMs: 20 }, { startMs: 21, endMs: 30 }],
      paymentRows: [{ amount: 100 }],
      invoice: { total: 100, status: 'paid' },
    })).toThrow('N2_CONCURRENT_REQUESTS_DID_NOT_OVERLAP')
  })

  it('rejects duplicate payments, wrong totals, and an unpaid final state', () => {
    const baseline = {
      results: [{ created_payment: true }, { created_payment: false }],
      requestIntervals: [{ startMs: 10, endMs: 30 }, { startMs: 11, endMs: 32 }],
      invoice: { total: 100, status: 'paid' },
    }
    expect(() => assertConcurrentSettlement({ ...baseline, paymentRows: [{ amount: 100 }, { amount: 100 }] }))
      .toThrow('N2_CONCURRENT_PAYMENT_ROW_COUNT_INVALID')
    expect(() => assertConcurrentSettlement({ ...baseline, paymentRows: [{ amount: 99 }] }))
      .toThrow('N2_CONCURRENT_PAYMENT_AMOUNT_INVALID')
    expect(() => assertConcurrentSettlement({
      ...baseline,
      paymentRows: [{ amount: 100 }],
      invoice: { total: 100, status: 'issued' },
    })).toThrow('N2_CONCURRENT_SETTLEMENT_OUTSTANDING')
  })

  it('requires the created fixture invoice to persist as a non-fiscal draft', () => {
    expect(assertDraftInvoiceFixture({
      status: 'draft', invoice_number: null, display_code: null, draft_nonfiscal: true,
    })).toBe(true)
    expect(() => assertDraftInvoiceFixture({
      status: 'draft', invoice_number: '2026-001', display_code: 'INV-0001', draft_nonfiscal: false,
    })).toThrow('N2_CONCURRENCY_FIXTURE_NOT_NONFISCAL_DRAFT')
  })

  it('requires exact snapshot/hash/sequence restoration and zero fixture residue', () => {
    expect(assertQaSnapshotRestored(fixtureSnapshot, { ...fixtureSnapshot })).toBe(true)
    expect(() => assertQaSnapshotRestored(fixtureSnapshot, {
      ...fixtureSnapshot, sequence_last_value: 18,
    })).toThrow('N2_SNAPSHOT_NOT_RESTORED_SEQUENCE_LAST_VALUE')
    expect(() => assertQaSnapshotRestored(fixtureSnapshot, {
      ...fixtureSnapshot, fiscal_mapping_hash: 'mapping-b',
    })).toThrow('N2_SNAPSHOT_NOT_RESTORED_FISCAL_MAPPING_HASH')
    expect(() => assertQaSnapshotRestored(fixtureSnapshot, {
      ...fixtureSnapshot, qa_n2_payments: 1,
    })).toThrow('N2_RESIDUE_QA_N2_PAYMENTS')
  })

  it('checks the exact committed fixture teardown and idempotent second cleanup', () => {
    const cleanup = { deleted: {
      payments: 1, invoice_lines: 0, invoices: 1, job_lines: 1, jobs: 1,
      quote_lines: 0, quotes: 0, properties: 1, clients: 1, recurring_plans: 0,
    } }
    expect(assertExpectedFixtureCleanup(cleanup)).toBe(6)
    expect(countCleanupActions({ deleted: {} })).toBe(0)
    expect(assertIdempotentCleanup({ deleted: {} })).toBe(true)
    expect(() => assertIdempotentCleanup({ deleted: { clients: 1 } })).toThrow('N2_CLEANUP_NOT_IDEMPOTENT')
  })
})
