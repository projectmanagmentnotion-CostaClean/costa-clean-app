import type { InvoiceListItem } from './types'
import { InvoiceDocumentA4 } from './InvoiceDocumentA4'

interface InvoiceDocumentPreviewProps {
  invoice: InvoiceListItem | null
}

export function InvoiceDocumentPreview({
  invoice,
}: InvoiceDocumentPreviewProps) {
  if (!invoice) {
    return (
      <section className="data-section cc-doc-preview-panel">
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

  return (
    <section className="data-section cc-doc-preview-panel">
      <div className="section-header">
        <h2>Vista previa de factura</h2>
        <p>Documento fiscal presentado en una vista optimizada para móvil.</p>
      </div>

      <div className="cc-doc-preview-panel__viewport">
        <div className="cc-doc-preview-panel__canvas">
          <InvoiceDocumentA4 invoice={invoice} variant="embedded" />
        </div>
      </div>
    </section>
  )
}