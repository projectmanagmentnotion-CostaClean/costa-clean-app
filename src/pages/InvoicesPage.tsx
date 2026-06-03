import { useEffect, useState } from 'react'
import { ModuleFilterBar } from '../components/ModuleFilterBar'
import type { ClientListItem } from '../features/clients/types'
import { InvoiceCreateForm } from '../features/invoices/InvoiceCreateForm'
import type { InvoiceCreatePrefill } from '../features/invoices/invoiceCreatePrefill'
import { InvoiceDetailCard } from '../features/invoices/InvoiceDetailCard'
import { InvoiceDocumentPreview } from '../features/invoices/InvoiceDocumentPreview'
import { InvoiceDocumentScreen } from '../features/invoices/InvoiceDocumentScreen'
import { InvoicesList } from '../features/invoices/InvoicesList'
import type { InvoiceListItem } from '../features/invoices/types'
import type { JobListItem } from '../features/jobs/types'
import type { PaymentListItem } from '../features/payments/types'
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
              onOpenDocument={openInvoiceDocument}
              onStateChange={(state) => setListState(state)}
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
              onUnsavedChange={setHasUnsavedDetailChanges}
              emptyState={detailEmptyState}
            />
          </div>
        </div>

        <div className="cc-page-mode-strip cc-page-mode-strip--document">
          <span className="cc-page-mode-strip__pill">Documento</span>
          <span className="cc-page-mode-strip__text">Vista previa separada para validacion y salida</span>
        </div>

        <div className="cc-doc-preview-panel cc-doc-preview-panel--workspace">
          <InvoiceDocumentPreview invoice={detailInvoice} />
        </div>
      </section>

      {showDocumentScreen && detailInvoice ? (
        <InvoiceDocumentScreen
          invoice={detailInvoice}
          onClose={() => setShowDocumentScreen(false)}
        />
      ) : null}
    </>
  )
}
