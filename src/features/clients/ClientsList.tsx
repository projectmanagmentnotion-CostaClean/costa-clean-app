import { useMemo, useState } from 'react'
import { formatClientLabel } from '../../app/relationshipLabels'
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
    <section className="data-section cc-module-list-section">
      <div className="section-header cc-list-section__header">
        <div>
          <h2>Clientes</h2>
          <p>Cartera activa, contacto y referencia interna.</p>
        </div>
      </div>

      <SearchBar
        label="Buscar cliente"
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Nombre, código interno, teléfono, email o estado"
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
        <div className="lead-list cc-record-list cc-bounded-list">
          {filteredClients.map((client) => {
            const isSelected = client.id === selectedClientId

            return (
              <button
                key={client.id}
                type="button"
                className={
                  isSelected
                    ? 'lead-item lead-item-button selected cc-record-card cc-record-card--client'
                    : 'lead-item lead-item-button cc-record-card cc-record-card--client'
                }
                onClick={() => onSelectClient(client)}
              >
                <div className="cc-record-card__head">
                  <div className="cc-record-card__identity">
                    <strong className="cc-record-card__title">{formatClientLabel(client)}</strong>
                    <span className="cc-record-card__subref">Interno {client.display_code ?? client.id}</span>
                  </div>

                  <div className="cc-record-card__aside">
                    <span className="lead-badge">{client.status}</span>
                  </div>
                </div>

                <p className="cc-record-card__summary">{client.email ?? 'Sin email registrado'}</p>

                <div className="cc-list-meta cc-record-card__meta">
                  <span>{client.phone ?? 'Sin teléfono'}</span>
                  <span>{client.tax_id ?? 'Sin dato fiscal'}</span>
                  <span>{client.source_lead_id ? `Lead ${client.source_lead_id}` : 'Alta directa'}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
