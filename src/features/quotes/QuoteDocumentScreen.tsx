import { useMemo } from 'react'
import type { QuoteListItem } from './types'
import type { ClientListItem } from '../clients/types'
import type { PropertyListItem } from '../properties/types'
import { QuoteDocumentA4 } from './QuoteDocumentA4'
import {
  getQuoteDocumentTitle,
  openQuotePrintWindow,
} from './openQuotePrintWindow'
import { shareDocumentSummary } from '../documents/utils'
import { DocumentScreenFrame } from '../documents/DocumentScreenFrame'
import { useQuoteDocumentLines } from './useQuoteDocumentLines'

interface QuoteDocumentScreenProps {
  quote: QuoteListItem
  clients: ClientListItem[]
  properties: PropertyListItem[]
  onClose: () => void
}

export function QuoteDocumentScreen({
  quote,
  clients,
  properties,
  onClose,
}: QuoteDocumentScreenProps) {
  const {
    quote: hydratedQuote,
    isLoadingLines,
    linesError,
  } = useQuoteDocumentLines(quote)
  const documentTitle = useMemo(() => getQuoteDocumentTitle(hydratedQuote, clients), [hydratedQuote, clients])

  function handlePrint() {
    if (!isLoadingLines && !linesError) {
      openQuotePrintWindow(hydratedQuote, clients, properties, 'print')
    }
  }

  function handleSavePdf() {
    if (!isLoadingLines && !linesError) {
      openQuotePrintWindow(hydratedQuote, clients, properties, 'pdf')
    }
  }

  async function handleShare() {
    await shareDocumentSummary(
      documentTitle,
      [`Total: ${hydratedQuote.total}`, `Estado: ${hydratedQuote.status}`],
      'Resumen del presupuesto copiado al portapapeles.',
      'Compartir no está disponible en este dispositivo.',
    )
  }

  return (
    <DocumentScreenFrame
      title="Vista de presupuesto"
      subtitle={quote.display_code ?? quote.id}
      previewTitle="Vista previa de presupuesto"
      previewClassName="data-section cc-doc-preview-panel cc-doc-preview-panel--quote cc-doc-preview-panel--screen"
      onClose={onClose}
      onShare={handleShare}
      onPrint={handlePrint}
      onSavePdf={handleSavePdf}
    >
      {isLoadingLines ? (
        <div className="empty-state">
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
    </DocumentScreenFrame>
  )
}
