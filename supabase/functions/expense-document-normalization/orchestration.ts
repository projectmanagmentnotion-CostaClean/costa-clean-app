import { buildNormalizationIdentity, canonicalSerialize, normalizeExpenseProposal, sha256Hex, validateExtractionProposal, NORMALIZER_IMPLEMENTATION_VERSION } from '../_shared/n53Normalization.ts'
import { isQaRuntimeConfigured } from './runtimeGuards.ts'
import { json, safeError } from './responseContract.ts'
import type { N53ClaimRow, N53ExtractionRow, N53FinalizeFailureRow, N53FinalizeSuccessRow, N53NormalizationRow, N53RpcError } from './contract.ts'

const SCHEMA_VERSION = 1
const MAX_REQUEST_BYTES = 16_384
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

export interface N53Services {
  getUser(token: string): Promise<{ id: string } | null>
  requireActiveStaff(): Promise<N53RpcError | null>
  getExtraction(extractionId: string): Promise<{ data: N53ExtractionRow | null; error: N53RpcError | null }>
  claim(args: Record<string, unknown>): Promise<{ data: N53ClaimRow | null; error: N53RpcError | null }>
  getNormalizationByKey(normalizationKey: string): Promise<{ data: N53ClaimRow | null; error: N53RpcError | null }>
  getNormalization(normalizationId: string): Promise<{ data: N53NormalizationRow | null; error: N53RpcError | null }>
  finalizeSuccess(args: Record<string, unknown>): Promise<{ data: N53FinalizeSuccessRow | null; error: N53RpcError | null }>
  finalizeFailure(args: Record<string, unknown>): Promise<{ data: N53FinalizeFailureRow | null; error: N53RpcError | null }>
}

function metadata(row: N53NormalizationRow | N53FinalizeSuccessRow) {
  return { normalizationId: row.normalization_id, extractionId: row.extraction_id, attempt: row.attempt_number, status: row.status, schemaVersion: row.schema_version, normalizerVersion: row.normalizer_version, reviewStatus: row.review_status, reconciliationStatus: row.reconciliation_status, normalizedProposal: row.normalized_proposal, outputHash: row.output_hash, reused: false }
}

async function readBody(request: Request): Promise<{ extractionId: string } | null> {
  const contentType = request.headers.get('Content-Type')?.toLowerCase() ?? ''
  const length = Number(request.headers.get('Content-Length') ?? 0)
  if (!contentType.startsWith('application/json') || (Number.isFinite(length) && length > MAX_REQUEST_BYTES)) return null
  try {
    const raw = await request.text()
    if (new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) return null
    const body: unknown = JSON.parse(raw)
    if (body === null || typeof body !== 'object' || Array.isArray(body)) return null
    const record = body as Record<string, unknown>
    if (Object.keys(record).length !== 1 || typeof record.extractionId !== 'string' || !UUID.test(record.extractionId)) return null
    return { extractionId: record.extractionId }
  } catch { return null }
}

