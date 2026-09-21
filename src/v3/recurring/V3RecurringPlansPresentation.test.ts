import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { V3RecurringPlansSection } from './V3RecurringPlans'

const client = { id: 'client-1', display_code: 'CLI-0001', full_name: 'Cliente de prueba', phone: null, email: null, tax_id: null, billing_address: null, status: 'active', source_lead_id: null }
const plan = { id: 'plan-1', client_id: client.id, client_display_code: client.display_code, client_name: client.full_name, property_id: null, quote_id: null, title: 'Limpieza mensual', frequency: 'monthly' as const, status: 'active' as const, default_invoice_status: 'draft' as const, next_issue_date: '2026-10-01', last_issued_at: null, tax_rate: 0.21, notes: null, internal_notes: null, pricing_metadata: null, template_lines: [{ concept: 'Limpieza', quantity: 1, unit: 'servicio', unit_price: 100, line_subtotal: 100 }] }

describe('V3RecurringPlansSection presentation', () => {
  it('separates plan lifecycle from the next-emission state in its row', () => {
    const html = renderToStaticMarkup(createElement(V3RecurringPlansSection, { client, plans: [plan], properties: [], quotes: [], onRefresh: async () => undefined, onOpenProperty: () => undefined, onOpenQuote: () => undefined, onOpenInvoice: () => undefined }))

    expect(html).toContain('Plan')
    expect(html).toContain('Activo')
    expect(html).toContain('Emisión')
    expect(html).toContain('Programada')
  })

  it('keeps paused and archived plans from looking eligible for emission', () => {
    const html = renderToStaticMarkup(createElement(V3RecurringPlansSection, {
      client,
      plans: [plan, { ...plan, id: 'plan-2', title: 'Limpieza pausada', status: 'paused' }, { ...plan, id: 'plan-3', title: 'Limpieza archivada', status: 'archived' }],
      properties: [],
      quotes: [],
      onRefresh: async () => undefined,
      onOpenProperty: () => undefined,
      onOpenQuote: () => undefined,
      onOpenInvoice: () => undefined,
    }))

    expect(html).toContain('Emisión pausada')
    expect(html).toContain('Emisión no programada')
    expect(html).not.toContain('Limpieza pausada</strong><span>Mensual · Emisión pendiente')
  })
})
