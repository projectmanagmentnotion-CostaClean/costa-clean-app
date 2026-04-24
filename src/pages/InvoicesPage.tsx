import { useEffect, useState } from 'react'
import { ModuleFilterBar } from '../components/ModuleFilterBar'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { InvoiceCreateForm } from '../features/invoices/InvoiceCreateForm'
import type { InvoiceCreatePrefill } from '../features/invoices/invoiceCreatePrefill'
import { InvoiceDetailCard } from '../features/invoices/InvoiceDetailCard'
import { InvoiceDocumentPreview } from '../features/invoices/InvoiceDocumentPreview'
import { InvoiceDocumentScreen } from '../features/invoices/InvoiceDocumentScreen'
import { InvoicesList } from '../features/invoices/InvoicesList'
import type { InvoiceListItem } from '../features/invoices/types'
import type { JobListItem } from '../features/jobs/types'
import type { QuoteListItem } from '../features/quotes/types'
import type { NavigationGuard } from '../app/navigationGuard'
import { formatCurrency } from '../app/displayFormat'

interface InvoicesPageProps {
  invoices: InvoiceListItem[]
  jobs: JobListItem[]
  quotes: QuoteListItem[]
  error: string | null
  onInvoiceCreated: () => Promise<void>
  createPrefill: InvoiceCreatePrefill | null
  onPrefillConsumed: () => void
  activeFilterLabel: string | null
  onClearFilter: () => void
  onUnsavedChange?: (hasUnsavedChanges: boolean, contextLabel?: string) => void
  confirmNavigation?: NavigationGuard
}

export function InvoicesPage({
  invoices,
  jobs,
  quotes,
  error,
  onInvoiceCreated,
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
  const [isOpenDocumentConfirmVisible, setIsOpenDocumentConfirmVisible] = useState(false)
  const [hasUnsavedDetailChanges, setHasUnsavedDetailChanges] = useState(false)

  const selectedInvoice =
    invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? invoices[0] ?? null
  const selectedInvoiceKey = selectedInvoice?.id ?? null
  const isCreateFormVisible = showCreateForm || Boolean(createPrefill)
  const hasPendingWork = isCreateFormVisible || hasUnsavedDetailChanges
  const issuedInvoicesCount = invoices.filter((invoice) => invoice.status === 'issued').length
  const paidInvoicesCount = invoices.filter((invoice) => invoice.status === 'paid').length
  const selectedInvoiceTotal = selectedInvoice ? selectedInvoice.total : null

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
              invoice={selectedInvoice}
              jobs={jobs}
              quotes={quotes}
              onInvoiceUpdated={onInvoiceCreated}
              onOpenDocument={() => runGuarded(() => setIsOpenDocumentConfirmVisible(true))}
              onUnsavedChange={setHasUnsavedDetailChanges}
            />
          </div>
        </div>

        <div className="cc-page-mode-strip cc-page-mode-strip--document">
          <span className="cc-page-mode-strip__pill">Documento</span>
          <span className="cc-page-mode-strip__text">Vista previa separada para validacion y salida</span>
        </div>

        <div className="cc-doc-preview-panel cc-doc-preview-panel--workspace">
          <InvoiceDocumentPreview invoice={selectedInvoice} />
        </div>
      </section>

      {showDocumentScreen && selectedInvoice ? (
        <InvoiceDocumentScreen
          invoice={selectedInvoice}
          onClose={() => setShowDocumentScreen(false)}
        />
      ) : null}

      <ConfirmDialog
        isOpen={isOpenDocumentConfirmVisible && Boolean(selectedInvoice)}
        title="Abrir vista de factura"
        description="Se abrira la factura en una vista de documento para revisar, imprimir o guardar PDF. Continua solo si quieres trabajar con este documento ahora."
        confirmLabel="Abrir factura"
        onCancel={() => setIsOpenDocumentConfirmVisible(false)}
        onConfirm={() => {
          setIsOpenDocumentConfirmVisible(false)
          setShowDocumentScreen(true)
        }}
      />
    </>
  )
}
