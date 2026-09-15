import {
  CANONICAL_SERVICE_FAMILIES,
  type AttributionClassification,
  type CanonicalServiceFamily,
  type DemandType,
  type RecurrenceType,
} from './types'

const serviceFamilySet = new Set<string>(CANONICAL_SERVICE_FAMILIES)
const googleSources = new Set(['google', 'googleads', 'google-ads', 'adwords'])
const metaSources = new Set(['meta', 'facebook', 'instagram'])
const paidMediums = new Set(['cpc', 'ppc', 'paid', 'paid_search', 'paid_social', 'social_paid'])
const knownLeadStatuses = new Set(['new', 'contacted', 'quoted', 'won', 'lost'])

export interface NormalizedAttribution {
  classification: AttributionClassification
  campaignKey: string
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
}

export interface NormalizedDemandRecord {
  serviceFamily: CanonicalServiceFamily
  source: string
  demandType: DemandType
  city: string
  recurrenceType: RecurrenceType
  frequencyBand: string
  timeWindow: string
  hotelCheckoutVolumeBand: string
  residentialSizeBand: string
  week: string | null
  month: string | null
  estimateAvailable: boolean
  manualReview: boolean
  tierARule: string | null
  attribution: NormalizedAttribution
  leadStatus: string | null
}

function normalizedText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const valueText = String(value).trim().replace(/\s+/g, ' ')
  return valueText ? valueText.slice(0, maxLength) : null
}

function dimension(value: unknown, fallback = 'unknown'): string {
  return normalizedText(value, 120)?.toLocaleLowerCase('en-US') ?? fallback
}

export function normalizeServiceFamily(value: unknown): CanonicalServiceFamily {
  const candidate = dimension(value)
  return serviceFamilySet.has(candidate) ? candidate as CanonicalServiceFamily : 'other'
}

export function normalizeRecurrence(operational: Record<string, unknown>): RecurrenceType {
  const value = dimension(operational.recurrence_type ?? operational.frequency_band)
  if (['weekly', 'biweekly', 'monthly', 'recurring'].includes(value)) return 'recurring'
  if (['one_off', 'one-off', 'once', 'single'].includes(value)) return 'one_off'
  if (['flexible', 'flexible_other'].includes(value)) return 'flexible'
  if (value === 'none') return 'none'
  return 'unknown'
}

function dateParts(value: string | null | undefined): { week: string; month: string } | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = utcDate.getUTCDay() || 7
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day)
  const isoYear = utcDate.getUTCFullYear()
  const yearStart = new Date(Date.UTC(isoYear, 0, 1))
  const week = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7)
  const original = new Date(value)
  const month = `${original.getUTCFullYear()}-${String(original.getUTCMonth() + 1).padStart(2, '0')}`

  return { week: `${isoYear}-W${String(week).padStart(2, '0')}`, month }
}

function isPresent(value: unknown): boolean {
  return normalizedText(value, 500) !== null
}

export function normalizeAttribution(attribution: Record<string, unknown>): NormalizedAttribution {
  const utmSource = normalizedText(attribution.utm_source, 100)?.toLocaleLowerCase('en-US') ?? null
  const utmMedium = normalizedText(attribution.utm_medium, 100)?.toLocaleLowerCase('en-US') ?? null
  const utmCampaign = normalizedText(attribution.utm_campaign, 150)?.toLocaleLowerCase('en-US') ?? null
  const hasUtm = Boolean(utmSource || utmMedium || utmCampaign || normalizedText(attribution.utm_content, 150) || normalizedText(attribution.utm_term, 150))
  const hasReferrer = isPresent(attribution.referrer)

  let classification: AttributionClassification = 'unknown'
  if (!hasUtm && !hasReferrer) {
    classification = 'direct'
  } else if (utmSource && googleSources.has(utmSource) && utmMedium && paidMediums.has(utmMedium)) {
    classification = 'google_ads'
  } else if (utmSource && metaSources.has(utmSource) && utmMedium && paidMediums.has(utmMedium)) {
    classification = 'meta_ads'
  } else if (utmMedium === 'organic') {
    classification = 'organic'
  } else if (utmMedium === 'referral' || hasReferrer) {
    classification = 'referral'
  }

  const campaignKey = utmCampaign
    ? `${utmSource ?? 'unknown'}/${utmMedium ?? 'unknown'}/${utmCampaign}`
    : utmSource || utmMedium
      ? `${utmSource ?? 'unknown'}/${utmMedium ?? 'unknown'}`
      : classification

  return { classification, campaignKey, utmSource, utmMedium, utmCampaign }
}

function demandType(serviceFamily: CanonicalServiceFamily): DemandType {
  if (serviceFamily === 'residential') return 'residential'
  if (serviceFamily === 'tourist') return 'tourist'
  if (serviceFamily === 'office_commercial' || serviceFamily === 'gym' || serviceFamily === 'hotel') return 'b2b'
  return 'other'
}

export function normalizeDemandRecord(record: {
  source?: string | null
  createdAt: string | null | undefined
  operationalSummary: Record<string, unknown>
  attributionSummary: Record<string, unknown>
  estimate: Record<string, unknown> | null | undefined
  review: Record<string, unknown>
  leadStatus?: string | null
}): NormalizedDemandRecord {
  const serviceFamily = normalizeServiceFamily(record.operationalSummary.service_family)
  const parts = dateParts(record.createdAt)
  const estimateAvailable = Boolean(record.estimate && typeof record.estimate.rule_id === 'string')
  const manualReview = record.review.manual_review === true || !estimateAvailable
  const leadStatus = typeof record.leadStatus === 'string' && knownLeadStatuses.has(record.leadStatus)
    ? record.leadStatus
    : null

  return {
    serviceFamily,
    source: dimension(record.source, 'public_web'),
    demandType: demandType(serviceFamily),
    city: dimension(record.operationalSummary.city),
    recurrenceType: normalizeRecurrence(record.operationalSummary),
    frequencyBand: dimension(record.operationalSummary.frequency_band),
    timeWindow: dimension(record.operationalSummary.time_window),
    hotelCheckoutVolumeBand: dimension(record.operationalSummary.checkout_volume_band),
    residentialSizeBand: dimension(record.operationalSummary.size_band),
    week: parts?.week ?? null,
    month: parts?.month ?? null,
    estimateAvailable,
    manualReview,
    tierARule: estimateAvailable ? normalizedText(record.estimate?.rule_id, 20) : null,
    attribution: normalizeAttribution(record.attributionSummary),
    leadStatus,
  }
}
