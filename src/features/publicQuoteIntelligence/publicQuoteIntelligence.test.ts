import { describe, expect, it } from 'vitest'
import { buildPublicQuoteDemandIntelligence } from './aggregation'
import { normalizeAttribution } from './normalization'
import type { DemandIntelligenceSourceRecord } from './types'

const createdAt = '2026-09-15T10:00:00.000Z'
let nextSubmissionNumber = 0

function record(overrides: Partial<DemandIntelligenceSourceRecord> = {}): DemandIntelligenceSourceRecord {
  return {
    submissionId: `submission-${nextSubmissionNumber++}`,
    createdAt,
    operationalSummary: {
      service_family: 'residential',
      city: 'Barcelona',
      size_band: '41-70',
      frequency_band: 'weekly',
      recurrence_type: 'weekly',
      time_window: 'noche',
      checkout_volume_band: null,
      operational_needs: { standardCleaning: true },
    },
    attributionSummary: {
      utm_source: 'meta',
      utm_medium: 'paid_social',
      utm_campaign: 'septiembre',
    },
    estimate: {
      rule_id: 'RES-B',
      base_ex_vat: 80,
      labor_cost: 40,
    },
    review: { manual_review: false },
    leadStatus: 'new',
    ...overrides,
  }
}

describe('public quote demand intelligence', () => {
  it('classifies attribution only from explicit campaign signals', () => {
    expect(normalizeAttribution({})).toMatchObject({ classification: 'direct', campaignKey: 'direct' })
    expect(normalizeAttribution({ utm_source: 'Google', utm_medium: 'CPC', utm_campaign: 'Brand' })).toMatchObject({
      classification: 'google_ads',
      campaignKey: 'google/cpc/brand',
    })
    expect(normalizeAttribution({ utm_source: 'facebook', utm_medium: 'paid_social' })).toMatchObject({ classification: 'meta_ads' })
    expect(normalizeAttribution({ utm_medium: 'organic' })).toMatchObject({ classification: 'organic' })
    expect(normalizeAttribution({ referrer: 'https://example.invalid' })).toMatchObject({ classification: 'referral' })
    expect(normalizeAttribution({ utm_source: 'unknown-source' })).toMatchObject({ classification: 'unknown' })
  })

  it('covers all canonical service families without changing them into person-level fields', () => {
    const services = ['residential', 'deep_cleaning', 'tourist', 'office_commercial', 'gym', 'hotel', 'post_work_tenant_change', 'other']
    const report = buildPublicQuoteDemandIntelligence(services.map((service, index) => record({
      submissionId: `service-${index}`,
      operationalSummary: {
        service_family: service,
        city: index % 2 ? 'Mataro' : 'Barcelona',
        size_band: service === 'residential' ? '41-70' : null,
        frequency_band: service === 'tourist' ? 'weekly' : 'one_off',
        recurrence_type: service === 'tourist' ? 'weekly' : 'one_off',
        time_window: 'noche',
        checkout_volume_band: service === 'hotel' ? '26_50' : null,
      },
      estimate: service === 'residential' ? { rule_id: 'RES-B' } : null,
      review: { manual_review: service !== 'residential' },
    })))

    expect(report.serviceBreakdown.map((row) => row.serviceFamily).sort()).toEqual(services.sort())
    expect(report.touristRequestCount).toBe(1)
    expect(report.hotelRequestCount).toBe(1)
    expect(report.hotelCheckoutBandDistribution).toEqual([{ key: '26_50', requestCount: 1, share: 1 }])
    expect(report.residentialSizeDistribution).toEqual([{ key: '41-70', requestCount: 1, share: 1 }])
  })

  it('deduplicates submissions and calculates recurrence, manual review and Tier-A shares', () => {
    const first = record({ submissionId: 'same-submission' })
    const report = buildPublicQuoteDemandIntelligence([
      first,
      first,
      record({
        submissionId: 'manual',
        operationalSummary: { ...first.operationalSummary, frequency_band: 'one_off', recurrence_type: 'one_off' },
        estimate: null,
        review: { manual_review: true },
        leadStatus: 'lost',
      }),
      record({ submissionId: 'converted', leadStatus: 'won' }),
    ])

    expect(report.totals).toMatchObject({
      requestCount: 3,
      uniqueSubmissionCount: 3,
      recurringRequestShare: 0.6667,
      manualReviewShare: 0.3333,
      tierAShare: 0.6667,
    })
    expect(report.outcomeMetrics).toMatchObject({ knownOutcomeCount: 3, convertedCount: 1, lostCount: 1, conversionRate: 0.3333 })
  })

  it('suppresses low-volume campaign and attribution groups at the security threshold', () => {
    const meta = Array.from({ length: 3 }, (_, index) => record({ submissionId: `meta-${index}` }))
    const google = Array.from({ length: 3 }, (_, index) => record({
      submissionId: `google-${index}`,
      attributionSummary: { utm_source: 'Google', utm_medium: 'CPC', utm_campaign: 'marca' },
      leadStatus: index === 0 ? 'won' : 'quoted',
    }))
    const lowVolume = record({ submissionId: 'low-volume', attributionSummary: { utm_source: 'newsletter', utm_campaign: 'one-person' } })
    const report = buildPublicQuoteDemandIntelligence([...meta, ...google, lowVolume])

    expect(report.aggregationThreshold).toBe(3)
    expect(report.attributionBreakdown.map((row) => row.key)).toEqual(['google_ads', 'meta_ads'])
    expect(report.sourceBreakdown).toEqual([{ key: 'public_web', requestCount: 7, share: 1 }])
    expect(report.utmSourceBreakdown.map((row) => row.key)).toEqual(['google', 'meta'])
    expect(report.utmCampaignBreakdown.map((row) => row.key)).toEqual(['marca', 'septiembre'])
    expect(report.campaignBreakdown.map((row) => row.campaignKey)).toEqual(['google/cpc/marca', 'meta/paid_social/septiembre'])
    expect(report.campaignBreakdown[0].convertedCount).toBe(1)
  })

  it('keeps consent independent and excludes PII, notes, click IDs and internal prices', () => {
    const source = record({
      submissionId: 'privacy-source',
      operationalSummary: {
        service_family: 'residential',
        city: 'Barcelona',
        size_band: '41-70',
        frequency_band: 'weekly',
        recurrence_type: 'weekly',
        time_window: 'noche',
        details: 'private free text',
        full_name: 'Private Name',
        postal_code: '08001',
      },
      attributionSummary: {
        utm_source: 'meta',
        utm_medium: 'paid_social',
        gclid: 'raw-click-id',
        fbclid: 'raw-meta-id',
      },
      estimate: { rule_id: 'RES-B', base_ex_vat: 80, labor_cost: 40, customer_price: null },
      review: { manual_review: false, marketing_contact_opt_in: true, analytics_consent: false },
    })
    const reportWithOptionalConsent = buildPublicQuoteDemandIntelligence([source])
    const reportWithOtherConsent = buildPublicQuoteDemandIntelligence([{
      ...source,
      review: { manual_review: false, marketing_contact_opt_in: false, analytics_consent: true },
    }])
    const serialized = JSON.stringify(reportWithOptionalConsent)

    expect(reportWithOptionalConsent).toEqual(reportWithOtherConsent)
    expect(serialized).not.toMatch(/full_name|phone|email|details|postal_code|gclid|fbclid|base_ex_vat|labor_cost|customer_price|raw-click-id|raw-meta-id/i)
    expect(serialized).not.toContain('marketing_contact_opt_in')
    expect(serialized).not.toContain('analytics_consent')
  })
})
