import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { V3PaymentWorkspace } from './V3PaymentWorkspace'

const payment = { id: 'pay-1', display_code: 'COB-001', invoice_id: 'inv-1', payment_date: '2026-09-08', amount: 350, payment_method: 'transfer', origin_type: 'transfer_auto', notes: null }
const invoice = { id: 'inv-1', display_code: 'FAC-001', invoice_number: null, issue_date: '2026-09-01', due_date: null, client_id: 'client-1', property_id: null, job_id: null, quote_id: null, total: 350, subtotal: 289.26, tax_amount: 60.74, status: 'issued', payment_status: 'pending' as const, outstanding_amount: 350, paid_amount: 0, payment_count: 0, last_payment_date: null, last_payment_method: null, last_payment_origin_type: null, service_description: 'Limpieza', billing_concept: 'Limpieza', service_reference: null, lines: [], invoice_lines: [] }

describe('V3PaymentWorkspace', () => {
  it('explains automatic transfer provenance without claiming reconciliation and keeps one invoice CTA', () => {
    const html = renderToStaticMarkup(createElement(V3PaymentWorkspace, {
      payment, payments: [payment], invoice, client: { id: 'client-1', full_name: 'Cliente Uno' } as never, invoices: [invoice] as never,
      onBack: () => undefined, onRefresh: async () => undefined, onOpenInvoice: () => undefined, onOpenClient: () => undefined,
    }))
    expect(html).toContain('Información automática de transferencia')
    expect(html).toContain('No determina conciliación')
    expect(html).toContain('No confirma conciliación ni liquidación')
    expect(html.match(/(?:Ver|Abrir) factura/g)).toHaveLength(1)
    expect(html).not.toContain('Editar cobro')
  })

  it('keeps the edit affordance limited to manual payment records', () => {
    const html = renderToStaticMarkup(createElement(V3PaymentWorkspace, {
      payment: { ...payment, origin_type: 'manual' }, payments: [payment], invoice, client: { id: 'client-1', full_name: 'Cliente Uno' } as never, invoices: [invoice] as never,
      onBack: () => undefined, onRefresh: async () => undefined, onOpenInvoice: () => undefined, onOpenClient: () => undefined,
    }))
    expect(html).toContain('Editar cobro')
  })
})
