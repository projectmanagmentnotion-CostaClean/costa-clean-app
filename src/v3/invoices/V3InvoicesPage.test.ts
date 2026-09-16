import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { V3InvoicesPage } from './V3InvoicesPage'
import { getInvoiceFinancialFacts, getInvoiceSettlementDescription } from './invoicePresentation'
import type { InvoiceListItem } from '../../features/invoices/types'

function createInvoice(overrides: Partial<InvoiceListItem> = {}): InvoiceListItem {
  return {
    id: 'invoice-1', display_code: 'FAC-2026-052', invoice_number: '2026-052', job_id: null, client_id: 'client-1', client_name: 'Hotel Las Vegas', issue_date: '2026-07-31', status: 'issued', subtotal: 1029.42, tax_amount: 217.18, total: 1246.60, payment_status: 'pending', outstanding_amount: 1246.60, service_description: 'Limpieza mensual', ...overrides,
  }
}

function renderPage(invoices: InvoiceListItem[], initialInvoiceId?: string) {
  return renderToStaticMarkup(createElement(V3InvoicesPage, {
    invoices, allInvoices: invoices, clients: [], payments: [], error: null, initialInvoiceId,
    onCreateInvoice: () => {}, onDownloadInvoice: () => {}, onSettleInvoice: () => {}, isInvoiceSettling: () => false, onOpenDocument: () => {}, onViewPayments: () => {}, onOpenInvoiceDeepLink: () => {}, onBackToInvoiceList: () => {},
  }))
}

describe('V3 dedicated invoice tree', () => {
  it('renders the new flat invoice structure without legacy visual wrappers', () => {
    const html = renderPage([createInvoice()])
    expect(html).toContain('v3-invoices-page')
    expect(html).toContain('v3-invoice-row__main')
    expect(html).toContain('Facturas')
    expect(html).toContain('Filtros')
    expect(html).not.toContain('cc-master-layout')
    expect(html).not.toContain('cc-record-card')
    expect(html).not.toContain('OperationalListItem')
  })

  it('renders a full-screen workspace with real invoice sections', () => {
    const html = renderPage([createInvoice()])
    const workspace = renderPage([createInvoice()], 'invoice-1')
    expect(html).toContain('Registrar cobro')
    expect(html).toContain('Cobrado 0,00')
    expect(html).toContain('Pendiente 1246,60')
    expect(workspace).toContain('Resumen financiero')
    expect(workspace).toContain('Más acciones')
    expect(workspace).toContain('Descargar PDF')
    expect(workspace).toContain('Resumen')
    expect(workspace).toContain('Origen')
    expect(workspace).toContain('Líneas')
    expect(workspace).toContain('Cobros')
    expect(workspace).toContain('Documento')
  })

  it('keeps the invoice amount hierarchy and transfer confirmation tied to the existing outstanding value', () => {
    const invoice = createInvoice({ payment_status: 'partially_paid', paid_amount: 400, outstanding_amount: 846.60 })

    expect(getInvoiceFinancialFacts(invoice)).toMatchObject({
      total: 1246.60,
      paid: 400,
      outstanding: 846.60,
      status: 'partially_paid',
      settlementAllowed: true,
    })
    expect(getInvoiceSettlementDescription(invoice)).toContain('cobro por transferencia de 846,60')
    expect(getInvoiceSettlementDescription(invoice)).toContain('Ya cobrado: 400,00')
    expect(getInvoiceSettlementDescription(invoice)).toContain('contrato financiero')
  })

  it('does not offer transfer settlement for a terminal financial state but explains its availability', () => {
    const workspace = renderPage([createInvoice({ payment_status: 'paid', paid_amount: 1246.60, outstanding_amount: 0 })], 'invoice-1')

    expect(workspace).toContain('El cobro por transferencia no está disponible para esta factura.')
    expect(workspace).not.toContain('>Registrar cobro<')
  })

  it('does not render Unicode icons or technical UUIDs in user-facing invoice markup', () => {
    const html = renderPage([createInvoice({ id: 'e1643c33-ae20-48cd-a2c7-99fd41184533', display_code: null, invoice_number: null, client_id: 'client-1', client_name: null })])
    expect(html).not.toContain('←')
    expect(html).not.toContain('⌄')
    expect(html).not.toMatch(/[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}/i)
  })
})
