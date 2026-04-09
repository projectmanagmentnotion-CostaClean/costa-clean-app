import type { DashboardKpiActionId } from './kpiActions'

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
    invoicedThisMonthTotal: number
    collectedThisMonthTotal: number
    outstandingReceivablesTotal: number
    completedJobsWithoutInvoiceCount: number
    acceptedQuotesWithoutJobCount: number
    totalInvoiced: number
    totalCollected: number
    totalExpenses: number
    expensesThisMonthTotal: number
    expensesThisQuarterTotal: number
    expensesWithReceiptCount: number
    expensesWithoutReceiptCount: number
    deductibleExpensesCount: number
  }
  onRunKpiAction: (actionId: DashboardKpiActionId) => void
}

export function DashboardOverview({ metrics, onRunKpiAction }: DashboardOverviewProps) {
  const estimatedBalance = metrics.outstandingReceivablesTotal
  const estimatedNet = metrics.totalCollected - metrics.totalExpenses
  const overviewCards: Array<{
    label: string
    value: string
    actionId?: DashboardKpiActionId
  }> = [
    {
      label: 'Clientes activos',
      value: String(metrics.clientsCount),
    },
    {
      label: 'Presupuestos abiertos',
      value: String(metrics.openQuotesCount),
      actionId: 'open_quotes',
    },
    {
      label: 'Servicios en curso',
      value: String(metrics.scheduledJobsCount),
      actionId: 'scheduled_jobs',
    },
    {
      label: 'Pendiente de cobro',
      value: formatCurrency(estimatedBalance),
      actionId: 'outstanding_invoices',
    },
  ]

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
                <span>Facturado del mes</span>
                <strong>{formatCurrency(metrics.invoicedThisMonthTotal)}</strong>
              </div>
              <div className="cc-dashboard-spotlight__row">
                <span>Cobrado del mes</span>
                <strong>{formatCurrency(metrics.collectedThisMonthTotal)}</strong>
              </div>
              <div className="cc-dashboard-spotlight__row">
                <span>Pendiente de cobro</span>
                <strong>{formatCurrency(estimatedBalance)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="cc-dashboard-overview__grid">
        {overviewCards.map((card) => (
          card.actionId ? (
            <button
              key={card.label}
              type="button"
              className="cc-dashboard-panel cc-dashboard-panel--actionable"
              onClick={() => onRunKpiAction(card.actionId!)}
            >
              <span className="cc-dashboard-panel__label">{card.label}</span>
              <strong className="cc-dashboard-panel__value">{card.value}</strong>
              <span className="cc-dashboard-panel__hint">Abrir lista</span>
            </button>
          ) : (
            <article key={card.label} className="cc-dashboard-panel">
              <span className="cc-dashboard-panel__label">{card.label}</span>
              <strong className="cc-dashboard-panel__value">{card.value}</strong>
            </article>
          )
        ))}
      </div>
    </section>
  )
}
