import { useMemo, useState } from 'react'
import { formatClientLabel } from '../../app/relationshipLabels'
import { ListToolbar, type ListPreferences } from '../../components/ListToolbar'
import { DSEmptyState } from '../../design-system/components/DSEmptyState'
import { DSErrorState } from '../../design-system/components/DSErrorState'
import { compareText, createDefaultPreferences } from '../lists/listPreferences'
import { applyTextSearch } from '../lists/utils'
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
  const defaultPreferences = useMemo(() => createDefaultPreferences('recent', 'desc', { scope: 'active' }), [])
  const [preferences, setPreferences] = useState<ListPreferences>(defaultPreferences)

  const filteredClients = useMemo(() => {
    const scope = preferences.filters.scope ?? 'active'

    return clients.filter((client) =>
      (() => {
        const archived = isArchivedEntity(client)
        const deleted = isDeletedEntity(client)

        if (scope === 'all') return !deleted
        if (scope === 'archived') return archived && !deleted
        if (deleted || archived) return false
        if (scope === 'inactive') return client.status === 'inactive'
        return client.status !== 'inactive'
      })() &&
      applyTextSearch(preferences.searchQuery, [
        client.full_name,
        client.display_code,
        client.id,
        client.phone,
        client.email,
        client.status,
      ]),
    ).sort((left, right) => {
      if (preferences.sortField === 'name') {
        const comparison = compareText(left.full_name, right.full_name)
        return preferences.sortDirection === 'asc' ? comparison : -comparison
      }

      const comparison = compareText(left.created_at ?? left.display_code ?? left.id, right.created_at ?? right.display_code ?? right.id)
      return preferences.sortDirection === 'asc' ? comparison : -comparison
    })
  }, [clients, preferences])

  return (
    <section className="data-section cc-module-list-section">
      <div className="section-header cc-list-section__header">
        <div>
          <h2>Clientes</h2>
          <p>Cartera activa, contacto y referencia interna.</p>
        </div>
      </div>

      <ListToolbar
        storageKey="costaclean-list-preferences-clients"
        searchLabel="Buscar cliente"
        searchPlaceholder="Nombre, codigo interno, telefono, email o estado"
        resultCount={filteredClients.length}
        totalCount={clients.length}
        sortOptions={[
          { value: 'recent', label: 'Recientes' },
          { value: 'name', label: 'Nombre' },
        ]}
        defaultPreferences={defaultPreferences}
        filters={[{
          key: 'scope',
          label: 'Vista',
          value: preferences.filters.scope ?? 'active',
          options: [
            { value: 'active', label: 'Activos' },
            { value: 'inactive', label: 'Inactivos' },
            { value: 'archived', label: 'Archivados' },
            { value: 'all', label: 'Todos' },
          ],
        }]}
        onChange={setPreferences}
      />

      {!error && clients.length > 0 ? (
        <div className="cc-directory-list__summary">
          <strong>{filteredClients.length} visibles</strong>
          <p>{preferences.searchQuery.trim() ? 'Filtro activo sobre la cartera operativa.' : 'La lista prioriza cartera activa y deja fuera archivados e inactivos salvo que ajustes la vista.'}</p>
        </div>
      ) : null}

      {error ? (
        <DSErrorState title="Error cargando clientes" description={error} />
      ) : clients.length === 0 ? (
        <DSEmptyState title="No hay clientes" description="Todavia no existen registros en la tabla clients." />
      ) : filteredClients.length === 0 ? (
        <DSEmptyState title="Sin resultados" description="No encontramos clientes que coincidan con tu busqueda y filtros activos." />
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
