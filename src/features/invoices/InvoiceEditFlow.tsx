import { useEffect, useMemo, useState } from 'react'
import { businessRules } from '../../app/businessRules'
import { formatCurrency, formatDateEs, getServiceTypeLabel } from '../../app/displayFormat'
import { formatClientLabel, formatJobLabel, formatQuoteLabel } from '../../app/relationshipLabels'
import { getStatusOptionLabel, invoiceManualStatusOptions } from '../../app/statusOptions'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { FullscreenStepFlow, type FullscreenStepFlowContextItem } from '../../components/FullscreenStepFlow'
import { findInvoiceDuplicateGroups } from '../duplicates/duplicateEngine'
import { DuplicateReviewOverlay } from '../duplicates/DuplicateReviewOverlay'
import {
  saveInvoiceWithLines,
} from '../financial/financialWriteApi'
import type { JobListItem } from '../jobs/types'
import type { QuoteListItem } from '../quotes/types'
import { normalizeLineConcept, simplifyLineConcept } from '../quotes/lineConcepts'
import { completeFullViewActionFlow, type FullViewActionFlowProps } from '../shared/actionFlowLifecycle'
import {
  buildInvoicePaymentMeta,
  buildInvoicePaymentSummary,
  getInvoiceFinancialStatusLabel,
} from './paymentState'
import type { InvoiceLineItem, InvoiceListItem } from './types'
import '../shared/fullscreen-create-flow.css'

