type QuoteNotes = Record<string, unknown>

export type PublicQuoteIntelligence = {
  engine: 'costa_clean_quote_intelligence@1.0.0'
  rule_set: 'estimate_v1'
  mode: 'tier_a' | 'manual_review'
  manual_review_required: boolean
  reason_codes: string[]
  estimate_input_completeness: 'complete' | 'partial'
  confidence: 'high' | 'none'
  estimate: {
    rule_id: 'RES-A' | 'RES-B' | 'RES-C'
    source: 'OWNER_APPROVED_2026_09_15'
    operator_count: number
    elapsed_hours: number
    operator_hours: number
    base_ex_vat: number
    labor_cost: number
  } | null
}

const tierARules = {
  'menos-40': { rule_id: 'RES-A', source: 'OWNER_APPROVED_2026_09_15', operator_count: 1, elapsed_hours: 3, operator_hours: 3, base_ex_vat: 60, labor_cost: 30 },
  '41-70': { rule_id: 'RES-B', source: 'OWNER_APPROVED_2026_09_15', operator_count: 1, elapsed_hours: 4, operator_hours: 4, base_ex_vat: 80, labor_cost: 40 },
  '71-100': { rule_id: 'RES-C', source: 'OWNER_APPROVED_2026_09_15', operator_count: 2, elapsed_hours: 3, operator_hours: 6, base_ex_vat: 120, labor_cost: 60 },
} as const

const services = new Set([
  'residential',
  'deep_cleaning',
  'tourist',
  'office_commercial',
  'gym',
  'hotel',
  'post_work_tenant_change',
  'other',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function textValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export function evaluatePublicQuoteRequest(input: {
  service_type: string
  property_type?: string
  notes: QuoteNotes
}): PublicQuoteIntelligence {
  const reasons: string[] = []
  const service = services.has(input.service_type) ? input.service_type : 'other'
  const propertyType = textValue(input.property_type)
  const size = textValue(input.notes.size)
  const needs = isRecord(input.notes.needs) ? input.notes.needs : {}

  if (service !== 'residential') reasons.push('SERVICE_MANUAL_V1')
  if (service === 'residential' && propertyType !== 'piso') reasons.push('PROPERTY_NOT_STANDARD_APARTMENT')
  if (!size || !(size in tierARules)) reasons.push('SIZE_OUTSIDE_TIER_A')
  if (service === 'residential' && Object.entries(needs).some(([key, enabled]) => enabled === true && key !== 'standardCleaning')) {
    reasons.push('UNSUPPORTED_COMPLEXITY')
  }
  if (service === 'residential' && needs.standardCleaning === false) reasons.push('NON_STANDARD_CLEANING')

  const estimate = service === 'residential'
    && propertyType === 'piso'
    && Boolean(size && size in tierARules)
    && reasons.length === 0
    ? tierARules[size as keyof typeof tierARules]
    : null

  return {
    engine: 'costa_clean_quote_intelligence@1.0.0',
    rule_set: 'estimate_v1',
    mode: estimate ? 'tier_a' : 'manual_review',
    manual_review_required: !estimate,
    reason_codes: estimate ? ['TIER_A_RESIDENTIAL'] : [...new Set(reasons.length ? reasons : ['MANUAL_REVIEW_V1'])],
    estimate_input_completeness: estimate ? 'complete' : 'partial',
    confidence: estimate ? 'high' : 'none',
    estimate,
  }
}
