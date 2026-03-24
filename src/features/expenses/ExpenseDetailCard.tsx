import { useEffect, useState, type FormEvent } from 'react'
import type { ExpenseListItem } from './types'

interface ExpenseDetailCardProps {
  expense: ExpenseListItem | null
  onExpenseUpdated: () => Promise<void>
}

interface EditFormState {
  expense_date: string
  category: string
  supplier: string
  concept: string
  amount: string
  tax_amount: string
  total: string
  is_deductible: boolean
  receipt_status: string
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

function getExpenseCategoryLabel(value: string | null | undefined): string {
  switch (value) {
    case 'products': return 'Productos'
    case 'transport': return 'Transporte'
    case 'fuel': return 'Combustible'
    case 'materials': return 'Materiales'
    case 'maintenance': return 'Mantenimiento'
    case 'software': return 'Software'
    case 'supplies': return 'Suministros'
    case 'rent': return 'Alquiler'
    case 'utilities': return 'Servicios'
    case 'marketing': return 'Marketing'
    case 'professional_services': return 'Servicios profesionales'
    case 'other': return 'Otros'
    default: return value ?? 'Sin categoría'
  }
}

function getReceiptStatusLabel(value: string | null | undefined): string {
  switch (value) {
    case 'pending': return 'Pendiente'
    case 'uploaded': return 'Subido'
    case 'validated': return 'Validado'
    default: return value ?? 'Sin estado'
  }
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
    category: 'other',
    supplier: '',
    concept: '',
    amount: '0.00',
    tax_amount: '0.00',
    total: '0.00',
    is_deductible: true,
    receipt_status: 'pending',
    notes: '',
  })

  useEffect(() => {
    if (!expense) {
      setIsEditing(false)
      setSaveError(null)
      setSuccessMessage(null)
      setForm({
        expense_date: '',
        category: 'other',
        supplier: '',
        concept: '',
        amount: '0.00',
        tax_amount: '0.00',
        total: '0.00',
        is_deductible: true,
        receipt_status: 'pending',
        notes: '',
      })
      return
    }

    setIsEditing(false)
    setSaveError(null)
    setSuccessMessage(null)
    setForm({
      expense_date: expense.expense_date,
      category: expense.category ?? 'other',
      supplier: expense.supplier ?? '',
      concept: expense.concept ?? '',
      amount: formatMoneyInput(expense.amount),
      tax_amount: formatMoneyInput(expense.tax_amount),
      total: formatMoneyInput(expense.total ?? expense.amount),
      is_deductible: expense.is_deductible ?? true,
      receipt_status: expense.receipt_status ?? 'pending',
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

  function recalculateTotal() {
    const amount = parseDecimalInput(form.amount)
    const taxAmount = parseDecimalInput(form.tax_amount)

    if (Number.isNaN(amount) || Number.isNaN(taxAmount)) {
      return
    }

    updateField('total', formatMoneyInput(amount + taxAmount))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!expense) {
      return
    }

    setSaveError(null)
    setSuccessMessage(null)
    setIsSaving(true)

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseAnonKey) {
        setSaveError('Faltan las variables de entorno de Supabase.')
        return
      }

      if (!form.expense_date) {
        setSaveError('Debes indicar la fecha del gasto.')
        return
      }

      if (!form.concept.trim()) {
        setSaveError('Debes indicar el concepto.')
        return
      }

      const amount = parseDecimalInput(form.amount)
      const taxAmount = parseDecimalInput(form.tax_amount)
      const total = parseDecimalInput(form.total)

      if (Number.isNaN(amount) || Number.isNaN(taxAmount) || Number.isNaN(total)) {
        setSaveError('Importe, IVA y total deben ser números válidos.')
        return
      }

      const response = await fetch(
        `${supabaseUrl}/rest/v1/expenses?id=eq.${encodeURIComponent(expense.id)}`,
        {
          method: 'PATCH',
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            expense_date: form.expense_date,
            category: form.category || null,
            supplier: form.supplier.trim() || null,
            concept: form.concept.trim(),
            amount: Number(formatMoneyInput(amount)),
            tax_amount: Number(formatMoneyInput(taxAmount)),
            total: Number(formatMoneyInput(total)),
            is_deductible: form.is_deductible,
            receipt_status: form.receipt_status || 'pending',
            notes: form.notes.trim() || null,
          }),
        },
      )

      if (!response.ok) {
        const errorText = await response.text()
        setSaveError(`REST ${response.status}: ${errorText || response.statusText}`)
        return
      }

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
          <p>Vista inicial del gasto seleccionado.</p>
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
              <p>{expense.concept}</p>
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
                <span>Categoría</span>
                <select
                  value={form.category}
                  onChange={(event) => updateField('category', event.target.value)}
                >
                  <option value="products">Productos</option>
                  <option value="transport">Transporte</option>
                  <option value="fuel">Combustible</option>
                  <option value="materials">Materiales</option>
                  <option value="maintenance">Mantenimiento</option>
                  <option value="software">Software</option>
                  <option value="supplies">Suministros</option>
                  <option value="rent">Alquiler</option>
                  <option value="utilities">Servicios</option>
                  <option value="marketing">Marketing</option>
                  <option value="professional_services">Servicios profesionales</option>
                  <option value="other">Otros</option>
                </select>
              </label>

              <label className="form-field">
                <span>Proveedor</span>
                <input
                  value={form.supplier}
                  onChange={(event) => updateField('supplier', event.target.value)}
                />
              </label>

              <label className="form-field">
                <span>Concepto *</span>
                <input
                  value={form.concept}
                  onChange={(event) => updateField('concept', event.target.value)}
                  required
                />
              </label>

              <label className="form-field">
                <span>Base imponible *</span>
                <input
                  value={form.amount}
                  onChange={(event) => updateField('amount', event.target.value)}
                  required
                />
              </label>

              <label className="form-field">
                <span>IVA</span>
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
                <span>Estado ticket</span>
                <select
                  value={form.receipt_status}
                  onChange={(event) => updateField('receipt_status', event.target.value)}
                >
                  <option value="pending">Pendiente</option>
                  <option value="uploaded">Subido</option>
                  <option value="validated">Validado</option>
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
                  onClick={recalculateTotal}
                >
                  Recalcular total
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
                <span className="detail-label">Categoría</span>
                <strong>{getExpenseCategoryLabel(expense.category)}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Proveedor</span>
                <strong>{expense.supplier ?? 'Sin proveedor'}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Concepto</span>
                <strong>{expense.concept}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Base imponible</span>
                <strong>{formatCurrency(expense.amount)}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">IVA</span>
                <strong>{formatCurrency(expense.tax_amount)}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Total</span>
                <strong>{formatCurrency(expense.total ?? expense.amount)}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Deducible</span>
                <strong>{expense.is_deductible ? 'Sí' : 'No'}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Estado ticket</span>
                <strong>{getReceiptStatusLabel(expense.receipt_status)}</strong>
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