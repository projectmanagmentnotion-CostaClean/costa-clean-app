import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import '../features/documents/documentSurfaceStyles'
import '../features/invoices/invoiceWorkspace.css'
import { ActionChecklist, type ActionChecklistItem } from '../components/ActionChecklist'
import { BulkSelectionToolbar } from '../components/BulkSelectionToolbar'
import { ActionFlowOverlay } from '../components/ActionFlowOverlay'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DeferredContentFallback } from '../components/DeferredContentFallback'
import { ExecutiveHeader } from '../components/ExecutiveHeader'
import { MajorEditFlowOverlay } from '../components/MajorEditFlowOverlay'
import { ModuleFilterBar } from '../components/ModuleFilterBar'
import { VisualKpiCard } from '../components/VisualKpiCard'
import { formatCurrency } from '../app/displayFormat'
import { DuplicateNotice } from '../features/duplicates/DuplicateNotice'
import { useDuplicateResolution } from '../features/duplicates/duplicateResolution'
import { DuplicateReviewOverlay } from '../features/duplicates/DuplicateReviewOverlay'
import { buildInvoiceDuplicateGroups } from '../features/duplicates/duplicateEngine'
import { useToast } from '../shared/toasts/useToast'
import type { ClientListItem } from '../features/clients/types'
import type { ClientWorkspaceTab } from '../features/clients/useClientWorkspaceNavigation'
import type { InvoiceCreatePrefill } from '../features/invoices/invoiceCreatePrefill'
import { buildInvoiceCorrectionPrefill, buildInvoiceCreatePrefillFromInvoice } from '../features/invoices/invoiceDuplicatePrefill'
import { InvoiceDetailCard } from '../features/invoices/InvoiceDetailCard'
import { getInvoiceCorrectionCase } from '../features/invoices/invoiceCorrectionCases'
import { InvoiceEditFlow } from '../features/invoices/InvoiceEditFlow'
import {
  buildInvoiceFiscalAudit,
  buildInvoiceFiscalBlockedEntries,
  describeInvoiceFiscalMissingFields,
  shouldShowInvoiceFiscalDebug,
} from '../features/invoices/invoiceFiscalSnapshot'
import { backfillInvoiceFiscalSnapshots } from '../features/invoices/invoiceFiscalSnapshotApi'
import { InvoiceNumberingControlCard } from '../features/invoices/InvoiceNumberingControlCard'
import { InvoicesList } from '../features/invoices/InvoicesList'
import { buildInvoiceNumber, buildInvoiceNumberingAudit, getInvoiceIssueYear } from '../features/invoices/invoiceNumbering'
import { settleInvoiceByTransfer, updateInvoiceStatus, refreshInvoicePaymentStatus } from '../features/financial/financialWriteApi'
import type { ExpenseListItem } from '../features/expenses/types'
import type { InvoiceListItem } from '../features/invoices/types'
import type { JobListItem } from '../features/jobs/types'
import type { PaymentListItem } from '../features/payments/types'
import type { PropertyWorkspaceTab } from '../features/properties/usePropertyWorkspaceNavigation'
import type { QuoteListItem } from '../features/quotes/types'
import type { NavigationGuard } from '../app/navigationGuard'
import type { PropertyListItem } from '../features/properties/types'
import { LazyInvoiceDocumentScreen } from '../features/documents/lazyDocumentScreens'

const LazyInvoiceCreateFlow = lazy(async () => ({
  default: (await import('../features/invoices/InvoiceCreateFlow')).InvoiceCreateFlow,
}))

interface InvoicesPageProps {
  invoices: InvoiceListItem[]
  allInvoices: InvoiceListItem[]
  clients: ClientListItem[]
  properties: PropertyListItem[]
  jobs: JobListItem[]
  quotes: QuoteListItem[]
  expenses: ExpenseListItem[]
  payments: PaymentListItem[]
  error: string | null
  onInvoiceCreated: () => Promise<void>
  onViewPayments: (invoiceId: string) => void
  onOpenJobWorkspace: (jobId: string) => void
  onOpenClientWorkspace: (clientId: string, tab?: ClientWorkspaceTab) => void
  onOpenPropertyWorkspace: (propertyId: string, tab?: PropertyWorkspaceTab) => void
  onOpenQuoteDetail: (quoteId: string) => void
  createPrefill: InvoiceCreatePrefill | null
  onPrefillConsumed: () => void
  activeFilterLabel: string | null
  onClearFilter: () => void
  onUnsavedChange?: (hasUnsavedChanges: boolean, contextLabel?: string) => void
  confirmNavigation?: NavigationGuard
}

