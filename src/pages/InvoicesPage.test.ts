import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { InvoicesPage } from './InvoicesPage'
import type { ClientListItem } from '../features/clients/types'
import type { InvoiceListItem } from '../features/invoices/types'

function createClient(overrides: Partial<ClientListItem> = {}): ClientListItem {
  return {
    id: 'client-1',
    display_code: 'CLI-001',
    full_name: 'Cliente Fiscal',
    phone: null,
    email: 'cliente@example.com',
    tax_id: 'B12345678',
    billing_address: 'Calle Mayor 1',
    status: 'active',
    source_lead_id: null,
    ...overrides,
  }
}

function createInvoice(overrides: Partial<InvoiceListItem> = {}): InvoiceListItem {
  return {
    id: 'invoice-1',
    display_code: 'INV-001',
    invoice_number: '2026-001',
    job_id: null,
    quote_id: null,
    client_id: 'client-1',
    client_name: 'Cliente Fiscal',
    issue_date: '2026-07-02',
    status: 'issued',
    subtotal: 100,
    tax_amount: 21,
    total: 121,
    pricing_metadata: null,
    ...overrides,
  }
}

function renderInvoicesPage(invoices: InvoiceListItem[], clients: ClientListItem[]) {
  return renderToStaticMarkup(createElement(InvoicesPage, {
    invoices,
    allInvoices: invoices,
    clients,
    properties: [],
    jobs: [],
    quotes: [],
    expenses: [],
    payments: [],
    error: null,
    onInvoiceCreated: async () => {},
    onViewPayments: () => {},
    onOpenJobWorkspace: () => {},
    onOpenClientWorkspace: () => {},
    onOpenPropertyWorkspace: () => {},
    onOpenQuoteDetail: () => {},
    createPrefill: null,
    onPrefillConsumed: () => {},
    activeFilterLabel: null,
    onClearFilter: () => {},
  }))
}

describe('InvoicesPage fiscal control', () => {
  it('renders the fiscal control panel with actionable counts', () => {
    const html = renderInvoicesPage(
      [
        createInvoice({
          id: 'invoice-complete',
          pricing_metadata: {
            client_fiscal_snapshot: {
              client_id: 'client-1',
              fiscal_name: 'Cliente Fiscal',
              tax_id: 'B12345678',
              billing_address: 'Calle Mayor 1',
              captured_at: '2026-07-02T10:00:00.000Z',
              source: 'client_record',
            },
          },
        }),
        createInvoice({ id: 'invoice-reparable', display_code: 'INV-002', invoice_number: '2026-002' }),
        createInvoice({
          id: 'invoice-blocked',
          display_code: 'INV-003',
          invoice_number: '2026-003',
          client_id: 'client-2',
          client_name: 'Cliente Bloqueado',
        }),
      ],
      [
        createClient(),
        createClient({ id: 'client-2', full_name: 'Cliente Bloqueado', tax_id: null, billing_address: null }),
      ],
    )

    expect(html.includes('Control fiscal de facturas')).toBe(true)
    expect(html.includes('Completas: 1')).toBe(true)
    expect(html.includes('Reparables desde cliente: 1')).toBe(true)
    expect(html.includes('Incompletas: 1')).toBe(true)
    expect(html.includes('Completar reparables')).toBe(true)
    expect(html.includes('Revisar incompletas')).toBe(true)
  })

  it('shows the debug JSON only with debugInvoiceFiscal=1', () => {
    const originalWindow = globalThis.window
    const invoices = [createInvoice()]
    const clients = [createClient()]

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: { search: '?debugInvoiceFiscal=1' },
      },
    })
    const debugHtml = renderInvoicesPage(invoices, clients)
    expect(debugHtml.includes('&quot;canRunBackfill&quot;: true')).toBe(true)
    expect(debugHtml.includes('&quot;repairable&quot;: 1')).toBe(true)

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: { search: '?debugBuild=1' },
      },
    })
    const plainHtml = renderInvoicesPage(invoices, clients)
    expect(plainHtml.includes('&quot;canRunBackfill&quot;: true')).toBe(false)

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    })
  })

  it('renders a generic regularization hint for the first post-gap invoice', () => {
    const html = renderInvoicesPage(
      [
        createInvoice({ id: 'invoice-45', display_code: 'INV-0045', invoice_number: '2026-045' }),
        createInvoice({ id: 'invoice-51', display_code: 'INV-0051', invoice_number: '2026-051' }),
      ],
      [createClient()],
    )

    expect(html.includes('INV-0051 puede regularizarse a INV-0046 / 2026-046 si todavia no fue enviada.')).toBe(true)
  })
})
