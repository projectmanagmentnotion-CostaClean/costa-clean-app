import { describe, expect, it } from 'vitest'
import { buildConfirmedExpensePayload } from './expenseConfirmation'
import { createFixtureExtractionProvider } from './expenseExtractionProvider'
import { normalizeExpenseProposal } from './expenseNormalization'
import { buildExpenseSupplierIntelligence } from './expenseSupplierIntelligence'
import type { ExpenseListItem } from './types'

const expense = { id: 'existing-expense', supplier_name: 'SUMINISTROS COSTA TEST S.L.', supplier_tax_id: 'B12345674', expense_date: '2026-09-28', reference_number: 'TEST-2026-001', total: 176 } as ExpenseListItem

describe('N5.5 provider-independent Smart Expense integration', () => {
  it('flows fixture extraction through normalization, intelligence and explicit confirmation', async () => {
    const extraction = await createFixtureExtractionProvider().extractDocument({ captureDocumentId: 'document-1', captureSessionId: 'session-1', originalFilename: 'fixture-smart-expense.png', mimeType: 'image/png', sizeBytes: 100, sha256: 'a'.repeat(64) })
    expect(extraction.ok).toBe(true)
    if (!extraction.ok) return
    const normalized = normalizeExpenseProposal(extraction.proposal)
    const intelligence = buildExpenseSupplierIntelligence(normalized, [expense])
    expect(normalized.reviewStatus).toBe('READY_FOR_REVIEW')
    expect(intelligence.candidates[0]?.level).toBe('EXACT_TAX_ID')
    expect(intelligence.duplicates[0]?.level).toBe('EXACT')
    const result = buildConfirmedExpensePayload(normalized, { confirmed: true, supplierCandidate: intelligence.candidates[0], duplicateDecision: 'USE_EXISTING', duplicateCandidate: intelligence.duplicates[0], category: 'materiales', description: 'Compra confirmada', paymentMethod: 'card' })
    expect(result).toMatchObject({ ok: true, source: 'human-confirmed-normalized-proposal' })
  })

  it('does not cross the confirmation boundary when a proposal is blocked or unchecked', () => {
    const provider = createFixtureExtractionProvider()
    return provider.extractDocument({ captureDocumentId: 'document-2', captureSessionId: 'session-2', originalFilename: 'fixture-smart-expense.png', mimeType: 'image/png', sizeBytes: 100, sha256: 'b'.repeat(64) }).then((extraction) => {
      if (!extraction.ok) throw new Error('fixture extraction failed')
      const normalized = normalizeExpenseProposal(extraction.proposal)
      normalized.amounts.gross.normalizedValue = '999.00'
      const result = buildConfirmedExpensePayload(normalized, { confirmed: false, supplierCandidate: null, duplicateDecision: 'CREATE_NEW', duplicateCandidate: null, category: 'materiales', description: 'No guardar', paymentMethod: 'card' })
      expect(result.ok).toBe(false)
    })
  })
})
