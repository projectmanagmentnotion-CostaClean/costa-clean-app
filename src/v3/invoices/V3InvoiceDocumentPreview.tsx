import '../../features/documents/documentSurfaceStyles'
import { getStatusLabel } from '../../app/displayText'
import type { InvoiceListItem } from '../../features/invoices/types'
import { InvoiceDocumentA4 } from '../../features/invoices/InvoiceDocumentA4'
import { useInvoiceDocumentLines } from '../../features/invoices/useInvoiceDocumentLines'
import { V3ErrorState, V3LoadingState, V3SecondaryAction, V3Status } from '../components/V3Primitives'

interface V3InvoiceDocumentPreviewProps {
  invoice: InvoiceListItem
  onOpenDocument: () => void
}

function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'paid') return 'success'
  if (status === 'cancelled') return 'danger'
  if (status === 'partially_paid') return 'warning'
  return 'neutral'
}

export function V3InvoiceDocumentPreview({ invoice, onOpenDocument }: V3InvoiceDocumentPreviewProps) {
  const { invoice: hydratedInvoice, isLoadingLines, linesError } = useInvoiceDocumentLines(invoice)

  return (
    <section className="v3-invoice-preview" aria-labelledby="v3-invoice-preview-title">
      <div className="v3-invoice-preview__header">
        <div>
          <h2 id="v3-invoice-preview-title">Vista previa de factura</h2>
          <p>Revisa el documento con los datos y líneas fiscales actuales.</p>
        </div>
        <V3Status label={getStatusLabel(hydratedInvoice.status)} tone={statusTone(hydratedInvoice.status)} />
      </div>
      <div className="v3-invoice-preview__actions">
        <V3SecondaryAction onClick={onOpenDocument}>Abrir Documento</V3SecondaryAction>
      </div>
      <div className="v3-invoice-preview__viewport">
        {isLoadingLines ? <V3LoadingState label="Cargando líneas de factura" /> : linesError ? <V3ErrorState title="No se pudo cargar la vista previa" description={linesError} /> : <InvoiceDocumentA4 invoice={hydratedInvoice} variant="embedded" />}
      </div>
    </section>
  )
}
