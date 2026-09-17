import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { V3RecurringPlanWorkspace, V3RecurringPlansSection } from './V3RecurringPlans'

const client = {
  id: 'client-1',
  display_code: 'CLI-0001',
  full_name: 'Elena Vázquez',
  phone: null,
  email: 'elena@example.com',
  tax_id: null,
  billing_address: null,
  status: 'active',
  source_lead_id: null,
}

const plan = {
  id: 'plan-1',
  client_id: client.id,
  client_display_code: client.display_code,
  client_name: client.full_name,
  property_id: null,
  quote_id: null,
  title: 'Limpieza mensual',
  frequency: 'monthly' as const,
  status: 'active' as const,
  default_invoice_status: 'draft' as const,
  next_issue_date: '2026-10-01',
  last_issued_at: null,
  tax_rate: 0.21,
  notes: null,
  internal_notes: null,
  pricing_metadata: null,
  template_lines: [{ concept: 'Limpieza', quantity: 1, unit: 'servicio', unit_price: 100, line_subtotal: 100 }],
}

describe('V3RecurringPlansSection', () => {
  it('renders the native recurring plan entry without legacy flow markers', () => {
    const html = renderToStaticMarkup(createElement(V3RecurringPlansSection, {
      client,
      plans: [plan],
      properties: [],
      quotes: [],
      onRefresh: async () => undefined,
      onOpenProperty: () => undefined,
      onOpenQuote: () => undefined,
      onOpenInvoice: () => undefined,
    }))

    expect(html).toContain('Planes recurrentes')
    expect(html).toContain('Limpieza mensual')
    expect(html).toContain('Mensual')
    expect(html).not.toContain('OperationalListItem')
  })

  it('renders the full-screen workspace contract with a single generation entry point', () => {
    const html = renderToStaticMarkup(createElement(V3RecurringPlanWorkspace, {
      plan,
      properties: [],
      quotes: [],
      onClose: () => undefined,
      onEdit: () => undefined,
      onRefresh: async () => undefined,
      onOpenProperty: () => undefined,
      onOpenQuote: () => undefined,
      onOpenInvoice: () => undefined,
    }))

    expect(html).toContain('v3-bottom-sheet--workspace')
    expect(html).toContain('Volver a planes')
    expect(html).toContain('Estado al emitir')
    expect(html).toContain('Generar factura')
    expect(html).toContain('La próxima emisión está programada')
    expect(html.indexOf('<h1>')).toBeLessThan(html.indexOf('<h2>'))
  })
})
