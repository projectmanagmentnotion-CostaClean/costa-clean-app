import { useMemo, useState } from 'react'
import { getStatusLabel } from '../../app/displayText'
import { DSConfirmDialog } from '../../design-system/components/DSConfirmDialog'
import { DSErrorState } from '../../design-system/components/DSErrorState'
import { DSLoadingState } from '../../design-system/components/DSLoadingState'
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
  const [outputError, setOutputError] = useState<string | null>(null)
  const [isOpeningOutput, setIsOpeningOutput] = useState(false)
  const {
    invoice: hydratedInvoice,
    isLoadingLines,
    linesError,
  } = useInvoiceDocumentLines(invoice)
  const documentTitle = useMemo(() => getInvoiceDocumentTitle(hydratedInvoice), [hydratedInvoice])

  function handlePrint() {
    if (!isLoadingLines && !linesError) {
      setOutputError(null)
      setPendingOutputIntent('print')
    }
  }

  function handleSavePdf() {
    if (!isLoadingLines && !linesError) {
      setOutputError(null)
      setPendingOutputIntent('pdf')
    }
  }

  async function handleConfirmOpenWindow() {
    if (!pendingOutputIntent) return

    setIsOpeningOutput(true)
    setOutputError(null)

    try {
      const didOpenOutput = await openInvoiceDocumentOutput(hydratedInvoice, pendingOutputIntent)
      setPendingOutputIntent(null)
      if (!didOpenOutput) {
        setOutputError('El navegador bloqueó la ventana emergente. Permite pop-ups para imprimir o guardar PDF.')
      }
    } catch (err) {
      setPendingOutputIntent(null)
      setOutputError(err instanceof Error ? err.message : 'No se pudo abrir la salida del documento.')
    } finally {
      setIsOpeningOutput(false)
    }
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

      <DSConfirmDialog
        isOpen={Boolean(pendingOutputIntent)}
        title={pendingOutputIntent === 'pdf' ? 'Abrir ventana para guardar PDF' : 'Abrir ventana de impresion'}
        description="El navegador abrira una nueva ventana o pestana para preparar la factura. Si las ventanas emergentes estan bloqueadas, habilitalas temporalmente para continuar."
        confirmLabel={pendingOutputIntent === 'pdf' ? 'Abrir y guardar PDF' : 'Abrir e imprimir'}
        isBusy={isOpeningOutput}
        onCancel={() => setPendingOutputIntent(null)}
        onConfirm={() => void handleConfirmOpenWindow()}
      />
    </>
  )
}
