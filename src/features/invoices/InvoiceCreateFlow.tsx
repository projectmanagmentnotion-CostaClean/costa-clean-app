import { useEffect, useMemo, useState } from 'react'
import { businessRules } from '../../app/businessRules'
import { getServiceTypeLabel } from '../../app/displayFormat'
import { formatClientLabel, formatJobLabel, formatPropertyLabel, formatQuoteLabel } from '../../app/relationshipLabels'
import { getStatusOptionLabel, invoiceManualStatusOptions } from '../../app/statusOptions'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ContextualCreateSection } from '../../components/ContextualCreateSection'
import { FullscreenStepFlow, type FullscreenStepFlowContextItem } from '../../components/FullscreenStepFlow'
import { ClientBillingDetailsInlineForm } from '../clients/ClientBillingDetailsInlineForm'
import { ClientCreateForm } from '../clients/ClientCreateForm'
import type { ClientListItem } from '../clients/types'
import { saveInvoiceWithLines } from '../financial/financialWriteApi'
import { JobCreateFlow } from '../jobs/JobCreateFlow'
import type { JobListItem } from '../jobs/types'
import { PropertyCreateFlow } from '../properties/PropertyCreateFlow'
import type { PropertyListItem } from '../properties/types'
import { QuoteCreateFlow } from '../quotes/QuoteCreateFlow'
import { normalizeLineConcept, simplifyLineConcept } from '../quotes/lineConcepts'
import type { QuoteListItem } from '../quotes/types'
import {
  completeContextualActionFlow,
  completeFullViewActionFlow,
  type FullViewActionFlowProps,
} from '../shared/actionFlowLifecycle'
import type { InvoiceCreatePrefill } from './invoiceCreatePrefill'
import type { InvoiceListItem } from './types'
import './InvoiceCreateFlow.css'
import '../shared/fullscreen-create-flow.css'

interface InvoiceCreateFlowProps extends FullViewActionFlowProps {
  clients: ClientListItem[]
  properties: PropertyListItem[]
  jobs: JobListItem[]
  quotes: QuoteListItem[]
  prefill?: InvoiceCreatePrefill | null
  onCreatedInvoice?: (invoice: InvoiceListItem) => void | Promise<void>
}

type InvoiceOriginMode = 'job' | 'quote' | 'manual'

interface FormState {
  origin_mode: InvoiceOriginMode
  job_id: string
  quote_id: string
  client_id: string
  property_id: string
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

const invoiceSteps = [
  { id: 'origin', label: 'Origen y contexto', description: 'Define la ruta correcta y hereda referencias.' },
  { id: 'billing', label: 'Facturacion', description: 'Completa cliente, ficha fiscal y emision.' },
  { id: 'lines', label: 'Lineas e importes', description: 'Valida conceptos, cantidades y precios.' },
  { id: 'review', label: 'Revision final', description: 'Confirma el documento antes de emitir.' },
]

const invoiceNextLabels = [
  'Confirmar origen',
  'Revisar lineas',
  'Ir a revision final',
]

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
    origin_mode: 'job',
    job_id: '',
    quote_id: '',
    client_id: '',
    property_id: '',
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
  const originMode = prefill.origin_kind === 'quote'
    ? 'quote'
    : prefill.origin_kind === 'manual'
      ? 'manual'
      : 'job'

