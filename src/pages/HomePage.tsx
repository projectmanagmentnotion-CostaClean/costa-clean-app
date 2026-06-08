import type { AppView } from '../app/navigation'
import { DashboardAgenda } from '../features/dashboard/DashboardAgenda'
import { DashboardAlerts } from '../features/dashboard/DashboardAlerts'
import type { AutomationAlertItem } from '../features/automation/types'
import { DashboardIncidents } from '../features/dashboard/DashboardIncidents'
import { DashboardOperationalFocus } from '../features/dashboard/DashboardOperationalFocus'
import { DashboardOverview } from '../features/dashboard/DashboardOverview'
import { DashboardKpis } from '../features/dashboard/DashboardKpis'
import { DashboardQuickActions } from '../features/dashboard/DashboardQuickActions'
import { DashboardQuickViews } from '../features/dashboard/DashboardQuickViews'
import type { DashboardKpiActionId } from '../features/dashboard/kpiActions'
import type { OperationalAction, OperationalIncident, OperationalQuickView } from '../features/dashboard/operationalControl'
import type { ClientWorkspaceTab } from '../features/clients/useClientWorkspaceNavigation'
import type { JobListItem } from '../features/jobs/types'
import type { RecurringInvoicePlanListItem } from '../features/recurringInvoices/types'

interface HomePageProps {
  metrics: {
    leadsCount: number
    clientsCount: number
    propertiesCount: number
    quotesCount: number
    jobsCount: number
    invoicesCount: number
    paymentsCount: number
    expensesCount: number
    openQuotesCount: number
    scheduledJobsCount: number
    pendingInvoicesCount: number
    partiallyPaidInvoicesCount: number
    invoicedThisMonthTotal: number
    collectedThisMonthTotal: number
    outstandingReceivablesTotal: number
    completedJobsWithoutInvoiceCount: number
    acceptedQuotesWithoutJobCount: number
    unpaidInvoicesOlderThan7DaysCount: number
    sentQuotesOlderThan5DaysCount: number
    completedJobsWithoutInvoiceOlderThan2DaysCount: number
    jobsScheduledTodayCount: number
    jobsScheduledTomorrowCount: number
    dueRecurringPlansCount: number
    pausedRecurringPlansCount: number
    clientsWithPendingBalanceCount: number
    clientsMissingFiscalDataCount: number
    propertyAnomalyCount: number
    totalInvoiced: number
    totalCollected: number
    totalExpenses: number
    expensesThisMonthTotal: number
    expensesThisQuarterTotal: number
    expensesWithReceiptCount: number
    expensesWithoutReceiptCount: number
    deductibleExpensesCount: number
    estimatedDeductibleVat: number
    estimatedDeductibleBase: number
    fiscalReviewExpensesCount: number
    fiscalRiskExpensesCount: number
    expensesMissingValidVatInvoiceCount: number
    expensesZeroEstimatedVatCount: number
  }
  agenda: {
    todayJobs: JobListItem[]
    tomorrowJobs: JobListItem[]
    upcomingJobs: JobListItem[]
  }
  clientBalanceLeaders: Array<{
    clientId: string
    clientLabel: string
    pendingAmount: number
    pendingInvoices: number
  }>
  dueRecurringPlans: RecurringInvoicePlanListItem[]
  onOpenJobWorkspace: (jobId: string) => void
  onOpenClientWorkspace: (clientId: string, tab?: ClientWorkspaceTab) => void
  onOpenView: (view: AppView) => void
  onRunKpiAction: (actionId: DashboardKpiActionId) => void
  alerts: AutomationAlertItem[]
  onOpenAlert: (alert: AutomationAlertItem) => void
  operationalIncidents: OperationalIncident[]
  operationalQuickViews: OperationalQuickView[]
  onRunOperationalAction: (action: OperationalAction) => void
}

