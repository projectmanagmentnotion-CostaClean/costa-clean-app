import { useEffect, useState } from 'react'
import { ClientCreateForm } from '../features/clients/ClientCreateForm'
import { ClientDetailCard } from '../features/clients/ClientDetailCard'
import { ClientsList } from '../features/clients/ClientsList'
import type { ClientListItem } from '../features/clients/types'

interface ClientsPageProps {
  clients: ClientListItem[]
  error: string | null
  onClientCreated: () => Promise<void>
}

export function ClientsPage({
  clients,
  error,
  onClientCreated,
}: ClientsPageProps) {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)

  useEffect(() => {
    if (clients.length === 0) {
      setSelectedClientId(null)
      return
    }

    const selectedStillExists = clients.some(
      (client) => client.id === selectedClientId,
    )

    if (!selectedStillExists) {
      setSelectedClientId(clients[0].id)
    }
  }, [clients, selectedClientId])

  const selectedClient =
    clients.find((client) => client.id === selectedClientId) ?? null

  return (
    <section className="page-section">
      <div className="section-header page-header-actions">
        <div>
          <h1>Clients</h1>
          <p>Vista inicial del módulo Clients conectada a Supabase.</p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={() => setShowCreateForm((current) => !current)}
        >
          {showCreateForm ? 'Cerrar formulario' : 'Nuevo client'}
        </button>
      </div>

      {showCreateForm ? <ClientCreateForm onCreated={onClientCreated} /> : null}

      <ClientDetailCard
        client={selectedClient}
        onClientUpdated={onClientCreated}
      />

      <ClientsList
        clients={clients}
        error={error}
        selectedClientId={selectedClientId}
        onSelectClient={(client) => setSelectedClientId(client.id)}
      />
    </section>
  )
}
