import { getSupabaseClient } from '../../lib/supabase'

export const EXPENSE_CAPTURE_BUCKET = 'expense-receipts'
export const EXPENSE_CAPTURE_MAX_BYTES = 10 * 1024 * 1024
export const EXPENSE_CAPTURE_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const
export type ExpenseCaptureSource = 'camera' | 'upload' | 'manual'

export interface ExpenseCaptureSession {
  id: string
  status: string
  source: ExpenseCaptureSource
  idempotency_key: string
  created_at: string
  expires_at: string
}

export interface ExpenseCaptureDocument {
  id: string
  capture_session_id: string
  storage_path: string
  sha256: string
  page_index: number
}

function getClient() {
  const { client, error } = getSupabaseClient()
  if (error || !client) throw new Error(error ?? 'No se pudo crear el cliente Supabase.')
  return client
}

export function validateExpenseCaptureFile(file: Pick<File, 'type' | 'size' | 'name'>): string | null {
  if (!file.size) return 'El documento está vacío.'
  if (file.size > EXPENSE_CAPTURE_MAX_BYTES) return 'El documento no puede superar 10 MB.'
  if (!EXPENSE_CAPTURE_MIME_TYPES.includes(file.type as (typeof EXPENSE_CAPTURE_MIME_TYPES)[number])) {
    return 'El documento debe ser PDF, JPEG, PNG o WEBP.'
  }
  if (!file.name.trim() || file.name.includes('..') || /[\\/]/.test(file.name)) {
    return 'El nombre del documento no es válido.'
  }
  return null
}

export function createExpenseCaptureIdempotencyKey(): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `N51-CAPTURE-${random}`
}

export async function sha256File(file: Pick<File, 'arrayBuffer'>): Promise<string> {
  const bytes = await file.arrayBuffer()
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function createExpenseCaptureSession(
  source: ExpenseCaptureSource,
  idempotencyKey = createExpenseCaptureIdempotencyKey(),
): Promise<ExpenseCaptureSession> {
  const { data, error } = await getClient().rpc('create_expense_capture_session', {
    p_source: source,
    p_idempotency_key: idempotencyKey,
  })
  if (error) throw new Error(error.message)
  return data as ExpenseCaptureSession
}

export async function attachExpenseCaptureDocument(
  session: ExpenseCaptureSession,
  file: File,
  pageIndex = 0,
): Promise<ExpenseCaptureDocument> {
  const validationError = validateExpenseCaptureFile(file)
  if (validationError) throw new Error(validationError)
  const sha256 = await sha256File(file)
  // The byte hash is the stable document identity for retries. Reusing this
  // path makes the storage write idempotent before the RPC deduplicates rows.
  const storagePath = `captures/${session.id}/${sha256}`
  const client = getClient()
  const { error: uploadError } = await client.storage.from(EXPENSE_CAPTURE_BUCKET).upload(storagePath, file, {
    cacheControl: '3600',
    upsert: true,
  })
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
    return data as ExpenseCaptureDocument
  } catch (cause) {
    await client.storage.from(EXPENSE_CAPTURE_BUCKET).remove([storagePath])
    throw cause
  }
}

export async function cancelExpenseCaptureSession(sessionId: string): Promise<void> {
  const client = getClient()
  const { data, error } = await client.rpc('cancel_expense_capture_session', {
    p_capture_session_id: sessionId,
  })
  if (error) throw new Error(error.message)
  const paths = Array.isArray(data?.storage_paths) ? data.storage_paths.filter((path: unknown): path is string => typeof path === 'string') : []
  if (paths.length) {
    const { error: removeError } = await client.storage.from(EXPENSE_CAPTURE_BUCKET).remove(paths)
    if (removeError) throw new Error(removeError.message)
  }
}
