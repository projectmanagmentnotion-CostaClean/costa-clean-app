import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getAlertActionLabel,
  getAlertBucket,
  getAlertBucketMeta,
  groupAlertsByBucket,
} from '../features/automation/alertPresentation'
import type { AutomationAlertItem } from '../features/automation/types'
import type { AlertDecision } from '../features/alerts/alertDecisionApi'

interface AlertsBellProps {
  alerts: AutomationAlertItem[]
  decisions: AlertDecision[]
  onOpenAlert: (alert: AutomationAlertItem) => void
  onOpenAlertsCenter: () => void
  onMarkRead: (alert: AutomationAlertItem) => void
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path
        d="M12 4.5a4.5 4.5 0 0 1 4.5 4.5v2.3c0 .9.28 1.78.8 2.51l1.12 1.56A1 1 0 0 1 17.61 17H6.39a1 1 0 0 1-.81-1.63l1.12-1.56c.52-.73.8-1.61.8-2.51V9A4.5 4.5 0 0 1 12 4.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M10 19a2 2 0 0 0 4 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function AlertsBell({
  alerts,
  decisions,
  onOpenAlert,
  onOpenAlertsCenter,
  onMarkRead,
}: AlertsBellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const readAlertKeys = useMemo(
    () => new Set(decisions.filter((decision) => decision.scope === 'user' && decision.read_at).map((decision) => `${decision.alert_key}:${decision.fingerprint}`)),
    [decisions],
  )
  const activeAlerts = alerts.filter((alert) => {
    const fingerprint = alert.fingerprint ?? alert.id
    const decision = decisions.find((item) => item.scope === 'global' && item.alert_key === alert.id && item.fingerprint === fingerprint)
    return decision?.status !== 'dismissed' && decision?.status !== 'resolved'
  })
  const unreadAlerts = activeAlerts.filter((alert) => !readAlertKeys.has(`${alert.id}:${alert.fingerprint ?? alert.id}`))
  const groupedAlerts = groupAlertsByBucket(activeAlerts)
  const topAlerts = [
    ...groupedAlerts.critical.slice(0, 2),
    ...groupedAlerts.action.slice(0, 2),
    ...groupedAlerts.follow_up.slice(0, 1),
  ].slice(0, 5)
  const bucketChips = (['critical', 'action', 'follow_up'] as const)
    .map((bucket) => ({
      bucket,
      count: groupedAlerts[bucket].length,
      meta: getAlertBucketMeta(bucket),
    }))
    .filter((entry) => entry.count > 0)

  useEffect(() => {
    if (!isOpen) return

    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeydown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [isOpen])

  function handleOpenAlert(alert: AutomationAlertItem) {
    setIsOpen(false)
    onMarkRead(alert)
    onOpenAlert(alert)
  }

  function handleOpenCenter() {
    setIsOpen(false)
    onOpenAlertsCenter()
  }

  return (
    <div className="cc-alerts-bell" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={isOpen ? 'cc-alerts-bell__button is-open' : 'cc-alerts-bell__button'}
        onClick={() => setIsOpen((current) => !current)}
        aria-label={`Alertas: ${unreadAlerts.length} nuevas, ${activeAlerts.length} pendientes`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <BellIcon />
        {unreadAlerts.length > 0 ? (
          <span className="cc-alerts-bell__badge">{unreadAlerts.length > 99 ? '99+' : unreadAlerts.length}</span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="cc-alerts-bell__panel" role="dialog" aria-label="Alertas recientes">
          <div className="cc-alerts-bell__panel-header">
            <div>
              <span>Asuntos pendientes</span>
              <strong>{activeAlerts.length} {activeAlerts.length === 1 ? 'asunto requiere' : 'asuntos requieren'} atención</strong>
            </div>
            <button type="button" className="secondary-button" onClick={handleOpenCenter}>
              Ver todas
            </button>
          </div>

          {bucketChips.length > 0 ? (
            <div className="cc-alerts-bell__chips" aria-label="Resumen de prioridades">
              {bucketChips.map((chip) => (
                <span key={chip.bucket} className={`cc-alerts-bell__chip cc-alerts-bell__chip--${chip.bucket}`}>
                  {chip.count} {chip.meta.label}
                </span>
              ))}
            </div>
          ) : null}

          {topAlerts.length > 0 ? (
            <div className="cc-alerts-bell__list">
              {topAlerts.map((alert) => {
                const bucket = getAlertBucket(alert)
                const bucketMeta = getAlertBucketMeta(bucket)

                return (
                <button
                  key={alert.id}
                  type="button"
                  className={`cc-alerts-bell__item cc-alerts-bell__item--${bucket}`}
                  onClick={() => handleOpenAlert(alert)}
                >
                  <span>{bucketMeta.label}</span>
                  <strong>{alert.title}</strong>
                  <small>{alert.summary}</small>
                  <em>{getAlertActionLabel(alert)}</em>
                </button>
                )
              })}
            </div>
          ) : (
            <div className="cc-alerts-bell__empty">
              <strong>Todo al día</strong>
              <p>No hay asuntos nuevos que requieran atención ahora.</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
