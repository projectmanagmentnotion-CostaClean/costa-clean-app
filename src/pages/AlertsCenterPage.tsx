import {
  getAlertActionLabel,
  getAlertBucket,
  getAlertBucketMeta,
  getAlertImpactCopy,
  groupAlertsByBucket,
  type AlertBucket,
} from '../features/automation/alertPresentation'
import type { AutomationAlertItem } from '../features/automation/types'

interface AlertsCenterPageProps {
  alerts: AutomationAlertItem[]
  reviewedAlertIds: string[]
  onToggleReviewed: (alertId: string) => void
  onOpenAlert: (alert: AutomationAlertItem) => void
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
  const groupedAlerts = groupAlertsByBucket(activeAlerts)
  const criticalCount = groupedAlerts.critical.length
  const actionCount = groupedAlerts.action.length
  const followUpCount = groupedAlerts.follow_up.length

  function renderAlertBucket(bucket: AlertBucket, bucketAlerts: AutomationAlertItem[]) {
    const bucketMeta = getAlertBucketMeta(bucket)

    return (
      <section className="cc-dashboard-block" key={bucket}>
        <div className="cc-dashboard-block__header">
          <div>
            <h2>{bucketMeta.title}</h2>
            <p>{bucketMeta.description}</p>
          </div>
          <span className={`cc-alert-center-pill cc-alert-center-pill--${bucket}`}>{bucketAlerts.length}</span>
        </div>

        {bucketAlerts.length > 0 ? (
          <div className="cc-alerts-list cc-bounded-list">
            {bucketAlerts.map((alert) => {
              const alertBucket = getAlertBucket(alert)
              const amountLabel = formatCurrency(alert.amount)

              return (
                <article
                  key={alert.id}
                  className={`cc-alert-center-card cc-alert-center-card--${alertBucket}`}
                >
                  <div className="cc-alert-center-card__header">
                    <div>
                      <span className="cc-alert-center-card__eyebrow">{bucketMeta.label}</span>
                      <h3>{alert.title}</h3>
                    </div>
                    <span className={`cc-alert-center-card__badge cc-alert-center-card__badge--${alertBucket}`}>
                      {alert.count}
                    </span>
                  </div>

                  <p className="cc-alert-center-card__summary">{alert.summary}</p>
                  <p className="cc-alert-center-card__detail">{getAlertImpactCopy(alert)}</p>

                  <div className="cc-alert-center-card__meta">
                    <span>Que hago: {getAlertActionLabel(alert)}</span>
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
                      {getAlertActionLabel(alert)}
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
            <strong>{bucketMeta.emptyTitle}</strong>
            <p>{bucketMeta.emptyDescription}</p>
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="cc-alerts-page">
      <header className="section-header page-header-actions cc-master-page__hero">
        <div>
          <h1>Centro de alertas</h1>
          <p>
            Cola operativa priorizada para saber que bloquea dinero, que requiere accion hoy y que solo necesita seguimiento.
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
          <p className="cc-kpi-footnote">Todo lo que sigue pidiendo accion o seguimiento real</p>
        </article>
        <article className="cc-kpi-card cc-kpi-card--warning">
          <span className="cc-kpi-label">Criticas</span>
          <strong className="cc-kpi-value">{criticalCount}</strong>
          <p className="cc-kpi-footnote">Bloqueos que impactan cobro, facturacion o soporte hoy</p>
        </article>
        <article className="cc-kpi-card">
          <span className="cc-kpi-label">Accion requerida</span>
          <strong className="cc-kpi-value">{actionCount}</strong>
          <p className="cc-kpi-footnote">Casos que conviene mover antes de que se enfrien</p>
        </article>
        <article className="cc-kpi-card">
          <span className="cc-kpi-label">Seguimiento</span>
          <strong className="cc-kpi-value">{followUpCount}</strong>
          <p className="cc-kpi-footnote">Recordatorios y pendientes utiles pero no criticos</p>
        </article>
        <article className="cc-kpi-card cc-kpi-card--success">
          <span className="cc-kpi-label">Revisadas</span>
          <strong className="cc-kpi-value">{reviewedAlerts.length}</strong>
          <p className="cc-kpi-footnote">Ocultadas localmente para mantener la cola limpia</p>
        </article>
      </section>

      {renderAlertBucket('critical', groupedAlerts.critical)}
      {renderAlertBucket('action', groupedAlerts.action)}
      {renderAlertBucket('follow_up', groupedAlerts.follow_up)}

      <section className="cc-dashboard-block">
        <div className="cc-dashboard-block__header">
          <div>
            <h2>Revisadas</h2>
            <p>Estado local de foco para sesiones largas sin perder el acceso al detalle.</p>
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
                    {getAlertActionLabel(alert)}
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
            <p>Las alertas marcadas como revisadas apareceran aqui mientras sigan activas.</p>
          </div>
        )}
      </section>
    </section>
  )
}