export function InvoicesPage({
  invoices,
  allInvoices,
  clients,
  properties,
  jobs,
  quotes,
  expenses,
  payments,
  error,
  onInvoiceCreated,
  onViewPayments,
  onOpenJobWorkspace,
  onOpenClientWorkspace,
  onOpenPropertyWorkspace,
  onOpenQuoteDetail,
  createPrefill,
  onPrefillConsumed,
  activeFilterLabel,
  onClearFilter,
  onUnsavedChange,
  confirmNavigation,
}: InvoicesPageProps) {
  const toast = useToast()
  function getInvoiceOutstandingAmount(invoice: InvoiceListItem) {
    return Math.max(Number(invoice.outstanding_amount ?? invoice.total ?? 0), 0)
  }

  function getInvoicePaidAmount(invoice: InvoiceListItem) {
    const derivedPaidAmount = Number(invoice.total ?? 0) - getInvoiceOutstandingAmount(invoice)
    return Math.max(Number(invoice.paid_amount ?? derivedPaidAmount), 0)
  }

  function sumMoney(values: number[]) {
    return Math.round((values.reduce((sum, value) => sum + value, 0) + Number.EPSILON) * 100) / 100
  }

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showDocumentScreen, setShowDocumentScreen] = useState(false)
  const [showMajorEdit, setShowMajorEdit] = useState(false)
  const [localCreatePrefill, setLocalCreatePrefill] = useState<InvoiceCreatePrefill | null>(null)
  const [hasCreateFormDirty, setHasCreateFormDirty] = useState(false)
  const [hasUnsavedDetailChanges, setHasUnsavedDetailChanges] = useState(false)
  const [hasMajorEditDirty, setHasMajorEditDirty] = useState(false)
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([])
  const [visibleInvoices, setVisibleInvoices] = useState<InvoiceListItem[]>(invoices)
  const [bulkDialog, setBulkDialog] = useState<{
    mode: 'transfer' | 'sync' | 'cancel'
    title: string
    description: string
  } | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkFeedback, setBulkFeedback] = useState<string | null>(null)
  const [showDuplicateReview, setShowDuplicateReview] = useState(false)
  const [listState, setListState] = useState({
    visibleCount: invoices.length,
    totalCount: invoices.length,
    hasError: Boolean(error),
    searchQuery: '',
  })

  const selectedInvoice =
    invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? invoices[0] ?? null
  const selectedInvoiceKey = selectedInvoice?.id ?? null
  const effectiveCreatePrefill = localCreatePrefill ?? createPrefill
  const isCreateFormVisible = showCreateForm || Boolean(effectiveCreatePrefill)
  const hasPendingWork = hasCreateFormDirty || hasUnsavedDetailChanges || hasMajorEditDirty
  const shouldHideDetailInvoice = Boolean(error) || invoices.length === 0 || listState.visibleCount === 0
  const detailInvoice = shouldHideDetailInvoice ? null : selectedInvoice
  const correctionDraftPrefill = useMemo(() => {
    if (!detailInvoice) return null
    const correctionCase = getInvoiceCorrectionCase(detailInvoice)
    if (!correctionCase) return null
    return buildInvoiceCorrectionPrefill(detailInvoice, correctionCase)
  }, [detailInvoice])
  const selectedInvoices = invoices.filter((invoice) => selectedInvoiceIds.includes(invoice.id))
  const allVisibleSelected = visibleInvoices.length > 0 && visibleInvoices.every((invoice) => selectedInvoiceIds.includes(invoice.id))
  const transferEligibleInvoices = selectedInvoices.filter((invoice) => invoice.status !== 'cancelled' && (invoice.outstanding_amount ?? invoice.total) > 0.009)
  const cancelEligibleInvoices = selectedInvoices.filter((invoice) => invoice.status === 'draft' || invoice.status === 'issued')
  const rawDuplicateGroups = buildInvoiceDuplicateGroups(invoices)
  const {
    visibleGroups: duplicateGroups,
    reviewStateByGroupId,
    markReviewed,
    ignoreGroup,
    reopenGroup,
  } = useDuplicateResolution(rawDuplicateGroups)
  const draftInvoices = invoices.filter((invoice) => invoice.status === 'draft')
  const collectibleInvoices = invoices.filter((invoice) => invoice.status !== 'draft' && invoice.status !== 'cancelled')
  const openCollectionInvoices = collectibleInvoices.filter((invoice) => getInvoiceOutstandingAmount(invoice) > 0.009)
  const partiallyCollectedInvoices = openCollectionInvoices.filter((invoice) => getInvoicePaidAmount(invoice) > 0.009)
  const pendingCollectionAmount = sumMoney(openCollectionInvoices.map((invoice) => getInvoiceOutstandingAmount(invoice)))
  const collectedAmount = sumMoney(collectibleInvoices.map((invoice) => getInvoicePaidAmount(invoice)))
  const headerTargetInvoice = (
    selectedInvoice
    && selectedInvoice.status !== 'draft'
    && selectedInvoice.status !== 'cancelled'
    && getInvoiceOutstandingAmount(selectedInvoice) > 0.009
  )
    ? selectedInvoice
    : openCollectionInvoices[0] ?? null
  const collectionChecklistItems: ActionChecklistItem[] = [
    {
      id: 'open-balance',
      state: openCollectionInvoices.length > 0 ? 'warning' : 'done',
      label: `${openCollectionInvoices.length} factura(s) con saldo abierto`,
      description: openCollectionInvoices.length > 0
        ? 'La cola principal del modulo sigue siendo cobrar o cerrar el saldo pendiente real.'
        : 'No hay facturas emitidas con saldo pendiente visible.',
      action: headerTargetInvoice ? {
        label: 'Abrir cobro pendiente',
        onClick: () => onViewPayments(headerTargetInvoice.id),
      } : undefined,
    },
    {
      id: 'partial-collection',
      state: partiallyCollectedInvoices.length > 0 ? 'warning' : 'done',
      label: `${partiallyCollectedInvoices.length} cobro(s) parcial(es)`,
      description: partiallyCollectedInvoices.length > 0
        ? 'Conviene revisar estas facturas antes de considerar el expediente cerrado.'
        : 'No hay facturas parcialmente cobradas ahora mismo.',
    },
    {
      id: 'drafts',
      state: draftInvoices.length > 0 ? 'pending' : 'done',
      label: `${draftInvoices.length} borrador(es) por emitir`,
      description: draftInvoices.length > 0
        ? 'Quedan visibles, pero no compiten con la prioridad principal de cobro.'
        : 'No quedan borradores dominando la lectura principal.',
    },
    {
      id: 'duplicates',
      state: duplicateGroups.length > 0 ? 'warning' : 'done',
      label: `${duplicateGroups.length} grupo(s) duplicado(s) potencial(es)`,
      description: duplicateGroups.length > 0
        ? 'Hay coincidencias que conviene limpiar antes de seguir emitiendo o regularizando cobros.'
        : 'No hay duplicidades activas dominando el control de facturas.',
      action: duplicateGroups.length > 0 ? {
        label: 'Revisar duplicados',
        onClick: () => setShowDuplicateReview(true),
      } : undefined,
    },
  ]
  const numberingAuditYear = useMemo(() => {
    const years = allInvoices
      .map((invoice) => getInvoiceIssueYear(invoice.issue_date))
      .filter((value): value is number => value !== null)
      .sort((left, right) => right - left)
    return years[0] ?? new Date().getFullYear()
  }, [allInvoices])
  const numberingAudit = useMemo(
    () => buildInvoiceNumberingAudit(allInvoices, numberingAuditYear),
    [allInvoices, numberingAuditYear],
  )
  const invoiceFiscalAudit = useMemo(
    () => buildInvoiceFiscalAudit(allInvoices, clients),
    [allInvoices, clients],
  )
  const blockedFiscalEntries = useMemo(
    () => buildInvoiceFiscalBlockedEntries(invoiceFiscalAudit.entries),
    [invoiceFiscalAudit.entries],
  )
  const numberingGapMessage = useMemo(() => {
    const firstGap = numberingAudit.gaps[0]
    if (!firstGap) return null
    return firstGap.from === firstGap.to
      ? buildInvoiceNumber(numberingAudit.year, firstGap.from)
      : `${buildInvoiceNumber(numberingAudit.year, firstGap.from)} a ${buildInvoiceNumber(numberingAudit.year, firstGap.to)}`
  }, [numberingAudit])
  const numberingRegularizationCandidate = useMemo(() => {
    const firstGap = numberingAudit.gaps[0]
    if (!firstGap) return null
    const firstPostGapNumber = buildInvoiceNumber(numberingAudit.year, firstGap.to + 1)
    return allInvoices.find((invoice) => invoice.invoice_number === firstPostGapNumber) ?? null
  }, [allInvoices, numberingAudit])
  const numberingRegularizationHint = useMemo(() => {
    const firstGap = numberingAudit.gaps[0]
    if (!firstGap || !numberingRegularizationCandidate) return null
    const targetDisplayCode = `INV-${String(firstGap.from).padStart(4, '0')}`
    const candidateLabel = numberingRegularizationCandidate.display_code ?? numberingRegularizationCandidate.invoice_number ?? numberingRegularizationCandidate.id
    return `${candidateLabel} puede regularizarse a ${targetDisplayCode} / ${buildInvoiceNumber(numberingAudit.year, firstGap.from)} si todavia no fue enviada.`
  }, [numberingAudit, numberingRegularizationCandidate])
  const showInvoiceFiscalDebug = shouldShowInvoiceFiscalDebug()
  const [isFiscalBackfillBusy, setIsFiscalBackfillBusy] = useState(false)
  const [showBlockedFiscalInvoices, setShowBlockedFiscalInvoices] = useState(false)

  const detailEmptyState = error
    ? {
      title: 'Error real de carga',
      description: error,
    }
    : invoices.length === 0
      ? {
        title: 'No hay facturas',
        description: 'Todavía no existen facturas registradas en el sistema.',
      }
      : listState.visibleCount === 0
        ? {
          title: 'Sin resultados visibles',
          description: listState.searchQuery.trim()
            ? `No hay facturas que coincidan con "${listState.searchQuery.trim()}" y los filtros activos.`
            : 'No hay facturas visibles con los filtros activos.',
        }
        : undefined

  useEffect(() => {
    onUnsavedChange?.(hasPendingWork, 'cambios sin guardar en facturas')
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
      description: 'Hay cambios sin guardar en facturas. Si continuas, perderas esos cambios.',
      confirmLabel: 'Continuar',
    })
  }

  async function handleInvoiceCreated() {
    await onInvoiceCreated()
    onPrefillConsumed()
    setLocalCreatePrefill(null)
    setShowCreateForm(false)
    setHasCreateFormDirty(false)
  }

  function openInvoiceDocument(targetInvoice: InvoiceListItem) {
    runGuarded(() => {
      setSelectedInvoiceId(targetInvoice.id)
      setShowDocumentScreen(true)
    })
  }

  function toggleInvoiceSelection(invoiceId: string) {
    setSelectedInvoiceIds((current) => (
      current.includes(invoiceId)
        ? current.filter((id) => id !== invoiceId)
        : [...current, invoiceId]
    ))
  }

  function toggleSelectAllVisible() {
    const visibleIds = visibleInvoices.map((invoice) => invoice.id)
    setSelectedInvoiceIds((current) => (
      allVisibleSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : [...new Set([...current, ...visibleIds])]
    ))
  }

  async function runBulkAction() {
    if (!bulkDialog) return

    setBulkBusy(true)
    setBulkFeedback(null)

    try {
      if (bulkDialog.mode === 'transfer') {
        for (const invoice of transferEligibleInvoices) {
          await settleInvoiceByTransfer(invoice.id)
        }
        await onInvoiceCreated()
        setBulkFeedback(`Regularizacion completada en ${transferEligibleInvoices.length} factura(s).`)
      }

      if (bulkDialog.mode === 'sync') {
        for (const invoice of selectedInvoices) {
          await refreshInvoicePaymentStatus(invoice.id)
        }
        await onInvoiceCreated()
        setBulkFeedback(`Sincronizacion completada en ${selectedInvoices.length} factura(s).`)
      }

      if (bulkDialog.mode === 'cancel') {
        for (const invoice of cancelEligibleInvoices) {
          await updateInvoiceStatus(invoice.id, 'cancelled')
        }
        await onInvoiceCreated()
        setBulkFeedback(`Cancelacion administrativa aplicada en ${cancelEligibleInvoices.length} factura(s).`)
      }

      setSelectedInvoiceIds([])
      setBulkDialog(null)
    } finally {
      setBulkBusy(false)
    }
  }

  async function handleFiscalBackfill() {
    setIsFiscalBackfillBusy(true)
    const toastId = toast.loading('Completando datos fiscales...', 'Actualizando snapshots fiscales reparables.')

    try {
      const result = await backfillInvoiceFiscalSnapshots(allInvoices, clients)
      if (result.repaired === 0 && result.expectedRepairable > 0) {
        throw new Error('No se guardaron cambios. El backfill detecto facturas reparables, pero Supabase no confirmo ninguna actualizacion.')
      }

      await onInvoiceCreated()
      toast.update(toastId, {
        type: 'success',
        title: 'Datos fiscales completados',
        description: `Se completaron ${result.repaired} factura(s) reparables.`,
        persistent: false,
      })
      if (result.failed > 0) {
        toast.warning(
          'Hay facturas sin confirmar',
          `Supabase no confirmo ${result.failed} actualizacion(es) durante el backfill.`,
          { persistent: true },
        )
      }
      if (result.blocked > 0) {
        setShowBlockedFiscalInvoices(true)
        toast.warning(
          'Hay facturas con cliente incompleto',
          `Quedan ${result.blocked} factura(s) bloqueadas por falta de NIF/CIF o direccion fiscal.`,
          { persistent: true },
        )
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo completar el backfill fiscal.'
      toast.update(toastId, {
        type: 'error',
        title: 'Backfill fiscal fallido',
        description: message,
        persistent: true,
      })
    } finally {
      setIsFiscalBackfillBusy(false)
    }
  }

  async function handleReviewSequence() {
    await onInvoiceCreated()

    if (numberingAudit.hasBlockingGaps) {
      toast.warning(
        'Secuencia con saltos',
        `Hay huecos entre ${buildInvoiceNumber(numberingAudit.year, numberingAudit.gaps[0].from - 1)} y ${buildInvoiceNumber(numberingAudit.year, numberingAudit.gaps[0].to + 1)}. No emitas nuevas facturas hasta regularizar.`,
        { persistent: true },
      )

      const firstPostGapNumber = buildInvoiceNumber(numberingAudit.year, numberingAudit.gaps[0].to + 1)
      const anomalyInvoice = allInvoices.find((invoice) => (
        invoice.invoice_number === firstPostGapNumber
        || invoice.display_code === numberingRegularizationCandidate?.display_code
      )) ?? numberingRegularizationCandidate ?? allInvoices[0]

      if (anomalyInvoice) {
        setSelectedInvoiceId(anomalyInvoice.id)
      }
      return
    }

    toast.success(
      'Secuencia revisada',
      'No hay saltos ni duplicados.',
    )
  }

  return (
    <>
      <section className="page-section cc-master-page cc-doc-page">
        <ExecutiveHeader
          eyebrow="Facturacion y cobro"
          title="Facturas"
          summary="Saldo pendiente, cobro registrado, facturas abiertas y borradores en una sola lectura. El cobro manda; la emision directa sigue disponible, pero en segundo nivel."
          statusLabel={openCollectionInvoices.length > 0 ? `${openCollectionInvoices.length} abiertas` : 'Cobro al dia'}
          statusTone={openCollectionInvoices.length > 0 ? 'warning' : 'success'}
          primaryAction={headerTargetInvoice ? {
            label: 'Abrir cobro pendiente',
            onClick: () => onViewPayments(headerTargetInvoice.id),
          } : undefined}
          secondaryAction={{
            label: isCreateFormVisible ? 'Cerrar formulario' : 'Nueva factura',
            onClick: () => {
              if (isCreateFormVisible) {
                runGuarded(() => {
                  setShowCreateForm(false)
                  setLocalCreatePrefill(null)
                  onPrefillConsumed()
                })
                return
              }

              setShowCreateForm(true)
            },
          }}
          metricLabel="Pendiente de cobro"
          metricValue={formatCurrency(pendingCollectionAmount)}
          metricHint={openCollectionInvoices.length > 0
            ? `${openCollectionInvoices.length} factura(s) emitida(s) siguen con saldo abierto real.`
            : 'No hay saldo emitido pendiente visible en primer nivel.'}
        >
          <ActionChecklist items={collectionChecklistItems} compact />
        </ExecutiveHeader>

        <div className="cc-kpi-grid cc-kpi-grid--compact cc-invoice-workspace__kpis">
          <VisualKpiCard
            label="Pendiente de cobro"
            value={formatCurrency(pendingCollectionAmount)}
            hint="Saldo abierto derivado del estado financiero real de las facturas emitidas."
            tone={pendingCollectionAmount > 0.009 ? 'warning' : 'success'}
            priority="primary"
            badgeLabel={pendingCollectionAmount > 0.009 ? 'Prioridad' : 'Controlado'}
            action={headerTargetInvoice ? { label: 'Abrir', onClick: () => onViewPayments(headerTargetInvoice.id) } : undefined}
          />
          <VisualKpiCard
            label="Cobrado registrado"
            value={formatCurrency(collectedAmount)}
            hint="Suma de cobros ya reflejados en factura. No incluye previsiones ni caja futura."
            tone="success"
            priority="compact"
          />
          <VisualKpiCard
            label="Facturas abiertas"
            value={String(openCollectionInvoices.length)}
            hint="Facturas emitidas con saldo pendiente hoy."
            tone={openCollectionInvoices.length > 0 ? 'warning' : 'success'}
            priority="compact"
          />
          <VisualKpiCard
            label="Borradores por emitir"
            value={String(draftInvoices.length)}
            hint="Pendientes de emision. Siguen visibles sin competir con la cola de cobro."
            tone={draftInvoices.length > 0 ? 'info' : 'neutral'}
            priority="compact"
          />
        </div>

        <div className="cc-invoice-workspace__control-grid">
          <section className="data-section cc-invoice-workspace__support-card">
            <div className="section-header">
              <div>
                <h2>Control fiscal</h2>
                <p>Mantiene visibles las facturas bloqueadas o reparables sin mezclarlas con el cobro diario.</p>
              </div>
            </div>

            <div className="cc-alert cc-alert--info cc-invoice-workspace__support-alert">
              <strong>Auditoria fiscal de facturas</strong>
              <div className="cc-invoice-workspace__support-metrics">
                <p>Completas: {invoiceFiscalAudit.summary.complete}</p>
                <p>Reparables desde cliente: {invoiceFiscalAudit.summary.reparable}</p>
                <p>Incompletas: {invoiceFiscalAudit.summary.incomplete}</p>
                <p>Base auditada: {invoiceFiscalAudit.summary.total} facturas.</p>
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setShowBlockedFiscalInvoices((current) => !current)
                    const firstIncomplete = invoiceFiscalAudit.entries.find((entry) => entry.status === 'incomplete')?.invoice
                    if (firstIncomplete) {
                      setSelectedInvoiceId(firstIncomplete.id)
                    }
                  }}
                  disabled={invoiceFiscalAudit.summary.incomplete === 0}
                >
                  Revisar incompletas
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void handleFiscalBackfill()}
                  disabled={isFiscalBackfillBusy || invoiceFiscalAudit.summary.reparable === 0}
                >
                  {isFiscalBackfillBusy ? 'Completando...' : 'Completar reparables'}
                </button>
              </div>
              {showInvoiceFiscalDebug ? (
                <pre className="cc-debug-pre">
                  {JSON.stringify({
                    totalInvoices: invoiceFiscalAudit.summary.total,
                    complete: invoiceFiscalAudit.summary.complete,
                    repairable: invoiceFiscalAudit.summary.reparable,
                    blocked: invoiceFiscalAudit.summary.incomplete,
                    canRunBackfill: invoiceFiscalAudit.summary.reparable > 0 && !isFiscalBackfillBusy,
                  }, null, 2)}
                </pre>
              ) : null}
              {showBlockedFiscalInvoices && blockedFiscalEntries.length > 0 ? (
                <div className="cc-inline-stack cc-invoice-workspace__blocked-list">
                  {blockedFiscalEntries.map((entry) => (
                    <div key={entry.invoiceId} className="cc-alert cc-alert--warning">
                      <strong>{entry.displayCode ?? entry.invoiceNumber ?? entry.invoiceId}</strong>
                      <p>
                        {entry.invoiceNumber ? `Numero ${entry.invoiceNumber}. ` : ''}
                        Cliente: {entry.clientLabel}. {describeInvoiceFiscalMissingFields(entry.missingFields)}.
                      </p>
                      <div className="form-actions">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => {
                            setSelectedInvoiceId(entry.invoiceId)
                          }}
                        >
                          Abrir factura
                        </button>
                        {entry.clientId ? (
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => {
                              onOpenClientWorkspace(entry.clientId!, 'summary')
                            }}
                          >
                            Abrir cliente
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </section>

          <div className="cc-invoice-workspace__support-card">
            <InvoiceNumberingControlCard
              audit={numberingAudit}
              onReviewSequence={() => void handleReviewSequence()}
              reviewHint={numberingAudit.hasBlockingGaps && numberingGapMessage
                ? `Hay huecos fiscales en ${numberingGapMessage}. La emision nueva queda bloqueada hasta regularizar.`
                : null}
              regularizationHint={numberingAudit.hasBlockingGaps ? numberingRegularizationHint : null}
            />
          </div>
        </div>
        {/*
              La ruta diaria correcta es servicio → factura. Las altas directas siguen disponibles, pero quedan contenidas.

        */}
        {isCreateFormVisible ? (
          <ActionFlowOverlay
            isOpen={isCreateFormVisible}
            title="Nueva factura"
            description="La emision se abre en una superficie guiada. Al cerrar volveras al mismo punto de facturas."
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
                  title="Cargando flujo de factura"
                  description="Preparando el formulario completo de emision."
                />
              )}
            >
              <LazyInvoiceCreateFlow
                clients={clients}
                properties={properties}
                jobs={jobs}
                quotes={quotes}
                invoices={allInvoices}
                expenses={expenses}
                onRefreshData={onInvoiceCreated}
                onCompleted={handleInvoiceCreated}
                prefill={effectiveCreatePrefill}
                onOpenExistingInvoice={(invoiceId) => {
                  setHasCreateFormDirty(false)
                  setShowCreateForm(false)
                  setLocalCreatePrefill(null)
                  onPrefillConsumed()
                  setSelectedInvoiceId(invoiceId)
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

        <div className="cc-invoice-workspace__workspace-notices">

        {duplicateGroups.length > 0 ? (
          <DuplicateNotice
            title={`${duplicateGroups.length} grupo(s) de posibles facturas duplicadas`}
            description="Se han detectado coincidencias por referencia, servicio origen o contexto de emisión. Revísalas desde una surface corta antes de seguir emitiendo."
            actionLabel="Revisar duplicados"
            onAction={() => setShowDuplicateReview(true)}
          />
        ) : null}

        </div>

        {detailInvoice ? (
          <MajorEditFlowOverlay
            isOpen={showMajorEdit}
            title="Editar factura"
            description="La edicion mayor se trabaja fuera de la card principal y conserva el contexto financiero."
            onClose={() => {
              runGuarded(() => {
                setShowMajorEdit(false)
                setHasMajorEditDirty(false)
              })
            }}
          >
            <InvoiceEditFlow
              invoice={detailInvoice}
              clients={clients}
              jobs={jobs}
              quotes={quotes}
              allInvoices={allInvoices}
              expenses={expenses}
              onRefreshData={onInvoiceCreated}
              onOpenExistingInvoice={(invoiceId) => {
                setShowMajorEdit(false)
                setHasMajorEditDirty(false)
                setSelectedInvoiceId(invoiceId)
              }}
              onCompleted={async () => {
                setShowMajorEdit(false)
                setHasMajorEditDirty(false)
              }}
              onCancel={() => {
                setShowMajorEdit(false)
                setHasMajorEditDirty(false)
              }}
              onDirtyChange={setHasMajorEditDirty}
            />
          </MajorEditFlowOverlay>
        ) : null}

        {activeFilterLabel ? (
          <ModuleFilterBar label={activeFilterLabel} onClear={onClearFilter} />
        ) : null}

        {selectedInvoiceIds.length > 0 ? (
          <BulkSelectionToolbar
            selectedCount={selectedInvoiceIds.length}
            totalVisibleCount={visibleInvoices.length}
            allVisibleSelected={allVisibleSelected}
            onToggleSelectAllVisible={toggleSelectAllVisible}
            onClearSelection={() => setSelectedInvoiceIds([])}
            actions={[
              {
                id: 'transfer',
                label: 'Cobrar por transferencia',
                disabled: transferEligibleInvoices.length === 0,
                onClick: () => setBulkDialog({
                  mode: 'transfer',
                  title: 'Regularizar cobro por transferencia',
                  description: `${transferEligibleInvoices.length} factura(s) se pueden cubrir por transferencia. Las ya cobradas o canceladas quedaran fuera.`,
                }),
              },
              {
                id: 'sync',
                label: 'Sincronizar cobro',
                onClick: () => setBulkDialog({
                  mode: 'sync',
                  title: 'Sincronizar estado financiero',
                  description: `Se recalculara el estado financiero derivado de ${selectedInvoices.length} factura(s) a partir de sus cobros reales.`,
                }),
              },
              {
                id: 'cancel',
                label: 'Cancelar emitidas/borrador',
                tone: 'warning',
                disabled: cancelEligibleInvoices.length === 0,
                onClick: () => setBulkDialog({
                  mode: 'cancel',
                  title: 'Cancelar facturas seleccionadas',
                  description: `${cancelEligibleInvoices.length} factura(s) estan en estado compatible. No se tocara ninguna ya cancelada ni ninguna fuera de ese grupo.`,
                }),
              },
            ]}
          />
        ) : null}

        {bulkFeedback ? (
          <div className="cc-alert cc-alert--success">
            <strong>Operacion masiva completada</strong>
            <p>{bulkFeedback}</p>
          </div>
        ) : null}

        <div className="cc-master-layout cc-master-layout--list-first cc-doc-workspace cc-invoice-workspace__layout">
          <div className="cc-master-layout__list">
            <InvoicesList
              invoices={invoices}
              error={error}
              selectedInvoiceId={selectedInvoiceKey}
              selectedInvoiceIds={selectedInvoiceIds}
              isSelectionMode
              onToggleInvoiceSelection={toggleInvoiceSelection}
              onOpenDocument={openInvoiceDocument}
              onStateChange={(state) => {
                setListState(state)
                setVisibleInvoices(state.visibleInvoices)
              }}
              onSelectInvoice={(invoice) => {
                if (invoice.id === selectedInvoiceKey) return

                runGuarded(() => {
                  setSelectedInvoiceId(invoice.id)
                  setShowDocumentScreen(false)
                })
              }}
            />
          </div>

          <div className="cc-master-layout__detail">
            <InvoiceDetailCard
              invoice={detailInvoice}
              clients={clients}
              jobs={jobs}
              quotes={quotes}
              payments={payments}
              allInvoices={allInvoices}
              onInvoiceUpdated={onInvoiceCreated}
              onOpenDocument={() => {
                if (detailInvoice) {
                  openInvoiceDocument(detailInvoice)
                }
              }}
              onViewPayments={onViewPayments}
              onCreateSimilarInvoice={(invoice) => {
                setLocalCreatePrefill(buildInvoiceCreatePrefillFromInvoice(invoice))
                setShowCreateForm(true)
              }}
              onPrepareCorrectionDraft={(prefill) => {
                runGuarded(() => {
                  setLocalCreatePrefill(prefill)
                  setShowCreateForm(true)
                })
              }}
              correctionDraftPrefill={correctionDraftPrefill}
              onOpenJobWorkspace={onOpenJobWorkspace}
              onOpenClientWorkspace={onOpenClientWorkspace}
              onOpenPropertyWorkspace={onOpenPropertyWorkspace}
              onOpenQuoteDetail={onOpenQuoteDetail}
              onUnsavedChange={setHasUnsavedDetailChanges}
              onRequestMajorEdit={() => setShowMajorEdit(true)}
              emptyState={detailEmptyState}
            />
          </div>
        </div>
      </section>

      <DuplicateReviewOverlay
        isOpen={showDuplicateReview}
        title="Revisión de facturas duplicadas"
        description="Estas coincidencias ya existen en el módulo. Revísalas para evitar dobles emisiones o referencias repetidas."
        groups={duplicateGroups}
        reviewStateByGroupId={reviewStateByGroupId}
        onMarkReviewed={markReviewed}
        onIgnoreGroup={ignoreGroup}
        onReopenGroup={reopenGroup}
        onClose={() => setShowDuplicateReview(false)}
        onOpenRecord={(invoiceId) => {
          setShowDuplicateReview(false)
          setSelectedInvoiceId(invoiceId)
          setShowDocumentScreen(false)
        }}
      />

      {showDocumentScreen && detailInvoice ? (
        <Suspense
          fallback={(
            <DeferredContentFallback
              title="Cargando documento de factura"
              description="Preparando la vista documental y las acciones de salida."
            />
          )}
        >
          <LazyInvoiceDocumentScreen
            invoice={detailInvoice}
            onClose={() => setShowDocumentScreen(false)}
          />
        </Suspense>
      ) : null}

      <ConfirmDialog
        isOpen={Boolean(bulkDialog)}
        title={bulkDialog?.title ?? 'Confirmar accion masiva'}
        description={bulkDialog?.description ?? ''}
        confirmLabel="Aplicar accion"
        tone="warning"
        isBusy={bulkBusy}
        onCancel={() => setBulkDialog(null)}
        onConfirm={() => void runBulkAction()}
      />
    </>
  )
}
