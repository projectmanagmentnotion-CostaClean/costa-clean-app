import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { V3ClientsPage } from './V3ClientsPage'

const client = { id: 'client-1', display_code: 'CLI-0001', full_name: 'Elena Vázquez', phone: '600123456', email: 'elena@example.com', tax_id: null, billing_address: null, status: 'active', source_lead_id: null }

describe('V3ClientsPage', () => {
  it('renders a flat real-data list and contact actions', () => {
    const html = renderToStaticMarkup(createElement(V3ClientsPage, { clients: [client], properties: [], jobs: [], quotes: [], invoices: [], payments: [], recurringInvoicePlans: [], error: null, onCreateInvoiceForClient: () => undefined, onCreateQuoteForClient: () => undefined, onOpenPropertyWorkspace: () => undefined, onOpenJobWorkspace: () => undefined, onOpenQuoteDetail: () => undefined, onOpenInvoiceDetail: () => undefined }))
    expect(html).toContain('Elena Vázquez')
    expect(html).toContain('WhatsApp')
    expect(html).toContain('tel:+34600123456')
    expect(html).not.toContain('OperationalListItem')
  })
})
