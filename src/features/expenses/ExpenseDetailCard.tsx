import { useEffect, useRef, useState, type FormEvent } from 'react'
import { updateExpense, updateExpenseAttachment } from './expenseApi'
import {
  createExpenseReceiptSignedUrl,
  deleteExpenseReceipt,
  uploadExpenseReceipt,
} from './expenseAttachmentsApi'
import {
  expenseCategories,
  expenseDocumentSupportStatuses,
  expenseDocumentTypes,
  expenseFiscalReviewStatuses,
  expenseFiscalRiskLevels,
  expensePaymentStatuses,
  getExpenseCategoryLabel,
  getExpenseDocumentSupportStatusLabel,
  getExpenseDocumentTypeLabel,
  getExpenseFiscalReviewStatusLabel,
  getExpenseFiscalRiskLevelLabel,
  getExpensePaymentStatusLabel,
  type ExpenseListItem,
} from './types'

interface ExpenseDetailCardProps {
  expense: ExpenseListItem | null
  onExpenseUpdated: () => Promise<void>
}

interface EditFormState {
  expense_date: string
  supplier_name: string
  category: string
  description: string
  document_type: string
  payment_status: string
  subtotal: string
  tax_rate: string
  tax_amount: string
  total: string
  is_deductible: boolean
  document_support_status: string
  fiscal_review_status: string
  fiscal_risk_level: string
  manager_note: string
  notes: string
}

function formatCurrency(value: number | null | undefined): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(value ?? 0))
}

