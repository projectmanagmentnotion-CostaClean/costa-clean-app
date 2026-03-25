import type { AppView } from '../app/navigation'
import { DashboardOverview } from '../features/dashboard/DashboardOverview'
import { DashboardKpis } from '../features/dashboard/DashboardKpis'
import { DashboardQuickActions } from '../features/dashboard/DashboardQuickActions'

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
    totalInvoiced: number
    totalCollected: number
    totalExpenses: number
    expensesThisMonthTotal: number
    expensesThisQuarterTotal: number
    expensesWithReceiptCount: number
    expensesWithoutReceiptCount: number
    deductibleExpensesCount: number
  }
  onOpenView: (view: AppView) => void
}

export function HomePage({ metrics, onOpenView }: HomePageProps) {
  return (
    <section className="cc-dashboard-page">
      <div className="cc-page-topline">
        <span className="cc-page-topline__eyebrow">CostaClean CRM</span>
        <h1 className="cc-page-topline__title">Control total del negocio</h1>
        <p className="cc-page-topline__text">
          Supervisa actividad comercial, operativa y financiera desde una interfaz
          clara, premium y preparada para uso diario.
        </p>
      </div>

      <DashboardOverview metrics={metrics} />
      <DashboardKpis metrics={metrics} />
      <DashboardQuickActions onOpenView={onOpenView} />
    </section>
  )
}
