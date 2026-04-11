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
  const [activeCreatePrefill, setActiveCreatePrefill] = useState<InvoiceCreatePrefill | null>(null)
  const [hasUnsavedDetailChanges, setHasUnsavedDetailChanges] = useState(false)

  useEffect(() => {
    if (!createPrefill) {
      return
    }

    setActiveCreatePrefill(createPrefill)
    setShowCreateForm(true)
    onPrefillConsumed()
  }, [createPrefill, onPrefillConsumed])

  useEffect(() => {
    if (invoices.length === 0) {
      setSelectedInvoiceId(null)
      setShowDocumentScreen(false)
      return
    }

    const selectedStillExists = invoices.some(
      (invoice) => invoice.id === selectedInvoiceId,
    )

    if (!selectedStillExists) {
      setSelectedInvoiceId(invoices[0].id)
      setShowDocumentScreen(false)
    }
  }, [invoices, selectedInvoiceId])

  const selectedInvoice =
    invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null
  const hasPendingWork = showCreateForm || hasUnsavedDetailChanges

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
      description: 'Hay cambios sin guardar en facturas. Si continúas, perderás esos cambios.',
      confirmLabel: 'Continuar',
    })
  }

  async function handleInvoiceCreated() {
    await onInvoiceCreated()
    setActiveCreatePrefill(null)
    setShowCreateForm(false)
  }

  return (
    <>
      <section className="page-section cc-master-page cc-doc-page">
        <div className="section-header page-header-actions cc-master-page__hero">
          <div>
            <h1>Facturas</h1>
            <p>
              Gestiona documentos de cobro con una estructura más clara y compacta en iPhone.
            </p>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={() => {
              if (showCreateForm) {
                runGuarded(() => {
                  setShowCreateForm(false)
                  setActiveCreatePrefill(null)
                })
                return
              }

              setShowCreateForm(true)
            }}
          >
            {showCreateForm ? 'Cerrar formulario' : 'Nueva factura'}
          </button>
        </div>

        {showCreateForm ? (
          <InvoiceCreateForm
            jobs={jobs}
            quotes={quotes}
            onCreated={handleInvoiceCreated}
            prefill={activeCreatePrefill}
          />
        ) : null}

        {activeFilterLabel ? (
          <ModuleFilterBar label={activeFilterLabel} onClear={onClearFilter} />
        ) : null}

        <div className="cc-master-layout cc-master-layout--list-first">
          <div className="cc-master-layout__list">
            <InvoicesList
              invoices={invoices}
              error={error}
              selectedInvoiceId={selectedInvoiceId}
              onSelectInvoice={(invoice) => {
                if (invoice.id === selectedInvoiceId) return

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

        <div className="cc-doc-preview-panel">
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
        description="Se abrirá la factura en una vista de documento para revisar, imprimir o guardar PDF. Continúa solo si quieres trabajar con este documento ahora."
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
