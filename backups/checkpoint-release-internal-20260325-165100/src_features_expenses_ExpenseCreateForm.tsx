import { useState, type FormEvent } from 'react'
import { createExpense } from './expenseApi'
import {
  expenseCategories,
  expenseDocumentTypes,
  expenseDocumentSupportStatuses,
  expenseFiscalReviewStatuses,
  expenseFiscalRiskLevels,
  expensePaymentStatuses,
  getExpenseCategoryLabel,
  getExpenseDocumentSupportStatusLabel,
  getExpenseDocumentTypeLabel,
  getExpenseFiscalReviewStatusLabel,
  getExpenseFiscalRiskLevelLabel,
  getExpensePaymentStatusLabel,
} from './types'

interface ExpenseCreateFormProps {
  onCreated: () => Promise<void>
}

interface CreateFormState {
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

function parseDecimalInput(value: string): number {
  const normalized = value.trim().replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function formatMoneyInput(value: number): string {
  return value.toFixed(2)
}

export function ExpenseCreateForm({ onCreated }: ExpenseCreateFormProps) {
  const [form, setForm] = useState<CreateFormState>({
    expense_date: '',
    supplier_name: '',
    category: 'otros',
    description: '',
    document_type: 'ticket',
    payment_status: 'paid',
    subtotal: '',
    tax_rate: '21.00',
    tax_amount: '0.00',
    total: '',
    is_deductible: true,
    document_support_status: 'missing',
    fiscal_review_status: 'pending',
    fiscal_risk_level: 'medium',
    manager_note: '',
    notes: '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function updateField<K extends keyof CreateFormState>(
    field: K,
    value: CreateFormState[K],
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
      setError('Para recalcular importes debes indicar una base y un IVA válidos.')
      setSuccess(null)
      return
    }

    const taxAmount = Number(formatMoneyInput(subtotal * taxRate / 100))
    const total = Number(formatMoneyInput(subtotal + taxAmount))

    updateField('tax_amount', formatMoneyInput(taxAmount))
    updateField('total', formatMoneyInput(total))
    setError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setIsSaving(true)

    try {
      if (!form.expense_date) {
        setError('Debes indicar la fecha del gasto.')
        return
      }

      if (!form.supplier_name.trim()) {
        setError('Debes indicar el proveedor.')
        return
      }

      if (!form.description.trim()) {
        setError('Debes indicar la descripción del gasto.')
        return
      }

      const subtotal = parseDecimalInput(form.subtotal)
      const taxRate = parseDecimalInput(form.tax_rate)
      const taxAmount = parseDecimalInput(form.tax_amount || '0')
      const total = parseDecimalInput(form.total || '0')

      if (Number.isNaN(subtotal)) {
        setError('La base imponible debe ser un número válido.')
        return
      }

      if (Number.isNaN(taxRate)) {
        setError('El tipo de IVA debe ser un número válido.')
        return
      }

      const resolvedTaxAmount = Number.isNaN(taxAmount)
        ? Number(formatMoneyInput(subtotal * taxRate / 100))
        : Number(formatMoneyInput(taxAmount))

      const resolvedTotal = Number.isNaN(total)
        ? Number(formatMoneyInput(subtotal + resolvedTaxAmount))
        : Number(formatMoneyInput(total))

      await createExpense({
        expense_date: form.expense_date,
        supplier_name: form.supplier_name,
        category: form.category,
        description: form.description,
        document_type: form.document_type,
        payment_status: form.payment_status,
        subtotal: Number(formatMoneyInput(subtotal)),
        tax_rate: Number(formatMoneyInput(taxRate)),
        tax_amount: resolvedTaxAmount,
        total: resolvedTotal,
        is_deductible: form.is_deductible,
        document_support_status: form.document_support_status,
        fiscal_review_status: form.fiscal_review_status,
        fiscal_risk_level: form.fiscal_risk_level,
        manager_note: form.manager_note.trim() || null,
        notes: form.notes.trim() || null,
      })

      setSuccess('Gasto creado correctamente.')
      setForm({
        expense_date: '',
        supplier_name: '',
        category: 'otros',
        description: '',
        document_type: 'ticket',
        payment_status: 'paid',
        subtotal: '',
        tax_rate: '21.00',
        tax_amount: '0.00',
        total: '',
        is_deductible: true,
        document_support_status: 'missing',
        fiscal_review_status: 'pending',
        fiscal_risk_level: 'medium',
        manager_note: '',
        notes: '',
      })

      await onCreated()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido creando el gasto.'
      setError(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="data-section">
      <div className="section-header">
        <h2>Nuevo gasto</h2>
        <p>Alta fiscal básica alineada con la tabla real de gastos.</p>
      </div>

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
            placeholder="Ej. Repsol, Amazon, Makro..."
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
            placeholder="Ej. Compra de productos de limpieza"
            required
          />
        </label>

        <label className="form-field">
          <span>Base imponible *</span>
          <input
            value={form.subtotal}
            onChange={(event) => updateField('subtotal', event.target.value)}
            placeholder="0.00"
            required
          />
        </label>

        <label className="form-field">
          <span>IVA %</span>
          <input
            value={form.tax_rate}
            onChange={(event) => updateField('tax_rate', event.target.value)}
            placeholder="21.00"
          />
        </label>

        <label className="form-field">
          <span>IVA €</span>
          <input
            value={form.tax_amount}
            onChange={(event) => updateField('tax_amount', event.target.value)}
            placeholder="0.00"
          />
        </label>

        <label className="form-field">
          <span>Total</span>
          <input
            value={form.total}
            onChange={(event) => updateField('total', event.target.value)}
            placeholder="0.00"
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
            placeholder="Observación específica para revisión o cierre"
          />
        </label>

        <label className="form-field form-field-full">
          <span>Notas internas</span>
          <textarea
            rows={4}
            value={form.notes}
            onChange={(event) => updateField('notes', event.target.value)}
            placeholder="Observaciones internas o contexto del gasto"
          />
        </label>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.is_deductible}
            onChange={(event) => updateField('is_deductible', event.target.checked)}
          />
          <span>Marcar como deducible</span>
        </label>

        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={recalculateAmounts}>
            Recalcular importes
          </button>

          <button type="submit" className="primary-button" disabled={isSaving}>
            {isSaving ? 'Guardando gasto...' : 'Guardar gasto'}
          </button>
        </div>

        {error ? (
          <div className="cc-alert cc-alert--error">
            <strong>No se pudo crear el gasto</strong>
            <p>{error}</p>
          </div>
        ) : null}

        {success ? (
          <div className="cc-alert cc-alert--success">
            <strong>Operación correcta</strong>
            <p>{success}</p>
          </div>
        ) : null}
      </form>
    </section>
  )
}
