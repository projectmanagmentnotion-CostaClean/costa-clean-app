import { describe, expect, it } from 'vitest'
import {
  buildQuoteLinePayloads,
  calculateQuoteSubtotal,
  calculateQuoteTax,
  calculateQuoteTotal,
  createBlankQuoteLine,
} from './quoteLineUtils'

describe('quoteLineUtils', () => {
  it('calculates monetary totals from valid lines', () => {
    const firstLine = {
      ...createBlankQuoteLine(),
      concept: 'Limpieza final',
      quantity: '2',
      unit_price: '40',
    }
    const secondLine = {
      ...createBlankQuoteLine(),
      concept: 'Materiales',
      quantity: '1',
      unit_price: '15.50',
    }

    expect(calculateQuoteSubtotal([firstLine, secondLine])).toBe(95.5)
    expect(calculateQuoteTax([firstLine, secondLine])).toBe(20.06)
    expect(calculateQuoteTotal([firstLine, secondLine])).toBe(115.56)
  })

  it('rejects payload generation when a line is invalid', () => {
    const invalidLine = {
      ...createBlankQuoteLine(),
      concept: 'Linea incorrecta',
      quantity: '0',
      unit_price: '10',
    }

    expect(buildQuoteLinePayloads([invalidLine], 'QUOTE-1')).toBeNull()
  })

  it('creates sorted payloads with normalized values', () => {
    const line = {
      ...createBlankQuoteLine(),
      concept: 'Limpieza premium',
      quantity: '1.5',
      unit_price: '80',
      unit: 'hora',
    }

    const payloads = buildQuoteLinePayloads([line], 'QUOTE-2')
    expect(payloads).toHaveLength(1)
    expect(payloads?.[0]).toMatchObject({
      quote_id: 'QUOTE-2',
      sort_order: 1,
      quantity: 1.5,
      unit_price: 80,
      line_subtotal: 120,
      unit: 'hora',
    })
  })
})
