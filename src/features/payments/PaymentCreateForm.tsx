import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ContextualCreateSection } from '../../components/ContextualCreateSection'
import type { ClientListItem } from '../clients/types'
import { savePaymentAndRefreshInvoice } from '../financial/financialWriteApi'
import { InvoiceCreateForm } from '../invoices/InvoiceCreateForm'
import type { InvoiceListItem } from '../invoices/types'
import type { JobListItem } from '../jobs/types'
import type { PropertyListItem } from '../properties/types'
import type { QuoteListItem } from '../quotes/types'
import { formatInvoiceLabel } from '../../app/relationshipLabels'

interface PaymentCreateFormProps {
  invoices: InvoiceListItem[]
  clients: ClientListItem[]
  properties: PropertyListItem[]
  jobs: JobListItem[]
  quotes: QuoteListItem[]
  onCreated: () => Promise<void>
  title?: string
  description?: string
  submitLabel?: string
  prefillInvoiceId?: string
  prefillAmount?: string
  prefillPaymentMethod?: string
  prefillNotes?: string
  lockInvoiceSelection?: boolean
  hideInvoiceCreateAction?: boolean
  originType?: 'manual' | 'transfer_auto'
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
    default: return value || 'Sin metodo'
  }
}

function buildInitialState({
  prefillInvoiceId,
  prefillAmount,
  prefillPaymentMethod,
  prefillNotes,
}: Pick<
  PaymentCreateFormProps,
  'prefillInvoiceId' | 'prefillAmount' | 'prefillPaymentMethod' | 'prefillNotes'
>): FormState {
  return {
    invoice_id: prefillInvoiceId ?? '',
    payment_date: todayLocalDate(),
    amount: prefillAmount ?? '',
    payment_method: prefillPaymentMethod ?? 'transfer',
    notes: prefillNotes ?? '',
  }
}

function getPreferredInvoiceId(invoices: InvoiceListItem[]): string {
  const openInvoice = invoices.find((invoice) => Number(invoice.outstanding_amount ?? invoice.total) > 0.009)
  return openInvoice?.id ?? invoices[0]?.id ?? ''
}

