import { createServerFixtureProposal, resolveSyntheticDocumentProfile } from './fixtureProposal.ts'
import { getFixtureFailure } from './fixtureBehavior.ts'
import { buildFreshSuccessResponse, buildReusedSuccessResponse, jsonResponse } from './responseContract.ts'
import { isQaFixtureRuntimeConfigured } from './runtimeGuards.ts'
import { validateServerProposal } from './proposalValidation.ts'

const SCHEMA_VERSION = 1
const PROVIDER = 'fixture'
const PROVIDER_VERSION = 'n5.2-fixture-v1'
const MAX_REQUEST_BYTES = 16_384
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

export interface N52PrepareRow {
  action: string
  extraction_id: string
  capture_session_id: string
  created_by: string
  attempt: number
  status: string
  idempotency_key: string
  storage_path: string
  original_filename: string
  mime_type: string
  file_size_bytes: number
  sha256: string
}

interface N52ExtractionRow {
  id: string
  attempt: number
  status: string
  proposal: unknown | null
  provider: string
  provider_version: string
  model: string | null
}

interface RpcError { code?: string; message?: string }

export interface N52Services {
  getUser(token: string): Promise<{ id: string } | null>
  requireActiveStaff(): Promise<RpcError | null>
  prepare(args: Record<string, unknown>): Promise<{ data: N52PrepareRow | null; error: RpcError | null }>
  claim(extractionId: string): Promise<{ data: { claimed: boolean; status: string } | null; error: RpcError | null }>
  getExtraction(extractionId: string): Promise<{ data: N52ExtractionRow | null; error: RpcError | null }>
  finalizeSuccess(extractionId: string, proposal: unknown): Promise<{ error: RpcError | null }>
  finalizeFailure(extractionId: string, code: string): Promise<{ error: RpcError | null }>
}

function error(code: string, message: string, status: number): Response {
  return jsonResponse({ ok: false, errorCode: code, errorMessageSafe: message, metadata: null }, status)
}

async function readBody(request: Request): Promise<{ captureDocumentId: string; mode: 'extract' | 'retry' } | null> {
  const contentType = request.headers.get('Content-Type')?.toLowerCase() ?? ''
  const length = Number(request.headers.get('Content-Length') ?? 0)
  if (!contentType.startsWith('application/json') || (Number.isFinite(length) && length > MAX_REQUEST_BYTES)) return null
  try {
    const raw = await request.text()
    if (new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) return null
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const body = value as Record<string, unknown>
    if (Object.keys(body).some((key) => !['captureDocumentId', 'mode'].includes(key))) return null
    if (typeof body.captureDocumentId !== 'string' || !UUID.test(body.captureDocumentId)) return null
    const mode = body.mode ?? 'extract'
    if (mode !== 'extract' && mode !== 'retry') return null
    return { captureDocumentId: body.captureDocumentId, mode }
  } catch { return null }
}

function successfulResponse(row: N52ExtractionRow, reused: boolean): Response | null {
  if (row.status !== 'SUCCEEDED' || !row.proposal || row.provider !== PROVIDER || row.provider_version !== PROVIDER_VERSION || !validateServerProposal(row.proposal)) return null
  const metadata = { provider: PROVIDER, providerVersion: PROVIDER_VERSION, model: row.model }
  return jsonResponse(reused
    ? (buildReusedSuccessResponse({ proposal: row.proposal, provider: row.provider, provider_version: row.provider_version, model: row.model }, row.id, row.attempt) ?? {})
    : buildFreshSuccessResponse(row.id, row.attempt, row.proposal, metadata))
}

