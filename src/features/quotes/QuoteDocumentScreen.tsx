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
  const documentTitle = useMemo(() => getQuoteDocumentTitle(quote, clients), [quote, clients])

  function handlePrint() {
    openQuotePrintWindow(quote, clients, properties, 'print')
  }

  function handleSavePdf() {
    openQuotePrintWindow(quote, clients, properties, 'pdf')
  }

  async function handleShare() {
    await shareDocumentSummary(
      documentTitle,
      [`Total: ${quote.total}`, `Estado: ${quote.status}`],
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
      <QuoteDocumentA4
        quote={quote}
        clients={clients}
        properties={properties}
        variant="embedded"
      />
    </DocumentScreenFrame>
  )
}
