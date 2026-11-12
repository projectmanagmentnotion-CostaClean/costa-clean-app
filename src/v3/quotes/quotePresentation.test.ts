import { describe, expect, it } from 'vitest'
import { getQuoteConversionPresentation, getQuoteFinancialFacts } from './quotePresentation'

const quote = { id: 'quote-1', display_code: 'PRES-0001', client_id: 'client-1', lead_id: null, property_id: null, status: 'sent', invoice_id: null, subtotal: 100, tax_amount: 21, total: 121, lines: [{ id: 'line-1', quote_id: 'quote-1', sort_order: 0, concept: 'Limpieza', quantity: 1, unit: 'servicio', unit_price: 100, line_subtotal: 100 }] }

describe('quote presentation', () => {
  it('keeps total, base and IVA separate without changing quote values', () => {
    expect(getQuoteFinancialFacts(quote)).toEqual({ subtotal: 100, tax: 21, total: 121 })
  })

  it('exposes acceptance without invoice creation for an unaccepted quote', () => {
    const presentation = getQuoteConversionPresentation(quote, [])
    expect(presentation.available).toBe(true)
    expect(presentation.actionLabel).toBe('Aceptar presupuesto')
    expect(presentation.description).toContain('No se creará ni emitirá ninguna factura')
  })

  it('offers a draft-only invoice flow after acceptance', () => {
    const presentation = getQuoteConversionPresentation({ ...quote, status: 'accepted' }, [])
    expect(presentation.available).toBe(true)
    expect(presentation.actionLabel).toBe('Crear factura borrador')
    expect(presentation.description).toContain('No se emitirá ni se asignará número fiscal')
  })

  it('explains an existing invoice instead of offering a duplicate conversion', () => {
    const presentation = getQuoteConversionPresentation(quote, [{ id: 'invoice-1', quote_id: quote.id, status: 'issued', cancelled_at: null } as never])
    expect(presentation.available).toBe(false)
    expect(presentation.unavailableMessage).toBe('Ya existe una factura vinculada a este presupuesto.')
  })
})
