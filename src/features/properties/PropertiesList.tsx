import { useMemo, useState } from 'react'
import { SearchBar } from '../../components/SearchBar'
import { getPropertyTypeLabel } from '../../app/displayFormat'
import { matchesSearchQuery } from '../documents/search'
import type { PropertyListItem } from './types'

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
  const [searchQuery, setSearchQuery] = useState('')

  const filteredProperties = useMemo(() => {
    return properties.filter((property) =>
      matchesSearchQuery(searchQuery, [
        property.name,
        property.display_code,
        property.id,
        property.client_display_code,
        property.client_id,
        property.property_type,
        getPropertyTypeLabel(property.property_type),
        property.address,
        property.city,
        property.postal_code,
        property.notes,
      ]),
    )
  }, [properties, searchQuery])

  return (
    <section className="data-section cc-module-list-section">
      <div className="section-header cc-list-section__header">
        <div>
          <h2>Propiedades</h2>
          <p>Inmuebles, ubicacion y contexto operativo del cliente.</p>
        </div>
      </div>

      <SearchBar
        label="Buscar propiedad"
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Nombre, dirección, código interno, cliente, tipo, ciudad o nota"
      />

      {error ? (
        <div className="empty-state">
          <strong>Error cargando propiedades</strong>
          <p>{error}</p>
        </div>
      ) : properties.length === 0 ? (
        <div className="empty-state">
          <strong>No hay propiedades</strong>
          <p>Todavía no existen registros en la tabla properties.</p>
        </div>
      ) : filteredProperties.length === 0 ? (
        <div className="empty-state">
          <strong>Sin resultados</strong>
          <p>No encontramos propiedades que coincidan con tu búsqueda.</p>
        </div>
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
                    ? 'lead-item lead-item-button selected cc-record-card cc-record-card--property'
                    : 'lead-item lead-item-button cc-record-card cc-record-card--property'
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
                  <span>{property.client_display_code ?? property.client_id}</span>
                  <span>{property.city ?? 'Sin ciudad'}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
