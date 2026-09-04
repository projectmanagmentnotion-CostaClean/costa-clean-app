import { useState } from 'react'
import {
  getAlertActionLabel,
  getAlertBucket,
  getAlertBucketMeta,
  getAlertImpactCopy,
  groupAlertsByBucket,
  type AlertBucket,
} from '../features/automation/alertPresentation'
import { ActionChecklist, type ActionChecklistItem } from '../components/ActionChecklist'
import { CollapsibleDetailSection } from '../components/CollapsibleDetailSection'
import { ExecutiveHeader } from '../components/ExecutiveHeader'
import { InsightPanel } from '../components/InsightPanel'
import { SeverityBadge, type SeverityTone } from '../components/SeverityBadge'
import { VisualKpiCard } from '../components/VisualKpiCard'
import { DSEmptyState } from '../design-system/components/DSEmptyState'
import type { AutomationAlertItem } from '../features/automation/types'
import type { AlertDecision } from '../features/alerts/alertDecisionApi'

interface AlertsCenterPageProps {
  alerts: AutomationAlertItem[]
  decisions: AlertDecision[]
  onOpenAlert: (alert: AutomationAlertItem) => void
  onMarkRead: (alert: AutomationAlertItem) => void
  onAcknowledge: (alert: AutomationAlertItem) => void
  onDismiss: (alert: AutomationAlertItem) => void
  onReopen: (alert: AutomationAlertItem) => void
}

