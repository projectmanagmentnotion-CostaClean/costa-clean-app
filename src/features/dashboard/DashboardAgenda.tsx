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
  onOpenJobWorkspace: (jobId: string) => void
}

function buildPrimaryLabel(job: JobListItem): string {
  return job.billing_concept?.trim() || job.display_code || job.id
}

function buildSecondaryLabel(job: JobListItem): string {
  const client = job.client_name?.trim() || job.client_display_code || job.client_id
  const property = job.property_name?.trim() || job.property_display_code || job.property_id
  return `${client} · ${property}`
}

function AgendaColumn({
  title,
  subtitle,
  jobs,
  emptyText,
  actionId,
  actionLabel,
  onRunKpiAction,
  onOpenJobWorkspace,
}: {
  title: string
  subtitle: string
  jobs: JobListItem[]
  emptyText: string
  actionId: DashboardKpiActionId
  actionLabel: string
  onRunKpiAction: (actionId: DashboardKpiActionId) => void
  onOpenJobWorkspace: (jobId: string) => void
}) {
  return (
    <article className="cc-agenda-card">
      <div className="cc-agenda-card__header">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>

        <button
          type="button"
          className="cc-agenda-card__link"
          onClick={() => onRunKpiAction(actionId)}
        >
          {actionLabel}
        </button>
      </div>

      {jobs.length === 0 ? (
        <div className="empty-state">
          <strong>Sin servicios</strong>
          <p>{emptyText}</p>
        </div>
      ) : (
        <div className="cc-agenda-list">
          {jobs.map((job) => (
            <button
              key={job.id}
              type="button"
              className="cc-agenda-item"
              onClick={() => onOpenJobWorkspace(job.id)}
            >
              <div className="cc-agenda-item__top">
                <div className="cc-agenda-item__title-group">
                  <strong>{buildPrimaryLabel(job)}</strong>
                  <span className="cc-agenda-item__code">{job.display_code || job.id}</span>
                </div>
                <span className="lead-badge">{getDisplayStatusLabel(job.status)}</span>
              </div>

              <p>{buildSecondaryLabel(job)}</p>

              <div className="cc-agenda-item__meta">
                <span>{formatDateEs(job.scheduled_date)}</span>
                <span>Abrir workspace</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </article>
  )
}

export function DashboardAgenda({
  agenda,
  onRunKpiAction,
  onOpenJobWorkspace,
}: DashboardAgendaProps) {
  return (
    <section className="cc-dashboard-block cc-dashboard-block--agenda">
      <div className="cc-dashboard-block__header cc-dashboard-block__header--split">
        <div>
          <h2>Agenda operativa</h2>
          <p>Servicios de hoy, manana y siguientes compromisos en una sola lectura.</p>
        </div>
      </div>

      <div className="cc-dashboard-agenda">
        <AgendaColumn
          title="Hoy"
          subtitle={`${agenda.todayJobs.length} servicio${agenda.todayJobs.length === 1 ? '' : 's'} programado${agenda.todayJobs.length === 1 ? '' : 's'}`}
          jobs={agenda.todayJobs}
          emptyText="No hay servicios programados para hoy."
          actionId="jobs_today"
          actionLabel="Ver hoy"
          onRunKpiAction={onRunKpiAction}
          onOpenJobWorkspace={onOpenJobWorkspace}
        />
        <AgendaColumn
          title="Manana"
          subtitle={`${agenda.tomorrowJobs.length} servicio${agenda.tomorrowJobs.length === 1 ? '' : 's'} previstos`}
          jobs={agenda.tomorrowJobs}
          emptyText="No hay servicios programados para manana."
          actionId="jobs_tomorrow"
          actionLabel="Ver manana"
          onRunKpiAction={onRunKpiAction}
          onOpenJobWorkspace={onOpenJobWorkspace}
        />
        <AgendaColumn
          title="Proximos"
          subtitle={`${agenda.upcomingJobs.length} servicio${agenda.upcomingJobs.length === 1 ? '' : 's'} siguientes`}
          jobs={agenda.upcomingJobs}
          emptyText="No hay mas servicios proximos en agenda."
          actionId="jobs_upcoming"
          actionLabel="Ver agenda"
          onRunKpiAction={onRunKpiAction}
          onOpenJobWorkspace={onOpenJobWorkspace}
        />
      </div>
    </section>
  )
}
