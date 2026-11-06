import { describe, expect, it } from 'vitest'
import { buildExpenseSupplierIntelligence } from './expenseSupplierIntelligence'
import { normalizeExpenseProposal } from './expenseNormalization'
import { createMissingField } from './expenseExtractionContract'
import type { ExtractionProposal, ExtractedField } from './expenseExtractionContract'

function field<T>(value: T): ExtractedField<T> { return { value, rawValue: String(value), confidence: 0.99, source: 'document' } }
function proposal(): ReturnType<typeof normalizeExpenseProposal> {
  const extraction: ExtractionProposal = { schemaVersion: 1, documentType: field('INVOICE'), supplier: { rawName: field(' Acme Limpieza '), legalNameCandidate: createMissingField(), commercialNameCandidate: createMissingField(), taxId: field('B12345678'), normalizedTaxIdCandidate: field('B-12345678'), vatId: createMissingField(), address: createMissingField(), postalCode: createMissingField(), city: field('Madrid'), country: createMissingField(), phone: createMissingField(), email: createMissingField(), website: createMissingField() }, invoice: { number: field('F-2026-7'), issueDate: field('2026-09-30'), dueDate: createMissingField(), currency: field('EUR') }, amounts: { net: field('100.00'), tax: field('21.00'), gross: field('121.00'), discount: createMissingField(), withholding: createMissingField() }, vatLines: [{ rate: field('21'), base: field('100.00'), tax: field('21.00') }], payment: { method: createMissingField() }, confidence: { overall: 0.99 } }
  return normalizeExpenseProposal(extraction)
}

const baseExpense = { id: 'expense-1', supplier_name: 'ACME LIMPIEZA', supplier_tax_id: 'B12345678', expense_date: '2026-09-30', reference_number: 'F-2026-7', total: 121, subtotal: 100, tax_amount: 21 } as unknown as import('./types').ExpenseListItem

describe('N5.4 supplier identity and duplicate intelligence', () => {
  it('matches supplier tax ids deterministically and detects exact duplicate', () => {
    const result = buildExpenseSupplierIntelligence(proposal(), [baseExpense])
    expect(result.candidates[0]).toMatchObject({ level: 'EXACT_TAX_ID', score: 100 })
    expect(result.duplicates[0]).toMatchObject({ level: 'EXACT', expenseId: 'expense-1' })
  })
  it('does not invent a supplier match when identity is absent', () => {
    const next = proposal(); next.supplier.rawName.normalizedValue = null; next.supplier.legalNameCandidate.normalizedValue = null; next.supplier.commercialNameCandidate.normalizedValue = null; next.supplier.taxId.normalizedValue = null; next.supplier.normalizedTaxIdCandidate.normalizedValue = null
    expect(buildExpenseSupplierIntelligence(next, [baseExpense])).toEqual({ candidates: [], duplicates: [] })
  })
})
