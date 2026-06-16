import type { AppView } from '../../app/navigation'

export type QuarterlyClosingStatus = 'prepared' | 'issues'

export interface QuarterlyClosingRecord {
  id: string
  fiscal_year: number
  fiscal_quarter: number
  status: QuarterlyClosingStatus
  closed_at: string | null
  notes: string | null
  snapshot_json: QuarterlyClosingSnapshot | null
  created_at?: string
  updated_at?: string
}

export interface QuarterlyClosingMetricSnapshot {
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
  output_vat_total: number
  estimated_deductible_base: number
  estimated_deductible_vat: number
  total_vat_supported: number
  estimated_net_vat_payable: number
}

export interface QuarterlyClosingSnapshot {
  fiscal_year: number
  fiscal_quarter: number
  generated_at: string
  metrics: QuarterlyClosingMetricSnapshot
}

export interface QuarterlyClosingIncidence {
  id: string
  label: string
  detail: string
  count: number
  tone: 'neutral' | 'warning' | 'danger'
  view: AppView
  scope:
    | 'invoice_quarter_all'
    | 'invoice_quarter_pending'
    | 'payment_quarter_all'
    | 'expense_quarter_all'
    | 'expense_quarter_closure'
    | 'expense_quarter_missing_support'
    | 'expense_quarter_pending_review'
    | 'expense_quarter_risk'
}

export interface QuarterlyClosingSummary {
  fiscalYear: number
  fiscalQuarter: number
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
  outputVatTotal: number
  estimatedDeductibleBase: number
  estimatedDeductibleVat: number
  totalVatSupported: number
  estimatedNetVatPayable: number
  incidences: QuarterlyClosingIncidence[]
  readiness: 'ready' | 'issues'
}
