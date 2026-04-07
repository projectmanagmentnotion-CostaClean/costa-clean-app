import type { InvoiceListItem } from './types'
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
          <h2>Vista previa de factura</h2>
          <p>Previsualización documental adaptada para revisión rápida en móvil.</p>
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
        <h2>Vista previa de factura</h2>
        <p>Documento fiscal presentado en una vista optimizada para móvil.</p>
      </div>

      <div className="cc-doc-preview-panel__viewport">
        <div className="cc-doc-preview-panel__canvas">
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
        </div>
      </div>
    </section>
  )
}
