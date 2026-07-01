import { describe, expect, it } from 'vitest'
import { getBillingDraftLinesFromQuote } from './quoteBillingDrafts'
import type { QuoteListItem } from '../quotes/types'

function createQuote(overrides: Partial<QuoteListItem> = {}): QuoteListItem {
  return {
    id: 'quote-1',
    display_code: 'QUO-001',
    client_id: 'client-1',
    property_id: 'property-1',
    status: 'accepted',
    subtotal: 175,
    tax_amount: 36.75,
    total: 211.75,
    notes: 'Servicio base',
    lines: [],
    ...overrides,
  }
}

describe('quoteBillingDrafts', () => {
  it('preserves every persisted quote line in order', () => {
    const lines = getBillingDraftLinesFromQuote(createQuote({
      lines: [
        {
          id: 'line-2',
          quote_id: 'quote-1',
          sort_order: 2,
          concept: 'Cristales',
          quantity: 1,
          unit: 'servicio',
          unit_price: 25,
          line_subtotal: 25,
        },
        {
          id: 'line-1',
          quote_id: 'quote-1',
          sort_order: 1,
          concept: 'Limpieza general',
          quantity: 3,
          unit: 'hora',
          unit_price: 50,
          line_subtotal: 150,
        },
      ],
    }))

    expect(lines).toHaveLength(2)
    expect(JSON.stringify(lines.map((line) => line.concept))).toBe(JSON.stringify(['Limpieza general', 'Cristales']))
    expect(JSON.stringify(lines.map((line) => line.quantity))).toBe(JSON.stringify(['3.00', '1.00']))
  })
})
