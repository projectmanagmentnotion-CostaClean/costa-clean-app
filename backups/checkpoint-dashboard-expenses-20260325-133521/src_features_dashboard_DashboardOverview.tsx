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
          <span className="cc-dashboard-overview__eyebrow">Resumen ejecutivo</span>
          <h2 className="cc-dashboard-overview__title">
            Un panel claro para gestionar CostaClean con criterio
          </h2>
          <p className="cc-dashboard-overview__text">
            Consulta ventas, cobros, gastos y documentación pendiente desde una
            vista preparada para operación diaria y seguimiento financiero real.
          </p>
        </div>

        <div className="cc-dashboard-overview__spotlight">
          <span className="cc-dashboard-chip">Vista financiera</span>
          <div className="cc-dashboard-panel cc-dashboard-panel--spotlight">
            <span className="cc-dashboard-panel__label">Resultado estimado</span>
            <strong className="cc-dashboard-panel__value">
              {formatCurrency(estimatedNet)}
            </strong>
            <p className="cc-dashboard-panel__text">
              Cobrado: {formatCurrency(metrics.totalCollected)} · Gastos: {formatCurrency(metrics.totalExpenses)}
            </p>
          </div>
        </div>
      </div>

      <div className="cc-dashboard-overview__grid">
        <article className="cc-dashboard-panel">
          <span className="cc-dashboard-panel__label">Clientes activos</span>
          <strong className="cc-dashboard-panel__value">{metrics.clientsCount}</strong>
          <p className="cc-dashboard-panel__text">
            Base actual de clientes convertidos y operativos.
          </p>
        </article>

        <article className="cc-dashboard-panel">
          <span className="cc-dashboard-panel__label">Presupuestos abiertos</span>
          <strong className="cc-dashboard-panel__value">{metrics.openQuotesCount}</strong>
          <p className="cc-dashboard-panel__text">
            Propuestas pendientes de decisión o seguimiento.
          </p>
        </article>

        <article className="cc-dashboard-panel">
          <span className="cc-dashboard-panel__label">Servicios en curso</span>
          <strong className="cc-dashboard-panel__value">{metrics.scheduledJobsCount}</strong>
          <p className="cc-dashboard-panel__text">
            Servicios programados o actualmente en ejecución.
          </p>
        </article>

        <article className="cc-dashboard-panel">
          <span className="cc-dashboard-panel__label">Pendiente por cobrar</span>
          <strong className="cc-dashboard-panel__value">{formatCurrency(estimatedBalance)}</strong>
          <p className="cc-dashboard-panel__text">
            Diferencia entre facturación emitida y cobros registrados.
          </p>
        </article>
      </div>
    </section>
  )
}
