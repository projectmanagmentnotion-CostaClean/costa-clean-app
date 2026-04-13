import type { AppView } from '../../app/navigation'
import type { QuarterlyClosingSummary } from '../quarterlyClosing/types'

export type AnnualClosingStatus = 'prepared' | 'issues'

export interface AnnualClosingQuarterBreakdown {
  fiscal_quarter: number
  invoiced_total: number
  collected_total: number
  outstanding_total: number
  expenses_total: number
  unresolved_incidence_count: number
}

export interface AnnualClosingMetricSnapshot {
  invoice_count: number
  payment_count: number
  expense_count: number
  closure_expense_count: number
  missing_support_count: number
  pending_review_count: number
  risk_count: number
  fiscal_review_count: number
  fiscal_risk_count: number
  missing_valid_vat_invoice_count: number
  pending_invoice_count: number
  unresolved_incidence_count: number
  invoiced_total: number
  collected_total: number
  outstanding_total: number
  expenses_total: number
  estimated_deductible_base: number
  estimated_deductible_vat: number
  total_vat_supported: number
  quarterly_breakdown: AnnualClosingQuarterBreakdown[]
}

export interface AnnualClosingSnapshot {
  fiscal_year: number
  generated_at: string
  metrics: AnnualClosingMetricSnapshot
}

export interface AnnualClosingRecord {
  id: string
  fiscal_year: number
  status: AnnualClosingStatus
  closed_at: string | null
  notes: string | null
  snapshot_json: AnnualClosingSnapshot | null
  created_at?: string
  updated_at?: string
}

export interface AnnualClosingIncidence {
  id: string
  label: string
  detail: string
  count: number
  tone: 'neutral' | 'warning' | 'danger'
  view: AppView
  scope:
    | 'invoice_year_all'
    | 'invoice_year_pending'
    | 'payment_year_all'
    | 'expense_year_all'
    | 'expense_year_closure'
    | 'expense_year_missing_support'
    | 'expense_year_pending_review'
    | 'expense_year_risk'
}

export interface AnnualClosingSummary {
  fiscalYear: number
  invoiceCount: number
  paymentCount: number
  expenseCount: number
  closureExpenseCount: number
  missingSupportCount: number
  pendingReviewCount: number
  riskCount: number
  fiscalReviewCount: number
  fiscalRiskCount: number
  missingValidVatInvoiceCount: number
  pendingInvoiceCount: number
  unresolvedIncidenceCount: number
  invoicedTotal: number
  collectedTotal: number
  outstandingTotal: number
  expensesTotal: number
  estimatedDeductibleBase: number
  estimatedDeductibleVat: number
  totalVatSupported: number
  readiness: 'ready' | 'issues'
  quarterlyBreakdown: Array<AnnualClosingQuarterBreakdown & { quarterlySummary: QuarterlyClosingSummary }>
  incidences: AnnualClosingIncidence[]
}
