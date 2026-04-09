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
      label: 'Facturas pendientes > 7 dias',
      value: String(metrics.unpaidInvoicesOlderThan7DaysCount),
      detail: 'Seguimiento de cobro que ya requiere accion.',
      actionId: 'unpaid_invoices_older_7d' as const,
      tone: 'warning',
    },
    {
      label: 'Presupuestos enviados > 5 dias',
      value: String(metrics.sentQuotesOlderThan5DaysCount),
      detail: 'Presupuestos enviados con riesgo de enfriarse.',
      actionId: 'sent_quotes_older_5d' as const,
      tone: 'warning',
    },
    {
      label: 'Completados sin factura > 2 dias',
      value: String(metrics.completedJobsWithoutInvoiceOlderThan2DaysCount),
      detail: 'Trabajo terminado pendiente de pasar a ingresos.',
      actionId: 'completed_jobs_without_invoice_older_2d' as const,
      tone: 'warning',
    },
    {
      label: 'Servicios para hoy',
      value: String(metrics.jobsScheduledTodayCount),
      detail: 'Carga operativa inmediata de la jornada.',
      actionId: 'jobs_today' as const,
      tone: 'default',
    },
    {
      label: 'Servicios para manana',
      value: String(metrics.jobsScheduledTomorrowCount),
      detail: 'Prevision corta para planificacion del siguiente dia.',
      actionId: 'jobs_tomorrow' as const,
      tone: 'default',
    },
  ]

  return (
    <section className="cc-dashboard-block cc-dashboard-block--alerts">
      <div className="cc-dashboard-block__header cc-dashboard-block__header--split">
        <div>
          <h2>Atencion necesaria</h2>
          <p>Señales compactas para decidir seguimiento comercial, facturacion y agenda inmediata.</p>
        </div>
      </div>

      <div className="cc-dashboard-alerts">
        {alerts.map((alert) => (
          <button
            key={alert.label}
            type="button"
            className={`cc-dashboard-alert cc-dashboard-alert--${alert.tone}`}
            onClick={() => onRunKpiAction(alert.actionId)}
          >
            <div className="cc-dashboard-alert__top">
              <span className="cc-dashboard-alert__label">{alert.label}</span>
              <span className="cc-dashboard-alert__cta">Abrir</span>
            </div>
            <strong className="cc-dashboard-alert__value">{alert.value}</strong>
            <p className="cc-dashboard-alert__text">{alert.detail}</p>
          </button>
        ))}
      </div>
    </section>
  )
}
