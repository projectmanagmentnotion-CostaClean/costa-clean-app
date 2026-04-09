import type { QuoteListItem } from './types'
import type { ClientListItem } from '../clients/types'
import type { PropertyListItem } from '../properties/types'
import { QuoteDocumentA4 } from './QuoteDocumentA4'
import { useQuoteDocumentLines } from './useQuoteDocumentLines'

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
      <section className="data-section cc-doc-preview-panel cc-doc-preview-panel--quote">
        <div className="section-header">
          <h2>Vista previa de presupuesto</h2>
          <p>Previsualización comercial adaptada para revisión rápida en móvil.</p>
        </div>

        <div className="empty-state">
          <strong>No hay presupuesto para previsualizar</strong>
          <p>Selecciona un presupuesto en el listado para ver el documento.</p>
        </div>
      </section>
    )
  }

  return (
    <QuoteDocumentPreviewContent
      quote={quote}
      clients={clients}
      properties={properties}
    />
  )
}

function QuoteDocumentPreviewContent({
  quote,
  clients,
  properties,
}: {
  quote: QuoteListItem
  clients: ClientListItem[]
  properties: PropertyListItem[]
}) {
  const {
    quote: hydratedQuote,
    isLoadingLines,
    linesError,
  } = useQuoteDocumentLines(quote)

  return (
    <section className="data-section cc-doc-preview-panel cc-doc-preview-panel--quote">
      <div className="section-header">
        <h2>Vista previa de presupuesto</h2>
        <p>Documento comercial presentado en una vista optimizada para móvil.</p>
      </div>

      <div className="cc-doc-preview-panel__viewport">
        <div className="cc-doc-preview-panel__canvas">
          {isLoadingLines ? (
            <div className="empty-state cc-state-card cc-state-card--loading">
              <strong>Cargando líneas de presupuesto</strong>
              <p>Preparando la vista previa con los conceptos reales.</p>
            </div>
          ) : linesError ? (
            <div className="empty-state">
              <strong>No se pudieron cargar las líneas</strong>
              <p>{linesError}</p>
            </div>
          ) : (
            <QuoteDocumentA4
              quote={hydratedQuote}
              clients={clients}
              properties={properties}
              variant="embedded"
            />
          )}
        </div>
      </div>
    </section>
  )
}
