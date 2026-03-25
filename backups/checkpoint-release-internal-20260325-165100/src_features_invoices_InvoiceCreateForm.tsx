import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { businessRules } from '../../app/businessRules'
import { getStatusLabel } from '../../app/displayText'
import type { JobListItem } from '../jobs/types'
import type { QuoteListItem } from '../quotes/types'

interface InvoiceCreateFormProps {
  jobs: JobListItem[]
  quotes: QuoteListItem[]
  onCreated: () => Promise<void>
}

interface FormState {
  job_id: string
  client_id: string
  issue_date: string
  status: string
  subtotal: string
  tax_amount: string
  total: string
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

export function InvoiceCreateForm({
  jobs,
  quotes,
  onCreated,
}: InvoiceCreateFormProps) {
  const [form, setForm] = useState<FormState>({
    job_id: jobs[0]?.id ?? '',
    client_id: jobs[0]?.client_id ?? '',
    issue_date: todayLocalDate(),
    status: 'draft',
    subtotal: '0.00',
    tax_amount: '0.00',
    total: '0.00',
    notes: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === form.job_id) ?? null,
    [jobs, form.job_id],
  )

  const linkedQuote = useMemo(() => {
    if (!selectedJob?.quote_id) {
      return null
    }
    return quotes.find((quote) => quote.id === selectedJob.quote_id) ?? null
  }, [quotes, selectedJob])

  useEffect(() => {
    if (!selectedJob) {
      return
    }

    setForm((current) => {
      let subtotal = current.subtotal
      let taxAmount = current.tax_amount
      let total = current.total
      let notes = current.notes

      if (linkedQuote) {
        subtotal = formatMoneyInput(Number(linkedQuote.subtotal))
        taxAmount = formatMoneyInput(Number(linkedQuote.tax_amount ?? 0))
        total = formatMoneyInput(Number(linkedQuote.total))
        if (!current.notes.trim()) {
          notes = linkedQuote.notes ?? ''
        }
      }

      return {
        ...current,
        client_id: selectedJob.client_id,
        subtotal,
        tax_amount: taxAmount,
        total,
        notes,
      }
    })
  }, [selectedJob, linkedQuote])

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function recalculateFromSubtotal(value: string) {
    const subtotal = parseDecimalInput(value)

    if (Number.isNaN(subtotal)) {
      setForm((current) => ({
        ...current,
        subtotal: value,
        tax_amount: '',
        total: '',
      }))
      return
    }

    const taxAmount = subtotal * businessRules.defaultTaxRate
    const total = subtotal + taxAmount

    setForm((current) => ({
      ...current,
      subtotal: value,
      tax_amount: formatMoneyInput(taxAmount),
      total: formatMoneyInput(total),
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError(null)
    setSuccessMessage(null)
    setIsSubmitting(true)

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseAnonKey) {
        setSubmitError('Faltan las variables de entorno de Supabase.')
        return
      }

      if (!form.job_id) {
        setSubmitError('Debes seleccionar un servicio.')
        return
      }

      if (!form.client_id) {
        setSubmitError('No se pudo resolver el cliente del servicio.')
        return
      }

      if (!form.issue_date) {
        setSubmitError('Debes indicar la fecha de emisión.')
        return
      }

      const subtotal = parseDecimalInput(form.subtotal)
      const taxAmount = parseDecimalInput(form.tax_amount)
      const total = parseDecimalInput(form.total)

      if (
        Number.isNaN(subtotal) ||
        Number.isNaN(taxAmount) ||
        Number.isNaN(total)
      ) {
        setSubmitError('Subtotal, IVA y total deben ser números válidos.')
        return
      }

      const invoiceId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? `INVOICE-${crypto.randomUUID()}`
          : `INVOICE-${Date.now()}`

      const response = await fetch(`${supabaseUrl}/rest/v1/invoices`, {
        method: 'POST',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: invoiceId,
          job_id: form.job_id,
          client_id: form.client_id,
          issue_date: form.issue_date,
          status: form.status,
          subtotal: Number(formatMoneyInput(subtotal)),
          tax_amount: Number(formatMoneyInput(taxAmount)),
          total: Number(formatMoneyInput(total)),
          notes: form.notes.trim() || null,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        setSubmitError(`REST ${response.status}: ${errorText || response.statusText}`)
        return
      }

      await onCreated()

      setForm({
        job_id: jobs[0]?.id ?? '',
        client_id: jobs[0]?.client_id ?? '',
        issue_date: todayLocalDate(),
        status: 'draft',
        subtotal: '0.00',
        tax_amount: '0.00',
        total: '0.00',
        notes: '',
      })
      setSuccessMessage('Factura creada correctamente.')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido creando la factura.'

      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="data-section">
      <div className="section-header">
        <h2>Nueva factura</h2>
        <p>
          Emite una factura vinculada a un servicio, con IVA automático del {businessRules.defaultTaxRate * 100}%.
        </p>
      </div>

      {jobs.length === 0 ? (
        <div className="empty-state">
          <strong>No hay servicios disponibles</strong>
          <p>Primero debes crear al menos un servicio para poder facturar.</p>
        </div>
      ) : (
        <form className="lead-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Servicio *</span>
            <select
              value={form.job_id}
              onChange={(event) => updateField('job_id', event.target.value)}
            >
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {(job.display_code ?? job.id)} · {(job.client_display_code ?? job.client_id)}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Fecha de emisión *</span>
            <input
              type="date"
              value={form.issue_date}
              onChange={(event) => updateField('issue_date', event.target.value)}
              required
            />
          </label>

          <label className="form-field">
            <span>Estado</span>
            <select
              value={form.status}
              onChange={(event) => updateField('status', event.target.value)}
            >
              <option value="draft">{getStatusLabel('draft')}</option>
              <option value="issued">{getStatusLabel('issued')}</option>
              <option value="paid">{getStatusLabel('paid')}</option>
              <option value="cancelled">{getStatusLabel('cancelled')}</option>
            </select>
          </label>

          <label className="form-field">
            <span>Subtotal *</span>
            <input
              value={form.subtotal}
              onChange={(event) => recalculateFromSubtotal(event.target.value)}
              required
            />
          </label>

          <label className="form-field">
            <span>IVA (automático)</span>
            <input value={form.tax_amount} readOnly />
          </label>

          <label className="form-field">
            <span>Total (automático)</span>
            <input value={form.total} readOnly />
          </label>

          <label className="form-field form-field-full">
            <span>Notas</span>
            <textarea
              value={form.notes}
              onChange={(event) => updateField('notes', event.target.value)}
              rows={4}
              placeholder="Notas o condiciones de la factura"
            />
          </label>

          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar factura'}
            </button>
          </div>

          {submitError ? (
            <div className="cc-alert cc-alert--error">
              <strong>No se pudo crear la factura</strong>
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
