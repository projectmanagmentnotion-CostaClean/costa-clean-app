import { useMemo, useState } from 'react'
import { ListToolbar, type ListPreferences } from '../../components/ListToolbar'
import { DSEmptyState } from '../../design-system/components/DSEmptyState'
import { DSErrorState } from '../../design-system/components/DSErrorState'
import { getPropertyTypeLabel } from '../../app/displayFormat'
import { formatClientLabel } from '../../app/relationshipLabels'
import { compareText, createDefaultPreferences } from '../lists/listPreferences'
import { applyTextSearch } from '../lists/utils'
import type { PropertyListItem } from './types'
import { isArchivedEntity, isDeletedEntity } from '../../shared/lifecycle/entityLifecycle'

interface PropertiesListProps {
  properties: PropertyListItem[]
  error: string | null
  selectedPropertyId: string | null
  onSelectProperty: (property: PropertyListItem) => void
}

export function PropertiesList({
  properties,
  error,
  selectedPropertyId,
  onSelectProperty,
}: PropertiesListProps) {
  const defaultPreferences = useMemo(() => createDefaultPreferences('name', 'asc', { scope: 'active', propertyType: 'all' }), [])
  const [preferences, setPreferences] = useState<ListPreferences>(defaultPreferences)
  const propertyTypeOptions = useMemo(() => {
    const uniqueTypes = Array.from(new Set(properties.map((property) => property.property_type).filter(Boolean)))
    return uniqueTypes
      .sort((left, right) => compareText(getPropertyTypeLabel(left), getPropertyTypeLabel(right)))
      .map((propertyType) => ({
        value: propertyType,
        label: getPropertyTypeLabel(propertyType),
      }))
  }, [properties])

  const filteredProperties = useMemo(() => {
    const scope = preferences.filters.scope ?? 'active'
    const typeFilter = preferences.filters.propertyType ?? 'all'

    return properties.filter((property) =>
      (() => {
        const archived = isArchivedEntity(property)
        const deleted = isDeletedEntity(property)

        if (scope === 'all') return !deleted
        if (scope === 'archived') return archived && !deleted
        if (deleted || archived) return false
        return true
      })() &&
      (typeFilter === 'all' || property.property_type === typeFilter) &&
      applyTextSearch(preferences.searchQuery, [
        property.name,
        property.display_code,
        property.id,
        property.client_name,
        property.client_display_code,
        property.client_id,
        property.property_type,
        getPropertyTypeLabel(property.property_type),
        property.address,
        property.city,
        property.postal_code,
        property.notes,
      ]),
    ).sort((left, right) => {
      const comparison = preferences.sortField === 'client'
        ? compareText(formatClientLabel(left), formatClientLabel(right))
        : preferences.sortField === 'city'
          ? compareText(left.city, right.city)
          : compareText(left.name, right.name)

      return preferences.sortDirection === 'asc' ? comparison : -comparison
    })
  }, [preferences, properties])

  return (
    <section className="data-section cc-module-list-section">
      <div className="section-header cc-list-section__header">
        <div>
          <h2>Propiedades</h2>
          <p>Inmuebles, ubicacion y contexto operativo del cliente.</p>
        </div>
      </div>

      <ListToolbar
        storageKey="costaclean-list-preferences-properties"
        searchLabel="Buscar propiedad"
        searchPlaceholder="Nombre, direccion, codigo interno, cliente, tipo, ciudad o nota"
        resultCount={filteredProperties.length}
        totalCount={properties.length}
        sortOptions={[
          { value: 'name', label: 'Nombre' },
          { value: 'client', label: 'Cliente' },
          { value: 'city', label: 'Ciudad' },
        ]}
        defaultPreferences={defaultPreferences}
        filters={[
          {
            key: 'scope',
            label: 'Vista',
            value: preferences.filters.scope ?? 'active',
            options: [
              { value: 'active', label: 'Activas' },
              { value: 'archived', label: 'Archivadas' },
              { value: 'all', label: 'Todas' },
            ],
          },
          {
            key: 'propertyType',
            label: 'Tipo',
            value: preferences.filters.propertyType ?? 'all',
            options: [{ value: 'all', label: 'Todos' }, ...propertyTypeOptions],
          },
        ]}
        onChange={setPreferences}
      />

      {!error && properties.length > 0 ? (
        <div className="cc-directory-list__summary">
          <strong>{filteredProperties.length} visibles</strong>
          <p>{preferences.searchQuery.trim() ? 'Filtro activo sobre inmuebles y ubicaciones.' : 'La lista muestra solo propiedades activas y evita ruido de archivados salvo que ajustes la vista.'}</p>
        </div>
      ) : null}

      {error ? (
        <DSErrorState title="Error cargando propiedades" description={error} />
      ) : properties.length === 0 ? (
        <DSEmptyState title="No hay propiedades" description="Todavia no existen registros en la tabla properties." />
      ) : filteredProperties.length === 0 ? (
        <DSEmptyState title="Sin resultados" description="No encontramos propiedades que coincidan con tu busqueda y filtros activos." />
      ) : (
        <div className="lead-list cc-record-list cc-bounded-list">
          {filteredProperties.map((property) => {
            const isSelected = property.id === selectedPropertyId

            return (
              <button
                key={property.id}
                type="button"
                className={
                  isSelected
                    ? 'lead-item lead-item-button selected cc-record-card cc-record-card--property cc-record-card--compact'
                    : 'lead-item lead-item-button cc-record-card cc-record-card--property cc-record-card--compact'
                }
                onClick={() => onSelectProperty(property)}
              >
                <div className="cc-record-card__head">
                  <div className="cc-record-card__identity">
                    <strong className="cc-record-card__title">{property.name}</strong>
                    <span className="cc-record-card__subref">Interno {property.display_code ?? property.id}</span>
                  </div>

                  <div className="cc-record-card__aside">
                    <span className="lead-badge">{getPropertyTypeLabel(property.property_type)}</span>
                  </div>
                </div>

                <p className="cc-record-card__summary">{property.address}</p>

                <div className="cc-list-meta cc-record-card__meta">
                  <span>
                    <span className="cc-record-card__meta-label">Cliente</span>
                    <span className="cc-record-card__meta-value">{formatClientLabel(property)}</span>
                  </span>
                  <span>
                    <span className="cc-record-card__meta-label">Ciudad</span>
                    <span className="cc-record-card__meta-value">{property.city ?? 'Sin ciudad'}</span>
                  </span>
                  <span>
                    <span className="cc-record-card__meta-label">Postal</span>
                    <span className="cc-record-card__meta-value">{property.postal_code ?? 'Sin CP'}</span>
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
