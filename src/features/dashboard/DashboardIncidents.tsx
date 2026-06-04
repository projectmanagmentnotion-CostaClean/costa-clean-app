import type { OperationalAction, OperationalIncident } from './operationalControl'

interface DashboardIncidentsProps {
  incidents: OperationalIncident[]
  onRunAction: (action: OperationalAction) => void
}

function getSeverityLabel(severity: OperationalIncident['severity']) {
  switch (severity) {
    case 'critical': return 'Critica'
    case 'warning': return 'Prioritaria'
    case 'info': return 'Seguimiento'
  }
}

export function DashboardIncidents({ incidents, onRunAction }: DashboardIncidentsProps) {
  const visibleIncidents = incidents.slice(0, 8)

  return (
    <section className="cc-dashboard-block cc-dashboard-block--incidents">
      <div className="cc-dashboard-block__header cc-dashboard-block__header--split">
        <div>
          <h2>Incidencias operativas</h2>
          <p>Cola diaria priorizada para facturacion, cobro, recurrencias y calidad relacional.</p>
        </div>
      </div>

      {visibleIncidents.length === 0 ? (
        <div className="empty-state">
          <strong>Sin incidencias operativas activas</strong>
          <p>La operativa diaria no presenta bloqueos o seguimientos prioritarios.</p>
        </div>
      ) : (
        <div className="cc-dashboard-incident-list">
          {visibleIncidents.map((incident) => (
            <article
              key={incident.id}
              className={`cc-dashboard-incident cc-dashboard-incident--${incident.severity}`}
            >
              <div className="cc-dashboard-incident__top">
                <div>
                  <span className="cc-dashboard-incident__severity">{getSeverityLabel(incident.severity)}</span>
                  <h3>{incident.title}</h3>
                </div>
                <span className="lead-badge">{incident.entityLabel}</span>
              </div>

              <strong className="cc-dashboard-incident__summary">{incident.summary}</strong>
              <p className="cc-dashboard-incident__detail">{incident.detail}</p>

              {incident.contextLabel ? (
                <p className="cc-dashboard-incident__context">{incident.contextLabel}</p>
              ) : null}

              <div className="cc-dashboard-incident__actions">
                <button
                  type="button"
                  className="primary-button cc-dashboard-incident__action"
                  onClick={() => onRunAction(incident.primaryAction)}
                >
                  {incident.primaryAction.label}
                </button>

                {incident.secondaryAction ? (
                  <button
                    type="button"
                    className="secondary-button cc-dashboard-incident__action"
                    onClick={() => onRunAction(incident.secondaryAction!)}
                  >
                    {incident.secondaryAction.label}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
