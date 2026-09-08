import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { V3PaymentRow } from './V3PaymentRow'

describe('V3PaymentRow', () => {
  it('keeps invoice, client, amount and method visible', () => {
    const html = renderToStaticMarkup(createElement(V3PaymentRow, { payment: { id: 'pay-1', display_code: 'COB-001', invoice_id: 'inv-1', invoice_display_code: 'FAC-001', payment_date: '2026-09-08', amount: 350, payment_method: 'transfer', origin_type: 'manual', notes: null }, invoice: { id: 'inv-1', display_code: 'FAC-001', invoice_number: null, issue_date: '2026-09-01', due_date: null, client_id: 'client-1', property_id: null, job_id: null, quote_id: null, total: 350, subtotal: 289.26, tax_amount: 60.74, status: 'issued', payment_status: 'pending', outstanding_amount: 350, paid_amount: 0, payment_count: 0, last_payment_date: null, last_payment_method: null, last_payment_origin_type: null, service_description: 'Limpieza', billing_concept: 'Limpieza', service_reference: null, lines: [], invoice_lines: [] } as never, clientName: 'Cliente Uno', onOpen: () => undefined }))
    expect(html).toContain('350,00')
    expect(html).toContain('FAC-001')
    expect(html).toContain('Cliente Uno')
    expect(html).toContain('Transferencia')
  })
})
