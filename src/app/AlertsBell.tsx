import { useEffect, useMemo, useRef, useState } from 'react'
import type { AutomationAlertItem, AutomationAlertSeverity } from '../features/automation/types'

interface AlertsBellProps {
  alerts: AutomationAlertItem[]
  reviewedAlertIds: string[]
  onOpenAlert: (alert: AutomationAlertItem) => void
  onOpenAlertsCenter: () => void
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

function getSeverityLabel(severity: AutomationAlertSeverity): string {
  if (severity === 'critical') return 'Critica'
  if (severity === 'warning') return 'Prioritaria'
  return 'Recordatorio'
}

export function AlertsBell({
  alerts,
  reviewedAlertIds,
  onOpenAlert,
  onOpenAlertsCenter,
}: AlertsBellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const reviewedIds = useMemo(() => new Set(reviewedAlertIds), [reviewedAlertIds])
  const activeAlerts = alerts.filter((alert) => !reviewedIds.has(alert.id))
  const recentAlerts = activeAlerts.slice(0, 4)

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
    onOpenAlert(alert)
  }

  function handleOpenCenter() {
    setIsOpen(false)
    onOpenAlertsCenter()
  }

  return (
    <div className="cc-alerts-bell" ref={rootRef}>
      <button
        type="button"
        className={isOpen ? 'cc-alerts-bell__button is-open' : 'cc-alerts-bell__button'}
        onClick={() => setIsOpen((current) => !current)}
        aria-label={`Alertas activas: ${activeAlerts.length}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <BellIcon />
        {activeAlerts.length > 0 ? (
          <span className="cc-alerts-bell__badge">{activeAlerts.length > 99 ? '99+' : activeAlerts.length}</span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="cc-alerts-bell__panel" role="dialog" aria-label="Alertas recientes">
          <div className="cc-alerts-bell__panel-header">
            <div>
              <span>Alertas</span>
              <strong>{activeAlerts.length} activas</strong>
            </div>
            <button type="button" className="secondary-button" onClick={handleOpenCenter}>
              Ver todas
            </button>
          </div>

          {recentAlerts.length > 0 ? (
            <div className="cc-alerts-bell__list">
              {recentAlerts.map((alert) => (
                <button
                  key={alert.id}
                  type="button"
                  className={`cc-alerts-bell__item cc-alerts-bell__item--${alert.severity}`}
                  onClick={() => handleOpenAlert(alert)}
                >
                  <span>{getSeverityLabel(alert.severity)}</span>
                  <strong>{alert.title}</strong>
                  <small>{alert.summary}</small>
                </button>
              ))}
            </div>
          ) : (
            <div className="cc-alerts-bell__empty">
              <strong>Sin alertas activas</strong>
              <p>No hay incidencias pendientes con las reglas actuales.</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
