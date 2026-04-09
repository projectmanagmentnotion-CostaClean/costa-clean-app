import { useMemo, useState } from 'react'
import { SearchBar } from '../../components/SearchBar'
import { formatDateEs, getDisplayStatusLabel, getServiceTypeLabel } from '../../app/displayFormat'
import { matchesSearchQuery } from '../documents/search'
import type { JobListItem } from './types'

interface JobsListProps {
  jobs: JobListItem[]
  error: string | null
  selectedJobId: string | null
  onSelectJob: (job: JobListItem) => void
}

function getJobPrimaryReference(job: JobListItem): string {
  return job.billing_concept?.trim() || getServiceTypeLabel(job.service_type)
}

export function JobsList({
  jobs,
  error,
  selectedJobId,
  onSelectJob,
}: JobsListProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) =>
      matchesSearchQuery(searchQuery, [
        job.display_code,
        job.id,
        job.client_name,
        job.client_display_code,
        job.client_id,
        job.property_name,
        job.property_display_code,
        job.property_id,
        job.quote_display_code,
        job.quote_id,
        job.service_type,
        getServiceTypeLabel(job.service_type),
        job.billing_concept,
        job.status,
        getDisplayStatusLabel(job.status),
        job.scheduled_date,
        job.notes,
      ]),
    )
  }, [jobs, searchQuery])

  return (
    <section className="data-section cc-module-list-section">
      <div className="section-header cc-list-section__header">
        <div>
          <h2>Servicios</h2>
          <p>Planificacion operativa, ejecucion y facturacion vinculada.</p>
        </div>
      </div>

      <SearchBar
        label="Buscar servicio"
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Servicio, cliente, propiedad, código interno, estado o fecha"
        resultCount={filteredJobs.length}
        totalCount={jobs.length}
      />

      {error ? (
        <div className="empty-state">
          <strong>Error cargando servicios</strong>
          <p>{error}</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="empty-state">
          <strong>No hay servicios</strong>
          <p>Todavía no existen registros en la tabla jobs.</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="empty-state">
          <strong>Sin resultados</strong>
          <p>No encontramos servicios que coincidan con tu búsqueda.</p>
        </div>
      ) : (
        <div className="lead-list cc-record-list cc-bounded-list">
          {filteredJobs.map((job) => {
            const isSelected = job.id === selectedJobId

            return (
              <button
                key={job.id}
                type="button"
                className={
                  isSelected
                    ? 'lead-item lead-item-button selected cc-record-card cc-record-card--job'
                    : 'lead-item lead-item-button cc-record-card cc-record-card--job'
                }
                onClick={() => onSelectJob(job)}
              >
                <div className="cc-record-card__head">
                  <div className="cc-record-card__identity">
                    <strong className="cc-record-card__title">{getJobPrimaryReference(job)}</strong>
                    <span className="cc-record-card__subref">Interno {job.display_code ?? job.id}</span>
                  </div>

                  <div className="cc-record-card__aside">
                    <span className="lead-badge">{getDisplayStatusLabel(job.status)}</span>
                    <strong className="cc-record-card__meta-emphasis">{formatDateEs(job.scheduled_date)}</strong>
                  </div>
                </div>

                <p className="cc-record-card__summary">
                  {(job.client_name ?? job.client_display_code ?? job.client_id)} · {(job.property_name ?? job.property_display_code ?? job.property_id)}
                </p>

                <div className="cc-list-meta cc-record-card__meta">
                  <span>{getServiceTypeLabel(job.service_type)}</span>
                  <span>{job.quote_display_code ?? job.quote_id ?? 'Sin presupuesto'}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
