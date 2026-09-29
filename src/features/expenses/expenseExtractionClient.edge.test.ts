import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createServerFixtureProposal } from '../../../supabase/functions/expense-document-extraction/fixtureProposal'
import { getSupabaseClient } from '../../lib/supabase'
import { createExpenseExtractionClient } from './expenseExtractionClient'

vi.mock('../../lib/supabase', () => ({ getSupabaseClient: vi.fn() }))

const mockedGetSupabaseClient = vi.mocked(getSupabaseClient)
const input = {
  captureDocumentId: 'doc-1',
  captureSessionId: 'session-1',
  originalFilename: 'fixture-n52-cert-success.png',
  mimeType: 'image/png',
  sizeBytes: 10,
  sha256: 'a'.repeat(64),
}

describe('N5.2 frontend to Edge connection', () => {
  const invoke = vi.fn()

  beforeEach(() => {
    invoke.mockReset()
    mockedGetSupabaseClient.mockReturnValue({
      client: { functions: { invoke } } as never,
      error: null,
    })
  })

  it('invokes the authenticated Edge Function with the exact request contract', async () => {
    invoke.mockResolvedValue({
      data: {
        ok: true,
        extractionId: 'extraction-1',
        attempt: 1,
        proposal: createServerFixtureProposal(),
        metadata: { provider: 'fixture', providerVersion: 'n5.2-fixture-v1', model: null },
        reused: false,
      },
      error: null,
    })

    const result = await createExpenseExtractionClient().requestExtraction(input)

    expect(invoke).toHaveBeenCalledWith('expense-document-extraction', {
      body: { captureDocumentId: 'doc-1', mode: 'extract' },
    })
    expect(result).toMatchObject({ ok: true, metadata: { provider: 'fixture', providerVersion: 'n5.2-fixture-v1', model: null } })
  })

  it('supports retry without exposing unrelated capture metadata to the Edge request', async () => {
    invoke.mockResolvedValue({ data: { ok: false, errorCode: 'EXTRACTION_PROVIDER_UNAVAILABLE', errorMessageSafe: 'El proveedor QA no está disponible.', metadata: null }, error: null })

    const result = await createExpenseExtractionClient().requestExtraction(input, 'retry')

    expect(invoke).toHaveBeenCalledWith('expense-document-extraction', {
      body: { captureDocumentId: 'doc-1', mode: 'retry' },
    })
    expect(result).toMatchObject({ ok: false, errorCode: 'EXTRACTION_PROVIDER_UNAVAILABLE' })
  })

  it('fails closed when the Edge response is malformed', async () => {
    invoke.mockResolvedValue({ data: { ok: true, proposal: { schemaVersion: 1 } }, error: null })

    await expect(createExpenseExtractionClient().requestExtraction(input)).resolves.toMatchObject({
      ok: false,
      errorCode: 'INVALID_PROVIDER_RESPONSE',
    })
  })
})
