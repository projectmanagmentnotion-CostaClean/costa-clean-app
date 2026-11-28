import { describe, expect, it } from 'vitest'
import type { ExpenseListItem } from '../expenses/types'
import type { InvoiceListItem } from '../invoices/types'
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

  it('excludes non-emitted and cancelled invoices from collection and VAT totals', () => {
    const invoice = (id: string, overrides: Partial<InvoiceListItem> = {}): InvoiceListItem => ({
      id,
      display_code: `INV-${id}`,
      invoice_number: `2026-${id}`,
      job_id: null,
      client_id: `client-${id}`,
      issue_date: '2026-10-15',
      status: 'issued',
      subtotal: 100,
      tax_amount: 21,
      total: 121,
      ...overrides,
    })

    const summary = buildQuarterlyClosingSummary(
      [
        invoice('issued-partial'),
        invoice('paid', { status: 'paid' }),
        invoice('draft', { status: 'draft' }),
        invoice('cancelled', { status: 'cancelled' }),
        invoice('cancelled-at', { cancelled_at: '2026-10-20T10:00:00Z' }),
        invoice('archived', { archived_at: '2026-10-20T10:00:00Z' }),
        invoice('deleted', { deleted_at: '2026-10-20T10:00:00Z' }),
      ],
      [
        { id: 'payment-issued', display_code: 'PAY-1', invoice_id: 'issued-partial', payment_date: '2026-10-16', amount: 50, payment_method: 'transfer' },
        { id: 'payment-paid', display_code: 'PAY-2', invoice_id: 'paid', payment_date: '2026-10-17', amount: 121, payment_method: 'transfer' },
        { id: 'payment-draft', display_code: 'PAY-3', invoice_id: 'draft', payment_date: '2026-10-18', amount: 121, payment_method: 'transfer' },
        { id: 'payment-cancelled', display_code: 'PAY-4', invoice_id: 'cancelled', payment_date: '2026-10-19', amount: 121, payment_method: 'transfer' },
      ],
      [],
      2026,
      4,
    )

    expect(summary.invoiceCount).toBe(2)
    expect(summary.paymentCount).toBe(2)
    expect(summary.collectedTotal).toBe(171)
    expect(summary.pendingInvoiceCount).toBe(1)
    expect(summary.outstandingTotal).toBe(71)
    expect(summary.invoicedTotal).toBe(242)
    expect(summary.outputVatTotal).toBe(42)
  })

  it('keeps valid fiscal-review and VAT-support warnings for ticket receipts', () => {
    const expense = (id: string): ExpenseListItem => ({
      id,
      display_code: `EXP-${id}`,
      expense_date: '2026-11-12',
      accounting_date: null,
      due_date: null,
      supplier_name: 'Proveedor sintético',
      supplier_tax_id: null,
      category: 'otros',
      subcategory: null,
      description: 'Gasto de prueba sintético',
      document_type: 'ticket',
      reference_number: null,
      payment_method: 'card',
      payment_status: 'paid',
      currency: 'EUR',
      subtotal: 100,
      tax_rate: 0.21,
      tax_amount: 21,
      total: 121,
      is_deductible: true,
      deductible_percentage: 100,
      affects_quarterly_closure: true,
      affects_annual_closure: true,
      receipt_file_url: null,
      receipt_file_path: `synthetic/${id}.pdf`,
      attachment_count: 1,
      document_support_status: 'pending_review',
      fiscal_review_status: 'pending',
      fiscal_risk_level: 'low',
      manager_note: null,
      ai_fiscal_classification: null,
      ai_deductibility_percentage: null,
      ai_vat_deductibility_percentage: null,
      ai_estimated_deductible_base: null,
      ai_estimated_deductible_vat: null,
      ai_fiscal_confidence: null,
      ai_fiscal_risk_level: null,
      ai_fiscal_reasoning: null,
      ai_fiscal_flags: null,
      ai_fiscal_model: null,
      ai_fiscal_analyzed_at: null,
      ai_fiscal_source_version: null,
      notes: null,
      fiscal_year: 2026,
      fiscal_quarter: 4,
    })

    const summary = buildQuarterlyClosingSummary([], [], [expense('1'), expense('2')], 2026, 4)

    expect(summary.missingSupportCount).toBe(0)
    expect(summary.pendingReviewCount).toBe(2)
    expect(summary.missingValidVatInvoiceCount).toBe(2)
    expect(summary.riskCount).toBe(0)
    expect(summary.unresolvedIncidenceCount).toBe(4)
    expect(summary.readiness).toBe('issues')
  })
})
