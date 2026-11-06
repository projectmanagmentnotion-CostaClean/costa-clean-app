import { getSupabaseClient } from '../../lib/supabase'
import {
  buildExpenseCaptureStoragePath,
  createExpenseCaptureIdempotencyKey,
  EXPENSE_CAPTURE_BUCKET,
  sha256File,
  validateExpenseCaptureFile,
  type ExpenseCaptureDocumentContract,
  type ExpenseCaptureSessionContract,
  type ExpenseCaptureSource,
} from './expenseCaptureFoundation'
import type { ExpenseConfirmationInput } from './expenseConfirmation'
import type { ExpenseUpsertInput } from './types'

function getClient() {
  const { client, error } = getSupabaseClient()
  if (error || !client) throw new Error(error ?? 'No se pudo crear el cliente Supabase.')
  return client
}

export async function createExpenseCaptureSession(source: ExpenseCaptureSource, idempotencyKey = createExpenseCaptureIdempotencyKey()) {
  const { data, error } = await getClient().rpc('create_expense_capture_session', {
    p_source: source,
    p_idempotency_key: idempotencyKey,
  })
  if (error) throw new Error(error.message)
  return data as ExpenseCaptureSessionContract
}

export async function attachExpenseCaptureDocument(session: ExpenseCaptureSessionContract, file: File, pageIndex = 0) {
  const validationError = validateExpenseCaptureFile(file)
  if (validationError) throw new Error(validationError)
  const sha256 = await sha256File(file)
  const storagePath = buildExpenseCaptureStoragePath(session.id, sha256)
  const client = getClient()
  const { error: uploadError } = await client.storage.from(EXPENSE_CAPTURE_BUCKET).upload(storagePath, file, { cacheControl: '3600', upsert: true })
  if (uploadError) throw new Error(uploadError.message)
  try {
    const { data, error } = await client.rpc('attach_expense_capture_document', {
      p_capture_session_id: session.id,
      p_storage_path: storagePath,
      p_original_filename: file.name,
      p_mime_type: file.type,
      p_file_size_bytes: file.size,
      p_sha256: sha256,
      p_page_index: pageIndex,
    })
    if (error) throw new Error(error.message)
    return { ...(data as ExpenseCaptureDocumentContract), originalFilename: file.name, mimeType: file.type as ExpenseCaptureDocumentContract['mimeType'], sizeBytes: file.size, sha256 }
  } catch (cause) {
    await client.storage.from(EXPENSE_CAPTURE_BUCKET).remove([storagePath])
    throw cause
  }
}

export async function cancelExpenseCaptureSession(sessionId: string): Promise<void> {
  const { data, error } = await getClient().rpc('cancel_expense_capture_session', { p_capture_session_id: sessionId })
  if (error) throw new Error(error.message)
  const paths = Array.isArray(data?.storage_paths) ? data.storage_paths.filter((path: unknown): path is string => typeof path === 'string') : []
  if (paths.length) {
    const { error: removeError } = await getClient().storage.from(EXPENSE_CAPTURE_BUCKET).remove(paths)
    if (removeError) throw new Error(removeError.message)
  }
}

export interface ConfirmExpenseCaptureResult {
  confirmation_id: string
  expense_id: string
  reused: boolean
}

/**
 * N5.5 server transaction boundary. The RPC owns auth, normalization
 * ownership, idempotency, expense creation and capture-session completion.
 * This client never writes the expenses table directly for a capture flow.
 */
export async function confirmExpenseCapture(
  session: ExpenseCaptureSessionContract,
  document: ExpenseCaptureDocumentContract,
  normalizationId: string,
  idempotencyKey: string,
  confirmation: ExpenseConfirmationInput & { payload: ExpenseUpsertInput },
): Promise<ConfirmExpenseCaptureResult> {
  if (!confirmation.confirmed) throw new Error('La confirmación humana es obligatoria.')
  const client = getClient()
  const { data: authData, error: authError } = await client.auth.getUser()
  if (authError || !authData.user?.id) throw new Error('La sesión autenticada no está disponible.')
  const { data, error } = await client.rpc('confirm_expense_capture', {
    p_capture_session_id: session.id,
    p_capture_document_id: document.id,
    p_normalization_id: normalizationId,
    p_authenticated_user_id: authData.user.id,
    p_idempotency_key: idempotencyKey,
    p_duplicate_decision: confirmation.duplicateDecision,
    p_duplicate_expense_id: confirmation.duplicateCandidate?.expenseId ?? null,
    p_payload: { confirmed: true, ...confirmation.payload },
  })
  if (error) throw new Error(error.message)
  if (!data || typeof data !== 'object' || typeof data.confirmation_id !== 'string' || typeof data.expense_id !== 'string' || typeof data.reused !== 'boolean') {
    throw new Error('La respuesta de confirmación no es válida.')
  }
  return data as ConfirmExpenseCaptureResult
}
