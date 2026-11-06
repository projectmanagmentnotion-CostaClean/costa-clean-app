import '../../features/documents/documentSurfaceStyles'
import { getStatusLabel } from '../../app/displayText'
import type { InvoiceListItem } from '../../features/invoices/types'
import { InvoiceDocumentA4 } from '../../features/invoices/InvoiceDocumentA4'
import { useInvoiceDocumentLines } from '../../features/invoices/useInvoiceDocumentLines'
import { V3DocumentPreview, V3DocumentPreviewLoading } from '../documents/V3DocumentPreview'

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

  return <V3DocumentPreview documentKind="invoice" title="Vista previa de factura" description="Documento A4 real con los datos y líneas fiscales actuales." statusLabel={getStatusLabel(hydratedInvoice.status)} statusTone={statusTone(hydratedInvoice.status)} error={linesError} onOpenDocument={onOpenDocument}>{isLoadingLines ? <V3DocumentPreviewLoading label="Cargando líneas de factura" description="Preparando el documento canónico." /> : <InvoiceDocumentA4 invoice={hydratedInvoice} variant="embedded" />}</V3DocumentPreview>
}
