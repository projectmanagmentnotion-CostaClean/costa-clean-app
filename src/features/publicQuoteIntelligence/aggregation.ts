import { normalizeDemandRecord, type NormalizedDemandRecord } from './normalization'
import {
  DEFAULT_AGGREGATION_THRESHOLD,
  PUBLIC_QUOTE_INTELLIGENCE_CONTRACT_VERSION,
  type CampaignDemandRow,
  type DemandIntelligenceSourceRecord,
  type DemandMetricRow,
  type PublicQuoteDemandIntelligenceReport,
  type ServiceCityDemandRow,
  type ServiceDemandRow,
} from './types'

type OutcomeStatus = 'new' | 'contacted' | 'quoted' | 'won' | 'lost'

function share(count: number, total: number): number {
  return total === 0 ? 0 : Number((count / total).toFixed(4))
}

function countBy(records: NormalizedDemandRecord[], keyFor: (record: NormalizedDemandRecord) => string): DemandMetricRow[] {
  const counts = new Map<string, number>()
  for (const record of records) {
    const key = keyFor(record)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([key, requestCount]) => ({ key, requestCount, share: share(requestCount, records.length) }))
}

function rateFor(records: NormalizedDemandRecord[], predicate: (record: NormalizedDemandRecord) => boolean): number {
  return share(records.filter(predicate).length, records.length)
}

function serviceBreakdown(records: NormalizedDemandRecord[]): ServiceDemandRow[] {
  const grouped = new Map<string, NormalizedDemandRecord[]>()
  for (const record of records) {
    const current = grouped.get(record.serviceFamily) ?? []
    current.push(record)
    grouped.set(record.serviceFamily, current)
  }

  return [...grouped.entries()]
    .sort((left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0]))
    .map(([serviceFamily, serviceRecords]) => ({
      key: serviceFamily,
      serviceFamily: serviceFamily as ServiceDemandRow['serviceFamily'],
      requestCount: serviceRecords.length,
      share: share(serviceRecords.length, records.length),
      recurringRequestShare: rateFor(serviceRecords, (record) => record.recurrenceType === 'recurring'),
      manualReviewShare: rateFor(serviceRecords, (record) => record.manualReview),
      tierAShare: rateFor(serviceRecords, (record) => record.estimateAvailable),
    }))
}

function serviceCityBreakdown(records: NormalizedDemandRecord[]): ServiceCityDemandRow[] {
  const grouped = new Map<string, { serviceFamily: ServiceCityDemandRow['serviceFamily']; city: string; count: number }>()
  for (const record of records) {
    const key = `${record.serviceFamily}|${record.city}`
    const current = grouped.get(key) ?? { serviceFamily: record.serviceFamily, city: record.city, count: 0 }
    current.count += 1
    grouped.set(key, current)
  }

  return [...grouped.values()]
    .sort((left, right) => right.count - left.count || left.serviceFamily.localeCompare(right.serviceFamily) || left.city.localeCompare(right.city))
    .map(({ serviceFamily, city, count }) => ({
      key: `${serviceFamily}|${city}`,
      serviceFamily,
      city,
      requestCount: count,
      share: share(count, records.length),
    }))
}

function campaignBreakdown(records: NormalizedDemandRecord[], threshold: number): CampaignDemandRow[] {
  const grouped = new Map<string, NormalizedDemandRecord[]>()
  for (const record of records) {
    const key = record.attribution.campaignKey
    const current = grouped.get(key) ?? []
    current.push(record)
    grouped.set(key, current)
  }

  return [...grouped.entries()]
    .filter(([, group]) => group.length >= threshold)
    .sort((left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0]))
    .map(([campaignKey, group]) => {
      const first = group[0].attribution
      return {
        key: campaignKey,
        campaignKey,
        requestCount: group.length,
        share: share(group.length, records.length),
        utmSource: first.utmSource,
        utmMedium: first.utmMedium,
        utmCampaign: first.utmCampaign,
        serviceMix: countBy(group, (record) => record.serviceFamily),
        cityMix: countBy(group, (record) => record.city),
        recurringRequestShare: rateFor(group, (record) => record.recurrenceType === 'recurring'),
        manualReviewShare: rateFor(group, (record) => record.manualReview),
        tierAShare: rateFor(group, (record) => record.estimateAvailable),
        convertedCount: group.filter((record) => record.leadStatus === 'won').length,
      }
    })
}

