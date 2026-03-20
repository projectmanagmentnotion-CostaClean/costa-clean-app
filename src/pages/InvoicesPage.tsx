import { useEffect, useState } from 'react'
import { InvoiceCreateForm } from '../features/invoices/InvoiceCreateForm'
import { InvoiceDetailCard } from '../features/invoices/InvoiceDetailCard'
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
      <section className="page-section">
        <div className="section-header page-header-actions">
          <div>
            <h1>Invoices</h1>
            <p>Vista inicial del módulo Invoices conectada a Supabase.</p>
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

        <InvoiceDetailCard
          invoice={selectedInvoice}
          jobs={jobs}
          quotes={quotes}
          onInvoiceUpdated={onInvoiceCreated}
          onOpenDocument={() => setShowDocumentScreen(true)}
        />

        <InvoicesList
          invoices={invoices}
          error={error}
          selectedInvoiceId={selectedInvoiceId}
          onSelectInvoice={(invoice) => {
            setSelectedInvoiceId(invoice.id)
            setShowDocumentScreen(false)
          }}
        />
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
