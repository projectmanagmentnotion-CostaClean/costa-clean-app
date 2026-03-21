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
  return (
    <section className="data-section">
      <div className="section-header">
        <h2>Properties reales</h2>
        <p>Primer listado conectado a Supabase.</p>
      </div>

      {error ? (
        <div className="empty-state">
          <strong>Error cargando properties</strong>
          <p>{error}</p>
        </div>
      ) : properties.length === 0 ? (
        <div className="empty-state">
          <strong>No hay properties</strong>
          <p>Todavía no existen registros en la tabla properties.</p>
        </div>
      ) : (
        <div className="lead-list">
          {properties.map((property) => {
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
                  <span className="lead-badge">{property.property_type}</span>
                </div>

                <p>Código: {property.display_code ?? property.id}</p>
                <p>Client: {property.client_display_code ?? property.client_id}</p>
                <p>Ciudad: {property.city ?? 'Sin ciudad'}</p>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
