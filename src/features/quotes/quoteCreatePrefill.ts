import type { QuoteListItem } from './types'

export interface QuoteCreatePrefillLine {
  concept: string
  quantity: string
  unit: string
  unit_price: string
}

export interface QuoteCreatePrefill {
  request_id: string
  client_id: string
  property_id: string
  notes: string
  lines: QuoteCreatePrefillLine[]
}

function createPrefillId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `quote-prefill-${Date.now()}`
}

function formatDecimalInput(value: number): string {
  return value.toFixed(2)
}

export function buildQuoteCreatePrefillFromQuote(quote: QuoteListItem): QuoteCreatePrefill | null {
  if (!quote.client_id) {
    return null
  }

  const persistedLines = quote.lines?.length ? quote.lines : quote.quote_lines ?? []
  const lines = persistedLines.map((line) => ({
    concept: line.concept,
    quantity: formatDecimalInput(line.quantity),
    unit: line.unit?.trim() || 'servicio',
    unit_price: formatDecimalInput(line.unit_price),
  }))

  return {
    request_id: createPrefillId(),
    client_id: quote.client_id,
    property_id: quote.property_id ?? '',
    notes: quote.notes?.trim() || '',
    lines,
  }
}
