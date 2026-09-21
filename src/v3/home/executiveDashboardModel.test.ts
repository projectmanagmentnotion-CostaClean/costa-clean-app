import { describe, expect, it } from 'vitest'
import { buildExecutiveDashboardModel } from './executiveDashboardModel'

const input = {
  invoices: [{ id: 'i1', issue_date: '2026-09-10', status: 'issued', archived_at: null, deleted_at: null, cancelled_at: null, subtotal: 100, tax_amount: 21, total: 121, client_id: 'c1', job_id: 'j1', outstanding_amount: 21 }],
  payments: [{ id: 'p1', invoice_id: 'i1', payment_date: '2026-09-12', amount: 100 }],
  expenses: [{ id: 'e1', expense_date: '2026-09-04', archived_at: null, deleted_at: null, cancelled_at: null, subtotal: 20, tax_amount: 4.2, total: 24.2, receipt_file_path: 'receipt.pdf', document_support_status: 'invoice_valid', document_type: 'factura', is_deductible: true }],
  jobs: [{ id: 'j1', scheduled_date: '2026-09-11', status: 'completed', archived_at: null, deleted_at: null, cancelled_at: null }],
  quotes: [{ id: 'q1', created_at: '2026-09-02', status: 'sent', archived_at: null, deleted_at: null, cancelled_at: null }],
} as never

describe('executive dashboard model', () => {
  it('keeps invoice, payment, expense and VAT calculations period-scoped', () => {
    const model = buildExecutiveDashboardModel(input, { kind: 'month', key: '2026-09' })
    expect(model.invoiced).toBe(121)
    expect(model.collected).toBe(100)
    expect(model.outstanding).toBe(21)
    expect(model.expenses).toBe(24.2)
    expect(model.outputVat).toBe(21)
    expect(model.inputVat).toBe(4.2)
    expect(model.estimatedVat).toBe(16.8)
    expect(model.operational.completedUnbilledJobs).toBe(0)
  })

  it('does not invent growth when the comparable period has no data', () => {
    const model = buildExecutiveDashboardModel(input, { kind: 'month', key: '2026-09' })
    expect(model.hasComparableData).toBe(false)
    expect(model.growth.invoiced).toBeNull()
  })

  it('does not double-count payments belonging to another period invoice', () => {
    const model = buildExecutiveDashboardModel(Object.assign({}, input, { payments: [{ id: 'p2', invoice_id: 'i1', payment_date: '2026-10-01', amount: 21 }] }) as never, { kind: 'month', key: '2026-10' })
    expect(model.collected).toBe(0)
  })
})
