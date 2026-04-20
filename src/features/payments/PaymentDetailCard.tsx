import { useEffect, useState, type FormEvent } from 'react'
import { formatCurrency, formatDateEs, getPaymentMethodLabel } from '../../app/displayFormat'
import { FeedbackDialog } from '../../components/FeedbackDialog'
import type { PaymentListItem } from './types'
import type { InvoiceListItem } from '../invoices/types'
import { savePaymentAndRefreshInvoice } from '../financial/financialWriteApi'

interface PaymentDetailCardProps {
  payment: PaymentListItem | null
  invoices: InvoiceListItem[]
  onPaymentUpdated: () => Promise<void>
  onUnsavedChange?: (hasUnsavedChanges: boolean) => void
}

interface EditFormState {
  invoice_id: string
  payment_date: string
  amount: string
  payment_method: string
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

function getPaymentMethodOptionLabel(value: string): string {
  switch (value) {
    case 'transfer': return 'Transferencia'
    case 'cash': return 'Efectivo'
    case 'bizum': return 'Bizum'
    case 'card': return 'Tarjeta'
    default: return value || 'Sin método'
  }
}

export function PaymentDetailCard({
  payment,
  invoices,
  onPaymentUpdated,
  onUnsavedChange,
}: PaymentDetailCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [form, setForm] = useState<EditFormState>({
    invoice_id: '',
    payment_date: '',
    amount: '0.00',
    payment_method: 'transfer',
    notes: '',
  })

  useEffect(() => {
    if (!payment) {
      setIsEditing(false)
      setSaveError(null)
      setSuccessMessage(null)
      setForm({
        invoice_id: '',
        payment_date: '',
        amount: '0.00',
        payment_method: 'transfer',
        notes: '',
      })
      return
    }

    setIsEditing(false)
    setSaveError(null)
    setSuccessMessage(null)
    setForm({
      invoice_id: payment.invoice_id,
      payment_date: payment.payment_date,
      amount: String(payment.amount),
      payment_method: payment.payment_method ?? 'transfer',
      notes: payment.notes ?? '',
    })
  }, [payment])

  useEffect(() => {
    onUnsavedChange?.(isEditing)
    return () => onUnsavedChange?.(false)
  }, [isEditing, onUnsavedChange])

  const selectedInvoice = invoices.find((invoice) => invoice.id === form.invoice_id) ?? null
  const isSelectedInvoiceMissing = Boolean(form.invoice_id && !selectedInvoice)

  function updateField<K extends keyof EditFormState>(field: K, value: EditFormState[K]) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function syncAmountFromInvoice() {
    if (!selectedInvoice) {
      setSaveError('No se pudo resolver la factura seleccionada para traer su total.')
      return
    }

    setForm((current) => ({
      ...current,
      amount: formatMoneyInput(Number(selectedInvoice.total)),
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!payment) {
      return
    }

    setSaveError(null)
    setSuccessMessage(null)
    setIsSaving(true)

    try {
      if (!form.invoice_id) {
        setSaveError('Debes seleccionar una factura.')
        return
      }

      if (!selectedInvoice) {
        setSaveError('No se pudo resolver la factura seleccionada. Actualiza la lista antes de guardar.')
        return
      }

      if (!form.payment_date) {
        setSaveError('Debes indicar la fecha de cobro.')
        return
      }

      const amount = parseDecimalInput(form.amount)

      if (Number.isNaN(amount)) {
        setSaveError('El importe debe ser un número válido.')
        return
      }

      if (amount <= 0) {
        setSaveError('El importe del pago debe ser mayor que cero.')
        return
      }

      await savePaymentAndRefreshInvoice({
        id: payment.id,
        invoice_id: form.invoice_id,
        payment_date: form.payment_date,
        amount: Number(formatMoneyInput(amount)),
        payment_method: form.payment_method || null,
        notes: form.notes.trim() || null,
      })

      await onPaymentUpdated()
      setSuccessMessage('Pago actualizado correctamente.')
      setIsEditing(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido actualizando el pago.'

      setSaveError(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="data-section">
      <div className="section-header page-header-actions">
        <div>
          <h2>Detalle del pago</h2>
        </div>

        {payment ? (
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setIsEditing((current) => !current)
              setSaveError(null)
              setSuccessMessage(null)
              setForm({
                invoice_id: payment.invoice_id,
                payment_date: payment.payment_date,
                amount: String(payment.amount),
                payment_method: payment.payment_method ?? 'transfer',
                notes: payment.notes ?? '',
              })
            }}
          >
            {isEditing ? 'Cancelar edición' : 'Editar pago'}
          </button>
        ) : null}
      </div>

      {payment ? (
        <div className="lead-detail-card">
          <div className="lead-detail-header">
            <div>
              <h3>{payment.display_code ?? payment.id}</h3>
              <p>{payment.invoice_number ?? payment.invoice_display_code ?? payment.invoice_id}</p>
            </div>
          </div>

          {isEditing ? (
            <form className="lead-form" onSubmit={handleSubmit}>
              <label className="form-field">
                <span>Factura *</span>
                <select
                  value={form.invoice_id}
                  onChange={(event) => updateField('invoice_id', event.target.value)}
                >
                  {isSelectedInvoiceMissing ? (
                    <option value={form.invoice_id}>
                      Factura no disponible - {form.invoice_id}
                    </option>
                  ) : null}
                  {invoices.map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>
                      {(invoice.invoice_number ?? invoice.display_code ?? invoice.id)} · Total {formatCurrency(invoice.total)}
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
                  required
                />
              </label>

              <label className="form-field">
                <span>Método de pago</span>
                <select
                  value={form.payment_method}
                  onChange={(event) => updateField('payment_method', event.target.value)}
                >
                  <option value="transfer">{getPaymentMethodOptionLabel('transfer')}</option>
                  <option value="cash">{getPaymentMethodOptionLabel('cash')}</option>
                  <option value="bizum">{getPaymentMethodOptionLabel('bizum')}</option>
                  <option value="card">{getPaymentMethodOptionLabel('card')}</option>
                </select>
              </label>

              <label className="form-field form-field-full">
                <span>Notas</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => updateField('notes', event.target.value)}
                  rows={4}
                />
              </label>

              <div className="form-actions">
                <button type="button" className="secondary-button" onClick={syncAmountFromInvoice}>
                  Traer total de factura
                </button>

                <button type="submit" className="primary-button" disabled={isSaving}>
                  {isSaving ? 'Guardando cambios...' : 'Guardar cambios'}
                </button>
              </div>

              {saveError ? (
                <div className="cc-alert cc-alert--error">
                  <strong>No se pudo actualizar el pago</strong>
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
            <div className="lead-detail-grid">
              <div className="detail-row">
                <span className="detail-label">Código</span>
                <strong>{payment.display_code ?? payment.id}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Factura</span>
                <strong>{payment.invoice_number ?? payment.invoice_display_code ?? payment.invoice_id}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Fecha de cobro</span>
                <strong>{formatDateEs(payment.payment_date)}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Importe</span>
                <strong>{formatCurrency(payment.amount)}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Método</span>
                <strong>{getPaymentMethodLabel(payment.payment_method)}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Notas</span>
                <strong>{payment.notes ?? 'Sin notas'}</strong>
              </div>
            </div>
          )}

          <FeedbackDialog
            isOpen={!isEditing && Boolean(saveError)}
            tone="error"
            title="No se pudo actualizar el pago"
            message={saveError ?? ''}
            onClose={() => setSaveError(null)}
          />

          <FeedbackDialog
            isOpen={!isEditing && Boolean(successMessage)}
            tone="success"
            title="Operacion correcta"
            message={successMessage ?? ''}
            onClose={() => setSuccessMessage(null)}
          />
        </div>
      ) : (
        <div className="empty-state">
          <strong>Ningún pago seleccionado</strong>
          <p>Haz clic en una tarjeta del listado para ver su detalle.</p>
        </div>
      )}
    </section>
  )
}
