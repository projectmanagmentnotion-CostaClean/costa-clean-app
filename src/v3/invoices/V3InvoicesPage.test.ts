import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { V3InvoicesPage } from './V3InvoicesPage'
import type { InvoiceListItem } from '../../features/invoices/types'

function createInvoice(overrides: Partial<InvoiceListItem> = {}): InvoiceListItem {
  return {
    id: 'invoice-1', display_code: 'FAC-2026-052', invoice_number: '2026-052', job_id: null, client_id: 'client-1', client_name: 'Hotel Las Vegas', issue_date: '2026-07-31', status: 'issued', subtotal: 1029.42, tax_amount: 217.18, total: 1246.60, payment_status: 'pending', outstanding_amount: 1246.60, service_description: 'Limpieza mensual', ...overrides,
  }
}

function renderPage(invoices: InvoiceListItem[], initialInvoiceId?: string) {
  return renderToStaticMarkup(createElement(V3InvoicesPage, {
    invoices, allInvoices: invoices, clients: [], payments: [], error: null, initialInvoiceId,
    onCreateInvoice: () => {}, onDownloadInvoice: () => {}, onSettleInvoice: () => {}, isInvoiceSettling: () => false, onOpenDocument: () => {}, onViewPayments: () => {},
  }))
}

describe('V3 dedicated invoice tree', () => {
  it('renders the new flat invoice structure without legacy visual wrappers', () => {
    const html = renderPage([createInvoice()])
    expect(html).toContain('v3-invoices-page')
    expect(html).toContain('v3-invoice-row__main')
    expect(html).toContain('Facturas')
    expect(html).not.toContain('cc-master-layout')
    expect(html).not.toContain('cc-record-card')
    expect(html).not.toContain('OperationalListItem')
  })

  it('renders a full-screen workspace with real invoice sections', () => {
    const html = renderPage([createInvoice()])
    const workspace = renderPage([createInvoice()], 'invoice-1')
    expect(html).toContain('Marcar pagada')
    expect(workspace).toContain('Resumen')
    expect(workspace).toContain('Origen')
    expect(workspace).toContain('Líneas')
    expect(workspace).toContain('Cobros')
    expect(workspace).toContain('Documento')
  })
})
