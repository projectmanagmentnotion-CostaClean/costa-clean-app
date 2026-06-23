import { ConfirmDialog } from '../../components/ConfirmDialog'
import type { ExpenseListItem } from '../expenses/types'
import type { InvoiceListItem } from '../invoices/types'

interface ClosingDocumentDialogsProps {
  pendingInvoicePdf: InvoiceListItem | null
  pendingExpenseDocument: ExpenseListItem | null
  onCancelInvoicePdf: () => void
  onConfirmInvoicePdf: () => void
  onCancelExpenseDocument: () => void
  onConfirmExpenseDocument: () => void
}

export function ClosingDocumentDialogs({
  pendingInvoicePdf,
  pendingExpenseDocument,
  onCancelInvoicePdf,
  onConfirmInvoicePdf,
  onCancelExpenseDocument,
  onConfirmExpenseDocument,
}: ClosingDocumentDialogsProps) {
  return (
    <>
      <ConfirmDialog
        isOpen={Boolean(pendingInvoicePdf)}
        title="Abrir PDF de factura"
        description="El navegador abrira una nueva ventana o pestana para preparar el PDF de esta factura del cierre. Continua solo si quieres generar el documento ahora."
        confirmLabel="Abrir PDF"
        onCancel={onCancelInvoicePdf}
        onConfirm={onConfirmInvoicePdf}
      />

      <ConfirmDialog
        isOpen={Boolean(pendingExpenseDocument)}
        title="Abrir soporte del gasto"
        description="El soporte documental del gasto se abrira en una nueva pestana o ventana mediante un enlace temporal seguro."
        confirmLabel="Abrir soporte"
        onCancel={onCancelExpenseDocument}
        onConfirm={onConfirmExpenseDocument}
      />
    </>
  )
}
