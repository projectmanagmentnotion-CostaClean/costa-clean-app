import { useEffect, useState } from 'react'
import { ModuleFilterBar } from '../components/ModuleFilterBar'
import { JobCreateForm } from '../features/jobs/JobCreateForm'
import { JobDetailCard } from '../features/jobs/JobDetailCard'
import { JobsList } from '../features/jobs/JobsList'
import type { JobCreatePrefill } from '../features/jobs/jobCreatePrefill'
import type { JobListItem } from '../features/jobs/types'
import type { ClientListItem } from '../features/clients/types'
import type { PropertyListItem } from '../features/properties/types'
import type { QuoteListItem } from '../features/quotes/types'
import type { NavigationGuard } from '../app/navigationGuard'

interface JobsPageProps {
  jobs: JobListItem[]
  clients: ClientListItem[]
  properties: PropertyListItem[]
  quotes: QuoteListItem[]
  error: string | null
  onJobCreated: () => Promise<void>
  onCreateInvoiceFromJob: (job: JobListItem) => void
  createPrefill: JobCreatePrefill | null
  onPrefillConsumed: () => void
  activeFilterLabel: string | null
  onClearFilter: () => void
  onUnsavedChange?: (hasUnsavedChanges: boolean, contextLabel?: string) => void
  confirmNavigation?: NavigationGuard
}

export function JobsPage({
  jobs,
  clients,
  properties,
  quotes,
  error,
  onJobCreated,
  onCreateInvoiceFromJob,
  createPrefill,
  onPrefillConsumed,
  activeFilterLabel,
  onClearFilter,
  onUnsavedChange,
  confirmNavigation,
}: JobsPageProps) {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [hasUnsavedDetailChanges, setHasUnsavedDetailChanges] = useState(false)

  const selectedJob =
    jobs.find((job) => job.id === selectedJobId) ?? jobs[0] ?? null
  const selectedJobKey = selectedJob?.id ?? null
  const isCreateFormVisible = showCreateForm || Boolean(createPrefill)
  const hasPendingWork = isCreateFormVisible || hasUnsavedDetailChanges

  useEffect(() => {
    onUnsavedChange?.(hasPendingWork, 'cambios sin guardar en servicios')
    return () => onUnsavedChange?.(false)
  }, [hasPendingWork, onUnsavedChange])

  function runGuarded(action: () => void) {
    if (!hasPendingWork) {
      action()
      return
    }

    if (!confirmNavigation) {
      action()
      return
    }

    confirmNavigation(action, {
      description: 'Hay cambios sin guardar en servicios. Si continúas, perderás esos cambios.',
      confirmLabel: 'Continuar',
    })
  }

  async function handleJobCreated() {
    await onJobCreated()
    onPrefillConsumed()
    setShowCreateForm(false)
  }

  return (
    <section className="page-section cc-master-page">
      <div className="section-header page-header-actions cc-master-page__hero">
        <div>
          <h1>Servicios</h1>
          <p>Gestiona trabajos programados, estado operativo y relación con cliente o propiedad.</p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={() => {
            if (isCreateFormVisible) {
              runGuarded(() => {
                setShowCreateForm(false)
                onPrefillConsumed()
              })
              return
            }

            setShowCreateForm(true)
          }}
        >
          {isCreateFormVisible ? 'Cerrar formulario' : 'Nuevo servicio'}
        </button>
      </div>

      {isCreateFormVisible ? (
        <JobCreateForm
          clients={clients}
          properties={properties}
          quotes={quotes}
          onCreated={handleJobCreated}
          prefill={createPrefill}
        />
      ) : null}

      {activeFilterLabel ? (
        <ModuleFilterBar label={activeFilterLabel} onClear={onClearFilter} />
      ) : null}

      <div className="cc-master-layout cc-master-layout--list-first">
        <div className="cc-master-layout__list">
          <JobsList
            jobs={jobs}
            error={error}
            selectedJobId={selectedJobKey}
            onSelectJob={(job) => {
              if (job.id === selectedJobKey) return
              runGuarded(() => setSelectedJobId(job.id))
            }}
          />
        </div>

        <div className="cc-master-layout__detail">
          <JobDetailCard
            job={selectedJob}
            clients={clients}
            properties={properties}
            quotes={quotes}
            onJobUpdated={onJobCreated}
            onCreateInvoiceFromJob={onCreateInvoiceFromJob}
            onUnsavedChange={setHasUnsavedDetailChanges}
          />
        </div>
      </div>
    </section>
  )
}
