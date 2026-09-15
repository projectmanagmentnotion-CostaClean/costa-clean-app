import { listLeads, listPublicQuoteReviews } from '../../app/appDataApi'
import { buildPublicQuoteDemandIntelligence } from './aggregation'
import type { DemandIntelligenceSourceRecord } from './types'

export async function loadPublicQuoteDemandIntelligence() {
  const [reviews, leads] = await Promise.all([listPublicQuoteReviews(), listLeads()])
  const statusByLeadId = new Map(leads.map((lead) => [lead.id, lead.status]))
  const records: DemandIntelligenceSourceRecord[] = reviews.map((review) => ({
    submissionId: review.submission_id,
    source: 'public_web',
    createdAt: review.created_at,
    operationalSummary: review.operational_summary,
    attributionSummary: review.attribution_summary,
    estimate: review.estimate,
    review: review.review,
    leadStatus: statusByLeadId.get(review.lead_id) ?? null,
  }))

  return buildPublicQuoteDemandIntelligence(records)
}