export async function handleNormalizationRequest(request: Request, services: N53Services, supabaseUrl: string, runtimeMode: string): Promise<Response> {
  const headers = { 'Access-Control-Allow-Origin': '*' }
  if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405, headers)
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/iu, '')
  if (!token) return safeError('AUTH_REQUIRED', 'Autenticación requerida.', 401, headers)
  const body = await readBody(request)
  if (!body) return safeError('REQUEST_CONTRACT_INVALID', 'Solicitud no válida.', 400, headers)
  if (!isQaRuntimeConfigured(supabaseUrl, runtimeMode)) return safeError('NORMALIZATION_RUNTIME_NOT_CONFIGURED', 'La normalización no está configurada.', 503, headers)
  const user = await services.getUser(token)
  if (!user) return safeError('AUTH_INVALID', 'Autenticación no válida.', 401, headers)
  if (await services.requireActiveStaff()) return safeError('ACTIVE_INTERNAL_STAFF_REQUIRED', 'Usuario interno no autorizado.', 403, headers)
  const extractionResult = await services.getExtraction(body.extractionId)
  if (extractionResult.error || !extractionResult.data) return safeError('EXTRACTION_NOT_FOUND', 'Extracción no encontrada.', 404, headers)
  const extraction = extractionResult.data
  if (extraction.status !== 'SUCCEEDED' || !extraction.proposal) return safeError('EXTRACTION_NOT_SUCCEEDED', 'La extracción aún no está lista.', 409, headers)
  if (extraction.schema_version !== SCHEMA_VERSION) return safeError('UNSUPPORTED_EXTRACTION_SCHEMA_VERSION', 'La versión de extracción no está soportada.', 422, headers)
  const checked = validateExtractionProposal(extraction.proposal)
  if (!checked.ok) return safeError('INVALID_EXTRACTION_PROPOSAL', 'La propuesta de extracción no es válida.', 422, headers)
  const identity = await buildNormalizationIdentity(extraction.id, checked.proposal, SCHEMA_VERSION)
  let claimResult = await services.claim({ p_extraction_id: extraction.id, p_authenticated_user_id: user.id, p_schema_version: SCHEMA_VERSION, p_normalizer_version: NORMALIZER_IMPLEMENTATION_VERSION, p_input_hash: identity.inputHash, p_normalization_key: identity.normalizationKey })
  if (claimResult.error?.code === '23505') {
    const recovered = await services.getNormalizationByKey(identity.normalizationKey)
    claimResult = recovered.data ? { data: recovered.data, error: null } : { data: null, error: recovered.error ?? { code: 'NORMALIZATION_CLAIM_RACE_UNRESOLVED' } }
  }
  if (claimResult.error) return safeError(claimResult.error.code === 'P0002' ? 'EXTRACTION_NOT_FOUND' : 'NORMALIZATION_FAILED', claimResult.error.code === 'P0002' ? 'Extracción no encontrada.' : 'No se pudo preparar la normalización.', claimResult.error.code === 'P0002' ? 404 : 500, headers)
  const row = claimResult.data
  if (!row) return safeError('NORMALIZATION_FAILED', 'No se pudo preparar la normalización.', 500, headers)
  if (row.action === 'EXISTING_SUCCEEDED') {
    const existing = await services.getNormalization(row.normalization_id)
    return existing.data ? json({ ok: true, ...metadata({ ...existing.data, normalization_id: row.normalization_id }), reused: true }, 200, headers) : safeError('NORMALIZATION_FAILED', 'Resultado no disponible.', 500, headers)
  }
  if (row.action === 'EXISTING_PROCESSING') return json({ ok: true, normalizationId: row.normalization_id, extractionId: extraction.id, attempt: row.attempt_number, status: 'PROCESSING', reused: false }, 202, headers)
  try {
    const normalized = normalizeExpenseProposal(checked.proposal)
    const outputHash = await sha256Hex(canonicalSerialize(normalized))
    const finalized = await services.finalizeSuccess({ p_normalization_id: row.normalization_id, p_authenticated_user_id: user.id, p_attempt_number: row.attempt_number, p_normalization_key: row.normalization_key, p_output_hash: outputHash, p_normalized_proposal: normalized, p_review_status: normalized.reviewStatus, p_reconciliation_status: normalized.reconciliation.status })
    if (finalized.error || !finalized.data) throw new Error('NORMALIZATION_FINALIZE_FAILED')
    return json({ ok: true, ...metadata(finalized.data) }, 200, headers)
  } catch {
    await services.finalizeFailure({ p_normalization_id: row.normalization_id, p_authenticated_user_id: user.id, p_attempt_number: row.attempt_number, p_normalization_key: row.normalization_key, p_error_code: 'NORMALIZATION_FAILED', p_error_message_safe: 'No se pudo completar la normalización.' })
    return safeError('NORMALIZATION_FAILED', 'No se pudo completar la normalización.', 422, headers)
  }
}