interface InvoiceEditFlowProps extends FullViewActionFlowProps {
  invoice: InvoiceListItem
  jobs: JobListItem[]
  quotes: QuoteListItem[]
  title?: string
  description?: string
  submitLabel?: string
  allInvoices?: InvoiceListItem[]
  onOpenExistingInvoice?: (invoiceId: string) => void
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

const invoiceEditSteps = [
  { id: 'context', label: 'Contexto y emision', description: 'Servicio, fecha, estado y notas visibles.' },
  { id: 'lines', label: 'Lineas e importes', description: 'Edita conceptos e importes en un bloque aislado.' },
  { id: 'review', label: 'Revision final', description: 'Valida lectura financiera y referencias antes de guardar.' },
]

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

  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice) || quantity <= 0 || unitPrice < 0) {
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
      simplifyLineConcept(quote.notes, `Servicio segun presupuesto ${quote.display_code ?? quote.id}`),
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

function buildVisibleInvoiceNotes(): string {
  return [
    'Servicio realizado segun presupuesto aprobado.',
    'Condiciones economicas aplicadas segun presupuesto aceptado.',
    'Precios sin IVA.',
  ].join('\n')
}

export function InvoiceEditFlow({
  invoice,
  jobs,
  quotes,
  onRefreshData,
  onCompleted,
  onCancel,
  onDirtyChange,
  title = 'Editar factura',
  description = 'La edicion principal se mueve a un flujo dedicado para que la card de factura se quede como panel de lectura y cobro.',
  submitLabel = 'Guardar cambios',
  allInvoices = [],
  onOpenExistingInvoice,
}: InvoiceEditFlowProps) {
  const [form, setForm] = useState<EditFormState>({
    job_id: invoice.job_id ?? '',
    client_id: invoice.client_id,
    issue_date: invoice.issue_date,
    status: invoice.status,
    notes: invoice.notes ?? '',
  })
  const [lines, setLines] = useState<LineFormState[]>(getFormLinesFromInvoice(invoice))
  const [currentStep, setCurrentStep] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [pendingDuplicateGroups, setPendingDuplicateGroups] = useState<ReturnType<typeof findInvoiceDuplicateGroups>>([])

  useEffect(() => {
    setForm({
      job_id: invoice.job_id ?? '',
      client_id: invoice.client_id,
      issue_date: invoice.issue_date,
      status: invoice.status,
      notes: invoice.notes ?? '',
    })
    setLines(getFormLinesFromInvoice(invoice))
    setCurrentStep(0)
    setError(null)
    setIsDirty(false)
  }, [invoice])

  useEffect(() => {
    onDirtyChange?.(isDirty)
    return () => onDirtyChange?.(false)
  }, [isDirty, onDirtyChange])

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === form.job_id) ?? null,
    [form.job_id, jobs],
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
  const paymentSummary = useMemo(
    () => buildInvoicePaymentSummary(invoice, []),
    [invoice],
  )

  function updateField<K extends keyof EditFormState>(field: K, value: EditFormState[K]) {
    setIsDirty(true)
    setForm((current) => {
      if (field === 'job_id') {
        const nextJob = jobs.find((job) => job.id === value) ?? null
        return {
          ...current,
          job_id: value as string,
          client_id: nextJob?.client_id ?? current.client_id,
        }
      }

      return {
        ...current,
        [field]: value,
      }
    })
  }

  function updateLine<K extends keyof LineFormState>(localId: string, field: K, value: LineFormState[K]) {
    setIsDirty(true)
    setLines((current) => current.map((line) => (
      line.local_id === localId ? { ...line, [field]: value } : line
    )))
  }

  function removeLine(localId: string) {
    setIsDirty(true)
    setLines((current) => (
      current.length > 1 ? current.filter((line) => line.local_id !== localId) : current
    ))
  }

  function addLine() {
    setIsDirty(true)
    setLines((current) => [...current, createBlankLine()])
  }

  function syncFromJobQuote() {
    if (!selectedJob) return

    setIsDirty(true)
    setForm((current) => ({
      ...current,
      client_id: selectedJob.client_id,
      notes: current.notes.trim() ? current.notes : linkedQuote ? buildVisibleInvoiceNotes() : '',
    }))
    setLines([getJobBillingLine(selectedJob) ?? getQuoteBillingLine(linkedQuote) ?? createBlankLine()])
  }

  function getStepError(stepIndex: number): string | null {
    if (stepIndex === 0 && !form.issue_date) {
      return 'Debes indicar la fecha de emision.'
    }

    if (stepIndex === 1) {
      const linePayloads = buildLinePayloads(lines, invoice.id)
      if (!linePayloads || linePayloads.length === 0) {
        return 'Necesitas al menos una linea valida con concepto, cantidad y precio.'
      }
    }

    return null
  }

  function goToStep(nextStep: number) {
    const boundedStep = Math.max(0, Math.min(invoiceEditSteps.length - 1, nextStep))

    if (boundedStep > currentStep) {
      for (let index = 0; index < boundedStep; index += 1) {
        const stepError = getStepError(index)
        if (stepError) {
          setCurrentStep(index)
          setError(stepError)
          return
        }
      }
    }

    setError(null)
    setCurrentStep(boundedStep)
  }

  async function handleSave(skipDuplicateCheck = false) {
    for (let index = 0; index < invoiceEditSteps.length - 1; index += 1) {
      const stepError = getStepError(index)
      if (stepError) {
        setCurrentStep(index)
        setError(stepError)
        return
      }
    }

    setError(null)
    setIsSaving(true)

    try {
      const linePayloads = buildLinePayloads(lines, invoice.id)

      if (!linePayloads || linePayloads.length === 0) {
        setCurrentStep(1)
        setError('Cada linea debe tener concepto, cantidad mayor que 0 y precio unitario valido.')
        return
      }

      if (!skipDuplicateCheck) {
        const duplicateGroups = findInvoiceDuplicateGroups({
          ...invoice,
          job_id: form.job_id || null,
          issue_date: form.issue_date,
          status: form.status,
          subtotal: subtotalValue,
          tax_amount: taxAmountValue,
          total: totalValue,
          notes: form.notes.trim() || null,
          billing_concept: linePayloads[0]?.concept ?? invoice.billing_concept ?? null,
          billing_quantity: linePayloads[0]?.quantity ?? invoice.billing_quantity ?? null,
          billing_unit: linePayloads[0]?.unit ?? invoice.billing_unit ?? null,
          billing_unit_price: linePayloads[0]?.unit_price ?? invoice.billing_unit_price ?? null,
          invoice_lines: linePayloads,
          lines: linePayloads,
        }, allInvoices)

        if (duplicateGroups.length > 0) {
          setPendingDuplicateGroups(duplicateGroups)
          return
        }
      }

      await saveInvoiceWithLines(
        {
          id: invoice.id,
          job_id: form.job_id || null,
          quote_id: invoice.quote_id ?? selectedJob?.quote_id ?? null,
          client_id: form.client_id,
          property_id: invoice.property_id ?? null,
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

      setIsDirty(false)
      await completeFullViewActionFlow({ onRefreshData, onCompleted })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido actualizando la factura.')
    } finally {
      setIsSaving(false)
    }
  }

  function requestCancel() {
    if (!onCancel) return
    if (!isDirty) {
      onCancel()
      return
    }

    setShowCancelConfirm(true)
  }

  const contextItems: FullscreenStepFlowContextItem[] = [
    {
      label: 'Factura',
      value: invoice.invoice_number ?? invoice.display_code ?? invoice.id,
      hint: invoice.display_code ?? invoice.id,
    },
    {
      label: 'Cobro',
      value: getInvoiceFinancialStatusLabel(paymentSummary.financialStatus),
      hint: buildInvoicePaymentMeta(paymentSummary),
    },
    {
      label: 'Total',
      value: formatCurrency(totalValue),
      hint: `${lines.length} linea(s) en edicion`,
    },
  ]

  const currentStepError = getStepError(currentStep)
  const stepStates = invoiceEditSteps.map((_, index) => {
    const stepError = getStepError(index)
    if (index < currentStep) return stepError ? 'blocked' : 'complete'
    if (index === currentStep && stepError) return 'blocked'
    if (index === currentStep) return 'current'
    return 'pending'
  }) as ('complete' | 'current' | 'blocked' | 'pending')[]

  const sideContent = (
    <>
      <section className="cc-create-flow__summary-card">
        <span className="cc-step-flow__eyebrow">Lectura operativa</span>
        <strong>{selectedJob ? formatJobLabel(selectedJob) : invoice.service_reference ?? 'Sin servicio vinculado'}</strong>
        <small>{selectedJob?.quote_id && linkedQuote ? formatQuoteLabel(linkedQuote) : invoice.client_name ?? 'Sin cliente visible'}</small>
      </section>

      <section className="cc-create-flow__summary-card">
        <span className="cc-step-flow__eyebrow">Totales</span>
        <div className="cc-create-flow__totals">
          <div className="cc-create-flow__totals-row">
            <span>Subtotal</span>
            <strong>{formatMoneyInput(subtotalValue)} EUR</strong>
          </div>
          <div className="cc-create-flow__totals-row">
            <span>IVA</span>
            <strong>{formatMoneyInput(taxAmountValue)} EUR</strong>
          </div>
          <div className="cc-create-flow__totals-row cc-create-flow__totals-row--grand">
            <span>Total</span>
            <strong>{formatMoneyInput(totalValue)} EUR</strong>
          </div>
        </div>
      </section>
    </>
  )

  const footerContent = (
    <>
      <div className="cc-create-flow__footer-meta">
        <strong>{invoiceEditSteps[currentStep].label}</strong>
        <small className="cc-create-flow__helper">
          {currentStep < invoiceEditSteps.length - 1
            ? 'La edicion mayor queda fuera de la card para no mezclar cobro, lectura y formulario largo.'
            : 'Al guardar vuelves al mismo detalle y el bloque de cobro sigue intacto en la card.'}
        </small>
      </div>

      <div className="cc-create-flow__footer-actions">
        {onCancel ? (
          <button type="button" className="secondary-button" onClick={requestCancel}>
            Cancelar
          </button>
        ) : null}
        <button
          type="button"
          className="secondary-button"
          onClick={() => goToStep(currentStep - 1)}
          disabled={currentStep === 0}
        >
          Atras
        </button>
        {currentStep < invoiceEditSteps.length - 1 ? (
          <button type="button" className="primary-button" onClick={() => goToStep(currentStep + 1)}>
            Siguiente
          </button>
        ) : (
          <button type="button" className="primary-button" onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? 'Guardando...' : submitLabel}
          </button>
        )}
      </div>
    </>
  )

  return (
    <>
      <FullscreenStepFlow
        eyebrow="Factura"
        title={title}
        description={description}
        steps={invoiceEditSteps}
        currentStep={currentStep}
        stepStates={stepStates}
        onStepSelect={goToStep}
        contextItems={contextItems}
        sideContent={sideContent}
        footerContent={footerContent}
      >
        {currentStep === 0 ? (
          <section className="cc-create-flow__section">
            <article className="cc-create-flow__hero-card">
              <span className="cc-step-flow__eyebrow">Paso 1</span>
              <strong>Contexto de emision y referencia operativa</strong>
              <small>Servicio, fecha, estado y notas quedan concentrados en un bloque corto y util.</small>
            </article>

            <article className={`cc-create-flow__status-card ${currentStepError ? 'cc-create-flow__status-card--blocked' : 'cc-create-flow__status-card--ready'}`}>
              <span className="cc-create-flow__status-icon" aria-hidden="true">{currentStepError ? '!' : 'OK'}</span>
              <div className="cc-create-flow__status-copy">
                <span>{currentStepError ? 'Contexto pendiente' : 'Contexto listo'}</span>
                <strong>{currentStepError ?? 'La emision ya esta preparada para pasar a lineas e importes.'}</strong>
              </div>
            </article>

            <div className="cc-create-flow__grid">
              <label className="form-field">
                <span>Servicio</span>
                <select
                  value={form.job_id}
                  onChange={(event) => updateField('job_id', event.target.value)}
                >
                  <option value="">Sin servicio vinculado</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {formatJobLabel(job)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span>Fecha de emision</span>
                <input
                  type="date"
                  value={form.issue_date}
                  onChange={(event) => updateField('issue_date', event.target.value)}
                  required
                />
              </label>

              <label className="form-field">
                <span>Estado administrativo</span>
                <select
                  value={form.status}
                  onChange={(event) => updateField('status', event.target.value)}
                >
                  {invoiceManualStatusOptions.map((status) => (
                    <option key={status} value={status}>{getStatusOptionLabel(status)}</option>
                  ))}
                </select>
              </label>

              <label className="form-field form-field-full">
                <span>Notas</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => updateField('notes', event.target.value)}
                  rows={5}
                  placeholder="Texto visible o contexto administrativo"
                />
              </label>

              <article className="cc-create-flow__panel">
                <strong>Cliente resuelto</strong>
                <div className="cc-create-flow__summary-list">
                  <div className="cc-create-flow__summary-item">
                    <span>Cliente</span>
                    <strong>{formatClientLabel({ client_id: form.client_id, client_display_code: invoice.client_display_code, client_name: invoice.client_name })}</strong>
                  </div>
                  <div className="cc-create-flow__summary-item">
                    <span>Referencia</span>
                    <strong>{selectedJob ? formatJobLabel(selectedJob) : invoice.service_reference ?? 'Sin servicio'}</strong>
                  </div>
                </div>
              </article>

              <div className="cc-create-flow__microactions">
                <strong>Microacciones</strong>
                <div className="cc-create-flow__microactions-row">
                  <button type="button" className="secondary-button" onClick={syncFromJobQuote} disabled={!selectedJob}>
                    Traer datos del servicio o presupuesto
                  </button>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {currentStep === 1 ? (
          <section className="cc-create-flow__section">
            <article className="cc-create-flow__hero-card">
              <span className="cc-step-flow__eyebrow">Paso 2</span>
              <strong>Lineas y precios sin scroll mixto</strong>
              <small>Las correcciones de conceptos e importes viven solas, sin competir con cobros o relaciones.</small>
            </article>

            <article className={`cc-create-flow__status-card ${currentStepError ? 'cc-create-flow__status-card--blocked' : 'cc-create-flow__status-card--ready'}`}>
              <span className="cc-create-flow__status-icon" aria-hidden="true">{currentStepError ? '!' : 'OK'}</span>
              <div className="cc-create-flow__status-copy">
                <span>{currentStepError ? 'Lineas pendientes' : 'Lineas listas'}</span>
                <strong>{currentStepError ?? `${lines.length} linea(s) validas preparadas para la revision final.`}</strong>
              </div>
            </article>

            <div className="cc-create-flow__line-list">
              {lines.map((line, index) => (
                <article key={line.local_id} className="cc-create-flow__line-card">
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

                  <div className="cc-create-flow__line-actions">
                    <small className="cc-create-flow__helper">Corrige la linea aqui y la vista financiera se recalcula al momento.</small>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => removeLine(line.local_id)}
                      disabled={lines.length === 1}
                    >
                      Quitar linea
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <div className="cc-create-flow__microactions">
              <strong>Microacciones</strong>
              <div className="cc-create-flow__microactions-row">
                <button type="button" className="secondary-button" onClick={addLine}>
                  Anadir linea
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {currentStep === 2 ? (
          <section className="cc-create-flow__section">
            <article className="cc-create-flow__hero-card">
              <span className="cc-step-flow__eyebrow">Paso 3</span>
              <strong>Revision final con lectura financiera clara</strong>
              <small>Se valida referencia, fecha, cobro y total antes de cerrar la edicion mayor.</small>
            </article>

            <article className="cc-create-flow__status-card cc-create-flow__status-card--ready">
              <span className="cc-create-flow__status-icon" aria-hidden="true">OK</span>
              <div className="cc-create-flow__status-copy">
                <span>Documento listo</span>
                <strong>El bloque de cobro y las acciones relacionales seguiran en la card principal.</strong>
              </div>
            </article>

            <div className="cc-create-flow__review-grid">
              <article className="cc-create-flow__review-card">
                <span>Servicio</span>
                <strong>{selectedJob ? formatJobLabel(selectedJob) : invoice.service_reference ?? 'Sin servicio vinculado'}</strong>
                <small>{selectedJob?.quote_id && linkedQuote ? formatQuoteLabel(linkedQuote) : 'Sin presupuesto enlazado'}</small>
              </article>
              <article className="cc-create-flow__review-card">
                <span>Emision</span>
                <strong>{form.issue_date ? formatDateEs(form.issue_date) : 'Pendiente'}</strong>
                <small>{getStatusOptionLabel(form.status)}</small>
              </article>
            </div>

            {lines.map((line, index) => (
              <article key={line.local_id} className="cc-create-flow__panel">
                <strong>Linea {index + 1}</strong>
                <small>{line.concept || 'Concepto pendiente'}</small>
                <div className="cc-create-flow__summary-list">
                  <div className="cc-create-flow__summary-item">
                    <span>Cantidad</span>
                    <strong>{line.quantity}</strong>
                  </div>
                  <div className="cc-create-flow__summary-item">
                    <span>Unidad</span>
                    <strong>{line.unit}</strong>
                  </div>
                  <div className="cc-create-flow__summary-item">
                    <span>Precio</span>
                    <strong>{line.unit_price} EUR</strong>
                  </div>
                  <div className="cc-create-flow__summary-item">
                    <span>Importe</span>
                    <strong>{formatLineSubtotalInput(line)} EUR</strong>
                  </div>
                </div>
              </article>
            ))}
          </section>
        ) : null}

        {error ? (
          <div className="cc-alert cc-alert--error">
            <strong>No se pudo actualizar la factura</strong>
            <p>{error}</p>
          </div>
        ) : null}
      </FullscreenStepFlow>

      <DuplicateReviewOverlay
        isOpen={pendingDuplicateGroups.length > 0}
        title="Posible factura duplicada"
        description="La version editada coincide con otra factura existente por origen, fecha o importe. Revisa antes de guardar."
        groups={pendingDuplicateGroups}
        onClose={() => setPendingDuplicateGroups([])}
        onOpenRecord={(invoiceId) => {
          setPendingDuplicateGroups([])
          onOpenExistingInvoice?.(invoiceId)
        }}
        onUseRecord={(invoiceId) => {
          setPendingDuplicateGroups([])
          onOpenExistingInvoice?.(invoiceId)
        }}
        onContinueAnyway={() => {
          setPendingDuplicateGroups([])
          void handleSave(true)
        }}
      />

      <ConfirmDialog
        isOpen={showCancelConfirm}
        title="Descartar cambios de la factura"
        description="Has empezado a editar esta factura. Si cierras ahora, perderas los cambios no guardados."
        confirmLabel="Descartar cambios"
        tone="warning"
        onCancel={() => setShowCancelConfirm(false)}
        onConfirm={() => {
          setShowCancelConfirm(false)
          onCancel?.()
        }}
      />
    </>
  )
}
