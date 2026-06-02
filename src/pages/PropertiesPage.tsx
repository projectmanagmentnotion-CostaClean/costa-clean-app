import { useState } from 'react'
import type { ClientListItem } from '../features/clients/types'
import type { InvoiceListItem } from '../features/invoices/types'
import type { JobListItem } from '../features/jobs/types'
import { PropertiesList } from '../features/properties/PropertiesList'
import { PropertyCreateForm } from '../features/properties/PropertyCreateForm'
import { PropertyDetailCard } from '../features/properties/PropertyDetailCard'
import type { PropertyListItem } from '../features/properties/types'
import type { QuoteListItem } from '../features/quotes/types'

interface PropertiesPageProps {
  properties: PropertyListItem[]
  clients: ClientListItem[]
  jobs: JobListItem[]
  quotes: QuoteListItem[]
  invoices: InvoiceListItem[]
  error: string | null
  onPropertyCreated: () => Promise<void>
}

export function PropertiesPage({
  properties,
  clients,
  jobs,
  quotes,
  invoices,
  error,
  onPropertyCreated,
}: PropertiesPageProps) {
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)

  const selectedProperty =
    properties.find((property) => property.id === selectedPropertyId) ?? properties[0] ?? null
  const selectedPropertyKey = selectedProperty?.id ?? null

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
            selectedPropertyId={selectedPropertyKey}
            onSelectProperty={(property) => setSelectedPropertyId(property.id)}
          />
        </div>

        <div className="cc-master-layout__detail">
          <PropertyDetailCard
            property={selectedProperty}
            clients={clients}
            jobs={jobs}
            quotes={quotes}
            invoices={invoices}
            onPropertyUpdated={onPropertyCreated}
          />
        </div>
      </div>
    </section>
  )
}
