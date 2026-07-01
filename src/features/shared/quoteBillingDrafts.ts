import {
  buildFallbackConcept,
  type QuoteLineFormState,
} from '../quotes/quoteLineUtils'
import type { QuoteListItem } from '../quotes/types'
import type { PropertyListItem } from '../properties/types'
import {
  createBlankBillingLine,
  formatMoneyInput,
  formatQuantityInput,
  type BillingLineFormState,
} from './billingLineDrafts'

function quoteLineToBillingDraft(line: QuoteLineFormState): BillingLineFormState {
  return {
    local_id: line.local_id,
    concept: line.concept,
    quantity: line.quantity,
    unit: line.unit,
    unit_price: line.unit_price,
  }
}

export function getBillingDraftLinesFromQuote(
  quote: QuoteListItem | null,
  properties: PropertyListItem[] = [],
): BillingLineFormState[] {
  if (!quote) return []

  const persistedLines = quote.lines?.length ? quote.lines : quote.quote_lines ?? []
  if (persistedLines.length > 0) {
    return [...persistedLines]
      .sort((left, right) => Number(left.sort_order) - Number(right.sort_order))
      .map((line) => quoteLineToBillingDraft({
        local_id: line.id,
        concept: line.concept,
        quantity: formatQuantityInput(Number(line.quantity)),
        unit: line.unit || 'servicio',
        unit_price: formatMoneyInput(Number(line.unit_price)),
      }))
  }

  const subtotal = Number(quote.subtotal)
  const safeSubtotal = Number.isFinite(subtotal) && subtotal >= 0 ? subtotal : 0

  return [createBlankBillingLine({
    concept: buildFallbackConcept(quote, properties),
    quantity: '1.00',
    unit: 'servicio',
    unit_price: formatMoneyInput(safeSubtotal),
  })]
}
