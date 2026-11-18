import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.2'
import { resolveSupabaseServiceApiKey } from '../_shared/supabaseServiceApiKey.ts'
import { createCorsPreflightResponse } from './cors.ts'
import { handleExtractionRequest, type N52PrepareRow, type N52Services } from './orchestration.ts'
import { isQaFixtureRuntimeConfigured, SERVER_FIXTURE_ENV_NAME } from './runtimeGuards.ts'
import { jsonResponse } from './responseContract.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

function readPrepareRow(value: unknown): N52PrepareRow | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (
    typeof row.action !== 'string'
    || typeof row.extraction_id !== 'string' || !UUID.test(row.extraction_id)
    || typeof row.capture_session_id !== 'string' || !UUID.test(row.capture_session_id)
    || typeof row.created_by !== 'string' || !UUID.test(row.created_by)
    || typeof row.attempt !== 'number' || !Number.isInteger(row.attempt) || row.attempt < 1
    || typeof row.status !== 'string'
    || typeof row.idempotency_key !== 'string'
    || typeof row.storage_path !== 'string'
    || typeof row.original_filename !== 'string'
    || typeof row.mime_type !== 'string'
    || typeof row.file_size_bytes !== 'number'
    || typeof row.sha256 !== 'string'
  ) return null
  return row as N52PrepareRow
}

Deno.serve(async (request: Request) => {
  const preflight = createCorsPreflightResponse(request)
  if (preflight) return preflight

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const mode = Deno.env.get(SERVER_FIXTURE_ENV_NAME) ?? ''
  if (!isQaFixtureRuntimeConfigured(url, mode)) {
    return jsonResponse({ ok: false, errorCode: 'EXTRACTION_RUNTIME_NOT_CONFIGURED', errorMessageSafe: 'La extracción fixture no está habilitada en este entorno.', metadata: null }, 503)
  }

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/iu, '')
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? ''
  const serviceKey = resolveSupabaseServiceApiKey((name) => Deno.env.get(name))?.value ?? ''
  if (!token) return jsonResponse({ ok: false, errorCode: 'AUTH_REQUIRED', errorMessageSafe: 'Autenticación requerida.', metadata: null }, 401)
  if (!publishableKey || !serviceKey) return jsonResponse({ ok: false, errorCode: 'EXTRACTION_RUNTIME_NOT_CONFIGURED', errorMessageSafe: 'La extracción no está configurada.', metadata: null }, 503)

  const userClient = createClient(url, publishableKey, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const adminClient = createClient(url, serviceKey)
  const services: N52Services = {
    async getUser(accessToken) {
      const { data, error } = await userClient.auth.getUser(accessToken)
      return error || !data.user ? null : { id: data.user.id }
    },
    async requireActiveStaff() {
      const { error } = await userClient.rpc('require_n52_active_internal_staff')
      return error ? { code: error.code, message: error.message } : null
    },
    async prepare(args) {
      const { data, error } = await adminClient.rpc('n52_prepare_extraction', args)
      const row = Array.isArray(data) && data[0] ? readPrepareRow(data[0]) : null
      return { data: row, error: error ? { code: error.code, message: error.message } : null }
    },
    async claim(extractionId) {
      const { data, error } = await adminClient.rpc('n52_claim_extraction', { p_extraction_id: extractionId })
      const row = Array.isArray(data) ? data[0] : null
      return {
        data: row && typeof row.claimed === 'boolean' && typeof row.status === 'string'
          ? { claimed: row.claimed, status: row.status }
          : null,
        error: error ? { code: error.code, message: error.message } : null,
      }
    },
    async getExtraction(extractionId) {
      const { data, error } = await adminClient.from('expense_capture_extractions')
        .select('id, attempt, status, proposal, provider, provider_version, model')
        .eq('id', extractionId)
        .maybeSingle()
      if (error || !data) return { data: null, error: error ? { code: error.code, message: error.message } : null }
      return { data, error: null }
    },
    async finalizeSuccess(extractionId, proposal) {
      const { data, error } = await adminClient.from('expense_capture_extractions')
        .update({ status: 'SUCCEEDED', proposal, completed_at: new Date().toISOString(), error_code: null, error_message_safe: null, updated_at: new Date().toISOString() })
        .eq('id', extractionId)
        .eq('status', 'PROCESSING')
        .select('id')
        .maybeSingle()
      return { error: error ? { code: error.code, message: error.message } : data ? null : { code: 'EXTRACTION_FINALIZE_RACE', message: 'No active extraction row was finalized.' } }
    },
    async finalizeFailure(extractionId, code) {
      const { data, error } = await adminClient.from('expense_capture_extractions')
        .update({ status: 'FAILED', failed_at: new Date().toISOString(), error_code: code, error_message_safe: 'No se pudo completar la extracción de prueba.', proposal: null, updated_at: new Date().toISOString() })
        .eq('id', extractionId)
        .eq('status', 'PROCESSING')
        .select('id')
        .maybeSingle()
      return { error: error ? { code: error.code, message: error.message } : data ? null : { code: 'EXTRACTION_FINALIZE_RACE', message: 'No active extraction row was finalized.' } }
    },
  }

  return handleExtractionRequest(request, services, url, mode)
})
