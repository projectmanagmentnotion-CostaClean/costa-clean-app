import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js'
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

  it('preserves a canonical safe error from FunctionsHttpError.context', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(new Response(JSON.stringify({ ok: false, errorCode: 'EXTRACTION_PROVIDER_UNAVAILABLE', errorMessageSafe: 'Proveedor no disponible.', metadata: null }))),
    })

    const result = await createExpenseExtractionClient().requestExtraction(input)

    expect(result).toMatchObject({ ok: false, errorCode: 'EXTRACTION_PROVIDER_UNAVAILABLE' })
  })

  it('preserves runtime configuration errors from FunctionsHttpError.context', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(new Response(JSON.stringify({ ok: false, errorCode: 'EXTRACTION_RUNTIME_NOT_CONFIGURED', errorMessageSafe: 'Runtime no configurado.', metadata: null }))),
    })

    await expect(createExpenseExtractionClient().requestExtraction(input)).resolves.toMatchObject({
      ok: false,
      errorCode: 'EXTRACTION_RUNTIME_NOT_CONFIGURED',
    })
  })

  it.each([
    ['non-JSON HTTP body', new FunctionsHttpError(new Response('not-json'))],
    ['fetch failure', new FunctionsFetchError({ cause: 'network' })],
    ['relay failure', new FunctionsRelayError({ region: 'eu-west-1' })],
    ['unknown failure', new Error('private transport detail')],
  ])('fails closed for %s', async (_label, error) => {
    invoke.mockResolvedValue({ data: null, error })

    await expect(createExpenseExtractionClient().requestExtraction(input)).resolves.toMatchObject({
      ok: false,
      errorCode: 'EXTRACTION_FAILED',
      errorMessageSafe: 'No se pudo completar la extracción documental.',
    })
  })

  it('fails closed when the Edge response is malformed', async () => {
    invoke.mockResolvedValue({ data: { ok: true, proposal: { schemaVersion: 1 } }, error: null })

    await expect(createExpenseExtractionClient().requestExtraction(input)).resolves.toMatchObject({
      ok: false,
      errorCode: 'INVALID_PROVIDER_RESPONSE',
    })
  })
})
