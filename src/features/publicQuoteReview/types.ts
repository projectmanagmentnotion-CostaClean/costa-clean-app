export type PublicQuoteOperationalSummary = {
  service_family?: string | null
  service_variant?: string | null
  space_type?: string | null
  size_band?: string | null
  bedroom_band?: string | null
  bathroom_band?: string | null
  room_count_band?: string | null
  checkout_volume_band?: string | null
  frequency_band?: string | null
  recurrence_type?: string | null
  urgency?: string | null
  time_window?: string | null
  preferred_response_channel?: string | null
  operational_needs?: Record<string, unknown>
  city?: string | null
  postal_code?: string | null
  requested_date?: string | null
}

export type PublicQuoteInternalEstimate = {
  rule_id: 'RES-A' | 'RES-B' | 'RES-C'
  source: 'OWNER_APPROVED_2026_09_15'
  operator_count: number
  elapsed_hours: number
  operator_hours: number
  base_ex_vat: number
  labor_cost: number
}

export interface PublicQuoteReviewRecord {
  seed_id: string
  submission_id: string
  lead_id: string
  schema_version: string
  contract_version: string
  estimate_model_version: string
  seed_version: string
  operational_summary: PublicQuoteOperationalSummary
  review_context: string | null
  estimate: PublicQuoteInternalEstimate | null
  pricing_support: Record<string, unknown>
  confidence: Record<string, unknown>
  review: {
    manual_review?: boolean
    reason_codes?: string[]
    reviewer_required?: boolean
  }
  commercial_draft: {
    status?: string
    reviewer_required?: boolean
    customer_price?: number | null
    vat?: number | null
    commercial_total?: number | null
  }
  attribution_summary: Record<string, unknown>
  intelligence: Record<string, unknown>
  created_at?: string
  updated_at?: string
}
