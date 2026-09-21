import type { QuoteListItem } from './types'

export function buildQuoteScopeLabel(quote: QuoteListItem): string {
  return quote.notes?.trim() || 'Sin alcance definido'
}
