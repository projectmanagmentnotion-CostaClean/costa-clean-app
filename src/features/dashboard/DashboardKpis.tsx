import type { DashboardKpiActionId } from './kpiActions'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

interface DashboardKpisProps {
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

export function DashboardKpis({ metrics, onRunKpiAction }: DashboardKpisProps) {
  const globalCards: Array<{
    label: string
    value: string
    accent: string
    actionId?: DashboardKpiActionId
  }> = [
    {
      label: 'Leads',
      value: String(metrics.leadsCount),
      accent: 'default',
    },
    {
      label: 'Clientes',
      value: String(metrics.clientsCount),
      accent: 'default',
    },
    {
      label: 'Inmuebles',
      value: String(metrics.propertiesCount),
      accent: 'default',
    },
    {
      label: 'Presupuestos',
      value: String(metrics.quotesCount),
      accent: 'default',
    },
    {
      label: 'Servicios',
      value: String(metrics.jobsCount),
      accent: 'default',
    },
    {
      label: 'Facturas',
      value: String(metrics.invoicesCount),
      accent: 'default',
    },
    {
      label: 'Cobros',
      value: String(metrics.paymentsCount),
      accent: 'default',
    },
    {
      label: 'Facturas pendientes',
      value: String(metrics.pendingInvoicesCount),
      accent: 'warning',
      actionId: 'pending_invoices',
    },
  ]

  const financialCards: Array<{
    label: string
    value: string
    accent: string
    actionId?: DashboardKpiActionId
  }> = [
    {
      label: 'Facturado del mes',
      value: formatCurrency(metrics.invoicedThisMonthTotal),
      accent: 'finance',
      actionId: 'invoiced_this_month',
    },
    {
      label: 'Cobrado del mes',
      value: formatCurrency(metrics.collectedThisMonthTotal),
      accent: 'success',
      actionId: 'collected_this_month',
    },
    {
      label: 'Pendiente de cobro',
      value: formatCurrency(metrics.outstandingReceivablesTotal),
      accent: 'warning',
      actionId: 'outstanding_invoices',
    },
    {
      label: 'Trabajos completados sin factura',
      value: String(metrics.completedJobsWithoutInvoiceCount),
      accent: 'warning',
      actionId: 'completed_jobs_without_invoice',
    },
    {
      label: 'Presupuestos aceptados sin trabajo',
      value: String(metrics.acceptedQuotesWithoutJobCount),
      accent: 'warning',
      actionId: 'accepted_quotes_without_job',
    },
    {
      label: 'Gastos del mes',
      value: formatCurrency(metrics.expensesThisMonthTotal),
      accent: 'finance',
      actionId: 'expenses_this_month',
    },
    {
      label: 'Gastos totales',
      value: formatCurrency(metrics.totalExpenses),
      accent: 'finance',
    },
    {
      label: 'Gastos del trimestre',
      value: formatCurrency(metrics.expensesThisQuarterTotal),
      accent: 'finance',
    },
    {
      label: 'Gastos registrados',
      value: String(metrics.expensesCount),
      accent: 'finance',
    },
    {
      label: 'Con documento',
      value: String(metrics.expensesWithReceiptCount),
      accent: 'success',
    },
    {
      label: 'Sin documento',
      value: String(metrics.expensesWithoutReceiptCount),
      accent: 'warning',
      actionId: 'expenses_without_receipt',
    },
    {
      label: 'Deducibles marcados',
      value: String(metrics.deductibleExpensesCount),
      accent: 'finance',
    },
    { label: 'Cobrado', value: formatCurrency(metrics.totalCollected), accent: 'default' },
  ]

  return (
    <>
      <section className="cc-dashboard-block">
        <div className="cc-dashboard-block__header">
          <div>
            <h2>KPIs globales</h2>
            <p>Visión operativa general del negocio y del estado del CRM.</p>
          </div>
        </div>

        <div className="cc-kpi-grid">
          {globalCards.map((card) => (
            card.actionId ? (
              <button
                key={card.label}
                type="button"
                className={`cc-kpi-card cc-kpi-card--actionable${card.accent ? ` cc-kpi-card--${card.accent}` : ''}`}
                onClick={() => onRunKpiAction(card.actionId!)}
              >
                <span className="cc-kpi-card__label">{card.label}</span>
                <strong className="cc-kpi-card__value">{card.value}</strong>
                <span className="cc-kpi-card__hint">Abrir lista</span>
              </button>
            ) : (
              <article
                key={card.label}
                className={`cc-kpi-card${card.accent ? ` cc-kpi-card--${card.accent}` : ''}`}
              >
                <span className="cc-kpi-card__label">{card.label}</span>
                <strong className="cc-kpi-card__value">{card.value}</strong>
              </article>
            )
          ))}
        </div>
      </section>

      <section className="cc-dashboard-block">
        <div className="cc-dashboard-block__header">
          <div>
            <h2>KPIs financieros y de gastos</h2>
            <p>Lectura rápida del estado económico y documental del negocio.</p>
          </div>
        </div>

        <div className="cc-kpi-grid">
          {financialCards.map((card) => (
            card.actionId ? (
              <button
                key={card.label}
                type="button"
                className={`cc-kpi-card cc-kpi-card--actionable${card.accent ? ` cc-kpi-card--${card.accent}` : ''}`}
                onClick={() => onRunKpiAction(card.actionId!)}
              >
                <span className="cc-kpi-card__label">{card.label}</span>
                <strong className="cc-kpi-card__value">{card.value}</strong>
                <span className="cc-kpi-card__hint">Abrir lista</span>
              </button>
            ) : (
              <article
                key={card.label}
                className={`cc-kpi-card${card.accent ? ` cc-kpi-card--${card.accent}` : ''}`}
              >
                <span className="cc-kpi-card__label">{card.label}</span>
                <strong className="cc-kpi-card__value">{card.value}</strong>
              </article>
            )
          ))}
        </div>
      </section>
    </>
  )
}
