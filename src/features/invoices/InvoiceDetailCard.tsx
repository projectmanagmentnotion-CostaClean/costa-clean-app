import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { businessRules } from '../../app/businessRules'
import { formatCurrency, getServiceTypeLabel } from '../../app/displayFormat'
import { formatClientLabel, formatJobWithClientLabel } from '../../app/relationshipLabels'
import { getStatusLabel } from '../../app/displayText'
import { getStatusOptionLabel, invoiceStatusOptions } from '../../app/statusOptions'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { FeedbackDialog } from '../../components/FeedbackDialog'
import { saveInvoiceWithLines, updateInvoiceStatus as updateInvoiceStatusRpc } from '../financial/financialWriteApi'
import type { InvoiceLineItem, InvoiceListItem } from './types'
import type { JobListItem } from '../jobs/types'
import { normalizeLineConcept, simplifyLineConcept } from '../quotes/lineConcepts'
import type { QuoteListItem } from '../quotes/types'

interface InvoiceDetailCardProps {
  invoice: InvoiceListItem | null
  jobs: JobListItem[]
  quotes: QuoteListItem[]
  onInvoiceUpdated: () => Promise<void>
  onOpenDocument: () => void
  onUnsavedChange?: (hasUnsavedChanges: boolean) => void
}

