import type { PropertyListItem } from './types'

interface PropertyDetailCardProps {
  property: PropertyListItem | null
}

export function PropertyDetailCard({ property }: PropertyDetailCardProps) {
  return (
    <section className="data-section">
      <div className="section-header">
        <h2>Detalle del property</h2>
        <p>Vista inicial de detalle del inmueble seleccionado.</p>
      </div>

      {property ? (
        <div className="lead-detail-card">
          <div className="lead-detail-header">
            <div>
              <h3>{property.name}</h3>
              <p>{property.id}</p>
            </div>

            <span className="lead-badge">{property.property_type}</span>
          </div>

          <div className="lead-detail-grid">
            <div className="detail-row">
              <span className="detail-label">Nombre</span>
              <strong>{property.name}</strong>
            </div>

            <div className="detail-row">
              <span className="detail-label">Tipo</span>
              <strong>{property.property_type}</strong>
            </div>

            <div className="detail-row">
              <span className="detail-label">Dirección</span>
              <strong>{property.address}</strong>
            </div>

            <div className="detail-row">
              <span className="detail-label">Ciudad</span>
              <strong>{property.city ?? 'Sin ciudad'}</strong>
            </div>

            <div className="detail-row">
              <span className="detail-label">Código postal</span>
              <strong>{property.postal_code ?? 'Sin código postal'}</strong>
            </div>

            <div className="detail-row">
              <span className="detail-label">Client ID</span>
              <strong>{property.client_id}</strong>
            </div>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <strong>Ningún property seleccionado</strong>
          <p>Haz clic en una tarjeta del listado para ver su detalle.</p>
        </div>
      )}
    </section>
  )
}
