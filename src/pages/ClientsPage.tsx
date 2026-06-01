import { useState } from 'react'
import { ClientCreateForm } from '../features/clients/ClientCreateForm'
import { ClientDetailCard } from '../features/clients/ClientDetailCard'
import { ClientsList } from '../features/clients/ClientsList'
import type { ClientListItem } from '../features/clients/types'
import type { PropertyListItem } from '../features/properties/types'
import type { JobListItem } from '../features/jobs/types'
import type { QuoteListItem } from '../features/quotes/types'
import type { InvoiceListItem } from '../features/invoices/types'

interface ClientsPageProps {
  clients: ClientListItem[]
  properties: PropertyListItem[]
  jobs: JobListItem[]
  quotes: QuoteListItem[]
  invoices: InvoiceListItem[]
  error: string | null
  onClientCreated: () => Promise<void>
}

export function ClientsPage({
  clients,
  properties,
  jobs,
  quotes,
  invoices,
  error,
  onClientCreated,
}: ClientsPageProps) {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)

  const selectedClient =
    clients.find((client) => client.id === selectedClientId) ?? clients[0] ?? null
  const selectedClientKey = selectedClient?.id ?? null

  return (
    <section className="page-section cc-master-page">
      <div className="section-header page-header-actions cc-master-page__hero">
        <div>
          <h1>Clientes</h1>
          <p>Gestiona la base de clientes con una lectura más clara y directa en móvil.</p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={() => setShowCreateForm((current) => !current)}
        >
          {showCreateForm ? 'Cerrar formulario' : 'Nuevo cliente'}
        </button>
      </div>

      {showCreateForm ? <ClientCreateForm onCreated={onClientCreated} /> : null}

      <div className="cc-master-layout cc-master-layout--list-first">
        <div className="cc-master-layout__list">
          <ClientsList
            clients={clients}
            error={error}
            selectedClientId={selectedClientKey}
            onSelectClient={(client) => setSelectedClientId(client.id)}
          />
        </div>

        <div className="cc-master-layout__detail">
          <ClientDetailCard
            client={selectedClient}
            properties={properties}
            jobs={jobs}
            quotes={quotes}
            invoices={invoices}
            onClientUpdated={onClientCreated}
          />
        </div>
      </div>
    </section>
  )
}
