import type { ExpenseListItem } from '../expenses/types'
import type { InvoiceListItem } from '../invoices/types'
import type { JobListItem } from '../jobs/types'
import type { LeadDraftRecord } from '../leadDrafts/types'
import type { PaymentListItem } from '../payments/types'
import type { QuoteListItem } from '../quotes/types'
import type { QuarterlyClosingRecord } from '../quarterlyClosing/types'
import type { RecurringInvoicePlanListItem } from '../recurringInvoices/types'
import { automationRuleThresholds } from './ruleConfig'
import type { AutomationAlertItem } from './types'

interface BuildAutomationAlertsInput {
  invoices: InvoiceListItem[]
  jobs: JobListItem[]
  quotes: QuoteListItem[]
  expenses: ExpenseListItem[]
  payments: PaymentListItem[]
  quarterlyClosings: QuarterlyClosingRecord[]
  leadDrafts?: LeadDraftRecord[]
  recurringInvoicePlans?: RecurringInvoicePlanListItem[]
}

function getDateValue(dateValue: string | null | undefined): Date | null {
  if (!dateValue) return null
  const normalizedValue = dateValue.length > 10 ? dateValue : `${dateValue}T00:00:00`
  const date = new Date(normalizedValue)
  return Number.isNaN(date.getTime()) ? null : date
}

function isOlderThanDays(dateValue: string | null | undefined, days: number): boolean {
  const date = getDateValue(dateValue)
  if (!date) return false
  const threshold = new Date()
  threshold.setHours(0, 0, 0, 0)
  threshold.setDate(threshold.getDate() - days)
  return date < threshold
}

function getOldestDateValue<T>(items: T[], getDate: (item: T) => string | null | undefined): string | null {
  let oldest: Date | null = null

  for (const item of items) {
    const date = getDateValue(getDate(item))
    if (!date) continue
    if (!oldest || date < oldest) oldest = date
  }

  return oldest ? oldest.toISOString() : null
}

