import type { JobListItem } from './types'

interface JobsListProps {
  jobs: JobListItem[]
  error: string | null
  selectedJobId: string | null
  onSelectJob: (job: JobListItem) => void
}

export function JobsList({
  jobs,
  error,
  selectedJobId,
  onSelectJob,
}: JobsListProps) {
  return (
    <section className="data-section">
      <div className="section-header">
        <h2>Jobs reales</h2>
        <p>Primer listado conectado a Supabase.</p>
      </div>

      {error ? (
        <div className="empty-state">
          <strong>Error cargando jobs</strong>
          <p>{error}</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="empty-state">
          <strong>No hay jobs</strong>
          <p>Todavía no existen registros en la tabla jobs.</p>
        </div>
      ) : (
        <div className="lead-list">
          {jobs.map((job) => {
            const isSelected = job.id === selectedJobId

            return (
              <button
                key={job.id}
                type="button"
                className={
                  isSelected
                    ? 'lead-item lead-item-button selected'
                    : 'lead-item lead-item-button'
                }
                onClick={() => onSelectJob(job)}
              >
                <div className="lead-item-top">
                  <strong>{job.display_code ?? job.id}</strong>
                  <span className="lead-badge">{job.status}</span>
                </div>

                <p>Client: {job.client_display_code ?? job.client_id}</p>
                <p>Property: {job.property_display_code ?? job.property_id}</p>
                <p>Fecha: {job.scheduled_date}</p>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
