export const PORTAL_MAX_BODY_BYTES = 12_288
export const PORTAL_SIGNED_URL_TTL_SECONDS = 60

export type PortalSurface = 'account' | 'service' | 'members' | 'invoice'

type JsonObject = Record<string, unknown>

export type PortalRequest =
  | {
      action: 'submitApplication'
      contactName: string | null
      companyName: string | null
      contactPhone: string | null
      privacyNoticeVersion: string
    }
  | { action: 'acceptInvitation'; token: string }
  | { action: 'submitProfileChange'; clientId: string; changes: JsonObject }
  | { action: 'submitPropertyChange'; clientId: string; propertyId: string; changes: JsonObject }
  | {
      action: 'submitServiceRequest'
      clientId: string
      propertyId: string
      serviceType: string
      preferredDate: string
      preferredTimeWindow: string | null
      notes: string | null
      idempotencyKey: string
    }
  | {
      action: 'cancelServiceRequest'
      clientId: string
      requestId: string
      expectedVersion: number
    }
  | { action: 'inviteMember'; clientId: string; email: string; role: string }
  | { action: 'revokeMember'; clientId: string; membershipId: string }
  | { action: 'downloadInvoice'; clientId: string; invoiceId: string; documentId: string }

const surfaceActions: Record<PortalSurface, Set<PortalRequest['action']>> = {
  account: new Set(['submitApplication', 'acceptInvitation']),
  service: new Set([
    'submitProfileChange',
    'submitPropertyChange',
    'submitServiceRequest',
    'cancelServiceRequest',
  ]),
  members: new Set(['inviteMember', 'revokeMember']),
  invoice: new Set(['downloadInvoice']),
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
const clientIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u
const datePattern = /^\d{4}-\d{2}-\d{2}$/u
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u
const tokenPattern = /^[A-Za-z0-9_-]{43,128}$/u

export function validatePortalRequest(surface: PortalSurface, value: unknown): PortalRequest | null {
  if (!isObject(value) || typeof value.action !== 'string') return null
  const action = value.action as PortalRequest['action']
  if (!surfaceActions[surface].has(action)) return null

  switch (action) {
    case 'submitApplication':
      if (!hasExactKeys(value, ['action', 'contactName', 'companyName', 'contactPhone', 'privacyNoticeVersion'])) return null
      if (!nullableString(value.contactName, 160)
        || !nullableString(value.companyName, 200)
        || !nullableString(value.contactPhone, 40)
        || !requiredString(value.privacyNoticeVersion, 80)) return null
      return {
        action,
        contactName: normalizeNullable(value.contactName),
        companyName: normalizeNullable(value.companyName),
        contactPhone: normalizeNullable(value.contactPhone),
        privacyNoticeVersion: value.privacyNoticeVersion.trim(),
      }
    case 'acceptInvitation':
      if (!hasExactKeys(value, ['action', 'token'])
        || typeof value.token !== 'string'
        || !tokenPattern.test(value.token)) return null
      return { action, token: value.token }
    case 'submitProfileChange':
      if (!hasExactKeys(value, ['action', 'clientId', 'changes'])
        || !validClientId(value.clientId)
        || !validateChanges(value.changes, ['fullName', 'phone', 'email', 'taxId', 'billingAddress', 'companyRepresentative'], 6)) return null
      return { action, clientId: value.clientId, changes: value.changes }
    case 'submitPropertyChange':
      if (!hasExactKeys(value, ['action', 'clientId', 'propertyId', 'changes'])
        || !validClientId(value.clientId)
        || !validClientId(value.propertyId)
        || !validateChanges(value.changes, ['name', 'propertyType', 'address', 'city', 'postalCode'], 5)) return null
      return { action, clientId: value.clientId, propertyId: value.propertyId, changes: value.changes }
    case 'submitServiceRequest':
      if (!hasExactKeys(value, [
        'action', 'clientId', 'propertyId', 'serviceType', 'preferredDate',
        'preferredTimeWindow', 'notes', 'idempotencyKey',
      ])
        || !validClientId(value.clientId)
        || !validClientId(value.propertyId)
        || !oneOf(value.serviceType, ['regular_cleaning', 'deep_cleaning', 'move_cleaning', 'commercial_cleaning', 'other'])
        || typeof value.preferredDate !== 'string'
        || !datePattern.test(value.preferredDate)
        || !nullableOneOf(value.preferredTimeWindow, ['morning', 'afternoon', 'flexible'])
        || !nullableString(value.notes, 1000)
        || !validUuid(value.idempotencyKey)) return null
      return {
        action,
        clientId: value.clientId,
        propertyId: value.propertyId,
        serviceType: value.serviceType,
        preferredDate: value.preferredDate,
        preferredTimeWindow: value.preferredTimeWindow,
        notes: normalizeNullable(value.notes),
        idempotencyKey: value.idempotencyKey,
      }
    case 'cancelServiceRequest':
      if (!hasExactKeys(value, ['action', 'clientId', 'requestId', 'expectedVersion'])
        || !validClientId(value.clientId)
        || !validUuid(value.requestId)
        || !Number.isSafeInteger(value.expectedVersion)
        || Number(value.expectedVersion) < 1) return null
      return {
        action,
        clientId: value.clientId,
        requestId: value.requestId,
        expectedVersion: Number(value.expectedVersion),
      }
    case 'inviteMember':
      if (!hasExactKeys(value, ['action', 'clientId', 'email', 'role'])
        || !validClientId(value.clientId)
        || typeof value.email !== 'string'
        || value.email.length > 320
        || !emailPattern.test(value.email.trim())
        || !oneOf(value.role, ['client_admin', 'client_member'])) return null
      return { action, clientId: value.clientId, email: value.email.trim().toLowerCase(), role: value.role }
    case 'revokeMember':
      if (!hasExactKeys(value, ['action', 'clientId', 'membershipId'])
        || !validClientId(value.clientId)
        || !validUuid(value.membershipId)) return null
      return { action, clientId: value.clientId, membershipId: value.membershipId }
    case 'downloadInvoice':
      if (!hasExactKeys(value, ['action', 'clientId', 'invoiceId', 'documentId'])
        || !validClientId(value.clientId)
        || !validClientId(value.invoiceId)
        || !validUuid(value.documentId)) return null
      return {
        action,
        clientId: value.clientId,
        invoiceId: value.invoiceId,
        documentId: value.documentId,
      }
  }
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(value: JsonObject, expected: string[]): boolean {
  const actual = Object.keys(value).sort()
  const wanted = [...expected].sort()
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index])
}

function requiredString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max
}

function nullableString(value: unknown, max: number): boolean {
  return value === null || (typeof value === 'string' && value.trim().length <= max)
}

function normalizeNullable(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized || null
}

function validClientId(value: unknown): value is string {
  return typeof value === 'string' && clientIdPattern.test(value)
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && uuidPattern.test(value)
}

function oneOf<T extends string>(value: unknown, allowed: T[]): value is T {
  return typeof value === 'string' && allowed.includes(value as T)
}

function nullableOneOf<T extends string>(value: unknown, allowed: T[]): value is T | null {
  return value === null || oneOf(value, allowed)
}

function validateChanges(value: unknown, allowed: string[], maxFields: number): value is JsonObject {
  if (!isObject(value)) return false
  const keys = Object.keys(value)
  if (keys.length < 1 || keys.length > maxFields || keys.some((key) => !allowed.includes(key))) return false
  return Object.values(value).every((field) =>
    typeof field === 'string' && field.trim().length > 0 && field.trim().length <= 320
  )
}
