import { useEffect, useMemo, useState } from 'react'
import { businessRules } from '../../app/businessRules'
import { formatClientLabel, formatPropertyLabel } from '../../app/relationshipLabels'
import { getStatusOptionLabel, quoteStatusOptions } from '../../app/statusOptions'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ContextualCreateSection } from '../../components/ContextualCreateSection'
import { FullscreenStepFlow, type FullscreenStepFlowContextItem } from '../../components/FullscreenStepFlow'
import { ClientCreateForm } from '../clients/ClientCreateForm'
import type { ClientListItem } from '../clients/types'
import { ConceptSuggestions } from '../concepts/ConceptSuggestions'
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
import { PropertyCreateFlow } from '../properties/PropertyCreateFlow'
import type { PropertyListItem } from '../properties/types'
import { completeContextualActionFlow, type FullViewActionFlowProps } from '../shared/actionFlowLifecycle'
import {
  buildQuoteLinePayloads,
  calculateQuoteSubtotal,
  createBlankQuoteLine,
  createLocalId,
  formatQuoteLineSubtotalInput,
  roundMoney,
} from './quoteLineUtils'
import type { QuoteLineFormState } from './quoteLineUtils'
import {
  getQuoteCommercialSummary,
  getQuoteCustomerFacingTotalNote,
} from './quoteCommercialPresentation'
import type { QuoteCreatePrefill } from './quoteCreatePrefill'
import type { QuoteListItem } from './types'
import './QuoteCreateFlow.css'
import '../shared/fullscreen-create-flow.css'

interface QuoteCreateFlowProps extends FullViewActionFlowProps {
  clients: ClientListItem[]
  properties: PropertyListItem[]
  quotes?: QuoteListItem[]
  invoices?: InvoiceListItem[]
  expenses?: ExpenseListItem[]
  prefill?: QuoteCreatePrefill | null
  contextClientId?: string | null
  contextPropertyId?: string | null
  onCreatedQuote?: (quote: { id: string; client_id: string; property_id: string | null }) => void | Promise<void>
  onOpenExistingQuote?: (quoteId: string) => void
  onOpenDocumentForQuote?: (quoteId: string) => void
}

interface FormState {
  client_id: string
  property_id: string
  status: string
  notes: string
}

interface QuoteCreateSuccessState {
  quoteId: string
  clientId: string
  propertyId: string | null
}

const quoteSteps = [
  { id: 'client', label: 'Cliente o lead', description: 'Fija el contexto comercial.' },
  { id: 'service', label: 'Tipo de servicio', description: 'Define el alcance base.' },
  { id: 'property', label: 'Inmueble', description: 'Vincula la propiedad si aplica.' },
  { id: 'conditions', label: 'Condiciones', description: 'Estado y notas antes de estimar.' },
  { id: 'estimate', label: 'Estimacion', description: 'Cantidades, unidades y precio sin IVA.' },
  { id: 'review', label: 'Revision final', description: 'Confirma el presupuesto antes de guardarlo.' },
  { id: 'success', label: 'Confirmacion', description: 'Presupuesto guardado y siguientes acciones.' },
] as { id: string; label: string; description: string }[]

const stepIndexById = {
  client: 0,
  service: 1,
  property: 2,
  conditions: 3,
  estimate: 4,
  review: 5,
  success: 6,
} as const

function hasAtLeastOneConcept(lines: QuoteLineFormState[]): boolean {
  return lines.some((line) => line.concept.trim().length > 0)
}

function createInitialLines(prefill: QuoteCreatePrefill | null): QuoteLineFormState[] {
  if (!prefill?.lines?.length) {
    return [createBlankQuoteLine()]
  }

  return prefill.lines.map((line) => ({
    local_id: createLocalId('QUOTE-LINE-DRAFT'),
    concept: line.concept,
    quantity: line.quantity,
    unit: line.unit,
    unit_price: line.unit_price,
  }))
}

