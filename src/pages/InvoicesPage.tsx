import { useEffect, useState } from 'react'
import { InvoiceCreateForm } from '../features/invoices/InvoiceCreateForm'
import { InvoiceDetailCard } from '../features/invoices/InvoiceDetailCard'
import { InvoiceDocumentPreview } from '../features/invoices/InvoiceDocumentPreview'
import { InvoiceDocumentScreen } from '../features/invoices/InvoiceDocumentScreen'
import { InvoicesList } from '../features/invoices/InvoicesList'
import type { InvoiceListItem } from '../features/invoices/types'
import type { JobListItem } from '../features/jobs/types'
import type { QuoteListItem } from '../features/quotes/types'

interface InvoicesPageProps {
  invoices: InvoiceListItem[]
  jobs: JobListItem[]
  quotes: QuoteListItem[]
  error: string | null
  onInvoiceCreated: () => Promise<void>
}

export function InvoicesPage({
  invoices,
  jobs,
  quotes,
  error,
  onInvoiceCreated,
}: InvoicesPageProps) {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showDocumentScreen, setShowDocumentScreen] = useState(false)

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
            onClick={() => setShowCreateForm((current) => !current)}
          >
            {showCreateForm ? 'Cerrar formulario' : 'Nueva factura'}
          </button>
        </div>

        {showCreateForm ? (
          <InvoiceCreateForm
            jobs={jobs}
            quotes={quotes}
            onCreated={onInvoiceCreated}
          />
        ) : null}

        <div className="cc-master-layout cc-master-layout--list-first">
          <div className="cc-master-layout__list">
            <InvoicesList
              invoices={invoices}
              error={error}
              selectedInvoiceId={selectedInvoiceId}
              onSelectInvoice={(invoice) => {
                setSelectedInvoiceId(invoice.id)
                setShowDocumentScreen(false)
              }}
            />
          </div>

          <div className="cc-master-layout__detail">
            <InvoiceDetailCard
              invoice={selectedInvoice}
              jobs={jobs}
              quotes={quotes}
              onInvoiceUpdated={onInvoiceCreated}
              onOpenDocument={() => setShowDocumentScreen(true)}
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
    </>
  )
}