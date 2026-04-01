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
      <div className="cc-home-hero">
        <div className="cc-home-hero__bg" aria-hidden="true" />
        <div className="cc-home-hero__glow cc-home-hero__glow--one" aria-hidden="true" />
        <div className="cc-home-hero__glow cc-home-hero__glow--two" aria-hidden="true" />

        <div className="cc-page-topline cc-page-topline--hero">
          <span className="cc-page-topline__eyebrow">CostaClean CRM</span>

          <div className="cc-home-hero__brand">
            <img
              src="/branding/Costa_Clean-LOGO-HORIZONTAL.png"
              alt="CostaClean"
              className="cc-home-hero__logo"
            />
          </div>

          <h1 className="cc-page-topline__title">
            Control total del negocio, con imagen de marca real
          </h1>

          <p className="cc-page-topline__text">
            Supervisa actividad comercial, operativa y financiera desde una interfaz
            clara, premium y preparada para uso diario.
          </p>

          <div className="cc-home-hero__chips" aria-label="Resumen rápido">
            <span className="cc-home-hero__chip">
              Clientes: <strong>{metrics.clientsCount}</strong>
            </span>
            <span className="cc-home-hero__chip">
              Servicios: <strong>{metrics.jobsCount}</strong>
            </span>
            <span className="cc-home-hero__chip">
              Facturas: <strong>{metrics.invoicesCount}</strong>
            </span>
          </div>
        </div>
      </div>

      <DashboardQuickActions onOpenView={onOpenView} />
      <DashboardOverview metrics={metrics} />
      <DashboardKpis metrics={metrics} />
    </section>
  )
}
