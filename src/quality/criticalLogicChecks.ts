import {
  buildExpenseFiscalSummary,
  getEstimatedDeductibleBase,
  getEstimatedDeductibleVat,
  hasMediumHighFiscalRisk,
  needsFiscalReview,
} from '../features/expenses/fiscalIntelligenceSummary.ts'
import { buildExpenseFiscalPrecheck } from '../features/expenses/fiscalIntelligenceRules.ts'
import type { ExpenseListItem } from '../features/expenses/types.ts'
import {
  buildQuoteLinePayloads,
  calculateQuoteSubtotal,
  createBlankQuoteLine,
} from '../features/quotes/quoteLineUtils.ts'

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

function makeExpense(overrides: Partial<ExpenseListItem> = {}): ExpenseListItem {
  return {
    id: 'EXPENSE-CHECK-1',
    display_code: 'G-TEST-1',
    expense_date: '2026-04-13',
    accounting_date: null,
    due_date: null,
    supplier_name: 'Proveedor test',
    supplier_tax_id: 'B00000000',
    category: 'productos_limpieza',
    subcategory: null,
    description: 'Productos de limpieza',
    document_type: 'factura',
    reference_number: 'F-1',
    payment_method: 'card',
    payment_status: 'paid',
    currency: 'EUR',
    subtotal: 100,
    tax_rate: 21,
    tax_amount: 21,
    total: 121,
    is_deductible: true,
    deductible_percentage: 100,
    affects_quarterly_closure: true,
    affects_annual_closure: true,
    receipt_file_url: 'storage://expense-receipts/test.pdf',
    receipt_file_path: 'expenses/test/test.pdf',
    attachment_count: 1,
    document_support_status: 'invoice_valid',
    fiscal_review_status: 'reviewed',
    fiscal_risk_level: 'low',
    manager_note: null,
    ai_fiscal_classification: null,
    ai_deductibility_percentage: null,
    ai_vat_deductibility_percentage: null,
    ai_estimated_deductible_base: null,
    ai_estimated_deductible_vat: null,
    ai_fiscal_confidence: null,
    ai_fiscal_risk_level: null,
    ai_fiscal_reasoning: null,
    ai_fiscal_flags: null,
    ai_fiscal_model: null,
    ai_fiscal_analyzed_at: null,
    ai_fiscal_source_version: null,
    notes: null,
    ...overrides,
  }
}

function checkFinancialLinePayloads(): void {
  const firstLine = {
    ...createBlankQuoteLine(),
    concept: 'Limpieza final',
    quantity: '2',
    unit_price: '40',
  }
  const secondLine = {
    ...createBlankQuoteLine(),
    concept: 'Materiales',
    quantity: '1',
    unit_price: '15.50',
  }

  assert(calculateQuoteSubtotal([firstLine, secondLine]) === 95.5, 'Quote subtotal should sum valid line subtotals.')

  const payloads = buildQuoteLinePayloads([firstLine, secondLine], 'QUOTE-CHECK-1')
  assert(payloads?.length === 2, 'Quote payload generation should return two valid lines.')
  assert(payloads?.[0]?.line_subtotal === 80, 'Quote payload should preserve rounded first-line subtotal.')
  assert(payloads?.[1]?.line_subtotal === 15.5, 'Quote payload should preserve rounded second-line subtotal.')
  assert(payloads?.[0]?.concept === 'Limpieza final', 'Quote payload should preserve the manual concept of the first line.')
  assert(payloads?.[1]?.concept === 'Materiales', 'Quote payload should preserve the manual concept of the second line.')
  assert(buildQuoteLinePayloads([{ ...firstLine, concept: '' }], 'QUOTE-CHECK-1') === null, 'Quote payloads should reject empty concepts.')
}

function checkExpenseFiscalSummary(): void {
  const analyzedExpense = makeExpense({
    ai_fiscal_classification: 'requires_review',
    ai_estimated_deductible_base: 60,
    ai_estimated_deductible_vat: 12.6,
    ai_fiscal_risk_level: 'high',
    ai_fiscal_analyzed_at: '2026-04-13T10:00:00.000Z',
  })
  const manualExpense = makeExpense({
    id: 'EXPENSE-CHECK-2',
    subtotal: 50,
    tax_amount: 10.5,
    total: 60.5,
    is_deductible: true,
    deductible_percentage: 50,
    document_support_status: 'invoice_valid',
  })

  assert(getEstimatedDeductibleBase(analyzedExpense) === 60, 'AI estimated deductible base should take precedence.')
  assert(getEstimatedDeductibleVat(analyzedExpense) === 12.6, 'AI estimated deductible VAT should take precedence.')
  assert(needsFiscalReview(analyzedExpense), 'AI requires_review classification should require review.')
  assert(hasMediumHighFiscalRisk(analyzedExpense), 'AI high risk should count as fiscal risk.')

  const summary = buildExpenseFiscalSummary([analyzedExpense, manualExpense])
  assert(summary.estimatedDeductibleBase === 85, 'Fiscal summary should combine AI and manual deductible bases.')
  assert(summary.estimatedDeductibleVat === 17.85, 'Fiscal summary should combine AI and manual deductible VAT.')
  assert(summary.needsReviewCount === 1, 'Fiscal summary should count review-required expenses.')
  assert(summary.mediumHighRiskCount === 1, 'Fiscal summary should count medium/high-risk expenses.')
  assert(summary.analyzedCount === 1 && summary.unanalyzedCount === 1, 'Fiscal summary should separate analyzed and unanalyzed expenses.')
}

function checkDeterministicFiscalRules(): void {
  const supportedOperationalExpense = makeExpense()
  const supportedPrecheck = buildExpenseFiscalPrecheck(supportedOperationalExpense)
  assert(supportedPrecheck.classification === 'probably_deductible', 'Operational expense with valid invoice should be probably deductible.')
  assert(supportedPrecheck.vat_deductibility_percentage === 100, 'Valid operational invoice should allow full VAT estimate.')
  assert(supportedPrecheck.risk_level === 'low', 'Valid operational invoice should be low risk.')

  const weakMixedExpense = makeExpense({
    category: 'telefonia',
    document_type: 'ticket',
    document_support_status: 'missing',
    receipt_file_path: null,
    receipt_file_url: null,
    attachment_count: 0,
  })
  const weakMixedPrecheck = buildExpenseFiscalPrecheck(weakMixedExpense)
  assert(weakMixedPrecheck.classification === 'requires_review', 'Weak mixed-use expense should require review.')
  assert(weakMixedPrecheck.vat_deductibility_percentage === 0, 'Weak support should keep VAT estimate at zero.')
  assert(weakMixedPrecheck.flags.includes('missing_or_weak_document_support'), 'Weak support flag should be present.')
}

export function runCriticalLogicChecks(): void {
  checkFinancialLinePayloads()
  checkExpenseFiscalSummary()
  checkDeterministicFiscalRules()
}

runCriticalLogicChecks()
