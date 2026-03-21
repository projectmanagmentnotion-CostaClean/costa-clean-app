import type { QuoteListItem } from './types'
import type { ClientListItem } from '../clients/types'
import type { PropertyListItem } from '../properties/types'
import { QuoteDocumentA4 } from './QuoteDocumentA4'

interface QuoteDocumentPreviewProps {
  quote: QuoteListItem | null
  clients: ClientListItem[]
  properties: PropertyListItem[]
}

export function QuoteDocumentPreview({
  quote,
  clients,
  properties,
}: QuoteDocumentPreviewProps) {
  if (!quote) {
    return (
      <section className="data-section">
        <div className="section-header">
          <h2>Plantilla de presupuesto</h2>
          <p>Vista documental HTML/CSS alineada con tu branding real.</p>
        </div>

        <div className="empty-state">
          <strong>No hay presupuesto para previsualizar</strong>
          <p>Selecciona un quote en el listado para ver la plantilla documental.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="data-section">
      <div className="section-header">
        <h2>Plantilla de presupuesto</h2>
        <p>Vista documental HTML/CSS alineada con tu branding real.</p>
      </div>

      <QuoteDocumentA4
        quote={quote}
        clients={clients}
        properties={properties}
        variant="embedded"
      />
    </section>
  )
}
