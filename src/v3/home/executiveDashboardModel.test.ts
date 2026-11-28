import { describe, expect, it } from 'vitest'
import type { InvoiceListItem } from '../../features/invoices/types'
import type { PaymentListItem } from '../../features/payments/types'
import { buildExecutiveDashboardModel } from './executiveDashboardModel'

const invoice = (id: string, issue_date: string, total: number): InvoiceListItem => ({
  id,
  display_code: id,
  invoice_number: id,
  job_id: null,
  client_id: 'synthetic-client',
  issue_date,
  status: 'issued',
  subtotal: total / 1.21,
  tax_amount: total - total / 1.21,
  total,
})

const payment = (id: string, invoice_id: string, payment_date: string, amount: number): PaymentListItem => ({
  id,
  display_code: id,
  invoice_id,
  payment_date,
  amount,
  payment_method: 'transfer',
})

describe('buildExecutiveDashboardModel collection cohort', () => {
  it('keeps a later payment with the cohort of the invoice issue period', () => {
    const model = buildExecutiveDashboardModel({
      invoices: [invoice('inv-sep', '2026-09-18', 121)],
      payments: [payment('pay-oct', 'inv-sep', '2026-10-02', 50)],
      expenses: [],
      jobs: [],
      quotes: [],
    }, { kind: 'month', key: '2026-09' })

    expect(model.invoiced).toBe(121)
    expect(model.collected).toBe(50)
    expect(model.outstanding).toBe(71)
    expect(model.estimatedVat).toBeCloseTo(21)
  })

  it('excludes a payment in the period when its invoice belongs to an earlier cohort', () => {
    const model = buildExecutiveDashboardModel({
      invoices: [invoice('inv-aug', '2026-08-18', 121)],
      payments: [payment('pay-sep', 'inv-aug', '2026-09-02', 121)],
      expenses: [],
      jobs: [],
      quotes: [],
    }, { kind: 'month', key: '2026-09' })

    expect(model.invoiced).toBe(0)
    expect(model.collected).toBe(0)
    expect(model.outstanding).toBe(0)
  })
})
