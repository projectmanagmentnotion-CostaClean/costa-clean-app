import { useMemo, useState } from 'react'
import { formatClientLabel, formatPropertyLabel, formatQuoteLabel } from '../../app/relationshipLabels'
import { ListToolbar, type ListPreferences } from '../../components/ListToolbar'
import { DSEmptyState } from '../../design-system/components/DSEmptyState'
import { DSErrorState } from '../../design-system/components/DSErrorState'
import { formatDateEs, getServiceTypeLabel } from '../../app/displayFormat'
import type { JobListItem } from './types'
import { getJobBillingDisplayConcept } from './jobBilling'
import { applySortDirection, compareDate, compareText, createDefaultPreferences } from '../lists/listPreferences'
import { applyTextSearch } from '../lists/utils'
import { OperationalListItem } from '../../components/OperationalListItem'
import { isArchivedEntity, isCancelledEntity, isDeletedEntity } from '../../shared/lifecycle/entityLifecycle'
import { getJobOperationalStatus, isUpcomingJob } from './jobOperationalState'

interface JobsListProps {
  jobs: JobListItem[]
  error: string | null
  selectedJobId: string | null
  onSelectJob: (job: JobListItem) => void
  onOpenQuoteDetail?: (quoteId: string) => void
  onOpenInvoiceDetail?: (invoiceId: string) => void
  onCreateJob?: () => void
}

interface JobDirectorySection {
  key: string
  label: string
  description: string
  items: JobListItem[]
}

function getJobPrimaryReference(job: JobListItem): string {
  return getJobBillingDisplayConcept(job) || getServiceTypeLabel(job.service_type)
}

function getJobDirectoryBucket(job: JobListItem, today: string) {
  if (job.status === 'completed' && !job.invoice_id) return 'review'
  if (job.status === 'cancelled' || isArchivedEntity(job) || isDeletedEntity(job)) return 'history'
  if (job.scheduled_date === today) return 'today'
  if (job.scheduled_date > today) return 'upcoming'
  return 'history'
}

