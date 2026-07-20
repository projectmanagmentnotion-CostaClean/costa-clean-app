import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { ModuleFilterBar } from '../components/ModuleFilterBar'
import { ActionFlowOverlay } from '../components/ActionFlowOverlay'
import { DeferredContentFallback } from '../components/DeferredContentFallback'
import { ExecutiveHeader } from '../components/ExecutiveHeader'
import { DuplicateNotice } from '../features/duplicates/DuplicateNotice'
import { useDuplicateResolution } from '../features/duplicates/duplicateResolution'
import { DuplicateReviewOverlay } from '../features/duplicates/DuplicateReviewOverlay'
import { buildJobDuplicateGroups } from '../features/duplicates/duplicateEngine'
import type { NavigationGuard } from '../app/navigationGuard'
import type { ClientWorkspaceTab } from '../features/clients/useClientWorkspaceNavigation'
import type { PropertyWorkspaceTab } from '../features/properties/usePropertyWorkspaceNavigation'
import { JobsList } from '../features/jobs/JobsList'
import { JobWorkspace } from '../features/jobs/JobWorkspace'
import { buildJobCreatePrefillFromJob, type JobCreatePrefill } from '../features/jobs/jobCreatePrefill'
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
import '../features/jobs/jobsOperations.css'

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
  const today = new Date().toISOString().slice(0, 10)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [localCreatePrefill, setLocalCreatePrefill] = useState<JobCreatePrefill | null>(null)
  const [recentCreatedJob, setRecentCreatedJob] = useState<JobListItem | null>(null)
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
  const effectiveCreatePrefill = localCreatePrefill ?? createPrefill
  const isCreateFormVisible = showCreateForm || Boolean(effectiveCreatePrefill)
  const hasPendingWork = hasCreateFormDirty || hasPendingWorkspaceState
  const todayJobs = useMemo(
    () => jobs.filter((job) => job.scheduled_date === today && job.status !== 'cancelled'),
    [jobs, today],
  )
  const pendingJobs = useMemo(
    () => jobs.filter((job) => job.status === 'scheduled' || job.status === 'pending' || job.status === 'in_progress'),
    [jobs],
  )
  const upcomingJobs = useMemo(
    () => pendingJobs.filter((job) => job.status !== 'cancelled' && job.scheduled_date >= today),
    [pendingJobs, today],
  )
  const reviewJobs = useMemo(
    () => pendingJobs.filter((job) => job.scheduled_date < today),
    [pendingJobs, today],
  )

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
    setLocalCreatePrefill(null)
    setShowCreateForm(false)
    setHasCreateFormDirty(false)
  }

  function handleOpenWorkspace(jobId: string, tab: JobWorkspaceTab = 'summary') {
    runGuarded(() => {
      setShowCreateForm(false)
      setRecentCreatedJob(null)
      setLocalCreatePrefill(null)
      onPrefillConsumed()
      openJobWorkspace(jobId, tab)
    })
  }

  return (
    <section className="page-section cc-master-page">
      {!activeJob ? (
        <>
          <ExecutiveHeader
            eyebrow="Agenda y ejecucion"
            title="Servicios"
            summary="Que toca hoy y que viene despues, con cliente e inmueble visibles."
            statusLabel={reviewJobs.length > 0
              ? `${reviewJobs.length} por revisar`
              : todayJobs.length > 0
                ? `${todayJobs.length} hoy`
                : `${upcomingJobs.length} proximos`}
            statusTone={reviewJobs.length > 0 ? 'warning' : todayJobs.length > 0 ? 'info' : 'success'}
            primaryAction={{
              label: isCreateFormVisible ? 'Cerrar alta' : 'Registrar servicio',
              onClick: () => {
                if (isCreateFormVisible) {
                  runGuarded(() => {
                    setShowCreateForm(false)
                    setRecentCreatedJob(null)
                    setLocalCreatePrefill(null)
                    onPrefillConsumed()
                  })
                  return
                }

                setRecentCreatedJob(null)
                setShowCreateForm(true)
              },
            }}
          />

          {recentCreatedJob ? (
            <section className="data-section cc-list-section__header">
              <div>
                <h2>Servicio creado</h2>
                <p>{`Se ha guardado ${recentCreatedJob.display_code ?? recentCreatedJob.id}. Puedes abrirlo ahora o seguir registrando agenda.`}</p>
              </div>
              <div className="page-header-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => handleOpenWorkspace(recentCreatedJob.id)}
                >
                  Abrir servicio
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setRecentCreatedJob(null)}
                >
                  Seguir
                </button>
              </div>
            </section>
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
                  setLocalCreatePrefill(null)
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
                  prefill={effectiveCreatePrefill}
                  onCreatedJob={async (createdJob) => {
                    setRecentCreatedJob(createdJob)
                  }}
                  onOpenExistingJob={(jobId) => {
                    setHasCreateFormDirty(false)
                    setShowCreateForm(false)
                    setLocalCreatePrefill(null)
                    onPrefillConsumed()
                    handleOpenWorkspace(jobId)
                  }}
                  onCancel={() => {
                    setHasCreateFormDirty(false)
                    setShowCreateForm(false)
                    setLocalCreatePrefill(null)
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

          <JobsList
            jobs={jobs}
            error={error}
            selectedJobId={null}
            onOpenQuoteDetail={onOpenQuoteDetail}
            onOpenInvoiceDetail={onOpenInvoiceDetail}
            onSelectJob={(job) => handleOpenWorkspace(job.id)}
            onCreateJob={() => setShowCreateForm(true)}
          />

          <section className="cc-recurring-service-readiness" data-qa="recurring-service-section">
            <div className="cc-recurring-service-readiness__copy">
              <span>Servicios recurrentes</span>
              <strong>Planificacion recurrente pendiente de contrato</strong>
              <p>La app permite programar cada servicio, pero todavia no existe un modelo seguro para generar visitas recurrentes. La automatizacion de facturas es independiente.</p>
            </div>
            <button type="button" className="secondary-button" data-qa="recurring-service-disabled-action" disabled>
              Crear recurrencia no disponible
            </button>
          </section>

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
            onCreateSimilarJob={(targetJob) => {
              const prefill = buildJobCreatePrefillFromJob(targetJob)
              if (!prefill) return
              setLocalCreatePrefill(prefill)
              setHasPendingWorkspaceState(false)
              closeJobWorkspace()
              setShowCreateForm(true)
            }}
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
