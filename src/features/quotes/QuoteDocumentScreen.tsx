import { useMemo, useState } from 'react'
import { getStatusLabel } from '../../app/displayText'
import { DSConfirmDialog } from '../../design-system/components/DSConfirmDialog'
import { DSErrorState } from '../../design-system/components/DSErrorState'
import { DSLoadingState } from '../../design-system/components/DSLoadingState'
import '../documents/documentSurfaceStyles'
import type { QuoteListItem } from './types'
import type { ClientListItem } from '../clients/types'
import type { PropertyListItem } from '../properties/types'
import { QuoteDocumentA4 } from './QuoteDocumentA4'
import { getQuoteDocumentTitle } from './openQuotePrintWindow'
import { shareDocumentSummary } from '../documents/utils'
import { DocumentScreenFrame } from '../documents/DocumentScreenFrame'
import { useQuoteDocumentLines } from './useQuoteDocumentLines'
import { openQuoteDocumentOutput } from '../documents/documentOutputRuntime'

interface QuoteDocumentScreenProps {
  quote: QuoteListItem
  clients: ClientListItem[]
  properties: PropertyListItem[]
  onClose: () => void
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
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

  async function handleConfirmOpenWindow() {
    if (!pendingOutputIntent) return

    await openQuoteDocumentOutput(hydratedQuote, clients, properties, pendingOutputIntent)
    setPendingOutputIntent(null)
  }

  async function handleShare() {
    await shareDocumentSummary(
      documentTitle,
      [`Total: ${formatCurrency(hydratedQuote.total)}`, `Estado: ${getStatusLabel(hydratedQuote.status)}`],
      'Resumen del presupuesto copiado al portapapeles.',
      'Compartir no esta disponible en este dispositivo.',
    )
  }

  return (
    <>
      <DocumentScreenFrame
        title="Vista de presupuesto"
        subtitle={quote.display_code ?? 'Documento'}
        previewTitle="Vista previa de presupuesto"
        previewClassName="data-section cc-doc-preview-panel cc-doc-preview-panel--quote cc-doc-preview-panel--screen"
        onClose={onClose}
        onShare={handleShare}
        onPrint={handlePrint}
        onSavePdf={handleSavePdf}
        isOutputDisabled={isLoadingLines || Boolean(linesError)}
      >
        {isLoadingLines ? (
          <DSLoadingState
            title="Cargando lineas de presupuesto"
            description="Preparando la vista previa con los conceptos reales."
          />
        ) : linesError ? (
          <DSErrorState title="No se pudieron cargar las lineas" description={linesError} />
        ) : (
          <QuoteDocumentA4
            quote={hydratedQuote}
            clients={clients}
            properties={properties}
            variant="embedded"
          />
        )}
      </DocumentScreenFrame>

      <DSConfirmDialog
        isOpen={Boolean(pendingOutputIntent)}
        title={pendingOutputIntent === 'pdf' ? 'Abrir ventana para guardar PDF' : 'Abrir ventana de impresion'}
        description="El navegador abrira una nueva ventana o pestana para preparar el presupuesto. Si las ventanas emergentes estan bloqueadas, habilitalas temporalmente para continuar."
        confirmLabel={pendingOutputIntent === 'pdf' ? 'Abrir y guardar PDF' : 'Abrir e imprimir'}
        onCancel={() => setPendingOutputIntent(null)}
        onConfirm={() => void handleConfirmOpenWindow()}
      />
    </>
  )
}