export function HomePage({
  metrics,
  agenda,
  clientBalanceLeaders,
  dueRecurringPlans,
  onOpenJobWorkspace,
  onOpenClientWorkspace,
  onOpenView,
  onRunKpiAction,
  alerts,
  onOpenAlert,
  operationalIncidents,
  operationalQuickViews,
  onRunOperationalAction,
}: HomePageProps) {
  const criticalAlertsCount = alerts.filter((alert) => alert.severity === 'critical').length
  const urgentCollectionsCount = metrics.unpaidInvoicesOlderThan7DaysCount + metrics.partiallyPaidInvoicesCount
  const topIncident = operationalIncidents[0] ?? null
  const homePrimaryAction = topIncident
    ? {
        label: topIncident.primaryAction.label,
        summary: topIncident.summary,
        detail: topIncident.detail,
        onRun: () => onRunOperationalAction(topIncident.primaryAction),
      }
    : metrics.completedJobsWithoutInvoiceCount > 0
      ? {
          label: 'Facturar servicios pendientes',
          summary: `${metrics.completedJobsWithoutInvoiceCount} servicio(s) completados sin factura`,
          detail: 'Conviene cerrar hoy el paso de servicio a factura.',
          onRun: () => onRunKpiAction('completed_jobs_without_invoice'),
        }
      : urgentCollectionsCount > 0
        ? {
            label: 'Revisar cobros pendientes',
            summary: `${urgentCollectionsCount} factura(s) requieren seguimiento`,
            detail: 'Prioriza las facturas abiertas y parciales antes de abrir otras vistas.',
            onRun: () => onRunKpiAction('outstanding_invoices'),
          }
        : {
            label: 'Atender agenda de hoy',
            summary: `${metrics.jobsScheduledTodayCount} servicio(s) previstos hoy`,
            detail: 'La operativa diaria esta estable; revisa primero la agenda de hoy.',
            onRun: () => onRunKpiAction('jobs_today'),
          }

  return (
    <section className="cc-dashboard-page">
      <header className="cc-dashboard-header">
        <div className="cc-dashboard-header__copy">
          <span className="cc-page-topline__eyebrow">CostaClean CRM</span>
          <h1 className="cc-page-topline__title">Centro de control</h1>
          <p className="cc-page-topline__text">
            Prioridades, cobro, servicio y seguimiento comercial en una lectura mas limpia y ejecutiva.
          </p>
        </div>

        <div className="cc-dashboard-header__meta" aria-label="Resumen rapido">
          <div className="cc-dashboard-header__meta-card">
            <span className="cc-dashboard-header__meta-label">Cobrado del mes</span>
            <strong className="cc-dashboard-header__meta-value">
              {new Intl.NumberFormat('es-ES', {
                style: 'currency',
                currency: 'EUR',
                maximumFractionDigits: 0,
              }).format(metrics.collectedThisMonthTotal)}
            </strong>
          </div>
          <div className="cc-dashboard-header__meta-card">
            <span className="cc-dashboard-header__meta-label">Por facturar</span>
            <strong className="cc-dashboard-header__meta-value">{metrics.completedJobsWithoutInvoiceCount}</strong>
          </div>
          <div className="cc-dashboard-header__meta-card">
            <span className="cc-dashboard-header__meta-label">Cobros urgentes</span>
            <strong className="cc-dashboard-header__meta-value">{urgentCollectionsCount}</strong>
          </div>
        </div>
      </header>

      <div className="cc-dashboard-stack">
        <section className="cc-dashboard-block cc-dashboard-block--incidents">
          <div className="cc-dashboard-block__header cc-dashboard-block__header--split">
            <div>
              <h2>Que hago ahora</h2>
              <p>Una sola accion principal para arrancar la operativa del dia.</p>
            </div>
            <span className="lead-badge">{criticalAlertsCount > 0 ? `${criticalAlertsCount} criticas` : 'Hoy'}</span>
          </div>

          <article className="cc-dashboard-incident cc-dashboard-incident--warning">
            <div className="cc-dashboard-incident__top">
              <div>
                <span className="cc-dashboard-incident__severity">Prioridad</span>
                <h3>{homePrimaryAction.label}</h3>
              </div>
            </div>

            <strong className="cc-dashboard-incident__summary">{homePrimaryAction.summary}</strong>
            <p className="cc-dashboard-incident__detail">{homePrimaryAction.detail}</p>

            <div className="cc-dashboard-incident__actions">
              <button
                type="button"
                className="primary-button cc-dashboard-incident__action"
                onClick={homePrimaryAction.onRun}
              >
                {homePrimaryAction.label}
              </button>
            </div>
          </article>
        </section>

        <DashboardIncidents incidents={operationalIncidents} onRunAction={onRunOperationalAction} />
        <DashboardAgenda
          agenda={agenda}
          onRunKpiAction={onRunKpiAction}
          onOpenJobWorkspace={onOpenJobWorkspace}
        />
        <DashboardOverview metrics={metrics} onRunKpiAction={onRunKpiAction} />
        <DashboardQuickViews views={operationalQuickViews} onRunAction={onRunOperationalAction} />
        <DashboardOperationalFocus
          clientBalanceLeaders={clientBalanceLeaders}
          dueRecurringPlans={dueRecurringPlans}
          onOpenClientWorkspace={onOpenClientWorkspace}
        />
        <DashboardAlerts alerts={alerts} onOpenAlert={onOpenAlert} />
        <DashboardQuickActions onOpenView={onOpenView} />
        <DashboardKpis metrics={metrics} onRunKpiAction={onRunKpiAction} />
      </div>
    </section>
  )
}
