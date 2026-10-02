import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { getSupabaseClient } from '../../lib/supabase'
import { createExpenseNormalizationClient } from './expenseNormalizationClient'

vi.mock('../../lib/supabase', () => ({ getSupabaseClient: vi.fn() }))

const mockedGetSupabaseClient = vi.mocked(getSupabaseClient)
const proposal = { reviewStatus: 'READY_FOR_REVIEW', reconciliation: { status: 'MATCH' } }

describe('N5.5 normalization client boundary', () => {
  const invoke = vi.fn()

  beforeEach(() => {
    invoke.mockReset()
    mockedGetSupabaseClient.mockReturnValue({ client: { functions: { invoke } } as never, error: null })
  })

  it('invokes the provider-independent normalizer and preserves the persistence identifiers', async () => {
    invoke.mockResolvedValue({ data: { ok: true, normalizationId: 'normalization-1', extractionId: 'extraction-1', attempt: 1, status: 'SUCCEEDED', reviewStatus: 'READY_FOR_REVIEW', reconciliationStatus: 'MATCH', normalizedProposal: proposal, reused: false }, error: null })
    const result = await createExpenseNormalizationClient().requestNormalization('extraction-1')
    expect(invoke).toHaveBeenCalledWith('expense-document-normalization', { body: { extractionId: 'extraction-1' } })
    expect(result).toMatchObject({ ok: true, normalizationId: 'normalization-1', extractionId: 'extraction-1', status: 'SUCCEEDED' })
  })

  it('keeps safe Edge errors without reflecting provider details', async () => {
    invoke.mockResolvedValue({ data: null, error: new FunctionsHttpError(new Response(JSON.stringify({ errorCode: 'NORMALIZATION_FAILED', errorMessageSafe: 'No se pudo completar la normalización.' }))) })
    await expect(createExpenseNormalizationClient().requestNormalization('extraction-1')).resolves.toEqual({ ok: false, errorCode: 'NORMALIZATION_FAILED', errorMessageSafe: 'No se pudo completar la normalización.' })
  })

  it('fails closed for processing or malformed success responses', async () => {
    invoke.mockResolvedValue({ data: { ok: true, normalizationId: 'normalization-1', extractionId: 'extraction-1', attempt: 1, status: 'PROCESSING' }, error: null })
    await expect(createExpenseNormalizationClient().requestNormalization('extraction-1')).resolves.toMatchObject({ ok: false, errorCode: 'INVALID_NORMALIZATION_RESPONSE' })
    invoke.mockResolvedValue({ data: { ok: false, errorCode: 'PRIVATE_ERROR', errorMessageSafe: 'private details' }, error: null })
    const result = await createExpenseNormalizationClient().requestNormalization('extraction-1')
    expect(result).toMatchObject({ ok: false, errorCode: 'PRIVATE_ERROR' })
    expect(JSON.stringify(result)).not.toContain('stack')
  })
})
