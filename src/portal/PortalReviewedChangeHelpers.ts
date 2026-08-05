import type { PortalReviewedChangeReceipt } from './portalReadApi'
export type { PortalReviewedChangeReceipt } from './portalReadApi'

export type ChangeScope = 'profile' | 'property'
export type ChangeStep = 'fields' | 'values' | 'review' | 'success'
export type ChangeErrorKind = 'validation' | 'network' | 'timeout' | 'idempotency' | 'unavailable' | 'session_expired' | 'unknown'

export interface ChangeFieldDefinition {
  key: string
  label: string
  autoComplete: string
  currentValue: string
  inputMode?: 'text' | 'email' | 'tel' | 'numeric'
}

export interface StoredPortalChangeIntent {
  selectedFields: string[]
  draftValues: Record<string, string>
  idempotencyKey: string
  receipt: PortalReviewedChangeReceipt | null
}

export function buildStorageKey(clientId: string, scope: ChangeScope, resourceRef: string) {
  return `portal:reviewed-change:${clientId}:${scope}:${resourceRef}`
}

export function readStoredIntent(storageKey: string, fields: ChangeFieldDefinition[]): StoredPortalChangeIntent {
  const defaults: StoredPortalChangeIntent = {
    selectedFields: [],
    draftValues: Object.fromEntries(fields.map((field) => [field.key, field.currentValue])),
    idempotencyKey: crypto.randomUUID(),
    receipt: null,
  }

  if (typeof window === 'undefined') return defaults
  const raw = window.sessionStorage.getItem(storageKey)
  if (!raw) return defaults

  try {
    const parsed = JSON.parse(raw) as Partial<StoredPortalChangeIntent>
    return {
      selectedFields: Array.isArray(parsed.selectedFields) ? parsed.selectedFields.filter((value) => typeof value === 'string') : [],
      draftValues: isDraftRecord(parsed.draftValues) ? parsed.draftValues : defaults.draftValues,
      idempotencyKey: typeof parsed.idempotencyKey === 'string' && parsed.idempotencyKey ? parsed.idempotencyKey : crypto.randomUUID(),
      receipt: parsed.receipt && typeof parsed.receipt === 'object' ? sanitizeReceipt(parsed.receipt) : null,
    }
  } catch {
    return defaults
  }
}

export function buildChanges(selectedFields: ChangeFieldDefinition[], draftValues: Record<string, string>): Record<string, string> {
  const changes: Record<string, string> = {}
  for (const field of selectedFields) {
    const requested = draftValues[field.key] ?? ''
    if (normalizeText(requested) !== normalizeText(field.currentValue)) {
      changes[field.key] = requested.trim()
    }
  }
  return changes
}

export function classifyReviewedChangeError(error: unknown): { kind: ChangeErrorKind; message: string } {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  if (lower.includes('duplicate') || lower.includes('idempotency') || lower.includes('conflict')) {
    return { kind: 'idempotency', message: 'Ya existe una solicitud para esa misma intenciÃ³n. Reintenta con otro cambio.' }
  }
  if (lower.includes('portal_auth_configuration_unavailable') || lower.includes('available') || lower.includes('rpc_denied') || lower.includes('rpc_empty_response')) {
    return { kind: 'unavailable', message: 'Esta lectura todavÃ­a no estÃ¡ disponible para enviar.' }
  }
  if (lower.includes('timeout')) {
    return { kind: 'timeout', message: 'La red tardÃ³ demasiado. Conservamos la intenciÃ³n para un reintento.' }
  }
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('failed to fetch')) {
    return { kind: 'network', message: 'Se perdiÃ³ la conexiÃ³n. Puedes corregir y reintentar con la misma intenciÃ³n.' }
  }
  if (lower.includes('session') || lower.includes('auth')) {
    return { kind: 'session_expired', message: 'La sesiÃ³n caducÃ³. Vuelve a iniciar sesiÃ³n para continuar.' }
  }
  return { kind: 'unknown', message: 'No se pudo enviar la solicitud. Revisa los campos y vuelve a intentarlo.' }
}

function sanitizeReceipt(value: unknown): PortalReviewedChangeReceipt | null {
  const record = value as Partial<PortalReviewedChangeReceipt>
  if (typeof record.reference !== 'string' || typeof record.status !== 'string' || typeof record.requestedAt !== 'string') {
    return null
  }
  return {
    reference: record.reference,
    status: record.status,
    requestedAt: record.requestedAt,
    changedFields: Array.isArray(record.changedFields) ? record.changedFields.filter((item): item is string => typeof item === 'string') : [],
    requestType: record.requestType === 'property' ? 'property' : 'profile',
  }
}

function isDraftRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.values(value as Record<string, unknown>).every((item) => typeof item === 'string')
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}
