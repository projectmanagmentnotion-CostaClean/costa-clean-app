import { buildFiscalVatSummary } from '../closing/fiscalVatSummary'
import {
  isDateWithinFiscalPeriod,
  resolveFiscalPeriod,
  type FiscalPeriodSelection,
  type ResolvedFiscalPeriod,
} from '../closing/fiscalPeriods'
import {
  getExpenseDocumentSupportStatusLabel,
  getExpenseFiscalRiskLevelLabel,
  getExpenseFiscalReviewStatusLabel,
  type ExpenseListItem,
} from '../expenses/types'
import type { InvoiceListItem } from '../invoices/types'
import type { PaymentListItem } from '../payments/types'
import type { QuoteListItem } from '../quotes/types'

export interface FiscalPeriodExportMetrics {
  invoice_count: number
  payment_count: number
  expense_count: number
  quote_count: number
  pending_invoice_count: number
  unresolved_incidence_count: number
  invoiced_total: number
  collected_total: number
  outstanding_total: number
  expenses_total: number
  total_vat_supported: number
  estimated_deductible_vat: number
  estimated_deductible_base: number
  output_vat_total: number
  estimated_net_vat_payable: number
  fiscal_review_count: number
  fiscal_risk_count: number
  missing_valid_vat_invoice_count: number
}

export interface FiscalPeriodExportData {
  period: ResolvedFiscalPeriod
  invoices: InvoiceListItem[]
  payments: PaymentListItem[]
  expenses: ExpenseListItem[]
  quotes: QuoteListItem[]
  metrics: FiscalPeriodExportMetrics
  warnings: string[]
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2))
}

function filterRelevantQuotes(quotes: QuoteListItem[], period: ResolvedFiscalPeriod) {
  return quotes.filter((quote) => {
    const inPeriod = isDateWithinFiscalPeriod(quote.created_at ?? null, period)
    if (!inPeriod) return false

    return quote.status !== 'draft' || Boolean(quote.job_id || quote.invoice_id)
  })
}

export function buildFiscalPeriodExportData(input: {
  selection: FiscalPeriodSelection
  invoices: InvoiceListItem[]
  payments: PaymentListItem[]
  expenses: ExpenseListItem[]
  quotes: QuoteListItem[]
}): FiscalPeriodExportData {
  const period = resolveFiscalPeriod(input.selection)
  const invoices = input.invoices.filter((invoice) => isDateWithinFiscalPeriod(invoice.issue_date, period))
  const payments = input.payments.filter((payment) => isDateWithinFiscalPeriod(payment.payment_date, period))
  const expenses = input.expenses.filter((expense) => isDateWithinFiscalPeriod(expense.expense_date, period))
  const quotes = filterRelevantQuotes(input.quotes, period)

  const invoicePaidById = new Map<string, number>()
  for (const payment of input.payments) {
    invoicePaidById.set(payment.invoice_id, (invoicePaidById.get(payment.invoice_id) ?? 0) + Number(payment.amount || 0))
  }

  const pendingInvoices = invoices.filter((invoice) => {
    const paidAmount = invoice.paid_amount ?? invoicePaidById.get(invoice.id) ?? 0
    return Math.max(Number(invoice.total || 0) - paidAmount, 0) > 0.009
  })

  const vatSummary = buildFiscalVatSummary(invoices, expenses)
  const missingSupportExpenses = expenses.filter((expense) =>
    expense.document_support_status === 'missing'
      || (!expense.receipt_file_path && expense.document_support_status !== 'invoice_valid'),
  )
  const pendingReviewExpenses = expenses.filter((expense) => expense.fiscal_review_status === 'pending')
  const riskExpenses = expenses.filter((expense) => {
    const riskLevel = expense.ai_fiscal_risk_level ?? expense.fiscal_risk_level
    return riskLevel === 'medium' || riskLevel === 'high'
  })

  const warnings: string[] = []

  if (missingSupportExpenses.length > 0) {
    warnings.push(`${missingSupportExpenses.length} gasto(s) del periodo siguen sin soporte documental descargable.`)
  }

  if (pendingReviewExpenses.length > 0) {
    warnings.push(`${pendingReviewExpenses.length} gasto(s) del periodo siguen pendientes de revisión fiscal.`)
  }

  if (pendingInvoices.length > 0) {
    warnings.push(`${pendingInvoices.length} factura(s) emitidas en el periodo siguen con saldo pendiente.`)
  }

  return {
    period,
    invoices,
    payments,
    expenses,
    quotes,
    metrics: {
      invoice_count: invoices.length,
      payment_count: payments.length,
      expense_count: expenses.length,
      quote_count: quotes.length,
      pending_invoice_count: pendingInvoices.length,
      unresolved_incidence_count: missingSupportExpenses.length + pendingReviewExpenses.length + riskExpenses.length + pendingInvoices.length,
      invoiced_total: roundMoney(invoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0)),
      collected_total: roundMoney(payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)),
      outstanding_total: roundMoney(pendingInvoices.reduce((sum, invoice) => {
        const paidAmount = invoice.paid_amount ?? invoicePaidById.get(invoice.id) ?? 0
        return sum + Math.max(Number(invoice.total || 0) - paidAmount, 0)
      }, 0)),
      expenses_total: roundMoney(expenses.reduce((sum, expense) => sum + Number(expense.total || 0), 0)),
      total_vat_supported: vatSummary.supportedVatTotal,
      estimated_deductible_vat: vatSummary.estimatedDeductibleVat,
      estimated_deductible_base: vatSummary.estimatedDeductibleBase,
      output_vat_total: vatSummary.outputVatTotal,
      estimated_net_vat_payable: vatSummary.estimatedNetVatPayable,
      fiscal_review_count: vatSummary.expenseFiscalSummary.needsReviewCount,
      fiscal_risk_count: vatSummary.expenseFiscalSummary.mediumHighRiskCount,
      missing_valid_vat_invoice_count: vatSummary.expenseFiscalSummary.missingValidVatInvoiceCount,
    },
    warnings,
  }
}

