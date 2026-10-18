import '../../features/documents/documentSurfaceStyles'
import { getStatusLabel } from '../../app/displayText'
import type { ClientListItem } from '../../features/clients/types'
import type { PropertyListItem } from '../../features/properties/types'
import type { QuoteListItem } from '../../features/quotes/types'
import { QuoteDocumentA4 } from '../../features/quotes/QuoteDocumentA4'
import { useQuoteDocumentLines } from '../../features/quotes/useQuoteDocumentLines'
import { V3DocumentPreview, V3DocumentPreviewLoading } from '../documents/V3DocumentPreview'

interface V3QuoteDocumentPreviewProps {
  quote: QuoteListItem
  clients: ClientListItem[]
  properties: PropertyListItem[]
  onOpenDocument: () => void
}

function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'accepted') return 'success'
  if (status === 'rejected' || status === 'expired') return 'danger'
  if (status === 'sent') return 'warning'
  return 'neutral'
}

export function V3QuoteDocumentPreview({ quote, clients, properties, onOpenDocument }: V3QuoteDocumentPreviewProps) {
  const { quote: hydratedQuote, isLoadingLines, linesError } = useQuoteDocumentLines(quote)
  return (
    <V3DocumentPreview
      documentKind="quote"
      title="Vista previa de presupuesto"
      description="Documento A4 real con los conceptos, cliente y totales actuales."
      statusLabel={getStatusLabel(hydratedQuote.status)}
      statusTone={statusTone(hydratedQuote.status)}
      error={linesError}
      onOpenDocument={onOpenDocument}
    >
      {isLoadingLines ? <V3DocumentPreviewLoading label="Cargando líneas de presupuesto" description="Preparando el documento canónico." /> : <QuoteDocumentA4 quote={hydratedQuote} clients={clients} properties={properties} variant="embedded" />}
    </V3DocumentPreview>
  )
}
