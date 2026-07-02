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
})
