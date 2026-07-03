import { useMemo, useState } from 'react'
import { formatClientLabel } from '../../app/relationshipLabels'
import { SearchBar } from '../../components/SearchBar'
import { DSEmptyState } from '../../design-system/components/DSEmptyState'
import { DSErrorState } from '../../design-system/components/DSErrorState'
import { matchesSearchQuery } from '../documents/search'
import type { ClientListItem } from './types'
import { isArchivedEntity, isDeletedEntity } from '../../shared/lifecycle/entityLifecycle'

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
      !isArchivedEntity(client) &&
      !isDeletedEntity(client) &&
      client.status !== 'inactive' &&
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
        placeholder="Nombre, codigo interno, telefono, email o estado"
      />

      {!error && clients.length > 0 ? (
        <div className="cc-directory-list__summary">
          <strong>{filteredClients.length} visibles</strong>
          <p>{searchQuery.trim() ? 'Filtro activo sobre la cartera operativa.' : 'La lista prioriza cartera activa y deja fuera archivados e inactivos.'}</p>
        </div>
      ) : null}

      {error ? (
        <DSErrorState title="Error cargando clientes" description={error} />
      ) : clients.length === 0 ? (
        <DSEmptyState title="No hay clientes" description="Todavia no existen registros en la tabla clients." />
      ) : filteredClients.length === 0 ? (
        <DSEmptyState title="Sin resultados" description="No encontramos clientes que coincidan con tu busqueda." />
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
                    ? 'lead-item lead-item-button selected cc-record-card cc-record-card--client cc-record-card--compact'
                    : 'lead-item lead-item-button cc-record-card cc-record-card--client cc-record-card--compact'
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
                  <span>
                    <span className="cc-record-card__meta-label">Telefono</span>
                    <span className="cc-record-card__meta-value">{client.phone ?? 'Sin telefono'}</span>
                  </span>
                  <span>
                    <span className="cc-record-card__meta-label">Fiscal</span>
                    <span className="cc-record-card__meta-value">{client.tax_id ?? 'Sin dato fiscal'}</span>
                  </span>
                  <span>
                    <span className="cc-record-card__meta-label">Origen</span>
                    <span className="cc-record-card__meta-value">{client.source_lead_id ? `Lead ${client.source_lead_id}` : 'Alta directa'}</span>
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
