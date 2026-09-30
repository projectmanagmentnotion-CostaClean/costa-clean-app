import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.2'
import { canonicalSerialize, buildNormalizationIdentity, NORMALIZER_IMPLEMENTATION_VERSION, normalizeExpenseProposal, validateExtractionProposal, sha256Hex } from '../_shared/n53Normalization.ts'
import { preflight, CORS_HEADERS } from './cors.ts'
import { isQaRuntimeConfigured, SERVER_RUNTIME_ENV } from './runtimeGuards.ts'
import { json, safeError } from './responseContract.ts'

const SCHEMA_VERSION = 1
const MAX_REQUEST_BYTES = 16_384
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

type Body = { extractionId: string }
type Claim = { action: 'CREATED' | 'EXISTING_PROCESSING' | 'EXISTING_SUCCEEDED' | 'RETRY_CREATED'; normalization_id: string; attempt_number: number; status: string; normalization_key: string; input_hash: string }

async function readBody(request: Request): Promise<Body | null> {
  const contentType = request.headers.get('Content-Type')?.toLowerCase() ?? ''
  const length = Number(request.headers.get('Content-Length') ?? 0)
  if (!contentType.startsWith('application/json') || (Number.isFinite(length) && length > MAX_REQUEST_BYTES)) return null
  try {
    const raw = await request.text()
    if (new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) return null
    const body = JSON.parse(raw) as Record<string, unknown>
    if (Object.keys(body).length !== 1 || typeof body.extractionId !== 'string' || !UUID.test(body.extractionId)) return null
    return { extractionId: body.extractionId }
  } catch { return null }
}

function metadata(row: Record<string, unknown>) { return { normalizationId: row.id, extractionId: row.extraction_id, attempt: row.attempt_number, status: row.status, schemaVersion: row.schema_version, normalizerVersion: row.normalizer_version, reviewStatus: row.review_status, reconciliationStatus: row.reconciliation_status, normalizedProposal: row.normalized_proposal, outputHash: row.output_hash, reused: row.status === 'SUCCEEDED' } }

Deno.serve(async (request: Request) => {
  const preflightResponse = preflight(request)
  if (preflightResponse) return preflightResponse
  if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405, CORS_HEADERS)
  const headers = CORS_HEADERS
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/iu, '')
  if (!token) return safeError('AUTH_REQUIRED', 'Autenticación requerida.', 401, headers)
  const body = await readBody(request)
  if (!body) return safeError('REQUEST_CONTRACT_INVALID', 'Solicitud no válida.', 400, headers)
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  if (!isQaRuntimeConfigured(url, Deno.env.get(SERVER_RUNTIME_ENV) ?? '')) return safeError('NORMALIZATION_RUNTIME_NOT_CONFIGURED', 'La normalización no está configurada.', 503, headers)
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!publishableKey || !serviceRoleKey) return safeError('NORMALIZATION_RUNTIME_NOT_CONFIGURED', 'La normalización no está configurada.', 503, headers)
  const userClient = createClient(url, publishableKey, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const adminClient = createClient(url, serviceRoleKey)
  const { data: authData, error: authError } = await userClient.auth.getUser(token)
  if (authError || !authData.user) return safeError('AUTH_INVALID', 'Autenticación no válida.', 401, headers)
  const { error: staffError } = await userClient.rpc('require_n52_active_internal_staff')
  if (staffError) return safeError('ACTIVE_INTERNAL_STAFF_REQUIRED', 'Usuario interno no autorizado.', 403, headers)
  const { data: extraction, error: extractionError } = await userClient.from('expense_capture_extractions').select('id, capture_document_id, schema_version, status, proposal, created_by').eq('id', body.extractionId).maybeSingle()
  if (extractionError || !extraction) return safeError('EXTRACTION_NOT_FOUND', 'Extracción no encontrada.', 404, headers)
  if (extraction.status !== 'SUCCEEDED' || !extraction.proposal) return safeError('EXTRACTION_NOT_SUCCEEDED', 'La extracción aún no está lista.', 409, headers)
  const checked = validateExtractionProposal(extraction.proposal)
  if (!checked.ok) return safeError('INVALID_EXTRACTION_PROPOSAL', 'La propuesta de extracción no es válida.', 422, headers)
  const identity = await buildNormalizationIdentity(extraction.id, checked.proposal, SCHEMA_VERSION)
  const { data: claim, error: claimError } = await adminClient.rpc('n53_claim_normalization', { p_extraction_id: extraction.id, p_authenticated_user_id: authData.user.id, p_schema_version: SCHEMA_VERSION, p_normalizer_version: NORMALIZER_IMPLEMENTATION_VERSION, p_input_hash: identity.inputHash, p_normalization_key: identity.normalizationKey })
  if (claimError) return safeError(claimError.code === 'P0002' ? 'EXTRACTION_NOT_FOUND' : 'NORMALIZATION_FAILED', claimError.code === 'P0002' ? 'Extracción no encontrada.' : 'No se pudo preparar la normalización.', claimError.code === 'P0002' ? 404 : 500, headers)
  if (!claim?.[0]) return safeError('NORMALIZATION_FAILED', 'No se pudo preparar la normalización.', 500, headers)
  const row = claim[0] as Claim
  if (row.action === 'EXISTING_SUCCEEDED') {
    const { data: existing } = await adminClient.from('expense_capture_normalizations').select('*').eq('id', row.normalization_id).maybeSingle()
    return existing ? json({ ok: true, ...metadata(existing) }, 200, headers) : safeError('NORMALIZATION_FAILED', 'Resultado no disponible.', 500, headers)
  }
  if (row.action === 'EXISTING_PROCESSING') return json({ ok: true, normalizationId: row.normalization_id, extractionId: extraction.id, attempt: row.attempt_number, status: 'PROCESSING', reused: false }, 202, headers)
  try {
    const normalized = normalizeExpenseProposal(checked.proposal)
    const outputHash = await sha256Hex(canonicalSerialize(normalized))
    const { data: finalized, error: finalizeError } = await adminClient.rpc('n53_finalize_normalization_success', { p_normalization_id: row.normalization_id, p_authenticated_user_id: authData.user.id, p_attempt_number: row.attempt_number, p_normalization_key: row.normalization_key, p_output_hash: outputHash, p_normalized_proposal: normalized, p_review_status: normalized.reviewStatus, p_reconciliation_status: normalized.reconciliation.status })
    if (finalizeError || !finalized?.[0]) throw new Error('NORMALIZATION_FINALIZE_FAILED')
    return json({ ok: true, ...metadata(finalized[0]), reused: false }, 200, headers)
  } catch {
    await adminClient.rpc('n53_finalize_normalization_failure', { p_normalization_id: row.normalization_id, p_authenticated_user_id: authData.user.id, p_attempt_number: row.attempt_number, p_normalization_key: row.normalization_key, p_error_code: 'NORMALIZATION_FAILED', p_error_message_safe: 'No se pudo completar la normalización.' })
    return safeError('NORMALIZATION_FAILED', 'No se pudo completar la normalización.', 422, headers)
  }
})
