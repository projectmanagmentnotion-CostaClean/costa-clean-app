import { afterEach, describe, expect, it, vi } from 'vitest'
import type { InvoiceListItem } from './types'
import {
  buildInvoicePrintDocumentHtml,
  openInvoicePrintWindow,
} from './openInvoicePrintWindow'
import { openInvoiceDocumentOutput } from '../documents/documentOutputRuntime'

function createExistingInvoice(overrides: Partial<InvoiceListItem> = {}): InvoiceListItem {
  return {
    id: 'invoice-existing',
    display_code: 'INV-0049',
    invoice_number: '2026-049',
    job_id: null,
    quote_id: null,
    client_id: 'client-existing',
    client_name: 'Cliente existente',
    issue_date: '2026-07-01',
    status: 'issued',
    payment_status: 'pending',
    subtotal: 100,
    tax_amount: 21,
    total: 121,
    service_description: 'Servicio historico',
    billing_concept: 'Servicio historico',
    billing_quantity: 1,
    billing_unit: 'servicio',
    billing_unit_price: 100,
    pricing_metadata: null,
    ...overrides,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('invoice document output', () => {
  it('builds the correct downloadable document for an existing unpaid invoice without persisted lines', () => {
    const html = buildInvoicePrintDocumentHtml(createExistingInvoice(), 'pdf')

    expect(html).toContain('2026-049')
    expect(html).toContain('Cliente existente')
    expect(html).toContain('Servicio de limpieza')
    expect(html).toContain('window.print()')
  })

  it('opens the correct unpaid invoice without changing its payment state', () => {
    const invoice = createExistingInvoice()
    const documentOpen = vi.fn()
    const documentWrite = vi.fn()
    const documentClose = vi.fn()

    vi.stubGlobal('window', {
      open: vi.fn(() => ({
        document: {
          open: documentOpen,
          write: documentWrite,
          close: documentClose,
        },
      })),
    })

    const didOpen = openInvoicePrintWindow(invoice, 'pdf')

    expect(didOpen).toBe(true)
    expect(documentOpen).toHaveBeenCalledOnce()
    expect(documentWrite).toHaveBeenCalledOnce()
    expect(String(documentWrite.mock.calls[0][0])).toContain('2026-049')
    expect(String(documentWrite.mock.calls[0][0])).toContain('Cliente existente')
    expect(documentClose).toHaveBeenCalledOnce()
    expect(invoice.payment_status).toBe('pending')
  })

  it('reports a blocked output window without rejecting shared consumers', async () => {
    const alert = vi.fn()
    vi.stubGlobal('window', {
      open: vi.fn(() => null),
      alert,
    })

    expect(openInvoicePrintWindow(createExistingInvoice(), 'pdf')).toBe(false)
    expect(alert).toHaveBeenCalledOnce()
    await expect(openInvoiceDocumentOutput(createExistingInvoice(), 'pdf')).resolves.toBe(false)
  })
})
