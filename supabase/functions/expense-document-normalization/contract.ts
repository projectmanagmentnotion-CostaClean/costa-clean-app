export type N53ClaimAction = 'CREATED' | 'EXISTING_PROCESSING' | 'EXISTING_SUCCEEDED' | 'RETRY_CREATED'
export type N53Status = 'PROCESSING' | 'SUCCEEDED' | 'FAILED'

export interface N53ClaimRow {
  action: N53ClaimAction
  normalization_id: string
  extraction_id: string
  attempt_number: number
  status: 'PROCESSING' | 'SUCCEEDED'
  schema_version: number
  normalizer_version: string
  normalization_key: string
  input_hash: string
  normalized_proposal: unknown | null
  output_hash: string | null
  review_status: string | null
  reconciliation_status: string | null
}

export interface N53FinalizeSuccessRow {
  normalization_id: string
  extraction_id: string
  attempt_number: number
  status: 'SUCCEEDED'
  schema_version: number
  normalizer_version: string
  normalization_key: string
  normalized_proposal: unknown
  output_hash: string
  review_status: string
  reconciliation_status: string
}

export interface N53FinalizeFailureRow {
  normalization_id: string
  extraction_id: string
  attempt_number: number
  status: 'FAILED'
  error_code: string
}

export interface N53NormalizationRow extends N53FinalizeSuccessRow {
  created_at?: string
  updated_at?: string
}

export interface N53ExtractionRow {
  id: string
  capture_document_id: string
  schema_version: number
  status: string
  proposal: unknown | null
  created_by: string
}

export interface N53RpcError { code?: string; message?: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const HASH = /^[0-9a-f]{64}$/u
const CLAIM_ACTIONS = new Set<N53ClaimAction>(['CREATED', 'EXISTING_PROCESSING', 'EXISTING_SUCCEEDED', 'RETRY_CREATED'])

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}
function string(value: unknown): string | null { return typeof value === 'string' ? value : null }
function uuid(value: unknown): string | null { return typeof value === 'string' && UUID.test(value) ? value : null }
function hash(value: unknown): string | null { return typeof value === 'string' && HASH.test(value) ? value : null }
function integer(value: unknown): number | null { return typeof value === 'number' && Number.isInteger(value) ? value : null }

export function readClaimRow(value: unknown): N53ClaimRow | null {
  const row = record(value)
  const action = string(row?.action) as N53ClaimAction | null
  const normalizationId = uuid(row?.normalization_id)
  const extractionId = uuid(row?.extraction_id)
  const attempt = integer(row?.attempt_number)
  const schema = integer(row?.schema_version)
  const status = string(row?.status)
  const normalizer = string(row?.normalizer_version)
  const key = hash(row?.normalization_key)
  const inputHash = hash(row?.input_hash)
  const outputHash = row?.output_hash === null || row?.output_hash === undefined ? null : hash(row.output_hash)
  const reviewStatus = row?.review_status === null || row?.review_status === undefined ? null : string(row.review_status)
  const reconciliationStatus = row?.reconciliation_status === null || row?.reconciliation_status === undefined ? null : string(row.reconciliation_status)
  if (!action || !CLAIM_ACTIONS.has(action) || !normalizationId || !extractionId || !attempt || attempt < 1 || !schema || schema < 1 || (status !== 'PROCESSING' && status !== 'SUCCEEDED') || !normalizer || !key || !inputHash || (row?.output_hash !== null && row?.output_hash !== undefined && !outputHash) || (row?.review_status !== null && row?.review_status !== undefined && !reviewStatus) || (row?.reconciliation_status !== null && row?.reconciliation_status !== undefined && !reconciliationStatus)) return null
  return { action, normalization_id: normalizationId, extraction_id: extractionId, attempt_number: attempt, status, schema_version: schema, normalizer_version: normalizer, normalization_key: key, input_hash: inputHash, normalized_proposal: row?.normalized_proposal ?? null, output_hash: outputHash, review_status: reviewStatus, reconciliation_status: reconciliationStatus }
}

export function readExtractionRow(value: unknown): N53ExtractionRow | null {
  const row = record(value)
  const id = uuid(row?.id)
  const documentId = uuid(row?.capture_document_id)
  const schema = integer(row?.schema_version)
  const status = string(row?.status)
  const createdBy = uuid(row?.created_by)
  if (!id || !documentId || !schema || schema < 1 || !status || !createdBy || row?.proposal === null || row?.proposal === undefined) return null
  return { id, capture_document_id: documentId, schema_version: schema, status, proposal: row.proposal, created_by: createdBy }
}

export function readFinalizeSuccessRow(value: unknown): N53FinalizeSuccessRow | null {
  const row = record(value)
  const normalizationId = uuid(row?.normalization_id)
  const extractionId = uuid(row?.extraction_id)
  const attempt = integer(row?.attempt_number)
  const schema = integer(row?.schema_version)
  const status = string(row?.status)
  const key = hash(row?.normalization_key)
  const outputHash = hash(row?.output_hash)
  const normalizer = string(row?.normalizer_version)
  const review = string(row?.review_status)
  const reconciliation = string(row?.reconciliation_status)
  if (!normalizationId || !extractionId || !attempt || attempt < 1 || !schema || schema < 1 || status !== 'SUCCEEDED' || !key || !outputHash || !normalizer || !review || !reconciliation || row?.normalized_proposal === null || row?.normalized_proposal === undefined) return null
  return { normalization_id: normalizationId, extraction_id: extractionId, attempt_number: attempt, status: 'SUCCEEDED', schema_version: schema, normalizer_version: normalizer, normalization_key: key, normalized_proposal: row.normalized_proposal, output_hash: outputHash, review_status: review, reconciliation_status: reconciliation }
}

export function readFinalizeFailureRow(value: unknown): N53FinalizeFailureRow | null {
  const row = record(value)
  const normalizationId = uuid(row?.normalization_id)
  const extractionId = uuid(row?.extraction_id)
  const attempt = integer(row?.attempt_number)
  const status = string(row?.status)
  const errorCode = string(row?.error_code)
  if (!normalizationId || !extractionId || !attempt || attempt < 1 || status !== 'FAILED' || !errorCode) return null
  return { normalization_id: normalizationId, extraction_id: extractionId, attempt_number: attempt, status: 'FAILED', error_code: errorCode }
}