interface EditFormState {
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

function lineItemToFormLine(line: InvoiceLineItem): LineFormState {
  return {
    local_id: line.id || createLocalId('LINE-DRAFT'),
    concept: normalizeLineConcept(line.concept),
    quantity: formatQuantityInput(Number(line.quantity)),
    unit: line.unit || 'servicio',
    unit_price: formatMoneyInput(Number(line.unit_price)),
  }
}

function getFallbackLineFromInvoice(invoice: InvoiceListItem): LineFormState {
  const quantity = Number(invoice.billing_quantity)
  const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1
  const unitPrice = Number(invoice.billing_unit_price)
  const safeUnitPrice = Number.isFinite(unitPrice) && unitPrice >= 0
    ? unitPrice
    : Number(invoice.subtotal) / safeQuantity

  return {
    local_id: createLocalId('LINE-DRAFT'),
    concept: normalizeLineConcept(
      invoice.billing_concept,
      simplifyLineConcept(invoice.service_description),
    ),
    quantity: formatQuantityInput(safeQuantity),
    unit: invoice.billing_unit?.trim() || 'servicio',
    unit_price: formatMoneyInput(safeUnitPrice),
  }
}

function getFormLinesFromInvoice(invoice: InvoiceListItem): LineFormState[] {
  const persistedLines = invoice.lines?.length ? invoice.lines : invoice.invoice_lines ?? []
  if (persistedLines.length > 0) {
    return [...persistedLines]
      .sort((left, right) => Number(left.sort_order) - Number(right.sort_order))
      .map(lineItemToFormLine)
  }

  return [getFallbackLineFromInvoice(invoice)]
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

function formatLineSubtotalDisplay(line: LineFormState): string {
  const lineSubtotal = calculateLineSubtotal(line)
  return Number.isNaN(lineSubtotal) ? 'Importe no válido' : formatCurrency(lineSubtotal)
}

function getInvoicePrimaryReference(invoice: InvoiceListItem): string {
  return invoice.invoice_number ?? invoice.display_code ?? invoice.id
}

function getInvoiceInternalReference(invoice: InvoiceListItem): string {
  return invoice.display_code ?? invoice.id
}

function getInvoiceServiceReference(invoice: InvoiceListItem): string {
  return invoice.service_reference
    ?? invoice.service_description
    ?? invoice.job_display_code
    ?? invoice.job_id
    ?? 'Factura creada desde presupuesto aceptado'
}

function buildVisibleInvoiceNotes(): string {
  return [
    'Servicio realizado segun presupuesto aprobado.',
    'Condiciones economicas aplicadas segun presupuesto aceptado.',
    'Precios sin IVA.',
  ].join('\n')
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

export function InvoiceDetailCard({
  invoice,
  jobs,
  quotes,
  onInvoiceUpdated,
  onOpenDocument,
  onUnsavedChange,
}: InvoiceDetailCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [pendingPaidStatusUpdate, setPendingPaidStatusUpdate] = useState<string | null>(null)
  const [pendingPaidFormSave, setPendingPaidFormSave] = useState(false)
  const [form, setForm] = useState<EditFormState>({
    job_id: '',
    client_id: '',
    issue_date: '',
    status: 'draft',
    notes: '',
  })
  const [lines, setLines] = useState<LineFormState[]>([createBlankLine()])

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

  const displayLines = useMemo(() => {
    if (!invoice) return []
    return getFormLinesFromInvoice(invoice)
  }, [invoice])

  useEffect(() => {
    if (!invoice) {
      setIsEditing(false)
      setSaveError(null)
      setSuccessMessage(null)
      setForm({
        job_id: '',
        client_id: '',
        issue_date: '',
        status: 'draft',
        notes: '',
      })
      setLines([createBlankLine()])
      return
    }

    setIsEditing(false)
    setSaveError(null)
    setSuccessMessage(null)
    setForm({
      job_id: invoice.job_id ?? '',
      client_id: invoice.client_id,
      issue_date: invoice.issue_date,
      status: invoice.status,
      notes: invoice.notes ?? '',
    })
    setLines(getFormLinesFromInvoice(invoice))
  }, [invoice])

  useEffect(() => {
    onUnsavedChange?.(isEditing)
    return () => onUnsavedChange?.(false)
  }, [isEditing, onUnsavedChange])

  function updateField<K extends keyof EditFormState>(field: K, value: EditFormState[K]) {
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

  function resetFormFromInvoice() {
    if (!invoice) return

    setForm({
      job_id: invoice.job_id ?? '',
      client_id: invoice.client_id,
      issue_date: invoice.issue_date,
      status: invoice.status,
      notes: invoice.notes ?? '',
    })
    setLines(getFormLinesFromInvoice(invoice))
  }

  function syncFromJobQuote() {
    if (!selectedJob) return

    setForm((current) => ({
      ...current,
      client_id: selectedJob.client_id,
      notes: current.notes.trim() ? current.notes : linkedQuote ? buildVisibleInvoiceNotes() : '',
    }))
    setLines([getJobBillingLine(selectedJob) ?? getQuoteBillingLine(linkedQuote) ?? createBlankLine()])
  }

  async function updateInvoiceStatus(nextStatus: string) {
    if (!invoice || invoice.status === nextStatus) return

    setSaveError(null)
    setSuccessMessage(null)
    setIsSaving(true)

    try {
      await updateInvoiceStatusRpc(invoice.id, nextStatus)

      await onInvoiceUpdated()
      setSuccessMessage(`Estado de la factura actualizado a ${getStatusLabel(nextStatus)}.`)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido actualizando el estado de la factura.'
      setSaveError(message)
    } finally {
      setIsSaving(false)
    }
  }

  function requestInvoiceStatusUpdate(nextStatus: string) {
    if (invoice?.status !== 'paid' && nextStatus === 'paid') {
      setPendingPaidStatusUpdate(nextStatus)
      return
    }

    void updateInvoiceStatus(nextStatus)
  }

  function handleConfirmPaidStatusUpdate() {
    if (!pendingPaidStatusUpdate) return

    const nextStatus = pendingPaidStatusUpdate
    setPendingPaidStatusUpdate(null)
    void updateInvoiceStatus(nextStatus)
  }

  async function saveInvoiceEdits(confirmedPaidStatus = false) {
    if (!invoice) return

    if (form.status === 'paid' && invoice.status !== 'paid' && !confirmedPaidStatus) {
      setPendingPaidFormSave(true)
      return
    }

    setSaveError(null)
    setSuccessMessage(null)
    setIsSaving(true)

    try {
      if (!form.client_id) {
        setSaveError('No se pudo resolver el cliente de la factura.')
        return
      }

      if (!form.issue_date) {
        setSaveError('Debes indicar la fecha de emisión.')
        return
      }

      const linePayloads = buildLinePayloads(lines, invoice.id)

      if (!linePayloads || linePayloads.length === 0) {
        setSaveError('Cada línea debe tener concepto, cantidad mayor que 0 y precio unitario válido.')
        return
      }

      await saveInvoiceWithLines(
        {
          id: invoice.id,
          job_id: form.job_id || null,
          quote_id: invoice.quote_id ?? selectedJob?.quote_id ?? null,
          client_id: form.client_id,
          issue_date: form.issue_date,
          status: form.status,
          subtotal: subtotalValue,
          tax_amount: taxAmountValue,
          total: totalValue,
          notes: form.notes.trim() || null,
          internal_notes: invoice.internal_notes ?? linkedQuote?.internal_notes ?? null,
          pricing_metadata: invoice.pricing_metadata ?? linkedQuote?.pricing_metadata ?? null,
        },
        linePayloads,
      )

      await onInvoiceUpdated()
      setSuccessMessage('Factura actualizada correctamente.')
      setIsEditing(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido actualizando la factura.'

      setSaveError(message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await saveInvoiceEdits()
  }

  return (
    <section className="data-section cc-detail-panel cc-detail-panel--invoice">
      <div className="section-header page-header-actions">
        <div>
          <h2>Detalle de la factura</h2>
        </div>

        {invoice ? (
          <div className="cc-detail-panel__actions">
            <button
              type="button"
              className="primary-button"
              onClick={onOpenDocument}
            >
              Abrir documento
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setIsEditing((current) => !current)
                setSaveError(null)
                setSuccessMessage(null)
                resetFormFromInvoice()
              }}
            >
              {isEditing ? 'Cancelar edición' : 'Editar factura'}
            </button>
          </div>
        ) : null}
      </div>

      {invoice ? (
        <div className="lead-detail-card">
          <div className="lead-detail-header">
            <div className="cc-detail-panel__identity">
              <span className="cc-detail-panel__eyebrow">Workspace financiero</span>
              <h3>{getInvoicePrimaryReference(invoice)}</h3>
              <p>Interno {getInvoiceInternalReference(invoice)}</p>
            </div>
            <span className={`lead-badge cc-status-badge cc-status-badge--${invoice.status}`}>{getStatusLabel(invoice.status)}</span>
          </div>

          {!isEditing ? (
            <div className="cc-detail-panel__summary">
              <div className="cc-detail-panel__summary-card">
                <span>Cliente</span>
                <strong>{formatClientLabel(invoice)}</strong>
                <small>{invoice.job_display_code ?? invoice.job_id ?? 'Sin servicio'}</small>
              </div>
              <div className="cc-detail-panel__summary-card">
                <span>Emision</span>
                <strong>{invoice.issue_date}</strong>
                <small>{displayLines.length} linea(s)</small>
              </div>
              <div className="cc-detail-panel__summary-card">
                <span>Total</span>
                <strong>{formatCurrency(invoice.total)}</strong>
                <small>{formatCurrency(invoice.tax_amount)} IVA</small>
              </div>
            </div>
          ) : null}

          {isEditing ? (
            <form className="lead-form cc-detail-panel__editor" onSubmit={handleSubmit}>
              <label className="form-field">
                <span>Servicio</span>
                <select
                  value={form.job_id}
                  onChange={(event) => updateField('job_id', event.target.value)}
                >
                  <option value="">Sin servicio vinculado</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {formatJobWithClientLabel(job)}
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
                  {invoiceStatusOptions.map((status) => (
                    <option key={status} value={status}>{getStatusOptionLabel(status)}</option>
                  ))}
                </select>
              </label>

              <div className="form-field form-field-full">
                <span>Líneas de factura *</span>
                <div className="cc-detail-panel__line-items">
                {lines.map((line, index) => (
                  <div key={line.local_id} className="lead-form cc-detail-panel__line-item" style={{ marginTop: '0.75rem' }}>
                    <label className="form-field form-field-full">
                      <span>Concepto {index + 1}</span>
                      <input
                        value={line.concept}
                        onChange={(event) => updateLine(line.local_id, 'concept', event.target.value)}
                        required
                      />
                    </label>

                    <label className="form-field">
                      <span>Cantidad</span>
                      <input
                        value={line.quantity}
                        onChange={(event) => updateLine(line.local_id, 'quantity', event.target.value)}
                        required
                      />
                    </label>

                    <label className="form-field">
                      <span>Unidad</span>
                      <input
                        value={line.unit}
                        onChange={(event) => updateLine(line.local_id, 'unit', event.target.value)}
                        required
                      />
                    </label>

                    <label className="form-field">
                      <span>Precio unitario</span>
                      <input
                        value={line.unit_price}
                        onChange={(event) => updateLine(line.local_id, 'unit_price', event.target.value)}
                        required
                      />
                    </label>

                    <label className="form-field">
                      <span>Importe</span>
                      <input value={formatLineSubtotalInput(line)} readOnly />
                    </label>

                    <div className="form-actions form-field-full">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => removeLine(line.local_id)}
                        disabled={lines.length === 1}
                      >
                        Quitar línea
                      </button>
                    </div>
                  </div>
                ))}
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setLines((current) => [...current, createBlankLine()])}
                  style={{ marginTop: '0.75rem' }}
                >
                  Añadir línea
                </button>
              </div>

              <label className="form-field">
                <span>Subtotal</span>
                <input value={formatMoneyInput(subtotalValue)} readOnly />
              </label>

              <label className="form-field">
                <span>IVA</span>
                <input value={formatMoneyInput(taxAmountValue)} readOnly />
              </label>

              <label className="form-field">
                <span>Total</span>
                <input value={formatMoneyInput(totalValue)} readOnly />
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
                <button type="button" className="secondary-button" onClick={syncFromJobQuote}>
                  Traer datos del servicio/presupuesto
                </button>

                <button type="submit" className="primary-button" disabled={isSaving}>
                  {isSaving ? 'Guardando cambios...' : 'Guardar cambios'}
                </button>
              </div>

              {saveError ? (
                <div className="cc-alert cc-alert--error">
                  <strong>No se pudo actualizar la factura</strong>
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
              <div className="form-actions cc-detail-panel__status-actions" style={{ marginBottom: '1rem' }}>
                {invoiceStatusOptions.map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={status === invoice.status ? 'primary-button' : 'secondary-button'}
                    onClick={() => requestInvoiceStatusUpdate(status)}
                    disabled={isSaving || status === invoice.status}
                  >
                    {getStatusOptionLabel(status)}
                  </button>
                ))}
              </div>

            <div className="lead-detail-grid cc-detail-panel__grid">
              <div className="detail-row">
                <span className="detail-label">Número factura</span>
                <strong>{invoice.invoice_number ?? 'Sin número'}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Código interno</span>
                <strong>{getInvoiceInternalReference(invoice)}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Servicio</span>
                <strong>{getInvoiceServiceReference(invoice)}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Cliente</span>
                <strong>{formatClientLabel(invoice)}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Fecha de emisión</span>
                <strong>{invoice.issue_date}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Líneas</span>
                <strong>
                  {displayLines.map((line) => `${line.concept} · ${line.quantity} ${line.unit} · ${formatLineSubtotalDisplay(line)}`).join(' | ')}
                </strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Subtotal</span>
                <strong>{formatCurrency(invoice.subtotal)}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">IVA</span>
                <strong>{formatCurrency(invoice.tax_amount)}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Total</span>
                <strong>{formatCurrency(invoice.total)}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Notas</span>
                <strong>{invoice.notes ?? 'Sin notas'}</strong>
              </div>
            </div>
            </>
          )}

        </div>
      ) : (
        <div className="empty-state">
          <strong>Ninguna factura seleccionada</strong>
          <p>Haz clic en una tarjeta del listado para ver su detalle.</p>
        </div>
      )}

      <FeedbackDialog
        isOpen={!isEditing && Boolean(saveError)}
        tone="error"
        title="No se pudo actualizar la factura"
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

      <ConfirmDialog
        isOpen={Boolean(pendingPaidStatusUpdate)}
        title="Marcar factura como pagada"
        description="Esta acción cambia el estado contable visible de la factura a pagada. Confirma solo si el cobro ya está registrado o verificado."
        confirmLabel="Sí, marcar pagada"
        tone="warning"
        isBusy={isSaving}
        onCancel={() => setPendingPaidStatusUpdate(null)}
        onConfirm={handleConfirmPaidStatusUpdate}
      />

      <ConfirmDialog
        isOpen={pendingPaidFormSave}
        title="Guardar factura como pagada"
        description="Vas a guardar la edición dejando la factura en estado pagada. Confirma solo si el cobro ya está registrado o verificado."
        confirmLabel="Guardar como pagada"
        tone="warning"
        isBusy={isSaving}
        onCancel={() => setPendingPaidFormSave(false)}
        onConfirm={() => {
          setPendingPaidFormSave(false)
          void saveInvoiceEdits(true)
        }}
      />
    </section>
  )
}
