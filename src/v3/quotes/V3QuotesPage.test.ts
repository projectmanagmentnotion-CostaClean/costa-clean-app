import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { V3QuotesPage } from './V3QuotesPage'

const quote = { id: 'quote-1', display_code: 'PRES-0001', client_id: 'client-1', lead_id: null, property_id: null, status: 'accepted', invoice_id: null, subtotal: 100, tax_amount: 21, total: 121, lines: [{ id: 'line-1', quote_id: 'quote-1', sort_order: 0, concept: 'Limpieza', quantity: 1, unit: 'servicio', unit_price: 100, line_subtotal: 100 }] }

describe('V3QuotesPage', () => {
  it('renders a flat quote row with real document actions', () => {
    const html = renderToStaticMarkup(createElement(V3QuotesPage, { quotes: [quote], allQuotes: [quote], clients: [{ id: 'client-1', display_code: 'CLI-0001', full_name: 'Elena Vázquez', phone: null, email: null, tax_id: null, billing_address: null, status: 'active', source_lead_id: null }], properties: [], jobs: [], invoices: [], error: null, onCreateQuote: () => undefined, onDownloadQuote: () => undefined, onShareQuote: async () => undefined, onConvertQuote: async () => null, onOpenClientWorkspace: () => undefined, onOpenPropertyWorkspace: () => undefined, onOpenJobWorkspace: () => undefined, onOpenInvoiceDetail: () => undefined, onOpenQuoteDeepLink: () => undefined, onBackToQuoteList: () => undefined }))
    expect(html).toContain('PRES-0001')
    expect(html).toContain('Descargar')
    expect(html).toContain('Facturar')
    expect(html).not.toContain('OperationalListItem')
  })
})
