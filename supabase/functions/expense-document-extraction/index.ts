import { createClient } from 'npm:@supabase/supabase-js@2'
import { createServerFixtureProposal } from './fixtureProposal.ts'
import { validateServerProposal } from './proposalValidation.ts'
import { buildFreshSuccessResponse, buildReusedSuccessResponse } from './responseContract.ts'
import { isQaFixtureRuntimeConfigured, SERVER_FIXTURE_ENV_NAME } from './runtimeGuards.ts'

const SCHEMA_VERSION = 1
const PROVIDER = 'fixture'
const PROVIDER_VERSION = 'n5.2-fixture-v1'
const BUCKET = 'expense-receipts'
const MAX_REQUEST_BYTES = 16 * 1024
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
type RuntimeRow = { action: string; extraction_id: string; capture_session_id: string; created_by: string; attempt: number; status: string; idempotency_key: string; storage_path: string; original_filename: string; mime_type: string; file_size_bytes: number; sha256: string }

const json = (body: JsonRecord, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const safeError = (errorCode: string, errorMessageSafe: string, metadata: JsonRecord | null = null) => ({ ok: false, errorCode, errorMessageSafe, metadata })
const parseRequest = async (req: Request) => {
  const contentType = req.headers.get('Content-Type')?.toLowerCase() ?? ''
  const contentLength = Number(req.headers.get('Content-Length') ?? 0)
  if (!contentType.startsWith('application/json') || (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES)) return null
  try {
    const raw = await req.text()
    if (new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) return null
    const body = JSON.parse(raw) as JsonRecord
    if (Object.keys(body).some((key) => !['captureDocumentId', 'mode'].includes(key))) return null
    const captureDocumentId = typeof body.captureDocumentId === 'string' ? body.captureDocumentId : ''
    if (!UUID_PATTERN.test(captureDocumentId) || (body.mode !== 'extract' && body.mode !== 'retry')) return null
    return { captureDocumentId, mode: body.mode as 'extract' | 'retry' }
  } catch { return null }
}
const functionMetadata = () => ({ provider: PROVIDER, providerVersion: PROVIDER_VERSION, model: null })

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405)
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'AUTH_REQUIRED' }, 401)
  const body = await parseRequest(req)
  if (!body) return json({ error: 'REQUEST_CONTRACT_INVALID' }, 400)
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  try { new URL(url) } catch { return json({ error: 'RUNTIME_NOT_CONFIGURED' }, 503) }
  if (!isQaFixtureRuntimeConfigured(url, Deno.env.get(SERVER_FIXTURE_ENV_NAME) ?? '')) return json({ error: 'RUNTIME_NOT_CONFIGURED' }, 503)
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!publishableKey || !serviceRoleKey) return json({ error: 'RUNTIME_NOT_CONFIGURED' }, 503)
  const userClient = createClient(url, publishableKey, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const adminClient = createClient(url, serviceRoleKey)
  const { data: authData, error: authError } = await userClient.auth.getUser(token)
  if (authError || !authData.user) return json({ error: 'AUTH_INVALID' }, 401)
  const { error: staffError } = await userClient.rpc('require_n52_active_internal_staff')
  if (staffError) return json({ error: 'ACTIVE_INTERNAL_STAFF_REQUIRED' }, 403)
  const { data: document, error: documentError } = await userClient.from('expense_capture_documents').select('id, capture_session_id, storage_path, original_filename, mime_type, file_size_bytes, sha256').eq('id', body.captureDocumentId).maybeSingle()
  if (documentError || !document) return json({ error: 'CAPTURE_DOCUMENT_NOT_FOUND' }, 404)
  if (!document.original_filename.toLowerCase().startsWith('fixture-')) return json({ ...safeError('EXTRACTION_RUNTIME_NOT_CONFIGURED', 'La extracción real no está configurada en QA.', null) }, 422)
  if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(document.mime_type) || document.file_size_bytes > 10485760) return json({ ...safeError('DOCUMENT_INVALID', 'El documento no cumple los límites admitidos.', null) }, 422)
  const { data: privateFile, error: fileError } = await adminClient.storage.from(BUCKET).download(document.storage_path)
  if (fileError || !privateFile) return json({ ...safeError('DOCUMENT_UNAVAILABLE', 'No se pudo leer el documento privado.', null) }, 422)
  const { data: prepared, error: prepareError } = await adminClient.rpc('n52_prepare_extraction', { p_capture_document_id: body.captureDocumentId, p_authenticated_user_id: authData.user.id, p_mode: body.mode, p_schema_version: SCHEMA_VERSION, p_provider: PROVIDER, p_provider_version: PROVIDER_VERSION })
  if (prepareError || !prepared?.[0]) return json({ error: 'EXTRACTION_STATE_UNAVAILABLE' }, 500)
  const row = prepared[0] as RuntimeRow
  if (row.action === 'RETRY_NOT_ELIGIBLE') return json({ ...safeError('RETRY_NOT_ELIGIBLE', 'Solo se puede reintentar una extracción fallida.', null) }, 409)
  if (row.action === 'EXISTING') {
    const { data: existing } = await adminClient.from('expense_capture_extractions').select('proposal, provider, provider_version, model, error_code, error_message_safe').eq('id', row.extraction_id).maybeSingle()
    if (row.status === 'SUCCEEDED') {
      const reusedResponse = buildReusedSuccessResponse(existing, row.extraction_id, row.attempt)
      if (!reusedResponse) return json({ error: 'EXTRACTION_STATE_UNAVAILABLE' }, 500)
      return json(reusedResponse)
    }
    if (row.status === 'FAILED') return json({ ...safeError(existing?.error_code ?? 'EXTRACTION_FAILED', existing?.error_message_safe ?? 'La extracción ha fallado.', null), extractionId: row.extraction_id, attempt: row.attempt }, 422)
    return json({ ok: false, status: row.status, extractionId: row.extraction_id, attempt: row.attempt, metadata: null }, 202)
  }
  const { data: claimed } = await adminClient.rpc('n52_claim_extraction', { p_extraction_id: row.extraction_id })
  if (!claimed?.[0]?.claimed) return json({ ok: false, status: 'PROCESSING', extractionId: row.extraction_id, attempt: row.attempt, metadata: null }, 202)
  let proposal: unknown = createServerFixtureProposal()
  if (document.original_filename.toLowerCase().startsWith('fixture-fail-')) {
    await adminClient.from('expense_capture_extractions').update({ status: 'FAILED', failed_at: new Date().toISOString(), error_code: 'EXTRACTION_PROVIDER_UNAVAILABLE', error_message_safe: 'El proveedor QA no está disponible.', updated_at: new Date().toISOString() }).eq('id', row.extraction_id)
    return json({ ...safeError('EXTRACTION_PROVIDER_UNAVAILABLE', 'El proveedor QA no está disponible.', null), extractionId: row.extraction_id, attempt: row.attempt }, 422)
  }
  if (document.original_filename.toLowerCase().startsWith('fixture-invalid-')) proposal = { malformed: true }
  if (!validateServerProposal(proposal)) {
    await adminClient.from('expense_capture_extractions').update({ status: 'FAILED', failed_at: new Date().toISOString(), error_code: 'INVALID_PROVIDER_RESPONSE', error_message_safe: 'La respuesta del proveedor no supera la validación estructural.', updated_at: new Date().toISOString() }).eq('id', row.extraction_id)
    return json({ ...safeError('INVALID_PROVIDER_RESPONSE', 'La respuesta del proveedor no supera la validación estructural.', null), extractionId: row.extraction_id }, 422)
  }
  const { error: updateError } = await adminClient.from('expense_capture_extractions').update({ status: 'SUCCEEDED', proposal, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', row.extraction_id)
  if (updateError) {
    await adminClient.from('expense_capture_extractions').update({ status: 'FAILED', failed_at: new Date().toISOString(), error_code: 'EXTRACTION_FAILED', error_message_safe: 'No se pudo guardar la propuesta de extracción.', updated_at: new Date().toISOString() }).eq('id', row.extraction_id)
    return json({ ...safeError('EXTRACTION_FAILED', 'No se pudo guardar la propuesta de extracción.', null) }, 500)
  }
  return json(buildFreshSuccessResponse(row.extraction_id, row.attempt, proposal, functionMetadata()))
})
