import { useMemo, useState } from 'react'
import { getStatusLabel } from '../../app/displayText'
import { DSErrorState } from '../../design-system/components/DSErrorState'
import { DSLoadingState } from '../../design-system/components/DSLoadingState'
import '../documents/documentSurfaceStyles'
import type { InvoiceListItem } from './types'
import { InvoiceDocumentA4 } from './InvoiceDocumentA4'
import { shareDocumentSummary } from '../documents/utils'
import { DocumentScreenFrame } from '../documents/DocumentScreenFrame'
import { useInvoiceDocumentLines } from './useInvoiceDocumentLines'
import { openInvoiceDocumentOutput } from '../documents/documentOutputRuntime'
import { getInvoiceDocumentTitle } from './openInvoicePrintWindow'

interface InvoiceDocumentScreenProps {
  invoice: InvoiceListItem
  onClose: () => void
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

export function InvoiceDocumentScreen({
  invoice,
  onClose,
}: InvoiceDocumentScreenProps) {
  const [outputError, setOutputError] = useState<string | null>(null)
  const [isOpeningOutput, setIsOpeningOutput] = useState(false)
  const {
    invoice: hydratedInvoice,
    isLoadingLines,
    linesError,
  } = useInvoiceDocumentLines(invoice)
  const documentTitle = useMemo(() => getInvoiceDocumentTitle(hydratedInvoice), [hydratedInvoice])

  async function handleOutput(intent: 'print' | 'pdf') {
    if (isLoadingLines || linesError || isOpeningOutput) {
      return
    }

    setIsOpeningOutput(true)
    setOutputError(null)

    try {
      const result = await openInvoiceDocumentOutput(hydratedInvoice, intent)
      if (result === 'cancelled') {
        return
      }
    } catch (err) {
      setOutputError(err instanceof Error ? err.message : 'No se pudo generar el PDF de la factura.')
    } finally {
      setIsOpeningOutput(false)
    }
  }

  function handlePrint() {
    void handleOutput('print')
  }

  function handleSavePdf() {
    void handleOutput('pdf')
  }

  async function handleShare() {
    await shareDocumentSummary(
      documentTitle,
      [`Total: ${formatCurrency(hydratedInvoice.total)}`, `Estado: ${getStatusLabel(hydratedInvoice.status)}`],
      'Resumen de la factura copiado al portapapeles.',
      'Compartir no esta disponible en este dispositivo.',
    )
  }

  return (
    <>
      <DocumentScreenFrame
        title="Vista de factura"
        subtitle={invoice.invoice_number ?? 'Documento'}
        previewTitle="Vista previa de factura"
        previewClassName="data-section cc-doc-preview-panel cc-doc-preview-panel--invoice cc-doc-preview-panel--screen"
        onClose={onClose}
        onShare={handleShare}
        onPrint={handlePrint}
        onSavePdf={handleSavePdf}
        isOutputDisabled={isLoadingLines || Boolean(linesError)}
        isOutputBusy={isOpeningOutput}
      >
        {outputError ? (
          <DSErrorState title="No se pudo abrir el documento" description={outputError} />
        ) : isLoadingLines ? (
          <DSLoadingState
            title="Cargando lineas de factura"
            description="Preparando la vista previa con los conceptos reales."
          />
        ) : linesError ? (
          <DSErrorState title="No se pudieron cargar las lineas" description={linesError} />
        ) : (
          <InvoiceDocumentA4 invoice={hydratedInvoice} variant="embedded" />
        )}
      </DocumentScreenFrame>
    </>
  )
}
