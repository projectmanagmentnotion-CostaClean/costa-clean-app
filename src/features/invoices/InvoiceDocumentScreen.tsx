import { useMemo } from 'react'
import type { InvoiceListItem } from './types'
import { InvoiceDocumentA4 } from './InvoiceDocumentA4'
import {
  getInvoiceDocumentTitle,
  openInvoicePrintWindow,
} from './openInvoicePrintWindow'
import { shareDocumentSummary } from '../documents/utils'
import { DocumentScreenFrame } from '../documents/DocumentScreenFrame'

interface InvoiceDocumentScreenProps {
  invoice: InvoiceListItem
  onClose: () => void
}

export function InvoiceDocumentScreen({
  invoice,
  onClose,
}: InvoiceDocumentScreenProps) {
  const documentTitle = useMemo(() => getInvoiceDocumentTitle(invoice), [invoice])

  function handlePrint() {
    openInvoicePrintWindow(invoice, 'print')
  }

  function handleSavePdf() {
    openInvoicePrintWindow(invoice, 'pdf')
  }

  async function handleShare() {
    await shareDocumentSummary(
      documentTitle,
      [`Total: ${invoice.total}`, `Estado: ${invoice.status}`],
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
      <InvoiceDocumentA4 invoice={invoice} variant="embedded" />
    </DocumentScreenFrame>
  )
}
