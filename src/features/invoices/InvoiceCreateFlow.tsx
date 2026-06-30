import { useEffect, useMemo, useState } from 'react'
import { businessRules } from '../../app/businessRules'
import { getServiceTypeLabel } from '../../app/displayFormat'
import { formatClientLabel, formatJobLabel, formatPropertyLabel, formatQuoteLabel } from '../../app/relationshipLabels'
import { getStatusOptionLabel, invoiceManualStatusOptions } from '../../app/statusOptions'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ContextualCreateSection } from '../../components/ContextualCreateSection'
import { FullscreenStepFlow, type FullscreenStepFlowContextItem } from '../../components/FullscreenStepFlow'
import { ClientBillingDetailsInlineForm } from '../clients/ClientBillingDetailsInlineForm'
import {
  buildInvoicePricingMetadataWithClientFiscalSnapshot,
  getClientFiscalData,
  getClientFiscalIssueMessage,
} from '../clients/clientFiscalData'
import { ClientCreateForm } from '../clients/ClientCreateForm'
import type { ClientListItem } from '../clients/types'
import { ConceptSuggestions } from '../concepts/ConceptSuggestions'
import {
  buildConceptMemoryIndex,
  getConceptSuggestions,
  type ConceptSuggestion,
} from '../concepts/conceptMemory'
import { findInvoiceDuplicateGroups } from '../duplicates/duplicateEngine'
import { DuplicateReviewOverlay } from '../duplicates/DuplicateReviewOverlay'
import type { ExpenseListItem } from '../expenses/types'
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
import {
  buildBillingLinePayloads,
  calculateBillingLineSubtotal,
  calculateBillingSubtotal,
  createBlankBillingLine,
  createLocalId,
  formatBillingLineSubtotalInput,
  formatMoneyInput,
  formatQuantityInput,
  roundMoney,
  type BillingLineFormState,
} from '../shared/billingLineDrafts'
import type { InvoiceCreatePrefill } from './invoiceCreatePrefill'
import type { InvoiceListItem } from './types'
import './InvoiceCreateFlow.css'
import '../shared/fullscreen-create-flow.css'

