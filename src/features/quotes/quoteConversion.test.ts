import { describe, expect, it } from 'vitest'
import { canConvertQuoteToInvoice } from './quoteConversion'

const quote = { id: 'quote-1', display_code: 'PRES-0001', client_id: 'client-1', lead_id: null, property_id: null, status: 'accepted', invoice_id: null, archived_at: null, deleted_at: null, subtotal: 100, tax_amount: 21, total: 121, lines: [{ id: 'line-1', quote_id: 'quote-1', sort_order: 0, concept: 'Limpieza', quantity: 1, unit: 'servicio', unit_price: 100, line_subtotal: 100 }] }

describe('quote conversion eligibility', () => {
  it('allows eligible accepted quotes', () => {
    expect(canConvertQuoteToInvoice(quote)).toBe(true)
  })

  it('blocks an existing active invoice, missing lines and rejected quotes', () => {
    expect(canConvertQuoteToInvoice(quote, [{ id: 'invoice-1', quote_id: 'quote-1', status: 'issued', client_id: 'client-1', display_code: null, invoice_number: null, job_id: null, issue_date: '2026-09-08', subtotal: 100, tax_amount: 21, total: 121 }])).toBe(false)
    expect(canConvertQuoteToInvoice({ ...quote, lines: [] })).toBe(false)
    expect(canConvertQuoteToInvoice({ ...quote, status: 'rejected' })).toBe(false)
  })
})
