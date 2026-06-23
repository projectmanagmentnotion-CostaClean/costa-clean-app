import type { InvoiceListItem } from './types'
import { formatCurrency } from '../../app/displayFormat'
import { getStatusLabel } from '../../app/displayText'
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

        <div className="empty-state">
          <strong>No hay factura para previsualizar</strong>
          <p>Selecciona una factura en el listado para ver el documento.</p>
        </div>
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
        </DocumentThumbnail>
      </div>
    </section>
  )
}
