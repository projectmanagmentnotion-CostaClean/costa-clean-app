import { automationRuleThresholds } from '../features/automation/ruleConfig'
import {
  hasMediumHighFiscalRisk,
  hasValidVatInvoiceSupport,
  hasZeroEstimatedDeductibleVat,
  needsFiscalReview,
} from '../features/expenses/fiscalIntelligenceSummary'
import type { ExpenseListItem } from '../features/expenses/types'
import type { InvoiceListItem } from '../features/invoices/types'
import type { JobListItem } from '../features/jobs/types'
import type { PaymentListItem } from '../features/payments/types'
import type { QuoteListItem } from '../features/quotes/types'

export type InvoiceModuleFilter =
  | 'pending'
  | 'partially_paid'
  | 'current_month'
  | 'unpaid_older_7d'
  | {
      type: 'quarter'
      fiscalYear: number
      fiscalQuarter: number
      scope: 'all' | 'pending'
    }
  | {
      type: 'year'
      fiscalYear: number
      scope: 'all' | 'pending'
    }

export type QuoteModuleFilter =
  | 'open'
  | 'accepted_without_job'
  | 'accepted_without_job_3d'
  | 'sent_older_5d'

export type JobModuleFilter =
  | 'scheduled'
  | 'completed_without_invoice'
  | 'completed_without_invoice_2d'
  | 'today'
  | 'tomorrow'
  | 'upcoming'

export type ExpenseModuleFilter =
  | 'missing_receipt'
  | 'pending_review'
  | 'current_month'
  | 'fiscal_requires_review'
  | 'fiscal_medium_high_risk'
  | 'vat_zero_estimate'
  | 'missing_valid_vat_invoice'
  | {
      type: 'classification'
      classification: 'probably_deductible' | 'partially_deductible' | 'probably_not_deductible' | 'requires_review'
    }
  | {
      type: 'quarter'
      fiscalYear: number
      fiscalQuarter: number
      scope: 'all' | 'closure' | 'missing_support' | 'pending_review' | 'risk'
    }
  | {
      type: 'year'
      fiscalYear: number
      scope: 'all' | 'closure' | 'missing_support' | 'pending_review' | 'risk'
    }

export type PaymentModuleFilter =
  | 'current_month'
  | {
      type: 'invoice'
      invoiceId: string
      invoiceLabel: string
    }
  | {
      type: 'quarter'
      fiscalYear: number
      fiscalQuarter: number
      scope: 'all'
    }
  | {
      type: 'year'
      fiscalYear: number
      scope: 'all'
    }

