import { useEffect, useState } from 'react'
import { BulkSelectionToolbar } from '../components/BulkSelectionToolbar'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ModuleFilterBar } from '../components/ModuleFilterBar'
import type { ClientListItem } from '../features/clients/types'
import type { ClientWorkspaceTab } from '../features/clients/useClientWorkspaceNavigation'
import { InvoiceCreateForm } from '../features/invoices/InvoiceCreateForm'
import type { InvoiceCreatePrefill } from '../features/invoices/invoiceCreatePrefill'
import { InvoiceDetailCard } from '../features/invoices/InvoiceDetailCard'
import { InvoiceDocumentPreview } from '../features/invoices/InvoiceDocumentPreview'
import { InvoiceDocumentScreen } from '../features/invoices/InvoiceDocumentScreen'
import { InvoicesList } from '../features/invoices/InvoicesList'
import { settleInvoiceByTransfer, updateInvoiceStatus, refreshInvoicePaymentStatus } from '../features/financial/financialWriteApi'
import type { InvoiceListItem } from '../features/invoices/types'
import type { JobListItem } from '../features/jobs/types'
import type { PaymentListItem } from '../features/payments/types'
import type { PropertyWorkspaceTab } from '../features/properties/usePropertyWorkspaceNavigation'
import type { QuoteListItem } from '../features/quotes/types'
import type { NavigationGuard } from '../app/navigationGuard'
import { formatCurrency } from '../app/displayFormat'
import type { PropertyListItem } from '../features/properties/types'

interface InvoicesPageProps {
  invoices: InvoiceListItem[]
  clients: ClientListItem[]
  properties: PropertyListItem[]
  jobs: JobListItem[]
  quotes: QuoteListItem[]
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
  clients,
  properties,
  jobs,
  quotes,
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
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showDocumentScreen, setShowDocumentScreen] = useState(false)
  const [hasUnsavedDetailChanges, setHasUnsavedDetailChanges] = useState(false)
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([])
  const [visibleInvoices, setVisibleInvoices] = useState<InvoiceListItem[]>(invoices)
  const [bulkDialog, setBulkDialog] = useState<{
    mode: 'transfer' | 'sync' | 'cancel'
    title: string
    description: string
  } | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkFeedback, setBulkFeedback] = useState<string | null>(null)
  const [listState, setListState] = useState({
    visibleCount: invoices.length,
    totalCount: invoices.length,
    hasError: Boolean(error),
    searchQuery: '',
  })

  const selectedInvoice =
    invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? invoices[0] ?? null
  const selectedInvoiceKey = selectedInvoice?.id ?? null
  const isCreateFormVisible = showCreateForm || Boolean(createPrefill)
  const hasPendingWork = isCreateFormVisible || hasUnsavedDetailChanges
  const issuedInvoicesCount = invoices.filter((invoice) => invoice.status === 'issued').length
  const paidInvoicesCount = invoices.filter((invoice) => invoice.payment_status === 'paid').length
  const selectedInvoiceTotal = selectedInvoice ? selectedInvoice.total : null
  const shouldHideDetailInvoice = Boolean(error) || invoices.length === 0 || listState.visibleCount === 0
  const detailInvoice = shouldHideDetailInvoice ? null : selectedInvoice
  const selectedInvoices = invoices.filter((invoice) => selectedInvoiceIds.includes(invoice.id))
  const allVisibleSelected = visibleInvoices.length > 0 && visibleInvoices.every((invoice) => selectedInvoiceIds.includes(invoice.id))
  const transferEligibleInvoices = selectedInvoices.filter((invoice) => invoice.status !== 'cancelled' && (invoice.outstanding_amount ?? invoice.total) > 0.009)
  const cancelEligibleInvoices = selectedInvoices.filter((invoice) => invoice.status === 'draft' || invoice.status === 'issued')

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
    setShowCreateForm(false)
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

  return (
    <>
      <section className="page-section cc-master-page cc-doc-page">
        <div className="section-header page-header-actions cc-master-page__hero">
          <div className="cc-module-hero__body">
            <span className="cc-module-hero__eyebrow">Cobro y documento</span>
            <h1>Facturas</h1>
            <p>
              Gestiona documentos de cobro con una estructura mas clara y compacta en iPhone.
            </p>

            <div className="cc-module-hero__meta" aria-label="Resumen del modulo facturas">
              <span className="cc-module-hero__metric">
                <strong>{invoices.length}</strong>
                <span>registros</span>
              </span>
              <span className="cc-module-hero__metric">
                <strong>{issuedInvoicesCount}</strong>
                <span>emitidas</span>
              </span>
              <span className="cc-module-hero__metric">
                <strong>{paidInvoicesCount}</strong>
                <span>pagadas</span>
              </span>
              <span className="cc-module-hero__metric">
                <strong>{selectedInvoiceTotal !== null ? formatCurrency(selectedInvoiceTotal) : ' - '}</strong>
                <span>seleccionada</span>
              </span>
            </div>
          </div>

          <div className="cc-module-hero__actions">
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
              {isCreateFormVisible ? 'Cerrar formulario' : 'Nueva factura'}
            </button>
          </div>
        </div>

        {isCreateFormVisible ? (
          <InvoiceCreateForm
            clients={clients}
            properties={properties}
            jobs={jobs}
            quotes={quotes}
            onCreated={handleInvoiceCreated}
            prefill={createPrefill}
          />
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

        <div className="cc-page-mode-strip">
          <span className="cc-page-mode-strip__pill cc-page-mode-strip__pill--active">Gestion</span>
          <span className="cc-page-mode-strip__text">Lista y detalle para emitir, revisar y actualizar</span>
        </div>

        <div className="cc-master-layout cc-master-layout--list-first cc-doc-workspace">
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
            <div className="cc-doc-workspace__detail-stack">
              <InvoiceDetailCard
                invoice={detailInvoice}
                jobs={jobs}
                quotes={quotes}
                payments={payments}
                onInvoiceUpdated={onInvoiceCreated}
                onOpenDocument={() => {
                  if (detailInvoice) {
                    openInvoiceDocument(detailInvoice)
                  }
                }}
                onViewPayments={onViewPayments}
                onOpenJobWorkspace={onOpenJobWorkspace}
                onOpenClientWorkspace={onOpenClientWorkspace}
                onOpenPropertyWorkspace={onOpenPropertyWorkspace}
                onOpenQuoteDetail={onOpenQuoteDetail}
                onUnsavedChange={setHasUnsavedDetailChanges}
                emptyState={detailEmptyState}
              />

              <div className="cc-contextual-preview-shell cc-doc-preview-panel--workspace">
                <div className="cc-contextual-preview-shell__strip">
                  <div className="cc-contextual-preview-shell__strip-copy">
                    <span className="cc-contextual-preview-shell__eyebrow">Preview contextual</span>
                    <strong>Documento sin salir de la vista</strong>
                    <span>La factura seleccionada se revisa al lado del detalle operativo.</span>
                  </div>
                </div>
                <InvoiceDocumentPreview invoice={detailInvoice} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {showDocumentScreen && detailInvoice ? (
        <InvoiceDocumentScreen
          invoice={detailInvoice}
          onClose={() => setShowDocumentScreen(false)}
        />
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
