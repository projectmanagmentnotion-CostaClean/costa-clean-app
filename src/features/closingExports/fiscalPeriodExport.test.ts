import { describe, expect, it } from 'vitest'
import { buildFiscalPeriodExportData } from './fiscalPeriodExport'

describe('buildFiscalPeriodExportData', () => {
  it('calcula totales y IVA estimado para un trimestre', () => {
    const result = buildFiscalPeriodExportData({
      selection: {
        mode: 'quarter',
        year: 2026,
        month: 1,
        quarter: 1,
        startDate: '',
        endDate: '',
      },
      invoices: [
        {
          id: 'inv-1',
          display_code: 'INV-1',
          invoice_number: '2026-001',
          job_id: null,
          client_id: 'client-1',
          issue_date: '2026-01-20',
          status: 'sent',
          subtotal: 100,
          tax_amount: 21,
          total: 121,
        },
      ],
      payments: [
        {
          id: 'pay-1',
          display_code: 'PAY-1',
          invoice_id: 'inv-1',
          payment_date: '2026-02-01',
          amount: 121,
          payment_method: 'transfer',
        },
      ],
      expenses: [
        {
          id: 'exp-1',
          display_code: 'EXP-1',
          expense_date: '2026-01-21',
          accounting_date: null,
          due_date: null,
          supplier_name: 'Proveedor 1',
          supplier_tax_id: null,
          category: 'materiales',
          subcategory: null,
          description: 'Producto',
          document_type: 'factura',
          reference_number: null,
          payment_method: 'card',
          payment_status: 'paid',
          currency: 'EUR',
          subtotal: 50,
          tax_rate: 21,
          tax_amount: 10.5,
          total: 60.5,
          is_deductible: true,
          deductible_percentage: 100,
          affects_quarterly_closure: true,
          affects_annual_closure: true,
          receipt_file_url: 'storage://expense-receipts/doc.pdf',
          receipt_file_path: 'doc.pdf',
          attachment_count: 1,
          document_support_status: 'invoice_valid',
          fiscal_review_status: 'reviewed',
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
          fiscal_quarter: 1,
        },
      ],
      quotes: [
        {
          id: 'quote-1',
          display_code: 'Q-1',
          client_id: 'client-1',
          status: 'sent',
          property_id: null,
          subtotal: 100,
          tax_amount: 21,
          total: 121,
          created_at: '2026-01-05T10:00:00Z',
        },
      ],
    })

    expect(result.metrics.invoice_count).toBe(1)
    expect(result.metrics.payment_count).toBe(1)
    expect(result.metrics.expense_count).toBe(1)
    expect(result.metrics.quote_count).toBe(1)
    expect(result.metrics.output_vat_total).toBe(21)
    expect(result.metrics.estimated_deductible_vat).toBe(10.5)
    expect(result.metrics.estimated_net_vat_payable).toBe(10.5)
  })
})
