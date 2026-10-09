import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function source(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
}

describe('V3 document preview source parity', () => {
  it('keeps invoice and quote preview adapters on the canonical A4 renderers', () => {
    const invoicePreview = source('v3/invoices/V3InvoiceDocumentPreview.tsx')
    const quotePreview = source('v3/quotes/V3QuoteDocumentPreview.tsx')
    const invoicePdf = source('features/invoices/invoiceDomPdfExport.tsx')
    const quotePdf = source('features/quotes/quoteDomPdfExport.tsx')

    expect(invoicePreview).toContain("from '../../features/invoices/InvoiceDocumentA4'")
    expect(quotePreview).toContain("from '../../features/quotes/QuoteDocumentA4'")
    expect(invoicePreview).toContain("from '../documents/V3DocumentPreview'")
    expect(quotePreview).toContain("from '../documents/V3DocumentPreview'")
    expect(invoicePdf).toContain('<InvoiceDocumentA4')
    expect(quotePdf).toContain('<QuoteDocumentA4')
    expect(invoicePreview).not.toContain('InvoicePreviewCard')
    expect(quotePreview).not.toContain('QuotePreviewCard')
  })

  it('keeps the PDF dependencies lazy and the pagination primitive shared', () => {
    const invoicePdf = source('features/invoices/invoiceDomPdfExport.tsx')
    const quotePdf = source('features/quotes/quoteDomPdfExport.tsx')

    expect(invoicePdf).toContain("import('html2canvas')")
    expect(invoicePdf).toContain("import('jspdf')")
    expect(quotePdf).toContain("import('html2canvas')")
    expect(quotePdf).toContain("import('jspdf')")
    expect(invoicePdf).toContain('addCanvasToA4Pdf')
    expect(quotePdf).toContain('addCanvasToA4Pdf')
  })
})
