import { describe, expect, it, vi } from 'vitest'
import { createServerFixtureProposal } from '../../../supabase/functions/expense-document-extraction/fixtureProposal'
import { handleExtractionRequest, type N52PrepareRow, type N52Services } from '../../../supabase/functions/expense-document-extraction/orchestration'

const QA_URL = 'https://kpvvydthlxupjjqqdpxy.supabase.co'
const USER_ID = '123e4567-e89b-42d3-a456-426614174000'
const DOCUMENT_ID = '123e4567-e89b-42d3-a456-426614174001'
const EXTRACTION_ID = '123e4567-e89b-42d3-a456-426614174002'
const SESSION_ID = '123e4567-e89b-42d3-a456-426614174003'

function prepared(filename = 'smart-expense-synthetic-invoice.pdf'): N52PrepareRow {
  return {
    action: 'CREATED', extraction_id: EXTRACTION_ID, capture_session_id: SESSION_ID, created_by: USER_ID,
    attempt: 1, status: 'PENDING', idempotency_key: 'synthetic-key', storage_path: `captures/${SESSION_ID}/sha`,
    original_filename: filename, mime_type: filename.endsWith('.pdf') ? 'application/pdf' : 'image/png', file_size_bytes: 1200, sha256: 'a'.repeat(64),
  }
}

function services(filename?: string) {
  let extracted: Record<string, unknown> | null = null
  const finalizeSuccess = vi.fn(async (_id: string, proposal: unknown) => {
    extracted = { id: EXTRACTION_ID, attempt: 1, status: 'SUCCEEDED', proposal, provider: 'fixture', provider_version: 'n5.2-fixture-v1', model: null }
    return { error: null }
  })
  const finalizeFailure = vi.fn(async () => ({ error: null }))
  const service: N52Services = {
    getUser: async () => ({ id: USER_ID }),
    requireActiveStaff: async () => null,
    prepare: async () => ({ data: prepared(filename), error: null }),
    claim: async () => ({ data: { claimed: true, status: 'PROCESSING' }, error: null }),
    getExtraction: async () => ({ data: extracted as never, error: null }),
    finalizeSuccess,
    finalizeFailure,
  }
  return { service, finalizeSuccess, finalizeFailure }
}

function request(body: unknown = { captureDocumentId: DOCUMENT_ID }) {
  return new Request('https://functions.example/expense-document-extraction', {
    method: 'POST', headers: { Authorization: 'Bearer test-session', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}

describe('N5.2 synthetic extraction request', () => {
  it('runs deterministic fixture extraction only for the exact QA runtime', async () => {
    const deps = services()
    const response = await handleExtractionRequest(request(), deps.service, QA_URL, 'qa-fixture')
    const result = await response.json()
    expect(response.status).toBe(200)
    expect(result).toMatchObject({ ok: true, extractionId: EXTRACTION_ID, metadata: { provider: 'fixture', providerVersion: 'n5.2-fixture-v1', model: null } })
    expect(result.proposal).toMatchObject({ invoice: { number: { value: 'SYN-PDF-2026-001' } }, amounts: { net: { value: '100.00' }, tax: { value: '21.00' }, gross: { value: '121.00' } } })
  })

  it('fails closed for production-like or lookalike QA hosts before touching services', async () => {
    const deps = services()
    const response = await handleExtractionRequest(request(), deps.service, 'https://kpvvydthlxupjjqqdpxy.supabase.co.attacker.invalid', 'qa-fixture')
    expect(response.status).toBe(503)
    expect(deps.finalizeSuccess).not.toHaveBeenCalled()
  })

  it('rejects arbitrary uploads without parsing or persisting a proposal', async () => {
    const deps = services('customer-invoice.pdf')
    const response = await handleExtractionRequest(request(), deps.service, QA_URL, 'qa-fixture')
    const result = await response.json()
    expect(response.status).toBe(422)
    expect(result.errorCode).toBe('UNSUPPORTED_DOCUMENT')
    expect(deps.finalizeFailure).toHaveBeenCalledWith(EXTRACTION_ID, 'UNSUPPORTED_DOCUMENT')
    expect(deps.finalizeSuccess).not.toHaveBeenCalled()
  })

  it('uses the image-specific synthetic invoice proposal without invoking a provider', async () => {
    const deps = services('smart-expense-synthetic-invoice.png')
    const response = await handleExtractionRequest(request(), deps.service, QA_URL, 'qa-fixture')
    const result = await response.json()
    expect(response.status).toBe(200)
    expect(result.proposal).toMatchObject({ invoice: { number: { value: 'SYN-IMG-2026-002' } }, amounts: { net: { value: '80.00' }, tax: { value: '16.80' }, gross: { value: '96.80' } } })
    expect(createServerFixtureProposal('synthetic-image')).toMatchObject({ schemaVersion: 1 })
  })

  it('requires an authenticated active staff member and a strict request body', async () => {
    const deps = services()
    const noAuth = new Request('https://functions.example/expense-document-extraction', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ captureDocumentId: DOCUMENT_ID }) })
    expect((await handleExtractionRequest(noAuth, deps.service, QA_URL, 'qa-fixture')).status).toBe(401)
    expect((await handleExtractionRequest(request({ captureDocumentId: DOCUMENT_ID, unexpected: 'value' }), deps.service, QA_URL, 'qa-fixture')).status).toBe(400)
  })
})
