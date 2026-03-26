import { useEffect, useState } from 'react'
import { PropertyCreateForm } from '../features/properties/PropertyCreateForm'
import { PropertyDetailCard } from '../features/properties/PropertyDetailCard'
import { PropertiesList } from '../features/properties/PropertiesList'
import type { PropertyListItem } from '../features/properties/types'
import type { ClientListItem } from '../features/clients/types'

interface PropertiesPageProps {
  properties: PropertyListItem[]
  clients: ClientListItem[]
  error: string | null
  onPropertyCreated: () => Promise<void>
}

export function PropertiesPage({
  properties,
  clients,
  error,
  onPropertyCreated,
}: PropertiesPageProps) {
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)

  useEffect(() => {
    if (properties.length === 0) {
      setSelectedPropertyId(null)
      return
    }

    const selectedStillExists = properties.some(
      (property) => property.id === selectedPropertyId,
    )

    if (!selectedStillExists) {
      setSelectedPropertyId(properties[0].id)
    }
  }, [properties, selectedPropertyId])

  const selectedProperty =
    properties.find((property) => property.id === selectedPropertyId) ?? null

  return (
    <section className="page-section cc-master-page">
      <div className="section-header page-header-actions cc-master-page__hero">
        <div>
          <h1>Propiedades</h1>
          <p>Gestiona inmuebles, direcciones y datos operativos vinculados a clientes.</p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={() => setShowCreateForm((current) => !current)}
        >
          {showCreateForm ? 'Cerrar formulario' : 'Nueva propiedad'}
        </button>
      </div>

      {showCreateForm ? (
        <PropertyCreateForm clients={clients} onCreated={onPropertyCreated} />
      ) : null}

      <div className="cc-master-layout cc-master-layout--list-first">
        <div className="cc-master-layout__list">
          <PropertiesList
            properties={properties}
            error={error}
            selectedPropertyId={selectedPropertyId}
            onSelectProperty={(property) => setSelectedPropertyId(property.id)}
          />
        </div>

        <div className="cc-master-layout__detail">
          <PropertyDetailCard
            property={selectedProperty}
            onPropertyUpdated={onPropertyCreated}
          />
        </div>
      </div>
    </section>
  )
}