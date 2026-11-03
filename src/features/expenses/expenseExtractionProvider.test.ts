import { describe, expect, it } from 'vitest'
import { createFixtureExtractionProvider } from './expenseExtractionProvider'

const input = { captureDocumentId: 'doc-1', captureSessionId: 'session-1', originalFilename: 'fixture-invoice.png', mimeType: 'image/png', sizeBytes: 10, sha256: 'a'.repeat(64) }

describe('N5.2 fixture provider', () => {
  it('returns a deterministic supplier-aware multi-field proposal without financial writes', async () => {
    const result = await createFixtureExtractionProvider().extractDocument(input)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.metadata.provider).toBe('fixture')
      expect(result.proposal.supplier.rawName.value).toBe('SUMINISTROS COSTA TEST S.L.')
      expect(result.proposal.supplier.taxId.rawValue).toContain('B-12345674')
      expect(result.proposal.invoice.number.value).toBe('TEST-2026-001')
      expect(result.proposal.vatLines).toHaveLength(2)
      expect(result.proposal.supplier.address.value).toBeNull()
      expect(result.proposal.amounts.gross.value).toBe('176.00')
    }
  })

  it('fails closed for non-fixture documents instead of pretending to perform OCR', async () => {
    const result = await createFixtureExtractionProvider().extractDocument({ ...input, originalFilename: 'photo.png' })
    expect(result).toMatchObject({ ok: false, errorCode: 'UNSUPPORTED_DOCUMENT' })
  })
})
