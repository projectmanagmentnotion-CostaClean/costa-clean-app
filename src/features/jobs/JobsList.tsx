import { useMemo, useState } from 'react'
import { formatClientLabel, formatJobLabel, formatPropertyLabel, formatQuoteLabel } from '../../app/relationshipLabels'
import { ListToolbar, type ListPreferences } from '../../components/ListToolbar'
import { formatDateEs, getDisplayStatusLabel, getServiceTypeLabel } from '../../app/displayFormat'
import { matchesSearchQuery } from '../documents/search'
import type { JobListItem } from './types'
import { getJobBillingDisplayConcept } from './jobBilling'
import { applySortDirection, compareDate, compareText, createDefaultPreferences } from '../lists/listPreferences'
import { OperationalListItem } from '../../components/OperationalListItem'
import { isArchivedEntity, isCancelledEntity, isDeletedEntity } from '../../shared/lifecycle/entityLifecycle'

interface JobsListProps {
  jobs: JobListItem[]
  error: string | null
  selectedJobId: string | null
  onSelectJob: (job: JobListItem) => void
  onOpenQuoteDetail?: (quoteId: string) => void
  onOpenInvoiceDetail?: (invoiceId: string) => void
}

function getJobPrimaryReference(job: JobListItem): string {
  return getJobBillingDisplayConcept(job) || getServiceTypeLabel(job.service_type)
}

export function JobsList({
  jobs,
  error,
  selectedJobId,
  onSelectJob,
  onOpenQuoteDetail,
  onOpenInvoiceDetail,
}: JobsListProps) {
  const defaultPreferences = useMemo(() => createDefaultPreferences('scheduled_date', 'asc', { status: 'active' }), [])
  const [preferences, setPreferences] = useState<ListPreferences>(defaultPreferences)

  const filteredJobs = useMemo(() => {
    const lifecycleFilter = preferences.filters.status ?? 'active'
    return jobs.filter((job) =>
      (() => {
        const archived = isArchivedEntity(job)
        const deleted = isDeletedEntity(job)
        const cancelled = isCancelledEntity(job)
        const active = !archived && !deleted && !cancelled

        if (lifecycleFilter === 'all') return true
        if (lifecycleFilter === 'active') return active
        if (lifecycleFilter === 'uninvoiced') return active && job.status === 'completed' && !job.invoice_id
        if (lifecycleFilter === 'cancelled') return cancelled && !deleted
        if (lifecycleFilter === 'archived') return archived && !deleted
        return job.status === lifecycleFilter
      })() &&
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
            { value: 'active', label: 'Activos' },
            { value: 'uninvoiced', label: 'Sin facturar' },
            { value: 'scheduled', label: 'Programado' },
            { value: 'in_progress', label: 'En curso' },
            { value: 'completed', label: 'Completado' },
            { value: 'cancelled', label: 'Cancelado' },
            { value: 'archived', label: 'Archivados' },
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
        <div className="cc-operational-list cc-bounded-list" role="listbox" aria-label="Lista de servicios">
          {filteredJobs.map((job) => {
            const isSelected = job.id === selectedJobId

            return (
              <OperationalListItem
                key={job.id}
                selected={isSelected}
                onSelect={() => onSelectJob(job)}
                title={formatJobLabel(job)}
                subtitle={getJobPrimaryReference(job)}
                status={<span className="lead-badge">{getDisplayStatusLabel(job.status)}</span>}
                aside={<strong className="cc-record-card__meta-emphasis">{formatDateEs(job.scheduled_date)}</strong>}
                summary={`${formatClientLabel(job)} - ${formatPropertyLabel({ id: job.property_id, display_code: job.property_display_code, name: job.property_name })}`}
                chips={[
                  getServiceTypeLabel(job.service_type),
                  job.quote_id ? formatQuoteLabel({ id: job.quote_id, display_code: job.quote_display_code, client_name: job.client_name, property_name: job.property_name }) : 'Sin presupuesto',
                ]}
                meta={[
                  { label: 'Servicio', value: getServiceTypeLabel(job.service_type) },
                  { label: 'Origen', value: job.quote_id ? formatQuoteLabel({ id: job.quote_id, display_code: job.quote_display_code, client_name: job.client_name, property_name: job.property_name }) : 'Sin presupuesto' },
                ]}
                actions={[
                  {
                    key: 'open',
                    label: 'Abrir',
                    tone: 'primary',
                    onClick: () => onSelectJob(job),
                  },
                  ...(job.quote_id
                    ? [{
                        key: 'quote',
                        label: 'Presupuesto',
                        onClick: () => onOpenQuoteDetail?.(job.quote_id!),
                      }]
                    : []),
                  ...(job.invoice_id
                    ? [{
                        key: 'invoice',
                        label: 'Factura',
                        onClick: () => onOpenInvoiceDetail?.(job.invoice_id!),
                      }]
                    : []),
                ]}
                microhint={job.invoice_id ? 'Facturacion enlazada' : 'Pendiente de facturar'}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}