function outcomeMetrics(records: NormalizedDemandRecord[]): PublicQuoteDemandIntelligenceReport['outcomeMetrics'] {
  const known = records.filter((record) => record.leadStatus !== null)
  const countStatus = (status: OutcomeStatus) => known.filter((record) => record.leadStatus === status).length
  const convertedCount = countStatus('won')

  return {
    knownOutcomeCount: known.length,
    newCount: countStatus('new'),
    contactedCount: countStatus('contacted'),
    quotedCount: countStatus('quoted'),
    convertedCount,
    lostCount: countStatus('lost'),
    conversionRate: known.length === 0 ? null : share(convertedCount, known.length),
  }
}

function monthBounds(records: NormalizedDemandRecord[]): { startMonth: string | null; endMonth: string | null } {
  const months = records.map((record) => record.month).filter((month): month is string => month !== null).sort()
  return { startMonth: months[0] ?? null, endMonth: months.at(-1) ?? null }
}

export function buildPublicQuoteDemandIntelligence(
  sourceRecords: DemandIntelligenceSourceRecord[],
  aggregationThreshold = DEFAULT_AGGREGATION_THRESHOLD,
): PublicQuoteDemandIntelligenceReport {
  if (!Number.isInteger(aggregationThreshold) || aggregationThreshold < 2) {
    throw new Error('Aggregation threshold must be an integer of at least 2.')
  }

  // Idempotent source rows are collapsed before any metric is calculated.
  const uniqueBySubmission = new Map<string, DemandIntelligenceSourceRecord>()
  for (const record of sourceRecords) {
    if (!uniqueBySubmission.has(record.submissionId)) uniqueBySubmission.set(record.submissionId, record)
  }
  const records = [...uniqueBySubmission.values()].map(normalizeDemandRecord)
  const recurring = records.filter((record) => record.recurrenceType === 'recurring').length
  const manual = records.filter((record) => record.manualReview).length
  const tierA = records.filter((record) => record.estimateAvailable).length

  return {
    contractVersion: PUBLIC_QUOTE_INTELLIGENCE_CONTRACT_VERSION,
    aggregationThreshold,
    period: monthBounds(records),
    totals: {
      requestCount: records.length,
      uniqueSubmissionCount: records.length,
      recurringRequestShare: share(recurring, records.length),
      manualReviewShare: share(manual, records.length),
      tierAShare: share(tierA, records.length),
    },
    serviceBreakdown: serviceBreakdown(records),
    sourceBreakdown: countBy(records, (record) => record.source),
    utmSourceBreakdown: countBy(records, (record) => record.attribution.utmSource ?? 'unknown')
      .filter((row) => row.requestCount >= aggregationThreshold),
    utmCampaignBreakdown: countBy(records, (record) => record.attribution.utmCampaign ?? 'unknown')
      .filter((row) => row.requestCount >= aggregationThreshold),
    geographyBreakdown: countBy(records, (record) => record.city),
    serviceCityBreakdown: serviceCityBreakdown(records),
    recurrenceBreakdown: countBy(records, (record) => record.recurrenceType),
    timeBreakdown: countBy(records, (record) => record.week ?? 'unknown'),
    monthBreakdown: countBy(records, (record) => record.month ?? 'unknown'),
    timeWindowBreakdown: countBy(records, (record) => record.timeWindow),
    frequencyBreakdown: countBy(records, (record) => record.frequencyBand),
    touristRequestCount: records.filter((record) => record.demandType === 'tourist').length,
    hotelRequestCount: records.filter((record) => record.serviceFamily === 'hotel').length,
    hotelCheckoutBandDistribution: countBy(records.filter((record) => record.serviceFamily === 'hotel'), (record) => record.hotelCheckoutVolumeBand),
    residentialSizeDistribution: countBy(records.filter((record) => record.serviceFamily === 'residential'), (record) => record.residentialSizeBand),
    attributionBreakdown: countBy(records, (record) => record.attribution.classification)
      .filter((row) => row.requestCount >= aggregationThreshold),
    campaignBreakdown: campaignBreakdown(records, aggregationThreshold),
    outcomeMetrics: outcomeMetrics(records),
  }
}
