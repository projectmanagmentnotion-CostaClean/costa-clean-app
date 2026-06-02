import type { AppView } from '../app/navigation'
import { DashboardAgenda } from '../features/dashboard/DashboardAgenda'
import { DashboardAlerts } from '../features/dashboard/DashboardAlerts'
import type { AutomationAlertItem } from '../features/automation/types'
import { DashboardOverview } from '../features/dashboard/DashboardOverview'
import { DashboardKpis } from '../features/dashboard/DashboardKpis'
import { DashboardQuickActions } from '../features/dashboard/DashboardQuickActions'
import type { DashboardKpiActionId } from '../features/dashboard/kpiActions'
import type { JobListItem } from '../features/jobs/types'

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
  onOpenJobWorkspace: (jobId: string) => void
  onOpenView: (view: AppView) => void
  onRunKpiAction: (actionId: DashboardKpiActionId) => void
  alerts: AutomationAlertItem[]
  onOpenAlert: (alert: AutomationAlertItem) => void
}

export function HomePage({
  metrics,
  agenda,
  onOpenJobWorkspace,
  onOpenView,
  onRunKpiAction,
  alerts,
  onOpenAlert,
}: HomePageProps) {
  const criticalAlertsCount = alerts.filter((alert) => alert.severity === 'critical').length

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

        <div className="cc-dashboard-header__meta">
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
            <span className="cc-dashboard-header__meta-label">Servicios hoy</span>
            <strong className="cc-dashboard-header__meta-value">{metrics.jobsScheduledTodayCount}</strong>
          </div>
          <div className="cc-dashboard-header__meta-card">
            <span className="cc-dashboard-header__meta-label">Alertas criticas</span>
            <strong className="cc-dashboard-header__meta-value">{criticalAlertsCount}</strong>
          </div>
        </div>
      </header>

      <div className="cc-dashboard-stack">
        <DashboardQuickActions onOpenView={onOpenView} />
        <DashboardOverview metrics={metrics} onRunKpiAction={onRunKpiAction} />
        <DashboardAlerts alerts={alerts} onOpenAlert={onOpenAlert} />
        <DashboardAgenda
          agenda={agenda}
          onRunKpiAction={onRunKpiAction}
          onOpenJobWorkspace={onOpenJobWorkspace}
        />
        <DashboardKpis metrics={metrics} onRunKpiAction={onRunKpiAction} />
      </div>
    </section>
  )
}
