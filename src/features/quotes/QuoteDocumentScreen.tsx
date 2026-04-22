import { useMemo, useState } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
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
  const [pendingOutputIntent, setPendingOutputIntent] = useState<'print' | 'pdf' | null>(null)
  const {
    quote: hydratedQuote,
    isLoadingLines,
    linesError,
  } = useQuoteDocumentLines(quote)
  const documentTitle = useMemo(() => getQuoteDocumentTitle(hydratedQuote, clients), [hydratedQuote, clients])

  function handlePrint() {
    if (!isLoadingLines && !linesError) {
      setPendingOutputIntent('print')
    }
  }

  function handleSavePdf() {
    if (!isLoadingLines && !linesError) {
      setPendingOutputIntent('pdf')
    }
  }

  function handleConfirmOpenWindow() {
    if (!pendingOutputIntent) return

    openQuotePrintWindow(hydratedQuote, clients, properties, pendingOutputIntent)
    setPendingOutputIntent(null)
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
    <>
      <DocumentScreenFrame
        title="Vista de presupuesto"
        subtitle={quote.display_code ?? quote.id}
        previewTitle="Vista previa de presupuesto"
        previewClassName="data-section cc-doc-preview-panel cc-doc-preview-panel--quote cc-doc-preview-panel--screen"
        onClose={onClose}
        onShare={handleShare}
        onPrint={handlePrint}
        onSavePdf={handleSavePdf}
        isOutputDisabled={isLoadingLines || Boolean(linesError)}
      >
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
      </DocumentScreenFrame>

      <ConfirmDialog
        isOpen={Boolean(pendingOutputIntent)}
        title={pendingOutputIntent === 'pdf' ? 'Abrir ventana para guardar PDF' : 'Abrir ventana de impresión'}
        description="El navegador abrirá una nueva ventana o pestaña para preparar el presupuesto. Si el navegador bloquea ventanas emergentes, permite pop-ups para CostaClean CRM."
        confirmLabel={pendingOutputIntent === 'pdf' ? 'Abrir y guardar PDF' : 'Abrir e imprimir'}
        onCancel={() => setPendingOutputIntent(null)}
        onConfirm={handleConfirmOpenWindow}
      />
    </>
  )
}
