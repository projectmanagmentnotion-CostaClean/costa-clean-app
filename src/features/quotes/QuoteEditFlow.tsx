import { useEffect, useMemo, useState } from 'react'
import { formatClientLabel, formatPropertyLabel } from '../../app/relationshipLabels'
import { getStatusOptionLabel, quoteStatusOptions } from '../../app/statusOptions'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { FullscreenStepFlow, type FullscreenStepFlowContextItem } from '../../components/FullscreenStepFlow'
import { DSConceptAutocomplete } from '../../design-system/components'
import {
  buildConceptMemoryIndex,
  getConceptSuggestions,
  type ConceptSuggestion,
} from '../concepts/conceptMemory'
import { findQuoteDuplicateGroups } from '../duplicates/duplicateEngine'
import { DuplicateReviewOverlay } from '../duplicates/DuplicateReviewOverlay'
import type { ExpenseListItem } from '../expenses/types'
import { saveQuoteWithLines } from '../financial/financialWriteApi'
import type { InvoiceListItem } from '../invoices/types'
import { type FullViewActionFlowProps } from '../shared/actionFlowLifecycle'
import {
  buildQuoteLinePayloads,
  calculateQuoteSubtotal,
  calculateQuoteTax,
  calculateQuoteTotal,
  createBlankQuoteLine,
  formatQuoteLineSubtotalInput,
  getFormLinesFromQuote,
} from './quoteLineUtils'
import type { QuoteLineFormState } from './quoteLineUtils'
import {
  getQuoteCommercialSummary,
  getQuoteCustomerFacingTotalNote,
} from './quoteCommercialPresentation'
import type { QuoteListItem } from './types'
import type { ClientListItem } from '../clients/types'
import type { PropertyListItem } from '../properties/types'
import '../shared/fullscreen-create-flow.css'

interface QuoteEditFlowProps extends FullViewActionFlowProps {
  quote: QuoteListItem
  clients: ClientListItem[]
  properties: PropertyListItem[]
  title?: string
  description?: string
  submitLabel?: string
  allQuotes?: QuoteListItem[]
  invoices?: InvoiceListItem[]
  expenses?: ExpenseListItem[]
  onOpenExistingQuote?: (quoteId: string) => void
  onOpenDocumentForQuote?: (quoteId: string) => void
}

interface EditFormState {
  client_id: string | null
  property_id: string
  status: string
  notes: string
}

interface QuoteEditSuccessState {
  quoteId: string
}

const quoteEditSteps = [
  { id: 'context', label: 'Cliente o lead', description: 'Confirma el contexto.' },
  { id: 'service', label: 'Tipo de servicio', description: 'Ajusta el alcance base.' },
  { id: 'property', label: 'Inmueble', description: 'Revisa la propiedad si aplica.' },
  { id: 'conditions', label: 'Condiciones', description: 'Estado y notas antes de recalcular.' },
  { id: 'estimate', label: 'Estimacion', description: 'Cantidades, unidades y precio sin IVA.' },
  { id: 'review', label: 'Revision final', description: 'Confirma la lectura final antes de guardar.' },
  { id: 'success', label: 'Confirmacion', description: 'Presupuesto actualizado y siguientes acciones.' },
] as { id: string; label: string; description: string }[]

const stepIndexById = {
  context: 0,
  service: 1,
  property: 2,
  conditions: 3,
  estimate: 4,
  review: 5,
  success: 6,
} as const

function buildClientSummaryLabel(quote: QuoteListItem, clients: ClientListItem[]): string {
  const client = clients.find((item) => item.id === quote.client_id)
  return client?.full_name?.trim()
    || quote.client_display_code
    || quote.lead_name
    || quote.lead_display_code
    || quote.client_id
    || 'Lead sin cliente'
}

function buildPropertySummaryLabel(quote: QuoteListItem, properties: PropertyListItem[]): string {
  if (!quote.property_id) return 'Sin propiedad'

  const property = properties.find((item) => item.id === quote.property_id)
  return property?.name?.trim() || quote.property_display_code || quote.property_id
}

