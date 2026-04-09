import type { QuoteListItem } from '../quotes/types'

export interface JobCreatePrefill {
  request_id: string
  client_id: string
  property_id: string
  quote_id: string
  notes: string
  billing_concept: string
}

function createPrefillId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `job-prefill-${Date.now()}`
}

export function buildJobCreatePrefillFromQuote(quote: QuoteListItem): JobCreatePrefill | null {
  if (!quote.client_id || !quote.property_id) {
    return null
  }

  const firstLineConcept = quote.lines?.[0]?.concept?.trim() || quote.quote_lines?.[0]?.concept?.trim() || ''

  return {
    request_id: createPrefillId(),
    client_id: quote.client_id,
    property_id: quote.property_id,
    quote_id: quote.id,
    notes: quote.notes?.trim() || '',
    billing_concept: firstLineConcept,
  }
}
