import { formatDateEs, getDisplayStatusLabel } from '../../app/displayFormat'
import type { JobListItem } from '../jobs/types'
import type { DashboardKpiActionId } from './kpiActions'

interface DashboardAgendaProps {
  agenda: {
    todayJobs: JobListItem[]
    tomorrowJobs: JobListItem[]
    upcomingJobs: JobListItem[]
  }
  onRunKpiAction: (actionId: DashboardKpiActionId) => void
}

function renderJobMeta(job: JobListItem): string {
  const client = job.client_name?.trim() || job.client_display_code || job.client_id
  const property = job.property_name?.trim() || job.property_display_code || job.property_id
  return `${client} · ${property}`
}

function AgendaList({
  title,
  jobs,
  emptyText,
  actionId,
  actionLabel,
  onRunKpiAction,
}: {
  title: string
  jobs: JobListItem[]
  emptyText: string
  actionId: DashboardKpiActionId
  actionLabel: string
  onRunKpiAction: (actionId: DashboardKpiActionId) => void
}) {
  return (
    <article className="cc-agenda-card">
      <div className="cc-agenda-card__header">
        <div>
          <h3>{title}</h3>
          <p>{jobs.length} servicio{jobs.length === 1 ? '' : 's'}</p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={() => onRunKpiAction(actionId)}
        >
          {actionLabel}
        </button>
      </div>

      {jobs.length === 0 ? (
        <div className="empty-state">
          <strong>Sin registros</strong>
          <p>{emptyText}</p>
        </div>
      ) : (
        <div className="cc-agenda-list">
          {jobs.map((job) => (
            <button
              key={job.id}
              type="button"
              className="cc-agenda-item"
              onClick={() => onRunKpiAction(actionId)}
            >
              <div className="cc-agenda-item__top">
                <strong>{job.billing_concept?.trim() || job.display_code || job.id}</strong>
                <span className="lead-badge">{getDisplayStatusLabel(job.status)}</span>
              </div>
              <p>{renderJobMeta(job)}</p>
              <div className="cc-list-meta">
                <span>{formatDateEs(job.scheduled_date)}</span>
                <span>{job.display_code ?? job.id}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </article>
  )
}

export function DashboardAgenda({ agenda, onRunKpiAction }: DashboardAgendaProps) {
  return (
    <section className="cc-dashboard-block">
      <div className="cc-dashboard-block__header">
        <div>
          <h2>Agenda operativa</h2>
          <p>Vista rápida de hoy, mañana y próximos servicios programados.</p>
        </div>
      </div>

      <div className="cc-dashboard-agenda">
        <AgendaList
          title="Hoy"
          jobs={agenda.todayJobs}
          emptyText="No hay servicios programados para hoy."
          actionId="jobs_today"
          actionLabel="Abrir hoy"
          onRunKpiAction={onRunKpiAction}
        />
        <AgendaList
          title="Mañana"
          jobs={agenda.tomorrowJobs}
          emptyText="No hay servicios programados para mañana."
          actionId="jobs_tomorrow"
          actionLabel="Abrir mañana"
          onRunKpiAction={onRunKpiAction}
        />
        <AgendaList
          title="Próximos servicios"
          jobs={agenda.upcomingJobs}
          emptyText="No hay más servicios próximos en agenda."
          actionId="jobs_upcoming"
          actionLabel="Abrir agenda"
          onRunKpiAction={onRunKpiAction}
        />
      </div>
    </section>
  )
}
