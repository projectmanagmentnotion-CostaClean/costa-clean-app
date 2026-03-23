import { formatCurrency } from '../../app/displayFormat'
import type { DashboardMetrics } from './types'

interface DashboardKpisProps {
  metrics: DashboardMetrics
}

export function DashboardKpis({ metrics }: DashboardKpisProps) {
  const cards = [
    {
      label: 'Leads',
      value: String(metrics.leadsCount),
      detail: 'Solicitudes captadas',
    },
    {
      label: 'Clientes',
      value: String(metrics.clientsCount),
      detail: 'Base activa de clientes',
    },
    {
      label: 'Propiedades',
      value: String(metrics.propertiesCount),
      detail: 'Inmuebles vinculados',
    },
    {
      label: 'Presupuestos abiertos',
      value: String(metrics.openQuotesCount),
      detail: 'Borrador + enviados',
    },
    {
      label: 'Servicios activos',
      value: String(metrics.scheduledJobsCount),
      detail: 'Programados o en curso',
    },
    {
      label: 'Facturas pendientes',
      value: String(metrics.pendingInvoicesCount),
      detail: 'Aún no marcadas como pagadas',
    },
    {
      label: 'Facturación',
      value: formatCurrency(metrics.totalInvoiced),
      detail: 'Emitido hasta hoy',
    },
    {
      label: 'Cobros',
      value: formatCurrency(metrics.totalCollected),
      detail: 'Registrado en pagos',
    },
  ]

  return (
    <section className="cc-dashboard-block">
      <div className="cc-dashboard-block__header">
        <div>
          <h2>KPIs principales</h2>
          <p>Lectura rápida del estado comercial y operativo.</p>
        </div>
      </div>

      <div className="cc-kpi-grid">
        {cards.map((card) => (
          <article key={card.label} className="cc-kpi-card">
            <span className="cc-kpi-card__label">{card.label}</span>
            <strong className="cc-kpi-card__value">{card.value}</strong>
            <p className="cc-kpi-card__detail">{card.detail}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
