import { useMemo, useState, type FormEvent } from 'react'
import { formatInvoiceLabel } from '../../app/relationshipLabels'
import type { InvoiceListItem } from '../invoices/types'
import { savePaymentAndRefreshInvoice } from '../financial/financialWriteApi'

interface PaymentCreateFormProps {
  invoices: InvoiceListItem[]
  onCreated: () => Promise<void>
}

interface FormState {
  invoice_id: string
  payment_date: string
  amount: string
  payment_method: string
  notes: string
}

function todayLocalDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDecimalInput(value: string): number {
  const normalized = value.trim().replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function formatMoneyInput(value: number): string {
  return value.toFixed(2)
}

function getPaymentMethodLabel(value: string): string {
  switch (value) {
    case 'transfer': return 'Transferencia'
    case 'cash': return 'Efectivo'
    case 'bizum': return 'Bizum'
    case 'card': return 'Tarjeta'
    default: return value || 'Sin método'
  }
}

export function PaymentCreateForm({
  invoices,
  onCreated,
}: PaymentCreateFormProps) {
  const [form, setForm] = useState<FormState>({
    invoice_id: '',
    payment_date: todayLocalDate(),
    amount: '',
    payment_method: 'transfer',
    notes: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const selectedInvoice = useMemo(
    () => invoices.find((invoice) => invoice.id === form.invoice_id) ?? null,
    [invoices, form.invoice_id],
  )

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function syncAmountFromInvoice() {
    if (!selectedInvoice) {
      setSubmitError('Selecciona una factura antes de traer su total.')
      return
    }

    setSubmitError(null)
    setForm((current) => ({
      ...current,
      amount: formatMoneyInput(Number(selectedInvoice.total)),
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError(null)
    setSuccessMessage(null)
    setIsSubmitting(true)

    try {
      if (!form.invoice_id) {
        setSubmitError('Debes seleccionar una factura.')
        return
      }

      if (!selectedInvoice) {
        setSubmitError('No se pudo resolver la factura seleccionada. Actualiza la lista antes de guardar.')
        return
      }

      if (!form.payment_date) {
        setSubmitError('Debes indicar la fecha de cobro.')
        return
      }

      const amount = parseDecimalInput(form.amount)

      if (Number.isNaN(amount)) {
        setSubmitError('El importe debe ser un número válido.')
        return
      }

      if (amount <= 0) {
        setSubmitError('El importe del pago debe ser mayor que cero.')
        return
      }

      const paymentId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? `PAYMENT-${crypto.randomUUID()}`
          : `PAYMENT-${Date.now()}`

      await savePaymentAndRefreshInvoice({
        id: paymentId,
        invoice_id: form.invoice_id,
        payment_date: form.payment_date,
        amount: Number(formatMoneyInput(amount)),
        payment_method: form.payment_method || null,
        notes: form.notes.trim() || null,
      })

      await onCreated()

      setForm({
        invoice_id: '',
        payment_date: todayLocalDate(),
        amount: '',
        payment_method: 'transfer',
        notes: '',
      })
      setSuccessMessage('Pago creado correctamente.')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido creando el pago.'

      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="data-section">
      <div className="section-header">
        <h2>Nuevo pago</h2>
        <p>Registra un cobro vinculado a una factura y documenta su método e importe.</p>
      </div>

      {invoices.length === 0 ? (
        <div className="empty-state">
          <strong>No hay facturas disponibles</strong>
          <p>Primero debes crear al menos una factura para poder registrar un pago.</p>
        </div>
      ) : (
        <form className="lead-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Factura *</span>
            <select
              value={form.invoice_id}
              onChange={(event) => updateField('invoice_id', event.target.value)}
            >
              <option value="">Selecciona una factura</option>
              {invoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {formatInvoiceLabel(invoice)} - Total {formatMoneyInput(Number(invoice.total))}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Fecha de cobro *</span>
            <input
              type="date"
              value={form.payment_date}
              onChange={(event) => updateField('payment_date', event.target.value)}
              required
            />
          </label>

          <label className="form-field">
            <span>Importe *</span>
            <input
              value={form.amount}
              onChange={(event) => updateField('amount', event.target.value)}
              placeholder="Ej. 121.00"
              required
            />
          </label>

          <label className="form-field">
            <span>Método de pago</span>
            <select
              value={form.payment_method}
              onChange={(event) => updateField('payment_method', event.target.value)}
            >
              <option value="transfer">{getPaymentMethodLabel('transfer')}</option>
              <option value="cash">{getPaymentMethodLabel('cash')}</option>
              <option value="bizum">{getPaymentMethodLabel('bizum')}</option>
              <option value="card">{getPaymentMethodLabel('card')}</option>
            </select>
          </label>

          <label className="form-field form-field-full">
            <span>Notas</span>
            <textarea
              value={form.notes}
              onChange={(event) => updateField('notes', event.target.value)}
              rows={4}
              placeholder="Notas del cobro"
            />
          </label>

          <div className="form-actions">
            <button type="button" className="secondary-button" onClick={syncAmountFromInvoice}>
              Traer total de factura
            </button>
            <button type="submit" className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar pago'}
            </button>
          </div>

          {submitError ? (
            <div className="cc-alert cc-alert--error">
              <strong>No se pudo crear el pago</strong>
              <p>{submitError}</p>
            </div>
          ) : null}

          {successMessage ? (
            <div className="cc-alert cc-alert--success">
              <strong>Operación correcta</strong>
              <p>{successMessage}</p>
            </div>
          ) : null}
        </form>
      )}
    </section>
  )
}
