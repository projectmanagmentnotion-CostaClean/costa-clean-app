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
