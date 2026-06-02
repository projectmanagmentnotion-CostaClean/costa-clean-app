import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { businessRules } from '../../app/businessRules'
import { getServiceTypeLabel } from '../../app/displayFormat'
import { getStatusOptionLabel, invoiceManualStatusOptions } from '../../app/statusOptions'
import { saveInvoiceWithLines } from '../financial/financialWriteApi'
import type { JobListItem } from '../jobs/types'
import { normalizeLineConcept, simplifyLineConcept } from '../quotes/lineConcepts'
import type { QuoteListItem } from '../quotes/types'
import type { InvoiceCreatePrefill } from './invoiceCreatePrefill'

interface InvoiceCreateFormProps {
  jobs: JobListItem[]
  quotes: QuoteListItem[]
  onCreated: () => Promise<void>
  prefill?: InvoiceCreatePrefill | null
}

interface FormState {
  job_id: string
  client_id: string
  issue_date: string
  status: string
  notes: string
}

interface LineFormState {
  local_id: string
  concept: string
  quantity: string
  unit: string
  unit_price: string
}

interface LinePayload {
  id: string
  invoice_id: string
  sort_order: number
  concept: string
  quantity: number
  unit: string
  unit_price: number
  line_subtotal: number
}

function todayLocalDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createLocalId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function parseDecimalInput(value: string): number {
  const normalized = value.trim().replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function formatMoneyInput(value: number): string {
  return roundMoney(value).toFixed(2)
}

function formatQuantityInput(value: number): string {
  return roundMoney(value).toFixed(2)
}

function createBlankLine(): LineFormState {
  return {
    local_id: createLocalId('LINE-DRAFT'),
    concept: '',
    quantity: '1.00',
    unit: 'servicio',
    unit_price: '0.00',
  }
}

function createDefaultFormState(): FormState {
  return {
    job_id: '',
    client_id: '',
    issue_date: todayLocalDate(),
    status: 'draft',
    notes: '',
  }
}

function buildVisibleInvoiceNotes(): string {
  return [
    'Servicio realizado segun presupuesto aprobado.',
    'Condiciones economicas aplicadas segun presupuesto aceptado.',
    'Precios sin IVA.',
  ].join('\n')
}

function getJobBillingLine(job: JobListItem | null): LineFormState | null {
  if (!job) return null

  const quantity = Number(job.billing_quantity)
  const unitPrice = Number(job.billing_unit_price)

  if (
    !Number.isFinite(quantity) ||
    !Number.isFinite(unitPrice) ||
    quantity <= 0 ||
    unitPrice < 0
  ) {
    return null
  }

  return {
    local_id: createLocalId('LINE-DRAFT'),
    concept: normalizeLineConcept(job.billing_concept, simplifyLineConcept(getServiceTypeLabel(job.service_type))),
    quantity: formatQuantityInput(quantity),
    unit: job.billing_unit?.trim() || 'servicio',
    unit_price: formatMoneyInput(unitPrice),
  }
}

function getQuoteBillingLine(quote: QuoteListItem | null): LineFormState | null {
  if (!quote) return null

  const subtotal = Number(quote.subtotal)
  if (!Number.isFinite(subtotal) || subtotal < 0) return null

  return {
    local_id: createLocalId('LINE-DRAFT'),
    concept: normalizeLineConcept(
      quote.lines?.[0]?.concept ?? quote.quote_lines?.[0]?.concept,
      simplifyLineConcept(
        quote.notes,
        `Servicio segun presupuesto ${quote.display_code ?? quote.id}`,
      ),
    ),
    quantity: '1.00',
    unit: 'servicio',
    unit_price: formatMoneyInput(subtotal),
  }
}

function buildLinesForJob(job: JobListItem | null, quote: QuoteListItem | null): LineFormState[] {
  return [getJobBillingLine(job) ?? getQuoteBillingLine(quote) ?? createBlankLine()]
}

function buildLinesFromPrefill(prefill: InvoiceCreatePrefill): LineFormState[] {
  if (prefill.lines.length === 0) {
    return [createBlankLine()]
  }

  return prefill.lines.map((line) => ({
    local_id: createLocalId('LINE-DRAFT'),
    concept: normalizeLineConcept(line.concept),
    quantity: line.quantity,
    unit: line.unit,
    unit_price: line.unit_price,
  }))
}

function applyPrefillToForm(prefill: InvoiceCreatePrefill): FormState {
  const defaultState = createDefaultFormState()

  return {
    ...defaultState,
    job_id: prefill.job_id,
    client_id: prefill.client_id,
    notes: prefill.notes,
  }
}

function calculateLineSubtotal(line: LineFormState): number {
  const quantity = parseDecimalInput(line.quantity)
  const unitPrice = parseDecimalInput(line.unit_price)
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return Number.NaN
  return roundMoney(quantity * unitPrice)
}

function formatLineSubtotalInput(line: LineFormState): string {
  const lineSubtotal = calculateLineSubtotal(line)
  return Number.isNaN(lineSubtotal) ? '' : formatMoneyInput(lineSubtotal)
}

function calculateSubtotal(lines: LineFormState[]): number {
  return roundMoney(lines.reduce((sum, line) => {
    const lineSubtotal = calculateLineSubtotal(line)
    return Number.isNaN(lineSubtotal) ? sum : sum + lineSubtotal
  }, 0))
}

function buildLinePayloads(lines: LineFormState[], invoiceId: string): LinePayload[] | null {
  const payloads: LinePayload[] = []

  for (const [index, line] of lines.entries()) {
    const concept = normalizeLineConcept(line.concept)
    const quantity = parseDecimalInput(line.quantity)
    const unitPrice = parseDecimalInput(line.unit_price)
    const lineSubtotal = calculateLineSubtotal(line)

    if (!concept || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || !Number.isFinite(lineSubtotal)) {
      return null
    }

    payloads.push({
      id: createLocalId('INVOICE-LINE'),
      invoice_id: invoiceId,
      sort_order: index + 1,
      concept,
      quantity: roundMoney(quantity),
      unit: line.unit.trim() || 'servicio',
      unit_price: roundMoney(unitPrice),
      line_subtotal: lineSubtotal,
    })
  }

  return payloads
}

export function InvoiceCreateForm({
  jobs,
  quotes,
  onCreated,
  prefill = null,
}: InvoiceCreateFormProps) {
  const [form, setForm] = useState<FormState>(() => (
    prefill ? applyPrefillToForm(prefill) : createDefaultFormState()
  ))
  const [lines, setLines] = useState<LineFormState[]>(() => (
    prefill ? buildLinesFromPrefill(prefill) : [createBlankLine()]
  ))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [lastAppliedPrefillId, setLastAppliedPrefillId] = useState<string | null>(prefill?.request_id ?? null)

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === form.job_id) ?? null,
    [jobs, form.job_id],
  )

  const linkedQuote = useMemo(() => {
    if (!selectedJob?.quote_id) return null
    return quotes.find((quote) => quote.id === selectedJob.quote_id) ?? null
  }, [quotes, selectedJob])

  const subtotalValue = useMemo(() => calculateSubtotal(lines), [lines])
  const taxAmountValue = useMemo(
    () => roundMoney(subtotalValue * businessRules.defaultTaxRate),
    [subtotalValue],
  )
  const totalValue = useMemo(
    () => roundMoney(subtotalValue + taxAmountValue),
    [subtotalValue, taxAmountValue],
  )

  useEffect(() => {
    if (!selectedJob) return

    setForm((current) => ({
      ...current,
      client_id: selectedJob.client_id,
      notes: current.notes.trim() ? current.notes : linkedQuote ? buildVisibleInvoiceNotes() : '',
    }))

    setLines(buildLinesForJob(selectedJob, linkedQuote))
  }, [selectedJob, linkedQuote])

  useEffect(() => {
    if (!prefill || prefill.request_id === lastAppliedPrefillId) {
      return
    }

    setForm(applyPrefillToForm(prefill))
    setLines(buildLinesFromPrefill(prefill))
    setSubmitError(null)
    setSuccessMessage(null)
    setLastAppliedPrefillId(prefill.request_id)
  }, [jobs, lastAppliedPrefillId, prefill])

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function updateLine<K extends keyof LineFormState>(
    localId: string,
    field: K,
    value: LineFormState[K],
  ) {
    setLines((current) => current.map((line) => (
      line.local_id === localId ? { ...line, [field]: value } : line
    )))
  }

  function removeLine(localId: string) {
    setLines((current) => (
      current.length > 1 ? current.filter((line) => line.local_id !== localId) : current
    ))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError(null)
    setSuccessMessage(null)
    setIsSubmitting(true)

    try {
      if (!form.job_id) {
        setSubmitError('Debes seleccionar un servicio.')
        return
      }

      if (!form.client_id) {
        setSubmitError('No se pudo resolver el cliente del servicio.')
        return
      }

      if (!form.issue_date) {
        setSubmitError('Debes indicar la fecha de emision.')
        return
      }

      const invoiceId = createLocalId('INVOICE')
      const linePayloads = buildLinePayloads(lines, invoiceId)

      if (!linePayloads || linePayloads.length === 0) {
        setSubmitError('Cada linea debe tener concepto, cantidad mayor que 0 y precio unitario valido.')
        return
      }

      await saveInvoiceWithLines(
        {
          id: invoiceId,
          job_id: form.job_id,
          quote_id: selectedJob?.quote_id ?? null,
          client_id: form.client_id,
          issue_date: form.issue_date,
          status: form.status,
          subtotal: subtotalValue,
          tax_amount: taxAmountValue,
          total: totalValue,
          notes: form.notes.trim() || null,
          internal_notes: linkedQuote?.internal_notes ?? null,
          pricing_metadata: linkedQuote?.pricing_metadata ?? null,
        },
        linePayloads,
      )

      await onCreated()

      setForm(createDefaultFormState())
      setLines([createBlankLine()])
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
    <section className="data-section cc-form-shell cc-form-shell--invoice">
      <div className="section-header cc-form-shell__header">
        <div className="cc-form-shell__intro">
          <span className="cc-form-shell__eyebrow">Documento de cobro</span>
          <h2>Nueva factura</h2>
          <p>
            Emite una factura vinculada a un servicio, con lineas e IVA automatico del {businessRules.defaultTaxRate * 100}%.
          </p>
        </div>

        <div className="cc-form-shell__summary">
          <div className="cc-form-shell__summary-card">
            <span>Servicio</span>
            <strong>{selectedJob?.display_code ?? selectedJob?.id ?? 'Pendiente'}</strong>
            <small>{selectedJob?.client_display_code ?? selectedJob?.client_id ?? 'Sin cliente'}</small>
          </div>
          <div className="cc-form-shell__summary-card">
            <span>Total actual</span>
            <strong>{formatMoneyInput(totalValue)} €</strong>
            <small>{lines.length} linea(s)</small>
          </div>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="empty-state">
          <strong>No hay servicios disponibles</strong>
          <p>Primero debes crear al menos un servicio para poder facturar.</p>
        </div>
      ) : (
        <form className="lead-form cc-form-shell__grid" onSubmit={handleSubmit}>
          <div className="cc-form-shell__main">
            <section className="cc-form-shell__section">
              <div className="cc-form-shell__section-head">
                <strong>Base documental</strong>
                <span>Servicio, fecha y estado de emision.</span>
              </div>

              <label className="form-field">
                <span>Servicio *</span>
              <select
                value={form.job_id}
                onChange={(event) => updateField('job_id', event.target.value)}
              >
                <option value="">Selecciona un servicio</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {(job.display_code ?? job.id)} · {(job.client_display_code ?? job.client_id)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span>Fecha de emision *</span>
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
                  {invoiceManualStatusOptions.map((status) => (
                    <option key={status} value={status}>{getStatusOptionLabel(status)}</option>
                  ))}
                </select>
              </label>
            </section>

            <section className="cc-form-shell__section cc-form-shell__section--full">
              <div className="cc-form-shell__section-head">
                <strong>Lineas de cobro</strong>
                <span>Detalle editable con importes visibles y consistentes.</span>
              </div>

              <div className="form-field form-field-full">
                <span>Lineas de factura *</span>
                <div className="cc-form-shell__line-list">
                  {lines.map((line, index) => (
                    <div key={line.local_id} className="lead-form cc-line-editor-row cc-line-editor-row--premium">
                      <label className="form-field form-field-full cc-line-editor-row__concept">
                        <span>Concepto {index + 1}</span>
                        <input
                          value={line.concept}
                          onChange={(event) => updateLine(line.local_id, 'concept', event.target.value)}
                          required
                        />
                      </label>

                      <label className="form-field cc-line-editor-row__field cc-line-editor-row__field--quantity">
                        <span>Cantidad</span>
                        <input
                          value={line.quantity}
                          onChange={(event) => updateLine(line.local_id, 'quantity', event.target.value)}
                          required
                        />
                      </label>

                      <label className="form-field cc-line-editor-row__field cc-line-editor-row__field--unit">
                        <span>Unidad</span>
                        <input
                          value={line.unit}
                          onChange={(event) => updateLine(line.local_id, 'unit', event.target.value)}
                          required
                        />
                      </label>

                      <label className="form-field cc-line-editor-row__field cc-line-editor-row__field--price">
                        <span>Precio unitario</span>
                        <input
                          value={line.unit_price}
                          onChange={(event) => updateLine(line.local_id, 'unit_price', event.target.value)}
                          required
                        />
                      </label>

                      <label className="form-field cc-line-editor-row__field cc-line-editor-row__field--amount">
                        <span>Importe</span>
                        <input value={formatLineSubtotalInput(line)} readOnly />
                      </label>

                      <div className="form-actions form-field-full cc-line-editor-row__actions">
                        <button
                          type="button"
                          className="secondary-button cc-line-editor-row__remove"
                          onClick={() => removeLine(line.local_id)}
                          disabled={lines.length === 1}
                        >
                          Quitar linea
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setLines((current) => [...current, createBlankLine()])}
                >
                  Añadir linea
                </button>
              </div>
            </section>

            <section className="cc-form-shell__section cc-form-shell__section--full">
              <div className="cc-form-shell__section-head">
                <strong>Notas visibles</strong>
                <span>Condiciones o texto contextual del documento.</span>
              </div>

              <label className="form-field form-field-full">
                <span>Notas</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => updateField('notes', event.target.value)}
                  rows={4}
                  placeholder="Notas o condiciones de la factura"
                />
              </label>
            </section>

            {submitError ? (
              <div className="cc-alert cc-alert--error">
                <strong>No se pudo crear la factura</strong>
                <p>{submitError}</p>
              </div>
            ) : null}

            {successMessage ? (
              <div className="cc-alert cc-alert--success">
                <strong>Operacion correcta</strong>
                <p>{successMessage}</p>
              </div>
            ) : null}
          </div>

          <aside className="cc-form-shell__aside">
            <div className="cc-form-shell__sticky">
              <div className="cc-form-shell__totals">
                <div className="cc-form-shell__totals-row">
                  <span>Subtotal</span>
                  <strong>{formatMoneyInput(subtotalValue)} €</strong>
                </div>
                <div className="cc-form-shell__totals-row">
                  <span>IVA</span>
                  <strong>{formatMoneyInput(taxAmountValue)} €</strong>
                </div>
                <div className="cc-form-shell__totals-row cc-form-shell__totals-row--grand">
                  <span>Total</span>
                  <strong>{formatMoneyInput(totalValue)} €</strong>
                </div>
              </div>

              <div className="cc-form-shell__summary-card cc-form-shell__summary-card--stack">
                <span>Salida</span>
                <strong>Factura lista</strong>
                <small>Se emitirá con lineas, fecha y referencia al servicio seleccionado.</small>
              </div>

              <div className="form-actions cc-form-shell__actions">
                <button type="submit" className="primary-button" disabled={isSubmitting}>
                  {isSubmitting ? 'Guardando...' : 'Guardar factura'}
                </button>
              </div>
            </div>
          </aside>
        </form>
      )}
    </section>
  )
}
