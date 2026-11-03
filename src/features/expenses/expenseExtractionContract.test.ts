import { describe, expect, it } from 'vitest'
import { createMissingField, validateExtractionProposal } from './expenseExtractionContract'

const validProposal = {
  schemaVersion: 1,
  documentType: { value: 'INVOICE', rawValue: 'FACTURA', confidence: 0.9, source: 'document' },
  supplier: { rawName: createMissingField(), legalNameCandidate: createMissingField(), commercialNameCandidate: createMissingField(), taxId: createMissingField(), normalizedTaxIdCandidate: createMissingField(), vatId: createMissingField(), address: createMissingField(), postalCode: createMissingField(), city: createMissingField(), country: createMissingField(), phone: createMissingField(), email: createMissingField(), website: createMissingField() },
  invoice: { number: createMissingField(), issueDate: createMissingField(), dueDate: createMissingField(), currency: createMissingField() },
  amounts: { net: { ...createMissingField(), value: '100.00', rawValue: '100,00 €', confidence: 0.9, source: 'document' }, tax: createMissingField(), gross: createMissingField(), discount: createMissingField(), withholding: createMissingField() },
  vatLines: [],
  payment: { method: createMissingField() },
  confidence: { overall: 0.9 },
}

describe('N5.2 extraction contract', () => {
  it('accepts a versioned proposal with decimal money strings', () => {
    expect(validateExtractionProposal(validProposal).ok).toBe(true)
  })

  it('rejects malformed provider payloads and floating-point money', () => {
    const result = validateExtractionProposal({ ...validProposal, schemaVersion: 2, amounts: { ...validProposal.amounts, gross: { ...createMissingField(), value: 121.2, source: 'provider' } } })
    expect(result).toEqual({ ok: false, errors: ['unsupported schemaVersion', 'amounts.gross must use a decimal string'] })
  })

  it('keeps missing values explicit instead of inventing currency or fields', () => {
    expect(createMissingField()).toEqual({ value: null, rawValue: null, confidence: null, source: 'missing' })
  })

  it('rejects incomplete fields and non-finite evidence geometry', () => {
    expect(validateExtractionProposal({ ...validProposal, supplier: { ...validProposal.supplier, rawName: { value: 'Supplier' } } })).toMatchObject({ ok: false })
    expect(validateExtractionProposal({ ...validProposal, supplier: { ...validProposal.supplier, rawName: { ...validProposal.supplier.rawName, evidence: { page: 1, boundingBox: { x: 0, y: 0, width: Number.NaN, height: 10 } } } } })).toMatchObject({ ok: false })
    expect(validateExtractionProposal({ ...validProposal, supplier: { ...validProposal.supplier, rawName: { ...validProposal.supplier.rawName, evidence: { page: 1, boundingBox: { x: 0, y: 0, width: -1, height: 10 } } } } })).toMatchObject({ ok: false })
  })
})