export function QuoteCreateFlow({
  clients,
  properties,
  onRefreshData,
  onCompleted,
  contextClientId = null,
  contextPropertyId = null,
  quotes = [],
  invoices = [],
  expenses = [],
  prefill = null,
  onCreatedQuote,
  onOpenExistingQuote,
  onOpenDocumentForQuote,
  onCancel,
  onDirtyChange,
}: QuoteCreateFlowProps) {
  const [form, setForm] = useState<FormState>(() => ({
    client_id: prefill?.client_id ?? contextClientId ?? '',
    property_id: prefill?.property_id ?? contextPropertyId ?? '',
    status: 'draft',
    notes: prefill?.notes ?? '',
  }))
  const [lines, setLines] = useState<QuoteLineFormState[]>(() => createInitialLines(prefill))
  const [currentStep, setCurrentStep] = useState<number>(stepIndexById.client)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showClientCreate, setShowClientCreate] = useState(false)
  const [showPropertyCreate, setShowPropertyCreate] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [pendingDuplicateGroups, setPendingDuplicateGroups] = useState<ReturnType<typeof findQuoteDuplicateGroups>>([])
  const [lastAppliedPrefillId, setLastAppliedPrefillId] = useState<string | null>(prefill?.request_id ?? null)
  const [successState, setSuccessState] = useState<QuoteCreateSuccessState | null>(null)

  useEffect(() => {
    onDirtyChange?.(isDirty)
    return () => onDirtyChange?.(false)
  }, [isDirty, onDirtyChange])

  useEffect(() => {
    if (!prefill || prefill.request_id === lastAppliedPrefillId) return

    setForm({
      client_id: prefill.client_id || contextClientId || '',
      property_id: prefill.property_id || contextPropertyId || '',
      status: 'draft',
      notes: prefill.notes,
    })
    setLines(createInitialLines(prefill))
    setCurrentStep(stepIndexById.client)
    setSubmitError(null)
    setIsDirty(false)
    setSuccessState(null)
    setLastAppliedPrefillId(prefill.request_id)
  }, [contextClientId, contextPropertyId, lastAppliedPrefillId, prefill])

  const availableProperties = useMemo(() => {
    if (!form.client_id) return []
    return properties.filter((property) => property.client_id === form.client_id)
  }, [properties, form.client_id])

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === form.client_id) ?? null,
    [clients, form.client_id],
  )
  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === form.property_id) ?? null,
    [properties, form.property_id],
  )

  const subtotalValue = useMemo(() => calculateQuoteSubtotal(lines), [lines])
  const taxAmountValue = useMemo(() => roundMoney(subtotalValue * businessRules.defaultTaxRate), [subtotalValue])
  const totalValue = useMemo(() => roundMoney(subtotalValue + taxAmountValue), [subtotalValue, taxAmountValue])
  const commercialSummary = useMemo(
    () => getQuoteCommercialSummary({ subtotal: subtotalValue, taxAmount: taxAmountValue, total: totalValue }),
    [subtotalValue, taxAmountValue, totalValue],
  )
  const conceptMemoryIndex = useMemo(
    () => buildConceptMemoryIndex({ quotes, invoices, expenses }),
    [quotes, invoices, expenses],
  )

  function markDirty() {
    setIsDirty(true)
  }

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    markDirty()
    setForm((current) => {
      const next = { ...current, [field]: value }
      if (field === 'client_id') {
        next.property_id = contextPropertyId ?? ''
      }
      return next
    })
  }

  function updateLine<K extends keyof QuoteLineFormState>(localId: string, field: K, value: QuoteLineFormState[K]) {
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
      domain: 'quote',
      clientId: form.client_id || null,
      limit: 6,
    })
  }

  function getStepError(stepIndex: number): string | null {
    if (stepIndex === stepIndexById.client && !form.client_id) {
      return 'Debes seleccionar o crear un cliente antes de seguir.'
    }

    if (stepIndex === stepIndexById.service && !hasAtLeastOneConcept(lines)) {
      return 'Necesitas al menos un concepto principal antes de seguir.'
    }

    if (stepIndex === stepIndexById.estimate) {
      const payloads = buildQuoteLinePayloads(lines, 'DRAFT-QUOTE')
      if (!payloads || payloads.length === 0) {
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

    for (let index = 0; index <= stepIndexById.estimate; index += 1) {
      const error = getStepError(index)
      if (error) {
        setCurrentStep(index)
        setSubmitError(error)
        return
      }
    }

    setIsSubmitting(true)

    try {
      const quoteId = createLocalId('QUOTE')
      const linePayloads = buildQuoteLinePayloads(lines, quoteId)

      if (!linePayloads || linePayloads.length === 0) {
        setCurrentStep(stepIndexById.estimate)
        setSubmitError('Cada linea debe tener concepto, cantidad mayor que 0 y precio unitario valido.')
        return
      }

      if (!skipDuplicateCheck) {
        const duplicateGroups = findQuoteDuplicateGroups({
          id: quoteId,
          display_code: null,
          lead_id: null,
          lead_display_code: null,
          lead_name: null,
          client_id: form.client_id,
          client_display_code: selectedClient?.display_code ?? null,
          client_name: selectedClient?.full_name ?? null,
          property_id: form.property_id || null,
          property_display_code: selectedProperty?.display_code ?? null,
          status: form.status,
          job_id: null,
          invoice_id: null,
          subtotal: subtotalValue,
          tax_amount: taxAmountValue,
          total: totalValue,
          notes: form.notes.trim() || null,
          internal_notes: null,
          pricing_metadata: null,
          created_at: new Date().toISOString(),
          quote_lines: linePayloads,
          lines: linePayloads,
        }, quotes)

        if (duplicateGroups.length > 0) {
          setPendingDuplicateGroups(duplicateGroups)
          return
        }
      }

      await saveQuoteWithLines(
        {
          id: quoteId,
          client_id: form.client_id,
          lead_id: null,
          property_id: form.property_id || null,
          status: form.status,
          subtotal: subtotalValue,
          tax_amount: taxAmountValue,
          total: totalValue,
          notes: form.notes.trim() || null,
        },
        linePayloads,
      )

      await onCreatedQuote?.({
        id: quoteId,
        client_id: form.client_id,
        property_id: form.property_id || null,
      })
      await onRefreshData()

      setIsDirty(false)
      setSuccessState({
        quoteId,
        clientId: form.client_id,
        propertyId: form.property_id || null,
      })
      setCurrentStep(stepIndexById.success)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Error desconocido creando el presupuesto.')
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

  function resetForAnotherQuote() {
    setForm({
      client_id: contextClientId ?? '',
      property_id: contextPropertyId ?? '',
      status: 'draft',
      notes: '',
    })
    setLines([createBlankQuoteLine()])
    setCurrentStep(stepIndexById.client)
    setSubmitError(null)
    setSuccessState(null)
    setIsDirty(false)
    setShowClientCreate(false)
    setShowPropertyCreate(false)
  }

  const contextItems: FullscreenStepFlowContextItem[] = [
    {
      label: 'Cliente',
      value: selectedClient ? formatClientLabel(selectedClient) : 'Pendiente',
      hint: selectedProperty ? formatPropertyLabel(selectedProperty) : 'Sin propiedad asociada',
    },
    {
      label: 'Estado',
      value: getStatusOptionLabel(form.status),
      hint: 'Se puede ajustar antes de guardar.',
    },
    {
      label: commercialSummary.totalLabel,
      value: commercialSummary.totalValue,
      hint: commercialSummary.totalNote,
    },
  ]

  const currentStepError = successState ? null : getStepError(currentStep)
  const stepStates = quoteSteps.map((step, index) => {
    if (successState) {
      if (index < stepIndexById.success) return 'complete'
      if (index === stepIndexById.success) return 'current'
      return 'pending'
    }

    if (step.id === 'success') return 'pending'

    const error = getStepError(index)
    if (index < currentStep) return error ? 'blocked' : 'complete'
    if (index === currentStep && error) return 'blocked'
    if (index === currentStep) return 'current'
    return 'pending'
  }) as ('complete' | 'current' | 'blocked' | 'pending')[]

  const sideContent = successState ? (
    <>
      <section className="cc-create-flow__summary-card">
        <span className="cc-step-flow__eyebrow">Presupuesto guardado</span>
        <strong>{successState.quoteId}</strong>
        <small>El flujo ya dejo creado el presupuesto sin enviar emails ni mensajes automaticamente.</small>
      </section>

      <section className="cc-create-flow__summary-card">
        <span className="cc-step-flow__eyebrow">Siguientes acciones</span>
        <div className="cc-create-flow__summary-list">
          <div className="cc-create-flow__summary-item">
            <span>Documento</span>
            <strong>{onOpenDocumentForQuote ? 'Listo para abrir' : 'Disponible desde el detalle'}</strong>
          </div>
          <div className="cc-create-flow__summary-item">
            <span>Mensajes</span>
            <strong>No se envia nada automaticamente</strong>
          </div>
        </div>
      </section>
    </>
  ) : (
    <>
      <section className="cc-create-flow__summary-card">
        <span className="cc-step-flow__eyebrow">Ruta comercial</span>
        <strong>{'Cliente -> presupuesto -> servicio -> factura'}</strong>
        <small>La idea es dejar el presupuesto listo para convertirse despues en servicio sin rehacer contexto.</small>
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
        <strong>Presupuesto listo</strong>
        <small className="cc-create-flow__helper">Confirma la siguiente accion sin salir de la orquestacion segura del flujo.</small>
      </div>

      <div className="cc-create-flow__footer-actions">
        <button type="button" className="secondary-button" onClick={() => void onCompleted()}>
          Cerrar
        </button>
        <button type="button" className="secondary-button" onClick={resetForAnotherQuote}>
          Crear otro
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
        <strong>{quoteSteps[currentStep].label}</strong>
        <small className="cc-create-flow__helper">
          {currentStep < stepIndexById.review
            ? 'Cada paso resuelve una sola decision antes de avanzar.'
            : 'La revision final confirma importes, notas y contexto antes de guardar.'}
        </small>
      </div>

      <div className="cc-create-flow__footer-actions">
        {onCancel ? (
          <button type="button" className="secondary-button" onClick={requestCancel}>
            Cerrar
          </button>
        ) : null}
        <button
          type="button"
          className="secondary-button"
          onClick={() => goToStep(currentStep - 1)}
          disabled={currentStep === stepIndexById.client}
        >
          Atras
        </button>
        {currentStep < stepIndexById.review ? (
          <button type="button" className="primary-button" onClick={() => goToStep(currentStep + 1)}>
            Continuar
          </button>
        ) : (
          <button type="button" className="primary-button" onClick={() => void handleSave()} disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Crear presupuesto'}
          </button>
        )}
      </div>
    </>
  )

  const activeContextualFlow = currentStep === stepIndexById.client
    ? showClientCreate ? (
        <ContextualCreateSection
          actionLabel="Crear cliente"
          title="Debes crear el cliente antes de seguir"
          description="Completa primero el cliente y volveras al presupuesto con ese contexto ya fijado."
          isOpen
          onToggle={() => setShowClientCreate(false)}
        >
          <ClientCreateForm
            onCreated={onRefreshData}
            onDirtyChange={setIsDirty}
            title="Nuevo cliente para este presupuesto"
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
      ) : null
    : currentStep === stepIndexById.property && form.client_id && showPropertyCreate ? (
        <ContextualCreateSection
          actionLabel="Crear propiedad"
          title="Debes crear la propiedad antes de seguir"
          description="Completa ahora la propiedad y volveras al presupuesto con ella ya seleccionada."
          isOpen
          onToggle={() => setShowPropertyCreate(false)}
        >
          <PropertyCreateFlow
            clients={clients}
            onRefreshData={onRefreshData}
            onCompleted={async () => {}}
            onDirtyChange={setIsDirty}
            contextClientId={form.client_id}
            title="Nueva propiedad para este presupuesto"
            description="La propiedad se guarda y vuelve seleccionada al instante."
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
        eyebrow="Propuesta comercial"
        title="Nuevo presupuesto"
        description="Resuelve cliente, alcance, importe y revision sin mezclar decisiones."
        steps={quoteSteps}
        currentStep={currentStep}
        stepStates={stepStates}
        onStepSelect={successState ? undefined : goToStep}
        contextItems={contextItems}
        sideContent={sideContent}
        footerContent={footerContent}
      >
        {currentStep === stepIndexById.client ? (
          <section className="cc-create-flow__section">
            {activeContextualFlow ? activeContextualFlow : (
              <>
                <article className="cc-create-flow__hero-card">
                  <span className="cc-step-flow__eyebrow">Paso 1</span>
                  <strong>Fija el cliente primero</strong>
                  <small>El resto del flujo hereda este contexto.</small>
                </article>

                <article className={`cc-create-flow__status-card ${currentStepError ? 'cc-create-flow__status-card--blocked' : 'cc-create-flow__status-card--ready'}`}>
                  <span className="cc-create-flow__status-icon" aria-hidden="true">{currentStepError ? '!' : 'OK'}</span>
                  <div className="cc-create-flow__status-copy">
                    <span>{currentStepError ? 'Falta contexto base' : 'Contexto listo'}</span>
                    <strong>{currentStepError ?? 'Cliente listo para seguir.'}</strong>
                  </div>
                </article>

                <div className="cc-create-flow__grid">
                  <label className="form-field form-field-full">
                    <span>Cliente *</span>
                    <select
                      value={form.client_id}
                      onChange={(event) => updateField('client_id', event.target.value)}
                      disabled={Boolean(contextClientId)}
                    >
                      {!contextClientId ? <option value="">Selecciona un cliente</option> : null}
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {formatClientLabel(client)}
                        </option>
                      ))}
                    </select>
                  </label>

                  {!contextClientId ? (
                    <ContextualCreateSection
                      actionLabel="Crear cliente"
                      title="Cliente pendiente"
                      description="Fija o crea el cliente para seguir."
                      isOpen={showClientCreate}
                      onToggle={() => setShowClientCreate(true)}
                    >
                      <></>
                    </ContextualCreateSection>
                  ) : null}

                  {selectedClient ? (
                    <article className="cc-create-flow__panel">
                      <strong>Cliente en contexto</strong>
                      <div className="cc-create-flow__summary-list">
                        <div className="cc-create-flow__summary-item">
                          <span>Cliente</span>
                          <strong>{formatClientLabel(selectedClient)}</strong>
                        </div>
                        <div className="cc-create-flow__summary-item">
                          <span>Propiedades disponibles</span>
                          <strong>{availableProperties.length}</strong>
                        </div>
                      </div>
                    </article>
                  ) : null}
                </div>
              </>
            )}
          </section>
        ) : null}

        {currentStep === stepIndexById.service ? (
          <section className="cc-create-flow__section">
            <article className="cc-create-flow__hero-card">
              <span className="cc-step-flow__eyebrow">Paso 2</span>
              <strong>Define el alcance base</strong>
                  <small>Primero alcance. El precio viene despues.</small>
            </article>

            <article className={`cc-create-flow__status-card ${currentStepError ? 'cc-create-flow__status-card--blocked' : 'cc-create-flow__status-card--ready'}`}>
              <span className="cc-create-flow__status-icon" aria-hidden="true">{currentStepError ? '!' : 'OK'}</span>
              <div className="cc-create-flow__status-copy">
                <span>{currentStepError ? 'Servicio pendiente' : 'Servicio listo'}</span>
                    <strong>{currentStepError ?? `${lines.length} concepto(s) listos.`}</strong>
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

                  <ConceptSuggestions
                    suggestions={getSuggestionsForLine(line.concept)}
                    onUseConcept={(suggestion) => applyConceptSuggestionToLine(line.local_id, suggestion)}
                    onUseStructuredSuggestion={(suggestion) => applyStructuredSuggestionToLine(line.local_id, suggestion)}
                  />

                  <div className="cc-create-flow__line-actions">
                    <small className="cc-create-flow__helper">Aqui solo defines el alcance.</small>
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
                <strong>Acciones</strong>
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
            {activeContextualFlow ? activeContextualFlow : (
              <>
                <article className="cc-create-flow__hero-card">
                  <span className="cc-step-flow__eyebrow">Paso 3</span>
                  <strong>Relaciona el inmueble</strong>
                  <small>La propiedad no siempre es obligatoria, pero conviene fijarla ahora si ya existe.</small>
                </article>

                <article className="cc-create-flow__status-card cc-create-flow__status-card--ready">
                  <span className="cc-create-flow__status-icon" aria-hidden="true">OK</span>
                  <div className="cc-create-flow__status-copy">
                    <span>Contexto operativo</span>
                    <strong>{selectedProperty ? 'La propiedad ya queda vinculada al presupuesto.' : 'Puedes continuar sin propiedad o crearla ahora.'}</strong>
                  </div>
                </article>

                <div className="cc-create-flow__grid">
                  <label className="form-field">
                    <span>Propiedad</span>
                    <select
                      value={form.property_id}
                      onChange={(event) => updateField('property_id', event.target.value)}
                      disabled={Boolean(contextPropertyId)}
                    >
                      {!contextPropertyId ? <option value="">Sin propiedad</option> : null}
                      {availableProperties.map((property) => (
                        <option key={property.id} value={property.id}>
                          {formatPropertyLabel(property)}
                        </option>
                      ))}
                    </select>
                  </label>

                  {form.client_id && !contextPropertyId ? (
                    <ContextualCreateSection
                      actionLabel="Crear propiedad"
                      title="Propiedad pendiente"
                      description="Anadela ahora y quedara enlazada al presupuesto sin perder progreso."
                      isOpen={showPropertyCreate}
                      onToggle={() => setShowPropertyCreate(true)}
                    >
                      <></>
                    </ContextualCreateSection>
                  ) : null}
                </div>
              </>
            )}
          </section>
        ) : null}

        {currentStep === stepIndexById.conditions ? (
          <section className="cc-create-flow__section">
            <article className="cc-create-flow__hero-card">
              <span className="cc-step-flow__eyebrow">Paso 4</span>
              <strong>Define condiciones y seguimiento</strong>
              <small>El estado comercial y las notas quedan juntos para no mezclarlos con lineas ni relaciones.</small>
            </article>

            <div className="cc-create-flow__grid">
              <label className="form-field">
                <span>Estado</span>
                <select value={form.status} onChange={(event) => updateField('status', event.target.value)}>
                  {quoteStatusOptions.map((status) => (
                    <option key={status} value={status}>{getStatusOptionLabel(status)}</option>
                  ))}
                </select>
              </label>

              <article className="cc-create-flow__panel">
                <strong>{commercialSummary.totalLabel}</strong>
                <small>{getQuoteCustomerFacingTotalNote()}</small>
              </article>

              <label className="form-field form-field-full">
                <span>Notas</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => updateField('notes', event.target.value)}
                  rows={5}
                  placeholder="Condiciones, alcance, exclusiones o notas comerciales"
                />
              </label>
            </div>
          </section>
        ) : null}

        {currentStep === stepIndexById.estimate ? (
          <section className="cc-create-flow__section">
            <article className="cc-create-flow__hero-card">
              <span className="cc-step-flow__eyebrow">Paso 5</span>
              <strong>Completa la estimacion</strong>
              <small>Ahora si: cantidades, unidades y precio final del presupuesto, manteniendo la nota comercial sin IVA.</small>
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
                    <small>Si necesitas reescribir el alcance, vuelve al paso de tipo de servicio.</small>
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
              <strong>Revision final obligatoria</strong>
              <small>Confirmas contexto, condiciones y precio final antes de crear el presupuesto.</small>
            </article>

            <article className="cc-create-flow__status-card cc-create-flow__status-card--ready">
              <span className="cc-create-flow__status-icon" aria-hidden="true">OK</span>
              <div className="cc-create-flow__status-copy">
                <span>Presupuesto listo</span>
                <strong>El flujo esta preparado para guardar sin enviar documentos ni mensajes automaticamente.</strong>
              </div>
            </article>

            <div className="cc-create-flow__review-grid">
              <article className="cc-create-flow__review-card">
                <span>Cliente</span>
                <strong>{selectedClient ? formatClientLabel(selectedClient) : 'Pendiente'}</strong>
                <small>{selectedProperty ? formatPropertyLabel(selectedProperty) : 'Sin propiedad asociada'}</small>
              </article>
              <article className="cc-create-flow__review-card">
                <span>Estado</span>
                <strong>{getStatusOptionLabel(form.status)}</strong>
                <small>{form.notes.trim() ? 'Con notas comerciales' : 'Sin notas adicionales'}</small>
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
                <strong>Notas comerciales</strong>
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
              <strong>Presupuesto creado</strong>
              <small>La creacion ya termino. Ahora eliges la siguiente accion sin duplicar botones primarios.</small>
            </article>

            <article className="cc-create-flow__status-card cc-create-flow__status-card--ready">
              <span className="cc-create-flow__status-icon" aria-hidden="true">OK</span>
              <div className="cc-create-flow__status-copy">
                <span>Registro completado</span>
                <strong>Presupuesto {successState.quoteId} guardado con contexto, lineas y revision final.</strong>
              </div>
            </article>

            <div className="cc-create-flow__review-grid">
              <article className="cc-create-flow__review-card">
                <span>Cliente</span>
                <strong>{selectedClient ? formatClientLabel(selectedClient) : successState.clientId}</strong>
                <small>{selectedProperty ? formatPropertyLabel(selectedProperty) : 'Sin propiedad asociada'}</small>
              </article>
              <article className="cc-create-flow__review-card">
                <span>{commercialSummary.totalLabel}</span>
                <strong>{commercialSummary.totalValue}</strong>
                <small>{commercialSummary.totalNote}</small>
              </article>
            </div>

            <article className="cc-create-flow__panel">
              <strong>Siguientes acciones recomendadas</strong>
              <div className="cc-create-flow__summary-list">
                <div className="cc-create-flow__summary-item">
                  <span>Ver detalle</span>
                  <strong>Workspace del presupuesto</strong>
                </div>
                <div className="cc-create-flow__summary-item">
                  <span>Documento</span>
                  <strong>{onOpenDocumentForQuote ? 'Listo para abrir' : 'Disponible desde el detalle'}</strong>
                </div>
                <div className="cc-create-flow__summary-item">
                  <span>Mensajes</span>
                  <strong>No se envia nada automaticamente</strong>
                </div>
                <div className="cc-create-flow__summary-item">
                  <span>Facturacion</span>
                  <strong>Se decide despues, nunca automaticamente</strong>
                </div>
              </div>
            </article>
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
        title="Posible presupuesto duplicado"
        description="Hemos encontrado coincidencias por cliente, propiedad o importe reciente. Revisa antes de guardar un presupuesto nuevo."
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
          void handleSave(true)
        }}
      />

      <ConfirmDialog
        isOpen={showCancelConfirm}
        title="Descartar presupuesto en curso"
        description="Si cierras ahora, perderas el progreso no guardado del presupuesto."
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