export async function handleExtractionRequest(request: Request, services: N52Services, supabaseUrl: string, fixtureMode: string): Promise<Response> {
  if (request.method !== 'POST') return error('REQUEST_CONTRACT_INVALID', 'Solicitud no válida.', 405)
  if (!isQaFixtureRuntimeConfigured(supabaseUrl, fixtureMode)) return error('EXTRACTION_RUNTIME_NOT_CONFIGURED', 'La extracción fixture no está habilitada en este entorno.', 503)
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/iu, '')
  if (!token) return error('AUTH_REQUIRED', 'Autenticación requerida.', 401)
  const body = await readBody(request)
  if (!body) return error('REQUEST_CONTRACT_INVALID', 'Solicitud no válida.', 400)

  let user: { id: string } | null
  try { user = await services.getUser(token) } catch { return error('AUTH_INVALID', 'Autenticación no válida.', 401) }
  if (!user) return error('AUTH_INVALID', 'Autenticación no válida.', 401)
  try {
    if (await services.requireActiveStaff()) return error('ACTIVE_INTERNAL_STAFF_REQUIRED', 'Usuario interno no autorizado.', 403)
  } catch { return error('ACTIVE_INTERNAL_STAFF_REQUIRED', 'Usuario interno no autorizado.', 403) }

  let prepared: { data: N52PrepareRow | null; error: RpcError | null }
  try {
    prepared = await services.prepare({
      p_capture_document_id: body.captureDocumentId,
      p_authenticated_user_id: user.id,
      p_mode: body.mode,
      p_schema_version: SCHEMA_VERSION,
      p_provider: PROVIDER,
      p_provider_version: PROVIDER_VERSION,
    })
  } catch { return error('EXTRACTION_FAILED', 'No se pudo preparar la extracción.', 500) }
  if (prepared.error || !prepared.data) return error('DOCUMENT_NOT_FOUND', 'Documento no encontrado o no autorizado.', 404)

  const row = prepared.data
  if (row.created_by !== user.id || row.capture_session_id.length === 0 || row.extraction_id.length === 0) return error('DOCUMENT_ACCESS_DENIED', 'Acceso al documento denegado.', 403)
  if (row.action === 'EXISTING') {
    const existing = await services.getExtraction(row.extraction_id)
    if (existing.error || !existing.data) return error('EXTRACTION_FAILED', 'No se pudo recuperar la extracción.', 500)
    const response = successfulResponse(existing.data, true)
    if (response) return response
    if (existing.data.status === 'PROCESSING' || existing.data.status === 'PENDING') return error('EXTRACTION_PROVIDER_UNAVAILABLE', 'La extracción sigue en proceso. Inténtalo de nuevo en unos instantes.', 409)
    if (existing.data.status === 'FAILED') return error('EXTRACTION_PROVIDER_UNAVAILABLE', 'La extracción anterior falló. Puedes volver a intentarlo.', 422)
    return error('INVALID_PROVIDER_RESPONSE', 'La respuesta de extracción no es válida.', 422)
  }
  if (!['CREATED', 'RETRY_CREATED'].includes(row.action)) {
    return error(row.action === 'RETRY_NOT_ELIGIBLE' ? 'EXTRACTION_FAILED' : 'EXTRACTION_PROVIDER_UNAVAILABLE', 'No se puede iniciar otro intento de extracción.', 409)
  }

  let claimed: { data: { claimed: boolean; status: string } | null; error: RpcError | null }
  try { claimed = await services.claim(row.extraction_id) } catch { return error('EXTRACTION_FAILED', 'No se pudo iniciar la extracción.', 500) }
  if (claimed.error || !claimed.data?.claimed || claimed.data.status !== 'PROCESSING') return error('EXTRACTION_PROVIDER_UNAVAILABLE', 'La extracción ya está siendo procesada.', 409)

  const profile = resolveSyntheticDocumentProfile(row.original_filename)
  const failureCode = getFixtureFailure(row.original_filename, row.attempt)
  if (!profile && !failureCode) {
    await services.finalizeFailure(row.extraction_id, 'UNSUPPORTED_DOCUMENT').catch(() => undefined)
    return error('UNSUPPORTED_DOCUMENT', 'El documento no pertenece al conjunto sintético de pruebas.', 422)
  }
  if (failureCode) {
    await services.finalizeFailure(row.extraction_id, failureCode).catch(() => undefined)
    return error(failureCode, 'La extracción de prueba no está disponible. Puedes reintentar.', 503)
  }

  const proposal = createServerFixtureProposal(profile!)
  if (!validateServerProposal(proposal)) {
    await services.finalizeFailure(row.extraction_id, 'INVALID_PROVIDER_RESPONSE').catch(() => undefined)
    return error('INVALID_PROVIDER_RESPONSE', 'La respuesta de extracción no es válida.', 500)
  }
  try {
    const finalized = await services.finalizeSuccess(row.extraction_id, proposal)
    if (finalized.error) return error('EXTRACTION_FAILED', 'No se pudo guardar el resultado de extracción.', 500)
    return jsonResponse(buildFreshSuccessResponse(row.extraction_id, row.attempt, proposal, { provider: PROVIDER, providerVersion: PROVIDER_VERSION, model: null }))
  } catch { return error('EXTRACTION_FAILED', 'No se pudo completar la extracción.', 500) }
}
