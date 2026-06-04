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
    clientsCount: number
    openQuotesCount: number
    scheduledJobsCount: number
    invoicedThisMonthTotal: number
    collectedThisMonthTotal: number
    outstandingReceivablesTotal: number
    totalExpenses: number
    jobsScheduledTodayCount: number
    completedJobsWithoutInvoiceCount: number
    unpaidInvoicesOlderThan7DaysCount: number
    dueRecurringPlansCount: number
    partiallyPaidInvoicesCount: number
    pausedRecurringPlansCount: number
    clientsWithPendingBalanceCount: number
  }
  onRunKpiAction: (actionId: DashboardKpiActionId) => void
}

export function DashboardOverview({ metrics, onRunKpiAction }: DashboardOverviewProps) {
  const estimatedNet = metrics.collectedThisMonthTotal - metrics.totalExpenses

  const strategicCards: Array<{
    label: string
    value: string
    detail: string
    tone: 'finance' | 'success' | 'warning' | 'muted'
    actionId?: DashboardKpiActionId
  }> = [
    {
      label: 'Facturado del mes',
      value: formatCurrency(metrics.invoicedThisMonthTotal),
      detail: 'Emision registrada en el mes actual.',
      tone: 'finance',
      actionId: 'invoiced_this_month',
    },
    {
      label: 'Cobrado del mes',
      value: formatCurrency(metrics.collectedThisMonthTotal),
      detail: 'Cobros confirmados en el mes actual.',
      tone: 'success',
      actionId: 'collected_this_month',
    },
    {
      label: 'Pendiente de cobro',
      value: formatCurrency(metrics.outstandingReceivablesTotal),
      detail: 'Importe pendiente en facturas no pagadas.',
      tone: 'warning',
      actionId: 'outstanding_invoices',
    },
    {
      label: 'Resultado mensual',
      value: formatCurrency(estimatedNet),
      detail: 'Cobrado del mes menos gastos acumulados.',
      tone: 'muted',
    },
  ]

  const secondaryStats: Array<{
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
      label: 'Gasto acumulado',
      value: formatCurrency(metrics.totalExpenses),
      actionId: 'expenses_this_month',
    },
  ]

  const operationalSignals: Array<{
    label: string
    value: string
    detail: string
    actionId?: DashboardKpiActionId
  }> = [
    {
      label: 'Servicios hoy',
      value: String(metrics.jobsScheduledTodayCount),
      detail: 'Carga inmediata de ejecucion.',
      actionId: 'jobs_today',
    },
    {
      label: 'Listos para facturar',
      value: String(metrics.completedJobsWithoutInvoiceCount),
      detail: 'Servicios completados aun sin factura.',
      actionId: 'completed_jobs_without_invoice',
    },
    {
      label: 'Cobros fuera de plazo',
      value: String(metrics.unpaidInvoicesOlderThan7DaysCount),
      detail: 'Facturas emitidas con seguimiento urgente.',
      actionId: 'unpaid_invoices_older_7d',
    },
    {
      label: 'Facturas parciales',
      value: String(metrics.partiallyPaidInvoicesCount),
      detail: 'Casos con cobro iniciado y saldo aun pendiente.',
      actionId: 'outstanding_invoices',
    },
    {
      label: 'Recurrentes listas',
      value: String(metrics.dueRecurringPlansCount),
      detail: 'Planes activos que ya pueden emitirse.',
    },
    {
      label: 'Clientes con saldo',
      value: String(metrics.clientsWithPendingBalanceCount),
      detail: 'Cartera activa con seguimiento de cobro abierto.',
    },
    {
      label: 'Recurrentes pausadas',
      value: String(metrics.pausedRecurringPlansCount),
      detail: 'Planes detenidos que conviene revisar o reactivar.',
    },
  ]

  return (
    <section className="cc-dashboard-overview cc-dashboard-overview--executive">
      <div className="cc-dashboard-exec">
        <div className="cc-dashboard-exec__intro">
          <span className="cc-dashboard-overview__eyebrow">Executive View</span>
          <h2 className="cc-dashboard-overview__title">Control financiero y operativo diario</h2>
          <p className="cc-dashboard-overview__text">
            Lectura priorizada para caja, seguimiento comercial y carga operativa sin salir del dashboard.
          </p>
        </div>

        <div className="cc-dashboard-exec__summary">
          <article className="cc-dashboard-summary-card">
            <span className="cc-dashboard-summary-card__label">Resumen ejecutivo</span>
            <strong className="cc-dashboard-summary-card__value">{formatCurrency(estimatedNet)}</strong>
            <div className="cc-dashboard-summary-card__rows">
              <div className="cc-dashboard-summary-card__row">
                <span>Cobrado del mes</span>
                <strong>{formatCurrency(metrics.collectedThisMonthTotal)}</strong>
              </div>
              <div className="cc-dashboard-summary-card__row">
                <span>Pendiente de cobro</span>
                <strong>{formatCurrency(metrics.outstandingReceivablesTotal)}</strong>
              </div>
              <div className="cc-dashboard-summary-card__row">
                <span>Servicios en curso</span>
                <strong>{metrics.scheduledJobsCount}</strong>
              </div>
            </div>
          </article>
        </div>
      </div>

      <div className="cc-dashboard-strategic-grid">
        {strategicCards.map((card) => (
          card.actionId ? (
            <button
              key={card.label}
              type="button"
              className={`cc-kpi-card cc-kpi-card--executive cc-kpi-card--actionable cc-kpi-card--${card.tone}`}
              onClick={() => onRunKpiAction(card.actionId!)}
            >
              <span className="cc-kpi-card__label">{card.label}</span>
              <strong className="cc-kpi-card__value">{card.value}</strong>
              <p className="cc-kpi-card__detail">{card.detail}</p>
              <span className="cc-kpi-card__hint">Abrir lista</span>
            </button>
          ) : (
            <article
              key={card.label}
              className={`cc-kpi-card cc-kpi-card--executive cc-kpi-card--${card.tone}`}
            >
              <span className="cc-kpi-card__label">{card.label}</span>
              <strong className="cc-kpi-card__value">{card.value}</strong>
              <p className="cc-kpi-card__detail">{card.detail}</p>
            </article>
          )
        ))}
      </div>

      <div className="cc-dashboard-stat-strip">
        {secondaryStats.map((stat) => (
          stat.actionId ? (
            <button
              key={stat.label}
              type="button"
              className="cc-dashboard-stat"
              onClick={() => onRunKpiAction(stat.actionId!)}
            >
              <span className="cc-dashboard-stat__label">{stat.label}</span>
              <strong className="cc-dashboard-stat__value">{stat.value}</strong>
            </button>
          ) : (
            <article key={stat.label} className="cc-dashboard-stat">
              <span className="cc-dashboard-stat__label">{stat.label}</span>
              <strong className="cc-dashboard-stat__value">{stat.value}</strong>
            </article>
          )
        ))}
      </div>

      <div className="cc-kpi-grid cc-kpi-grid--compact">
        {operationalSignals.map((signal) => (
          signal.actionId ? (
            <button
              key={signal.label}
              type="button"
              className="cc-kpi-card cc-kpi-card--compact cc-kpi-card--actionable cc-kpi-card--warning"
              onClick={() => onRunKpiAction(signal.actionId!)}
            >
              <span className="cc-kpi-card__label">{signal.label}</span>
              <strong className="cc-kpi-card__value">{signal.value}</strong>
              <p className="cc-kpi-card__detail">{signal.detail}</p>
              <span className="cc-kpi-card__hint">Abrir lista</span>
            </button>
          ) : (
            <article key={signal.label} className="cc-kpi-card cc-kpi-card--compact cc-kpi-card--warning">
              <span className="cc-kpi-card__label">{signal.label}</span>
              <strong className="cc-kpi-card__value">{signal.value}</strong>
              <p className="cc-kpi-card__detail">{signal.detail}</p>
            </article>
          )
        ))}
      </div>
    </section>
  )
}