export function PaymentCreateForm({
  invoices,
  clients,
  properties,
  jobs,
  quotes,
  onCreated,
  title = 'Nuevo cobro',
  description = 'Registra un cobro vinculado a una factura y documenta su metodo e importe.',
  submitLabel = 'Guardar cobro',
  prefillInvoiceId,
  prefillAmount,
  prefillPaymentMethod,
  prefillNotes,
  lockInvoiceSelection = false,
  hideInvoiceCreateAction = false,
  originType = 'manual',
}: PaymentCreateFormProps) {
  const availableInvoices = useMemo(() => (
    invoices.filter((invoice) => {
      if (prefillInvoiceId && invoice.id === prefillInvoiceId) return true
      return Number(invoice.outstanding_amount ?? invoice.total) > 0.009
    })
  ), [invoices, prefillInvoiceId])
  const [form, setForm] = useState<FormState>(() => buildInitialState({
    prefillInvoiceId: prefillInvoiceId ?? getPreferredInvoiceId(availableInvoices),
    prefillAmount,
    prefillPaymentMethod,
    prefillNotes,
  }))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showInvoiceCreate, setShowInvoiceCreate] = useState(false)

  useEffect(() => {
    setForm(buildInitialState({
      prefillInvoiceId: prefillInvoiceId ?? getPreferredInvoiceId(availableInvoices),
      prefillAmount,
      prefillPaymentMethod,
      prefillNotes,
    }))
  }, [availableInvoices, prefillAmount, prefillInvoiceId, prefillNotes, prefillPaymentMethod])

  const selectedInvoice = useMemo(
    () => invoices.find((invoice) => invoice.id === form.invoice_id) ?? null,
    [form.invoice_id, invoices],
  )

  useEffect(() => {
    if (!selectedInvoice || prefillAmount) return

    setForm((current) => {
      if (current.amount.trim()) return current

      return {
        ...current,
        amount: formatMoneyInput(Number(selectedInvoice.outstanding_amount ?? selectedInvoice.total)),
      }
    })
  }, [prefillAmount, selectedInvoice])

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
      amount: formatMoneyInput(Number(selectedInvoice.outstanding_amount ?? selectedInvoice.total)),
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
        setSubmitError('El importe debe ser un numero valido.')
        return
      }

      if (amount <= 0) {
        setSubmitError('El importe del cobro debe ser mayor que cero.')
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
        origin_type: originType,
        notes: form.notes.trim() || null,
      })

      await onCreated()

      setForm(buildInitialState({
        prefillInvoiceId: prefillInvoiceId ?? getPreferredInvoiceId(availableInvoices),
        prefillAmount,
        prefillPaymentMethod,
        prefillNotes,
      }))
      setSuccessMessage('Cobro registrado correctamente.')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido creando el cobro.'

      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="data-section">
      <div className="section-header">
        <h2>{title}</h2>
        <p>{prefillInvoiceId ? description : 'El cobro debe nacer desde una factura abierta. Usa esta vista como control o resolución, no como punto de partida mental.'}</p>
      </div>

      {availableInvoices.length === 0 ? (
        hideInvoiceCreateAction ? (
          <div className="empty-state">
            <strong>Falta la factura base</strong>
            <p>No hay facturas disponibles para registrar este cobro.</p>
          </div>
        ) : (
          <ContextualCreateSection
            actionLabel="Crear factura"
            title="Falta la factura base"
            description="Crea la factura dentro del mismo flujo y el cobro podra continuar sin salir del contexto."
            isOpen={showInvoiceCreate}
            onToggle={() => setShowInvoiceCreate((current) => !current)}
          >
            <InvoiceCreateForm
              clients={clients}
              properties={properties}
              jobs={jobs}
              quotes={quotes}
              onCreated={onCreated}
              onCreatedInvoice={async (invoice) => {
                setForm((current) => ({
                  ...current,
                  invoice_id: invoice.id,
                }))
                setShowInvoiceCreate(false)
              }}
            />
          </ContextualCreateSection>
        )
      ) : (
        <form className="lead-form" onSubmit={handleSubmit}>
          {selectedInvoice ? (
            <div className="cc-detail-panel__next-step" style={{ marginBottom: '1rem' }}>
              <span>Factura origen</span>
              <strong>{formatInvoiceLabel(selectedInvoice)}</strong>
              <small>Pendiente real {formatMoneyInput(Number(selectedInvoice.outstanding_amount ?? selectedInvoice.total))} EUR</small>
            </div>
          ) : null}

          <label className="form-field">
            <span>Factura *</span>
            <select
              value={form.invoice_id}
              onChange={(event) => updateField('invoice_id', event.target.value)}
              disabled={lockInvoiceSelection}
            >
              <option value="">Selecciona una factura</option>
              {availableInvoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {formatInvoiceLabel(invoice)} - Pendiente {formatMoneyInput(Number(invoice.outstanding_amount ?? invoice.total))}
                </option>
              ))}
            </select>
          </label>

          {!hideInvoiceCreateAction ? (
            <ContextualCreateSection
              actionLabel="Crear factura excepcional"
              title="Excepción administrativa"
              description="Solo si el cobro no puede nacer desde una factura ya existente, emite la factura aquí y vuelve al cobro con el contexto fijado."
              isOpen={showInvoiceCreate}
              onToggle={() => setShowInvoiceCreate((current) => !current)}
            >
              <InvoiceCreateForm
                clients={clients}
                properties={properties}
                jobs={jobs}
                quotes={quotes}
                onCreated={onCreated}
                onCreatedInvoice={async (invoice) => {
                  setForm((current) => ({
                    ...current,
                    invoice_id: invoice.id,
                  }))
                  setShowInvoiceCreate(false)
                }}
              />
            </ContextualCreateSection>
          ) : null}

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
            <span>Metodo de cobro</span>
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
              Traer pendiente real
            </button>
            <button type="submit" className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : submitLabel}
            </button>
          </div>

          {submitError ? (
            <div className="cc-alert cc-alert--error">
              <strong>No se pudo registrar el cobro</strong>
              <p>{submitError}</p>
            </div>
          ) : null}

          {successMessage ? (
            <div className="cc-alert cc-alert--success">
              <strong>Operacion correcta</strong>
              <p>{successMessage}</p>
            </div>
          ) : null}
        </form>
      )}
    </section>
  )
}
