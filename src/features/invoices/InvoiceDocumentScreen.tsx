import { useMemo } from 'react'
import type { InvoiceListItem } from './types'
import { InvoiceDocumentA4 } from './InvoiceDocumentA4'
import {
  getInvoiceDocumentTitle,
  openInvoicePrintWindow,
} from './openInvoicePrintWindow'
import { shareDocumentSummary } from '../documents/utils'
import { DocumentScreenFrame } from '../documents/DocumentScreenFrame'
import { useInvoiceDocumentLines } from './useInvoiceDocumentLines'

interface InvoiceDocumentScreenProps {
  invoice: InvoiceListItem
  onClose: () => void
}

export function InvoiceDocumentScreen({
  invoice,
  onClose,
}: InvoiceDocumentScreenProps) {
  const {
    invoice: hydratedInvoice,
    isLoadingLines,
    linesError,
  } = useInvoiceDocumentLines(invoice)
  const documentTitle = useMemo(() => getInvoiceDocumentTitle(hydratedInvoice), [hydratedInvoice])

  function handlePrint() {
    if (!isLoadingLines && !linesError) {
      openInvoicePrintWindow(hydratedInvoice, 'print')
    }
  }

  function handleSavePdf() {
    if (!isLoadingLines && !linesError) {
      openInvoicePrintWindow(hydratedInvoice, 'pdf')
    }
  }

  async function handleShare() {
    await shareDocumentSummary(
      documentTitle,
      [`Total: ${hydratedInvoice.total}`, `Estado: ${hydratedInvoice.status}`],
      'Resumen de la factura copiado al portapapeles.',
      'Compartir no está disponible en este dispositivo.',
    )
  }

  return (
    <DocumentScreenFrame
      title="Vista de factura"
      subtitle={invoice.invoice_number ?? invoice.display_code ?? invoice.id}
      previewTitle="Vista previa de factura"
      previewClassName="data-section cc-doc-preview-panel cc-doc-preview-panel--invoice cc-doc-preview-panel--screen"
      onClose={onClose}
      onShare={handleShare}
      onPrint={handlePrint}
      onSavePdf={handleSavePdf}
    >
      {isLoadingLines ? (
        <div className="empty-state">
          <strong>Cargando líneas de factura</strong>
          <p>Preparando la vista previa con los conceptos reales.</p>
        </div>
      ) : linesError ? (
        <div className="empty-state">
          <strong>No se pudieron cargar las líneas</strong>
          <p>{linesError}</p>
        </div>
      ) : (
        <InvoiceDocumentA4 invoice={hydratedInvoice} variant="embedded" />
      )}
    </DocumentScreenFrame>
  )
}
