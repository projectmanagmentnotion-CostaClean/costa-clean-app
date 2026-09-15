export const PUBLIC_QUOTE_INTELLIGENCE_CONTRACT_VERSION = 'public_quote_demand_intelligence_v1' as const
export const DEFAULT_AGGREGATION_THRESHOLD = 3

export const CANONICAL_SERVICE_FAMILIES = [
  'residential',
  'deep_cleaning',
  'tourist',
  'office_commercial',
  'gym',
  'hotel',
  'post_work_tenant_change',
  'other',
] as const

export type CanonicalServiceFamily = (typeof CANONICAL_SERVICE_FAMILIES)[number]
export type AttributionClassification = 'direct' | 'organic' | 'google_ads' | 'meta_ads' | 'referral' | 'unknown'
export type DemandType = 'residential' | 'tourist' | 'b2b' | 'other'
export type RecurrenceType = 'none' | 'one_off' | 'recurring' | 'flexible' | 'unknown'

export interface DemandIntelligenceSourceRecord {
  submissionId: string
  source?: string | null
  createdAt: string | null | undefined
  operationalSummary: Record<string, unknown>
  attributionSummary: Record<string, unknown>
  estimate: Record<string, unknown> | null | undefined
  review: Record<string, unknown>
  leadStatus?: string | null
}

export interface DemandMetricRow {
  key: string
  requestCount: number
  share: number
}

export interface ServiceDemandRow extends DemandMetricRow {
  serviceFamily: CanonicalServiceFamily
  recurringRequestShare: number
  manualReviewShare: number
  tierAShare: number
}

export interface ServiceCityDemandRow extends DemandMetricRow {
  serviceFamily: CanonicalServiceFamily
  city: string
}

export interface CampaignDemandRow extends DemandMetricRow {
  campaignKey: string
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  serviceMix: DemandMetricRow[]
  cityMix: DemandMetricRow[]
  recurringRequestShare: number
  manualReviewShare: number
  tierAShare: number
  convertedCount: number
}

export interface DemandOutcomeMetrics {
  knownOutcomeCount: number
  newCount: number
  contactedCount: number
  quotedCount: number
  convertedCount: number
  lostCount: number
  conversionRate: number | null
}

export interface PublicQuoteDemandIntelligenceReport {
  contractVersion: typeof PUBLIC_QUOTE_INTELLIGENCE_CONTRACT_VERSION
  aggregationThreshold: number
  period: {
    startMonth: string | null
    endMonth: string | null
  }
  totals: {
    requestCount: number
    uniqueSubmissionCount: number
    recurringRequestShare: number
    manualReviewShare: number
    tierAShare: number
  }
  serviceBreakdown: ServiceDemandRow[]
  sourceBreakdown: DemandMetricRow[]
  utmSourceBreakdown: DemandMetricRow[]
  utmCampaignBreakdown: DemandMetricRow[]
  geographyBreakdown: DemandMetricRow[]
  serviceCityBreakdown: ServiceCityDemandRow[]
  recurrenceBreakdown: DemandMetricRow[]
  timeBreakdown: DemandMetricRow[]
  monthBreakdown: DemandMetricRow[]
  timeWindowBreakdown: DemandMetricRow[]
  frequencyBreakdown: DemandMetricRow[]
  touristRequestCount: number
  hotelRequestCount: number
  hotelCheckoutBandDistribution: DemandMetricRow[]
  residentialSizeDistribution: DemandMetricRow[]
  attributionBreakdown: DemandMetricRow[]
  campaignBreakdown: CampaignDemandRow[]
  outcomeMetrics: DemandOutcomeMetrics
}
