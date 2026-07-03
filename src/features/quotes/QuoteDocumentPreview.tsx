import type { QuoteListItem } from './types'
import type { ClientListItem } from '../clients/types'
import type { PropertyListItem } from '../properties/types'
import { getStatusLabel } from '../../app/displayText'
import '../documents/documentSurfaceStyles'
import { DocumentThumbnail } from '../documents/DocumentThumbnail'
import { QuoteDocumentA4 } from './QuoteDocumentA4'
import { useQuoteDocumentLines } from './useQuoteDocumentLines'
import { formatQuoteCustomerFacingTotal } from './quoteCommercialPresentation'

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
          <div>
            <h2>Vista previa de presupuesto</h2>
            <p>Previsualizacion comercial adaptada para revision rapida en movil.</p>
          </div>
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
        <div>
          <h2>Vista previa de presupuesto</h2>
          <p>Documento comercial presentado en una vista optimizada para movil.</p>
        </div>
        <div className="cc-doc-preview-panel__meta" aria-label="Resumen del documento">
          <span className={`lead-badge cc-status-badge cc-status-badge--${hydratedQuote.status}`}>{getStatusLabel(hydratedQuote.status)}</span>
          <span className="cc-doc-preview-panel__pill">
            {formatQuoteCustomerFacingTotal({
              subtotal: Number(hydratedQuote.subtotal || 0),
              total: Number(hydratedQuote.total || 0),
            })}
          </span>
        </div>
      </div>

      <div className="cc-doc-preview-panel__viewport">
        <DocumentThumbnail>
          {isLoadingLines ? (
            <div className="empty-state cc-state-card cc-state-card--loading">
              <strong>Cargando lineas de presupuesto</strong>
              <p>Preparando la vista previa con los conceptos reales.</p>
            </div>
          ) : linesError ? (
            <div className="empty-state">
              <strong>No se pudieron cargar las lineas</strong>
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
        </DocumentThumbnail>
      </div>
    </section>
  )
}