function formatCurrency(value: number | undefined): string | null {
  if (typeof value !== 'number') return null
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

function getBucketTone(bucket: AlertBucket): SeverityTone {
  if (bucket === 'critical') return 'critical'
  if (bucket === 'action') return 'warning'
  if (bucket === 'follow_up') return 'info'
  return 'neutral'
}

export function AlertsCenterPage({
  alerts,
  decisions,
  onOpenAlert,
  onMarkRead,
  onAcknowledge,
  onDismiss,
  onReopen,
}: AlertsCenterPageProps) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'critical' | 'resolved'>('pending')
  const activeAlerts = alerts.filter((alert) => {
    const fingerprint = alert.fingerprint ?? alert.id
    const status = decisions.find((decision) => decision.scope === 'global' && decision.alert_key === alert.id && decision.fingerprint === fingerprint)?.status
    return status !== 'dismissed' && status !== 'resolved'
  })
  const reviewedAlerts = alerts.filter((alert) => {
    const fingerprint = alert.fingerprint ?? alert.id
    const status = decisions.find((decision) => decision.scope === 'global' && decision.alert_key === alert.id && decision.fingerprint === fingerprint)?.status
    return status === 'dismissed' || status === 'resolved'
  })
  const filteredActiveAlerts = filter === 'resolved'
    ? []
    : activeAlerts.filter((alert) => filter !== 'critical' || alert.severity === 'critical')
  const filteredReviewedAlerts = filter === 'pending'
    ? []
    : reviewedAlerts.filter((alert) => filter !== 'critical' || alert.severity === 'critical')
  const groupedAlerts = groupAlertsByBucket(filteredActiveAlerts)
  const criticalCount = groupedAlerts.critical.length
  const actionCount = groupedAlerts.action.length
  const followUpCount = groupedAlerts.follow_up.length
  const firstPriorityBucket: AlertBucket = criticalCount > 0 ? 'critical' : actionCount > 0 ? 'action' : followUpCount > 0 ? 'follow_up' : 'info'
  const activeBuckets = [
    ['critical', groupedAlerts.critical],
    ['action', groupedAlerts.action],
    ['follow_up', groupedAlerts.follow_up],
  ] as const
  const summaryChecklist: ActionChecklistItem[] = [
    {
      id: 'critical',
      state: criticalCount > 0 ? 'critical' : 'done',
      label: criticalCount > 0 ? 'Resolver bloqueos criticos' : 'Sin bloqueos criticos',
      description: criticalCount > 0 ? `${criticalCount} alerta(s) afectan cobro, facturacion o control hoy.` : 'La cola no tiene alertas de maxima prioridad.',
    },
    {
      id: 'action',
      state: actionCount > 0 ? 'warning' : 'done',
      label: actionCount > 0 ? 'Mover acciones del dia' : 'Sin acciones urgentes',
      description: actionCount > 0 ? `${actionCount} caso(s) conviene mover hoy para no acumular retraso.` : 'No hay acciones fuera del bloque critico.',
    },
    {
      id: 'follow-up',
      state: followUpCount > 0 ? 'info' : 'done',
      label: followUpCount > 0 ? 'Mantener seguimiento vivo' : 'Seguimiento limpio',
      description: followUpCount > 0 ? `${followUpCount} recordatorio(s) siguen activos.` : 'No hay seguimientos abiertos relevantes.',
    },
  ]

  function renderAlertBucket(bucket: AlertBucket, bucketAlerts: AutomationAlertItem[]) {
    const bucketMeta = getAlertBucketMeta(bucket)

    return (
      <section className="cc-dashboard-block" key={bucket}>
        <div className="cc-dashboard-block__header">
          <div>
            <h2>{bucketMeta.title}</h2>
            <p>{bucketMeta.description}</p>
          </div>
          <SeverityBadge label={`${bucketAlerts.length} activas`} tone={getBucketTone(bucket)} />
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
                      <SeverityBadge label={bucketMeta.label} tone={getBucketTone(bucket)} />
                      <h3>{alert.title}</h3>
                    </div>
                    <SeverityBadge label={`${alert.count}`} tone={getBucketTone(alertBucket)} />
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
                    <button type="button" className="primary-button" onClick={() => { onMarkRead(alert); onOpenAlert(alert) }}>
                      {getAlertActionLabel(alert)}
                    </button>
                    <button type="button" className="secondary-button" onClick={() => onMarkRead(alert)}>
                      Marcar como leída
                    </button>
                    <button type="button" className="secondary-button" onClick={() => alert.severity === 'critical' ? onAcknowledge(alert) : onDismiss(alert)}>
                      {alert.severity === 'critical' ? 'Reconocer' : 'Descartar'}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        ) : null}
      </section>
    )
  }

  return (
    <section className="cc-alerts-page">
      <ExecutiveHeader
        eyebrow="Centro de alertas"
        title="Que requiere accion ahora"
        summary="Cola operativa priorizada para distinguir bloqueo, accion del dia y seguimiento sin convertir la vista en una lista infinita."
        statusLabel={getAlertBucketMeta(firstPriorityBucket).label}
        statusTone={getBucketTone(firstPriorityBucket)}
        secondaryAction={{
          label: 'Ir al resumen',
          onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
        }}
        metricLabel="Alertas activas"
        metricValue={String(activeAlerts.length)}
        metricHint={criticalCount > 0 ? `${criticalCount} criticas siguen abiertas.` : 'No hay bloqueos criticos activos.'}
      >
        <InsightPanel
          title="Prioridad del dia"
          tone={getBucketTone(firstPriorityBucket)}
          insight={criticalCount > 0 ? 'Hay bloqueos que impactan cobro o control operativo.' : actionCount > 0 ? 'La cola pide mover acciones antes de que se enfrien.' : 'La cola esta limpia y queda seguimiento ligero.'}
          implication={criticalCount > 0 ? 'Conviene abrir primero el bucket critico.' : actionCount > 0 ? 'La mayor ganancia viene de resolver los casos de accion requerida.' : 'No hay bloqueo dominante, solo mantenimiento de ritmo.'}
          action={criticalCount > 0 ? 'Resolver alertas criticas antes de revisar seguimiento.' : actionCount > 0 ? 'Atacar las alertas de accion requerida.' : 'Mantener el seguimiento al dia y archivar revisadas.'}
        />
      </ExecutiveHeader>

      <section className="cc-kpi-grid" aria-label="Resumen del centro de alertas">
        <VisualKpiCard label="Alertas activas" value={String(activeAlerts.length)} hint="Todo lo que sigue pidiendo accion o seguimiento real" tone="warning" priority="compact" />
        <VisualKpiCard label="Criticas" value={String(criticalCount)} hint="Bloqueos que impactan cobro, facturacion o soporte hoy" tone={criticalCount > 0 ? 'critical' : 'neutral'} priority="compact" badgeLabel={criticalCount > 0 ? 'Bloquea' : 'Limpio'} />
        <VisualKpiCard label="Accion requerida" value={String(actionCount)} hint="Casos que conviene mover antes de que se enfrien" tone={actionCount > 0 ? 'warning' : 'neutral'} priority="compact" />
        <VisualKpiCard label="Seguimiento" value={String(followUpCount)} hint="Recordatorios y pendientes utiles pero no criticos" tone="info" priority="compact" />
        <VisualKpiCard label="Resueltas" value={String(reviewedAlerts.length)} hint="Condiciones cerradas o descartadas con decisión persistente" tone="success" priority="compact" />
      </section>

      <nav className="cc-alerts-page__filters" aria-label="Filtrar alertas">
        {([
          ['all', 'Todas'],
          ['pending', 'Pendientes'],
          ['critical', 'Críticas'],
          ['resolved', 'Resueltas'],
        ] as const).map(([value, label]) => (
          <button key={value} type="button" className={filter === value ? 'secondary-button is-active' : 'secondary-button'} onClick={() => setFilter(value)} aria-pressed={filter === value}>
            {label}
          </button>
        ))}
      </nav>

      {activeAlerts.length > 0 ? (
        <section className="cc-dashboard-block">
          <div className="cc-dashboard-block__header">
            <div>
              <h2>Lectura ejecutiva</h2>
              <p>Tres señales para decidir si hoy toca apagar fuegos, mover casos o solo mantener seguimiento.</p>
            </div>
          </div>
          <ActionChecklist items={summaryChecklist} compact />
        </section>
      ) : null}

      {filteredActiveAlerts.length === 0 && filteredReviewedAlerts.length === 0 ? (
        <section className="cc-dashboard-block">
          <DSEmptyState
            title="Sin alertas activas"
            description="No hay bloqueos ni seguimientos vivos en este momento."
          />
        </section>
      ) : null}

      {activeBuckets
        .filter(([, bucketAlerts]) => bucketAlerts.length > 0)
        .map(([bucket, bucketAlerts]) => renderAlertBucket(bucket, bucketAlerts))}

      <section className="cc-dashboard-block">
        <CollapsibleDetailSection title="Revisadas" count={reviewedAlerts.length} tone="neutral">

          {filteredReviewedAlerts.length > 0 ? (
            <div className="cc-alerts-list cc-alerts-list--reviewed cc-bounded-list" style={{ marginTop: '0.75rem' }}>
              {filteredReviewedAlerts.map((alert) => (
                <article key={alert.id} className="cc-alert-center-card cc-alert-center-card--reviewed">
                  <div className="cc-alert-center-card__header">
                    <div>
                      <SeverityBadge label={decisions.find((decision) => decision.scope === 'global' && decision.alert_key === alert.id && decision.fingerprint === (alert.fingerprint ?? alert.id))?.status === 'dismissed' ? 'Descartada' : 'Resuelta'} tone="success" />
                      <h3>{alert.title}</h3>
                    </div>
                    <SeverityBadge label={`${alert.count}`} tone="neutral" />
                  </div>
                  <p className="cc-alert-center-card__detail">{alert.summary}</p>
                  <div className="cc-alert-center-card__actions">
                    <button type="button" className="secondary-button" onClick={() => { onMarkRead(alert); onOpenAlert(alert) }}>
                      {getAlertActionLabel(alert)}
                    </button>
                    <button type="button" className="secondary-button" onClick={() => onReopen(alert)}>
                      Volver a pendientes
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div style={{ marginTop: '0.75rem' }}>
              <DSEmptyState
                title="Sin alertas revisadas"
                description="Las alertas marcadas como revisadas apareceran aqui mientras sigan activas."
              />
            </div>
          )}
        </CollapsibleDetailSection>
      </section>
    </section>
  )
}
