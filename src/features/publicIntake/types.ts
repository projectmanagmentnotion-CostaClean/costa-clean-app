export type PublicIntakeSource = 'public_quote_form' | 'public_quote_request' | 'google_forms_csv' | 'google_form_import'

export type PreferredQuoteChannel = 'email' | 'whatsapp' | 'phone' | 'unknown'

export interface QuoteRequestNormalizedInput {
  submittedAt: string | null
  fullName: string
  phone: string
  email: string | null
  serviceNeedLabel: string | null
  scopeNotes: string | null
  propertyType: string | null
  sqmBand: string | null
  rooms: string | null
  bathrooms: string | null
  hasOutdoorAreas: boolean | null
  hasPets: boolean | null
  requestedServiceDate: string | null
  preferredTimeSlot: string | null
  serviceFrequencyLabel: string | null
  preferredQuoteChannel: PreferredQuoteChannel
  consentQuoteProcessing: boolean
  postalCode: string | null
  city: string | null
  urgencyLabel: string | null
  previousCleaningIssues: string | null
  legacyUnusedField: string | null
}

export interface PublicQuotePricingAdjustment {
  code: string
  label: string
  amount: number
}

export interface PublicQuoteRequestProtectionInput {
  startedAt: string
  website: string
}

export interface PublicQuotePricingBreakdown {
  version: 'pricing_v1'
  currency: 'EUR'
  engineId?: string
  engineVersion?: string
  serviceType?: string
  propertyType?: string
  operators?: number
  hoursPerOperator?: number
  totalHours?: number
  minimumTotalHours?: number
  hourlyRate?: number
  baseAmount: number
  serviceMultiplier: number
  serviceAdjustedAmount: number
  adjustments: PublicQuotePricingAdjustment[]
  supplementsTotal?: number
  discountTotal?: number
  invoicedBase?: number
  invoicedVat?: number
  invoicedTotalWithVat?: number
  nonInvoicedAmount?: number
  grandTotalCustomerView?: number
  priceStructure?: 'standard' | 'mixed'
  mandatoryMessages?: string[]
  limitations?: string[]
  forbiddenServiceRequested?: boolean
  subtotal: number
  taxRate: number
  taxAmount: number
  total: number
  confidence: 'estimate'
}

export interface IntakeSubmissionRecord {
  id: string
  source: PublicIntakeSource
  status: 'received' | 'reviewing' | 'converted' | 'rejected'
  submitted_at: string | null
  normalized_input: QuoteRequestNormalizedInput
  raw_payload: Record<string, unknown>
  source_field_map: Record<string, string>
  pricing_breakdown?: PublicQuotePricingBreakdown | null
  lead_draft_id?: string | null
  lead_id?: string | null
  quote_id?: string | null
  created_at?: string
  updated_at?: string
}

export interface IntakeSubmissionCreateInput {
  source: PublicIntakeSource
  normalizedInput: QuoteRequestNormalizedInput
  rawPayload: Record<string, unknown>
  sourceFieldMap: Record<string, string>
}
