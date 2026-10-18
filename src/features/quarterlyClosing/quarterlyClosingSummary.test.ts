import { describe, expect, it } from 'vitest'
import { buildQuarterlyClosingSummary } from './quarterlyClosingSummary'
import type { InvoiceListItem } from '../invoices/types'
import type { PaymentListItem } from '../payments/types'

const invoice: InvoiceListItem = {
  id: 'invoice-q2',
  display_code: 'INV-Q2',
  invoice_number: '2026-001',
  job_id: null,
  client_id: 'client-1',
  issue_date: '2026-06-30',
  status: 'issued',
  subtotal: 826.45,
  tax_amount: 173.55,
  total: 1000,
}

const payment: PaymentListItem = {
  id: 'payment-q3',
  display_code: 'PAY-Q3',
  invoice_id: invoice.id,
  payment_date: '2026-07-18',
  amount: 1000,
  payment_method: 'transfer',
}

describe('buildQuarterlyClosingSummary invoice cohort semantics', () => {
  it('keeps a later payment in the invoice issue-date quarter', () => {
    const q2 = buildQuarterlyClosingSummary([invoice], [payment], [], 2026, 2)
    const q3 = buildQuarterlyClosingSummary([invoice], [payment], [], 2026, 3)

    expect(q2.invoicedTotal).toBe(1000)
    expect(q2.collectedTotal).toBe(1000)
    expect(q2.outstandingTotal).toBe(0)
    expect(q3.invoicedTotal).toBe(0)
    expect(q3.collectedTotal).toBe(0)
  })
})