function hasAtLeastOneConcept(lines: QuoteLineFormState[]): boolean {
  return lines.some((line) => line.concept.trim().length > 0)
}

export function QuoteEditFlow({
  quote,
  clients,
  properties,
  onRefreshData,
  onCompleted,
  onCancel,
  onDirtyChange,
  title = 'Editar presupuesto',
  description = 'Edita el presupuesto sin convertir el detalle en un formulario largo.',
  submitLabel = 'Guardar cambios',
  allQuotes = [],
  invoices = [],
  expenses = [],
  onOpenExistingQuote,
  onOpenDocumentForQuote,
}: QuoteEditFlowProps) {
  const [form, setForm] = useState<EditFormState>({
    client_id: quote.client_id ?? null,
    property_id: quote.property_id ?? '',
    status: quote.status,
    notes: quote.notes ?? '',
  })
  const [lines, setLines] = useState<QuoteLineFormState[]>(getFormLinesFromQuote(quote, properties))
  const [currentStep, setCurrentStep] = useState<number>(stepIndexById.context)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showRejectedConfirm, setShowRejectedConfirm] = useState(false)
  const [pendingDuplicateGroups, setPendingDuplicateGroups] = useState<ReturnType<typeof findQuoteDuplicateGroups>>([])
  const [successState, setSuccessState] = useState<QuoteEditSuccessState | null>(null)

  useEffect(() => {
    setForm({
      client_id: quote.client_id ?? null,
      property_id: quote.property_id ?? '',
      status: quote.status,
      notes: quote.notes ?? '',
    })
    setLines(getFormLinesFromQuote(quote, properties))
    setCurrentStep(stepIndexById.context)
    setError(null)
    setIsDirty(false)
    setSuccessState(null)
  }, [properties, quote])

  useEffect(() => {
    onDirtyChange?.(isDirty)
    return () => onDirtyChange?.(false)
  }, [isDirty, onDirtyChange])

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === form.client_id) ?? null,
    [clients, form.client_id],
  )
  const availableProperties = useMemo(() => {
    if (!form.client_id) return []
    return properties.filter((property) => property.client_id === form.client_id)
  }, [form.client_id, properties])
  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === form.property_id) ?? null,
    [form.property_id, properties],
  )
  const subtotalValue = useMemo(() => calculateQuoteSubtotal(lines), [lines])
  const taxAmountValue = useMemo(() => calculateQuoteTax(lines), [lines])
  const totalValue = useMemo(() => calculateQuoteTotal(lines), [lines])
  const commercialSummary = useMemo(
    () => getQuoteCommercialSummary({ subtotal: subtotalValue, taxAmount: taxAmountValue, total: totalValue }),
    [subtotalValue, taxAmountValue, totalValue],
  )
  const conceptMemoryIndex = useMemo(
    () => buildConceptMemoryIndex({ quotes: allQuotes, invoices, expenses }),
    [allQuotes, invoices, expenses],
  )

  function updateField<K extends keyof EditFormState>(field: K, value: EditFormState[K]) {
    setIsDirty(true)
    setForm((current) => {
      const next = { ...current, [field]: value }
      if (field === 'client_id') {
        next.property_id = ''
      }
      return next
    })
  }

  function updateLine<K extends keyof QuoteLineFormState>(localId: string, field: K, value: QuoteLineFormState[K]) {
    setIsDirty(true)
    setLines((current) => current.map((line) => (
      line.local_id === localId ? { ...line, [field]: value } : line
    )))
  }

  function removeLine(localId: string) {
    setIsDirty(true)
    setLines((current) => (current.length > 1 ? current.filter((line) => line.local_id !== localId) : current))
  }

  function addLine() {
    setIsDirty(true)
    setLines((current) => [...current, createBlankQuoteLine()])
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
      domain: 'quote',
      clientId: form.client_id || null,
      limit: 6,
    })
  }

  function getStepError(stepIndex: number): string | null {
    if (stepIndex === stepIndexById.context && !form.client_id && !quote.lead_id) {
      return 'El presupuesto necesita cliente o lead vinculado.'
    }

    if (stepIndex === stepIndexById.service && !hasAtLeastOneConcept(lines)) {
      return 'Necesitas al menos un concepto principal antes de seguir.'
    }

    if (stepIndex === stepIndexById.estimate) {
      const linePayloads = buildQuoteLinePayloads(lines, quote.id)
      if (!linePayloads || linePayloads.length === 0) {
        return 'Necesitas al menos una linea valida con concepto, cantidad y precio.'
      }
    }

    return null
  }

  function goToStep(nextStep: number) {
    const maxStep = successState ? stepIndexById.success : stepIndexById.review
    const boundedStep = Math.max(0, Math.min(maxStep, nextStep))

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

  async function persistQuote(confirmedRejected = false, skipDuplicateCheck = false) {
    if (form.status === 'rejected' && quote.status !== 'rejected' && !confirmedRejected) {
      setShowRejectedConfirm(true)
      return
    }

    setError(null)
    setIsSaving(true)

    try {
      const linePayloads = buildQuoteLinePayloads(lines, quote.id)

      if (!linePayloads || linePayloads.length === 0) {
        setCurrentStep(stepIndexById.estimate)
        setError('Cada linea debe tener concepto, cantidad mayor que 0 y precio unitario valido.')
        return
      }

      if (!skipDuplicateCheck) {
        const duplicateGroups = findQuoteDuplicateGroups({
          ...quote,
          client_id: form.client_id,
          property_id: form.property_id || null,
          status: form.status,
          subtotal: subtotalValue,
          tax_amount: taxAmountValue,
          total: totalValue,
          notes: form.notes.trim() || null,
          quote_lines: linePayloads,
          lines: linePayloads,
        }, allQuotes)

        if (duplicateGroups.length > 0) {
          setPendingDuplicateGroups(duplicateGroups)
          return
        }
      }

      await saveQuoteWithLines(
        {
          id: quote.id,
          client_id: form.client_id,
          lead_id: quote.lead_id ?? null,
          property_id: form.property_id || null,
          status: form.status,
          subtotal: subtotalValue,
          tax_amount: taxAmountValue,
          total: totalValue,
          notes: form.notes.trim() || null,
          internal_notes: quote.internal_notes ?? null,
          pricing_metadata: quote.pricing_metadata ?? null,
        },
        linePayloads,
      )

      await onRefreshData()
      setIsDirty(false)
      setSuccessState({ quoteId: quote.id })
      setCurrentStep(stepIndexById.success)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido actualizando el presupuesto.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSave() {
    for (let index = 0; index <= stepIndexById.estimate; index += 1) {
      const stepError = getStepError(index)
      if (stepError) {
        setCurrentStep(index)
        setError(stepError)
        return
      }
    }

    await persistQuote()
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
      label: 'Presupuesto',
      value: quote.display_code ?? quote.id,
      hint: buildClientSummaryLabel(quote, clients),
    },
    {
      label: 'Estado',
      value: getStatusOptionLabel(form.status),
      hint: selectedProperty ? formatPropertyLabel(selectedProperty) : buildPropertySummaryLabel(quote, properties),
    },
    {
      label: commercialSummary.totalLabel,
      value: commercialSummary.totalValue,
      hint: commercialSummary.totalNote,
    },
  ]

  const currentStepError = successState ? null : getStepError(currentStep)
  const stepStates = quoteEditSteps.map((step, index) => {
    if (successState) {
      if (index < stepIndexById.success) return 'complete'
      if (index === stepIndexById.success) return 'current'
      return 'pending'
    }

    if (step.id === 'success') return 'pending'

    const stepError = getStepError(index)
    if (index < currentStep) return stepError ? 'blocked' : 'complete'
    if (index === currentStep && stepError) return 'blocked'
    if (index === currentStep) return 'current'
    return 'pending'
  }) as ('complete' | 'current' | 'blocked' | 'pending')[]

  const sideContent = successState ? (
    <>
      <section className="cc-create-flow__summary-card">
        <span className="cc-step-flow__eyebrow">Cambios guardados</span>
        <strong>{quote.display_code ?? successState.quoteId}</strong>
        <small>El presupuesto se actualizo sin enviar correos, WhatsApps ni documentos automaticamente.</small>
      </section>

      <section className="cc-create-flow__summary-card">
        <span className="cc-step-flow__eyebrow">Siguiente paso</span>
        <div className="cc-create-flow__summary-list">
          <div className="cc-create-flow__summary-item">
            <span>Documento</span>
            <strong>{onOpenDocumentForQuote ? 'Listo para abrir' : 'Disponible desde el detalle'}</strong>
          </div>
          <div className="cc-create-flow__summary-item">
            <span>Conversion</span>
            <strong>Disponible desde el workspace</strong>
          </div>
        </div>
      </section>
    </>
  ) : (
    <>
      <section className="cc-create-flow__summary-card">
        <span className="cc-step-flow__eyebrow">Lectura rapida</span>
        <strong>{selectedClient ? formatClientLabel(selectedClient) : buildClientSummaryLabel(quote, clients)}</strong>
        <small>{selectedProperty ? formatPropertyLabel(selectedProperty) : buildPropertySummaryLabel(quote, properties)}</small>
      </section>

      <section className="cc-create-flow__summary-card">
        <span className="cc-step-flow__eyebrow">Lectura economica</span>
        <div className="cc-create-flow__totals">
          <div className="cc-create-flow__totals-row">
            <span>{commercialSummary.subtotalLabel}</span>
            <strong>{commercialSummary.subtotalValue}</strong>
          </div>
          <div className="cc-create-flow__totals-row">
            <span>{commercialSummary.taxLabel}</span>
            <strong>{commercialSummary.taxValue}</strong>
          </div>
          <div className="cc-create-flow__totals-row cc-create-flow__totals-row--grand">
            <span>{commercialSummary.totalLabel}</span>
            <strong>{commercialSummary.totalValue}</strong>
          </div>
        </div>
        <small>{commercialSummary.totalNote}</small>
      </section>
    </>
  )

  const footerContent = successState ? (
    <>
      <div className="cc-create-flow__footer-meta">
        <strong>Presupuesto actualizado</strong>
        <small className="cc-create-flow__helper">Elige la siguiente accion sin mezclar guardado con conversion ni documentacion.</small>
      </div>

      <div className="cc-create-flow__footer-actions">
        <button type="button" className="secondary-button" onClick={() => void onCompleted()}>
          Cerrar
        </button>
        {onOpenDocumentForQuote ? (
          <button
            type="button"
            className="secondary-button"
            onClick={() => onOpenDocumentForQuote(successState.quoteId)}
          >
            Abrir documento
          </button>
        ) : null}
        {onOpenExistingQuote ? (
          <button
            type="button"
            className="primary-button"
            onClick={() => onOpenExistingQuote(successState.quoteId)}
          >
            Ver presupuesto
          </button>
        ) : null}
      </div>
    </>
  ) : (
    <>
      <div className="cc-create-flow__footer-meta">
        <strong>{quoteEditSteps[currentStep].label}</strong>
        <small className="cc-create-flow__helper">
          {currentStep < stepIndexById.review
            ? 'Edicion por bloques.'
            : 'Revisa antes de guardar.'}
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
          disabled={currentStep === stepIndexById.context}
        >
          Atras
        </button>
        {currentStep < stepIndexById.review ? (
          <button type="button" className="primary-button" onClick={() => goToStep(currentStep + 1)}>
            Continuar
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
        eyebrow="Presupuesto"
        title={title}
        description={description}
        steps={quoteEditSteps}
        currentStep={currentStep}
        stepStates={stepStates}
        onStepSelect={successState ? undefined : goToStep}
        contextItems={contextItems}
        sideContent={sideContent}
        footerContent={footerContent}
      >
        {currentStep === stepIndexById.context ? (
          <section className="cc-create-flow__section">
            <article className="cc-create-flow__hero-card">
              <span className="cc-step-flow__eyebrow">Paso 1</span>
              <strong>Contexto comercial y propiedad</strong>
              <small>Confirma identidad antes del resto.</small>
            </article>

            <article className={`cc-create-flow__status-card ${currentStepError ? 'cc-create-flow__status-card--blocked' : 'cc-create-flow__status-card--ready'}`}>
              <span className="cc-create-flow__status-icon" aria-hidden="true">{currentStepError ? '!' : 'OK'}</span>
              <div className="cc-create-flow__status-copy">
                <span>{currentStepError ? 'Contexto pendiente' : 'Contexto listo'}</span>
                <strong>{currentStepError ?? 'Contexto listo.'}</strong>
              </div>
            </article>

            <div className="cc-create-flow__grid">
              <label className="form-field">
                <span>Cliente</span>
                <select
                  value={form.client_id ?? ''}
                  onChange={(event) => updateField('client_id', event.target.value || null)}
                >
                  {quote.lead_id ? <option value="">Lead sin cliente hasta aceptacion</option> : null}
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {formatClientLabel(client)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
        ) : null}

        {currentStep === stepIndexById.service ? (
          <section className="cc-create-flow__section">
            <article className="cc-create-flow__hero-card">
              <span className="cc-step-flow__eyebrow">Paso 2</span>
              <strong>Ajusta el alcance base</strong>
              <small>Primero alcance. El precio va aparte.</small>
            </article>

            <article className={`cc-create-flow__status-card ${currentStepError ? 'cc-create-flow__status-card--blocked' : 'cc-create-flow__status-card--ready'}`}>
              <span className="cc-create-flow__status-icon" aria-hidden="true">{currentStepError ? '!' : 'OK'}</span>
              <div className="cc-create-flow__status-copy">
                <span>{currentStepError ? 'Servicio pendiente' : 'Servicio listo'}</span>
                <strong>{currentStepError ?? `${lines.length} concepto(s) preparados para la estimacion.`}</strong>
              </div>
            </article>

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
                  <div className="cc-create-flow__line-actions">
                    <small className="cc-create-flow__helper">Aqui solo ajustas el alcance.</small>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => removeLine(line.local_id)}
                      disabled={lines.length === 1}
                    >
                      Quitar concepto
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <div className="cc-create-flow__microactions">
              <strong>Microacciones</strong>
              <div className="cc-create-flow__microactions-row">
                <button type="button" className="secondary-button" onClick={addLine}>
                  Anadir concepto
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {currentStep === stepIndexById.property ? (
          <section className="cc-create-flow__section">
            <article className="cc-create-flow__hero-card">
              <span className="cc-step-flow__eyebrow">Paso 3</span>
              <strong>Confirma el inmueble</strong>
              <small>La propiedad queda separada del resto para no mezclar ubicacion con seguimiento comercial.</small>
            </article>

            <div className="cc-create-flow__grid">
              <label className="form-field">
                <span>Propiedad</span>
                <select
                  value={form.property_id}
                  onChange={(event) => updateField('property_id', event.target.value)}
                >
                  <option value="">Sin propiedad</option>
                  {availableProperties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {formatPropertyLabel(property)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
        ) : null}

        {currentStep === stepIndexById.conditions ? (
          <section className="cc-create-flow__section">
            <article className="cc-create-flow__hero-card">
              <span className="cc-step-flow__eyebrow">Paso 4</span>
              <strong>Condiciones y seguimiento</strong>
              <small>Estado y alcance se editan juntos, separados de lineas y conversiones.</small>
            </article>

            <div className="cc-create-flow__grid">
              <label className="form-field">
                <span>Estado</span>
                <select
                  value={form.status}
                  onChange={(event) => updateField('status', event.target.value)}
                >
                  {quoteStatusOptions.map((status) => (
                    <option key={status} value={status}>{getStatusOptionLabel(status)}</option>
                  ))}
                </select>
              </label>

              <article className="cc-create-flow__panel">
                <strong>{commercialSummary.totalLabel}</strong>
                <small>{getQuoteCustomerFacingTotalNote(taxAmountValue)}</small>
              </article>

              <label className="form-field form-field-full">
                <span>Alcance presupuesto</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => updateField('notes', event.target.value)}
                  rows={5}
                  placeholder="Servicio de camareros, condiciones o exclusiones"
                />
              </label>
            </div>
          </section>
        ) : null}

        {currentStep === stepIndexById.estimate ? (
          <section className="cc-create-flow__section">
            <article className="cc-create-flow__hero-card">
              <span className="cc-step-flow__eyebrow">Paso 5</span>
              <strong>Recalcula la estimacion</strong>
              <small>Ahora si completas cantidades, unidades y precio final sin IVA del presupuesto.</small>
            </article>

            <article className={`cc-create-flow__status-card ${currentStepError ? 'cc-create-flow__status-card--blocked' : 'cc-create-flow__status-card--ready'}`}>
              <span className="cc-create-flow__status-icon" aria-hidden="true">{currentStepError ? '!' : 'OK'}</span>
              <div className="cc-create-flow__status-copy">
                <span>{currentStepError ? 'Estimacion pendiente' : 'Estimacion lista'}</span>
                <strong>{currentStepError ?? `${lines.length} linea(s) preparadas para revision final.`}</strong>
              </div>
            </article>

            <div className="cc-create-flow__line-list">
              {lines.map((line, index) => (
                <article key={line.local_id} className="cc-create-flow__line-card">
                  <article className="cc-create-flow__panel form-field-full">
                    <span className="cc-create-flow__summary-label">Concepto {index + 1}</span>
                    <strong>{line.concept || 'Concepto pendiente'}</strong>
                    <small>Si necesitas reescribir el alcance, vuelve al paso anterior.</small>
                  </article>

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
                    <input value={formatQuoteLineSubtotalInput(line)} readOnly />
                  </label>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {currentStep === stepIndexById.review ? (
          <section className="cc-create-flow__section">
            <article className="cc-create-flow__hero-card">
              <span className="cc-step-flow__eyebrow">Paso 6</span>
              <strong>Revision final antes de guardar</strong>
              <small>Se confirma el documento sin mezclar todavia conversion, documento ni facturacion.</small>
            </article>

            <article className="cc-create-flow__status-card cc-create-flow__status-card--ready">
              <span className="cc-create-flow__status-icon" aria-hidden="true">OK</span>
              <div className="cc-create-flow__status-copy">
                <span>Documento listo</span>
                <strong>Ya puedes guardar la edicion manteniendo contexto, lineas y seguimiento comercial.</strong>
              </div>
            </article>

            <div className="cc-create-flow__review-grid">
              <article className="cc-create-flow__review-card">
                <span>Cliente</span>
                <strong>{selectedClient ? formatClientLabel(selectedClient) : buildClientSummaryLabel(quote, clients)}</strong>
                <small>{selectedProperty ? formatPropertyLabel(selectedProperty) : buildPropertySummaryLabel(quote, properties)}</small>
              </article>
              <article className="cc-create-flow__review-card">
                <span>Estado</span>
                <strong>{getStatusOptionLabel(form.status)}</strong>
                <small>{form.notes.trim() ? 'Con alcance comercial' : 'Sin alcance adicional'}</small>
              </article>
              <article className="cc-create-flow__review-card">
                <span>{commercialSummary.totalLabel}</span>
                <strong>{commercialSummary.totalValue}</strong>
                <small>{commercialSummary.totalNote}</small>
              </article>
              <article className="cc-create-flow__review-card">
                <span>{commercialSummary.taxLabel}</span>
                <strong>{commercialSummary.taxValue}</strong>
                <small>{commercialSummary.taxNote}</small>
              </article>
            </div>

            {form.notes.trim() ? (
              <article className="cc-create-flow__panel">
                <strong>Alcance comercial</strong>
                <small>{form.notes.trim()}</small>
              </article>
            ) : null}

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
                    <span>Precio unitario</span>
                    <strong>{line.unit_price} EUR</strong>
                  </div>
                  <div className="cc-create-flow__summary-item">
                    <span>Importe</span>
                    <strong>{formatQuoteLineSubtotalInput(line)} EUR</strong>
                  </div>
                </div>
              </article>
            ))}
          </section>
        ) : null}

        {currentStep === stepIndexById.success && successState ? (
          <section className="cc-create-flow__section">
            <article className="cc-create-flow__hero-card">
              <span className="cc-step-flow__eyebrow">Paso 7</span>
              <strong>Presupuesto actualizado</strong>
              <small>La edicion ya termino. Ahora decides la siguiente accion relevante.</small>
            </article>

            <article className="cc-create-flow__status-card cc-create-flow__status-card--ready">
              <span className="cc-create-flow__status-icon" aria-hidden="true">OK</span>
              <div className="cc-create-flow__status-copy">
                <span>Cambios guardados</span>
                <strong>{quote.display_code ?? successState.quoteId} actualizado con revision final completada.</strong>
              </div>
            </article>

            <div className="cc-create-flow__review-grid">
              <article className="cc-create-flow__review-card">
                <span>{commercialSummary.totalLabel}</span>
                <strong>{commercialSummary.totalValue}</strong>
                <small>{commercialSummary.totalNote}</small>
              </article>
              <article className="cc-create-flow__review-card">
                <span>Documento</span>
                <strong>{onOpenDocumentForQuote ? 'Listo para abrir' : 'Disponible desde el detalle'}</strong>
                <small>No se genera ni envia automaticamente.</small>
              </article>
            </div>

            <article className="cc-create-flow__panel">
              <strong>Siguientes acciones recomendadas</strong>
              <div className="cc-create-flow__summary-list">
                <div className="cc-create-flow__summary-item">
                  <span>Ver presupuesto</span>
                  <strong>Workspace y acciones del detalle</strong>
                </div>
                <div className="cc-create-flow__summary-item">
                  <span>Documento</span>
                  <strong>PDF o impresion manual desde la vista documental</strong>
                </div>
                <div className="cc-create-flow__summary-item">
                  <span>Facturacion</span>
                  <strong>Solo desde acciones explicitas del workspace</strong>
                </div>
              </div>
            </article>
          </section>
        ) : null}

        {error ? (
          <div className="cc-alert cc-alert--error">
            <strong>No se pudo actualizar el presupuesto</strong>
            <p>{error}</p>
          </div>
        ) : null}
      </FullscreenStepFlow>

      <DuplicateReviewOverlay
        isOpen={pendingDuplicateGroups.length > 0}
        title="Posible presupuesto duplicado"
        description="La edicion actual se parece mucho a otro presupuesto ya existente. Revisa la coincidencia antes de guardar."
        groups={pendingDuplicateGroups}
        onClose={() => setPendingDuplicateGroups([])}
        onOpenRecord={(quoteId) => {
          setPendingDuplicateGroups([])
          onOpenExistingQuote?.(quoteId)
        }}
        onUseRecord={(quoteId) => {
          setPendingDuplicateGroups([])
          onOpenExistingQuote?.(quoteId)
        }}
        onContinueAnyway={() => {
          setPendingDuplicateGroups([])
          void persistQuote(false, true)
        }}
      />

      <ConfirmDialog
        isOpen={showCancelConfirm}
        title="Descartar cambios del presupuesto"
        description="Has empezado a editar este presupuesto. Si cierras ahora, perderas los cambios no guardados."
        confirmLabel="Descartar cambios"
        tone="warning"
        onCancel={() => setShowCancelConfirm(false)}
        onConfirm={() => {
          setShowCancelConfirm(false)
          onCancel?.()
        }}
      />

      <ConfirmDialog
        isOpen={showRejectedConfirm}
        title="Guardar presupuesto como rechazado"
        description="Vas a guardar la edicion dejando el presupuesto en estado rechazado. Confirma solo si ya no debe seguir tratandose como oportunidad activa."
        confirmLabel="Guardar como rechazado"
        tone="warning"
        isBusy={isSaving}
        onCancel={() => setShowRejectedConfirm(false)}
        onConfirm={() => {
          setShowRejectedConfirm(false)
          void persistQuote(true)
        }}
      />
    </>
  )
}
