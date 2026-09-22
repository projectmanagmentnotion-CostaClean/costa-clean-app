export const N2_CONCURRENCY_FIXTURE_TOTAL = 100

export async function awaitConcurrentSettlementRequests(requests) {
  if (!Array.isArray(requests) || requests.length !== 2) {
    throw new Error('N2_CONCURRENT_CALL_COUNT_INVALID')
  }
  const settled = await Promise.allSettled(requests)
  if (settled.some((result) => result.status === 'rejected')) {
    throw new Error('N2_CONCURRENT_SETTLEMENT_REQUEST_FAILED')
  }
  return settled.map((result) => result.value)
}

export function assertQaSnapshotRestored(before, after) {
  const exactFields = [
    'fiscal_mapping_hash',
    'real_qa_business_rows_hash',
    'sequence_last_value',
    'sequence_is_called',
    'invoice_count',
    'payment_count',
  ]
  for (const field of exactFields) {
    if (before?.[field] !== after?.[field]) {
      throw new Error(`N2_SNAPSHOT_NOT_RESTORED_${field.toUpperCase()}`)
    }
  }

  const zeroFields = [
    'qa_n2_clients',
    'qa_n2_properties',
    'qa_n2_jobs',
    'qa_n2_invoices',
    'qa_n2_payments',
  ]
  for (const field of zeroFields) {
    if (Number(after?.[field]) !== 0) throw new Error(`N2_RESIDUE_${field.toUpperCase()}`)
  }
  return true
}

export function assertDraftInvoiceFixture(invoice) {
  if (
    invoice?.status !== 'draft'
    || invoice?.invoice_number !== null
    || invoice?.display_code !== null
    || invoice?.draft_nonfiscal !== true
  ) {
    throw new Error('N2_CONCURRENCY_FIXTURE_NOT_NONFISCAL_DRAFT')
  }
  return true
}

export function assertConcurrentSettlement({ results, requestIntervals, paymentRows, invoice }) {
  if (!Array.isArray(results) || results.length !== 2) throw new Error('N2_CONCURRENT_CALL_COUNT_INVALID')
  if (!Array.isArray(requestIntervals) || requestIntervals.length !== 2) {
    throw new Error('N2_CONCURRENT_INTERVAL_COUNT_INVALID')
  }

  const [first, second] = requestIntervals
  if (![first?.startMs, first?.endMs, second?.startMs, second?.endMs].every(Number.isFinite)) {
    throw new Error('N2_CONCURRENT_TIMINGS_MISSING')
  }
  if (!(first.startMs < second.endMs && second.startMs < first.endMs)) {
    throw new Error('N2_CONCURRENT_REQUESTS_DID_NOT_OVERLAP')
  }

  const created = results.filter((result) => result?.created_payment === true).length
  const noOps = results.filter((result) => result?.created_payment === false).length
  if (created !== 1 || noOps !== 1) throw new Error('N2_CONCURRENT_SETTLEMENT_RESULT_INVALID')
  if (!Array.isArray(paymentRows) || paymentRows.length !== 1) {
    throw new Error('N2_CONCURRENT_PAYMENT_ROW_COUNT_INVALID')
  }

  const total = Number(invoice?.total)
  const paid = paymentRows.reduce((sum, payment) => sum + Number(payment?.amount), 0)
  const outstanding = Math.max(total - paid, 0)
  if (total !== N2_CONCURRENCY_FIXTURE_TOTAL || paid !== N2_CONCURRENCY_FIXTURE_TOTAL) {
    throw new Error('N2_CONCURRENT_PAYMENT_AMOUNT_INVALID')
  }
  if (outstanding !== 0 || invoice?.status !== 'paid') {
    throw new Error('N2_CONCURRENT_SETTLEMENT_OUTSTANDING')
  }

  return {
    overlapped: true,
    calls: 2,
    paymentsCreated: created,
    duplicates: Math.max(paymentRows.length - 1, 0),
    overpayment: Math.max(paid - total, 0),
    outstanding,
  }
}

export function countCleanupActions(cleanup) {
  return Object.values(cleanup?.deleted ?? {}).reduce((sum, value) => sum + Number(value || 0), 0)
}

export function assertExpectedFixtureCleanup(cleanup) {
  const deleted = cleanup?.deleted ?? {}
  const expected = { payments: 1, invoice_lines: 0, invoices: 1, jobs: 1, properties: 1, clients: 1 }
  for (const [table, expectedCount] of Object.entries(expected)) {
    if (Number(deleted[table] ?? 0) !== expectedCount) {
      throw new Error(`N2_CONCURRENCY_CLEANUP_COUNT_${table.toUpperCase()}`)
    }
  }
  if (Number(deleted?.job_lines ?? 0) !== 1) throw new Error('N2_CONCURRENCY_CLEANUP_COUNT_JOB_LINES')
  for (const table of ['quotes', 'quote_lines', 'recurring_plans']) {
    if (Number(deleted[table] ?? 0) !== 0) throw new Error(`N2_CONCURRENCY_CLEANUP_UNEXPECTED_${table.toUpperCase()}`)
  }
  return countCleanupActions(cleanup)
}

export function assertIdempotentCleanup(cleanup) {
  if (countCleanupActions(cleanup) !== 0) throw new Error('N2_CLEANUP_NOT_IDEMPOTENT')
  return true
}
