import type { AutomationAlertItem, AutomationAlertSeverity } from '../features/automation/types'

interface AlertsCenterPageProps {
  alerts: AutomationAlertItem[]
  reviewedAlertIds: string[]
  onToggleReviewed: (alertId: string) => void
  onOpenAlert: (alert: AutomationAlertItem) => void
}

function getSeverityLabel(severity: AutomationAlertSeverity): string {
  if (severity === 'critical') return 'Crítica'
  if (severity === 'warning') return 'Prioritaria'
  return 'Recordatorio'
}

function formatCurrency(value: number | undefined): string | null {
  if (typeof value !== 'number') return null
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function AlertsCenterPage({
  alerts,
  reviewedAlertIds,
  onToggleReviewed,
  onOpenAlert,
}: AlertsCenterPageProps) {
  const reviewedIds = new Set(reviewedAlertIds)
  const activeAlerts = alerts.filter((alert) => !reviewedIds.has(alert.id))
  const reviewedAlerts = alerts.filter((alert) => reviewedIds.has(alert.id))
  const criticalCount = activeAlerts.filter((alert) => alert.severity === 'critical').length
  const warningCount = activeAlerts.filter((alert) => alert.severity === 'warning').length

  return (
    <section className="cc-alerts-page">
      <header className="section-header page-header-actions cc-master-page__hero">
        <div>
          <h1>Centro de alertas</h1>
          <p>
            Reglas internas deterministas para detectar cobros pendientes, trabajos sin facturar,
            presupuestos sin activar y carencias documentales antes de cierre.
          </p>
        </div>

        <div className="cc-page-header-actions">
          <button type="button" className="secondary-button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            Ir al resumen
          </button>
        </div>
      </header>

      <section className="cc-kpi-grid" aria-label="Resumen del centro de alertas">
        <article className="cc-kpi-card cc-kpi-card--warning">
          <span className="cc-kpi-label">Alertas activas</span>
          <strong className="cc-kpi-value">{activeAlerts.length}</strong>
          <p className="cc-kpi-footnote">Reglas activas que requieren seguimiento hoy</p>
        </article>
        <article className="cc-kpi-card cc-kpi-card--warning">
          <span className="cc-kpi-label">Críticas</span>
          <strong className="cc-kpi-value">{criticalCount}</strong>
          <p className="cc-kpi-footnote">Cobro, facturación o soporte con prioridad máxima</p>
        </article>
        <article className="cc-kpi-card">
          <span className="cc-kpi-label">Prioritarias</span>
          <strong className="cc-kpi-value">{warningCount}</strong>
          <p className="cc-kpi-footnote">Seguimiento operativo o fiscal no resuelto</p>
        </article>
        <article className="cc-kpi-card cc-kpi-card--success">
          <span className="cc-kpi-label">Revisadas</span>
          <strong className="cc-kpi-value">{reviewedAlerts.length}</strong>
          <p className="cc-kpi-footnote">Marcadas internamente como revisadas en este dispositivo</p>
        </article>
      </section>

      <section className="cc-dashboard-block">
        <div className="cc-dashboard-block__header">
          <div>
            <h2>Alertas activas</h2>
            <p>Lista operativa con severidad, contexto temporal y acceso directo al módulo afectado.</p>
          </div>
        </div>

        {activeAlerts.length > 0 ? (
          <div className="cc-alerts-list cc-bounded-list">
            {activeAlerts.map((alert) => {
              const amountLabel = formatCurrency(alert.amount)

              return (
                <article
                  key={alert.id}
                  className={`cc-alert-center-card cc-alert-center-card--${alert.severity}`}
                >
                  <div className="cc-alert-center-card__header">
                    <div>
                      <span className="cc-alert-center-card__eyebrow">{getSeverityLabel(alert.severity)}</span>
                      <h3>{alert.title}</h3>
                    </div>
                    <span className={`cc-alert-center-card__badge cc-alert-center-card__badge--${alert.severity}`}>
                      {alert.count}
                    </span>
                  </div>

                  <p className="cc-alert-center-card__summary">{alert.summary}</p>
                  <p className="cc-alert-center-card__detail">{alert.detail}</p>

                  <div className="cc-alert-center-card__meta">
                    {alert.ageContext ? <span>{alert.ageContext}</span> : null}
                    {alert.contextLabel ? <span>{alert.contextLabel}</span> : null}
                    {amountLabel ? <span>Importe relacionado: {amountLabel}</span> : null}
                  </div>

                  {alert.examples?.length ? (
                    <div className="cc-alert-center-card__examples">
                      {alert.examples.map((item) => (
                        <p key={`${alert.id}-${item}`}>{item}</p>
                      ))}
                    </div>
                  ) : null}

                  <div className="cc-alert-center-card__actions">
                    <button type="button" className="primary-button" onClick={() => onOpenAlert(alert)}>
                      Abrir incidencia
                    </button>
                    <button type="button" className="secondary-button" onClick={() => onToggleReviewed(alert.id)}>
                      Marcar revisada
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="empty-state cc-state-card">
            <strong>Sin alertas activas</strong>
            <p>No hay incidencias operativas o fiscales activas con las reglas actuales.</p>
          </div>
        )}
      </section>

      <section className="cc-dashboard-block">
        <div className="cc-dashboard-block__header">
          <div>
            <h2>Revisadas</h2>
            <p>Estado ligero de seguimiento local para no perder foco en sesiones de trabajo largas.</p>
          </div>
        </div>

        {reviewedAlerts.length > 0 ? (
          <div className="cc-alerts-list cc-alerts-list--reviewed cc-bounded-list">
            {reviewedAlerts.map((alert) => (
              <article key={alert.id} className="cc-alert-center-card cc-alert-center-card--reviewed">
                <div className="cc-alert-center-card__header">
                  <div>
                    <span className="cc-alert-center-card__eyebrow">Revisada</span>
                    <h3>{alert.title}</h3>
                  </div>
                  <span className="cc-alert-center-card__badge">{alert.count}</span>
                </div>
                <p className="cc-alert-center-card__detail">{alert.summary}</p>
                <div className="cc-alert-center-card__actions">
                  <button type="button" className="secondary-button" onClick={() => onOpenAlert(alert)}>
                    Abrir
                  </button>
                  <button type="button" className="secondary-button" onClick={() => onToggleReviewed(alert.id)}>
                    Reactivar
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state cc-state-card">
            <strong>Sin alertas revisadas</strong>
            <p>Las alertas marcadas como revisadas aparecerán aquí mientras sigan activas.</p>
          </div>
        )}
      </section>
    </section>
  )
}
