import { createClient } from 'npm:@supabase/supabase-js@2.99.2'
import { preflight } from './cors.ts'
import { buildFreshSuccessResponse, buildReusedSuccessResponse, jsonResponse } from '../expense-document-extraction/responseContract.ts'
import { OPENAI_DEFAULT_MODEL, OPENAI_MAX_ATTEMPTS_PER_DOCUMENT, OPENAI_MAX_DOCUMENT_BYTES, OPENAI_PROVIDER, OPENAI_PROVIDER_VERSION, requestOpenAiExtraction, type OpenAiExtractionFailureCode } from '../_shared/openaiExpenseExtraction.ts'
import { validateServerProposal } from '../expense-document-extraction/proposalValidation.ts'

const SCHEMA_VERSION = 1
const BUCKET = 'expense-receipts'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
type JsonRecord = Record<string, unknown>
type RuntimeRow = { action: string; extraction_id: string; capture_session_id: string; created_by: string; attempt: number; status: string; storage_path: string; original_filename: string; mime_type: string; file_size_bytes: number; sha256: string }

const json = (body: JsonRecord, status = 200) => jsonResponse(body, status)
const safeFailureStatus = (code: OpenAiExtractionFailureCode) => code === 'EXTRACTION_TIMEOUT' ? 504 : code === 'EXTRACTION_PROVIDER_UNAVAILABLE' || code === 'EXTRACTION_RATE_LIMITED' ? 503 : 422
const safeError = (errorCode: string, errorMessageSafe: string, metadata: JsonRecord | null = null) => ({ ok: false, errorCode, errorMessageSafe, metadata })

async function readBody(request: Request) {
  const contentType = request.headers.get('Content-Type')?.toLowerCase() ?? ''
  const contentLength = Number(request.headers.get('Content-Length') ?? 0)
  if (!contentType.startsWith('application/json') || (Number.isFinite(contentLength) && contentLength > 16_384)) return null
  try {
    const raw = await request.text()
    if (new TextEncoder().encode(raw).byteLength > 16_384) return null
    const body = JSON.parse(raw) as JsonRecord
    if (Object.keys(body).some((key) => !['captureDocumentId', 'mode'].includes(key))) return null
    const captureDocumentId = typeof body.captureDocumentId === 'string' ? body.captureDocumentId : ''
    const mode = body.mode === undefined ? 'extract' : body.mode
    if (!UUID_PATTERN.test(captureDocumentId) || (mode !== 'extract' && mode !== 'retry')) return null
    return { captureDocumentId, mode: mode as 'extract' | 'retry' }
  } catch {
    return null
  }
}

function toBase64(bytes: Uint8Array) {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)))
  return btoa(binary)
}

function canonicalFilename(filename: string) {
  const base = filename.replace(/[\\/]/gu, '_').replace(/[^a-zA-Z0-9._-]/gu, '_').slice(0, 255)
  return base || 'expense-document'
}

async function markFailure(adminClient: ReturnType<typeof createClient>, extractionId: string, userId: string, code: string, message: string, model: string | null) {
  await adminClient.from('expense_capture_extractions').update({ status: 'FAILED', failed_at: new Date().toISOString(), error_code: code, error_message_safe: message, model, updated_at: new Date().toISOString() }).eq('id', extractionId).eq('created_by', userId)
}

