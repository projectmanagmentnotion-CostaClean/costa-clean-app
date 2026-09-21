import { describe, expect, it } from 'vitest'
import { __financialWriteApiTestUtils } from './financialWriteApi'

describe('financialWriteApi test utils', () => {
  it('returns the single saved invoice row when Supabase confirms one object', () => {
    expect(__financialWriteApiTestUtils.normalizeSavedInvoiceRows({
      id: 'invoice-1',
      display_code: 'INV-0045',
      invoice_number: '2026-045',
      status: 'issued',
      issue_date: '2026-07-02',
    })).toMatchObject({
      id: 'invoice-1',
      invoice_number: '2026-045',
    })
  })

  it('fails with a controlled error when no saved invoice row is returned', () => {
    try {
      __financialWriteApiTestUtils.normalizeSavedInvoiceRows(null)
      throw new Error('expected error')
    } catch (error) {
      expect(error instanceof Error ? error.message : null).toBe('No se pudo leer la factura guardada.')
    }
  })

  it('detects missing save_invoice_with_lines_v2 RPC errors for fallback', () => {
    expect(__financialWriteApiTestUtils.isMissingSaveInvoiceResultRpcError(
      'Could not find the function public.save_invoice_with_lines_v2 in the schema cache',
    )).toBe(true)
    expect(__financialWriteApiTestUtils.isMissingSaveInvoiceResultRpcError(
      'No se pudo leer la factura guardada.',
    )).toBe(false)
  })

  it('returns the single saved quote row when Supabase confirms one object', () => {
    expect(__financialWriteApiTestUtils.normalizeSavedQuoteRows({
      id: 'quote-1',
      display_code: 'QUO-0042',
      status: 'sent',
      subtotal: 120,
      tax_amount: 25.2,
      total: 145.2,
      notes: 'Servicio de camareros',
    })).toMatchObject({
      id: 'quote-1',
      status: 'sent',
      total: 145.2,
    })
  })

  it('fails with a controlled error when no saved quote row is returned', () => {
    try {
      __financialWriteApiTestUtils.normalizeSavedQuoteRows(null)
      throw new Error('expected error')
    } catch (error) {
      expect(error instanceof Error ? error.message : null).toBe('No se pudo leer el presupuesto guardado.')
    }
  })

  it('fails when the saved quote totals do not match the payload', () => {
    try {
      __financialWriteApiTestUtils.assertSavedQuoteMatchesExpectation(
        {
          id: 'quote-1',
          subtotal: 100,
          tax_amount: 21,
          total: 121,
          notes: 'Servicio de camareros',
        },
        {
          id: 'quote-1',
          display_code: 'QUO-0042',
          status: 'sent',
          subtotal: 99,
          tax_amount: 21,
          total: 120,
          notes: 'Servicio de camareros',
        },
        [
          {
            id: 'line-1',
            quote_id: 'quote-1',
            sort_order: 1,
            concept: 'Servicio de camareros',
            quantity: 1,
            unit: 'servicio',
            unit_price: 99,
            line_subtotal: 99,
          },
        ],
      )
      throw new Error('expected error')
    } catch (error) {
      expect(error instanceof Error ? error.message : null).toBe(
        'El presupuesto se guardo con una base distinta a la esperada. Esperado 100 y Supabase devolvio 99.',
      )
    }
  })

  it('fails when Supabase confirms a different fiscal number than expected', () => {
    try {
      __financialWriteApiTestUtils.assertSavedInvoiceNumberingMatchesExpectation(
        {
          pricing_metadata: {
            expected_invoice_number: '2026-049',
            expected_display_code: 'INV-0049',
          },
        },
        {
          id: 'invoice-49',
          display_code: 'INV-0050',
          invoice_number: '2026-050',
          status: 'issued',
          issue_date: '2026-07-02',
        },
      )
      throw new Error('expected error')
    } catch (error) {
      expect(error instanceof Error ? error.message : null).toBe(
        'La factura se guardo con numeracion distinta a la esperada. Esperado 2026-049 y Supabase devolvio 2026-050.',
      )
    }
  })

  it('accepts the saved invoice when numbering matches the expectation', () => {
    __financialWriteApiTestUtils.assertSavedInvoiceNumberingMatchesExpectation(
      {
        pricing_metadata: {
          expected_invoice_number: '2026-049',
          expected_display_code: 'INV-0049',
        },
      },
      {
        id: 'invoice-49',
        display_code: 'INV-0049',
        invoice_number: '2026-049',
        status: 'issued',
        issue_date: '2026-07-02',
      },
    )

    expect(true).toBe(true)
  })

  it('removes invoice numbering columns before calling the invoice write RPC', () => {
    const sanitized = __financialWriteApiTestUtils.sanitizeInvoicePayloadForWrite({
      id: 'invoice-49',
      display_code: 'INV-0054',
      invoice_number: '2026-054',
      status: 'issued',
      pricing_metadata: {
        expected_invoice_number: '2026-049',
      },
    })

    expect(sanitized).toMatchObject({
      id: 'invoice-49',
      status: 'issued',
      pricing_metadata: {
        expected_invoice_number: '2026-049',
      },
    })
    expect('invoice_number' in sanitized).toBe(false)
    expect('display_code' in sanitized).toBe(false)
  })
})
