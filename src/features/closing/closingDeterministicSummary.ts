import type { ExpenseListItem } from '../expenses/types'
import {
  buildExpenseFiscalSummary,
  hasMediumHighFiscalRisk,
  needsFiscalReview,
} from '../expenses/fiscalIntelligenceSummary'
import { buildFiscalVatSummary } from './fiscalVatSummary'
import {
  isDateWithinFiscalPeriod,
  type ResolvedFiscalPeriod,
} from './fiscalPeriods'
import type { InvoiceListItem } from '../invoices/types'
import type { JobListItem } from '../jobs/types'
import type { PaymentListItem } from '../payments/types'
import type { QuoteListItem } from '../quotes/types'

export type ClosingReadinessStatus =
  | 'ready'
  | 'ready_with_review'
  | 'blocked_missing_documents'
  | 'blocked_insufficient_data'

export type ClosingConfidenceLevel = 'high' | 'medium' | 'low'
export type ClosingWarningSeverity = 'critical' | 'warning' | 'info'
export type ClosingWarningSourceEntity = 'invoices' | 'expenses' | 'quotes' | 'jobs' | 'closing'
export type ClosingMissingDataFlag =
  | 'no_hours_module'
  | 'no_payroll_module'
  | 'missing_expense_support'
  | 'pending_expense_review'
  | 'missing_snapshot'
  | 'insufficient_period_data'
  | 'unverified_vat_deductibility'

export interface ClosingDeterministicWarning {
  id: string
  title: string
  description: string
  severity: ClosingWarningSeverity
  sourceEntity: ClosingWarningSourceEntity
  recommendedAction: string
  targetView?: 'fiscal_closing' | 'invoices' | 'expenses' | 'quotes' | 'jobs'
}

export interface ClosingDeterministicSummary {
  period: {
    mode: ResolvedFiscalPeriod['mode']
    label: string
    startDate: string
    endDate: string
    fiscalYear: number
    fiscalQuarter: number | null
  }
  totalInvoiced: number
  totalCollected: number
  totalOutstanding: number
  totalExpenses: number
  outputVatTotal: number
  supportedVatTotal: number
  estimatedDeductibleBase: number
  estimatedDeductibleVat: number
  estimatedNetVatPayable: number
  pendingInvoicesCount: number
  expensesWithoutSupportCount: number
  expensesPendingReviewCount: number
  expensesMediumHighRiskCount: number
  acceptedQuotesWithoutJobCount: number
  completedJobsWithoutInvoiceCount: number
  openIncidencesCount: number
  readiness: ClosingReadinessStatus
  readinessLabel: string
  confidenceLevel: ClosingConfidenceLevel
  confidenceNotes: string[]
  missingDataFlags: ClosingMissingDataFlag[]
  insufficientDataNotes: string[]
  sourceCounts: {
    invoices: number
    payments: number
    expenses: number
    closureExpenses: number
    quotes: number
    jobs: number
  }
  warnings: ClosingDeterministicWarning[]
}

export interface ClosingDeterministicCollections {
  closureExpenses: ExpenseListItem[]
  pendingInvoices: InvoiceListItem[]
  missingSupportExpenses: ExpenseListItem[]
  pendingReviewExpenses: ExpenseListItem[]
  riskExpenses: ExpenseListItem[]
  acceptedQuotesWithoutJob: QuoteListItem[]
  completedJobsWithoutInvoice: JobListItem[]
}

export interface ClosingDeterministicResult {
  summary: ClosingDeterministicSummary
  collections: ClosingDeterministicCollections
  expenseFiscalSummary: ReturnType<typeof buildExpenseFiscalSummary>
}

interface BuildClosingDeterministicSummaryInput {
  period: ResolvedFiscalPeriod
  invoices: InvoiceListItem[]
  payments: PaymentListItem[]
  expenses: ExpenseListItem[]
  quotes: QuoteListItem[]
  jobs: JobListItem[]
  hasPersistedSnapshot: boolean
}

function getFiscalQuarterFromPeriod(period: ResolvedFiscalPeriod): number | null {
  if (period.mode !== 'quarter') return null
  return Math.floor((Number(period.startDate.slice(5, 7)) - 1) / 3) + 1
}

function isExpenseWithinPeriod(expense: ExpenseListItem, period: ResolvedFiscalPeriod): boolean {
  if (period.mode === 'quarter') {
    const fiscalQuarter = getFiscalQuarterFromPeriod(period)
    if (expense.fiscal_year && expense.fiscal_quarter && fiscalQuarter) {
      return expense.fiscal_year === period.year && expense.fiscal_quarter === fiscalQuarter
    }
  }

  if (period.mode === 'year' && expense.fiscal_year) {
    return expense.fiscal_year === period.year
  }

  return isDateWithinFiscalPeriod(expense.expense_date, period)
}

