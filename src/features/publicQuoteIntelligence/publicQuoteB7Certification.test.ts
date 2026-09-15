import { describe, expect, it } from 'vitest'
import { buildPublicQuoteDemandIntelligence } from './aggregation'
import { DEFAULT_AGGREGATION_THRESHOLD, type DemandIntelligenceSourceRecord } from './types'

const createdAt = '2026-09-15T10:00:00.000Z'
let nextSubmissionId = 0

function record(overrides: Partial<DemandIntelligenceSourceRecord> = {}): DemandIntelligenceSourceRecord {
  const submissionId = overrides.submissionId ?? `b7-${nextSubmissionId++}`
  return {
    submissionId,
    source: 'public_web',
    createdAt,
    operationalSummary: {
      service_family: 'residential',
      city: 'Barcelona',
      size_band: '41-70',
      frequency_band: 'weekly',
      recurrence_type: 'weekly',
      time_window: 'noche',
    },
    attributionSummary: {},
    estimate: { rule_id: 'RES-B', operator_count: 1, elapsed_hours: 4, operator_hours: 4 },
    review: { manual_review: false },
    leadStatus: 'new',
    ...overrides,
  }
}

describe('CP-4.2B.7 funnel intelligence certification contracts', () => {
  it('keeps the owner-approved aggregation threshold at exactly three', () => {
    expect(DEFAULT_AGGREGATION_THRESHOLD).toBe(3)

    const report = buildPublicQuoteDemandIntelligence([
      record({ submissionId: 'one', attributionSummary: { utm_source: 'campaign-one' } }),
      record({ submissionId: 'two', attributionSummary: { utm_source: 'campaign-two' } }),
      ...Array.from({ length: 3 }, (_, index) => record({
        submissionId: `three-${index}`,
        attributionSummary: { utm_source: 'campaign-three', utm_medium: 'paid_social', utm_campaign: 'campaign-three' },
      })),
    ])

    expect(report.aggregationThreshold).toBe(DEFAULT_AGGREGATION_THRESHOLD)
    expect(report.utmSourceBreakdown.map((row) => row.key)).toEqual(['campaign-three'])
    expect(report.utmCampaignBreakdown.map((row) => row.key)).toEqual(['campaign-three'])
    expect(report.campaignBreakdown.map((row) => row.campaignKey)).toEqual(['campaign-three/paid_social/campaign-three'])
  })

  it('keeps Tier-A rules as non-price availability and leaves manual branches unpriced', () => {
    const tierA = ['RES-A', 'RES-B', 'RES-C'].map((ruleId, index) => record({
      submissionId: `tier-a-${index}`,
      estimate: { rule_id: ruleId },
      review: { manual_review: false },
    }))
    const manual = ['tourist', 'hotel', 'office_commercial', 'gym', 'post_work_tenant_change', 'other'].map((service, index) => record({
      submissionId: `manual-${index}`,
      operationalSummary: { service_family: service, city: 'Barcelona', frequency_band: 'one_off', recurrence_type: 'one_off', time_window: 'noche' },
      estimate: null,
      review: { manual_review: true },
    }))
    const report = buildPublicQuoteDemandIntelligence([...tierA, ...manual])

    expect(report.totals.tierAShare).toBe(0.3333)
    expect(report.totals.manualReviewShare).toBe(0.6667)
    expect(JSON.stringify(report)).not.toMatch(/base_ex_vat|labor_cost|customer_price|margin/i)
  })
})