function getDaysOpen(dateValue: string | null | undefined): number | null {
  const date = getDateValue(dateValue)
  if (!date) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const normalizedDate = new Date(date)
  normalizedDate.setHours(0, 0, 0, 0)
  return Math.max(0, Math.floor((today.getTime() - normalizedDate.getTime()) / 86400000))
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(dateValue: string | null | undefined): string {
  const date = getDateValue(dateValue)
  if (!date) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatQuarterLabel(fiscalYear: number, fiscalQuarter: number): string {
  return `T${fiscalQuarter} ${fiscalYear}`
}

function buildExampleLabel(label: string | null | undefined, fallback: string): string {
  const trimmed = label?.trim()
  return trimmed ? trimmed : fallback
}

function getPreviousQuarterReference() {
  const today = new Date()
  const currentQuarter = Math.floor(today.getMonth() / 3) + 1
  const fiscalYear = today.getFullYear()

  if (currentQuarter === 1) {
    return { fiscalYear: fiscalYear - 1, fiscalQuarter: 4 }
  }

  return { fiscalYear, fiscalQuarter: currentQuarter - 1 }
}

function getQuarterClosingReminderDate(fiscalYear: number, fiscalQuarter: number): Date {
  const quarterEndMonth = fiscalQuarter * 3
  const reminderDate = new Date(fiscalYear, quarterEndMonth, 0)
  reminderDate.setHours(0, 0, 0, 0)
  reminderDate.setDate(reminderDate.getDate() + automationRuleThresholds.quarterClosingReminderAfterDays)
  return reminderDate
}

export function buildAutomationAlerts({
  invoices,
  jobs,
  quotes,
  expenses,
  payments,
  quarterlyClosings,
  leadDrafts = [],
  recurringInvoicePlans = [],
}: BuildAutomationAlertsInput): AutomationAlertItem[] {
  const alerts: AutomationAlertItem[] = []
  const invoicePaidAmount = new Map<string, number>()
  const pendingIntakeDrafts = leadDrafts.filter(
    (draft) => draft.status !== 'converted' && draft.status !== 'dismissed',
  )

  if (pendingIntakeDrafts.length > 0) {
    alerts.push({
      id: 'public-intake-lead-drafts-pending',
      ruleId: 'public_intake_lead_drafts_pending',
      severity: 'info',
      title: 'Solicitudes de presupuesto pendientes',
      summary: `${pendingIntakeDrafts.length} solicitud(es) de intake por revisar`,
      detail: 'Borradores generados desde el formulario publico que requieren revision operativa antes de enviar respuesta.',
      count: pendingIntakeDrafts.length,
      examples: pendingIntakeDrafts.slice(0, 3).map((draft) =>
        `${buildExampleLabel(draft.suggested_full_name, 'Lead sin nombre')} · ${draft.city ?? draft.phone}`,
      ),
      routing: {
        kind: 'view',
        view: 'leads',
      },
    })
  }

  const dueRecurringPlans = recurringInvoicePlans.filter((plan) => {
    if (plan.status !== 'active') return false
    const nextDate = getDateValue(plan.next_issue_date)
    if (!nextDate) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    nextDate.setHours(0, 0, 0, 0)
    return nextDate <= today
  })

  if (dueRecurringPlans.length > 0) {
    alerts.push({
      id: 'recurring-invoice-plans-due',
      ruleId: 'recurring_invoice_plan_due',
      severity: 'warning',
      title: 'Automatizaciones recurrentes listas para emitir',
      summary: `${dueRecurringPlans.length} plan(es) con emision vencida o para hoy`,
      detail: 'Planes recurrentes activos cuya proxima emision ya esta disponible y conviene revisar o ejecutar.',
      count: dueRecurringPlans.length,
      examples: dueRecurringPlans.slice(0, 3).map((plan) =>
        `${buildExampleLabel(plan.title, 'Plan recurrente sin titulo')} · ${formatDate(plan.next_issue_date)}`,
      ),
      routing: {
        kind: 'view',
        view: 'clients',
      },
    })
  }

  for (const payment of payments) {
    invoicePaidAmount.set(payment.invoice_id, (invoicePaidAmount.get(payment.invoice_id) ?? 0) + payment.amount)
  }

  const overdueInvoices = invoices.filter((invoice) => {
    if (invoice.status === 'paid') return false
    const pendingAmount = Math.max(0, invoice.total - (invoicePaidAmount.get(invoice.id) ?? 0))
    return pendingAmount > 0 && isOlderThanDays(invoice.issue_date, automationRuleThresholds.unpaidInvoicesOlderThanDays)
  })

  if (overdueInvoices.length > 0) {
    const totalPending = overdueInvoices.reduce(
      (sum, invoice) => sum + Math.max(0, invoice.total - (invoicePaidAmount.get(invoice.id) ?? 0)),
      0,
    )
    const oldestDate = getOldestDateValue(overdueInvoices, (invoice) => invoice.issue_date)
    const oldestAge = getDaysOpen(oldestDate)

    alerts.push({
      id: 'unpaid-invoices-older-threshold',
      ruleId: 'unpaid_invoices_older_threshold',
      severity: 'critical',
      title: 'Facturas pendientes fuera de plazo interno',
      summary: `${overdueInvoices.length} factura(s) pendientes · ${formatCurrency(totalPending)}`,
      detail: `Facturas emitidas hace más de ${automationRuleThresholds.unpaidInvoicesOlderThanDays} días y todavía sin cobro completo.`,
      count: overdueInvoices.length,
      amount: totalPending,
      ageContext: oldestAge ? `La más antigua lleva ${oldestAge} días abierta.` : undefined,
      contextLabel: oldestDate ? `Primera emisión detectada: ${formatDate(oldestDate)}.` : undefined,
      examples: overdueInvoices.slice(0, 3).map((invoice) =>
        `${buildExampleLabel(invoice.display_code ?? invoice.invoice_number, 'Factura sin código')} · ${invoice.client_name ?? 'Cliente sin nombre'}`,
      ),
      routing: {
        kind: 'module',
        view: 'invoices',
        filterKey: 'invoices',
        filterValue: 'unpaid_older_7d',
      },
    })
  }

  const completedJobsWithoutInvoice = jobs.filter(
    (job) =>
      job.status === 'completed' &&
      !job.invoice_id &&
      isOlderThanDays(job.scheduled_date, automationRuleThresholds.completedJobsWithoutInvoiceOlderThanDays),
  )

  if (completedJobsWithoutInvoice.length > 0) {
    const oldestDate = getOldestDateValue(completedJobsWithoutInvoice, (job) => job.scheduled_date)
    const oldestAge = getDaysOpen(oldestDate)

    alerts.push({
      id: 'completed-jobs-without-invoice-older-threshold',
      ruleId: 'completed_jobs_without_invoice_older_threshold',
      severity: 'critical',
      title: 'Servicios completados pendientes de facturar',
      summary: `${completedJobsWithoutInvoice.length} servicio(s) completados sin factura`,
      detail: `Servicios completados hace más de ${automationRuleThresholds.completedJobsWithoutInvoiceOlderThanDays} días que aún no han pasado a facturación.`,
      count: completedJobsWithoutInvoice.length,
      ageContext: oldestAge ? `El más antiguo acumula ${oldestAge} días.` : undefined,
      contextLabel: oldestDate ? `Primera fecha de servicio: ${formatDate(oldestDate)}.` : undefined,
      examples: completedJobsWithoutInvoice.slice(0, 3).map((job) =>
        `${buildExampleLabel(job.display_code, 'Servicio sin código')} · ${job.client_name ?? 'Cliente sin nombre'}`,
      ),
      routing: {
        kind: 'module',
        view: 'jobs',
        filterKey: 'jobs',
        filterValue: 'completed_without_invoice_2d',
      },
    })
  }

  const acceptedQuotesWithoutJob = quotes.filter(
    (quote) =>
      quote.status === 'accepted' &&
      !quote.job_id &&
      isOlderThanDays(quote.created_at ?? null, automationRuleThresholds.acceptedQuotesWithoutJobOlderThanDays),
  )

  if (acceptedQuotesWithoutJob.length > 0) {
    const acceptedAmount = acceptedQuotesWithoutJob.reduce((sum, quote) => sum + quote.total, 0)
    const oldestDate = getOldestDateValue(acceptedQuotesWithoutJob, (quote) => quote.created_at ?? null)
    const oldestAge = getDaysOpen(oldestDate)

    alerts.push({
      id: 'accepted-quotes-without-job-older-threshold',
      ruleId: 'accepted_quotes_without_job_older_threshold',
      severity: 'warning',
      title: 'Presupuestos aceptados sin servicio programado',
      summary: `${acceptedQuotesWithoutJob.length} presupuesto(s) aceptados · ${formatCurrency(acceptedAmount)}`,
      detail: `Presupuestos aceptados hace más de ${automationRuleThresholds.acceptedQuotesWithoutJobOlderThanDays} días que todavía no han generado trabajo.`,
      count: acceptedQuotesWithoutJob.length,
      amount: acceptedAmount,
      ageContext: oldestAge ? `El más antiguo lleva ${oldestAge} días esperando planificación.` : undefined,
      contextLabel: oldestDate ? `Primer presupuesto aceptado detectado: ${formatDate(oldestDate)}.` : undefined,
      examples: acceptedQuotesWithoutJob.slice(0, 3).map((quote) =>
        `${buildExampleLabel(quote.display_code, 'Presupuesto sin código')} · ${formatCurrency(quote.total)}`,
      ),
      routing: {
        kind: 'module',
        view: 'quotes',
        filterKey: 'quotes',
        filterValue: 'accepted_without_job_3d',
      },
    })
  }

  const expensesMissingSupport = expenses.filter(
    (expense) =>
      expense.document_support_status === 'missing' ||
      (!expense.receipt_file_path && expense.document_support_status !== 'invoice_valid'),
  )

  if (expensesMissingSupport.length > 0) {
    alerts.push({
      id: 'expenses-missing-support',
      ruleId: 'expenses_missing_support',
      severity: 'critical',
      title: 'Gastos sin soporte documental',
      summary: `${expensesMissingSupport.length} gasto(s) sin ticket o factura adjunta`,
      detail: 'Registros con soporte documental ausente o insuficiente para revisión interna.',
      count: expensesMissingSupport.length,
      amount: expensesMissingSupport.reduce((sum, expense) => sum + expense.total, 0),
      examples: expensesMissingSupport.slice(0, 3).map((expense) =>
        `${buildExampleLabel(expense.display_code, expense.supplier_name)} · ${expense.supplier_name}`,
      ),
      routing: {
        kind: 'module',
        view: 'expenses',
        filterKey: 'expenses',
        filterValue: 'missing_receipt',
      },
    })
  }

  const expensesPendingReview = expenses.filter((expense) => expense.fiscal_review_status === 'pending')

  if (expensesPendingReview.length > 0) {
    alerts.push({
      id: 'expenses-pending-fiscal-review',
      ruleId: 'expenses_pending_fiscal_review',
      severity: 'warning',
      title: 'Gastos pendientes de revisión fiscal',
      summary: `${expensesPendingReview.length} gasto(s) pendientes de validación`,
      detail: 'Registros de gasto que siguen marcados para revisión fiscal antes de cierre o consolidación.',
      count: expensesPendingReview.length,
      amount: expensesPendingReview.reduce((sum, expense) => sum + expense.total, 0),
      examples: expensesPendingReview.slice(0, 3).map((expense) =>
        `${buildExampleLabel(expense.display_code, expense.supplier_name)} · ${expense.supplier_name}`,
      ),
      routing: {
        kind: 'module',
        view: 'expenses',
        filterKey: 'expenses',
        filterValue: 'pending_review',
      },
    })
  }

  const previousQuarter = getPreviousQuarterReference()
  const closingExists = quarterlyClosings.some(
    (closing) =>
      closing.fiscal_year === previousQuarter.fiscalYear &&
      closing.fiscal_quarter === previousQuarter.fiscalQuarter,
  )
  const reminderDate = getQuarterClosingReminderDate(previousQuarter.fiscalYear, previousQuarter.fiscalQuarter)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (!closingExists && today >= reminderDate) {
    alerts.push({
      id: `quarter-closing-reminder-${previousQuarter.fiscalYear}-Q${previousQuarter.fiscalQuarter}`,
      ruleId: 'quarter_closing_reminder',
      severity: 'info',
      title: 'Recordatorio de cierre trimestral',
      summary: `Cierre pendiente para ${formatQuarterLabel(previousQuarter.fiscalYear, previousQuarter.fiscalQuarter)}`,
      detail: `No hay snapshot guardado del trimestre anterior tras ${automationRuleThresholds.quarterClosingReminderAfterDays} días desde su cierre natural.`,
      count: 1,
      contextLabel: `Periodo pendiente: ${formatQuarterLabel(previousQuarter.fiscalYear, previousQuarter.fiscalQuarter)}.`,
      routing: {
        kind: 'quarterly_closing',
        fiscalYear: previousQuarter.fiscalYear,
        fiscalQuarter: previousQuarter.fiscalQuarter,
      },
    })
  }

  const severityOrder = { critical: 0, warning: 1, info: 2 }

  return alerts.sort((left, right) => {
    const severityComparison = severityOrder[left.severity] - severityOrder[right.severity]
    if (severityComparison !== 0) return severityComparison
    if ((right.amount ?? 0) !== (left.amount ?? 0)) return (right.amount ?? 0) - (left.amount ?? 0)
    return right.count - left.count
  })
}
