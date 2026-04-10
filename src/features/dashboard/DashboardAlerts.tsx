import type { AutomationAlertItem } from '../automation/types'

interface DashboardAlertsProps {
  alerts: AutomationAlertItem[]
  onOpenAlert: (alert: AutomationAlertItem) => void
}

export function DashboardAlerts({ alerts, onOpenAlert }: DashboardAlertsProps) {
  const visibleAlerts = alerts.slice(0, 5)

  return (
    <section className="cc-dashboard-block cc-dashboard-block--alerts">
      <div className="cc-dashboard-block__header cc-dashboard-block__header--split">
        <div>
          <h2>Atención necesaria</h2>
          <p>Reglas internas que priorizan cobro, facturación, soporte documental y seguimiento operativo.</p>
        </div>
      </div>

      <div className="cc-dashboard-alerts">
        {visibleAlerts.length > 0 ? visibleAlerts.map((alert) => (
          <button
            key={alert.id}
            type="button"
            className={`cc-dashboard-alert cc-dashboard-alert--${alert.severity === 'critical' ? 'warning' : 'default'}`}
            onClick={() => onOpenAlert(alert)}
          >
            <div className="cc-dashboard-alert__top">
              <span className="cc-dashboard-alert__label">{alert.title}</span>
              <span className="cc-dashboard-alert__cta">Abrir</span>
            </div>
            <strong className="cc-dashboard-alert__value">{alert.summary}</strong>
            <p className="cc-dashboard-alert__text">{alert.detail}</p>
          </button>
        )) : (
          <article className="cc-dashboard-alert cc-dashboard-alert--default">
            <div className="cc-dashboard-alert__top">
              <span className="cc-dashboard-alert__label">Sin alertas activas</span>
            </div>
            <strong className="cc-dashboard-alert__value">Operativa controlada</strong>
            <p className="cc-dashboard-alert__text">No hay reglas activas que requieran seguimiento inmediato.</p>
          </article>
        )}
      </div>
    </section>
  )
}
