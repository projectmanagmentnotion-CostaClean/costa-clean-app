import { useMemo, useState } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
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
  const [pendingOutputIntent, setPendingOutputIntent] = useState<'print' | 'pdf' | null>(null)
  const {
    invoice: hydratedInvoice,
    isLoadingLines,
    linesError,
  } = useInvoiceDocumentLines(invoice)
  const documentTitle = useMemo(() => getInvoiceDocumentTitle(hydratedInvoice), [hydratedInvoice])

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

    openInvoicePrintWindow(hydratedInvoice, pendingOutputIntent)
    setPendingOutputIntent(null)
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
    <>
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
          <div className="empty-state cc-state-card cc-state-card--loading">
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

      <ConfirmDialog
        isOpen={Boolean(pendingOutputIntent)}
        title={pendingOutputIntent === 'pdf' ? 'Abrir ventana para guardar PDF' : 'Abrir ventana de impresión'}
        description="El navegador abrirá una nueva ventana o pestaña para preparar la factura. Si el navegador bloquea ventanas emergentes, permite pop-ups para CostaClean CRM."
        confirmLabel={pendingOutputIntent === 'pdf' ? 'Abrir y guardar PDF' : 'Abrir e imprimir'}
        onCancel={() => setPendingOutputIntent(null)}
        onConfirm={handleConfirmOpenWindow}
      />
    </>
  )
}
