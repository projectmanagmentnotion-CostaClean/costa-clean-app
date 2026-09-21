import { afterEach, describe, expect, it, vi } from 'vitest'
import type { InvoiceListItem } from './types'
import { renderInvoiceDocumentPdf } from './invoiceDomPdfExport'
import {
  buildInvoicePdfFile,
  buildInvoicePdfFileName,
  buildInvoicePdfBlob,
  downloadInvoicePdf,
  openInvoiceDocumentOutput,
} from './invoicePdfOutput'

vi.mock('./invoiceDomPdfExport', () => ({
  renderInvoiceDocumentPdf: vi.fn(async (invoice: InvoiceListItem) => new Blob([
    `%PDF-1.4\n${invoice.invoice_number}\n${invoice.client_name}\n/Type /Page\n%%EOF`,
  ], { type: 'application/pdf' })),
}))

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
    const blob = await buildInvoicePdfBlob(createInvoice())
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const text = new TextDecoder().decode(bytes)

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
    expect(blob.type).toBe('application/pdf')
    expect(blob.size).toBeGreaterThan(0)
    expect(text).toContain('2026-049')
    expect(text).toContain('Cliente existente')
    expect(text).toContain('/Type /Page')
  })

  it('keeps the historical Costa Clean filename and only removes filesystem-invalid characters', async () => {
    const invoice = createInvoice({
      invoice_number: '2026-069',
      client_name: 'COSTA DEL MARESME HOSPITALITY MNG, S.L / Centro',
    })
    const file = await buildInvoicePdfFile(invoice)

    expect(buildInvoicePdfFileName(invoice)).toBe('2026-069 - COSTA DEL MARESME HOSPITALITY MNG, S.L Centro - Factura CostaClean.pdf')
    expect(file.name).toBe(buildInvoicePdfFileName(invoice))
    expect(file.name.endsWith('.pdf')).toBe(true)
    expect(file.type).toBe('application/pdf')
    expect(new Uint8Array(await file.arrayBuffer()).slice(0, 5)).toEqual(new Uint8Array([37, 80, 68, 70, 45]))
  })

  it.each([
    ['2026-061', 'ALCAPA SPORT SL', '2026-061 - ALCAPA SPORT SL - Factura CostaClean.pdf'],
    ['2026-063', 'Miguel Angel Flores Castillo', '2026-063 - Miguel Angel Flores Castillo - Factura CostaClean.pdf'],
    ['2026-069', 'COSTA DEL MARESME HOSPITALITY MNG, S.L', '2026-069 - COSTA DEL MARESME HOSPITALITY MNG, S.L - Factura CostaClean.pdf'],
  ])('uses the Costa Clean filename for %s', (invoiceNumber, clientName, expectedFileName) => {
    expect(buildInvoicePdfFileName(createInvoice({ invoice_number: invoiceNumber, client_name: clientName }))).toBe(expectedFileName)
  })

  it('uses InvoiceDocumentA4 as the visual PDF source', () => {
    expect(renderInvoiceDocumentPdf).toBeTypeOf('function')
    expect(buildInvoicePdfBlob.toString()).toContain('renderInvoiceDocumentPdf')
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
    const sharedFile = share.mock.calls[0][0].files[0]
    expect(sharedFile).toBeInstanceOf(File)
    expect(sharedFile.type).toBe('application/pdf')
    expect(sharedFile.name).toBe('2026-049 - Cliente existente - Factura CostaClean.pdf')
    expect(new Uint8Array(await sharedFile.arrayBuffer()).slice(0, 5)).toEqual(new Uint8Array([37, 80, 68, 70, 45]))
    expect(open).not.toHaveBeenCalled()
    expect(createObjectURL).not.toHaveBeenCalled()

    share.mockRejectedValueOnce(new DOMException('The request was aborted.', 'AbortError'))

    await expect(openInvoiceDocumentOutput(invoice, 'pdf')).resolves.toBe('cancelled')
  })
})
