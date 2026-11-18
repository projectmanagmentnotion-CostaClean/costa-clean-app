import { describe, expect, it } from 'vitest'
import { buildConfirmedExpensePayload, normalizeExpenseProposalReview, type ExpenseProposalReviewEdits } from './expenseConfirmation'
import { normalizeExpenseProposal } from './expenseNormalization'
import { createMissingField } from './expenseExtractionContract'
import type { ExtractionProposal, ExtractedField } from './expenseExtractionContract'

function field<T>(value: T): ExtractedField<T> { return { value, rawValue: String(value), confidence: 0.99, source: 'document' } }
function proposal() { const extraction: ExtractionProposal = { schemaVersion: 1, documentType: field('INVOICE'), supplier: { rawName: field('Proveedor'), legalNameCandidate: createMissingField(), commercialNameCandidate: createMissingField(), taxId: createMissingField(), normalizedTaxIdCandidate: createMissingField(), vatId: createMissingField(), address: createMissingField(), postalCode: createMissingField(), city: createMissingField(), country: createMissingField(), phone: createMissingField(), email: createMissingField(), website: createMissingField() }, invoice: { number: field('F-1'), issueDate: field('2026-09-30'), dueDate: createMissingField(), currency: field('EUR') }, amounts: { net: field('100.00'), tax: field('21.00'), gross: field('121.00'), discount: createMissingField(), withholding: createMissingField() }, vatLines: [{ rate: field('21'), base: field('100.00'), tax: field('21.00') }], payment: { method: createMissingField() }, confidence: { overall: 0.99 } }; return normalizeExpenseProposal(extraction) }

const reviewEdits: ExpenseProposalReviewEdits = {
  documentType: 'INVOICE', supplierName: 'Proveedor revisado', supplierTaxId: '', invoiceNumber: 'F-1', issueDate: '2026-09-30',
  net: '100.00', tax: '21.00', gross: '121.00', vatLines: [{ rate: '21', base: '100.00', tax: '21.00' }],
}

describe('N5.5 human confirmation contract', () => {
  it('builds a conservative expense payload only after explicit confirmation', () => {
    const result = buildConfirmedExpensePayload(proposal(), { confirmed: true, supplierCandidate: { expenseId: 'existing', supplierName: 'Proveedor', supplierTaxId: 'B12345674', score: 100, level: 'EXACT_TAX_ID', reasons: [] }, duplicateDecision: 'CREATE_NEW', duplicateCandidate: null, category: 'materiales', description: 'Compra confirmada', paymentMethod: 'card' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.payload).toMatchObject({ supplier_name: 'Proveedor', total: 121, document_support_status: 'pending_review' })
  })
  it('rejects blocked or unconfirmed proposals', () => {
    const result = buildConfirmedExpensePayload(proposal(), { confirmed: false, supplierCandidate: null, duplicateDecision: 'CREATE_NEW', duplicateCandidate: null, category: '', description: '', paymentMethod: null })
    expect(result.ok).toBe(false)
  })

  it('accepts reviewed edits only when the full VAT reconciliation still matches', () => {
    const reviewed = normalizeExpenseProposalReview(proposal(), reviewEdits)
    expect(reviewed.reviewStatus).toBe('READY_FOR_REVIEW')
    expect(reviewed.reconciliation.status).toBe('MATCH')
    expect(reviewed.extraction.supplier.rawName.source).toBe('reviewer')
    expect(reviewed.extraction.supplier.taxId).toEqual(createMissingField<string>())
    const result = buildConfirmedExpensePayload(reviewed, {
      confirmed: true, supplierCandidate: null, supplierName: reviewEdits.supplierName, supplierTaxId: reviewEdits.supplierTaxId,
      duplicateDecision: 'CREATE_NEW', duplicateCandidate: null, category: 'materiales', description: 'Gasto revisado', paymentMethod: 'card',
    })
    expect(result).toMatchObject({ ok: true, payload: { supplier_name: 'Proveedor revisado', expense_date: '2026-09-30', subtotal: 100, tax_amount: 21, total: 121 } })
  })

  it('blocks invalid edited tax IDs and mismatched edited VAT totals', () => {
    const invalidTaxId = normalizeExpenseProposalReview(proposal(), { ...reviewEdits, supplierTaxId: 'B00000001' })
    expect(invalidTaxId.reviewStatus).toBe('BLOCKED')

    const mismatched = normalizeExpenseProposalReview(proposal(), { ...reviewEdits, gross: '122.00' })
    expect(mismatched.reconciliation.status).toBe('MISMATCH')
    expect(buildConfirmedExpensePayload(mismatched, {
      confirmed: true, supplierCandidate: null, duplicateDecision: 'CREATE_NEW', duplicateCandidate: null, category: 'materiales', description: 'Gasto', paymentMethod: 'card',
    }).ok).toBe(false)
  })
})
