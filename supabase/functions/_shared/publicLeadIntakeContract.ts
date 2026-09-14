export const PUBLIC_LEAD_INTAKE_MAX_BODY_BYTES = 50_000
export const PUBLIC_LEAD_INTAKE_REPLAY_WINDOW_SECONDS = 300

export type PublicLeadAttribution = {
  landing_path: string
  referrer?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  gclid?: string
  gbraid?: string
  wbraid?: string
  fbclid?: string
}

export type PublicLeadRequest = {
  version: 'cp42b-v1'
  environment: 'qa'
  source: 'public_web'
  submission_id: string
  full_name: string
  phone: string
  email?: string
  service_type: string
  property_type?: string
  city: string
  postal_code?: string
  notes: Record<string, unknown>
  privacy_acknowledged: true
  marketing_contact_opt_in: boolean
  analytics_consent: boolean
  marketing_cookie_consent: boolean
  attribution: PublicLeadAttribution
}

export type PublicLeadDatabaseResponse = {
  ok: boolean
  code?: 'accepted' | 'rate_limited' | 'idempotent' | 'idempotency_conflict'
  receipt_id?: string
  lead_id?: string
}

export type PublicLeadErrorCode = 'invalid_request' | 'temporarily_unavailable' | 'rate_limited'

export type PublicLeadResponse = {
  ok: boolean
  receiptId?: string
  error?: { code: 'invalid_request' | 'temporarily_unavailable' | 'rate_limited'; message: string }
  retryAfterSeconds?: number
}

const allowedKeys = new Set([
  'version', 'environment', 'source', 'submission_id', 'full_name', 'phone', 'email',
  'service_type', 'property_type', 'city', 'postal_code', 'notes', 'privacy_acknowledged',
  'marketing_contact_opt_in', 'analytics_consent', 'marketing_cookie_consent', 'attribution',
])
const attributionKeys = new Set([
  'landing_path', 'referrer', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content',
  'utm_term', 'gclid', 'gbraid', 'wbraid', 'fbclid',
])
const adIdentifierKeys = ['gclid', 'gbraid', 'wbraid', 'fbclid'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isBoundedText(value: unknown, max: number, min = 0): value is string {
  return typeof value === 'string' && value.trim().length >= min && value.length <= max
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)
}

export function validatePublicLeadRequest(value: unknown): PublicLeadRequest | null {
  if (!isRecord(value)) return null
  const keys = Object.keys(value)
  if (keys.some((key) => !allowedKeys.has(key))) return null
  if (value.version !== 'cp42b-v1' || value.environment !== 'qa' || value.source !== 'public_web') return null
  if (!isUuid(value.submission_id)) return null
  if (!isBoundedText(value.full_name, 120, 1) || !isBoundedText(value.phone, 40, 5)) return null
  if (value.email !== undefined && (!isBoundedText(value.email, 254, 3) || !value.email.includes('@'))) return null
  if (!isBoundedText(value.service_type, 120, 1) || !isBoundedText(value.city, 120, 1)) return null
  if (value.property_type !== undefined && !isBoundedText(value.property_type, 80, 1)) return null
  if (value.postal_code !== undefined && (!isBoundedText(value.postal_code, 5, 5) || !/^\d{5}$/.test(value.postal_code))) return null
  if (!isRecord(value.notes) || JSON.stringify(value.notes).length > 6_000) return null
  if (value.privacy_acknowledged !== true) return null
  if (typeof value.marketing_contact_opt_in !== 'boolean'
    || typeof value.analytics_consent !== 'boolean'
    || typeof value.marketing_cookie_consent !== 'boolean') return null
  if (!isRecord(value.attribution)) return null
  if (Object.keys(value.attribution).some((key) => !attributionKeys.has(key))) return null
  if (!isBoundedText(value.attribution.landing_path, 2_048, 1)) return null
  for (const key of attributionKeys) {
    const item = value.attribution[key]
    if (item !== undefined && !isBoundedText(item, key === 'landing_path' || key === 'referrer' ? 2_048 : 500)) return null
  }
  if (!value.marketing_cookie_consent && adIdentifierKeys.some((key) => value.attribution[key] !== undefined)) return null
  return value as PublicLeadRequest
}
