import { useEffect, useState } from 'react'
import { JobCreateForm } from '../features/jobs/JobCreateForm'
import { JobDetailCard } from '../features/jobs/JobDetailCard'
import { JobsList } from '../features/jobs/JobsList'
import type { JobListItem } from '../features/jobs/types'
import type { ClientListItem } from '../features/clients/types'
import type { PropertyListItem } from '../features/properties/types'
import type { QuoteListItem } from '../features/quotes/types'

interface JobsPageProps {
  jobs: JobListItem[]
  clients: ClientListItem[]
  properties: PropertyListItem[]
  quotes: QuoteListItem[]
  error: string | null
  onJobCreated: () => Promise<void>
}

export function JobsPage({
  jobs,
  clients,
  properties,
  quotes,
  error,
  onJobCreated,
}: JobsPageProps) {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)

  useEffect(() => {
    if (jobs.length === 0) {
      setSelectedJobId(null)
      return
    }

    const selectedStillExists = jobs.some(
      (job) => job.id === selectedJobId,
    )

    if (!selectedStillExists) {
      setSelectedJobId(jobs[0].id)
    }
  }, [jobs, selectedJobId])

  const selectedJob =
    jobs.find((job) => job.id === selectedJobId) ?? null

  return (
    <section className="page-section">
      <div className="section-header page-header-actions">
        <div>
          <h1>Servicios</h1>
          <p>Gestiona trabajos programados, estado operativo y relación con cliente, propiedad o presupuesto.</p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={() => setShowCreateForm((current) => !current)}
        >
          {showCreateForm ? 'Cerrar formulario' : 'Nuevo servicio'}
        </button>
      </div>

      {showCreateForm ? (
        <JobCreateForm
          clients={clients}
          properties={properties}
          quotes={quotes}
          onCreated={onJobCreated}
        />
      ) : null}

      <JobDetailCard
        job={selectedJob}
        clients={clients}
        properties={properties}
        quotes={quotes}
        onJobUpdated={onJobCreated}
      />

      <JobsList
        jobs={jobs}
        error={error}
        selectedJobId={selectedJobId}
        onSelectJob={(job) => setSelectedJobId(job.id)}
      />
    </section>
  )
}
