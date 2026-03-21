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
        job.client_display_code,
        job.client_id,
        job.property_display_code,
        job.property_id,
        job.quote_display_code,
        job.quote_id,
        job.service_type,
        getServiceTypeLabel(job.service_type),
        job.status,
        getDisplayStatusLabel(job.status),
        job.scheduled_date,
        job.notes,
      ]),
    )
  }, [jobs, searchQuery])

  return (
    <section className="data-section">
      <div className="section-header">
        <h2>Servicios</h2>
        <p>Listado conectado a Supabase.</p>
      </div>

      <SearchBar
        label="Buscar servicio"
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Código, cliente, propiedad, presupuesto, tipo, estado o fecha"
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
        <div className="lead-list">
          {filteredJobs.map((job) => {
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
                  <span className="lead-badge">{getDisplayStatusLabel(job.status)}</span>
                </div>

                <p>Cliente: {job.client_display_code ?? job.client_id}</p>
                <p>Propiedad: {job.property_display_code ?? job.property_id}</p>
                <p>Fecha: {formatDateEs(job.scheduled_date)}</p>
                <p>Tipo: {getServiceTypeLabel(job.service_type)}</p>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
