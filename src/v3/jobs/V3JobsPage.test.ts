import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { V3JobsPage } from './V3JobsPage'

const today = new Date().toISOString().slice(0, 10)
const job = {
  id: 'job-1',
  display_code: 'SRV-0001',
  client_id: 'client-1',
  client_name: 'Cliente de prueba',
  client_display_code: 'CLI-0001',
  property_id: 'property-1',
  property_name: 'Inmueble de prueba',
  property_display_code: 'PROP-0001',
  quote_id: null,
  scheduled_date: today,
  status: 'scheduled',
  service_type: 'standard_cleaning',
  billing_concept: 'Limpieza recurrente',
  billing_quantity: 1,
  billing_unit: 'servicio',
  billing_unit_price: 100,
  billing_lines: [],
}

const baseProps = {
  jobs: [job], clients: [], properties: [], quotes: [], invoices: [], payments: [], error: null,
  onCreateJob: () => undefined, onRefresh: async () => undefined, onOpenClient: () => undefined,
  onOpenProperty: () => undefined, onOpenQuote: () => undefined, onOpenInvoice: () => undefined,
  onCreateInvoice: () => undefined,
}

describe('V3JobsPage C5.2 composition', () => {
  it('puts search and filters before supporting KPIs while keeping one create CTA', () => {
    const html = renderToStaticMarkup(createElement(V3JobsPage, baseProps))

    expect(html).toContain('Nuevo servicio')
    expect(html).toContain('Código, concepto, cliente o inmueble')
    expect(html).toContain('Resumen de agenda')
    expect(html.indexOf('Código, concepto, cliente o inmueble')).toBeLessThan(html.lastIndexOf('Hoy'))
  })
})
