import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildQuotePdfFileName } from './quotePdfOutput'
import { downloadQuotePdf } from './quotePdfOutput'
import type { ClientListItem } from '../clients/types'
import type { QuoteListItem } from './types'

vi.mock('./quoteDomPdfExport', () => ({
  renderQuoteDocumentPdf: vi.fn(async () => new Blob(['%PDF-1.4\n%%EOF'], { type: 'application/pdf' })),
}))

const quote = {
  id: 'quote-1',
  display_code: 'PRE-0042',
  client_id: 'client-1',
} as QuoteListItem

const client = {
  id: 'client-1',
  full_name: 'Cliente: "Ágil" / BCN',
} as ClientListItem

describe('buildQuotePdfFileName', () => {
  it('uses the reference and a filesystem-safe client name', () => {
    expect(buildQuotePdfFileName(quote, [client])).toBe('PRE-0042 - Cliente Ágil BCN - Presupuesto CostaClean.pdf')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('downloads the quote PDF through the shared file delivery contract', async () => {
    const createObjectURL = vi.fn(() => 'blob:quote-pdf')
    const revokeObjectURL = vi.fn()
    const click = vi.fn()
    const remove = vi.fn()
    const appendChild = vi.fn()

    vi.stubGlobal('window', { setTimeout })
    vi.stubGlobal('document', {
      body: { appendChild },
      createElement: vi.fn(() => ({
        href: '',
        download: '',
        rel: '',
        style: { display: '' },
        click,
        remove,
      })),
    })
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })

    await expect(downloadQuotePdf(quote, [client], [])).resolves.toBe('downloaded')
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(appendChild).toHaveBeenCalledOnce()
  })
})
