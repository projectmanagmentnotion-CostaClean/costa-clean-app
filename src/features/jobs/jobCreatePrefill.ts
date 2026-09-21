import type { QuoteListItem } from '../quotes/types'

export interface JobCreatePrefill {
  request_id: string
  origin_kind: 'client' | 'property' | 'quote' | 'job'
  client_id: string
  property_id: string
  quote_id: string
  notes: string
  billing_concept: string
  service_type?: string
  billing_lines?: Array<{
    concept: string
    quantity: string
    unit: string
    unit_price: string
  }>
}

export function getJobCreateInitialStep(prefill: JobCreatePrefill | null): 0 | 1 {
  return prefill?.client_id && prefill.property_id ? 1 : 0
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

  const persistedLines = quote.lines?.length ? quote.lines : quote.quote_lines ?? []
  const firstLineConcept = persistedLines[0]?.concept?.trim() || ''

  return {
    request_id: createPrefillId(),
    origin_kind: 'quote',
    client_id: quote.client_id,
    property_id: quote.property_id,
    quote_id: quote.id,
    notes: quote.notes?.trim() || '',
    billing_concept: firstLineConcept,
    service_type: 'standard_cleaning',
    billing_lines: persistedLines.map((line) => ({
      concept: line.concept,
      quantity: Number(line.quantity).toFixed(2),
      unit: line.unit?.trim() || 'servicio',
      unit_price: Number(line.unit_price).toFixed(2),
    })),
  }
}

export function buildJobCreatePrefillFromJob(job: {
  id: string
  client_id: string
  property_id: string
  notes?: string | null
  service_type: string
  billing_concept?: string | null
  billing_lines?: Array<{
    concept: string
    quantity: number
    unit: string | null
    unit_price: number
  }> | null
}): JobCreatePrefill | null {
  if (!job.client_id || !job.property_id) {
    return null
  }

  const persistedLines = job.billing_lines ?? []
  const firstLineConcept = persistedLines[0]?.concept?.trim() || job.billing_concept?.trim() || ''

  return {
    request_id: createPrefillId(),
    origin_kind: 'job',
    client_id: job.client_id,
    property_id: job.property_id,
    quote_id: '',
    notes: job.notes?.trim() || '',
    billing_concept: firstLineConcept,
    service_type: job.service_type,
    billing_lines: persistedLines.map((line) => ({
      concept: line.concept,
      quantity: Number(line.quantity).toFixed(2),
      unit: line.unit?.trim() || 'servicio',
      unit_price: Number(line.unit_price).toFixed(2),
    })),
  }
}
