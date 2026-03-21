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
    <section className="data-section">
      <div className="section-header">
        <h2>Propiedades</h2>
        <p>Listado conectado a Supabase.</p>
      </div>

      <SearchBar
        label="Buscar propiedad"
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Nombre, código, cliente, tipo, dirección, ciudad o nota"
        resultCount={filteredProperties.length}
        totalCount={properties.length}
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
        <div className="lead-list">
          {filteredProperties.map((property) => {
            const isSelected = property.id === selectedPropertyId

            return (
              <button
                key={property.id}
                type="button"
                className={
                  isSelected
                    ? 'lead-item lead-item-button selected'
                    : 'lead-item lead-item-button'
                }
                onClick={() => onSelectProperty(property)}
              >
                <div className="lead-item-top">
                  <strong>{property.name}</strong>
                  <span className="lead-badge">{getPropertyTypeLabel(property.property_type)}</span>
                </div>

                <p>Código: {property.display_code ?? property.id}</p>
                <p>Cliente: {property.client_display_code ?? property.client_id}</p>
                <p>Ciudad: {property.city ?? 'Sin ciudad'}</p>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
