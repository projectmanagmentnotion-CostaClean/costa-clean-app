import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { InvoiceDocumentA4 } from './InvoiceDocumentA4'
import type { InvoiceListItem } from './types'

function createInvoice(overrides: Partial<InvoiceListItem> = {}): InvoiceListItem {
  return {
    id: 'invoice-1',
    display_code: 'INV-001',
    invoice_number: '2026-001',
    job_id: null,
    quote_id: null,
    client_id: 'client-1',
    client_name: 'Miguel Angel Flores Novoa',
    client_email: 'miguel@example.com',
    issue_date: '2026-07-01',
    status: 'issued',
    subtotal: 100,
    tax_amount: 21,
    total: 121,
    notes: null,
    internal_notes: null,
    pricing_metadata: null,
    lines: [
      {
        id: 'line-1',
        invoice_id: 'invoice-1',
        sort_order: 1,
        concept: 'Limpieza general',
        quantity: 1,
        unit: 'servicio',
        unit_price: 100,
        line_subtotal: 100,
      },
    ],
    ...overrides,
  }
}

describe('InvoiceDocumentA4', () => {
  it('renders NIF/CIF from the fiscal snapshot with an explicit label', () => {
    const html = renderToStaticMarkup(
      <InvoiceDocumentA4
        invoice={createInvoice({
          pricing_metadata: {
            client_fiscal_snapshot: {
              client_id: 'client-1',
              fiscal_name: 'Miguel Angel Flores Novoa',
              tax_id: '45962701F',
              billing_address: 'Avinguda de Lloret de Dalt, 10',
            },
          },
        })}
      />,
    )

    expect(html.includes('NIF/CIF: 45962701F')).toBe(true)
    expect(html.includes('<p>45962701F</p>')).toBe(false)
  })

  it('renders the client name from snapshot.name when fiscal_name is absent', () => {
    const html = renderToStaticMarkup(
      <InvoiceDocumentA4
        invoice={createInvoice({
          pricing_metadata: {
            client_fiscal_snapshot: {
              client_id: 'client-1',
              name: 'Nombre fiscal desde name',
              tax_id: '45962701F',
              billing_address: 'Avinguda de Lloret de Dalt, 10',
            },
          },
        })}
      />,
    )

    expect(html.includes('Nombre fiscal desde name')).toBe(true)
  })

  it('renders the fiscal invoice number in the document title', () => {
    const html = renderToStaticMarkup(
      <InvoiceDocumentA4 invoice={createInvoice({ invoice_number: '2026-069' })} />,
    )

    expect(html).toContain('<h1>FACTURA 2026-069</h1>')
  })

  it('marks PDF rendering explicitly so responsive screen rules cannot redefine the A4 layout', () => {
    const html = renderToStaticMarkup(
      <InvoiceDocumentA4 invoice={createInvoice()} variant="embedded" renderMode="pdf" />,
    )

    expect(html).toContain('cc-invoice-a4--embedded cc-invoice-a4--pdf')
  })
})