function getClosurePredicate(period: ResolvedFiscalPeriod) {
  if (period.mode === 'quarter') {
    return (expense: ExpenseListItem) => expense.affects_quarterly_closure
  }

  if (period.mode === 'year') {
    return (expense: ExpenseListItem) => expense.affects_annual_closure
  }

  return (expense: ExpenseListItem) => expense.affects_quarterly_closure || expense.affects_annual_closure
}

function buildReadinessLabel(readiness: ClosingReadinessStatus): string {
  if (readiness === 'ready') return 'Listo'
  if (readiness === 'ready_with_review') return 'Listo con revision'
  if (readiness === 'blocked_missing_documents') return 'Bloqueado por documentacion'
  return 'Bloqueado por datos insuficientes'
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2))
}

export function buildClosingDeterministicSummary({
  period,
  invoices,
  payments,
  expenses,
  quotes,
  jobs,
  hasPersistedSnapshot,
}: BuildClosingDeterministicSummaryInput): ClosingDeterministicResult {
  const periodInvoices = invoices.filter((invoice) => isDateWithinFiscalPeriod(invoice.issue_date, period))
  const periodPayments = payments.filter((payment) => isDateWithinFiscalPeriod(payment.payment_date, period))
  const periodExpenses = expenses.filter((expense) => isExpenseWithinPeriod(expense, period))
  const periodQuotes = quotes.filter((quote) => isDateWithinFiscalPeriod(quote.created_at ?? null, period))
  const periodJobs = jobs.filter((job) => isDateWithinFiscalPeriod(job.scheduled_date, period))
  const closureExpenses = periodExpenses.filter(getClosurePredicate(period))
  const missingSupportExpenses = closureExpenses.filter(
    (expense) =>
      expense.document_support_status === 'missing'
      || (!expense.receipt_file_path && expense.document_support_status !== 'invoice_valid'),
  )
  const pendingReviewExpenses = closureExpenses.filter((expense) => needsFiscalReview(expense))
  const riskExpenses = closureExpenses.filter((expense) => hasMediumHighFiscalRisk(expense))
  const acceptedQuotesWithoutJob = periodQuotes.filter(
    (quote) => quote.status === 'accepted' && !quote.job_id && !quote.invoice_id,
  )
  const invoicedJobIds = new Set(periodInvoices.map((invoice) => invoice.job_id).filter(Boolean))
  const completedJobsWithoutInvoice = periodJobs.filter(
    (job) => job.status === 'completed' && !job.invoice_id && !invoicedJobIds.has(job.id),
  )

  const invoicePaidById = new Map<string, number>()
  for (const payment of payments) {
    invoicePaidById.set(payment.invoice_id, (invoicePaidById.get(payment.invoice_id) ?? 0) + Number(payment.amount || 0))
  }

  const pendingInvoices = periodInvoices.filter((invoice) => {
    const paidAmount = invoice.paid_amount ?? invoicePaidById.get(invoice.id) ?? 0
    return Math.max(Number(invoice.total || 0) - paidAmount, 0) > 0.009
  })

  const vatSummary = buildFiscalVatSummary(periodInvoices, closureExpenses)
  const expenseFiscalSummary = buildExpenseFiscalSummary(closureExpenses)

  const insufficientDataNotes: string[] = []
  if (periodInvoices.length === 0 && periodPayments.length === 0 && periodExpenses.length === 0) {
    insufficientDataNotes.push('El periodo no contiene facturas, cobros ni gastos suficientes para una lectura fiscal solida.')
  }

  const missingDataFlags: ClosingMissingDataFlag[] = [
    'no_hours_module',
    'no_payroll_module',
  ]

  if (missingSupportExpenses.length > 0) missingDataFlags.push('missing_expense_support')
  if (pendingReviewExpenses.length > 0 || riskExpenses.length > 0) missingDataFlags.push('pending_expense_review')
  if (!hasPersistedSnapshot && (period.mode === 'quarter' || period.mode === 'year')) missingDataFlags.push('missing_snapshot')
  if (insufficientDataNotes.length > 0) missingDataFlags.push('insufficient_period_data')
  if (expenseFiscalSummary.missingValidVatInvoiceCount > 0 || pendingReviewExpenses.length > 0 || riskExpenses.length > 0) {
    missingDataFlags.push('unverified_vat_deductibility')
  }

  const readiness: ClosingReadinessStatus = insufficientDataNotes.length > 0
    ? 'blocked_insufficient_data'
    : missingSupportExpenses.length > 0 || expenseFiscalSummary.missingValidVatInvoiceCount > 0
      ? 'blocked_missing_documents'
      : pendingReviewExpenses.length > 0
          || riskExpenses.length > 0
          || pendingInvoices.length > 0
          || acceptedQuotesWithoutJob.length > 0
          || completedJobsWithoutInvoice.length > 0
        ? 'ready_with_review'
        : 'ready'

  const confidenceNotes: string[] = [
    'Las cifras se calculan solo con facturas, cobros, gastos y soporte documental existentes en la app.',
    'No se incorporan horas ni payroll porque este repo no tiene un modulo operativo real para esos datos.',
  ]

  let confidenceLevel: ClosingConfidenceLevel = 'high'

  if (readiness === 'blocked_insufficient_data' || missingSupportExpenses.length > 0 || expenseFiscalSummary.missingValidVatInvoiceCount > 0 || !hasPersistedSnapshot) {
    confidenceLevel = insufficientDataNotes.length > 0 || missingSupportExpenses.length > 0 ? 'low' : 'medium'
  }

  if (pendingReviewExpenses.length > 0 || riskExpenses.length > 0 || pendingInvoices.length > 0) {
    confidenceLevel = confidenceLevel === 'low' ? 'low' : 'medium'
  }

  if (confidenceLevel === 'high') {
    confidenceNotes.push('El periodo tiene datos suficientes y no presenta incidencias abiertas relevantes.')
  } else if (confidenceLevel === 'medium') {
    confidenceNotes.push('La base es utilizable, pero requiere revision antes de tratarla como cierre limpio.')
  } else {
    confidenceNotes.push('Faltan soportes o datos clave, por lo que la lectura debe tomarse como preparacion interna.')
  }

  const warnings: ClosingDeterministicWarning[] = []

  if (missingSupportExpenses.length > 0) {
    warnings.push({
      id: 'missing-expense-support',
      title: 'Gastos sin soporte documental',
      description: `${missingSupportExpenses.length} gasto(s) del periodo siguen sin soporte descargable o sin documento valido.`,
      severity: 'critical',
      sourceEntity: 'expenses',
      recommendedAction: 'Completar o validar soportes antes de cerrar o exportar el periodo.',
      targetView: 'expenses',
    })
  }

  if (expenseFiscalSummary.missingValidVatInvoiceCount > 0) {
    warnings.push({
      id: 'missing-valid-vat-invoice',
      title: 'IVA con cobertura documental incompleta',
      description: `${expenseFiscalSummary.missingValidVatInvoiceCount} gasto(s) no tienen factura valida para sostener la deducibilidad del IVA.`,
      severity: 'critical',
      sourceEntity: 'expenses',
      recommendedAction: 'Revisar la factura valida de IVA antes de consolidar el calculo del periodo.',
      targetView: 'expenses',
    })
  }

  if (pendingReviewExpenses.length > 0) {
    warnings.push({
      id: 'pending-expense-review',
      title: 'Gastos pendientes de revision fiscal',
      description: `${pendingReviewExpenses.length} gasto(s) requieren validacion fiscal antes del cierre final.`,
      severity: 'warning',
      sourceEntity: 'expenses',
      recommendedAction: 'Revisar gastos marcados como pendientes y resolver su estado fiscal.',
      targetView: 'expenses',
    })
  }

  if (riskExpenses.length > 0) {
    warnings.push({
      id: 'expense-risk',
      title: 'Gastos con riesgo medio o alto',
      description: `${riskExpenses.length} gasto(s) presentan riesgo fiscal medio o alto en el periodo.`,
      severity: 'warning',
      sourceEntity: 'expenses',
      recommendedAction: 'Priorizar estos gastos antes de compartir el paquete o guardar el snapshot.',
      targetView: 'expenses',
    })
  }

  if (pendingInvoices.length > 0) {
    warnings.push({
      id: 'pending-invoices',
      title: 'Facturas emitidas con saldo pendiente',
      description: `${pendingInvoices.length} factura(s) del periodo siguen abiertas a dia de hoy.`,
      severity: 'warning',
      sourceEntity: 'invoices',
      recommendedAction: 'Revisar cobros pendientes y documentar el seguimiento.',
      targetView: 'invoices',
    })
  }

  if (acceptedQuotesWithoutJob.length > 0) {
    warnings.push({
      id: 'accepted-quotes-without-job',
      title: 'Presupuestos aceptados sin convertir',
      description: `${acceptedQuotesWithoutJob.length} presupuesto(s) aceptados siguen sin convertirse en servicio o factura.`,
      severity: 'info',
      sourceEntity: 'quotes',
      recommendedAction: 'Validar si deben convertirse en servicio o dejar constancia del motivo.',
      targetView: 'quotes',
    })
  }

  if (completedJobsWithoutInvoice.length > 0) {
    warnings.push({
      id: 'completed-jobs-without-invoice',
      title: 'Servicios completados sin factura',
      description: `${completedJobsWithoutInvoice.length} servicio(s) completados dentro del periodo siguen sin facturar.`,
      severity: 'warning',
      sourceEntity: 'jobs',
      recommendedAction: 'Cerrar el paso de servicio a factura para no dejar ingreso bloqueado.',
      targetView: 'jobs',
    })
  }

  if (!hasPersistedSnapshot && (period.mode === 'quarter' || period.mode === 'year')) {
    warnings.push({
      id: 'missing-snapshot',
      title: 'Snapshot de cierre no guardado',
      description: 'El periodo tiene resumen operativo, pero aun no dispone de snapshot persistido.',
      severity: 'info',
      sourceEntity: 'closing',
      recommendedAction: 'Guardar snapshot cuando la revision del periodo sea suficiente.',
      targetView: 'fiscal_closing',
    })
  }

  if (insufficientDataNotes.length > 0) {
    warnings.push({
      id: 'insufficient-period-data',
      title: 'Datos insuficientes para el periodo',
      description: insufficientDataNotes.join(' '),
      severity: 'critical',
      sourceEntity: 'closing',
      recommendedAction: 'Completar registros del periodo antes de tratar este cierre como fiable.',
      targetView: 'fiscal_closing',
    })
  }

  return {
    summary: {
      period: {
        mode: period.mode,
        label: period.label,
        startDate: period.startDate,
        endDate: period.endDate,
        fiscalYear: period.year,
        fiscalQuarter: getFiscalQuarterFromPeriod(period),
      },
      totalInvoiced: roundMoney(periodInvoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0)),
      totalCollected: roundMoney(periodPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)),
      totalOutstanding: roundMoney(pendingInvoices.reduce((sum, invoice) => {
        const paidAmount = invoice.paid_amount ?? invoicePaidById.get(invoice.id) ?? 0
        return sum + Math.max(Number(invoice.total || 0) - paidAmount, 0)
      }, 0)),
      totalExpenses: roundMoney(periodExpenses.reduce((sum, expense) => sum + Number(expense.total || 0), 0)),
      outputVatTotal: vatSummary.outputVatTotal,
      supportedVatTotal: vatSummary.supportedVatTotal,
      estimatedDeductibleBase: vatSummary.estimatedDeductibleBase,
      estimatedDeductibleVat: vatSummary.estimatedDeductibleVat,
      estimatedNetVatPayable: vatSummary.estimatedNetVatPayable,
      pendingInvoicesCount: pendingInvoices.length,
      expensesWithoutSupportCount: missingSupportExpenses.length,
      expensesPendingReviewCount: pendingReviewExpenses.length,
      expensesMediumHighRiskCount: riskExpenses.length,
      acceptedQuotesWithoutJobCount: acceptedQuotesWithoutJob.length,
      completedJobsWithoutInvoiceCount: completedJobsWithoutInvoice.length,
      openIncidencesCount: warnings.filter((warning) => warning.severity !== 'info').length
        + pendingInvoices.length
        + missingSupportExpenses.length
        + pendingReviewExpenses.length
        + riskExpenses.length,
      readiness,
      readinessLabel: buildReadinessLabel(readiness),
      confidenceLevel,
      confidenceNotes,
      missingDataFlags,
      insufficientDataNotes,
      sourceCounts: {
        invoices: periodInvoices.length,
        payments: periodPayments.length,
        expenses: periodExpenses.length,
        closureExpenses: closureExpenses.length,
        quotes: periodQuotes.length,
        jobs: periodJobs.length,
      },
      warnings,
    },
    collections: {
      closureExpenses,
      pendingInvoices,
      missingSupportExpenses,
      pendingReviewExpenses,
      riskExpenses,
      acceptedQuotesWithoutJob,
      completedJobsWithoutInvoice,
    },
    expenseFiscalSummary,
  }
}
