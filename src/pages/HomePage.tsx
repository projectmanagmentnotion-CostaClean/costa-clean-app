import type { AppView } from '../app/navigation'
import { DashboardAgenda } from '../features/dashboard/DashboardAgenda'
import { DashboardAlerts } from '../features/dashboard/DashboardAlerts'
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
    totalInvoiced: number
    totalCollected: number
    totalExpenses: number
    expensesThisMonthTotal: number
    expensesThisQuarterTotal: number
    expensesWithReceiptCount: number
    expensesWithoutReceiptCount: number
    deductibleExpensesCount: number
  }
  agenda: {
    todayJobs: JobListItem[]
    tomorrowJobs: JobListItem[]
    upcomingJobs: JobListItem[]
  }
  onOpenView: (view: AppView) => void
  onRunKpiAction: (actionId: DashboardKpiActionId) => void
}

export function HomePage({ metrics, agenda, onOpenView, onRunKpiAction }: HomePageProps) {
  return (
    <section className="cc-dashboard-page">
      <div className="cc-page-topline">
        <span className="cc-page-topline__eyebrow">CostaClean CRM</span>
        <h1 className="cc-page-topline__title">Panel de control</h1>
        <p className="cc-page-topline__text">
          Operación, ventas y finanzas en una sola vista.
        </p>
      </div>

      <DashboardQuickActions onOpenView={onOpenView} />
      <DashboardAlerts metrics={metrics} onRunKpiAction={onRunKpiAction} />
      <DashboardAgenda agenda={agenda} onRunKpiAction={onRunKpiAction} />
      <DashboardOverview metrics={metrics} onRunKpiAction={onRunKpiAction} />
      <DashboardKpis metrics={metrics} onRunKpiAction={onRunKpiAction} />
    </section>
  )
}
