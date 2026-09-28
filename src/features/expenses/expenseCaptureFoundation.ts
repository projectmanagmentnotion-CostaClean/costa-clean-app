export const EXPENSE_CAPTURE_BUCKET = 'expense-receipts'
export const EXPENSE_CAPTURE_MAX_BYTES = 10 * 1024 * 1024
export const EXPENSE_CAPTURE_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const

export type ExpenseCaptureSource = 'camera' | 'upload' | 'manual'
export type ExpenseCaptureStatus = 'IDLE' | 'SELECTING' | 'VALIDATING' | 'UPLOADING' | 'UPLOADED' | 'READY_FOR_REVIEW' | 'ERROR'

export interface ExpenseCaptureFileMetadata {
  originalFilename: string
  mimeType: (typeof EXPENSE_CAPTURE_MIME_TYPES)[number]
  sizeBytes: number
  sha256: string
}

export interface ExpenseCaptureSessionContract {
  id: string
  status: 'UPLOADED' | 'CANCELLED'
  source: ExpenseCaptureSource
  idempotency_key: string
  created_at: string
  expires_at: string
}

export interface ExpenseCaptureDocumentContract extends ExpenseCaptureFileMetadata {
  id: string
  capture_session_id: string
  storage_path: string
  page_index: number
}

export function validateExpenseCaptureFile(file: Pick<File, 'type' | 'size' | 'name'>): string | null {
  if (file.size <= 0) return 'El documento está vacío.'
  if (file.size > EXPENSE_CAPTURE_MAX_BYTES) return 'El documento no puede superar 10 MB.'
  if (!EXPENSE_CAPTURE_MIME_TYPES.includes(file.type as (typeof EXPENSE_CAPTURE_MIME_TYPES)[number])) {
    return 'El documento debe ser PDF, JPEG, PNG o WEBP.'
  }
  const name = file.name.trim()
  if (!name || name.length > 255 || name.includes('..') || /[\\/]/u.test(name)) {
    return 'El nombre del documento no es válido.'
  }
  return null
}

export function buildExpenseCaptureStoragePath(sessionId: string, sha256: string): string {
  if (!/^[0-9a-f]{64}$/u.test(sha256)) throw new Error('La huella del documento no es válida.')
  if (!/^[0-9a-f-]{36}$/iu.test(sessionId)) throw new Error('La sesión de captura no es válida.')
  return `captures/${sessionId}/${sha256}`
}

export function createExpenseCaptureIdempotencyKey(): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return `N51-CAPTURE-${uuid}`
  const bytes = new Uint8Array(16)
  globalThis.crypto?.getRandomValues?.(bytes)
  return `N51-CAPTURE-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

export async function sha256File(file: Pick<File, 'arrayBuffer'>): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Este navegador no puede calcular la huella del documento.')
  const digest = await globalThis.crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

const transitions: Record<ExpenseCaptureStatus, readonly ExpenseCaptureStatus[]> = {
  IDLE: ['SELECTING'],
  SELECTING: ['VALIDATING', 'IDLE'],
  VALIDATING: ['UPLOADING', 'ERROR'],
  UPLOADING: ['UPLOADED', 'ERROR'],
  UPLOADED: ['READY_FOR_REVIEW', 'SELECTING', 'ERROR'],
  READY_FOR_REVIEW: ['SELECTING', 'IDLE'],
  ERROR: ['SELECTING', 'IDLE'],
}

export function transitionExpenseCaptureState(current: ExpenseCaptureStatus, next: ExpenseCaptureStatus): ExpenseCaptureStatus {
  if (!transitions[current].includes(next)) throw new Error(`Transición de captura no permitida: ${current} → ${next}`)
  return next
}
