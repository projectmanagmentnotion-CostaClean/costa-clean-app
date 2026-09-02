import { afterEach, describe, expect, it, vi } from 'vitest'
import type { InvoiceListItem } from './types'
import {
  buildInvoicePdfBlob,
  downloadInvoicePdf,
  openInvoiceDocumentOutput,
} from './invoicePdfOutput'

function createInvoice(overrides: Partial<InvoiceListItem> = {}): InvoiceListItem {
  return {
    id: 'invoice-1',
    display_code: 'INV-0049',
    invoice_number: '2026-049',
    job_id: null,
    quote_id: null,
    client_id: 'client-1',
    client_name: 'Cliente existente',
    issue_date: '2026-07-01',
    status: 'issued',
    subtotal: 100,
    tax_amount: 21,
    total: 121,
    notes: 'Observacion de prueba',
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

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('invoice pdf output', () => {
  it('builds a real PDF blob for the invoice document', async () => {
    const blob = buildInvoicePdfBlob(createInvoice())
    const text = await blob.text()

    expect(text.startsWith('%PDF-1.4')).toBe(true)
    expect(text).toContain('2026-049')
    expect(text).toContain('Cliente existente')
    expect(text).toContain('/Type /Page')
  })

  it('downloads the invoice PDF without opening a new window in normal browsers', async () => {
    const invoice = createInvoice()
    const createObjectURL = vi.fn(() => 'blob:invoice-pdf')
    const revokeObjectURL = vi.fn()
    const click = vi.fn()
    const remove = vi.fn()
    const appendChild = vi.fn()
    const open = vi.fn(() => null)

    vi.stubGlobal('window', {
      open,
      setTimeout,
    })
    vi.stubGlobal('document', {
      body: {
        appendChild,
      },
      createElement: vi.fn(() => ({
        href: '',
        download: '',
        rel: '',
        style: { display: '' },
        click,
        remove,
      })),
    })
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL,
    })

    const result = await downloadInvoicePdf(invoice)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(result).toBe('downloaded')
    expect(open).not.toHaveBeenCalled()
    expect(click).toHaveBeenCalledOnce()
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledOnce()
  })

  it('shares the PDF on iOS standalone and treats cancel as a quiet exit', async () => {
    const invoice = createInvoice()
    const share = vi.fn().mockResolvedValue(undefined)
    const canShare = vi.fn().mockReturnValue(true)
    const createObjectURL = vi.fn(() => 'blob:invoice-pdf')
    const open = vi.fn(() => null)

    vi.stubGlobal('window', {
      open,
      setTimeout,
      matchMedia: vi.fn(() => ({
        matches: true,
        media: '(display-mode: standalone)',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    })
    vi.stubGlobal('navigator', {
      standalone: true,
      share,
      canShare,
    })
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL: vi.fn(),
    })

    const sharedResult = await downloadInvoicePdf(invoice)

    expect(sharedResult).toBe('shared')
    expect(share).toHaveBeenCalledOnce()
    expect(canShare).toHaveBeenCalledOnce()
    expect(open).not.toHaveBeenCalled()
    expect(createObjectURL).not.toHaveBeenCalled()

    share.mockRejectedValueOnce(new DOMException('The request was aborted.', 'AbortError'))

    await expect(openInvoiceDocumentOutput(invoice, 'pdf')).resolves.toBe('cancelled')
  })
})
