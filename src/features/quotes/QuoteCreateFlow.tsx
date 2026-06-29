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
import {
  completeContextualActionFlow,
  completeFullViewActionFlow,
  type FullViewActionFlowProps,
} from '../shared/actionFlowLifecycle'
import {
  buildQuoteLinePayloads,
  calculateQuoteSubtotal,
  createBlankQuoteLine,
  createLocalId,
  formatMoneyInput,
  formatQuoteLineSubtotalInput,
  roundMoney,
} from './quoteLineUtils'
import type { QuoteLineFormState } from './quoteLineUtils'
import type { QuoteListItem } from './types'
import './QuoteCreateFlow.css'
import '../shared/fullscreen-create-flow.css'

interface QuoteCreateFlowProps extends FullViewActionFlowProps {
  clients: ClientListItem[]
  properties: PropertyListItem[]
  quotes?: QuoteListItem[]
  invoices?: InvoiceListItem[]
  expenses?: ExpenseListItem[]
  contextClientId?: string | null
  contextPropertyId?: string | null
  onCreatedQuote?: (quote: { id: string; client_id: string; property_id: string | null }) => void | Promise<void>
  onOpenExistingQuote?: (quoteId: string) => void
}

interface FormState {
  client_id: string
  property_id: string
  status: string
  notes: string
}

const quoteSteps = [
  { id: 'client', label: 'Cliente y contexto', description: 'Fija el cliente y hereda la propiedad si ya existe.' },
  { id: 'commercial', label: 'Datos comerciales', description: 'Estado, propiedad y notas clave del presupuesto.' },
  { id: 'lines', label: 'Lineas e importes', description: 'Compone el alcance comercial con importes claros.' },
  { id: 'review', label: 'Revision final', description: 'Confirma el presupuesto antes de guardarlo.' },
]

