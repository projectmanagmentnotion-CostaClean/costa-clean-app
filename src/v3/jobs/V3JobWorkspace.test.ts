import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { V3JobWorkspace } from './V3JobWorkspace'

const job = {
  id: 'job-1', display_code: 'SRV-0001', client_id: 'client-1', property_id: 'property-1', quote_id: null,
  scheduled_date: '2026-09-17', status: 'completed', service_type: 'standard_cleaning',
  billing_concept: 'Limpieza final', billing_quantity: 1, billing_unit: 'servicio', billing_unit_price: 125,
  billing_lines: [], notes: null,
}

const props = {
  job, clients: [], properties: [], quotes: [], invoices: [], payments: [], onBack: () => undefined,
  onRefresh: async () => undefined, onOpenClient: () => undefined, onOpenProperty: () => undefined,
  onOpenQuote: () => undefined, onOpenInvoice: () => undefined, onCreateInvoice: () => undefined,
}

describe('V3JobWorkspace C5.2 composition', () => {
  it('explains the invoice-eligible branch and keeps the Work Report operational', () => {
    const html = renderToStaticMarkup(createElement(V3JobWorkspace, props))

    expect(html).toContain('Crear factura')
    expect(html).toContain('Servicio realizado sin factura relacionada')
    expect(html).toContain('Parte de trabajo')
    expect(html).toContain('Descargar PDF')
    expect(html).toContain('Compartir parte')
    expect(html).not.toContain(job.id)
  })
})
