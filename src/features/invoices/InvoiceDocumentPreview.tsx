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
      <section className="data-section">
        <div className="section-header">
          <h2>Plantilla de factura</h2>
          <p>Vista documental HTML/CSS alineada con tu branding real.</p>
        </div>

        <div className="empty-state">
          <strong>No hay factura para previsualizar</strong>
          <p>Selecciona una factura en el listado para ver la plantilla documental.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="data-section">
      <div className="section-header">
        <h2>Plantilla de factura</h2>
        <p>Vista documental HTML/CSS alineada con tu branding real.</p>
      </div>

      <InvoiceDocumentA4 invoice={invoice} variant="embedded" />
    </section>
  )
}
