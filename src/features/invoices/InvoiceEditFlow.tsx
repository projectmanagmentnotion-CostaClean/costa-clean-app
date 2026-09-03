import { useEffect, useMemo, useRef, useState } from 'react'
import { businessRules } from '../../app/businessRules'
import { formatCurrency, formatDateEs } from '../../app/displayFormat'
import { formatClientLabel, formatJobLabel, formatQuoteLabel } from '../../app/relationshipLabels'
import { getStatusOptionLabel, invoiceManualStatusOptions } from '../../app/statusOptions'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { FullscreenStepFlow, type FullscreenStepFlowContextItem } from '../../components/FullscreenStepFlow'
import { DSConceptAutocomplete } from '../../design-system/components'
import { buildInvoicePricingMetadataWithClientFiscalSnapshot, getClientFiscalIssueMessage } from '../clients/clientFiscalData'
import type { ClientListItem } from '../clients/types'
import {
  buildConceptMemoryIndex,
  getConceptSuggestions,
  type ConceptSuggestion,
} from '../concepts/conceptMemory'
import { findInvoiceDuplicateGroups } from '../duplicates/duplicateEngine'
import { DuplicateReviewOverlay } from '../duplicates/DuplicateReviewOverlay'
import type { ExpenseListItem } from '../expenses/types'
import type { PaymentListItem } from '../payments/types'
import {
  InvoiceNumberingMismatchError,
  saveInvoiceWithLines,
} from '../financial/financialWriteApi'
import { getJobBillingDraftLines } from '../jobs/jobBilling'
import type { JobListItem } from '../jobs/types'
import type { QuoteListItem } from '../quotes/types'
import { normalizeLineConcept, simplifyLineConcept } from '../quotes/lineConcepts'
import { completeFullViewActionFlow, type FullViewActionFlowProps } from '../shared/actionFlowLifecycle'
import {
  buildBillingLinePayloads,
  calculateBillingSubtotal,
  createBlankBillingLine,
  createLocalId,
  formatBillingLineSubtotalInput,
  formatMoneyInput,
  formatQuantityInput,
  roundMoney,
  type BillingLineFormState,
} from '../shared/billingLineDrafts'
import { getBillingDraftLinesFromQuote } from '../shared/quoteBillingDrafts'
import {
  buildInvoicePaymentMeta,
  buildInvoicePaymentSummary,
  getInvoiceFinancialStatusLabel,
} from './paymentState'
import { buildCorrectedInvoiceLines, getInvoiceCorrectionCase } from './invoiceCorrectionCases'
import type { InvoiceLineItem, InvoiceListItem } from './types'
import { buildInvoiceNumber, buildInvoiceNumberingAudit, describeInvoiceNumberingGap, getInvoiceIssueYear } from './invoiceNumbering'
import { withInvoiceWriteTrace } from './invoiceWriteTrace'
import '../shared/fullscreen-create-flow.css'

interface InvoiceEditFlowProps extends FullViewActionFlowProps {
  invoice: InvoiceListItem
  clients: ClientListItem[]
  jobs: JobListItem[]
  quotes: QuoteListItem[]
  title?: string
  description?: string
  submitLabel?: string
  allInvoices?: InvoiceListItem[]
  expenses?: ExpenseListItem[]
  payments?: PaymentListItem[]
  onOpenExistingInvoice?: (invoiceId: string) => void
}

interface EditFormState {
  job_id: string
  client_id: string
  issue_date: string
  status: string
  notes: string
}

type LineFormState = BillingLineFormState

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
  { id: 'context', label: 'Contexto y emision', description: 'Servicio, fecha, estado y notas.' },
  { id: 'lines', label: 'Lineas e importes', description: 'Edita conceptos e importes en un bloque aislado.' },
  { id: 'review', label: 'Revision final', description: 'Valida lectura financiera y referencias antes de guardar.' },
]

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

function buildLinePayloads(lines: LineFormState[], invoiceId: string): LinePayload[] | null {
  const payloads = buildBillingLinePayloads(lines, (concept) => normalizeLineConcept(concept))
  if (!payloads) return null
  return payloads.map((line) => ({
    ...line,
    id: createLocalId('INVOICE-LINE'),
    invoice_id: invoiceId,
  }))
}

function buildVisibleInvoiceNotes(): string {
  return [
    'Servicio realizado segun presupuesto aprobado.',
    'Condiciones economicas aplicadas segun presupuesto aceptado.',
    'Precios sin IVA.',
  ].join('\n')
}

