import { useEffect, useState, type FormEvent } from 'react'
import { updateExpense } from './expenseApi'
import {
  expenseCategories,
  expenseDocumentTypes,
  expensePaymentStatuses,
  getExpenseCategoryLabel,
  getExpenseDocumentTypeLabel,
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

export function ExpenseDetailCard({
  expense,
  onExpenseUpdated,
}: ExpenseDetailCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
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
    notes: '',
  })

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
      return
    }

    const taxAmount = Number(formatMoneyInput(subtotal * taxRate / 100))
    const total = Number(formatMoneyInput(subtotal + taxAmount))

    updateField('tax_amount', formatMoneyInput(taxAmount))
    updateField('total', formatMoneyInput(total))
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

  return (
    <section className="data-section">
      <div className="section-header page-header-actions">
        <div>
          <h2>Detalle del gasto</h2>
          <p>Vista del gasto alineada con la estructura fiscal real.</p>
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
        <div className="lead-detail-card">
          <div className="lead-detail-header">
            <div>
              <h3>{expense.display_code ?? expense.id}</h3>
              <p>{expense.description}</p>
            </div>
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

              <label className="form-field form-field-full">
                <span>Notas</span>
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
                <div className="empty-state">
                  <strong>No se pudo actualizar el gasto</strong>
                  <p>{saveError}</p>
                </div>
              ) : null}

              {successMessage ? (
                <div className="empty-state">
                  <strong>Operación correcta</strong>
                  <p>{successMessage}</p>
                </div>
              ) : null}
            </form>
          ) : (
            <div className="lead-detail-grid">
              <div className="detail-row">
                <span className="detail-label">Código</span>
                <strong>{expense.display_code ?? expense.id}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Fecha</span>
                <strong>{formatDateEs(expense.expense_date)}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Proveedor</span>
                <strong>{expense.supplier_name}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Categoría</span>
                <strong>{getExpenseCategoryLabel(expense.category)}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Tipo documento</span>
                <strong>{getExpenseDocumentTypeLabel(expense.document_type)}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Descripción</span>
                <strong>{expense.description}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Base imponible</span>
                <strong>{formatCurrency(expense.subtotal)}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">IVA %</span>
                <strong>{formatMoneyInput(expense.tax_rate)}%</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">IVA €</span>
                <strong>{formatCurrency(expense.tax_amount)}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Total</span>
                <strong>{formatCurrency(expense.total)}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Estado de pago</span>
                <strong>{getExpensePaymentStatusLabel(expense.payment_status)}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Deducible</span>
                <strong>{expense.is_deductible ? 'Sí' : 'No'}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Notas</span>
                <strong>{expense.notes ?? 'Sin notas'}</strong>
              </div>
            </div>
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
