import { useState, type FormEvent } from 'react'

interface ExpenseCreateFormProps {
  onCreated: () => Promise<void>
}

interface CreateFormState {
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
    category: 'other',
    supplier: '',
    concept: '',
    amount: '',
    tax_amount: '0.00',
    total: '',
    is_deductible: true,
    receipt_status: 'pending',
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
    setError(null)
    setSuccess(null)
    setIsSaving(true)

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseAnonKey) {
        setError('Faltan las variables de entorno de Supabase.')
        return
      }

      if (!form.expense_date) {
        setError('Debes indicar la fecha del gasto.')
        return
      }

      if (!form.concept.trim()) {
        setError('Debes indicar el concepto.')
        return
      }

      const amount = parseDecimalInput(form.amount)
      const taxAmount = parseDecimalInput(form.tax_amount || '0')
      const total = parseDecimalInput(form.total || '0')

      if (Number.isNaN(amount)) {
        setError('La base imponible debe ser un número válido.')
        return
      }

      const resolvedTotal = Number.isNaN(total)
        ? Number(formatMoneyInput(amount + taxAmount))
        : Number(formatMoneyInput(total))

      const response = await fetch(`${supabaseUrl}/rest/v1/expenses`, {
        method: 'POST',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          expense_date: form.expense_date,
          category: form.category || null,
          supplier: form.supplier.trim() || null,
          concept: form.concept.trim(),
          amount: Number(formatMoneyInput(amount)),
          tax_amount: Number(formatMoneyInput(Number.isNaN(taxAmount) ? 0 : taxAmount)),
          total: resolvedTotal,
          is_deductible: form.is_deductible,
          receipt_status: form.receipt_status || 'pending',
          notes: form.notes.trim() || null,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        setError(`REST ${response.status}: ${errorText || response.statusText}`)
        return
      }

      setSuccess('Gasto creado correctamente.')
      setForm({
        expense_date: '',
        category: 'other',
        supplier: '',
        concept: '',
        amount: '',
        tax_amount: '0.00',
        total: '',
        is_deductible: true,
        receipt_status: 'pending',
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
        <p>Alta manual del gasto con base fiscal y estado del justificante.</p>
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
            placeholder="Ej. Repsol, Amazon, Makro..."
          />
        </label>

        <label className="form-field">
          <span>Concepto *</span>
          <input
            value={form.concept}
            onChange={(event) => updateField('concept', event.target.value)}
            placeholder="Ej. Compra de productos de limpieza"
            required
          />
        </label>

        <label className="form-field">
          <span>Base imponible *</span>
          <input
            value={form.amount}
            onChange={(event) => updateField('amount', event.target.value)}
            placeholder="0.00"
            required
          />
        </label>

        <label className="form-field">
          <span>IVA</span>
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
          <button type="button" className="secondary-button" onClick={recalculateTotal}>
            Recalcular total
          </button>

          <button type="submit" className="primary-button" disabled={isSaving}>
            {isSaving ? 'Guardando gasto...' : 'Guardar gasto'}
          </button>
        </div>

        {error ? (
          <div className="empty-state">
            <strong>No se pudo crear el gasto</strong>
            <p>{error}</p>
          </div>
        ) : null}

        {success ? (
          <div className="empty-state">
            <strong>Operación correcta</strong>
            <p>{success}</p>
          </div>
        ) : null}
      </form>
    </section>
  )
}