export function buildFiscalPeriodIncidences(data: FiscalPeriodExportData) {
  return [
    {
      id: 'period_invoices',
      label: 'Facturas emitidas del periodo',
      detail: `${data.invoices.length} factura(s) incluidas en el paquete.`,
      count: data.invoices.length,
      tone: 'neutral' as const,
    },
    {
      id: 'period_payments',
      label: 'Cobros registrados del periodo',
      detail: `${data.payments.length} cobro(s) incluidos en el paquete.`,
      count: data.payments.length,
      tone: 'neutral' as const,
    },
    {
      id: 'period_expenses_missing_support',
      label: 'Gastos sin justificante descargable',
      detail: data.expenses
        .filter((expense) => expense.document_support_status === 'missing' || !expense.receipt_file_path)
        .map((expense) => `${expense.display_code ?? expense.id} · ${getExpenseDocumentSupportStatusLabel(expense.document_support_status)}`)
        .slice(0, 3)
        .join(' | ') || 'Sin incidencias documentales destacadas.',
      count: data.expenses.filter((expense) => expense.document_support_status === 'missing' || !expense.receipt_file_path).length,
      tone: data.expenses.some((expense) => expense.document_support_status === 'missing' || !expense.receipt_file_path) ? 'danger' as const : 'neutral' as const,
    },
    {
      id: 'period_expenses_review',
      label: 'Gastos con revisión o riesgo fiscal',
      detail: data.expenses
        .filter((expense) => expense.fiscal_review_status === 'pending' || expense.fiscal_risk_level === 'medium' || expense.fiscal_risk_level === 'high' || expense.ai_fiscal_risk_level === 'medium' || expense.ai_fiscal_risk_level === 'high')
        .map((expense) => `${expense.display_code ?? expense.id} · ${getExpenseFiscalReviewStatusLabel(expense.fiscal_review_status)} · riesgo ${getExpenseFiscalRiskLevelLabel(expense.ai_fiscal_risk_level ?? expense.fiscal_risk_level).toLowerCase()}`)
        .slice(0, 3)
        .join(' | ') || 'Sin gastos prioritarios para revisión.',
      count: data.metrics.fiscal_review_count + data.metrics.fiscal_risk_count,
      tone: data.metrics.fiscal_review_count + data.metrics.fiscal_risk_count > 0 ? 'warning' as const : 'neutral' as const,
    },
  ]
}
