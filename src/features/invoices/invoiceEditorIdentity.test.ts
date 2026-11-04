import { describe, expect, it } from 'vitest'
import { canSaveInvoiceEditor, canSaveIssuedInvoiceCorrection } from './invoiceEditorIdentity'

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

describe('issued invoice correction guard', () => {
  it('requires explicit internal-correction confirmation for issued invoices', () => {
    expect(canSaveIssuedInvoiceCorrection('issued', false)).toBe(false)
    expect(canSaveIssuedInvoiceCorrection('issued', true)).toBe(true)
  })

  it('does not add the issued-invoice confirmation to drafts', () => {
    expect(canSaveIssuedInvoiceCorrection('draft', false)).toBe(true)
  })
})