function correctionPrefillLineToFormLine(
  line: ReturnType<typeof buildCorrectedInvoiceLines>[number],
): LineFormState {
  return {
    local_id: createLocalId('LINE-DRAFT'),
    concept: normalizeLineConcept(line.concept),
    quantity: line.quantity,
    unit: line.unit || 'servicio',
    unit_price: line.unit_price,
  }
}

export function InvoiceEditFlow({
  invoice,
  clients,
  jobs,
  quotes,
  onRefreshData,
  onCompleted,
  onCancel,
  onDirtyChange,
  title = 'Editar factura',
  description = 'Edita la factura sin mezclar lectura, cobro y formulario largo.',
  submitLabel = 'Guardar cambios',
  allInvoices = [],
  expenses = [],
  payments = [],
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
  const isDirtyRef = useRef(false)
  const [pendingDuplicateGroups, setPendingDuplicateGroups] = useState<ReturnType<typeof findInvoiceDuplicateGroups>>([])
  const [internalCorrectionConfirmed, setInternalCorrectionConfirmed] = useState(false)

  useEffect(() => {
    isDirtyRef.current = isDirty
  }, [isDirty])

  useEffect(() => {
    if (isDirtyRef.current) return
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
    setInternalCorrectionConfirmed(false)
  }, [invoice])

  useEffect(() => {
    onDirtyChange?.(isDirty)
    return () => onDirtyChange?.(false)
  }, [isDirty, onDirtyChange])

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === form.job_id) ?? null,
    [form.job_id, jobs],
  )
  const selectedClient = useMemo(
    () => clients.find((client) => client.id === form.client_id) ?? null,
    [clients, form.client_id],
  )
  const linkedQuote = useMemo(() => {
    if (!selectedJob?.quote_id) return null
    return quotes.find((quote) => quote.id === selectedJob.quote_id) ?? null
  }, [quotes, selectedJob])
  const subtotalValue = useMemo(() => calculateBillingSubtotal(lines), [lines])
  const conceptMemoryIndex = useMemo(
    () => buildConceptMemoryIndex({ quotes, invoices: allInvoices, expenses }),
    [quotes, allInvoices, expenses],
  )
  const taxAmountValue = useMemo(
    () => roundMoney(subtotalValue * businessRules.defaultTaxRate),
    [subtotalValue],
  )
  const totalValue = useMemo(
    () => roundMoney(subtotalValue + taxAmountValue),
    [subtotalValue, taxAmountValue],
  )
  const paymentSummary = useMemo(
    () => buildInvoicePaymentSummary(invoice, payments.filter((payment) => payment.invoice_id === invoice.id)),
    [invoice, payments],
  )
  const correctionCase = useMemo(
    () => getInvoiceCorrectionCase(invoice),
    [invoice],
  )
  const isIssuedInvoice = invoice.status === 'issued'
  const currentIssueYear = getInvoiceIssueYear(form.issue_date) ?? new Date().getFullYear()
  const numberingAudit = useMemo(
    () => buildInvoiceNumberingAudit(allInvoices, currentIssueYear),
    [allInvoices, currentIssueYear],
  )
  const numberingGapMessage = describeInvoiceNumberingGap(numberingAudit)
  const clientFiscalIssue = getClientFiscalIssueMessage(selectedClient)
  const isSameNumberInternalCorrection = isIssuedInvoice && internalCorrectionConfirmed
  const resolvedSaveStatus = isSameNumberInternalCorrection ? invoice.status : form.status
  const requiresNewEmissionValidation = resolvedSaveStatus !== 'draft' && !isSameNumberInternalCorrection
  const pricingMetadataWithFiscalSnapshot = useMemo(
    () => buildInvoicePricingMetadataWithClientFiscalSnapshot(invoice.pricing_metadata ?? linkedQuote?.pricing_metadata ?? null, selectedClient),
    [invoice.pricing_metadata, linkedQuote, selectedClient],
  )
  const pricingMetadataForSave = useMemo(
    () => withInvoiceWriteTrace(pricingMetadataWithFiscalSnapshot, {
      sourceFlow: isSameNumberInternalCorrection ? 'invoice_edit_flow_internal_correction' : 'invoice_edit_flow',
      writeApiVersion: 'save_invoice_with_lines_v2',
      expectedInvoiceNumber: requiresNewEmissionValidation ? numberingAudit.nextSuggestedInvoiceNumber : null,
      expectedDisplayCode: requiresNewEmissionValidation ? numberingAudit.nextSuggestedDisplayCode : null,
    }),
    [isSameNumberInternalCorrection, numberingAudit, pricingMetadataWithFiscalSnapshot, requiresNewEmissionValidation],
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

    setIsDirty(true)
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

  function syncFromJobQuote() {
    if (!selectedJob) return

    setIsDirty(true)
    setForm((current) => ({
      ...current,
      client_id: selectedJob.client_id,
      notes: current.notes.trim() ? current.notes : linkedQuote ? buildVisibleInvoiceNotes() : '',
    }))
    const jobLines = getJobBillingDraftLines(selectedJob)
    const quoteLines = getBillingDraftLinesFromQuote(linkedQuote)
    setLines(jobLines.length > 0 ? jobLines : quoteLines.length > 0 ? quoteLines : [createBlankBillingLine()])
  }

  function applyKnownCorrection() {
    if (!correctionCase) return
    setIsDirty(true)
    setError(null)
    setLines(
      buildCorrectedInvoiceLines(invoice, correctionCase).map(correctionPrefillLineToFormLine),
    )
  }

  function getStepError(stepIndex: number): string | null {
    if (stepIndex === 0 && !form.issue_date) {
      return 'Debes indicar la fecha de emision.'
    }

    if (stepIndex === 0 && isIssuedInvoice && !internalCorrectionConfirmed) {
      return 'Confirma la correccion interna antes de guardar una factura emitida con el mismo numero.'
    }

    if (stepIndex === 0 && requiresNewEmissionValidation && numberingAudit.hasBlockingGaps) {
      return `No se puede emitir factura. Hay huecos en la numeracion fiscal: ${numberingAudit.gaps.map((gap) => (
        gap.from === gap.to
          ? buildInvoiceNumber(numberingAudit.year, gap.from)
          : `${buildInvoiceNumber(numberingAudit.year, gap.from)} a ${buildInvoiceNumber(numberingAudit.year, gap.to)}`
      )).join(' | ')}. Regulariza la secuencia antes de emitir.`
    }

    if (stepIndex === 0 && requiresNewEmissionValidation && clientFiscalIssue) {
      return clientFiscalIssue
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
          status: resolvedSaveStatus,
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
          status: resolvedSaveStatus,
          subtotal: subtotalValue,
          tax_amount: taxAmountValue,
          total: totalValue,
          notes: form.notes.trim() || null,
          internal_notes: invoice.internal_notes ?? linkedQuote?.internal_notes ?? null,
          pricing_metadata: pricingMetadataForSave,
        },
        linePayloads,
      )

      setIsDirty(false)
      await completeFullViewActionFlow({ onRefreshData, onCompleted })
    } catch (err) {
      if (err instanceof InvoiceNumberingMismatchError) {
        await onRefreshData?.()
      }
      setError(
        err instanceof InvoiceNumberingMismatchError
          ? `${err.message} La factura persistida quedo como ${err.details.persistedDisplayCode ?? err.details.invoiceId}. Regularizala antes de seguir editando.`
          : err instanceof Error
            ? err.message
            : 'Error desconocido actualizando la factura.',
      )
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
      {isIssuedInvoice ? (
        <section className="cc-create-flow__summary-card">
          <span className="cc-step-flow__eyebrow">Guardia fiscal</span>
          <strong>Factura emitida</strong>
          <small>Usa esta edicion solo si tu proceso fiscal permite corregir emitidas. Si requiere rectificativa, no guardes cambios directos.</small>
        </section>
      ) : null}

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

      {resolvedSaveStatus !== 'draft' && numberingGapMessage ? (
        <section className="cc-create-flow__summary-card">
          <span className="cc-step-flow__eyebrow">Numeracion</span>
          <strong>{isSameNumberInternalCorrection ? (invoice.invoice_number ?? invoice.display_code ?? invoice.id) : numberingAudit.nextSuggestedInvoiceNumber}</strong>
          <small>{isSameNumberInternalCorrection ? 'Correccion interna: se conserva el numero actual y no se reemite la factura.' : numberingGapMessage}</small>
        </section>
      ) : null}

      {clientFiscalIssue ? (
        <section className="cc-create-flow__summary-card">
          <span className="cc-step-flow__eyebrow">Control fiscal</span>
          <strong>{form.status === 'draft' ? 'Borrador permitido' : 'Emision bloqueada'}</strong>
          <small>
            {form.status === 'draft'
              ? 'Puedes guardar el borrador, pero no emitirlo hasta completar NIF/CIF y direccion fiscal.'
              : clientFiscalIssue}
          </small>
        </section>
      ) : null}
    </>
  )

  const footerContent = (
    <>
      <div className="cc-create-flow__footer-meta">
        <strong>{invoiceEditSteps[currentStep].label}</strong>
        <small className="cc-create-flow__helper">
          {currentStep < invoiceEditSteps.length - 1
            ? 'Edicion separada del bloque de cobro.'
            : 'Al guardar vuelves al detalle.'}
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
            {isSaving ? 'Guardando...' : isSameNumberInternalCorrection ? 'Guardar correccion interna' : submitLabel}
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
              <small>Servicio, fecha, estado y notas en un solo bloque.</small>
            </article>

            {invoice.status === 'issued' ? (
              <div className="cc-alert cc-alert--warning">
                <strong>Factura emitida en revision</strong>
                <p>Si la regularizacion correcta exige rectificativa, no confirmes esta edicion directa. Usa este flujo solo si tu operativa fiscal la permite.</p>
              </div>
            ) : null}

            {isIssuedInvoice ? (
              <div className="form-field form-field-full">
                <span>Confirmacion operativa</span>
                <div className="cc-create-flow__panel">
                  <label className="cc-create-flow__checkbox">
                    <input
                      type="checkbox"
                      checked={internalCorrectionConfirmed}
                      onChange={(event) => {
                        setInternalCorrectionConfirmed(event.target.checked)
                        setIsDirty(true)
                        setError(null)
                      }}
                    />
                    <span>Confirmo que esta factura no ha sido enviada y puede corregirse internamente manteniendo el numero.</span>
                  </label>
                  <small className="cc-create-flow__helper">
                    Con esta confirmacion el guardado actualiza la factura existente y conserva {invoice.invoice_number ?? invoice.display_code ?? invoice.id}.
                  </small>
                </div>
              </div>
            ) : null}

            <article className={`cc-create-flow__status-card ${currentStepError ? 'cc-create-flow__status-card--blocked' : 'cc-create-flow__status-card--ready'}`}>
              <span className="cc-create-flow__status-icon" aria-hidden="true">{currentStepError ? '!' : 'OK'}</span>
              <div className="cc-create-flow__status-copy">
                <span>{currentStepError ? 'Contexto pendiente' : 'Contexto listo'}</span>
                <strong>{currentStepError ?? 'Contexto listo para revisar lineas.'}</strong>
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
                  disabled={isIssuedInvoice}
                >
                  {invoiceManualStatusOptions.map((status) => (
                    <option key={status} value={status}>{getStatusOptionLabel(status)}</option>
                  ))}
                </select>
                {isIssuedInvoice ? (
                  <small className="cc-create-flow__helper">
                    La correccion interna conserva el estado emitido y no abre una nueva emision.
                  </small>
                ) : null}
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
                <strong>Acciones</strong>
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
              <small>Corrige conceptos e importes sin mezclar cobro ni relaciones.</small>
            </article>

            <article className={`cc-create-flow__status-card ${currentStepError ? 'cc-create-flow__status-card--blocked' : 'cc-create-flow__status-card--ready'}`}>
              <span className="cc-create-flow__status-icon" aria-hidden="true">{currentStepError ? '!' : 'OK'}</span>
              <div className="cc-create-flow__status-copy">
                <span>{currentStepError ? 'Lineas pendientes' : 'Lineas listas'}</span>
                <strong>{currentStepError ?? `${lines.length} linea(s) validas preparadas para la revision final.`}</strong>
              </div>
            </article>

            {correctionCase ? (
              <article className="cc-create-flow__panel">
                <strong>Correccion guiada detectada</strong>
                <small>
                  {correctionCase.targetConcept}: {correctionCase.currentQuantity} hora(s) a {correctionCase.correctedQuantity} hora(s).
                  Base esperada {formatMoneyInput(correctionCase.expectedSubtotal)} EUR, IVA {formatMoneyInput(correctionCase.expectedTaxAmount)} EUR, total {formatMoneyInput(correctionCase.expectedTotal)} EUR.
                </small>
                <div className="cc-create-flow__microactions-row">
                  <button type="button" className="secondary-button" onClick={applyKnownCorrection}>
                    Aplicar correccion conocida
                  </button>
                </div>
              </article>
            ) : null}

            <div className="cc-create-flow__line-list">
              {lines.map((line, index) => (
                <article key={line.local_id} className="cc-create-flow__line-card">
                  <DSConceptAutocomplete
                    label={`Concepto ${index + 1}`}
                    value={line.concept}
                    onChange={(value) => updateLine(line.local_id, 'concept', value)}
                    suggestions={getSuggestionsForLine(line.concept)}
                    onUseConcept={(suggestion) => applyConceptSuggestionToLine(line.local_id, suggestion)}
                    onUseStructuredSuggestion={(suggestion) => applyStructuredSuggestionToLine(line.local_id, suggestion)}
                    hint="Sugerencias compactas segun historial y contexto."
                    required
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
                <strong>Acciones</strong>
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
                <small>{getStatusOptionLabel(resolvedSaveStatus)}</small>
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
                    <strong>{formatBillingLineSubtotalInput(line)} EUR</strong>
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