interface InvoiceCreateFlowProps extends FullViewActionFlowProps {
  clients: ClientListItem[]
  properties: PropertyListItem[]
  jobs: JobListItem[]
  quotes: QuoteListItem[]
  invoices?: InvoiceListItem[]
  expenses?: ExpenseListItem[]
  prefill?: InvoiceCreatePrefill | null
  onCreatedInvoice?: (invoice: InvoiceListItem) => void | Promise<void>
  onOpenExistingInvoice?: (invoiceId: string) => void
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

type LineFormState = BillingLineFormState

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

function getJobBillingLines(job: JobListItem | null): LineFormState[] | null {
  if (!job) return null

  if (job.billing_lines?.length) {
    const normalized = job.billing_lines
      .filter((line) => Number.isFinite(line.quantity) && line.quantity > 0 && Number.isFinite(line.unit_price) && line.unit_price >= 0)
      .map((line) => ({
        local_id: createLocalId('LINE-DRAFT'),
        concept: normalizeLineConcept(line.concept, simplifyLineConcept(getServiceTypeLabel(job.service_type))),
        quantity: formatQuantityInput(line.quantity),
        unit: line.unit?.trim() || 'servicio',
        unit_price: formatMoneyInput(line.unit_price),
      }))

    if (normalized.length > 0) return normalized
  }

  const singleLine = getJobBillingLine(job)
  return singleLine ? [singleLine] : null
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
    return [createBlankBillingLine()]
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

function buildLinePayloads(lines: LineFormState[], invoiceId: string): LinePayload[] | null {
  const payloads = buildBillingLinePayloads(lines, (concept) => normalizeLineConcept(concept))
  if (!payloads) return null
  return payloads.map((line) => ({
    ...line,
    id: createLocalId('INVOICE-LINE'),
    invoice_id: invoiceId,
  }))
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

function renderSummaryValue(value: string | null | undefined, fallback = 'Pendiente') {
  return value && value.trim() ? value : fallback
}

export function InvoiceCreateFlow({
  clients,
  properties,
  jobs,
  quotes,
  invoices = [],
  expenses = [],
  onRefreshData,
  onCompleted,
  prefill = null,
  onCreatedInvoice,
  onOpenExistingInvoice,
  onCancel,
  onDirtyChange,
}: InvoiceCreateFlowProps) {
  const [form, setForm] = useState<FormState>(() => (prefill ? applyPrefillToForm(prefill) : createDefaultFormState()))
  const [lines, setLines] = useState<LineFormState[]>(() => (prefill ? buildLinesFromPrefill(prefill) : [createBlankBillingLine()]))
  const [contextualJob, setContextualJob] = useState<JobListItem | null>(null)
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
  const [pendingDuplicateGroups, setPendingDuplicateGroups] = useState<ReturnType<typeof findInvoiceDuplicateGroups>>([])

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
  const selectedJob = useMemo(() => {
    if (contextualJob?.id === form.job_id) return contextualJob
    return jobs.find((job) => job.id === form.job_id) ?? null
  }, [contextualJob, jobs, form.job_id])
  const selectedQuote = useMemo(() => {
    if (form.origin_mode === 'job') {
      if (!selectedJob?.quote_id) return null
      return quotes.find((quote) => quote.id === selectedJob.quote_id) ?? null
    }

    if (!form.quote_id) return null
    return quotes.find((quote) => quote.id === form.quote_id) ?? null
  }, [form.origin_mode, form.quote_id, quotes, selectedJob])

  const subtotalValue = useMemo(() => calculateBillingSubtotal(lines), [lines])
  const conceptMemoryIndex = useMemo(
    () => buildConceptMemoryIndex({ quotes, invoices, expenses }),
    [quotes, invoices, expenses],
  )
  const taxAmountValue = useMemo(
    () => roundMoney(subtotalValue * businessRules.defaultTaxRate),
    [subtotalValue],
  )
  const totalValue = useMemo(
    () => roundMoney(subtotalValue + taxAmountValue),
    [subtotalValue, taxAmountValue],
  )
  const isOriginLocked = Boolean(prefill?.job_id || prefill?.quote_id)
  const clientFiscalData = useMemo(() => getClientFiscalData(selectedClient), [selectedClient])
  const clientFiscalIssue = getClientFiscalIssueMessage(selectedClient)
  const pricingMetadataWithFiscalSnapshot = useMemo(
    () => buildInvoicePricingMetadataWithClientFiscalSnapshot(selectedQuote?.pricing_metadata ?? null, selectedClient),
    [selectedClient, selectedQuote],
  )

  useEffect(() => {
    if (currentStep !== 1 || clientFiscalIssue) return

    setSubmitError((current) => {
      if (!current) return null
      return current.includes('NIF/CIF') || current.includes('direccion de facturacion')
        ? null
        : current
    })
  }, [clientFiscalIssue, currentStep])

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

    setLines(getJobBillingLines(selectedJob) ?? [getQuoteBillingLine(selectedQuote) ?? createBlankBillingLine()])
  }, [form.origin_mode, selectedJob, selectedQuote])

  useEffect(() => {
    if (!selectedQuote || form.origin_mode !== 'quote') return

    setForm((current) => ({
      ...current,
      client_id: selectedQuote.client_id ?? current.client_id,
      property_id: selectedQuote.property_id ?? current.property_id,
      notes: current.notes.trim() ? current.notes : buildVisibleInvoiceNotes(),
    }))

    setLines([getQuoteBillingLine(selectedQuote) ?? createBlankBillingLine()])
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
    if ((field === 'origin_mode' && value !== 'job') || (field === 'job_id' && contextualJob?.id !== value)) {
      setContextualJob(null)
    }
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
    setLines((current) => [...current, createBlankBillingLine()])
  }

  function applyConceptSuggestionToLine(localId: string, suggestion: ConceptSuggestion) {
    updateLine(localId, 'concept', suggestion.label)
  }

  function applyStructuredSuggestionToLine(localId: string, suggestion: ConceptSuggestion) {
    if (!suggestion.structuredSuggestion) {
      applyConceptSuggestionToLine(localId, suggestion)
      return
    }

    markDirty()
    setLines((current) => current.map((line) => (
      line.local_id === localId
        ? {
          ...line,
          concept: suggestion.structuredSuggestion?.concept ?? suggestion.label,
          quantity: suggestion.structuredSuggestion?.quantity ?? line.quantity,
          unit: suggestion.structuredSuggestion?.unit ?? line.unit,
          unit_price: suggestion.structuredSuggestion?.unit_price ?? line.unit_price,
        }
        : line
    )))
  }

  function getSuggestionsForLine(query: string) {
    return getConceptSuggestions(conceptMemoryIndex, {
      query,
      domain: 'invoice',
      clientId: form.client_id || null,
      limit: 6,
    })
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

  async function handleSave(skipDuplicateCheck = false) {
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

      if (!skipDuplicateCheck) {
        const duplicateGroups = findInvoiceDuplicateGroups({
          id: invoiceId,
          display_code: null,
          invoice_number: null,
          job_id: form.origin_mode === 'job' ? form.job_id : null,
          job_display_code: selectedJob?.display_code ?? null,
          quote_id: selectedQuote?.id ?? (form.origin_mode === 'quote' ? form.quote_id : null),
          quote_display_code: selectedQuote?.display_code ?? null,
          client_id: form.client_id,
          client_display_code: selectedClient?.display_code ?? null,
          client_label: selectedClient?.full_name ?? null,
          issue_date: form.issue_date,
          status: form.status,
          subtotal: subtotalValue,
          tax_amount: taxAmountValue,
          total: totalValue,
          notes: form.notes.trim() || null,
          internal_notes: selectedQuote?.internal_notes ?? null,
          pricing_metadata: pricingMetadataWithFiscalSnapshot,
          payment_status: 'pending',
          paid_amount: 0,
          outstanding_amount: totalValue,
          payment_count: 0,
          last_payment_date: null,
          last_payment_method: null,
          last_payment_origin_type: null,
          client_name: selectedClient?.full_name ?? null,
          client_phone: selectedClient?.phone ?? null,
          client_email: selectedClient?.email ?? null,
          property_id: form.property_id || null,
          property_display_code: selectedProperty?.display_code ?? null,
          property_name: selectedProperty?.name ?? null,
          property_address_line: selectedProperty?.address ?? null,
          service_reference: selectedJob ? formatJobLabel(selectedJob) : selectedQuote ? formatQuoteLabel(selectedQuote) : null,
          service_description: selectedJob?.billing_concept ?? null,
          billing_concept: linePayloads[0]?.concept ?? null,
          billing_quantity: linePayloads[0]?.quantity ?? null,
          billing_unit: linePayloads[0]?.unit ?? null,
          billing_unit_price: linePayloads[0]?.unit_price ?? null,
          invoice_lines: linePayloads,
          lines: linePayloads,
        }, invoices)

        if (duplicateGroups.length > 0) {
          setPendingDuplicateGroups(duplicateGroups)
          return
        }
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
          pricing_metadata: pricingMetadataWithFiscalSnapshot,
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
        pricing_metadata: pricingMetadataWithFiscalSnapshot,
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
          <button type="button" className="primary-button" onClick={() => void handleSave()} disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Emitir factura'}
          </button>
        )}
      </div>
    </>
  )

  const activeContextualFlow = currentStep === 0
    ? form.origin_mode === 'job' && showJobCreate ? (
        <ContextualCreateSection
          actionLabel="Crear servicio"
          title="Debes crear el servicio antes de seguir"
          description="Completa el servicio como accion principal y volveras a la factura con la ruta ya resuelta."
          isOpen
          onToggle={() => setShowJobCreate(false)}
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
                  setContextualJob(createdJob)
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
      ) : form.origin_mode === 'quote' && showQuoteCreate ? (
        <ContextualCreateSection
          actionLabel="Crear presupuesto"
          title="Debes crear el presupuesto antes de seguir"
          description="Completa primero el presupuesto y volveras a la factura con ese origen ya vinculado."
          isOpen
          onToggle={() => setShowQuoteCreate(false)}
        >
          <QuoteCreateFlow
            clients={clients}
            properties={properties}
            quotes={quotes}
            invoices={invoices}
            expenses={expenses}
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
      ) : null
    : currentStep === 1 && form.origin_mode === 'manual' && showClientCreate ? (
        <ContextualCreateSection
          actionLabel="Crear cliente"
          title="Debes crear el cliente antes de seguir"
          description="Completa primero el cliente y volveras a la factura con su ficha ya fijada."
          isOpen
          onToggle={() => setShowClientCreate(false)}
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
      ) : currentStep === 1 && form.origin_mode === 'manual' && form.client_id && showPropertyCreate ? (
        <ContextualCreateSection
          actionLabel="Crear propiedad"
          title="Debes crear la propiedad antes de seguir"
          description="Completa ahora la propiedad y volveras a la factura con ella ya seleccionada."
          isOpen
          onToggle={() => setShowPropertyCreate(false)}
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
      ) : null

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
            {activeContextualFlow ? activeContextualFlow : (
              <>
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
                  actionLabel="Crear servicio"
                  title="Servicio pendiente"
                  description="Si falta el servicio base, crealo primero y despues vuelve a la factura con esa ruta ya resuelta."
                  isOpen={showJobCreate}
                  onToggle={() => setShowJobCreate(true)}
                >
                  <></>
                </ContextualCreateSection>
              ) : null}

              {form.origin_mode === 'quote' ? (
                <ContextualCreateSection
                  actionLabel="Crear presupuesto"
                  title="Presupuesto pendiente"
                  description="Si falta el presupuesto aceptado, crealo primero y despues retoma la factura con ese origen ya vinculado."
                  isOpen={showQuoteCreate}
                  onToggle={() => setShowQuoteCreate(true)}
                >
                  <></>
                </ContextualCreateSection>
              ) : null}
            </div>
              </>
            )}
          </section>
        ) : null}

        {currentStep === 1 ? (
          <section className="cc-create-flow__section">
            {activeContextualFlow ? activeContextualFlow : (
              <>
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
                  actionLabel="Crear cliente"
                  title="Cliente pendiente"
                  description="Para seguir con esta factura necesitas fijar antes un cliente o crearlo ahora."
                  isOpen={showClientCreate}
                  onToggle={() => setShowClientCreate(true)}
                >
                  <></>
                </ContextualCreateSection>
              ) : null}

              {form.origin_mode === 'manual' && form.client_id ? (
                <ContextualCreateSection
                  actionLabel="Crear propiedad"
                  title="Propiedad pendiente"
                  description="Si necesitas asociar una propiedad, creala primero y despues retoma esta factura con ella ya resuelta."
                  isOpen={showPropertyCreate}
                  onToggle={() => setShowPropertyCreate(true)}
                >
                  <></>
                </ContextualCreateSection>
              ) : null}

              {selectedClient ? (
                <article className="cc-create-flow__panel">
                  <strong>Ficha fiscal actual</strong>
                  <div className="cc-create-flow__summary-list">
                    <div className="cc-create-flow__summary-item">
                      <span>NIF / CIF</span>
                      <strong>{renderSummaryValue(clientFiscalData.taxId)}</strong>
                    </div>
                    <div className="cc-create-flow__summary-item">
                      <span>Direccion</span>
                      <strong>{renderSummaryValue(clientFiscalData.billingAddress)}</strong>
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
                      setSubmitError(null)
                      setForm((current) => ({ ...current, client_id: updatedClient.id }))
                    }}
                  />
                </article>
              ) : null}
            </div>
              </>
            )}
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
                  <ConceptSuggestions
                    suggestions={getSuggestionsForLine(line.concept)}
                    onUseConcept={(suggestion) => applyConceptSuggestionToLine(line.local_id, suggestion)}
                    onUseStructuredSuggestion={(suggestion) => applyStructuredSuggestionToLine(line.local_id, suggestion)}
                  />

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
                    <input value={formatBillingLineSubtotalInput(line)} readOnly />
                  </label>

                  <div className="cc-create-flow__line-actions">
                    <small className="cc-create-flow__helper">
                      {Number.isNaN(calculateBillingLineSubtotal(line)) ? 'Revisa cantidad o precio.' : 'Linea lista para emitir.'}
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
                    <strong>{formatBillingLineSubtotalInput(line)} €</strong>
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

      <DuplicateReviewOverlay
        isOpen={pendingDuplicateGroups.length > 0}
        title="Posible factura duplicada"
        description="Hemos encontrado coincidencias por origen, cliente, fecha o importe. Revisa antes de emitir una factura nueva."
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
