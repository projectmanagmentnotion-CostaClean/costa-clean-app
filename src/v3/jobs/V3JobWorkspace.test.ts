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
    expect(html).toContain('<div><span>Estado</span><span class="v3-status v3-status--success"><span class="v3-status__label">Realizado</span></span></div>')
    expect(html).toContain('<div><span>Facturación</span><span class="v3-status v3-status--neutral"><span class="v3-status__label">Sin facturar</span></span></div>')
    expect(html).not.toContain(job.id)
  })

  it('requires a completed Job without an active invoice before offering invoice creation', () => {
    const scheduledHtml = renderToStaticMarkup(createElement(V3JobWorkspace, { ...props, job: { ...job, status: 'scheduled' } }))
    const alreadyInvoicedHtml = renderToStaticMarkup(createElement(V3JobWorkspace, {
      ...props,
      job: { ...job, invoice_id: 'invoice-1' },
      invoices: [{ id: 'invoice-1', display_code: 'INV-001', invoice_number: '2026-001', job_id: 'job-1', client_id: 'client-1', issue_date: '2026-11-24', status: 'draft', subtotal: 100, tax_amount: 21, total: 121 }],
    }))

    expect(scheduledHtml).toContain('Editar servicio')
    expect(scheduledHtml).not.toContain('Crear factura')
    expect(alreadyInvoicedHtml).toContain('Ver factura')
    expect(alreadyInvoicedHtml).not.toContain('Crear factura')
  })
})
