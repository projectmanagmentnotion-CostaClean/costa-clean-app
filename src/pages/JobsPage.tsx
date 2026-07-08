import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { ActionChecklist, type ActionChecklistItem } from '../components/ActionChecklist'
import { ModuleFilterBar } from '../components/ModuleFilterBar'
import { ActionFlowOverlay } from '../components/ActionFlowOverlay'
import { DeferredContentFallback } from '../components/DeferredContentFallback'
import { ExecutiveHeader } from '../components/ExecutiveHeader'
import { VisualKpiCard } from '../components/VisualKpiCard'
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
import { formatCurrency } from '../app/displayFormat'
import {
  useJobWorkspaceNavigation,
  type JobWorkspaceTab,
} from '../features/jobs/useJobWorkspaceNavigation'
import type { ClientListItem } from '../features/clients/types'
import type { InvoiceListItem } from '../features/invoices/types'
import type { PaymentListItem } from '../features/payments/types'
import type { PropertyListItem } from '../features/properties/types'
import type { QuoteListItem } from '../features/quotes/types'
import { compactVisibleItems, hasMeaningfulAmount, hasMeaningfulCount } from '../shared/ui/visibilityRules'

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
    () => jobs.filter((job) => job.status === 'scheduled' || job.status === 'in_progress'),
    [jobs],
  )
  const completedUninvoicedJobs = useMemo(
    () => jobs.filter((job) => job.status === 'completed' && !job.invoice_id),
    [jobs],
  )
  const upcomingJobs = useMemo(
    () => jobs.filter((job) => job.status !== 'cancelled' && job.scheduled_date > today),
    [jobs, today],
  )
  const completedUninvoicedValue = useMemo(
    () => completedUninvoicedJobs.reduce((sum, job) => {
      const derivedSubtotal = Number(job.billing_lines?.reduce((lineSum, line) => lineSum + Number(line.line_subtotal ?? 0), 0) ?? 0)
      const fallbackSubtotal = Number(job.billing_unit_price ?? 0) * Number(job.billing_quantity ?? 1)
      return sum + (derivedSubtotal > 0 ? derivedSubtotal : fallbackSubtotal)
    }, 0),
    [completedUninvoicedJobs],
  )
  const jobsActionItems: ActionChecklistItem[] = compactVisibleItems<ActionChecklistItem>([
    todayJobs.length > 0 ? {
      id: 'today',
      state: 'warning',
      label: `${todayJobs.length} servicio(s) hoy`,
      description: todayJobs.length > 0
        ? 'La cola inmediata esta en la agenda de hoy y conviene abrirla primero.'
        : '',
      action: todayJobs[0] ? {
        label: 'Abrir agenda de hoy',
        onClick: () => handleOpenWorkspace(todayJobs[0].id),
      } : undefined,
    } : null,
    completedUninvoicedJobs.length > 0 ? {
      id: 'uninvoiced',
      state: 'warning',
      label: `${completedUninvoicedJobs.length} completado(s) sin factura`,
      description: completedUninvoicedJobs.length > 0
        ? 'Es trabajo ya ejecutado que todavia no impacta caja porque no esta facturado.'
        : '',
      action: completedUninvoicedJobs[0] ? {
        label: 'Abrir listo para facturar',
        onClick: () => handleOpenWorkspace(completedUninvoicedJobs[0].id, 'billing'),
      } : undefined,
    } : null,
    pendingJobs.length > 0 ? {
      id: 'pending',
      state: 'info',
      label: `${pendingJobs.length} pendiente(s) o en curso`,
      description: pendingJobs.length > 0
        ? 'Mantienen la operativa abierta fuera del cierre de hoy.'
        : '',
    } : null,
    duplicateGroups.length > 0 ? {
      id: 'duplicates',
      state: 'warning',
      label: `${duplicateGroups.length} duplicado(s) potencial(es)`,
      description: duplicateGroups.length > 0
        ? 'Hay coincidencias operativas que conviene revisar antes de seguir programando.'
        : '',
      action: duplicateGroups.length > 0 ? {
        label: 'Revisar duplicados',
        onClick: () => setShowDuplicateReview(true),
      } : undefined,
    } : null,
  ])
  const summaryKpis = compactVisibleItems([
    hasMeaningfulCount(todayJobs.length) ? (
      <VisualKpiCard
        key="jobs-today"
        label="Servicios de hoy"
        value={String(todayJobs.length)}
        hint="Agenda inmediata del dia con fecha programada real."
        tone="info"
        priority="compact"
      />
    ) : null,
    hasMeaningfulCount(pendingJobs.length) ? (
      <VisualKpiCard
        key="jobs-pending"
        label="Pendientes"
        value={String(pendingJobs.length)}
        hint="Servicios programados o en curso que siguen abiertos."
        tone="warning"
        priority="compact"
      />
    ) : null,
    hasMeaningfulCount(completedUninvoicedJobs.length) ? (
      <VisualKpiCard
        key="jobs-uninvoiced"
        label="Completados sin facturar"
        value={String(completedUninvoicedJobs.length)}
        hint="Servicios ya hechos que aun no tienen factura enlazada."
        tone="warning"
        priority="compact"
        badgeLabel="Caja bloqueada"
      />
    ) : null,
  ])

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
            summary="Agenda diaria, servicios abiertos y trabajo listo para facturar en una sola lectura. El alta rapida vive en el mismo modulo, pero la prioridad sigue siendo ejecutar y cerrar el siguiente paso operativo."
            statusLabel={completedUninvoicedJobs.length > 0 ? `${completedUninvoicedJobs.length} sin facturar` : 'Operativa estable'}
            statusTone={completedUninvoicedJobs.length > 0 ? 'warning' : todayJobs.length > 0 ? 'info' : 'success'}
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
            secondaryAction={completedUninvoicedJobs[0] ? {
              label: 'Ver listo para facturar',
              onClick: () => handleOpenWorkspace(completedUninvoicedJobs[0].id, 'billing'),
            } : todayJobs[0] ? {
              label: 'Abrir agenda de hoy',
              onClick: () => handleOpenWorkspace(todayJobs[0].id),
            } : {
              label: 'Ver pendientes',
              onClick: () => {
                const nextPendingJob = pendingJobs[0] ?? upcomingJobs[0] ?? null
                if (nextPendingJob) {
                  handleOpenWorkspace(nextPendingJob.id)
                } else {
                  setShowCreateForm(true)
                }
              },
            }}
            metricLabel={hasMeaningfulAmount(completedUninvoicedValue) ? 'Trabajo sin facturar' : undefined}
            metricValue={hasMeaningfulAmount(completedUninvoicedValue) ? formatCurrency(completedUninvoicedValue) : undefined}
            metricHint={hasMeaningfulAmount(completedUninvoicedValue)
              ? 'Estimacion basada solo en lineas de facturacion o precio unitario del servicio.'
              : undefined}
          >
            {jobsActionItems.length > 0 ? <ActionChecklist items={jobsActionItems} compact /> : null}
          </ExecutiveHeader>

          {summaryKpis.length > 0 ? (
            <div className="cc-kpi-grid cc-kpi-grid--compact">
              {summaryKpis}
            </div>
          ) : null}

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
