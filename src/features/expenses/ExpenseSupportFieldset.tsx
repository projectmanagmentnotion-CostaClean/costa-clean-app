import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { updateExpenseAttachment } from './expenseApi'
import { ExpenseReceiptPreviewDocument } from './ExpenseReceiptPreviewDocument'
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
import {
  EXPENSE_RECEIPT_PREVIEW_URL_TTL_SECONDS,
  getExpenseReceiptPreviewKind,
  type ExpenseReceiptPreviewKind,
} from './expenseReceiptPreview'
import './expense-support-fieldset.css'

type ReceiptPreview = {
  kind: ExpenseReceiptPreviewKind
  source: 'storage' | 'local'
  url: string | null
  expired: boolean
}

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
  const [receiptPreview, setReceiptPreview] = useState<ReceiptPreview | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const receiptInputRef = useRef<HTMLInputElement | null>(null)
  const previewButtonRef = useRef<HTMLButtonElement | null>(null)
  const closePreviewButtonRef = useRef<HTMLButtonElement | null>(null)
  const localObjectUrlRef = useRef<string | null>(null)
  const expiryTimerRef = useRef<number | null>(null)
  const previewRequestIdRef = useRef(0)
  const isPersistedMode = Boolean(expense)
  const isPreviewOpen = receiptPreview !== null

  const closeReceiptPreview = useCallback(() => {
    previewRequestIdRef.current += 1
    if (expiryTimerRef.current !== null) {
      window.clearTimeout(expiryTimerRef.current)
      expiryTimerRef.current = null
    }
    if (localObjectUrlRef.current) {
      URL.revokeObjectURL(localObjectUrlRef.current)
      localObjectUrlRef.current = null
    }
    setReceiptPreview(null)
    setPreviewError(null)
    setIsLoadingPreview(false)
  }, [])

  useEffect(() => {
    if (!isPreviewOpen) return undefined

    const previewTrigger = previewButtonRef.current
    closePreviewButtonRef.current?.focus()
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeReceiptPreview()
    }
    window.addEventListener('keydown', handleKeydown)

    return () => {
      window.removeEventListener('keydown', handleKeydown)
      previewTrigger?.focus()
    }
  }, [closeReceiptPreview, isPreviewOpen])

  useEffect(() => () => {
    if (localObjectUrlRef.current) URL.revokeObjectURL(localObjectUrlRef.current)
    if (expiryTimerRef.current !== null) window.clearTimeout(expiryTimerRef.current)
  }, [])

  async function loadPersistedPreview(filePath: string, kind: ExpenseReceiptPreviewKind) {
    const requestId = ++previewRequestIdRef.current
    setIsLoadingPreview(true)
    setPreviewError(null)
    try {
      const signedUrl = await createExpenseReceiptSignedUrl(filePath, EXPENSE_RECEIPT_PREVIEW_URL_TTL_SECONDS)
      if (requestId !== previewRequestIdRef.current) return
      if (expiryTimerRef.current !== null) window.clearTimeout(expiryTimerRef.current)
      setReceiptPreview({ kind, source: 'storage', url: signedUrl, expired: false })
      expiryTimerRef.current = window.setTimeout(() => {
        setReceiptPreview((current) => current?.source === 'storage'
          ? { ...current, url: null, expired: true }
          : current)
        expiryTimerRef.current = null
      }, EXPENSE_RECEIPT_PREVIEW_URL_TTL_SECONDS * 1000)
    } catch {
      if (requestId !== previewRequestIdRef.current) return
      setPreviewError('No se pudo acceder al documento. Puede que ya no esté disponible; inténtalo de nuevo.')
    } finally {
      if (requestId === previewRequestIdRef.current) setIsLoadingPreview(false)
    }
  }

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
      const kind = getExpenseReceiptPreviewKind(expense.receipt_file_path)
      if (!kind) {
        setPreviewError('Este tipo de documento no admite vista previa.')
        setReceiptPreview({ kind: 'image', source: 'storage', url: null, expired: false })
        return
      }
      setReceiptPreview({ kind, source: 'storage', url: null, expired: false })
      await loadPersistedPreview(expense.receipt_file_path, kind)
      return
    }

    if (!pendingFile) return
    const kind = pendingFile.type === 'application/pdf' ? 'pdf' : 'image'
    if (localObjectUrlRef.current) URL.revokeObjectURL(localObjectUrlRef.current)
    const objectUrl = URL.createObjectURL(pendingFile)
    localObjectUrlRef.current = objectUrl
    setPreviewError(null)
    setReceiptPreview({ kind, source: 'local', url: objectUrl, expired: false })
  }

  async function handleRefreshPreview() {
    if (!receiptPreview) return
    if (receiptPreview.source === 'storage' && expense?.receipt_file_path) {
      await loadPersistedPreview(expense.receipt_file_path, receiptPreview.kind)
      return
    }
    if (receiptPreview.source === 'local' && pendingFile) {
      if (localObjectUrlRef.current) URL.revokeObjectURL(localObjectUrlRef.current)
      const objectUrl = URL.createObjectURL(pendingFile)
      localObjectUrlRef.current = objectUrl
      setPreviewError(null)
      setReceiptPreview({ ...receiptPreview, url: objectUrl, expired: false })
    }
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
            ref={previewButtonRef}
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

      {receiptPreview ? (
        <div className="cc-confirm-dialog cc-expense-receipt-preview" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) closeReceiptPreview()
        }}>
          <section
            className="cc-confirm-dialog__panel cc-expense-receipt-preview__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cc-expense-receipt-preview-title"
            aria-busy={isLoadingPreview}
          >
            <header className="cc-expense-receipt-preview__header">
              <div>
                <span className="cc-confirm-dialog__eyebrow">Soporte privado</span>
                <h2 id="cc-expense-receipt-preview-title">Vista previa del justificante</h2>
                <p>El acceso es temporal y se renueva solo cuando lo solicitas.</p>
              </div>
              <button
                ref={closePreviewButtonRef}
                type="button"
                className="secondary-button"
                onClick={closeReceiptPreview}
                aria-label="Cerrar vista previa"
              >
                Cerrar
              </button>
            </header>

            <div className="cc-expense-receipt-preview__viewport" aria-live="polite">
              {isLoadingPreview ? <p role="status">Preparando vista previa…</p> : null}
              {previewError ? <p className="cc-alert cc-alert--error" role="alert">{previewError}</p> : null}
              {receiptPreview.expired ? <p role="status">El enlace privado ha caducado.</p> : null}
              {!isLoadingPreview && !previewError && !receiptPreview.expired && receiptPreview.url ? (
                <ExpenseReceiptPreviewDocument
                  kind={receiptPreview.kind}
                  url={receiptPreview.url}
                  onError={() => {
                    setReceiptPreview((current) => current ? { ...current, url: null } : current)
                    setPreviewError('No se pudo mostrar el documento. Puede que el enlace haya caducado.')
                  }}
                />
              ) : null}
              {receiptPreview.source === 'storage' && !isLoadingPreview && (receiptPreview.expired || previewError) ? (
                <button type="button" className="primary-button" onClick={() => void handleRefreshPreview()}>
                  Renovar acceso
                </button>
              ) : null}
              {receiptPreview.source === 'local' && previewError ? (
                <button type="button" className="primary-button" onClick={() => void handleRefreshPreview()}>
                  Volver a intentar
                </button>
              ) : null}
            </div>
          </section>
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