Deno.serve(async (request: Request) => {
  const preflightResponse = preflight(request)
  if (preflightResponse) return preflightResponse
  if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405)
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/iu, '')
  if (!token) return json({ error: 'AUTH_REQUIRED' }, 401)
  const body = await readBody(request)
  if (!body) return json({ error: 'REQUEST_CONTRACT_INVALID' }, 400)

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const apiKey = Deno.env.get('OPENAI_API_KEY') ?? ''
  if (!url || !publishableKey || !serviceRoleKey || !apiKey) return json({ ...safeError('EXTRACTION_RUNTIME_NOT_CONFIGURED', 'La extracción OpenAI no está configurada.', null) }, 503)

  const userClient = createClient(url, publishableKey, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const adminClient = createClient(url, serviceRoleKey)
  const { data: authData, error: authError } = await userClient.auth.getUser(token)
  if (authError || !authData.user) return json({ error: 'AUTH_INVALID' }, 401)
  const userId = authData.user.id
  const { error: staffError } = await userClient.rpc('require_n52_active_internal_staff')
  if (staffError) return json({ error: 'ACTIVE_INTERNAL_STAFF_REQUIRED' }, 403)

  const { data: prepared, error: prepareError } = await adminClient.rpc('n52_prepare_extraction', {
    p_capture_document_id: body.captureDocumentId,
    p_authenticated_user_id: userId,
    p_mode: body.mode,
    p_schema_version: SCHEMA_VERSION,
    p_provider: OPENAI_PROVIDER,
    p_provider_version: OPENAI_PROVIDER_VERSION,
  })
  if (prepareError || !prepared?.[0]) return json({ error: 'EXTRACTION_STATE_UNAVAILABLE' }, 500)
  const row = prepared[0] as RuntimeRow

  if (row.action === 'RETRY_NOT_ELIGIBLE') return json({ ...safeError('RETRY_NOT_ELIGIBLE', 'Solo se puede reintentar una extracción fallida.', null) }, 409)
  if (row.action === 'ATTEMPT_LIMIT_REACHED') return json({ ...safeError('EXTRACTION_RATE_LIMITED', 'Se alcanzó el límite de intentos para este documento.', null), extractionId: row.extraction_id, attempt: row.attempt }, 429)
  if (row.action === 'EXISTING') {
    const { data: existing } = await adminClient.from('expense_capture_extractions').select('proposal, provider, provider_version, model, error_code, error_message_safe').eq('id', row.extraction_id).eq('created_by', userId).maybeSingle()
    if (row.status === 'SUCCEEDED') {
      if (!validateServerProposal(existing?.proposal)) return json({ error: 'EXTRACTION_STATE_UNAVAILABLE' }, 500)
      const reused = buildReusedSuccessResponse(existing, row.extraction_id, row.attempt)
      return reused ? json(reused) : json({ error: 'EXTRACTION_STATE_UNAVAILABLE' }, 500)
    }
    if (row.status === 'FAILED') return json({ ...safeError(existing?.error_code ?? 'EXTRACTION_FAILED', existing?.error_message_safe ?? 'La extracción ha fallado.', null), extractionId: row.extraction_id, attempt: row.attempt }, 422)
    if (row.status !== 'PENDING') return json({ ok: false, status: row.status, extractionId: row.extraction_id, attempt: row.attempt, metadata: null }, 202)
  }

  const { data: claimed } = await adminClient.rpc('n52_claim_extraction', { p_extraction_id: row.extraction_id })
  if (!claimed?.[0]?.claimed) return json({ ok: false, status: 'PROCESSING', extractionId: row.extraction_id, attempt: row.attempt, metadata: null }, 202)
  if (row.attempt > OPENAI_MAX_ATTEMPTS_PER_DOCUMENT) {
    await markFailure(adminClient, row.extraction_id, userId, 'EXTRACTION_RATE_LIMITED', 'Se alcanzó el límite de intentos para este documento.', null)
    return json({ ...safeError('EXTRACTION_RATE_LIMITED', 'Se alcanzó el límite de intentos para este documento.', null), extractionId: row.extraction_id, attempt: row.attempt }, 429)
  }

  // The path below is returned by the ownership-checked RPC, never accepted from the client.
  if (row.created_by !== userId || !row.storage_path.startsWith(`captures/${row.capture_session_id}/`) || row.storage_path.includes('..') || row.storage_path.includes('\\')) {
    await markFailure(adminClient, row.extraction_id, userId, 'DOCUMENT_ACCESS_DENIED', 'El documento no pertenece a la sesión autenticada.', null)
    return json({ ...safeError('DOCUMENT_ACCESS_DENIED', 'El documento no pertenece a la sesión autenticada.', null), extractionId: row.extraction_id }, 403)
  }
  const { data: file, error: fileError } = await adminClient.storage.from(BUCKET).download(row.storage_path)
  if (fileError || !file) {
    await markFailure(adminClient, row.extraction_id, userId, 'DOCUMENT_NOT_FOUND', 'No se pudo leer el documento privado.', null)
    return json({ ...safeError('DOCUMENT_NOT_FOUND', 'No se pudo leer el documento privado.', null), extractionId: row.extraction_id }, 404)
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (bytes.byteLength <= 0 || bytes.byteLength > OPENAI_MAX_DOCUMENT_BYTES || bytes.byteLength !== Number(row.file_size_bytes)) {
    await markFailure(adminClient, row.extraction_id, userId, 'DOCUMENT_INVALID', 'El tamaño del documento no coincide con el registro seguro.', null)
    return json({ ...safeError('DOCUMENT_INVALID', 'El documento no cumple los límites admitidos.', null), extractionId: row.extraction_id }, 422)
  }

  const model = Deno.env.get('OPENAI_EXPENSE_EXTRACTION_MODEL') || OPENAI_DEFAULT_MODEL
  const result = await requestOpenAiExtraction({ apiKey, model, document: { filename: canonicalFilename(row.original_filename), mimeType: row.mime_type, sizeBytes: bytes.byteLength, base64: toBase64(bytes) } })
  if (!result.ok) {
    await markFailure(adminClient, row.extraction_id, userId, result.errorCode, result.errorMessageSafe, model)
    return json({ ...safeError(result.errorCode, result.errorMessageSafe, null), extractionId: row.extraction_id, attempt: row.attempt }, safeFailureStatus(result.errorCode))
  }

  const { error: updateError } = await adminClient.from('expense_capture_extractions').update({ status: 'SUCCEEDED', proposal: result.proposal, model: result.model, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', row.extraction_id).eq('created_by', userId)
  if (updateError) {
    await markFailure(adminClient, row.extraction_id, userId, 'EXTRACTION_FAILED', 'No se pudo guardar la propuesta de extracción.', result.model)
    return json({ ...safeError('EXTRACTION_FAILED', 'No se pudo guardar la propuesta de extracción.', null), extractionId: row.extraction_id }, 500)
  }
  return json(buildFreshSuccessResponse(row.extraction_id, row.attempt, result.proposal, { provider: OPENAI_PROVIDER, providerVersion: OPENAI_PROVIDER_VERSION, model: result.model }))
})
