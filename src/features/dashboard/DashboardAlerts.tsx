import type { DashboardKpiActionId } from './kpiActions'

interface DashboardAlertsProps {
  metrics: {
    unpaidInvoicesOlderThan7DaysCount: number
    sentQuotesOlderThan5DaysCount: number
    completedJobsWithoutInvoiceOlderThan2DaysCount: number
    jobsScheduledTodayCount: number
    jobsScheduledTomorrowCount: number
  }
  onRunKpiAction: (actionId: DashboardKpiActionId) => void
}

export function DashboardAlerts({ metrics, onRunKpiAction }: DashboardAlertsProps) {
  const alerts = [
    {
      label: 'Facturas pendientes > 7 días',
      value: String(metrics.unpaidInvoicesOlderThan7DaysCount),
      detail: 'Facturas emitidas hace más de una semana y todavía sin pagar.',
      actionId: 'unpaid_invoices_older_7d' as const,
    },
    {
      label: 'Presupuestos enviados > 5 días',
      value: String(metrics.sentQuotesOlderThan5DaysCount),
      detail: 'Presupuestos enviados que conviene revisar o seguir.',
      actionId: 'sent_quotes_older_5d' as const,
    },
    {
      label: 'Servicios completados sin factura > 2 días',
      value: String(metrics.completedJobsWithoutInvoiceOlderThan2DaysCount),
      detail: 'Servicios cerrados operativamente pendientes de facturación.',
      actionId: 'completed_jobs_without_invoice_older_2d' as const,
    },
    {
      label: 'Servicios para hoy',
      value: String(metrics.jobsScheduledTodayCount),
      detail: 'Agenda operativa prevista para hoy.',
      actionId: 'jobs_today' as const,
    },
    {
      label: 'Servicios para mañana',
      value: String(metrics.jobsScheduledTomorrowCount),
      detail: 'Próxima carga operativa inmediata.',
      actionId: 'jobs_tomorrow' as const,
    },
  ]

  return (
    <section className="cc-dashboard-block">
      <div className="cc-dashboard-block__header">
        <div>
          <h2>Alertas operativas</h2>
          <p>Seguimiento diario sin ruido visual ni cambios de flujo.</p>
        </div>
      </div>

      <div className="cc-dashboard-alerts">
        {alerts.map((alert) => (
          <button
            key={alert.label}
            type="button"
            className="cc-dashboard-alert"
            onClick={() => onRunKpiAction(alert.actionId)}
          >
            <span className="cc-dashboard-alert__label">{alert.label}</span>
            <strong className="cc-dashboard-alert__value">{alert.value}</strong>
            <p className="cc-dashboard-alert__text">{alert.detail}</p>
            <span className="cc-dashboard-alert__hint">Abrir lista</span>
          </button>
        ))}
      </div>
    </section>
  )
}
