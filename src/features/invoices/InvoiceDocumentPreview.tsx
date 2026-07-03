import type { InvoiceListItem } from './types'
import { formatCurrency } from '../../app/displayFormat'
import { getStatusLabel } from '../../app/displayText'
import { DSEmptyState } from '../../design-system/components/DSEmptyState'
import { DSErrorState } from '../../design-system/components/DSErrorState'
import { DSLoadingState } from '../../design-system/components/DSLoadingState'
import '../documents/documentSurfaceStyles'
import { DocumentThumbnail } from '../documents/DocumentThumbnail'
import { InvoiceDocumentA4 } from './InvoiceDocumentA4'
import { useInvoiceDocumentLines } from './useInvoiceDocumentLines'

interface InvoiceDocumentPreviewProps {
  invoice: InvoiceListItem | null
}

export function InvoiceDocumentPreview({
  invoice,
}: InvoiceDocumentPreviewProps) {
  if (!invoice) {
    return (
      <section className="data-section cc-doc-preview-panel cc-doc-preview-panel--invoice">
        <div className="section-header">
          <div>
            <h2>Vista previa de factura</h2>
            <p>Previsualizacion documental adaptada para revision rapida en movil.</p>
          </div>
        </div>

        <DSEmptyState
          title="No hay factura para previsualizar"
          description="Selecciona una factura en el listado para ver el documento."
        />
      </section>
    )
  }

  return <InvoiceDocumentPreviewContent invoice={invoice} />
}

function InvoiceDocumentPreviewContent({
  invoice,
}: {
  invoice: InvoiceListItem
}) {
  const {
    invoice: hydratedInvoice,
    isLoadingLines,
    linesError,
  } = useInvoiceDocumentLines(invoice)

  return (
    <section className="data-section cc-doc-preview-panel cc-doc-preview-panel--invoice">
      <div className="section-header">
        <div>
          <h2>Vista previa de factura</h2>
          <p>Documento fiscal presentado en una vista optimizada para movil.</p>
        </div>
        <div className="cc-doc-preview-panel__meta" aria-label="Resumen del documento">
          <span className={`lead-badge cc-status-badge cc-status-badge--${hydratedInvoice.status}`}>{getStatusLabel(hydratedInvoice.status)}</span>
          <span className="cc-doc-preview-panel__pill">{formatCurrency(hydratedInvoice.total)}</span>
        </div>
      </div>

      <div className="cc-doc-preview-panel__viewport">
        <DocumentThumbnail>
          {isLoadingLines ? (
            <DSLoadingState
              title="Cargando lineas de factura"
              description="Preparando la vista previa con los conceptos reales."
            />
          ) : linesError ? (
            <DSErrorState title="No se pudieron cargar las lineas" description={linesError} />
          ) : (
            <InvoiceDocumentA4 invoice={hydratedInvoice} variant="embedded" />
          )}
        </DocumentThumbnail>
      </div>
    </section>
  )
}
