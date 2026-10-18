import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.2'
import { preflight, CORS_HEADERS } from './cors.ts'
import { readClaimRow, readExtractionRow, readFinalizeFailureRow, readFinalizeSuccessRow, type N53NormalizationRow } from './contract.ts'
import { handleNormalizationRequest, type N53Services } from './orchestration.ts'
import { isNormalizationRuntimeReady, SERVER_RUNTIME_ENV } from './runtimeGuards.ts'
import { safeError } from './responseContract.ts'

Deno.serve(async (request: Request) => {
  const preflightResponse = preflight(request)
  if (preflightResponse) return preflightResponse
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/iu, '')
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const runtimeMode = Deno.env.get(SERVER_RUNTIME_ENV) ?? ''
  if (!token) return safeError('AUTH_REQUIRED', 'Autenticación requerida.', 401, CORS_HEADERS)
  if (!isNormalizationRuntimeReady(url, runtimeMode, publishableKey, serviceRoleKey)) return safeError('NORMALIZATION_RUNTIME_NOT_CONFIGURED', 'La normalización no está configurada.', 503, CORS_HEADERS)
  const userClient = createClient(url, publishableKey, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const adminClient = createClient(url, serviceRoleKey)
  const services: N53Services = {
    async getUser(accessToken) {
      const { data, error } = await userClient.auth.getUser(accessToken)
      return error || !data.user ? null : { id: data.user.id }
    },
    async requireActiveStaff() {
      const { error } = await userClient.rpc('require_n52_active_internal_staff')
      return error ? { code: error.code, message: error.message } : null
    },
    async getExtraction(extractionId) {
      const { data, error } = await userClient.from('expense_capture_extractions').select('id, capture_document_id, schema_version, status, proposal, created_by').eq('id', extractionId).maybeSingle()
      return { data: readExtractionRow(data), error: error ? { code: error.code, message: error.message } : null }
    },
    async claim(args) {
      const { data, error } = await adminClient.rpc('n53_claim_normalization', args)
      return { data: data?.[0] ? readClaimRow(data[0]) : null, error: error ? { code: error.code, message: error.message } : null }
    },
    async getNormalizationByKey(normalizationKey) {
      const { data, error } = await adminClient.from('expense_capture_normalizations').select('id, extraction_id, attempt_number, status, schema_version, normalizer_version, normalization_key, input_hash, normalized_proposal, output_hash, review_status, reconciliation_status').eq('normalization_key', normalizationKey).order('attempt_number', { ascending: false }).limit(1).maybeSingle()
      if (error || !data) return { data: null, error: error ? { code: error.code, message: error.message } : null }
      return { data: readClaimRow({ ...data, normalization_id: data.id, action: data.status === 'SUCCEEDED' ? 'EXISTING_SUCCEEDED' : 'EXISTING_PROCESSING' }), error: null }
    },
    async getNormalization(normalizationId) {
      const { data, error } = await adminClient.from('expense_capture_normalizations').select('*').eq('id', normalizationId).maybeSingle()
      if (error || !data) return { data: null, error: error ? { code: error.code, message: error.message } : null }
      const row = readFinalizeSuccessRow({ ...data, normalization_id: data.id })
      const normalized: N53NormalizationRow | null = row ? { normalization_id: row.normalization_id, extraction_id: row.extraction_id, attempt_number: row.attempt_number, status: row.status, schema_version: row.schema_version, normalizer_version: row.normalizer_version, normalization_key: row.normalization_key, normalized_proposal: row.normalized_proposal, output_hash: row.output_hash, review_status: row.review_status, reconciliation_status: row.reconciliation_status, created_at: typeof data.created_at === 'string' ? data.created_at : undefined, updated_at: typeof data.updated_at === 'string' ? data.updated_at : undefined } : null
      return { data: normalized, error: normalized ? null : { code: 'INVALID_RPC_RESULT', message: 'Invalid normalization row.' } }
    },
    async finalizeSuccess(args) {
      const { data, error } = await adminClient.rpc('n53_finalize_normalization_success', args)
      return { data: data?.[0] ? readFinalizeSuccessRow(data[0]) : null, error: error ? { code: error.code, message: error.message } : null }
    },
    async finalizeFailure(args) {
      const { data, error } = await adminClient.rpc('n53_finalize_normalization_failure', args)
      return { data: data?.[0] ? readFinalizeFailureRow(data[0]) : null, error: error ? { code: error.code, message: error.message } : null }
    },
  }
  return handleNormalizationRequest(request, services, url, runtimeMode)
})
