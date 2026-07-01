import { describe, expect, it } from 'vitest'
import { buildExpenseCreatePrefillFromExpense } from './expenses/expenseCreatePrefill'
import { buildInvoiceCreatePrefillFromInvoice } from './invoices/invoiceDuplicatePrefill'
import { buildJobCreatePrefillFromJob, buildJobCreatePrefillFromQuote } from './jobs/jobCreatePrefill'
import { buildQuoteCreatePrefillFromQuote } from './quotes/quoteCreatePrefill'

describe('entity creation prefills', () => {
  it('copies all quote lines into job and quote prefills', () => {
    const quote = {
      id: 'quote-1',
      client_id: 'client-1',
      property_id: 'property-1',
      notes: 'Notas visibles',
      lines: [
        { id: 'q1', quote_id: 'quote-1', sort_order: 1, concept: 'Linea 1', quantity: 2, unit: 'hora', unit_price: 50, line_subtotal: 100 },
        { id: 'q2', quote_id: 'quote-1', sort_order: 2, concept: 'Linea 2', quantity: 1, unit: 'servicio', unit_price: 25, line_subtotal: 25 },
      ],
    }

    expect(buildJobCreatePrefillFromQuote(quote as never)?.billing_lines).toHaveLength(2)
    expect(buildQuoteCreatePrefillFromQuote({
      ...quote,
      display_code: null,
      status: 'accepted',
      subtotal: 125,
      tax_amount: 26.25,
      total: 151.25,
    } as never)?.lines).toHaveLength(2)
  })

  it('creates safe duplicate prefills without final-state carryover', () => {
    const invoicePrefill = buildInvoiceCreatePrefillFromInvoice({
      id: 'invoice-1',
      display_code: 'INV-1',
      invoice_number: '2026-001',
      job_id: 'job-1',
      client_id: 'client-1',
      issue_date: '2026-07-01',
      status: 'issued',
      subtotal: 100,
      tax_amount: 21,
      total: 121,
      notes: 'Nota',
      property_id: 'property-1',
      lines: [
        { id: 'i1', invoice_id: 'invoice-1', sort_order: 1, concept: 'Servicio', quantity: 1, unit: 'servicio', unit_price: 100, line_subtotal: 100 },
      ],
    } as never)

    const jobPrefill = buildJobCreatePrefillFromJob({
      id: 'job-1',
      client_id: 'client-1',
      property_id: 'property-1',
      service_type: 'standard_cleaning',
      notes: 'Notas',
      billing_lines: [
        { concept: 'Servicio', quantity: 1, unit: 'servicio', unit_price: 90 },
      ],
    })

    const expensePrefill = buildExpenseCreatePrefillFromExpense({
      id: 'expense-1',
      display_code: 'EXP-1',
      expense_date: '2026-07-01',
      accounting_date: null,
      due_date: null,
      supplier_name: 'Proveedor',
      supplier_tax_id: null,
      category: 'otros',
      subcategory: null,
      description: 'Compra',
      document_type: 'factura',
      reference_number: null,
      payment_method: null,
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
      receipt_file_url: null,
      receipt_file_path: 'receipt.pdf',
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
      notes: 'Notas',
    })

    expect(invoicePrefill.origin_kind).toBe('manual')
    expect(invoicePrefill.job_id).toBe('')
    expect(jobPrefill?.quote_id).toBe('')
    expect(expensePrefill.document_type).toBe('factura')
    expect(expensePrefill.description).toBe('Compra')
  })
})