function getMonthKey(dateValue: string): string | null {
  if (!dateValue) return null
  const date = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function getCurrentMonthKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function getDateValue(dateValue: string): Date | null {
  if (!dateValue) return null
  const normalizedValue = dateValue.length > 10 ? dateValue : `${dateValue}T00:00:00`
  const date = new Date(normalizedValue)
  return Number.isNaN(date.getTime()) ? null : date
}

function matchesDateQuarter(dateValue: string, fiscalYear: number, fiscalQuarter: number): boolean {
  const date = getDateValue(dateValue)
  if (!date) return false
  return date.getFullYear() === fiscalYear && Math.floor(date.getMonth() / 3) + 1 === fiscalQuarter
}

function matchesExpenseQuarter(expense: ExpenseListItem, fiscalYear: number, fiscalQuarter: number): boolean {
  if (expense.fiscal_year && expense.fiscal_quarter) {
    return expense.fiscal_year === fiscalYear && expense.fiscal_quarter === fiscalQuarter
  }

  return matchesDateQuarter(expense.expense_date, fiscalYear, fiscalQuarter)
}

function matchesDateYear(dateValue: string, fiscalYear: number): boolean {
  const date = getDateValue(dateValue)
  if (!date) return false
  return date.getFullYear() === fiscalYear
}

function matchesExpenseYear(expense: ExpenseListItem, fiscalYear: number): boolean {
  if (expense.fiscal_year) {
    return expense.fiscal_year === fiscalYear
  }

  return matchesDateYear(expense.expense_date, fiscalYear)
}

function getDateKey(dateValue: string): string | null {
  const date = getDateValue(dateValue)
  if (!date) return null
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createDayKey(offsetDays = 0): string {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + offsetDays)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isOlderThanDays(dateValue: string, days: number): boolean {
  const date = getDateValue(dateValue)
  if (!date) return false
  const threshold = new Date()
  threshold.setHours(0, 0, 0, 0)
  threshold.setDate(threshold.getDate() - days)
  return date < threshold
}

function getQuarterLabel(fiscalYear: number, fiscalQuarter: number): string {
  return `T${fiscalQuarter} ${fiscalYear}`
}

function getYearLabel(fiscalYear: number): string {
  return `${fiscalYear}`
}

export interface ModuleFilterState {
  invoices: InvoiceModuleFilter | null
  quotes: QuoteModuleFilter | null
  jobs: JobModuleFilter | null
  expenses: ExpenseModuleFilter | null
  payments: PaymentModuleFilter | null
}

export const emptyModuleFilterState: ModuleFilterState = {
  invoices: null,
  quotes: null,
  jobs: null,
  expenses: null,
  payments: null,
}

export function getInvoiceFilterLabel(filter: InvoiceModuleFilter | null): string | null {
  if (filter === 'pending') return 'Pendientes de cobro'
  if (filter === 'partially_paid') return 'Facturas parcialmente cobradas'
  if (filter === 'current_month') return 'Facturas emitidas este mes'
  if (filter === 'unpaid_older_7d') return 'Facturas pendientes con más de 7 días'
  if (filter?.type === 'quarter' && filter.scope === 'all') return `Facturas de ${getQuarterLabel(filter.fiscalYear, filter.fiscalQuarter)}`
  if (filter?.type === 'quarter' && filter.scope === 'pending') return `Pendiente de cobro de ${getQuarterLabel(filter.fiscalYear, filter.fiscalQuarter)}`
  if (filter?.type === 'year' && filter.scope === 'all') return `Facturas de ${getYearLabel(filter.fiscalYear)}`
  if (filter?.type === 'year' && filter.scope === 'pending') return `Pendiente de cobro de ${getYearLabel(filter.fiscalYear)}`
  return null
}

export function getQuoteFilterLabel(filter: QuoteModuleFilter | null): string | null {
  if (filter === 'open') return 'Presupuestos abiertos'
  if (filter === 'accepted_without_job') return 'Presupuestos aceptados sin trabajo'
  if (filter === 'accepted_without_job_3d') {
    return `Presupuestos aceptados sin trabajo con más de ${automationRuleThresholds.acceptedQuotesWithoutJobOlderThanDays} días`
  }
  if (filter === 'sent_older_5d') return 'Presupuestos enviados con más de 5 días'
  return null
}

export function getJobFilterLabel(filter: JobModuleFilter | null): string | null {
  if (filter === 'scheduled') return 'Servicios programados o en curso'
  if (filter === 'completed_without_invoice') return 'Servicios completados sin factura'
  if (filter === 'completed_without_invoice_2d') return 'Servicios completados sin factura con más de 2 días'
  if (filter === 'today') return 'Servicios programados para hoy'
  if (filter === 'tomorrow') return 'Servicios programados para mañana'
  if (filter === 'upcoming') return 'Próximos servicios programados'
  return null
}

export function getExpenseFilterLabel(filter: ExpenseModuleFilter | null): string | null {
  if (filter === 'missing_receipt') return 'Sin ticket o factura adjunta'
  if (filter === 'pending_review') return 'Gastos pendientes de revisión fiscal'
  if (filter === 'current_month') return 'Gastos del mes'
  if (filter === 'fiscal_requires_review') return 'Estimacion fiscal: requiere revision'
  if (filter === 'fiscal_medium_high_risk') return 'Riesgo fiscal medio/alto'
  if (filter === 'vat_zero_estimate') return 'IVA deducible estimado 0'
  if (filter === 'missing_valid_vat_invoice') return 'Sin factura valida para IVA'
  if (filter?.type === 'classification') {
    if (filter.classification === 'probably_deductible') return 'Estimacion: probablemente deducible'
    if (filter.classification === 'partially_deductible') return 'Estimacion: parcialmente deducible'
    if (filter.classification === 'probably_not_deductible') return 'Estimacion: probablemente no deducible'
    return 'Estimacion: requiere revision'
  }
  if (filter?.type === 'quarter' && filter.scope === 'all') return `Gastos de ${getQuarterLabel(filter.fiscalYear, filter.fiscalQuarter)}`
  if (filter?.type === 'quarter' && filter.scope === 'closure') return `Gastos que afectan al cierre en ${getQuarterLabel(filter.fiscalYear, filter.fiscalQuarter)}`
  if (filter?.type === 'quarter' && filter.scope === 'missing_support') return `Gastos sin justificante en ${getQuarterLabel(filter.fiscalYear, filter.fiscalQuarter)}`
  if (filter?.type === 'quarter' && filter.scope === 'pending_review') return `Gastos pendientes de revisión en ${getQuarterLabel(filter.fiscalYear, filter.fiscalQuarter)}`
  if (filter?.type === 'quarter' && filter.scope === 'risk') return `Gastos con riesgo medio/alto en ${getQuarterLabel(filter.fiscalYear, filter.fiscalQuarter)}`
  if (filter?.type === 'year' && filter.scope === 'all') return `Gastos de ${getYearLabel(filter.fiscalYear)}`
  if (filter?.type === 'year' && filter.scope === 'closure') return `Gastos que afectan al cierre en ${getYearLabel(filter.fiscalYear)}`
  if (filter?.type === 'year' && filter.scope === 'missing_support') return `Gastos sin justificante en ${getYearLabel(filter.fiscalYear)}`
  if (filter?.type === 'year' && filter.scope === 'pending_review') return `Gastos pendientes de revisión en ${getYearLabel(filter.fiscalYear)}`
  if (filter?.type === 'year' && filter.scope === 'risk') return `Gastos con riesgo medio/alto en ${getYearLabel(filter.fiscalYear)}`
  return null
}

export function getPaymentFilterLabel(filter: PaymentModuleFilter | null): string | null {
  if (filter === 'current_month') return 'Cobros del mes'
  if (filter?.type === 'invoice') return `Cobros de ${filter.invoiceLabel}`
  if (filter?.type === 'quarter') return `Cobros de ${getQuarterLabel(filter.fiscalYear, filter.fiscalQuarter)}`
  if (filter?.type === 'year') return `Cobros de ${getYearLabel(filter.fiscalYear)}`
  return null
}

export function applyInvoiceFilter(invoices: InvoiceListItem[], filter: InvoiceModuleFilter | null): InvoiceListItem[] {
  if (filter === 'pending') {
    return invoices.filter((invoice) => (invoice.outstanding_amount ?? Number(invoice.total || 0)) > 0.009 && invoice.status !== 'cancelled')
  }

  if (filter === 'partially_paid') {
    return invoices.filter((invoice) => invoice.payment_status === 'partially_paid')
  }

  if (filter === 'current_month') {
    const currentMonthKey = getCurrentMonthKey()
    return invoices.filter((invoice) => getMonthKey(invoice.issue_date) === currentMonthKey)
  }

  if (filter === 'unpaid_older_7d') {
    return invoices.filter((invoice) => (invoice.outstanding_amount ?? Number(invoice.total || 0)) > 0.009 && invoice.status !== 'cancelled' && isOlderThanDays(invoice.issue_date, 7))
  }

  if (filter?.type === 'quarter') {
    const quarterInvoices = invoices.filter((invoice) =>
      matchesDateQuarter(invoice.issue_date, filter.fiscalYear, filter.fiscalQuarter),
    )

    if (filter.scope === 'pending') {
      return quarterInvoices.filter((invoice) => (invoice.outstanding_amount ?? Number(invoice.total || 0)) > 0.009 && invoice.status !== 'cancelled')
    }

    return quarterInvoices
  }

  if (filter?.type === 'year') {
    const yearInvoices = invoices.filter((invoice) =>
      matchesDateYear(invoice.issue_date, filter.fiscalYear),
    )

    if (filter.scope === 'pending') {
      return yearInvoices.filter((invoice) => (invoice.outstanding_amount ?? Number(invoice.total || 0)) > 0.009 && invoice.status !== 'cancelled')
    }

    return yearInvoices
  }

  return invoices
}

export function applyQuoteFilter(quotes: QuoteListItem[], filter: QuoteModuleFilter | null): QuoteListItem[] {
  if (filter === 'open') {
    return quotes.filter((quote) => quote.status === 'draft' || quote.status === 'sent')
  }

  if (filter === 'accepted_without_job') {
    return quotes.filter((quote) => quote.status === 'accepted' && !quote.job_id)
  }

  if (filter === 'accepted_without_job_3d') {
    return quotes.filter(
      (quote) =>
        quote.status === 'accepted' &&
        !quote.job_id &&
        isOlderThanDays(quote.created_at ?? '', automationRuleThresholds.acceptedQuotesWithoutJobOlderThanDays),
    )
  }

  if (filter === 'sent_older_5d') {
    return quotes.filter((quote) => quote.status === 'sent' && isOlderThanDays(quote.created_at ?? '', 5))
  }

  return quotes
}

export function applyJobFilter(jobs: JobListItem[], filter: JobModuleFilter | null): JobListItem[] {
  if (filter === 'scheduled') {
    return jobs.filter((job) => job.status === 'scheduled' || job.status === 'in_progress')
  }

  if (filter === 'completed_without_invoice') {
    return jobs.filter((job) => job.status === 'completed' && !job.invoice_id)
  }

  if (filter === 'completed_without_invoice_2d') {
    return jobs.filter((job) => job.status === 'completed' && !job.invoice_id && isOlderThanDays(job.scheduled_date, 2))
  }

  if (filter === 'today') {
    const todayKey = createDayKey(0)
    return jobs.filter((job) => getDateKey(job.scheduled_date) === todayKey && job.status !== 'cancelled')
  }

  if (filter === 'tomorrow') {
    const tomorrowKey = createDayKey(1)
    return jobs.filter((job) => getDateKey(job.scheduled_date) === tomorrowKey && job.status !== 'cancelled')
  }

  if (filter === 'upcoming') {
    const tomorrowKey = createDayKey(1)
    return jobs.filter((job) => {
      const jobDate = getDateValue(job.scheduled_date)
      const tomorrowDate = getDateValue(tomorrowKey)
      if (!jobDate || !tomorrowDate) return false
      return jobDate > tomorrowDate && job.status !== 'completed' && job.status !== 'cancelled'
    })
  }

  return jobs
}

export function applyExpenseFilter(expenses: ExpenseListItem[], filter: ExpenseModuleFilter | null): ExpenseListItem[] {
  if (filter === 'missing_receipt') {
    return expenses.filter((expense) => !expense.receipt_file_path || expense.document_support_status === 'missing')
  }

  if (filter === 'pending_review') {
    return expenses.filter((expense) => expense.fiscal_review_status === 'pending')
  }

  if (filter === 'current_month') {
    const currentMonthKey = getCurrentMonthKey()
    return expenses.filter((expense) => getMonthKey(expense.expense_date) === currentMonthKey)
  }

  if (filter === 'fiscal_requires_review') {
    return expenses.filter((expense) => needsFiscalReview(expense))
  }

  if (filter === 'fiscal_medium_high_risk') {
    return expenses.filter((expense) => hasMediumHighFiscalRisk(expense))
  }

  if (filter === 'vat_zero_estimate') {
    return expenses.filter((expense) => hasZeroEstimatedDeductibleVat(expense))
  }

  if (filter === 'missing_valid_vat_invoice') {
    return expenses.filter((expense) => !hasValidVatInvoiceSupport(expense))
  }

  if (filter?.type === 'classification') {
    return expenses.filter((expense) => expense.ai_fiscal_classification === filter.classification)
  }

  if (filter?.type === 'quarter') {
    const quarterExpenses = expenses.filter((expense) =>
      matchesExpenseQuarter(expense, filter.fiscalYear, filter.fiscalQuarter),
    )

    if (filter.scope === 'closure') {
      return quarterExpenses.filter((expense) => expense.affects_quarterly_closure)
    }

    if (filter.scope === 'missing_support') {
      return quarterExpenses.filter(
        (expense) =>
          expense.affects_quarterly_closure &&
          (expense.document_support_status === 'missing' ||
            (!expense.receipt_file_path && expense.document_support_status !== 'invoice_valid')),
      )
    }

    if (filter.scope === 'pending_review') {
      return quarterExpenses.filter(
        (expense) => expense.affects_quarterly_closure && needsFiscalReview(expense),
      )
    }

    if (filter.scope === 'risk') {
      return quarterExpenses.filter(
        (expense) => expense.affects_quarterly_closure && hasMediumHighFiscalRisk(expense),
      )
    }

    return quarterExpenses
  }

  if (filter?.type === 'year') {
    const yearExpenses = expenses.filter((expense) =>
      matchesExpenseYear(expense, filter.fiscalYear),
    )

    if (filter.scope === 'closure') {
      return yearExpenses.filter((expense) => expense.affects_annual_closure)
    }

    if (filter.scope === 'missing_support') {
      return yearExpenses.filter(
        (expense) =>
          expense.affects_annual_closure &&
          (expense.document_support_status === 'missing' ||
            (!expense.receipt_file_path && expense.document_support_status !== 'invoice_valid')),
      )
    }

    if (filter.scope === 'pending_review') {
      return yearExpenses.filter(
        (expense) => expense.affects_annual_closure && needsFiscalReview(expense),
      )
    }

    if (filter.scope === 'risk') {
      return yearExpenses.filter(
        (expense) => expense.affects_annual_closure && hasMediumHighFiscalRisk(expense),
      )
    }

    return yearExpenses
  }

  return expenses
}

export function applyPaymentFilter(payments: PaymentListItem[], filter: PaymentModuleFilter | null): PaymentListItem[] {
  if (filter === 'current_month') {
    const currentMonthKey = getCurrentMonthKey()
    return payments.filter((payment) => getMonthKey(payment.payment_date) === currentMonthKey)
  }

  if (filter?.type === 'invoice') {
    return payments.filter((payment) => payment.invoice_id === filter.invoiceId)
  }

  if (filter?.type === 'quarter') {
    return payments.filter((payment) =>
      matchesDateQuarter(payment.payment_date, filter.fiscalYear, filter.fiscalQuarter),
    )
  }

  if (filter?.type === 'year') {
    return payments.filter((payment) =>
      matchesDateYear(payment.payment_date, filter.fiscalYear),
    )
  }

  return payments
}
