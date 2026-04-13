import type { ExpenseListItem } from './types'

export interface ExpenseFiscalSummary {
  totalVatSupported: number
  estimatedDeductibleVat: number
  estimatedDeductibleBase: number
  needsReviewCount: number
  mediumHighRiskCount: number
  missingValidVatInvoiceCount: number
  zeroEstimatedVatCount: number
  analyzedCount: number
  unanalyzedCount: number
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2))
}

function getPercent(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.max(0, Math.min(100, value))
}

export function hasValidVatInvoiceSupport(expense: ExpenseListItem): boolean {
  return (
    expense.document_support_status === 'invoice_valid' &&
    expense.document_type === 'factura' &&
    Boolean(expense.receipt_file_path)
  )
}

export function needsFiscalReview(expense: ExpenseListItem): boolean {
  return (
    expense.fiscal_review_status === 'pending' ||
    expense.ai_fiscal_classification === 'requires_review'
  )
}

export function hasMediumHighFiscalRisk(expense: ExpenseListItem): boolean {
  const riskLevel = expense.ai_fiscal_risk_level ?? expense.fiscal_risk_level
  return riskLevel === 'medium' || riskLevel === 'high'
}

export function hasZeroEstimatedDeductibleVat(expense: ExpenseListItem): boolean {
  return getEstimatedDeductibleVat(expense) <= 0.009
}

export function getEstimatedDeductibleBase(expense: ExpenseListItem): number {
  if (typeof expense.ai_estimated_deductible_base === 'number') {
    return roundMoney(Math.max(0, expense.ai_estimated_deductible_base))
  }

  const manualPercentage = expense.is_deductible
    ? getPercent(expense.deductible_percentage) ?? 100
    : 0

  return roundMoney(Number(expense.subtotal || 0) * manualPercentage / 100)
}

export function getEstimatedDeductibleVat(expense: ExpenseListItem): number {
  if (typeof expense.ai_estimated_deductible_vat === 'number') {
    return roundMoney(Math.max(0, expense.ai_estimated_deductible_vat))
  }

  const vatPercentage = hasValidVatInvoiceSupport(expense)
    ? getPercent(expense.ai_vat_deductibility_percentage) ?? (expense.is_deductible ? getPercent(expense.deductible_percentage) ?? 100 : 0)
    : 0

  return roundMoney(Number(expense.tax_amount || 0) * vatPercentage / 100)
}

export function buildExpenseFiscalSummary(expenses: ExpenseListItem[]): ExpenseFiscalSummary {
  return expenses.reduce<ExpenseFiscalSummary>((summary, expense) => {
    const hasAnalysis = Boolean(expense.ai_fiscal_classification || expense.ai_fiscal_analyzed_at)

    summary.totalVatSupported = roundMoney(summary.totalVatSupported + Number(expense.tax_amount || 0))
    summary.estimatedDeductibleVat = roundMoney(summary.estimatedDeductibleVat + getEstimatedDeductibleVat(expense))
    summary.estimatedDeductibleBase = roundMoney(summary.estimatedDeductibleBase + getEstimatedDeductibleBase(expense))

    if (needsFiscalReview(expense)) summary.needsReviewCount += 1
    if (hasMediumHighFiscalRisk(expense)) summary.mediumHighRiskCount += 1
    if (!hasValidVatInvoiceSupport(expense)) summary.missingValidVatInvoiceCount += 1
    if (hasZeroEstimatedDeductibleVat(expense)) summary.zeroEstimatedVatCount += 1
    if (hasAnalysis) summary.analyzedCount += 1
    else summary.unanalyzedCount += 1

    return summary
  }, {
    totalVatSupported: 0,
    estimatedDeductibleVat: 0,
    estimatedDeductibleBase: 0,
    needsReviewCount: 0,
    mediumHighRiskCount: 0,
    missingValidVatInvoiceCount: 0,
    zeroEstimatedVatCount: 0,
    analyzedCount: 0,
    unanalyzedCount: 0,
  })
}
