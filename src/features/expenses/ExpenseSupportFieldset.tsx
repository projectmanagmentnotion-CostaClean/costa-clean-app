import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
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
import './expense-support-fieldset.css'

interface ExpenseSupportFieldsetProps {
  expense?: ExpenseListItem | null
  pendingFile?: File | null
  documentType: string
  documentSupportStatus: string
  onPendingFileChange?: (file: File | null) => void
  onDocumentSupportStatusChange?: (status: string) => void
  onExpenseUpdated?: () => Promise<void>
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

function getPendingFileLabel(file: File | null | undefined): string {
  if (!file) return 'Sin archivo preparado'
  if (file.type === 'application/pdf') return 'PDF preparado'
  if (file.type.startsWith('image/')) return 'Imagen preparada'
  return 'Archivo preparado'
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function validateReceiptFile(file: File) {
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
}

export function ExpenseSupportFieldset({
  expense = null,
  pendingFile = null,
  documentType,
  documentSupportStatus,
  onPendingFileChange,
  onDocumentSupportStatusChange,
  onExpenseUpdated,
}: ExpenseSupportFieldsetProps) {
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false)
  const [isDeletingReceipt, setIsDeletingReceipt] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const receiptInputRef = useRef<HTMLInputElement | null>(null)
  const isPersistedMode = Boolean(expense)

  const fileMeta = useMemo(() => {
    if (expense?.receipt_file_path) {
      return {
        title: 'Documento cargado',
        detail: getFileTypeLabel(expense.receipt_file_path),
      }
    }

    if (pendingFile) {
      return {
        title: pendingFile.name,
        detail: `${getPendingFileLabel(pendingFile)} · ${formatFileSize(pendingFile.size)}`,
      }
    }

    return {
      title: 'Sin documento',
      detail: isPersistedMode
        ? 'Todavia no existe archivo asociado.'
        : 'Podras subir ticket o factura y se asociara al guardar.',
    }
  }, [expense, isPersistedMode, pendingFile])

  useEffect(() => {
    setSaveError(null)
    setSuccessMessage(null)
  }, [expense?.id, pendingFile])

  async function handlePersistedUpload(file: File) {
    if (!expense || !onExpenseUpdated) return

    if (expense.receipt_file_path) {
      await deleteExpenseReceipt(expense.receipt_file_path)
    }

    const { filePath } = await uploadExpenseReceipt(expense.id, file)
    await updateExpenseAttachment(expense.id, filePath)
    await onExpenseUpdated()
  }

  async function handleReceiptSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setSaveError(null)
    setSuccessMessage(null)

    try {
      validateReceiptFile(file)

      if (isPersistedMode) {
        setIsUploadingReceipt(true)
        await handlePersistedUpload(file)
        setSuccessMessage('Documento actualizado correctamente.')
      } else {
        onPendingFileChange?.(file)
        if (documentSupportStatus === 'missing') {
          onDocumentSupportStatusChange?.('pending_review')
        }
        setSuccessMessage('Documento preparado. Se subira automaticamente al guardar el gasto.')
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido gestionando el documento.'
      setSaveError(message)
    } finally {
      setIsUploadingReceipt(false)
      if (receiptInputRef.current) {
        receiptInputRef.current.value = ''
      }
    }
  }

  async function handleOpenReceipt() {
    if (expense?.receipt_file_path) {
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
      return
    }

    if (!pendingFile) return

    const objectUrl = URL.createObjectURL(pendingFile)
    window.open(objectUrl, '_blank', 'noopener,noreferrer')
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
  }

  async function handleDeletePersistedReceipt() {
    if (!expense?.receipt_file_path || !onExpenseUpdated) return

    setShowDeleteConfirm(false)
    setSaveError(null)
    setSuccessMessage(null)
    setIsDeletingReceipt(true)

    try {
      await deleteExpenseReceipt(expense.receipt_file_path)
      await updateExpenseAttachment(expense.id, null)
      await onExpenseUpdated()
      if (documentSupportStatus === 'pending_review' || documentSupportStatus === 'ticket' || documentSupportStatus === 'invoice_valid') {
        onDocumentSupportStatusChange?.('missing')
      }
      setSuccessMessage('Documento eliminado correctamente.')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido eliminando el documento.'
      setSaveError(message)
    } finally {
      setIsDeletingReceipt(false)
    }
  }

  function handleClearPendingFile() {
    onPendingFileChange?.(null)
    if (documentSupportStatus === 'pending_review') {
      onDocumentSupportStatusChange?.('missing')
    }
    setSuccessMessage(null)
  }

  return (
    <section className="cc-expense-support-fieldset">
      <div className="cc-expense-support-fieldset__head">
        <strong>Soporte documental</strong>
        <span>
          {isPersistedMode
            ? 'Puedes ver, sustituir o eliminar el soporte sin salir del flow.'
            : 'Prepara el ticket o la factura aqui y se subira al guardar.'}
        </span>
      </div>

      <div className="cc-expense-support-fieldset__grid">
        <article className="cc-expense-support-fieldset__card">
          <span className="cc-expense-support-fieldset__label">Estado documental</span>
          <strong>{getExpenseDocumentSupportStatusLabel(documentSupportStatus)}</strong>
          <small>Estado visible dentro del paso actual.</small>
        </article>

        <article className="cc-expense-support-fieldset__card">
          <span className="cc-expense-support-fieldset__label">Documento esperado</span>
          <strong>{getExpenseDocumentTypeLabel(documentType)}</strong>
          <small>Tipo declarado para este gasto.</small>
        </article>

        <article className="cc-expense-support-fieldset__card">
          <span className="cc-expense-support-fieldset__label">Archivo</span>
          <strong>{fileMeta.title}</strong>
          <small>{fileMeta.detail}</small>
        </article>

        <article className="cc-expense-support-fieldset__card">
          <span className="cc-expense-support-fieldset__label">Momento de carga</span>
          <strong>{isPersistedMode ? 'Inmediato' : 'Al guardar'}</strong>
          <small>
            {isPersistedMode
              ? 'El cambio se persiste al momento sobre este gasto.'
              : 'No sales del flow y el archivo queda asociado en el alta final.'}
          </small>
        </article>
      </div>

      <input
        ref={receiptInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleReceiptSelected}
      />

      <div className="cc-expense-support-fieldset__actions">
        <button
          type="button"
          className="primary-button"
          onClick={() => receiptInputRef.current?.click()}
          disabled={isUploadingReceipt}
        >
          {isUploadingReceipt
            ? 'Subiendo documento...'
            : expense?.receipt_file_path || pendingFile
              ? 'Sustituir documento'
              : 'Subir ticket o factura'}
        </button>

        {(expense?.receipt_file_path || pendingFile) ? (
          <button
            type="button"
            className="secondary-button"
            onClick={() => void handleOpenReceipt()}
          >
            Ver documento
          </button>
        ) : null}

        {expense?.receipt_file_path ? (
          <button
            type="button"
            className="secondary-button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isDeletingReceipt}
          >
            {isDeletingReceipt ? 'Eliminando...' : 'Eliminar documento'}
          </button>
        ) : null}

        {!expense && pendingFile ? (
          <button
            type="button"
            className="secondary-button"
            onClick={handleClearPendingFile}
          >
            Quitar preparado
          </button>
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
          <strong>Soporte actualizado</strong>
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
          void handleDeletePersistedReceipt()
        }}
      />
    </section>
  )
}