function formatDateEs(value: string | null | undefined): string {
  if (!value) return 'Sin fecha'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function parseDecimalInput(value: string): number {
  const normalized = value.trim().replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function formatMoneyInput(value: number | null | undefined): string {
  return Number(value ?? 0).toFixed(2)
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

export function ExpenseDetailCard({
  expense,
  onExpenseUpdated,
}: ExpenseDetailCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false)
  const [isDeletingReceipt, setIsDeletingReceipt] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [form, setForm] = useState<EditFormState>({
    expense_date: '',
    supplier_name: '',
    category: 'otros',
    description: '',
    document_type: 'ticket',
    payment_status: 'paid',
    subtotal: '0.00',
    tax_rate: '21.00',
    tax_amount: '0.00',
    total: '0.00',
    is_deductible: true,
    document_support_status: 'missing',
    fiscal_review_status: 'pending',
    fiscal_risk_level: 'medium',
    manager_note: '',
    notes: '',
  })

  const receiptInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!expense) {
      setIsEditing(false)
      setSaveError(null)
      setSuccessMessage(null)
      setForm({
        expense_date: '',
        supplier_name: '',
        category: 'otros',
        description: '',
        document_type: 'ticket',
        payment_status: 'paid',
        subtotal: '0.00',
        tax_rate: '21.00',
        tax_amount: '0.00',
        total: '0.00',
        is_deductible: true,
        document_support_status: 'missing',
        fiscal_review_status: 'pending',
        fiscal_risk_level: 'medium',
        manager_note: '',
        notes: '',
      })
      return
    }

    setIsEditing(false)
    setSaveError(null)
    setSuccessMessage(null)
    setForm({
      expense_date: expense.expense_date,
      supplier_name: expense.supplier_name ?? '',
      category: expense.category ?? 'otros',
      description: expense.description ?? '',
      document_type: expense.document_type ?? 'ticket',
      payment_status: expense.payment_status ?? 'paid',
      subtotal: formatMoneyInput(expense.subtotal),
      tax_rate: formatMoneyInput(expense.tax_rate),
      tax_amount: formatMoneyInput(expense.tax_amount),
      total: formatMoneyInput(expense.total),
      is_deductible: expense.is_deductible ?? true,
      document_support_status: expense.document_support_status ?? 'missing',
      fiscal_review_status: expense.fiscal_review_status ?? 'pending',
      fiscal_risk_level: expense.fiscal_risk_level ?? 'medium',
      manager_note: expense.manager_note ?? '',
      notes: expense.notes ?? '',
    })
  }, [expense])

  function updateField<K extends keyof EditFormState>(
    field: K,
    value: EditFormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function recalculateAmounts() {
    const subtotal = parseDecimalInput(form.subtotal)
    const taxRate = parseDecimalInput(form.tax_rate)

    if (Number.isNaN(subtotal) || Number.isNaN(taxRate)) {
      setSaveError('Para recalcular importes debes indicar una base y un IVA válidos.')
      setSuccessMessage(null)
      return
    }

    const taxAmount = Number(formatMoneyInput((subtotal * taxRate) / 100))
    const total = Number(formatMoneyInput(subtotal + taxAmount))

    updateField('tax_amount', formatMoneyInput(taxAmount))
    updateField('total', formatMoneyInput(total))
    setSaveError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!expense) return

    setSaveError(null)
    setSuccessMessage(null)
    setIsSaving(true)

    try {
      if (!form.expense_date) {
        setSaveError('Debes indicar la fecha del gasto.')
        return
      }

      if (!form.supplier_name.trim()) {
        setSaveError('Debes indicar el proveedor.')
        return
      }

      if (!form.description.trim()) {
        setSaveError('Debes indicar la descripción del gasto.')
        return
      }

      const subtotal = parseDecimalInput(form.subtotal)
      const taxRate = parseDecimalInput(form.tax_rate)
      const taxAmount = parseDecimalInput(form.tax_amount)
      const total = parseDecimalInput(form.total)

      if (
        Number.isNaN(subtotal) ||
        Number.isNaN(taxRate) ||
        Number.isNaN(taxAmount) ||
        Number.isNaN(total)
      ) {
        setSaveError('Base, IVA %, IVA € y total deben ser números válidos.')
        return
      }

      await updateExpense(expense.id, {
        expense_date: form.expense_date,
        supplier_name: form.supplier_name,
        category: form.category,
        description: form.description,
        document_type: form.document_type,
        payment_status: form.payment_status,
        subtotal: Number(formatMoneyInput(subtotal)),
        tax_rate: Number(formatMoneyInput(taxRate)),
        tax_amount: Number(formatMoneyInput(taxAmount)),
        total: Number(formatMoneyInput(total)),
        is_deductible: form.is_deductible,
        document_support_status: form.document_support_status,
        fiscal_review_status: form.fiscal_review_status,
        fiscal_risk_level: form.fiscal_risk_level,
        manager_note: form.manager_note.trim() || null,
        notes: form.notes.trim() || null,
      })

      await onExpenseUpdated()
      setSuccessMessage('Gasto actualizado correctamente.')
      setIsEditing(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido actualizando el gasto.'
      setSaveError(message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleReceiptSelected(event: React.ChangeEvent<HTMLInputElement>) {
    if (!expense) return

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
        throw new Error('El archivo supera el límite de 10 MB.')
      }

      if (expense.receipt_file_path) {
        await deleteExpenseReceipt(expense.receipt_file_path)
      }

      const { filePath } = await uploadExpenseReceipt(expense.id, file)
      await updateExpenseAttachment(expense.id, filePath)
      await onExpenseUpdated()
      setSuccessMessage('Documento adjuntado correctamente.')
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
    if (!expense?.receipt_file_path) return

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

  async function handleDeleteReceipt() {
    if (!expense?.receipt_file_path) return

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
    <section className="data-section cc-expense-detail">
      <div className="section-header page-header-actions">
        <div>
          <h2>Detalle del gasto</h2>
          <p>Lectura compacta del gasto con foco financiero, fiscal y documental.</p>
        </div>

        {expense ? (
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setIsEditing((current) => !current)
              setSaveError(null)
              setSuccessMessage(null)
            }}
          >
            {isEditing ? 'Cancelar edición' : 'Editar gasto'}
          </button>
        ) : null}
      </div>

      {expense ? (
        <div className="cc-expense-detail-card">
          <header className="cc-expense-detail__hero">
            <div className="cc-expense-detail__hero-copy">
              <span className="cc-expense-detail__eyebrow">
                {expense.display_code ?? expense.id}
              </span>
              <h3 className="cc-expense-detail__title">{expense.description}</h3>
              <p className="cc-expense-detail__subtitle">
                {expense.supplier_name} · {formatDateEs(expense.expense_date)}
              </p>
            </div>

            <div className="cc-expense-detail__total-card">
              <span className="cc-expense-detail__total-label">Total</span>
              <strong className="cc-expense-detail__total-value">
                {formatCurrency(expense.total)}
              </strong>
            </div>
          </header>

          <div className="cc-expense-detail__status-row">
            <span className="cc-expense-chip">
              {getExpenseCategoryLabel(expense.category)}
            </span>
            <span className="cc-expense-chip">
              {getExpensePaymentStatusLabel(expense.payment_status)}
            </span>
            <span className="cc-expense-chip">
              {getExpenseDocumentSupportStatusLabel(expense.document_support_status)}
            </span>
            <span className="cc-expense-chip">
              {getExpenseFiscalReviewStatusLabel(expense.fiscal_review_status)}
            </span>
            <span className="cc-expense-chip cc-expense-chip--risk">
              Riesgo {getExpenseFiscalRiskLevelLabel(expense.fiscal_risk_level)}
            </span>
          </div>

          {isEditing ? (
            <form className="lead-form" onSubmit={handleSubmit}>
              <label className="form-field">
                <span>Fecha *</span>
                <input
                  type="date"
                  value={form.expense_date}
                  onChange={(event) => updateField('expense_date', event.target.value)}
                  required
                />
              </label>

              <label className="form-field">
                <span>Proveedor *</span>
                <input
                  value={form.supplier_name}
                  onChange={(event) => updateField('supplier_name', event.target.value)}
                  required
                />
              </label>

              <label className="form-field">
                <span>Categoría</span>
                <select
                  value={form.category}
                  onChange={(event) => updateField('category', event.target.value)}
                >
                  {expenseCategories.map((category) => (
                    <option key={category} value={category}>
                      {getExpenseCategoryLabel(category)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span>Tipo documento</span>
                <select
                  value={form.document_type}
                  onChange={(event) => updateField('document_type', event.target.value)}
                >
                  {expenseDocumentTypes.map((documentType) => (
                    <option key={documentType} value={documentType}>
                      {getExpenseDocumentTypeLabel(documentType)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field form-field-full">
                <span>Descripción *</span>
                <input
                  value={form.description}
                  onChange={(event) => updateField('description', event.target.value)}
                  required
                />
              </label>

              <label className="form-field">
                <span>Base imponible *</span>
                <input
                  value={form.subtotal}
                  onChange={(event) => updateField('subtotal', event.target.value)}
                  required
                />
              </label>

              <label className="form-field">
                <span>IVA %</span>
                <input
                  value={form.tax_rate}
                  onChange={(event) => updateField('tax_rate', event.target.value)}
                />
              </label>

              <label className="form-field">
                <span>IVA €</span>
                <input
                  value={form.tax_amount}
                  onChange={(event) => updateField('tax_amount', event.target.value)}
                />
              </label>

              <label className="form-field">
                <span>Total</span>
                <input
                  value={form.total}
                  onChange={(event) => updateField('total', event.target.value)}
                />
              </label>

              <label className="form-field">
                <span>Estado de pago</span>
                <select
                  value={form.payment_status}
                  onChange={(event) => updateField('payment_status', event.target.value)}
                >
                  {expensePaymentStatuses.map((status) => (
                    <option key={status} value={status}>
                      {getExpensePaymentStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span>Estado documental</span>
                <select
                  value={form.document_support_status}
                  onChange={(event) => updateField('document_support_status', event.target.value)}
                >
                  {expenseDocumentSupportStatuses.map((status) => (
                    <option key={status} value={status}>
                      {getExpenseDocumentSupportStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span>Revisión fiscal</span>
                <select
                  value={form.fiscal_review_status}
                  onChange={(event) => updateField('fiscal_review_status', event.target.value)}
                >
                  {expenseFiscalReviewStatuses.map((status) => (
                    <option key={status} value={status}>
                      {getExpenseFiscalReviewStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span>Riesgo fiscal</span>
                <select
                  value={form.fiscal_risk_level}
                  onChange={(event) => updateField('fiscal_risk_level', event.target.value)}
                >
                  {expenseFiscalRiskLevels.map((risk) => (
                    <option key={risk} value={risk}>
                      {getExpenseFiscalRiskLevelLabel(risk)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field form-field-full">
                <span>Nota para gestoría</span>
                <textarea
                  rows={3}
                  value={form.manager_note}
                  onChange={(event) => updateField('manager_note', event.target.value)}
                />
              </label>

              <label className="form-field form-field-full">
                <span>Notas internas</span>
                <textarea
                  rows={4}
                  value={form.notes}
                  onChange={(event) => updateField('notes', event.target.value)}
                />
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.is_deductible}
                  onChange={(event) => updateField('is_deductible', event.target.checked)}
                />
                <span>Marcar como gasto deducible</span>
              </label>

              <div className="form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={recalculateAmounts}
                >
                  Recalcular importes
                </button>

                <button type="submit" className="primary-button" disabled={isSaving}>
                  {isSaving ? 'Guardando cambios...' : 'Guardar cambios'}
                </button>
              </div>

              {saveError ? (
                <div className="cc-alert cc-alert--error">
                  <strong>No se pudo actualizar el gasto</strong>
                  <p>{saveError}</p>
                </div>
              ) : null}

              {successMessage ? (
                <div className="cc-alert cc-alert--success">
                  <strong>Operación correcta</strong>
                  <p>{successMessage}</p>
                </div>
              ) : null}
            </form>
          ) : (
            <>
              {saveError ? (
                <div className="cc-alert cc-alert--error">
                  <strong>No se pudo completar la operación</strong>
                  <p>{saveError}</p>
                </div>
              ) : null}

              {successMessage ? (
                <div className="cc-alert cc-alert--success">
                  <strong>Operación correcta</strong>
                  <p>{successMessage}</p>
                </div>
              ) : null}

              <section className="cc-expense-detail__section">
                <div className="cc-expense-detail__section-head">
                  <h3>Resumen financiero</h3>
                  <p>Importes y tipo de documento del gasto seleccionado.</p>
                </div>

                <div className="cc-expense-detail__metrics">
                  <article className="cc-expense-metric">
                    <span className="cc-expense-metric__label">Base imponible</span>
                    <strong className="cc-expense-metric__value">
                      {formatCurrency(expense.subtotal)}
                    </strong>
                  </article>
                  <article className="cc-expense-metric">
                    <span className="cc-expense-metric__label">IVA</span>
                    <strong className="cc-expense-metric__value">
                      {formatCurrency(expense.tax_amount)}
                    </strong>
                  </article>
                  <article className="cc-expense-metric">
                    <span className="cc-expense-metric__label">IVA %</span>
                    <strong className="cc-expense-metric__value">
                      {formatMoneyInput(expense.tax_rate)}%
                    </strong>
                  </article>
                  <article className="cc-expense-metric">
                    <span className="cc-expense-metric__label">Tipo documento</span>
                    <strong className="cc-expense-metric__value">
                      {getExpenseDocumentTypeLabel(expense.document_type)}
                    </strong>
                  </article>
                </div>
              </section>

              <section className="cc-expense-detail__section">
                <div className="cc-expense-detail__section-head">
                  <h3>Documento adjunto</h3>
                  <p>Control del ticket o factura vinculada a este gasto.</p>
                </div>

                <div className="cc-expense-detail__doc-grid">
                  <div className="cc-expense-detail__info-card">
                    <span className="cc-expense-detail__info-label">Estado</span>
                    <strong className="cc-expense-detail__info-value">
                      {expense.receipt_file_path ? 'Documento cargado' : 'Sin documento'}
                    </strong>
                  </div>
                  <div className="cc-expense-detail__info-card">
                    <span className="cc-expense-detail__info-label">Tipo</span>
                    <strong className="cc-expense-detail__info-value">
                      {getFileTypeLabel(expense.receipt_file_path)}
                    </strong>
                  </div>
                  <div className="cc-expense-detail__info-card">
                    <span className="cc-expense-detail__info-label">Adjuntos</span>
                    <strong className="cc-expense-detail__info-value">
                      {expense.attachment_count ?? 0}
                    </strong>
                  </div>
                </div>

                <input
                  ref={receiptInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  onChange={handleReceiptSelected}
                />

                <div className="form-actions">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => receiptInputRef.current?.click()}
                    disabled={isUploadingReceipt}
                  >
                    {isUploadingReceipt ? 'Subiendo documento...' : 'Subir ticket / factura'}
                  </button>

                  {expense.receipt_file_path ? (
                    <>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={handleOpenReceipt}
                      >
                        Ver documento
                      </button>

                      <button
                        type="button"
                        className="secondary-button"
                        onClick={handleDeleteReceipt}
                        disabled={isDeletingReceipt}
                      >
                        {isDeletingReceipt ? 'Eliminando...' : 'Eliminar documento'}
                      </button>
                    </>
                  ) : null}
                </div>
              </section>

              <section className="cc-expense-detail__section">
                <div className="cc-expense-detail__section-head">
                  <h3>Control fiscal</h3>
                  <p>Datos clave para revisión, cierre y deducibilidad.</p>
                </div>

                <div className="cc-expense-detail__info-grid">
                  <div className="cc-expense-detail__info-card">
                    <span className="cc-expense-detail__info-label">Código</span>
                    <strong className="cc-expense-detail__info-value">
                      {expense.display_code ?? expense.id}
                    </strong>
                  </div>
                  <div className="cc-expense-detail__info-card">
                    <span className="cc-expense-detail__info-label">Fecha</span>
                    <strong className="cc-expense-detail__info-value">
                      {formatDateEs(expense.expense_date)}
                    </strong>
                  </div>
                  <div className="cc-expense-detail__info-card">
                    <span className="cc-expense-detail__info-label">Proveedor</span>
                    <strong className="cc-expense-detail__info-value">
                      {expense.supplier_name}
                    </strong>
                  </div>
                  <div className="cc-expense-detail__info-card">
                    <span className="cc-expense-detail__info-label">Deducible</span>
                    <strong className="cc-expense-detail__info-value">
                      {expense.is_deductible ? 'Sí' : 'No'}
                    </strong>
                  </div>
                </div>
              </section>

              {(expense.manager_note || expense.notes) ? (
                <section className="cc-expense-detail__section">
                  <div className="cc-expense-detail__section-head">
                    <h3>Notas</h3>
                    <p>Observaciones operativas e indicaciones para gestoría.</p>
                  </div>

                  <div className="cc-expense-detail__notes">
                    <article className="cc-expense-detail__note-card">
                      <span className="cc-expense-detail__info-label">Nota gestoría</span>
                      <p>{expense.manager_note ?? 'Sin nota'}</p>
                    </article>
                    <article className="cc-expense-detail__note-card">
                      <span className="cc-expense-detail__info-label">Notas internas</span>
                      <p>{expense.notes ?? 'Sin notas'}</p>
                    </article>
                  </div>
                </section>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <div className="empty-state">
          <strong>Ningún gasto seleccionado</strong>
          <p>Haz clic en una tarjeta del listado para ver su detalle.</p>
        </div>
      )}
    </section>
  )
}