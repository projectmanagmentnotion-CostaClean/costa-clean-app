import { useRef, useState, type ChangeEvent } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { updateExpenseAttachment } from './expenseApi'
import {
  createExpenseReceiptSignedUrl,
  deleteExpenseReceipt,
  uploadExpenseReceipt,
} from './expenseAttachmentsApi'
import {
  getExpenseDocumentSupportStatusLabel,
  getExpenseDocumentTypeLabel,
  type ExpenseListItem,
} from './types'

interface ExpenseSupportPanelProps {
  expense: ExpenseListItem
  onExpenseUpdated: () => Promise<void>
}

function getFileTypeLabel(filePath: string | null | undefined): string {
  if (!filePath) return 'Sin documento'
  const lower = filePath.toLowerCase()
  if (lower.endsWith('.pdf')) return 'PDF'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'Imagen JPG'
  if (lower.endsWith('.png')) return 'Imagen PNG'
  if (lower.endsWith('.webp')) return 'Imagen WEBP'
  return 'Documento'
}

export function ExpenseSupportPanel({
  expense,
  onExpenseUpdated,
}: ExpenseSupportPanelProps) {
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false)
  const [isDeletingReceipt, setIsDeletingReceipt] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const receiptInputRef = useRef<HTMLInputElement | null>(null)

  async function handleReceiptSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setSaveError(null)
    setSuccessMessage(null)
    setIsUploadingReceipt(true)

    try {
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
      ]

      if (!allowedTypes.includes(file.type)) {
        throw new Error('Solo se permiten archivos PDF, JPG, PNG o WEBP.')
      }

      if (file.size > 10 * 1024 * 1024) {
        throw new Error('El archivo supera el limite de 10 MB.')
      }

      if (expense.receipt_file_path) {
        await deleteExpenseReceipt(expense.receipt_file_path)
      }

      const { filePath } = await uploadExpenseReceipt(expense.id, file)
      await updateExpenseAttachment(expense.id, filePath)
      await onExpenseUpdated()
      setSuccessMessage('Documento actualizado correctamente.')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido subiendo el documento.'
      setSaveError(message)
    } finally {
      setIsUploadingReceipt(false)
      if (receiptInputRef.current) {
        receiptInputRef.current.value = ''
      }
    }
  }

  async function handleOpenReceipt() {
    if (!expense.receipt_file_path) return

    setSaveError(null)
    setSuccessMessage(null)

    try {
      const signedUrl = await createExpenseReceiptSignedUrl(expense.receipt_file_path)
      window.open(signedUrl, '_blank', 'noopener,noreferrer')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido abriendo el documento.'
      setSaveError(message)
    }
  }

  async function deleteReceiptAfterConfirmation() {
    if (!expense.receipt_file_path) return

    setShowDeleteConfirm(false)
    setSaveError(null)
    setSuccessMessage(null)
    setIsDeletingReceipt(true)

    try {
      await deleteExpenseReceipt(expense.receipt_file_path)
      await updateExpenseAttachment(expense.id, null)
      await onExpenseUpdated()
      setSuccessMessage('Documento eliminado correctamente.')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido eliminando el documento.'
      setSaveError(message)
    } finally {
      setIsDeletingReceipt(false)
    }
  }

  return (
    <section className="data-section cc-expense-surface">
      <div className="section-header page-header-actions">
        <div>
          <h2>Soporte documental</h2>
          <p>Esta superficie gestiona ticket, factura y trazabilidad documental sin mezclar edicion fiscal.</p>
        </div>
      </div>

      <div className="cc-expense-surface__grid">
        <article className="cc-expense-surface__card">
          <span className="cc-expense-surface__label">Estado documental</span>
          <strong>{getExpenseDocumentSupportStatusLabel(expense.document_support_status)}</strong>
          <small>Lectura rapida del soporte declarado para este gasto.</small>
        </article>

        <article className="cc-expense-surface__card">
          <span className="cc-expense-surface__label">Documento esperado</span>
          <strong>{getExpenseDocumentTypeLabel(expense.document_type)}</strong>
          <small>Tipo declarado en el registro del gasto.</small>
        </article>

        <article className="cc-expense-surface__card">
          <span className="cc-expense-surface__label">Archivo actual</span>
          <strong>{expense.receipt_file_path ? 'Documento cargado' : 'Sin documento'}</strong>
          <small>{getFileTypeLabel(expense.receipt_file_path)}</small>
        </article>

        <article className="cc-expense-surface__card">
          <span className="cc-expense-surface__label">Adjuntos</span>
          <strong>{expense.attachment_count ?? 0}</strong>
          <small>Conteo persistido para este gasto.</small>
        </article>
      </div>

      <input
        ref={receiptInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleReceiptSelected}
      />

      <div className="cc-expense-surface__actions">
        <button
          type="button"
          className="primary-button"
          onClick={() => receiptInputRef.current?.click()}
          disabled={isUploadingReceipt}
        >
          {isUploadingReceipt
            ? 'Subiendo documento...'
            : expense.receipt_file_path
              ? 'Actualizar documento'
              : 'Subir ticket o factura'}
        </button>

        {expense.receipt_file_path ? (
          <>
            <button type="button" className="secondary-button" onClick={() => void handleOpenReceipt()}>
              Ver documento
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeletingReceipt}
            >
              {isDeletingReceipt ? 'Eliminando...' : 'Eliminar documento'}
            </button>
          </>
        ) : null}
      </div>

      {saveError ? (
        <div className="cc-alert cc-alert--error">
          <strong>No se pudo completar la operacion</strong>
          <p>{saveError}</p>
        </div>
      ) : null}

      {successMessage ? (
        <div className="cc-alert cc-alert--success">
          <strong>Operacion correcta</strong>
          <p>{successMessage}</p>
        </div>
      ) : null}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Eliminar documento del gasto"
        description="Se eliminara el soporte adjunto de este gasto. La ficha seguira existiendo, pero quedara sin documento."
        confirmLabel="Eliminar documento"
        tone="warning"
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          void deleteReceiptAfterConfirmation()
        }}
      />
    </section>
  )
}
