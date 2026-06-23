import { useMemo, useState } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { getStatusLabel } from '../../app/displayText'
import '../documents/documentSurfaceStyles'
import type { InvoiceListItem } from './types'
import { InvoiceDocumentA4 } from './InvoiceDocumentA4'
import { getInvoiceDocumentTitle } from './openInvoicePrintWindow'
import { shareDocumentSummary } from '../documents/utils'
import { DocumentScreenFrame } from '../documents/DocumentScreenFrame'
import { useInvoiceDocumentLines } from './useInvoiceDocumentLines'
import { openInvoiceDocumentOutput } from '../documents/documentOutputRuntime'

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

  async function handleConfirmOpenWindow() {
    if (!pendingOutputIntent) return

    await openInvoiceDocumentOutput(hydratedInvoice, pendingOutputIntent)
    setPendingOutputIntent(null)
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
      >
        {isLoadingLines ? (
          <div className="empty-state cc-state-card cc-state-card--loading">
            <strong>Cargando lineas de factura</strong>
            <p>Preparando la vista previa con los conceptos reales.</p>
          </div>
        ) : linesError ? (
          <div className="empty-state">
            <strong>No se pudieron cargar las lineas</strong>
            <p>{linesError}</p>
          </div>
        ) : (
          <InvoiceDocumentA4 invoice={hydratedInvoice} variant="embedded" />
        )}
      </DocumentScreenFrame>

      <ConfirmDialog
        isOpen={Boolean(pendingOutputIntent)}
        title={pendingOutputIntent === 'pdf' ? 'Abrir ventana para guardar PDF' : 'Abrir ventana de impresion'}
        description="El navegador abrira una nueva ventana o pestana para preparar la factura. Si las ventanas emergentes estan bloqueadas, habilitalas temporalmente para continuar."
        confirmLabel={pendingOutputIntent === 'pdf' ? 'Abrir y guardar PDF' : 'Abrir e imprimir'}
        onCancel={() => setPendingOutputIntent(null)}
        onConfirm={() => void handleConfirmOpenWindow()}
      />
    </>
  )
}
