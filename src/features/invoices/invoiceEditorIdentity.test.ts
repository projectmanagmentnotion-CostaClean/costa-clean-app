import { describe, expect, it } from 'vitest'
import { canSaveInvoiceEditor } from './invoiceEditorIdentity'

describe('invoice editor identity guard', () => {
  it('allows saving the invoice whose data hydrated the editor', () => {
    expect(canSaveInvoiceEditor('synthetic-invoice-a', 'synthetic-invoice-a')).toBe(true)
  })

  it('blocks saving while another invoice is selected but still hydrated', () => {
    expect(canSaveInvoiceEditor('synthetic-invoice-b', 'synthetic-invoice-a')).toBe(false)
  })

  it('blocks save when the editor has not hydrated or no invoice is selected', () => {
    expect(canSaveInvoiceEditor('synthetic-invoice-a', null)).toBe(false)
    expect(canSaveInvoiceEditor(null, 'synthetic-invoice-a')).toBe(false)
  })
})