export function JobsList({
  jobs,
  error,
  selectedJobId,
  onSelectJob,
  onOpenQuoteDetail,
  onOpenInvoiceDetail,
  onCreateJob,
}: JobsListProps) {
  const today = new Date().toISOString().slice(0, 10)
  const defaultPreferences = useMemo(() => createDefaultPreferences('scheduled_date', 'asc', { status: 'upcoming' }), [])
  const [preferences, setPreferences] = useState<ListPreferences>(defaultPreferences)

  const filteredJobs = useMemo(() => {
    const lifecycleFilter = preferences.filters.status ?? 'active'
    return jobs.filter((job) =>
      (() => {
        const archived = isArchivedEntity(job)
        const deleted = isDeletedEntity(job)
        const cancelled = isCancelledEntity(job)
        const active = !archived && !deleted && !cancelled
        const isToday = job.scheduled_date === today
        const isPending = job.status === 'scheduled' || job.status === 'pending'
        const hasAlert = active && (
          (job.status === 'completed' && !job.invoice_id) ||
          (job.scheduled_date < today && (job.status === 'scheduled' || job.status === 'pending' || job.status === 'in_progress'))
        )

        if (lifecycleFilter === 'all') return true
        if (lifecycleFilter === 'active') return active
        if (lifecycleFilter === 'upcoming') return active && isUpcomingJob(job, today)
        if (lifecycleFilter === 'today') return active && isToday
        if (lifecycleFilter === 'pending') return active && isPending
        if (lifecycleFilter === 'alert') return hasAlert
        if (lifecycleFilter === 'uninvoiced') return active && job.status === 'completed' && !job.invoice_id
        if (lifecycleFilter === 'cancelled') return cancelled && !deleted
        if (lifecycleFilter === 'archived') return archived && !deleted
        return job.status === lifecycleFilter
      })() &&
      applyTextSearch(preferences.searchQuery, [
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
        getJobOperationalStatus(job, today).label,
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
              ? compareText(getJobOperationalStatus(left, today).label, getJobOperationalStatus(right, today).label)
              : compareDate(left.scheduled_date, right.scheduled_date)
      return applySortDirection(comparison, preferences.sortDirection)
    })
  }, [jobs, preferences, today])

  const directorySections = useMemo<JobDirectorySection[]>(() => {
    const buckets: Record<string, JobDirectorySection> = {
      review: {
        key: 'review',
        label: 'Revisión',
        description: 'Servicios completados que todavía requieren cierre financiero.',
        items: [],
      },
      today: {
        key: 'today',
        label: 'Hoy',
        description: 'Servicios en ejecución o de salida inmediata.',
        items: [],
      },
      upcoming: {
        key: 'upcoming',
        label: 'Próximos',
        description: 'Agenda futura todavía abierta.',
        items: [],
      },
      history: {
        key: 'history',
        label: 'Histórico',
        description: 'Servicios pasados, cancelados o archivados.',
        items: [],
      },
    }

    filteredJobs.forEach((job) => {
      buckets[getJobDirectoryBucket(job, today)].items.push(job)
    })

    return Object.values(buckets).filter((section) => section.items.length > 0)
  }, [filteredJobs, today])

  return (
    <section className="cc-module-list-section cc-jobs-list-shell">
      <div className="section-header cc-list-section__header">
        <div>
          <h2>Proximos servicios</h2>
          <p>Agenda ordenada por fecha, con cliente e inmueble en una sola lectura.</p>
        </div>
      </div>

      <ListToolbar
        storageKey="costaclean-list-preferences-jobs-v2"
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
                { value: 'upcoming', label: 'Proximos' },
                { value: 'active', label: 'Activos' },
                { value: 'today', label: 'Hoy' },
                { value: 'pending', label: 'Pendientes' },
                { value: 'in_progress', label: 'En curso' },
                { value: 'completed', label: 'Completados' },
                { value: 'alert', label: 'Con alerta' },
                { value: 'uninvoiced', label: 'Sin facturar' },
                { value: 'cancelled', label: 'Cancelado' },
                { value: 'archived', label: 'Archivados' },
              ],
        }]}
        onChange={setPreferences}
      />

      {error ? (
        <DSErrorState title="Error cargando servicios" description={error} />
      ) : jobs.length === 0 ? (
        <DSEmptyState
          title="No hay servicios"
          description="Registra el primer servicio para empezar a construir la agenda operativa."
          action={onCreateJob ? <button type="button" className="primary-button" onClick={onCreateJob}>Registrar servicio</button> : undefined}
        />
      ) : filteredJobs.length === 0 ? (
        <DSEmptyState
          title={preferences.filters.status === 'upcoming' ? 'Sin proximos servicios' : 'Sin resultados'}
          description={preferences.filters.status === 'upcoming'
            ? 'No hay visitas futuras abiertas. Puedes registrar una nueva o cambiar el filtro para revisar el historico.'
            : 'No encontramos servicios que coincidan con tu busqueda y filtros activos.'}
          action={onCreateJob ? <button type="button" className="primary-button" onClick={onCreateJob}>Registrar servicio</button> : undefined}
        />
      ) : (
        <div className="cc-jobs-directory" aria-label="Lista de servicios">
          {directorySections.map((section) => (
            <section key={section.key} className="cc-jobs-directory__section">
              <header className="cc-jobs-directory__section-header">
                <div className="cc-jobs-directory__section-copy">
                  <span>{section.label}</span>
                  <strong>{section.items.length} servicio{section.items.length === 1 ? '' : 's'}</strong>
                  <p>{section.description}</p>
                </div>
              </header>

              <div className="cc-operational-list cc-bounded-list cc-jobs-directory__rows" role="listbox">
                {section.items.map((job) => {
                  const isSelected = job.id === selectedJobId
                  const operationalStatus = getJobOperationalStatus(job, today)
                  const propertyLabel = formatPropertyLabel({ id: job.property_id, display_code: job.property_display_code, name: job.property_name })
                  const clientLabel = formatClientLabel(job)
                  const quoteLabel = job.quote_id
                    ? formatQuoteLabel({ id: job.quote_id, display_code: job.quote_display_code, client_name: job.client_name, property_name: job.property_name })
                    : 'Sin presupuesto'

                  return (
                    <OperationalListItem
                      key={job.id}
                      dataQa="job-list-item"
                      selected={isSelected}
                      onSelect={() => onSelectJob(job)}
                      title={propertyLabel}
                      subtitle={clientLabel}
                      status={<span className="lead-badge" data-operational-state={operationalStatus.state}>{operationalStatus.label}</span>}
                      aside={<strong className="cc-record-card__meta-emphasis">{formatDateEs(job.scheduled_date)}</strong>}
                      summary={getJobPrimaryReference(job)}
                      chips={[
                        getServiceTypeLabel(job.service_type),
                        quoteLabel,
                      ]}
                      meta={[
                        { label: 'Cliente', value: clientLabel },
                        { label: 'Origen', value: quoteLabel },
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
                      microhint={operationalStatus.state === 'review'
                        ? 'Requiere revision operativa'
                        : job.status === 'completed' && !job.invoice_id
                          ? 'Listo para facturar'
                          : 'Servicio vinculado a cliente y propiedad'}
                    />
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  )
}
