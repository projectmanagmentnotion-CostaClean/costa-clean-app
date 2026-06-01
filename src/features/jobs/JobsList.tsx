import { useMemo, useState } from 'react'
import { formatClientLabel } from '../../app/relationshipLabels'
import { ListToolbar, type ListPreferences } from '../../components/ListToolbar'
import { formatDateEs, getDisplayStatusLabel, getServiceTypeLabel } from '../../app/displayFormat'
import { matchesSearchQuery } from '../documents/search'
import type { JobListItem } from './types'
import { applySortDirection, compareDate, compareText, createDefaultPreferences } from '../lists/listPreferences'

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
  const defaultPreferences = useMemo(() => createDefaultPreferences('scheduled_date', 'asc', { status: 'all' }), [])
  const [preferences, setPreferences] = useState<ListPreferences>(defaultPreferences)

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) =>
      (preferences.filters.status === 'all' || job.status === preferences.filters.status) &&
      matchesSearchQuery(preferences.searchQuery, [
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
    ).sort((left, right) => {
      const comparison = preferences.sortField === 'code'
        ? compareText(left.display_code ?? left.id, right.display_code ?? right.id)
        : preferences.sortField === 'client'
          ? compareText(formatClientLabel(left), formatClientLabel(right))
          : preferences.sortField === 'service'
            ? compareText(getJobPrimaryReference(left), getJobPrimaryReference(right))
            : preferences.sortField === 'status'
              ? compareText(getDisplayStatusLabel(left.status), getDisplayStatusLabel(right.status))
              : compareDate(left.scheduled_date, right.scheduled_date)
      return applySortDirection(comparison, preferences.sortDirection)
    })
  }, [jobs, preferences])

  return (
    <section className="data-section cc-module-list-section">
      <div className="section-header cc-list-section__header">
        <div>
          <h2>Servicios</h2>
          <p>Planificacion operativa, ejecucion y facturacion vinculada.</p>
        </div>
      </div>

      <ListToolbar
        storageKey="costaclean-list-preferences-jobs"
        searchLabel="Buscar servicio"
        searchPlaceholder="Servicio, cliente, propiedad, codigo interno, estado o fecha"
        resultCount={filteredJobs.length}
        totalCount={jobs.length}
        sortOptions={[
          { value: 'scheduled_date', label: 'Fecha programada' },
          { value: 'code', label: 'Codigo' },
          { value: 'client', label: 'Cliente' },
          { value: 'service', label: 'Servicio' },
          { value: 'status', label: 'Estado' },
        ]}
        defaultPreferences={defaultPreferences}
        filters={[{
          key: 'status',
          label: 'Estado',
          value: preferences.filters.status ?? 'all',
          options: [
            { value: 'all', label: 'Todos' },
            { value: 'scheduled', label: 'Programado' },
            { value: 'in_progress', label: 'En curso' },
            { value: 'completed', label: 'Completado' },
            { value: 'cancelled', label: 'Cancelado' },
          ],
        }]}
        onChange={setPreferences}
      />

      {error ? (
        <div className="empty-state">
          <strong>Error cargando servicios</strong>
          <p>{error}</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="empty-state">
          <strong>No hay servicios</strong>
          <p>Todavia no existen registros en la tabla jobs.</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="empty-state">
          <strong>Sin resultados</strong>
          <p>No encontramos servicios que coincidan con tu busqueda.</p>
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
                  {formatClientLabel(job)} - {(job.property_name ?? job.property_display_code ?? job.property_id)}
                </p>

                <div className="cc-record-card__chips" aria-label="Contexto del servicio">
                  <span className="cc-record-card__chip">{getServiceTypeLabel(job.service_type)}</span>
                  <span className="cc-record-card__chip">{job.quote_display_code ?? job.quote_id ?? 'Sin presupuesto'}</span>
                </div>

                <div className="cc-list-meta cc-record-card__meta">
                  <span>
                    <span className="cc-record-card__meta-label">Servicio</span>
                    <span className="cc-record-card__meta-value">{getServiceTypeLabel(job.service_type)}</span>
                  </span>
                  <span>
                    <span className="cc-record-card__meta-label">Origen</span>
                    <span className="cc-record-card__meta-value">{job.quote_display_code ?? job.quote_id ?? 'Sin presupuesto'}</span>
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
