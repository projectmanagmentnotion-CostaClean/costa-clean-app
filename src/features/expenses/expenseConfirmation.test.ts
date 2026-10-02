import { describe, expect, it } from 'vitest'
import { buildConfirmedExpensePayload } from './expenseConfirmation'
import { normalizeExpenseProposal } from './expenseNormalization'
import { createMissingField } from './expenseExtractionContract'
import type { ExtractionProposal, ExtractedField } from './expenseExtractionContract'

function field<T>(value: T): ExtractedField<T> { return { value, rawValue: String(value), confidence: 0.99, source: 'document' } }
function proposal() { const extraction: ExtractionProposal = { schemaVersion: 1, documentType: field('INVOICE'), supplier: { rawName: field('Proveedor'), legalNameCandidate: createMissingField(), commercialNameCandidate: createMissingField(), taxId: createMissingField(), normalizedTaxIdCandidate: createMissingField(), vatId: createMissingField(), address: createMissingField(), postalCode: createMissingField(), city: createMissingField(), country: createMissingField(), phone: createMissingField(), email: createMissingField(), website: createMissingField() }, invoice: { number: field('F-1'), issueDate: field('2026-09-30'), dueDate: createMissingField(), currency: field('EUR') }, amounts: { net: field('100.00'), tax: field('21.00'), gross: field('121.00'), discount: createMissingField(), withholding: createMissingField() }, vatLines: [{ rate: field('21'), base: field('100.00'), tax: field('21.00') }], payment: { method: createMissingField() }, confidence: { overall: 0.99 } }; return normalizeExpenseProposal(extraction) }

describe('N5.5 human confirmation contract', () => {
  it('builds a conservative expense payload only after explicit confirmation', () => {
    const result = buildConfirmedExpensePayload(proposal(), { confirmed: true, supplierCandidate: { expenseId: 'existing', supplierName: 'Proveedor', supplierTaxId: 'B12345678', score: 100, level: 'EXACT_TAX_ID', reasons: [] }, duplicateDecision: 'CREATE_NEW', duplicateCandidate: null, category: 'materiales', description: 'Compra confirmada', paymentMethod: 'card' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.payload).toMatchObject({ supplier_name: 'Proveedor', total: 121, document_support_status: 'pending_review' })
  })
  it('rejects blocked or unconfirmed proposals', () => {
    const result = buildConfirmedExpensePayload(proposal(), { confirmed: false, supplierCandidate: null, duplicateDecision: 'CREATE_NEW', duplicateCandidate: null, category: '', description: '', paymentMethod: null })
    expect(result.ok).toBe(false)
  })
})
