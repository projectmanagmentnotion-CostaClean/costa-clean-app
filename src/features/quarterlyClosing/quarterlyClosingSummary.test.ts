import { describe, expect, it } from 'vitest'
import { buildQuarterlyClosingSummary } from './quarterlyClosingSummary'

describe('buildQuarterlyClosingSummary', () => {
  it('asocia cobros a la cohorte de facturas por fecha de emisión', () => {
    const summary = buildQuarterlyClosingSummary(
      [
        {
          id: 'invoice-q1',
          display_code: 'INV-Q1',
          invoice_number: '2026-001',
          job_id: null,
          client_id: 'client-1',
          issue_date: '2026-02-01',
          status: 'issued',
          subtotal: 100,
          tax_amount: 21,
          total: 121,
        },
        {
          id: 'invoice-q4',
          display_code: 'INV-Q4',
          invoice_number: '2026-099',
          job_id: null,
          client_id: 'client-2',
          issue_date: '2026-10-01',
          status: 'issued',
          subtotal: 100,
          tax_amount: 21,
          total: 121,
        },
      ],
      [
        {
          id: 'payment-q2',
          display_code: 'PAY-Q2',
          invoice_id: 'invoice-q1',
          payment_date: '2026-05-01',
          amount: 121,
          payment_method: 'transfer',
        },
        {
          id: 'payment-q1-other-invoice',
          display_code: 'PAY-Q1-OTHER',
          invoice_id: 'invoice-q4',
          payment_date: '2026-02-01',
          amount: 80,
          payment_method: 'transfer',
        },
      ],
      [],
      2026,
      1,
    )

    expect(summary.invoiceCount).toBe(1)
    expect(summary.paymentCount).toBe(1)
    expect(summary.collectedTotal).toBe(121)
    expect(summary.outstandingTotal).toBe(0)
    expect(summary.incidences.find((incidence) => incidence.id === 'payment_quarter_all')?.detail)
      .toContain('facturas emitidas en el trimestre')
  })
})
