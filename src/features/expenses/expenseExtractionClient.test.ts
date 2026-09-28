import { describe, expect, it } from 'vitest'
import { createExpenseExtractionClient } from './expenseExtractionClient'
import type { DocumentExtractionProvider } from './expenseExtractionProvider'

const input = { captureDocumentId: 'doc-1', captureSessionId: 'session-1', originalFilename: 'photo.png', mimeType: 'image/png', sizeBytes: 10, sha256: 'a'.repeat(64) }

const provider = (result: Awaited<ReturnType<DocumentExtractionProvider['extractDocument']>>): DocumentExtractionProvider => ({
  metadata: { provider: 'fixture', providerVersion: 'test', model: null },
  extractDocument: async () => result,
})

describe('N5.2 extraction client boundary', () => {
  it('fails closed in the ordinary product runtime', async () => {
    const result = await createExpenseExtractionClient({ allowFixture: false }).requestExtraction(input)
    expect(result).toMatchObject({ ok: false, errorCode: 'EXTRACTION_RUNTIME_NOT_CONFIGURED' })
  })

  it.each([
    ['timeout', { ok: false, errorCode: 'EXTRACTION_TIMEOUT', errorMessageSafe: 'Tiempo de espera agotado.', metadata: { provider: 'fixture', providerVersion: 'test', model: null } }],
    ['invalid response', { ok: false, errorCode: 'INVALID_PROVIDER_RESPONSE', errorMessageSafe: 'La respuesta no es válida.', metadata: { provider: 'fixture', providerVersion: 'test', model: null } }],
    ['unsupported document', { ok: false, errorCode: 'UNSUPPORTED_DOCUMENT', errorMessageSafe: 'Documento no compatible.', metadata: { provider: 'fixture', providerVersion: 'test', model: null } }],
  ])('propagates safe provider failure: %s', async (_label, result) => {
    const response = await createExpenseExtractionClient({ provider: provider(result as never) }).requestExtraction(input)
    expect(response).toEqual(result)
    expect(JSON.stringify(response)).not.toContain('stack')
  })

  it('converts provider exceptions into a safe failure without creating financial records', async () => {
    const throwingProvider: DocumentExtractionProvider = { metadata: { provider: 'fixture', providerVersion: 'test', model: null }, extractDocument: async () => { throw new Error('private stack') } }
    const response = await createExpenseExtractionClient({ provider: throwingProvider }).requestExtraction(input)
    expect(response).toMatchObject({ ok: false, errorCode: 'EXTRACTION_FAILED', errorMessageSafe: 'No se pudo completar la extracción documental.' })
    expect(JSON.stringify(response)).not.toContain('private stack')
    expect(JSON.stringify(response)).not.toMatch(/financial|supplier|payment|invoice/i)
  })
})
