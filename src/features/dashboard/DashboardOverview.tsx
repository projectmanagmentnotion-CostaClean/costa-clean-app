import { appConfig } from '../../app/appConfig'
import { appModules } from '../../app/modules'
import { formatCurrency } from '../../app/displayFormat'
import type { HomePageProps } from './types'

export function DashboardOverview({
  metrics,
  connectionStatus,
  connectionDetail,
}: HomePageProps) {
  const activeModules = appModules.filter((module) => module.enabled).length

  return (
    <section className="cc-dashboard-overview">
      <div className="cc-dashboard-overview__hero">
        <div className="cc-dashboard-overview__copy">
          <span className="cc-dashboard-overview__eyebrow">
            {appConfig.appName}
          </span>

          <h1 className="cc-dashboard-overview__title">
            Panel central del negocio
          </h1>

          <p className="cc-dashboard-overview__text">
            Vista ejecutiva de CostaClean CRM con navegación glass, KPIs reales y
            accesos rápidos al flujo operativo diario.
          </p>
        </div>

        <div className="cc-dashboard-overview__spotlight">
          <span className="cc-dashboard-chip">Versión {appConfig.appVersion}</span>
          <span className="cc-dashboard-chip">Módulos activos: {activeModules}</span>
          <span className="cc-dashboard-chip">
            Pendientes de cobro: {metrics.pendingInvoicesCount}
          </span>
        </div>
      </div>

      <div className="cc-dashboard-overview__grid">
        <article className="cc-dashboard-panel">
          <span className="cc-dashboard-panel__label">Conexión</span>
          <strong className="cc-dashboard-panel__value">{connectionStatus}</strong>
          <p className="cc-dashboard-panel__text">{connectionDetail}</p>
        </article>

        <article className="cc-dashboard-panel">
          <span className="cc-dashboard-panel__label">Facturado</span>
          <strong className="cc-dashboard-panel__value">
            {formatCurrency(metrics.totalInvoiced)}
          </strong>
          <p className="cc-dashboard-panel__text">
            Total acumulado de facturas emitidas.
          </p>
        </article>

        <article className="cc-dashboard-panel">
          <span className="cc-dashboard-panel__label">Cobrado</span>
          <strong className="cc-dashboard-panel__value">
            {formatCurrency(metrics.totalCollected)}
          </strong>
          <p className="cc-dashboard-panel__text">
            Total registrado en pagos recibidos.
          </p>
        </article>

        <article className="cc-dashboard-panel">
          <span className="cc-dashboard-panel__label">Operación viva</span>
          <strong className="cc-dashboard-panel__value">
            {metrics.openQuotesCount + metrics.scheduledJobsCount + metrics.pendingInvoicesCount}
          </strong>
          <p className="cc-dashboard-panel__text">
            Presupuestos abiertos, servicios activos y facturas pendientes.
          </p>
        </article>
      </div>
    </section>
  )
}
