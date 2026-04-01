function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

interface DashboardOverviewProps {
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
}

export function DashboardOverview({ metrics }: DashboardOverviewProps) {
  const estimatedBalance = metrics.totalInvoiced - metrics.totalCollected
  const estimatedNet = metrics.totalCollected - metrics.totalExpenses

  return (
    <section className="cc-dashboard-overview">
      <div className="cc-dashboard-overview__hero">
        <div className="cc-dashboard-overview__copy">
          <span className="cc-dashboard-overview__eyebrow">Resumen</span>
          <h2 className="cc-dashboard-overview__title">
            Visión clara del negocio
          </h2>
          <p className="cc-dashboard-overview__text">
            Estado operativo y financiero en tiempo real.
          </p>
        </div>

        <div className="cc-dashboard-overview__spotlight">
          <span className="cc-dashboard-chip">Vista financiera</span>

          <div className="cc-dashboard-panel cc-dashboard-panel--spotlight">
            <div className="cc-dashboard-panel__meta">
              <span className="cc-dashboard-panel__label">Resultado estimado</span>
              <strong className="cc-dashboard-panel__value">
                {formatCurrency(estimatedNet)}
              </strong>
            </div>

            <div className="cc-dashboard-spotlight__rows">
              <div className="cc-dashboard-spotlight__row">
                <span>Cobrado</span>
                <strong>{formatCurrency(metrics.totalCollected)}</strong>
              </div>
              <div className="cc-dashboard-spotlight__row">
                <span>Gastos</span>
                <strong>{formatCurrency(metrics.totalExpenses)}</strong>
              </div>
              <div className="cc-dashboard-spotlight__row">
                <span>Por cobrar</span>
                <strong>{formatCurrency(estimatedBalance)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="cc-dashboard-overview__grid">
        <article className="cc-dashboard-panel">
          <span className="cc-dashboard-panel__label">Clientes activos</span>
          <strong className="cc-dashboard-panel__value">{metrics.clientsCount}</strong>

        </article>

        <article className="cc-dashboard-panel">
          <span className="cc-dashboard-panel__label">Presupuestos abiertos</span>
          <strong className="cc-dashboard-panel__value">{metrics.openQuotesCount}</strong>

        </article>

        <article className="cc-dashboard-panel">
          <span className="cc-dashboard-panel__label">Servicios en curso</span>
          <strong className="cc-dashboard-panel__value">{metrics.scheduledJobsCount}</strong>

        </article>

        <article className="cc-dashboard-panel">
          <span className="cc-dashboard-panel__label">Pendiente por cobrar</span>
          <strong className="cc-dashboard-panel__value">{formatCurrency(estimatedBalance)}</strong>

        </article>
      </div>
    </section>
  )
}


