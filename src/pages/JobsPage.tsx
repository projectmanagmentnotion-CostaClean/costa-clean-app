import { useEffect, useMemo, useState } from 'react'
import { ModuleFilterBar } from '../components/ModuleFilterBar'
import type { NavigationGuard } from '../app/navigationGuard'
import type { ClientWorkspaceTab } from '../features/clients/useClientWorkspaceNavigation'
import type { PropertyWorkspaceTab } from '../features/properties/usePropertyWorkspaceNavigation'
import { JobCreateForm } from '../features/jobs/JobCreateForm'
import { JobsList } from '../features/jobs/JobsList'
import { JobWorkspace } from '../features/jobs/JobWorkspace'
import type { JobCreatePrefill } from '../features/jobs/jobCreatePrefill'
import type { JobListItem } from '../features/jobs/types'
import {
  useJobWorkspaceNavigation,
  type JobWorkspaceTab,
} from '../features/jobs/useJobWorkspaceNavigation'
import type { ClientListItem } from '../features/clients/types'
import type { InvoiceListItem } from '../features/invoices/types'
import type { PaymentListItem } from '../features/payments/types'
import type { PropertyListItem } from '../features/properties/types'
import type { QuoteListItem } from '../features/quotes/types'

interface JobsPageProps {
  jobs: JobListItem[]
  clients: ClientListItem[]
  properties: PropertyListItem[]
  quotes: QuoteListItem[]
  invoices: InvoiceListItem[]
  payments: PaymentListItem[]
  error: string | null
  onJobCreated: () => Promise<void>
  onOpenClientWorkspace: (clientId: string, tab?: ClientWorkspaceTab) => void
  onOpenPropertyWorkspace: (propertyId: string, tab?: PropertyWorkspaceTab) => void
  onOpenQuoteDetail: (quoteId: string) => void
  onOpenInvoiceDetail: (invoiceId: string) => void
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
  invoices,
  payments,
  error,
  onJobCreated,
  onOpenClientWorkspace,
  onOpenPropertyWorkspace,
  onOpenQuoteDetail,
  onOpenInvoiceDetail,
  createPrefill,
  onPrefillConsumed,
  activeFilterLabel,
  onClearFilter,
  onUnsavedChange,
  confirmNavigation,
}: JobsPageProps) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [hasPendingWorkspaceState, setHasPendingWorkspaceState] = useState(false)
  const {
    activeJobId,
    activeTab,
    openJobWorkspace,
    closeJobWorkspace,
    setActiveTab,
  } = useJobWorkspaceNavigation(jobs.map((job) => job.id))

  const activeJob = useMemo(
    () => jobs.find((job) => job.id === activeJobId) ?? null,
    [activeJobId, jobs],
  )
  const isCreateFormVisible = showCreateForm || Boolean(createPrefill)
  const hasPendingWork = isCreateFormVisible || hasPendingWorkspaceState

  useEffect(() => {
    onUnsavedChange?.(hasPendingWork, 'cambios sin guardar en servicios')
    return () => onUnsavedChange?.(false)
  }, [hasPendingWork, onUnsavedChange])

  function runGuarded(action: () => void) {
    if (!hasPendingWork || !confirmNavigation) {
      action()
      return
    }

    confirmNavigation(action, {
      description: 'Hay cambios sin guardar en servicios. Si continuas, perderas esos cambios.',
      confirmLabel: 'Continuar',
    })
  }

  async function handleJobCreated() {
    await onJobCreated()
    onPrefillConsumed()
    setShowCreateForm(false)
  }

  function handleOpenWorkspace(jobId: string, tab: JobWorkspaceTab = 'summary') {
    runGuarded(() => {
      setShowCreateForm(false)
      onPrefillConsumed()
      openJobWorkspace(jobId, tab)
    })
  }

  return (
    <section className="page-section cc-master-page">
      {!activeJob ? (
        <>
          <div className="section-header page-header-actions cc-master-page__hero">
            <div>
              <h1>Servicios</h1>
              <p>El modulo pasa a workspace operativo real con facturacion, cobro y contexto relacional.</p>
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
              onOpenCreatedJob={(jobId) => handleOpenWorkspace(jobId)}
            />
          ) : null}

          {activeFilterLabel ? (
            <ModuleFilterBar label={activeFilterLabel} onClear={onClearFilter} />
          ) : null}

          <div className="data-section">
            <div className="section-header page-header-actions">
              <div>
                <h2>Agenda y ejecucion de servicios</h2>
                <p>Abre cualquier tarjeta para entrar en su workspace operativo y financiero completo.</p>
              </div>
            </div>

            <JobsList
              jobs={jobs}
              error={error}
              selectedJobId={null}
              onOpenQuoteDetail={onOpenQuoteDetail}
              onOpenInvoiceDetail={onOpenInvoiceDetail}
              onSelectJob={(job) => handleOpenWorkspace(job.id)}
            />
          </div>
        </>
      ) : (
        <JobWorkspace
          job={activeJob}
          clients={clients}
          properties={properties}
          quotes={quotes}
          invoices={invoices}
          payments={payments}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onClose={() => {
            runGuarded(() => {
              setHasPendingWorkspaceState(false)
              closeJobWorkspace()
            })
          }}
          onRefresh={onJobCreated}
          onOpenClientWorkspace={onOpenClientWorkspace}
          onOpenPropertyWorkspace={onOpenPropertyWorkspace}
          onOpenQuoteDetail={onOpenQuoteDetail}
          onOpenInvoiceDetail={onOpenInvoiceDetail}
          onPendingStateChange={setHasPendingWorkspaceState}
        />
      )}
    </section>
  )
}
