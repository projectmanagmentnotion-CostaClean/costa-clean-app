import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { ModuleFilterBar } from '../components/ModuleFilterBar'
import { ActionFlowOverlay } from '../components/ActionFlowOverlay'
import { DeferredContentFallback } from '../components/DeferredContentFallback'
import { DuplicateNotice } from '../features/duplicates/DuplicateNotice'
import { useDuplicateResolution } from '../features/duplicates/duplicateResolution'
import { DuplicateReviewOverlay } from '../features/duplicates/DuplicateReviewOverlay'
import { buildJobDuplicateGroups } from '../features/duplicates/duplicateEngine'
import type { NavigationGuard } from '../app/navigationGuard'
import type { ClientWorkspaceTab } from '../features/clients/useClientWorkspaceNavigation'
import type { PropertyWorkspaceTab } from '../features/properties/usePropertyWorkspaceNavigation'
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

const LazyJobCreateFlow = lazy(async () => ({
  default: (await import('../features/jobs/JobCreateFlow')).JobCreateFlow,
}))

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
  const [hasCreateFormDirty, setHasCreateFormDirty] = useState(false)
  const [hasPendingWorkspaceState, setHasPendingWorkspaceState] = useState(false)
  const [showDuplicateReview, setShowDuplicateReview] = useState(false)
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
  const rawDuplicateGroups = useMemo(() => buildJobDuplicateGroups(jobs), [jobs])
  const {
    visibleGroups: duplicateGroups,
    reviewStateByGroupId,
    markReviewed,
    ignoreGroup,
    reopenGroup,
  } = useDuplicateResolution(rawDuplicateGroups)
  const activeJobDuplicateGroups = useMemo(
    () => activeJob
      ? duplicateGroups.filter((group) => group.records.some((record) => record.recordId === activeJob.id))
      : [],
    [activeJob, duplicateGroups],
  )
  const activeJobImportantDuplicateGroups = useMemo(
    () => activeJobDuplicateGroups.filter((group) => group.severity === 'exact' || group.severity === 'strong'),
    [activeJobDuplicateGroups],
  )
  const isCreateFormVisible = showCreateForm || Boolean(createPrefill)
  const hasPendingWork = hasCreateFormDirty || hasPendingWorkspaceState

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

  async function handleJobFlowCompleted() {
    onPrefillConsumed()
    setShowCreateForm(false)
    setHasCreateFormDirty(false)
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

          {duplicateGroups.length > 0 ? (
            <DuplicateNotice
              title={`${duplicateGroups.length} grupo(s) de posibles servicios duplicados`}
              description="Se han detectado coincidencias operativas por cliente, propiedad, fecha y tipo de servicio. Revísalas sin ensuciar la agenda principal."
              actionLabel="Revisar duplicados"
              onAction={() => setShowDuplicateReview(true)}
            />
          ) : null}

          {isCreateFormVisible ? (
            <ActionFlowOverlay
              isOpen={isCreateFormVisible}
              title="Nuevo servicio"
              description="Planifica el servicio en un flujo dedicado. Al cerrar volveras al mismo contexto operativo."
              onClose={() => {
                runGuarded(() => {
                  setHasCreateFormDirty(false)
                  setShowCreateForm(false)
                  onPrefillConsumed()
                })
              }}
            >
              <Suspense
                fallback={(
                  <DeferredContentFallback
                    title="Cargando flujo de servicio"
                    description="Preparando el alta operativa completa."
                  />
                )}
              >
                <LazyJobCreateFlow
                  clients={clients}
                  properties={properties}
                  quotes={quotes}
                  jobs={jobs}
                  onRefreshData={onJobCreated}
                  onCompleted={handleJobFlowCompleted}
                  prefill={createPrefill}
                  onOpenExistingJob={(jobId) => {
                    setHasCreateFormDirty(false)
                    setShowCreateForm(false)
                    onPrefillConsumed()
                    handleOpenWorkspace(jobId)
                  }}
                  onCancel={() => {
                    setHasCreateFormDirty(false)
                    setShowCreateForm(false)
                    onPrefillConsumed()
                  }}
                  onDirtyChange={setHasCreateFormDirty}
                />
              </Suspense>
            </ActionFlowOverlay>
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

          <DuplicateReviewOverlay
            isOpen={showDuplicateReview}
            title="Revisión de servicios duplicados"
            description="Estas coincidencias ya existen en la agenda operativa. Úsalas para evitar dobles programaciones o servicios repetidos."
            groups={duplicateGroups}
            reviewStateByGroupId={reviewStateByGroupId}
            onMarkReviewed={markReviewed}
            onIgnoreGroup={ignoreGroup}
            onReopenGroup={reopenGroup}
            onClose={() => setShowDuplicateReview(false)}
            onOpenRecord={(jobId) => {
              setShowDuplicateReview(false)
              handleOpenWorkspace(jobId)
            }}
          />
        </>
      ) : (
        <>
          {activeJobImportantDuplicateGroups.length > 0 ? (
            <DuplicateNotice
              title={`${activeJobImportantDuplicateGroups.length} coincidencia(s) importante(s) en este servicio`}
              description="El servicio activo se parece demasiado a otra programacion ya existente."
              actionLabel="Revisar coincidencias"
              onAction={() => setShowDuplicateReview(true)}
            />
          ) : null}

          <JobWorkspace
            job={activeJob}
            allJobs={jobs}
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

          <DuplicateReviewOverlay
            isOpen={showDuplicateReview}
            title="Coincidencias de este servicio"
            description="Estas coincidencias afectan al servicio activo. Puedes revisarlas y dejar trazabilidad minima sin bloquear la operativa."
            groups={activeJobDuplicateGroups}
            reviewStateByGroupId={reviewStateByGroupId}
            onMarkReviewed={markReviewed}
            onIgnoreGroup={ignoreGroup}
            onReopenGroup={reopenGroup}
            onClose={() => setShowDuplicateReview(false)}
          />
        </>
      )}
    </section>
  )
}
