import { useMemo, useState } from 'react'
import { SearchBar } from '../../components/SearchBar'
import { matchesSearchQuery } from '../documents/search'
import type { ClientListItem } from './types'

interface ClientsListProps {
  clients: ClientListItem[]
  error: string | null
  selectedClientId: string | null
  onSelectClient: (client: ClientListItem) => void
}

export function ClientsList({
  clients,
  error,
  selectedClientId,
  onSelectClient,
}: ClientsListProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredClients = useMemo(() => {
    return clients.filter((client) =>
      matchesSearchQuery(searchQuery, [
        client.full_name,
        client.display_code,
        client.id,
        client.phone,
        client.email,
        client.status,
      ]),
    )
  }, [clients, searchQuery])

  return (
    <section className="data-section">
      <div className="section-header">
        <h2>Clientes</h2>
        <p>Base de clientes activa conectada a Supabase.</p>
      </div>

      <SearchBar
        label="Buscar cliente"
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Nombre, código, teléfono, email o estado"
        resultCount={filteredClients.length}
        totalCount={clients.length}
      />

      {error ? (
        <div className="empty-state">
          <strong>Error cargando clientes</strong>
          <p>{error}</p>
        </div>
      ) : clients.length === 0 ? (
        <div className="empty-state">
          <strong>No hay clientes</strong>
          <p>Todavía no existen registros en la tabla clients.</p>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="empty-state">
          <strong>Sin resultados</strong>
          <p>No encontramos clientes que coincidan con tu búsqueda.</p>
        </div>
      ) : (
        <div className="lead-list">
          {filteredClients.map((client) => {
            const isSelected = client.id === selectedClientId

            return (
              <button
                key={client.id}
                type="button"
                className={
                  isSelected
                    ? 'lead-item lead-item-button selected'
                    : 'lead-item lead-item-button'
                }
                onClick={() => onSelectClient(client)}
              >
                <div className="lead-item-top">
                  <strong>{client.full_name}</strong>
                  <span className="lead-badge">{client.status}</span>
                </div>

                <div className="cc-list-meta">
                  <span>Código {client.display_code ?? client.id}</span>
                  <span>{client.phone ?? 'Sin teléfono'}</span>
                </div>

                <p>{client.email ?? 'Sin email registrado'}</p>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}