  return {
    ...defaultState,
    origin_mode: originMode,
    job_id: prefill.job_id,
    quote_id: prefill.quote_id,
    client_id: prefill.client_id,
    property_id: prefill.property_id,
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

function getOriginDescription(originMode: InvoiceOriginMode): string {
  switch (originMode) {
    case 'job':
      return 'Ruta principal. Emite desde un servicio real y reutiliza su base de facturacion.'
    case 'quote':
      return 'Ruta secundaria. Factura desde un presupuesto aceptado cuando todavia no existe servicio.'
    case 'manual':
      return 'Excepcion administrativa. Factura directa solo cuando no aplica la ruta operativa normal.'
  }
}

function getClientFiscalIssue(client: ClientListItem | null): string | null {
  if (!client) return null
  if (!client.tax_id?.trim() || !client.billing_address?.trim()) {
    return 'Faltan NIF/CIF o direccion de facturacion en la ficha del cliente.'
  }
  return null
}

function renderSummaryValue(value: string | null | undefined, fallback = 'Pendiente') {
  return value && value.trim() ? value : fallback
}

export function InvoiceCreateFlow({
  clients,
  properties,
  jobs,
  quotes,
  onRefreshData,
  onCompleted,
  prefill = null,
  onCreatedInvoice,
  onCancel,
  onDirtyChange,
}: InvoiceCreateFlowProps) {
  const [form, setForm] = useState<FormState>(() => (prefill ? applyPrefillToForm(prefill) : createDefaultFormState()))
  const [lines, setLines] = useState<LineFormState[]>(() => (prefill ? buildLinesFromPrefill(prefill) : [createBlankLine()]))
  const [currentStep, setCurrentStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [lastAppliedPrefillId, setLastAppliedPrefillId] = useState<string | null>(prefill?.request_id ?? null)
  const [showClientCreate, setShowClientCreate] = useState(false)
  const [showPropertyCreate, setShowPropertyCreate] = useState(false)
  const [showJobCreate, setShowJobCreate] = useState(false)
  const [showQuoteCreate, setShowQuoteCreate] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  const availableProperties = useMemo(() => {
    if (!form.client_id) return []
    return properties.filter((property) => property.client_id === form.client_id)
  }, [properties, form.client_id])

  const availableJobs = useMemo(() => jobs.filter((job) => {
    if (form.client_id && job.client_id !== form.client_id) return false
    if (form.property_id && job.property_id !== form.property_id) return false
    if ((job as JobListItem & { invoice_id?: string | null }).invoice_id) return false
    return true
  }), [jobs, form.client_id, form.property_id])

  const availableQuotes = useMemo(() => quotes.filter((quote) => {
    if (form.client_id && quote.client_id !== form.client_id) return false
    if (form.property_id && quote.property_id && quote.property_id !== form.property_id) return false
    return quote.status === 'accepted'
  }), [quotes, form.client_id, form.property_id])

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === form.client_id) ?? null,
    [clients, form.client_id],
  )
  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === form.property_id) ?? null,
    [properties, form.property_id],
  )
  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === form.job_id) ?? null,
    [jobs, form.job_id],
  )
  const selectedQuote = useMemo(() => {
    if (form.origin_mode === 'job') {
      if (!selectedJob?.quote_id) return null
      return quotes.find((quote) => quote.id === selectedJob.quote_id) ?? null
    }

    if (!form.quote_id) return null
    return quotes.find((quote) => quote.id === form.quote_id) ?? null
  }, [form.origin_mode, form.quote_id, quotes, selectedJob])

  const subtotalValue = useMemo(() => calculateSubtotal(lines), [lines])
  const taxAmountValue = useMemo(
    () => roundMoney(subtotalValue * businessRules.defaultTaxRate),
    [subtotalValue],
  )
  const totalValue = useMemo(
    () => roundMoney(subtotalValue + taxAmountValue),
    [subtotalValue, taxAmountValue],
  )
  const isOriginLocked = Boolean(prefill?.job_id || prefill?.quote_id)
  const clientFiscalIssue = getClientFiscalIssue(selectedClient)

  useEffect(() => {
    onDirtyChange?.(isDirty)
    return () => onDirtyChange?.(false)
  }, [isDirty, onDirtyChange])

  useEffect(() => {
    if (!selectedJob || form.origin_mode !== 'job') return

    setForm((current) => ({
      ...current,
      client_id: selectedJob.client_id,
      property_id: selectedJob.property_id,
      quote_id: selectedJob.quote_id ?? '',
      notes: current.notes.trim() ? current.notes : selectedJob.quote_id ? buildVisibleInvoiceNotes() : '',
    }))

    setLines([getJobBillingLine(selectedJob) ?? getQuoteBillingLine(selectedQuote) ?? createBlankLine()])
  }, [form.origin_mode, selectedJob, selectedQuote])

  useEffect(() => {
    if (!selectedQuote || form.origin_mode !== 'quote') return

    setForm((current) => ({
      ...current,
      client_id: selectedQuote.client_id ?? current.client_id,
      property_id: selectedQuote.property_id ?? current.property_id,
      notes: current.notes.trim() ? current.notes : buildVisibleInvoiceNotes(),
    }))

    setLines([getQuoteBillingLine(selectedQuote) ?? createBlankLine()])
  }, [form.origin_mode, selectedQuote])

  useEffect(() => {
    if (!prefill || prefill.request_id === lastAppliedPrefillId) return

    setForm(applyPrefillToForm(prefill))
    setLines(buildLinesFromPrefill(prefill))
    setSubmitError(null)
    setIsDirty(false)
    setCurrentStep(0)
    setLastAppliedPrefillId(prefill.request_id)
  }, [lastAppliedPrefillId, prefill])

  function markDirty() {
    setIsDirty(true)
  }

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    markDirty()
    setForm((current) => {
      const next = {
        ...current,
        [field]: value,
      }

      if (field === 'origin_mode') {
        if (value === 'manual') {
          next.job_id = ''
          next.quote_id = ''
        }

        if (value === 'quote') {
          next.job_id = ''
        }
      }

      if (field === 'client_id') {
        next.property_id = ''
        if (current.origin_mode !== 'job') {
          next.quote_id = ''
          next.job_id = ''
        }
      }

      if (field === 'property_id' && current.origin_mode !== 'job') {
        next.quote_id = ''
        if (current.origin_mode === 'manual') {
          next.job_id = ''
        }
      }

      return next
    })
  }

  function updateLine<K extends keyof LineFormState>(localId: string, field: K, value: LineFormState[K]) {
    markDirty()
    setLines((current) => current.map((line) => (
      line.local_id === localId ? { ...line, [field]: value } : line
    )))
  }

  function removeLine(localId: string) {
    markDirty()
    setLines((current) => (current.length > 1 ? current.filter((line) => line.local_id !== localId) : current))
  }

  function addLine() {
    markDirty()
    setLines((current) => [...current, createBlankLine()])
  }

  function getStepError(stepIndex: number): string | null {
    if (stepIndex === 0) {
      if (form.origin_mode === 'job' && !form.job_id) return 'Selecciona un servicio para seguir la ruta principal.'
      if (form.origin_mode === 'quote' && !form.quote_id) return 'Selecciona un presupuesto aceptado para facturar desde presupuesto.'
      if (form.origin_mode === 'manual' && !form.client_id) return 'Selecciona o crea un cliente para la factura administrativa.'
      return null
    }

    if (stepIndex === 1) {
      if (!form.client_id) return 'Debes tener un cliente seleccionado.'
      if (!form.issue_date) return 'Debes indicar la fecha de emision.'
      if (clientFiscalIssue) return clientFiscalIssue
      return null
    }

    if (stepIndex === 2) {
      const payloads = buildLinePayloads(lines, 'DRAFT-INVOICE')
      if (!payloads || payloads.length === 0) {
        return 'Necesitas al menos una linea valida con concepto, cantidad y precio.'
      }
      return null
    }

    return null
  }

  function goToStep(nextStep: number) {
    const boundedStep = Math.max(0, Math.min(invoiceSteps.length - 1, nextStep))

    if (boundedStep > currentStep) {
      for (let index = 0; index < boundedStep; index += 1) {
        const error = getStepError(index)
        if (error) {
          setCurrentStep(index)
          setSubmitError(error)
          return
        }
      }
    }

    setSubmitError(null)
    setCurrentStep(boundedStep)
  }

  async function handleSave() {
    setSubmitError(null)

    for (let index = 0; index < invoiceSteps.length - 1; index += 1) {
      const error = getStepError(index)
      if (error) {
        setCurrentStep(index)
        setSubmitError(error)
        return
      }
    }

    setIsSubmitting(true)

    try {
      const invoiceId = createLocalId('INVOICE')
      const linePayloads = buildLinePayloads(lines, invoiceId)

      if (!linePayloads || linePayloads.length === 0) {
        setCurrentStep(2)
        setSubmitError('Cada linea debe tener concepto, cantidad mayor que 0 y precio unitario valido.')
        return
      }

      await saveInvoiceWithLines(
        {
          id: invoiceId,
          job_id: form.origin_mode === 'job' ? form.job_id : null,
          quote_id: selectedQuote?.id ?? (form.origin_mode === 'quote' ? form.quote_id : null),
          client_id: form.client_id,
          property_id: form.property_id || null,
          issue_date: form.issue_date,
          status: form.status,
          subtotal: subtotalValue,
          tax_amount: taxAmountValue,
          total: totalValue,
          notes: form.notes.trim() || null,
          internal_notes: selectedQuote?.internal_notes ?? null,
          pricing_metadata: selectedQuote?.pricing_metadata ?? null,
        },
        linePayloads,
      )

      await onCreatedInvoice?.({
        id: invoiceId,
        display_code: null,
        invoice_number: null,
        job_id: form.origin_mode === 'job' ? form.job_id : null,
        quote_id: selectedQuote?.id ?? (form.origin_mode === 'quote' ? form.quote_id : null),
        client_id: form.client_id,
        client_display_code: selectedClient?.display_code ?? null,
        issue_date: form.issue_date,
        status: form.status,
        subtotal: subtotalValue,
        tax_amount: taxAmountValue,
        total: totalValue,
        notes: form.notes.trim() || null,
        internal_notes: selectedQuote?.internal_notes ?? null,
        pricing_metadata: selectedQuote?.pricing_metadata ?? null,
        client_name: selectedClient?.full_name ?? null,
        property_id: form.property_id || null,
        property_display_code: selectedProperty?.display_code ?? null,
        property_name: selectedProperty?.name ?? null,
        service_reference: selectedJob ? formatJobLabel(selectedJob) : selectedQuote ? formatQuoteLabel(selectedQuote) : null,
        service_description: selectedJob?.billing_concept ?? null,
        lines: linePayloads,
      })
      setIsDirty(false)
      await completeFullViewActionFlow({
        onRefreshData,
        onCompleted,
      })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Error desconocido creando la factura.')
    } finally {
      setIsSubmitting(false)
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
      label: 'Ruta activa',
      value: form.origin_mode === 'job' ? 'Servicio -> factura' : form.origin_mode === 'quote' ? 'Presupuesto -> factura' : 'Factura administrativa',
      hint: getOriginDescription(form.origin_mode),
    },
    {
      label: 'Cliente',
      value: selectedClient ? formatClientLabel(selectedClient) : 'Pendiente',
      hint: selectedProperty ? formatPropertyLabel(selectedProperty) : 'Sin propiedad fijada',
    },
    {
      label: 'Documento origen',
      value: selectedJob ? formatJobLabel(selectedJob) : selectedQuote ? formatQuoteLabel(selectedQuote) : 'Sin origen enlazado',
      hint: form.issue_date ? `Emision ${form.issue_date}` : 'Fecha pendiente',
    },
  ]

  const stepStates = invoiceSteps.map((_, index) => {
    const error = getStepError(index)
    if (index < currentStep) return error ? 'blocked' : 'complete'
    if (index === currentStep && error) return 'blocked'
    if (index === currentStep) return 'current'
    return 'pending'
  }) as ('complete' | 'current' | 'blocked' | 'pending')[]

  const currentStepError = getStepError(currentStep)

  const sideContent = (
    <>
      <section className="cc-create-flow__summary-card">
        <span className="cc-step-flow__eyebrow">Totales</span>
        <div className="cc-create-flow__totals">
          <div className="cc-create-flow__totals-row">
            <span>Subtotal</span>
            <strong>{formatMoneyInput(subtotalValue)} €</strong>
          </div>
          <div className="cc-create-flow__totals-row">
            <span>IVA</span>
            <strong>{formatMoneyInput(taxAmountValue)} €</strong>
          </div>
          <div className="cc-create-flow__totals-row cc-create-flow__totals-row--grand">
            <span>Total</span>
            <strong>{formatMoneyInput(totalValue)} €</strong>
          </div>
        </div>
      </section>

      <section className="cc-create-flow__summary-card">
        <span className="cc-step-flow__eyebrow">Checklist</span>
        <ul className="cc-create-flow__warning-list">
          <li>La ruta principal debe salir de un servicio cuando exista.</li>
          <li>La ficha fiscal del cliente debe quedar completa antes de emitir.</li>
          <li>Las lineas se validan antes de permitir la emision final.</li>
        </ul>
      </section>
    </>
  )

  const footerContent = (
    <>
      <div className="cc-create-flow__footer-meta">
        <strong>{invoiceSteps[currentStep].label}</strong>
        <small className="cc-create-flow__helper">
          {currentStep < invoiceSteps.length - 1
            ? 'El siguiente boton solo avanza cuando este paso queda resuelto.'
            : 'La emision final mantiene el contexto y, al cerrar, vuelves a la misma vista de facturas.'}
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
        {currentStep < invoiceSteps.length - 1 ? (
          <button type="button" className="primary-button" onClick={() => goToStep(currentStep + 1)}>
            {invoiceNextLabels[currentStep]}
          </button>
        ) : (
          <button type="button" className="primary-button" onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Emitir factura'}
          </button>
        )}
      </div>
    </>
  )

  return (
    <>
      <FullscreenStepFlow
        eyebrow="Documento de cobro"
        title="Nueva factura"
        description="La accion se resuelve en pasos claros, con contexto visible y sin perder la vista de facturas al cerrar."
        steps={invoiceSteps}
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
              <strong>Escoge la ruta correcta antes de facturar</strong>
              <small>La aplicacion hereda cliente, propiedad y base economica desde el origen cuando la ruta lo permite.</small>
            </article>

            <article className={`cc-create-flow__status-card ${currentStepError ? 'cc-create-flow__status-card--blocked' : 'cc-create-flow__status-card--ready'}`}>
              <span className="cc-create-flow__status-icon" aria-hidden="true">{currentStepError ? '!' : 'OK'}</span>
              <div className="cc-create-flow__status-copy">
                <span>{currentStepError ? 'Paso bloqueado' : 'Paso listo'}</span>
                <strong>{currentStepError ?? 'La ruta ya tiene el contexto minimo para continuar.'}</strong>
              </div>
              {!currentStepError && form.origin_mode === 'manual' ? <small>Ruta excepcional activa</small> : null}
            </article>

            <div className="cc-create-flow__choice-grid">
              {(['job', 'quote', 'manual'] as InvoiceOriginMode[]).map((originMode) => (
                <button
                  key={originMode}
                  type="button"
                  className={`cc-create-flow__choice ${form.origin_mode === originMode ? 'cc-create-flow__choice--active' : ''}`}
                  onClick={() => updateField('origin_mode', originMode)}
                  disabled={isOriginLocked && form.origin_mode !== originMode}
                >
                  <span>{originMode === 'job' ? 'Ruta principal' : originMode === 'quote' ? 'Ruta secundaria' : 'Excepcion administrativa'}</span>
                  <strong>
                    {originMode === 'job'
                      ? 'Servicio -> factura'
                      : originMode === 'quote'
                        ? 'Presupuesto aceptado -> factura'
                        : 'Factura directa'}
                  </strong>
                  <small>{getOriginDescription(originMode)}</small>
                </button>
              ))}
            </div>

            <div className="cc-create-flow__grid">
              {form.origin_mode === 'job' ? (
                <label className="form-field form-field-full">
                  <span>Servicio *</span>
                  <select value={form.job_id} onChange={(event) => updateField('job_id', event.target.value)}>
                    <option value="">Selecciona un servicio</option>
                    {availableJobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {formatJobLabel(job)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {form.origin_mode === 'quote' ? (
                <label className="form-field form-field-full">
                  <span>Presupuesto aceptado *</span>
                  <select value={form.quote_id} onChange={(event) => updateField('quote_id', event.target.value)}>
                    <option value="">Selecciona un presupuesto</option>
                    {availableQuotes.map((quote) => (
                      <option key={quote.id} value={quote.id}>
                        {formatQuoteLabel(quote)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {form.origin_mode === 'manual' ? (
                <article className="cc-create-flow__panel">
                  <strong>Factura administrativa</strong>
                  <small>Solo pide lo minimo: cliente, propiedad opcional, fecha y lineas. La ficha fiscal se revisa en el siguiente paso.</small>
                </article>
              ) : null}

              {form.origin_mode === 'job' ? (
                <ContextualCreateSection
                  actionLabel="Crear servicio en este flujo"
                  title="Servicio pendiente"
                  description="Si el servicio todavia no existe, crealo aqui y vuelve a la ruta principal sin salir del fullscreen."
                  isOpen={showJobCreate}
                  onToggle={() => setShowJobCreate((current) => !current)}
                >
                  <JobCreateFlow
                    clients={clients}
                    properties={properties}
                    quotes={quotes}
                    onRefreshData={onRefreshData}
                    onCompleted={async () => {}}
                    onDirtyChange={setIsDirty}
                    onCreatedJob={async (job) => {
                      await completeContextualActionFlow({
                        created: job,
                        applyCreated: async (createdJob) => {
                          setForm((current) => ({
                            ...current,
                            origin_mode: 'job',
                            job_id: createdJob.id,
                            client_id: createdJob.client_id,
                            property_id: createdJob.property_id,
                            quote_id: createdJob.quote_id ?? '',
                          }))
                        },
                        closeSubflow: () => setShowJobCreate(false),
                        markDirty,
                      })
                    }}
                  />
                </ContextualCreateSection>
              ) : null}

              {form.origin_mode === 'quote' ? (
                <ContextualCreateSection
                  actionLabel="Crear presupuesto en este flujo"
                  title="Presupuesto pendiente"
                  description="Crea el presupuesto aceptable dentro de la misma superficie y usalo de inmediato como origen."
                  isOpen={showQuoteCreate}
                  onToggle={() => setShowQuoteCreate((current) => !current)}
                >
                  <QuoteCreateFlow
                    clients={clients}
                    properties={properties}
                    onRefreshData={onRefreshData}
                    onCompleted={async () => {}}
                    onDirtyChange={setIsDirty}
                    contextClientId={form.client_id || null}
                    contextPropertyId={form.property_id || null}
                    onCreatedQuote={async (quote) => {
                      await completeContextualActionFlow({
                        created: quote,
                        applyCreated: async (createdQuote) => {
                          setForm((current) => ({
                            ...current,
                            origin_mode: 'quote',
                            quote_id: createdQuote.id,
                            client_id: createdQuote.client_id,
                            property_id: createdQuote.property_id ?? '',
                          }))
                        },
                        closeSubflow: () => setShowQuoteCreate(false),
                        markDirty,
                      })
                    }}
                  />
                </ContextualCreateSection>
              ) : null}
            </div>
          </section>
        ) : null}

        {currentStep === 1 ? (
          <section className="cc-create-flow__section">
            <article className="cc-create-flow__hero-card">
              <span className="cc-step-flow__eyebrow">Paso 2</span>
              <strong>Confirma facturacion y ficha fiscal</strong>
              <small>Si falta un dato obligatorio, lo resuelves aqui mismo y el flujo continua sin sacarte de la pantalla.</small>
            </article>

            <article className={`cc-create-flow__status-card ${currentStepError ? 'cc-create-flow__status-card--blocked' : 'cc-create-flow__status-card--ready'}`}>
              <span className="cc-create-flow__status-icon" aria-hidden="true">{currentStepError ? '!' : 'OK'}</span>
              <div className="cc-create-flow__status-copy">
                <span>{currentStepError ? 'Falta completar facturacion' : 'Facturacion lista'}</span>
                <strong>{currentStepError ?? 'Cliente, fecha y ficha fiscal estan listos para emitir.'}</strong>
              </div>
            </article>

            <div className="cc-create-flow__grid">
              <label className="form-field">
                <span>Cliente *</span>
                <select
                  value={form.client_id}
                  onChange={(event) => updateField('client_id', event.target.value)}
                  disabled={form.origin_mode !== 'manual'}
                >
                  {form.origin_mode === 'manual' ? <option value="">Selecciona un cliente</option> : null}
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {formatClientLabel(client)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span>Propiedad</span>
                <select
                  value={form.property_id}
                  onChange={(event) => updateField('property_id', event.target.value)}
                  disabled={form.origin_mode !== 'manual'}
                >
                  <option value="">Sin propiedad</option>
                  {availableProperties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {formatPropertyLabel(property)}
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
                <select value={form.status} onChange={(event) => updateField('status', event.target.value)}>
                  {invoiceManualStatusOptions.map((status) => (
                    <option key={status} value={status}>{getStatusOptionLabel(status)}</option>
                  ))}
                </select>
              </label>

              {form.origin_mode === 'manual' ? (
                <ContextualCreateSection
                  actionLabel="Crear cliente en este flujo"
                  title="Cliente pendiente"
                  description="Crea el cliente sin perder lineas, fecha ni contexto del documento."
                  isOpen={showClientCreate}
                  onToggle={() => setShowClientCreate((current) => !current)}
                >
                  <ClientCreateForm
                    onCreated={onRefreshData}
                    onDirtyChange={setIsDirty}
                    title="Nuevo cliente para esta factura"
                    description="Se seleccionara automaticamente al guardarlo."
                    submitLabel="Guardar cliente y usarlo"
                    onCreatedClient={async (client) => {
                      await completeContextualActionFlow({
                        created: client,
                        applyCreated: async (createdClient) => {
                          setForm((current) => ({
                            ...current,
                            client_id: createdClient.id,
                            property_id: '',
                          }))
                        },
                        closeSubflow: () => setShowClientCreate(false),
                        markDirty,
                      })
                    }}
                  />
                </ContextualCreateSection>
              ) : null}

              {form.origin_mode === 'manual' && form.client_id ? (
                <ContextualCreateSection
                  actionLabel="Crear propiedad en este flujo"
                  title="Propiedad pendiente"
                  description="Si necesitas asociar una propiedad, se crea aqui mismo y vuelve ya seleccionada."
                  isOpen={showPropertyCreate}
                  onToggle={() => setShowPropertyCreate((current) => !current)}
                >
                  <PropertyCreateFlow
                    clients={clients}
                    onRefreshData={onRefreshData}
                    onCompleted={async () => {}}
                    onDirtyChange={setIsDirty}
                    contextClientId={form.client_id}
                    title="Nueva propiedad para esta factura"
                    description="La propiedad quedara disponible de inmediato dentro del flujo."
                    submitLabel="Guardar propiedad y usarla"
                    onCreatedProperty={async (property) => {
                      await completeContextualActionFlow({
                        created: property,
                        applyCreated: async (createdProperty) => {
                          setForm((current) => ({
                            ...current,
                            property_id: createdProperty.id,
                          }))
                        },
                        closeSubflow: () => setShowPropertyCreate(false),
                        markDirty,
                      })
                    }}
                  />
                </ContextualCreateSection>
              ) : null}

              {selectedClient ? (
                <article className="cc-create-flow__panel">
                  <strong>Ficha fiscal actual</strong>
                  <div className="cc-create-flow__summary-list">
                    <div className="cc-create-flow__summary-item">
                      <span>NIF / CIF</span>
                      <strong>{renderSummaryValue(selectedClient.tax_id)}</strong>
                    </div>
                    <div className="cc-create-flow__summary-item">
                      <span>Direccion</span>
                      <strong>{renderSummaryValue(selectedClient.billing_address)}</strong>
                    </div>
                  </div>
                  {clientFiscalIssue ? (
                    <div className="cc-alert cc-alert--warning">
                      <strong>No puedes emitir todavia</strong>
                      <p>{clientFiscalIssue}</p>
                    </div>
                  ) : (
                    <p className="cc-create-flow__helper">La ficha fiscal ya permite emitir sin salir de este flujo.</p>
                  )}
                </article>
              ) : null}

              {selectedClient && clientFiscalIssue ? (
                <article className="cc-create-flow__panel">
                  <strong>Completar datos fiscales aqui mismo</strong>
                  <small>Este subflujo actualiza la ficha del cliente y te devuelve al mismo paso sin perder nada.</small>
                  <ClientBillingDetailsInlineForm
                    client={selectedClient}
                    onSaved={async (updatedClient) => {
                      await onRefreshData()
                      setForm((current) => ({ ...current, client_id: updatedClient.id }))
                    }}
                  />
                </article>
              ) : null}
            </div>
          </section>
        ) : null}

        {currentStep === 2 ? (
          <section className="cc-create-flow__section">
            <article className="cc-create-flow__hero-card">
              <span className="cc-step-flow__eyebrow">Paso 3</span>
              <strong>Valida lineas e importes antes de emitir</strong>
              <small>La lectura es corta y cada linea se corrige sin scroll infinito ni cambios desperdigados.</small>
            </article>

            <article className={`cc-create-flow__status-card ${currentStepError ? 'cc-create-flow__status-card--blocked' : 'cc-create-flow__status-card--ready'}`}>
              <span className="cc-create-flow__status-icon" aria-hidden="true">{currentStepError ? '!' : 'OK'}</span>
              <div className="cc-create-flow__status-copy">
                <span>{currentStepError ? 'Lineas pendientes' : 'Lineas listas'}</span>
                <strong>{currentStepError ?? `${lines.length} linea(s) validas preparadas para la revision final.`}</strong>
              </div>
            </article>

            <label className="form-field form-field-full">
              <span>Notas visibles</span>
              <textarea
                value={form.notes}
                onChange={(event) => updateField('notes', event.target.value)}
                rows={4}
                placeholder="Condiciones, observaciones o texto visible en la factura"
              />
            </label>

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
                    <small className="cc-create-flow__helper">
                      {Number.isNaN(calculateLineSubtotal(line)) ? 'Revisa cantidad o precio.' : 'Linea lista para emitir.'}
                    </small>
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
                  Añadir linea
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {currentStep === 3 ? (
          <section className="cc-create-flow__section">
            <article className="cc-create-flow__hero-card">
              <span className="cc-step-flow__eyebrow">Paso 4</span>
              <strong>Revision final antes de emitir</strong>
              <small>Si detectamos un faltante, el flujo te devuelve exactamente al paso que debes resolver.</small>
            </article>

            <article className="cc-create-flow__status-card cc-create-flow__status-card--ready">
              <span className="cc-create-flow__status-icon" aria-hidden="true">OK</span>
              <div className="cc-create-flow__status-copy">
                <span>Documento listo</span>
                <strong>Ya puedes emitir sin salir del fullscreen flow.</strong>
              </div>
            </article>

            <div className="cc-create-flow__review-grid">
              <article className="cc-create-flow__review-card">
                <span>Origen</span>
                <strong>{selectedJob ? formatJobLabel(selectedJob) : selectedQuote ? formatQuoteLabel(selectedQuote) : 'Factura administrativa'}</strong>
                <small>{getOriginDescription(form.origin_mode)}</small>
              </article>
              <article className="cc-create-flow__review-card">
                <span>Cliente</span>
                <strong>{selectedClient ? formatClientLabel(selectedClient) : 'Pendiente'}</strong>
                <small>{selectedProperty ? formatPropertyLabel(selectedProperty) : 'Sin propiedad asociada'}</small>
              </article>
              <article className="cc-create-flow__review-card">
                <span>Emision</span>
                <strong>{form.issue_date || 'Pendiente'}</strong>
                <small>{getStatusOptionLabel(form.status)}</small>
              </article>
              <article className="cc-create-flow__review-card">
                <span>Lineas</span>
                <strong>{lines.length} linea(s)</strong>
                <small>Total {formatMoneyInput(totalValue)} €</small>
              </article>
            </div>

            {lines.map((line, index) => (
              <article key={line.local_id} className="cc-create-flow__panel">
                <strong>Línea {index + 1}</strong>
                <small>{renderSummaryValue(line.concept)}</small>
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
                    <strong>{line.unit_price} €</strong>
                  </div>
                  <div className="cc-create-flow__summary-item">
                    <span>Importe</span>
                    <strong>{formatLineSubtotalInput(line)} €</strong>
                  </div>
                </div>
              </article>
            ))}
          </section>
        ) : null}

        {submitError ? (
          <div className="cc-alert cc-alert--error">
            <strong>No se pudo completar el flujo</strong>
            <p>{submitError}</p>
          </div>
        ) : null}

      </FullscreenStepFlow>

      <ConfirmDialog
        isOpen={showCancelConfirm}
        title="Descartar factura en curso"
        description="Si cierras ahora, perderas la factura que estas preparando y volveras al mismo contexto de facturas."
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