const quoteNextLabels = [
  'Definir datos comerciales',
  'Preparar lineas',
  'Ir a revision final',
]

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
  onCreatedQuote,
  onOpenExistingQuote,
  onCancel,
  onDirtyChange,
}: QuoteCreateFlowProps) {
  const [form, setForm] = useState<FormState>({
    client_id: contextClientId ?? '',
    property_id: contextPropertyId ?? '',
    status: 'draft',
    notes: '',
  })
  const [lines, setLines] = useState<QuoteLineFormState[]>([createBlankQuoteLine()])
  const [currentStep, setCurrentStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showClientCreate, setShowClientCreate] = useState(false)
  const [showPropertyCreate, setShowPropertyCreate] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [pendingDuplicateGroups, setPendingDuplicateGroups] = useState<ReturnType<typeof findQuoteDuplicateGroups>>([])

  useEffect(() => {
    onDirtyChange?.(isDirty)
    return () => onDirtyChange?.(false)
  }, [isDirty, onDirtyChange])

  const availableProperties = useMemo(() => {
    if (!form.client_id) {
      return []
    }

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
    setLines((current) => (
      current.length > 1 ? current.filter((line) => line.local_id !== localId) : current
    ))
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
    if (stepIndex === 0 && !form.client_id) {
      return 'Debes seleccionar o crear un cliente antes de seguir.'
    }

    if (stepIndex === 2) {
      const payloads = buildQuoteLinePayloads(lines, 'DRAFT-QUOTE')
      if (!payloads || payloads.length === 0) {
        return 'Necesitas al menos una linea valida con concepto, cantidad y precio.'
      }
    }

    return null
  }

  function goToStep(nextStep: number) {
    const boundedStep = Math.max(0, Math.min(quoteSteps.length - 1, nextStep))

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

    for (let index = 0; index < quoteSteps.length - 1; index += 1) {
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
        setCurrentStep(2)
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
      setIsDirty(false)
      await completeFullViewActionFlow({
        onRefreshData,
        onCompleted,
      })
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

  const contextItems: FullscreenStepFlowContextItem[] = [
    {
      label: 'Cliente',
      value: selectedClient ? formatClientLabel(selectedClient) : 'Pendiente',
      hint: selectedProperty ? formatPropertyLabel(selectedProperty) : 'Sin propiedad asociada',
    },
    {
      label: 'Estado inicial',
      value: getStatusOptionLabel(form.status),
      hint: 'Se puede ajustar antes de guardarlo.',
    },
    {
      label: 'Totales',
      value: `${formatMoneyInput(totalValue)} €`,
      hint: `${lines.length} linea(s) preparadas`,
    },
  ]

  const currentStepError = getStepError(currentStep)
  const stepStates = quoteSteps.map((_, index) => {
    const error = getStepError(index)
    if (index < currentStep) return error ? 'blocked' : 'complete'
    if (index === currentStep && error) return 'blocked'
    if (index === currentStep) return 'current'
    return 'pending'
  }) as ('complete' | 'current' | 'blocked' | 'pending')[]

  const sideContent = (
    <>
      <section className="cc-create-flow__summary-card">
        <span className="cc-step-flow__eyebrow">Ruta comercial</span>
        <strong>{'Cliente -> presupuesto -> servicio -> factura'}</strong>
        <small>La idea es dejar el presupuesto listo para convertirse despues en servicio sin rehacer contexto.</small>
      </section>

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
    </>
  )

  const footerContent = (
    <>
      <div className="cc-create-flow__footer-meta">
        <strong>{quoteSteps[currentStep].label}</strong>
        <small className="cc-create-flow__helper">
          {currentStep < quoteSteps.length - 1
            ? 'El flujo avanza solo cuando lo esencial del paso ya esta resuelto.'
            : 'Al guardar, vuelves al mismo contexto de presupuestos sin romper la vista base.'}
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
        {currentStep < quoteSteps.length - 1 ? (
          <button type="button" className="primary-button" onClick={() => goToStep(currentStep + 1)}>
            {quoteNextLabels[currentStep]}
          </button>
        ) : (
          <button type="button" className="primary-button" onClick={() => void handleSave()} disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar presupuesto'}
          </button>
        )}
      </div>
    </>
  )

  const activeContextualFlow = currentStep === 0
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
    : currentStep === 1 && form.client_id && showPropertyCreate ? (
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
        description="El presupuesto se construye en una superficie dedicada, con pasos amplios y contexto siempre visible."
        steps={quoteSteps}
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
              <strong>Fija el cliente primero</strong>
              <small>El resto del flujo hereda la propiedad y mantiene la trazabilidad comercial desde el inicio.</small>
            </article>

            <article className={`cc-create-flow__status-card ${currentStepError ? 'cc-create-flow__status-card--blocked' : 'cc-create-flow__status-card--ready'}`}>
              <span className="cc-create-flow__status-icon" aria-hidden="true">{currentStepError ? '!' : 'OK'}</span>
              <div className="cc-create-flow__status-copy">
                <span>{currentStepError ? 'Falta contexto base' : 'Contexto listo'}</span>
                <strong>{currentStepError ?? 'El cliente ya esta fijado para seguir con datos comerciales.'}</strong>
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
                  description="Para seguir con este presupuesto necesitas fijar antes un cliente o crearlo ahora."
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

        {currentStep === 1 ? (
          <section className="cc-create-flow__section">
            {activeContextualFlow ? activeContextualFlow : (
              <>
            <article className="cc-create-flow__hero-card">
              <span className="cc-step-flow__eyebrow">Paso 2</span>
              <strong>Completa datos comerciales sin abandonar la accion</strong>
              <small>La propiedad y el estado se resuelven aqui. Si falta una propiedad, la creas dentro del mismo flujo.</small>
            </article>

            <article className={`cc-create-flow__status-card ${currentStepError ? 'cc-create-flow__status-card--blocked' : 'cc-create-flow__status-card--ready'}`}>
              <span className="cc-create-flow__status-icon" aria-hidden="true">{currentStepError ? '!' : 'OK'}</span>
              <div className="cc-create-flow__status-copy">
                <span>{currentStepError ? 'Paso pendiente' : 'Paso listo'}</span>
                <strong>{currentStepError ?? 'Estado, propiedad y notas ya no bloquean el avance.'}</strong>
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

              <label className="form-field">
                <span>Estado</span>
                <select value={form.status} onChange={(event) => updateField('status', event.target.value)}>
                  {quoteStatusOptions.map((status) => (
                    <option key={status} value={status}>{getStatusOptionLabel(status)}</option>
                  ))}
                </select>
              </label>

              {form.client_id && !contextPropertyId ? (
                <ContextualCreateSection
                  actionLabel="Crear propiedad"
                  title="Propiedad pendiente"
                  description="Añadela ahora y quedara enlazada al presupuesto sin perder progreso."
                  isOpen={showPropertyCreate}
                  onToggle={() => setShowPropertyCreate(true)}
                >
                  <></>
                </ContextualCreateSection>
              ) : null}

              <label className="form-field form-field-full">
                <span>Notas</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => updateField('notes', event.target.value)}
                  rows={4}
                  placeholder="Condiciones, alcance o notas comerciales"
                />
              </label>
            </div>
              </>
            )}
          </section>
        ) : null}

        {currentStep === 2 ? (
          <section className="cc-create-flow__section">
            <article className="cc-create-flow__hero-card">
              <span className="cc-step-flow__eyebrow">Paso 3</span>
              <strong>Construye las lineas del presupuesto</strong>
              <small>Las microacciones viven junto a las lineas, no perdidas en otra zona del overlay.</small>
            </article>

            <article className={`cc-create-flow__status-card ${currentStepError ? 'cc-create-flow__status-card--blocked' : 'cc-create-flow__status-card--ready'}`}>
              <span className="cc-create-flow__status-icon" aria-hidden="true">{currentStepError ? '!' : 'OK'}</span>
              <div className="cc-create-flow__status-copy">
                <span>{currentStepError ? 'Lineas pendientes' : 'Lineas listas'}</span>
                <strong>{currentStepError ?? `${lines.length} linea(s) preparadas para revision.`}</strong>
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

                  <div className="cc-create-flow__line-actions">
                    <small className="cc-create-flow__helper">Cada linea se guarda exactamente como la escribes.</small>
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
              <strong>Revisa el presupuesto antes de guardar</strong>
              <small>Si detectamos un bloqueo, te devolvemos al paso correcto sin perder lineas ni notas.</small>
            </article>

            <article className="cc-create-flow__status-card cc-create-flow__status-card--ready">
              <span className="cc-create-flow__status-icon" aria-hidden="true">OK</span>
              <div className="cc-create-flow__status-copy">
                <span>Documento listo</span>
                <strong>Ya puedes guardar el presupuesto con su trazabilidad completa.</strong>
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
                <small>{lines.length} linea(s)</small>
              </article>
            </div>

            {lines.map((line, index) => (
              <article key={line.local_id} className="cc-create-flow__panel">
                <strong>Línea {index + 1}</strong>
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
                    <strong>{line.unit_price} €</strong>
                  </div>
                  <div className="cc-create-flow__summary-item">
                    <span>Importe</span>
                    <strong>{formatQuoteLineSubtotalInput(line)} €</strong>
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
        description="Si cierras ahora, perderas las lineas y notas del presupuesto en este fullscreen flow."
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
