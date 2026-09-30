import { describe, expect, it } from 'vitest'
import { createServerFixtureProposal } from '../../../supabase/functions/expense-document-extraction/fixtureProposal.ts'
import { handleNormalizationRequest, type N53Services } from '../../../supabase/functions/expense-document-normalization/orchestration.ts'
import { readClaimRow } from '../../../supabase/functions/expense-document-normalization/contract.ts'
import { validateExtractionProposal } from './expenseExtractionContract.ts'

const userId = '11111111-1111-4111-8111-111111111111'
const extractionId = '22222222-2222-4222-8222-222222222222'
const normalizationId = '33333333-3333-4333-8333-333333333333'
const hash = 'a'.repeat(64)
const proposalResult = validateExtractionProposal(createServerFixtureProposal())
if (!proposalResult.ok) throw new Error('Fixture proposal must satisfy the canonical extraction contract.')
const proposal = proposalResult.proposal

function baseServices(overrides: Partial<N53Services> = {}): N53Services {
  const claim = { action: 'CREATED' as const, normalization_id: normalizationId, extraction_id: extractionId, attempt_number: 1, status: 'PROCESSING' as const, schema_version: 1, normalizer_version: 'n5.3-normalizer-v1', normalization_key: hash, input_hash: hash, normalized_proposal: null, output_hash: null, review_status: null, reconciliation_status: null }
  return {
    getUser: async () => ({ id: userId }),
    requireActiveStaff: async () => null,
    getExtraction: async () => ({ data: { id: extractionId, capture_document_id: normalizationId, schema_version: 1, status: 'SUCCEEDED', proposal, created_by: userId }, error: null }),
    claim: async () => ({ data: claim, error: null }),
    getNormalization: async () => ({ data: null, error: null }),
    finalizeSuccess: async () => ({ data: { normalization_id: normalizationId, extraction_id: extractionId, attempt_number: 1, status: 'SUCCEEDED' as const, schema_version: 1, normalizer_version: 'n5.3-normalizer-v1', normalization_key: hash, normalized_proposal: { reviewStatus: 'READY_FOR_REVIEW' }, output_hash: hash, review_status: 'READY_FOR_REVIEW', reconciliation_status: 'MATCH' }, error: null }),
    finalizeFailure: async () => ({ data: { normalization_id: normalizationId, extraction_id: extractionId, attempt_number: 1, status: 'FAILED' as const, error_code: 'NORMALIZATION_FAILED' }, error: null }),
    ...overrides,
  }
}

function request() { return new Request('https://qa.test/normalize', { method: 'POST', headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' }, body: JSON.stringify({ extractionId }) }) }

describe('N5.3 exact RPC/Edge contract parity', () => {
  it('rejects a claim result without normalization_id', () => {
    expect(readClaimRow({ action: 'CREATED', id: normalizationId, extraction_id: extractionId, attempt_number: 1, status: 'PROCESSING', schema_version: 1, normalizer_version: 'n5.3-normalizer-v1', normalization_key: hash, input_hash: hash })).toBeNull()
  })

  it('runs a CREATED happy path with the exact normalization id and auth-bound finalize args', async () => {
    let successArgs: Record<string, unknown> | null = null
    const response = await handleNormalizationRequest(request(), baseServices({ finalizeSuccess: async (args) => { successArgs = args; return { data: { normalization_id: normalizationId, extraction_id: extractionId, attempt_number: 1, status: 'SUCCEEDED', schema_version: 1, normalizer_version: 'n5.3-normalizer-v1', normalization_key: hash, normalized_proposal: { reviewStatus: 'READY_FOR_REVIEW' }, output_hash: hash, review_status: 'READY_FOR_REVIEW', reconciliation_status: 'MATCH' }, error: null } } }), 'https://kpvvydthlxupjjqqdpxy.supabase.co', 'qa-runtime')
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.normalizationId).toBe(normalizationId)
    expect(body.status).toBe('SUCCEEDED')
    expect(body.reused).toBe(false)
    expect(successArgs).toMatchObject({ p_normalization_id: normalizationId, p_attempt_number: 1, p_normalization_key: hash, p_authenticated_user_id: userId })
  })

  it('returns existing processing as 202 without normalize or finalize', async () => {
    let calls = 0
    const services = baseServices({ claim: async () => ({ data: { action: 'EXISTING_PROCESSING', normalization_id: normalizationId, extraction_id: extractionId, attempt_number: 2, status: 'PROCESSING', schema_version: 1, normalizer_version: 'n5.3-normalizer-v1', normalization_key: hash, input_hash: hash, normalized_proposal: null, output_hash: null, review_status: null, reconciliation_status: null }, error: null }), finalizeSuccess: async () => { calls += 1; return { data: null, error: null } } })
    const response = await handleNormalizationRequest(request(), services, 'https://kpvvydthlxupjjqqdpxy.supabase.co', 'qa-runtime')
    expect(response.status).toBe(202)
    expect(await response.json()).toMatchObject({ normalizationId, status: 'PROCESSING' })
    expect(calls).toBe(0)
  })

  it('reuses existing succeeded output with exact id and does not create a new attempt', async () => {
    let calls = 0
    const services = baseServices({ claim: async () => ({ data: { action: 'EXISTING_SUCCEEDED', normalization_id: normalizationId, extraction_id: extractionId, attempt_number: 1, status: 'SUCCEEDED', schema_version: 1, normalizer_version: 'n5.3-normalizer-v1', normalization_key: hash, input_hash: hash, normalized_proposal: { reviewStatus: 'READY_FOR_REVIEW' }, output_hash: hash, review_status: 'READY_FOR_REVIEW', reconciliation_status: 'MATCH' }, error: null }), getNormalization: async () => ({ data: { normalization_id: normalizationId, extraction_id: extractionId, attempt_number: 1, status: 'SUCCEEDED', schema_version: 1, normalizer_version: 'n5.3-normalizer-v1', normalization_key: hash, normalized_proposal: { reviewStatus: 'READY_FOR_REVIEW' }, output_hash: hash, review_status: 'READY_FOR_REVIEW', reconciliation_status: 'MATCH' }, error: null }), finalizeSuccess: async () => { calls += 1; return { data: null, error: null } } })
    const response = await handleNormalizationRequest(request(), services, 'https://kpvvydthlxupjjqqdpxy.supabase.co', 'qa-runtime')
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body).toMatchObject({ normalizationId, outputHash: hash, reused: true })
    expect(calls).toBe(0)
  })

  it('finalizes failure with the exact id, attempt, key and authenticated user', async () => {
    let failureArgs: Record<string, unknown> | null = null
    const services = baseServices({ finalizeSuccess: async () => ({ data: null, error: { code: 'PROVIDER_ERROR' } }), finalizeFailure: async (args) => { failureArgs = args; return { data: { normalization_id: normalizationId, extraction_id: extractionId, attempt_number: 1, status: 'FAILED', error_code: 'NORMALIZATION_FAILED' }, error: null } } })
    const response = await handleNormalizationRequest(request(), services, 'https://kpvvydthlxupjjqqdpxy.supabase.co', 'qa-runtime')
    expect(response.status).toBe(422)
    expect(failureArgs).toMatchObject({ p_normalization_id: normalizationId, p_attempt_number: 1, p_normalization_key: hash, p_authenticated_user_id: userId })
  })
})
