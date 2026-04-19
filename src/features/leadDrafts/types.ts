import type { PublicQuotePricingBreakdown, QuoteRequestNormalizedInput } from '../publicIntake/types'

export type LeadDraftStatus = 'new' | 'matched_existing_lead' | 'ready_for_review' | 'converted' | 'dismissed'
export type LeadDraftAiDraftStatus = 'not_generated' | 'drafted' | 'reviewed'

export interface QuoteDraftSeed {
  status: 'draft'
  serviceSummary: string
  notes: string
  requestedServiceDate: string | null
  preferredTimeSlot: string | null
  preferredQuoteChannel: QuoteRequestNormalizedInput['preferredQuoteChannel']
  pricingBreakdown?: PublicQuotePricingBreakdown
}

export interface LeadDraftCreateInput {
  intakeSubmissionId: string
  normalizedInput: QuoteRequestNormalizedInput
  suggestedFullName: string
  phone: string
  email: string | null
  city: string | null
  postalCode: string | null
  status: LeadDraftStatus
  matchedLeadId: string | null
  quoteDraftSeed: QuoteDraftSeed
  pricingBreakdown?: PublicQuotePricingBreakdown
}

export interface LeadDraftRecord {
  id: string
  intake_submission_id: string
  suggested_full_name: string
  phone: string
  email: string | null
  city: string | null
  postal_code: string | null
  status: LeadDraftStatus
  matched_lead_id: string | null
  normalized_input: QuoteRequestNormalizedInput
  quote_draft_seed: QuoteDraftSeed
  pricing_breakdown?: PublicQuotePricingBreakdown | null
  ai_email_draft: string | null
  ai_whatsapp_draft: string | null
  ai_draft_status: LeadDraftAiDraftStatus
  ai_generation_metadata?: Record<string, unknown> | null
  created_at?: string
  updated_at?: string
}
