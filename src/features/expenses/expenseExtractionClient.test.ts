import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createExpenseExtractionClient } from './expenseExtractionClient'
import { createLocalFixtureExtractionClient, validateProviderResult } from './expenseExtractionFixtureClient'
import type { DocumentExtractionProvider } from './expenseExtractionProvider'
import type { ExtractionProviderResult } from './expenseExtractionContract'

vi.mock('../../lib/supabase', () => ({
  getSupabaseClient: () => ({ client: null, error: 'test runtime is not configured' }),
}))

const input = { captureDocumentId: 'doc-1', captureSessionId: 'session-1', originalFilename: 'photo.png', mimeType: 'image/png', sizeBytes: 10, sha256: 'a'.repeat(64) }
const fakeProvider = (result: ExtractionProviderResult): DocumentExtractionProvider => ({ metadata: { provider: 'fixture', providerVersion: 'test', model: null }, extractDocument: async () => result })

describe('N5.2 extraction client boundary', () => {
  it('cannot activate or inject the local implementation', () => {
    const source = readFileSync(new URL('./expenseExtractionClient.ts', import.meta.url), 'utf8')
    expect(source).not.toContain('allowFixture')
    expect(source).not.toContain('createFixtureExtractionProvider')
    expect(source).not.toContain('DocumentExtractionProvider')
    expect(source).not.toContain("'fixture'")
  })

  it('fails closed in the ordinary product runtime', async () => {
    const client = createExpenseExtractionClient()
    expect(client).not.toHaveProperty('provider')
    const result = await client.requestExtraction(input)
    expect(result).toEqual({ ok: false, errorCode: 'EXTRACTION_RUNTIME_NOT_CONFIGURED', errorMessageSafe: 'La extracción documental no está configurada en este entorno.', metadata: null })
  })

  it.each([
    ['unavailable', { ok: false, errorCode: 'EXTRACTION_PROVIDER_UNAVAILABLE', errorMessageSafe: 'Proveedor no disponible.', metadata: null }],
    ['timeout', { ok: false, errorCode: 'EXTRACTION_TIMEOUT', errorMessageSafe: 'Tiempo de espera agotado.', metadata: null }],
    ['invalid response', { ok: false, errorCode: 'INVALID_PROVIDER_RESPONSE', errorMessageSafe: 'La respuesta no es válida.', metadata: null }],
    ['unsupported document', { ok: false, errorCode: 'UNSUPPORTED_DOCUMENT', errorMessageSafe: 'Documento no compatible.', metadata: null }],
  ])('propagates safe provider failure: %s', async (_label, result) => {
    const response = await createLocalFixtureExtractionClient(fakeProvider(result as ExtractionProviderResult)).requestExtraction(input)
    expect(response).toEqual(result)
    expect(JSON.stringify(response)).not.toContain('stack')
  })

  it('rejects malformed successful responses and keeps exception failures safe', async () => {
    const malformed = validateProviderResult({ ok: true, extractionId: 'extraction-1', attempt: 1, proposal: { schemaVersion: 1 } as never, metadata: { provider: 'fixture', providerVersion: 'test', model: null } })
    expect(malformed).toMatchObject({ ok: false, errorCode: 'INVALID_PROVIDER_RESPONSE' })
    const throwingProvider: DocumentExtractionProvider = { metadata: { provider: 'fixture', providerVersion: 'test', model: null }, extractDocument: async () => { throw new Error('private stack secret') } }
    const response = await createLocalFixtureExtractionClient(throwingProvider).requestExtraction(input)
    expect(response).toMatchObject({ ok: false, errorCode: 'EXTRACTION_FAILED', errorMessageSafe: 'No se pudo completar la extracción documental.' })
    expect(JSON.stringify(response)).not.toContain('private stack')
    expect(JSON.stringify(response)).not.toMatch(/financial|supplier|payment|invoice/i)
  })
})
