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

function withWindowSearch<T>(search: string, run: () => T): T {
  const originalWindow = globalThis.window

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location: { search },
    },
  })

  try {
    return run()
  } finally {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    })
  }
}

describe('InvoicesPage fiscal control', () => {
  it('hides fiscal and numbering controls in the normal invoices view', () => {
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

    expect(html.includes('Debug fiscal')).toBe(false)
    expect(html.includes('Control de numeracion')).toBe(false)
    expect(html.includes('Revisar secuencia')).toBe(false)
  })

  it('shows fiscal debug data and numbering control only with debugInvoiceFiscal=1', () => {
    const invoices = [
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
    ]
    const clients = [
      createClient(),
      createClient({ id: 'client-2', full_name: 'Cliente Bloqueado', tax_id: null, billing_address: null }),
    ]

    const debugHtml = withWindowSearch('?debugInvoiceFiscal=1', () => renderInvoicesPage(invoices, clients))
    expect(debugHtml.includes('Debug fiscal')).toBe(true)
    expect(debugHtml.includes('Control de numeracion')).toBe(true)
    expect(debugHtml.includes('&quot;canRunBackfill&quot;: true')).toBe(true)
    expect(debugHtml.includes('&quot;complete&quot;: 1')).toBe(true)
    expect(debugHtml.includes('&quot;repairable&quot;: 1')).toBe(true)
    expect(debugHtml.includes('&quot;blocked&quot;: 1')).toBe(true)

    const plainHtml = withWindowSearch('?debugBuild=1', () => renderInvoicesPage(invoices, clients))
    expect(plainHtml.includes('Debug fiscal')).toBe(false)
    expect(plainHtml.includes('Control de numeracion')).toBe(false)
    expect(plainHtml.includes('&quot;canRunBackfill&quot;: true')).toBe(false)
  })

  it('shows the regularization hint only inside fiscal debug mode', () => {
    const invoices = [
      createInvoice({ id: 'invoice-45', display_code: 'INV-0045', invoice_number: '2026-045' }),
      createInvoice({ id: 'invoice-51', display_code: 'INV-0051', invoice_number: '2026-051' }),
    ]
    const clients = [createClient()]

    const normalHtml = renderInvoicesPage(invoices, clients)
    expect(normalHtml.includes('INV-0051 puede regularizarse a INV-0046 / 2026-046 si todavia no fue enviada.')).toBe(false)

    const debugHtml = withWindowSearch('?debugInvoiceFiscal=1', () => renderInvoicesPage(invoices, clients))
    expect(debugHtml.includes('INV-0051 puede regularizarse a INV-0046 / 2026-046 si todavia no fue enviada.')).toBe(true)
  })
})

describe('InvoicesPage document actions', () => {
  it('keeps document and payment actions available together for an issued pending invoice', () => {
    const invoice = createInvoice({
      payment_status: 'pending',
      paid_amount: 0,
      outstanding_amount: 121,
    })

    const html = renderInvoicesPage([invoice], [createClient()])

    expect(html.includes('Abrir documento')).toBe(true)
    expect(html.includes('Registrar cobro')).toBe(true)
    expect(invoice.payment_status).toBe('pending')
    expect(invoice.paid_amount).toBe(0)
    expect(invoice.outstanding_amount).toBe(121)
  })

  it('keeps document and another payment available for a partially paid invoice', () => {
    const html = renderInvoicesPage([
      createInvoice({
        payment_status: 'partially_paid',
        paid_amount: 40,
        outstanding_amount: 81,
      }),
    ], [createClient()])

    expect(html.includes('Abrir documento')).toBe(true)
    expect(html.includes('Registrar cobro')).toBe(true)
  })

  it('keeps document access for paid and cancelled historical invoices', () => {
    const paidHtml = renderInvoicesPage([
      createInvoice({
        payment_status: 'paid',
        paid_amount: 121,
        outstanding_amount: 0,
      }),
    ], [createClient()])
    const cancelledHtml = renderInvoicesPage([
      createInvoice({
        status: 'cancelled',
        payment_status: 'cancelled',
        outstanding_amount: 0,
      }),
    ], [createClient()])

    expect(paidHtml.includes('Abrir documento')).toBe(true)
    expect(cancelledHtml.includes('Abrir documento')).toBe(true)
  })

  it('offers an explicit document preview for drafts', () => {
    const html = renderInvoicesPage([
      createInvoice({
        status: 'draft',
        invoice_number: null,
        payment_status: 'pending',
      }),
    ], [createClient()])

    expect(html.includes('Previsualizar documento')).toBe(true)
  })
})
