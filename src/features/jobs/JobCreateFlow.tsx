import { useEffect, useMemo, useState } from 'react'
import { formatClientLabel, formatPropertyLabel, formatQuoteLabel } from '../../app/relationshipLabels'
import { getStatusOptionLabel, jobStatusOptions } from '../../app/statusOptions'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ContextualCreateSection } from '../../components/ContextualCreateSection'
import { FullscreenStepFlow, type FullscreenStepFlowContextItem } from '../../components/FullscreenStepFlow'
import { ClientCreateForm } from '../clients/ClientCreateForm'
import type { ClientListItem } from '../clients/types'
import { findJobDuplicateGroups } from '../duplicates/duplicateEngine'
import { DuplicateReviewOverlay } from '../duplicates/DuplicateReviewOverlay'
import { PropertyCreateFlow } from '../properties/PropertyCreateFlow'
import type { PropertyListItem } from '../properties/types'
import { QuoteCreateFlow } from '../quotes/QuoteCreateFlow'
import type { QuoteListItem } from '../quotes/types'
import {
  completeContextualActionFlow,
  completeFullViewActionFlow,
  type FullViewActionFlowProps,
} from '../shared/actionFlowLifecycle'
import type { JobCreatePrefill } from './jobCreatePrefill'
import type { JobListItem } from './types'
import '../shared/fullscreen-create-flow.css'

interface JobCreateFlowProps extends FullViewActionFlowProps {
  clients: ClientListItem[]
  properties: PropertyListItem[]
  quotes: QuoteListItem[]
  jobs?: JobListItem[]
  prefill?: JobCreatePrefill | null
  onCreatedJob?: (job: JobListItem) => void | Promise<void>
  onOpenExistingJob?: (jobId: string) => void
}

interface FormState {
  client_id: string
  property_id: string
  quote_id: string
  scheduled_date: string
  status: string
  service_type: string
  billing_concept: string
  billing_quantity: string
  billing_unit: string
  billing_unit_price: string
  notes: string
}

type JobOriginMode = 'quote' | 'direct'

const jobSteps = [
  { id: 'origin', label: 'Origen y contexto', description: 'Fija cliente, propiedad y presupuesto si ya existen.' },
  { id: 'schedule', label: 'Servicio y programacion', description: 'Define fecha, estado operativo y tipo de servicio.' },
  { id: 'billing', label: 'Operacion y facturacion', description: 'Prepara base de facturacion y notas clave.' },
  { id: 'review', label: 'Revision y siguiente paso', description: 'Confirma el servicio y el siguiente movimiento natural.' },
]

const jobNextLabels = [
  'Confirmar servicio',
  'Preparar base de facturacion',
  'Ir a revision final',
]

function getServiceTypeOptionLabel(value: string): string {
  switch (value) {
    case 'standard_cleaning': return 'Limpieza estandar'
    case 'deep_cleaning': return 'Limpieza profunda'
    case 'post_construction': return 'Limpieza fin de obra'
    case 'check_out_cleaning': return 'Limpieza check-out'
    case 'airbnb_turnover': return 'Cambio Airbnb'
    case 'glass_cleaning': return 'Limpieza de cristales'
    default: return value
  }
}

function parseDecimalInput(value: string): number {
  const normalized = value.trim().replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function createDefaultFormState(): FormState {
  return {
    client_id: '',
    property_id: '',
    quote_id: '',
    scheduled_date: '',
    status: 'scheduled',
    service_type: 'standard_cleaning',
    billing_concept: getServiceTypeOptionLabel('standard_cleaning'),
    billing_quantity: '1.00',
    billing_unit: 'servicio',
    billing_unit_price: '',
    notes: '',
  }
}

function applyPrefillToForm(prefill: JobCreatePrefill): FormState {
  const defaultState = createDefaultFormState()

  return {
    ...defaultState,
    client_id: prefill.client_id,
    property_id: prefill.property_id,
    quote_id: prefill.quote_id,
    service_type: prefill.service_type ?? defaultState.service_type,
    billing_concept: prefill.billing_concept || defaultState.billing_concept,
    notes: prefill.notes,
  }
}

function getOriginSummary(prefill: JobCreatePrefill | null, hasSelectedQuote: boolean): string {
  if (prefill?.origin_kind === 'quote' || hasSelectedQuote) {
    return 'Servicio heredado desde presupuesto aceptado.'
  }

  if (prefill?.origin_kind === 'property') {
    return 'Servicio heredado desde propiedad y cliente.'
  }

  if (prefill?.origin_kind === 'client') {
    return 'Servicio heredado desde cliente.'
  }

  return 'Servicio directo con cliente y propiedad como base operativa.'
}

export function JobCreateFlow({
  clients,
  properties,
  quotes,
  jobs = [],
  onRefreshData,
  onCompleted,
  prefill = null,
  onCreatedJob,
  onOpenExistingJob,
  onCancel,
  onDirtyChange,
}: JobCreateFlowProps) {
  const [form, setForm] = useState<FormState>(() => (
    prefill ? applyPrefillToForm(prefill) : createDefaultFormState()
  ))
  const [currentStep, setCurrentStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [lastAppliedPrefillId, setLastAppliedPrefillId] = useState<string | null>(prefill?.request_id ?? null)
  const [showClientCreate, setShowClientCreate] = useState(false)
  const [showPropertyCreate, setShowPropertyCreate] = useState(false)
  const [showQuoteCreate, setShowQuoteCreate] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [pendingDuplicateGroups, setPendingDuplicateGroups] = useState<ReturnType<typeof findJobDuplicateGroups>>([])

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

  const availableQuotes = useMemo(() => {
    if (!form.client_id) {
      return []
    }

    return quotes.filter((quote) => {
      if (quote.client_id !== form.client_id) return false
      if (!form.property_id) return true
      return (quote.property_id === form.property_id || quote.property_id === null) && quote.status === 'accepted'
    })
  }, [quotes, form.client_id, form.property_id])

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === form.client_id) ?? null,
    [clients, form.client_id],
  )
  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === form.property_id) ?? null,
    [properties, form.property_id],
  )
  const selectedQuote = useMemo(
    () => quotes.find((quote) => quote.id === form.quote_id) ?? null,
    [quotes, form.quote_id],
  )
  const originMode: JobOriginMode = form.quote_id ? 'quote' : 'direct'
  const isClientLocked = Boolean(prefill?.client_id)
  const isPropertyLocked = Boolean(prefill?.property_id)
  const isQuoteLocked = Boolean(prefill?.quote_id)
  const originSummary = getOriginSummary(prefill, Boolean(form.quote_id))
  const nextStepLabel = selectedQuote
    ? 'Despues de guardar, el siguiente paso natural es crear factura desde este servicio.'
    : 'Despues de guardar, podras volver al contexto o pasar a facturacion cuando toque.'

  useEffect(() => {
    if (!prefill || prefill.request_id === lastAppliedPrefillId) {
      return
    }

    setForm(applyPrefillToForm(prefill))
    setSubmitError(null)
    setIsDirty(false)
    setLastAppliedPrefillId(prefill.request_id)
  }, [lastAppliedPrefillId, prefill])

  useEffect(() => {
    if (!selectedQuote) return

    setForm((current) => ({
      ...current,
      client_id: selectedQuote.client_id ?? current.client_id,
      property_id: selectedQuote.property_id ?? current.property_id,
      billing_concept: current.billing_concept.trim()
        ? current.billing_concept
        : selectedQuote.lines?.[0]?.concept?.trim() || selectedQuote.quote_lines?.[0]?.concept?.trim() || current.billing_concept,
      notes: current.notes.trim() ? current.notes : selectedQuote.notes?.trim() ?? '',
    }))
  }, [selectedQuote])

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
        next.property_id = ''
        next.quote_id = ''
      }

      if (field === 'property_id') {
        next.quote_id = ''
      }

      if (field === 'service_type') {
        const currentConcept = current.billing_concept.trim()
        const previousServiceConcept = getServiceTypeOptionLabel(current.service_type)
        if (!currentConcept || currentConcept === previousServiceConcept) {
          next.billing_concept = getServiceTypeOptionLabel(String(value))
        }
      }

      return next
    })
  }

  function getStepError(stepIndex: number): string | null {
    if (stepIndex === 0) {
      if (!form.client_id) return 'Debes fijar un cliente antes de seguir.'
      if (!form.property_id) return 'Debes fijar una propiedad antes de seguir.'
    }

    if (stepIndex === 1) {
      if (!form.scheduled_date) return 'Debes indicar la fecha programada.'
      if (!form.service_type) return 'Debes indicar el tipo de servicio.'
    }

    if (stepIndex === 2) {
      const billingQuantity = parseDecimalInput(form.billing_quantity)
      const billingUnitPrice = form.billing_unit_price.trim()
        ? parseDecimalInput(form.billing_unit_price)
        : null

      if (Number.isNaN(billingQuantity) || billingQuantity <= 0) {
        return 'La cantidad de facturacion debe ser mayor que 0.'
      }

      if (billingUnitPrice !== null && (Number.isNaN(billingUnitPrice) || billingUnitPrice < 0)) {
        return 'El precio unitario debe estar vacio o ser mayor o igual que 0.'
      }
    }

    return null
  }

  function goToStep(nextStep: number) {
    const boundedStep = Math.max(0, Math.min(jobSteps.length - 1, nextStep))

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

    for (let index = 0; index < jobSteps.length - 1; index += 1) {
      const error = getStepError(index)
      if (error) {
        setCurrentStep(index)
        setSubmitError(error)
        return
      }
    }

    setIsSubmitting(true)

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseAnonKey) {
        setSubmitError('Faltan las variables de entorno de Supabase.')
        return
      }

      const billingQuantity = parseDecimalInput(form.billing_quantity)
      const billingUnitPrice = form.billing_unit_price.trim()
        ? parseDecimalInput(form.billing_unit_price)
        : null

      if (Number.isNaN(billingQuantity) || billingQuantity <= 0) {
        setCurrentStep(2)
        setSubmitError('La cantidad de facturacion debe ser mayor que 0.')
        return
      }

      if (billingUnitPrice !== null && (Number.isNaN(billingUnitPrice) || billingUnitPrice < 0)) {
        setCurrentStep(2)
        setSubmitError('El precio unitario debe estar vacio o ser mayor o igual que 0.')
        return
      }

      const jobId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? `JOB-${crypto.randomUUID()}`
          : `JOB-${Date.now()}`

      const response = await fetch(`${supabaseUrl}/rest/v1/jobs`, {
        method: 'POST',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: jobId,
          client_id: form.client_id,
          property_id: form.property_id,
          quote_id: form.quote_id || null,
          scheduled_date: form.scheduled_date,
          status: form.status,
          service_type: form.service_type,
          billing_concept: form.billing_concept.trim() || null,
          billing_quantity: billingQuantity,
          billing_unit: form.billing_unit.trim() || 'servicio',
          billing_unit_price: billingUnitPrice,
          notes: form.notes.trim() || null,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        setSubmitError(`REST ${response.status}: ${errorText || response.statusText}`)
        return
      }

      const nextCreatedJob: JobListItem = {
        id: jobId,
        display_code: null,
        client_id: form.client_id,
        client_display_code: selectedClient?.display_code ?? null,
        client_name: selectedClient?.full_name ?? null,
        property_id: form.property_id,
        property_display_code: selectedProperty?.display_code ?? null,
        property_name: selectedProperty?.name ?? null,
        quote_id: form.quote_id || null,
        quote_display_code: selectedQuote?.display_code ?? null,
        scheduled_date: form.scheduled_date,
        status: form.status,
        service_type: form.service_type,
        billing_concept: form.billing_concept.trim() || null,
        billing_quantity: billingQuantity,
        billing_unit: form.billing_unit.trim() || 'servicio',
        billing_unit_price: billingUnitPrice,
        notes: form.notes.trim() || null,
      }

      if (!skipDuplicateCheck) {
        const duplicateGroups = findJobDuplicateGroups(nextCreatedJob, jobs)
        if (duplicateGroups.length > 0) {
          setPendingDuplicateGroups(duplicateGroups)
          return
        }
      }

      await onCreatedJob?.(nextCreatedJob)
      setIsDirty(false)
      await completeFullViewActionFlow({
        onRefreshData,
        onCompleted,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido creando el servicio.'
      setSubmitError(message)
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
      value: originMode === 'quote' ? 'Presupuesto -> servicio' : 'Servicio directo',
      hint: originSummary,
    },
    {
      label: 'Cliente',
      value: selectedClient ? formatClientLabel(selectedClient) : 'Pendiente',
      hint: selectedProperty ? formatPropertyLabel(selectedProperty) : 'Falta fijar propiedad',
    },
    {
      label: 'Presupuesto origen',
      value: selectedQuote ? formatQuoteLabel(selectedQuote) : 'Sin presupuesto forzado',
      hint: form.scheduled_date ? `Programado ${form.scheduled_date}` : 'Fecha pendiente',
    },
  ]

  const stepStates = jobSteps.map((_, index) => {
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
        <span className="cc-step-flow__eyebrow">Resultado esperado</span>
        <div className="cc-create-flow__summary-list">
          <div className="cc-create-flow__summary-item">
            <span>Modelo</span>
            <strong>{originMode === 'quote' ? 'Servicio trazable' : 'Servicio operativo directo'}</strong>
          </div>
          <div className="cc-create-flow__summary-item">
            <span>Siguiente paso</span>
            <strong>{selectedQuote ? 'Facturar servicio' : 'Volver al contexto o preparar factura'}</strong>
          </div>
        </div>
        <p className="cc-create-flow__helper">{nextStepLabel}</p>
      </section>

      <section className="cc-create-flow__summary-card">
        <span className="cc-step-flow__eyebrow">Base de facturacion</span>
        <div className="cc-create-flow__summary-list">
          <div className="cc-create-flow__summary-item">
            <span>Cantidad</span>
            <strong>{form.billing_quantity || 'Pendiente'}</strong>
          </div>
          <div className="cc-create-flow__summary-item">
            <span>Unidad</span>
            <strong>{form.billing_unit || 'servicio'}</strong>
          </div>
          <div className="cc-create-flow__summary-item">
            <span>Precio unitario</span>
            <strong>{form.billing_unit_price.trim() || 'Se definira despues'}</strong>
          </div>
        </div>
      </section>
    </>
  )

  const footerContent = (
    <div className="cc-create-flow__footer-actions">
      {onCancel ? (
        <button type="button" className="secondary-button" onClick={requestCancel}>
          Cancelar
        </button>
      ) : null}

      {currentStep > 0 ? (
        <button type="button" className="secondary-button" onClick={() => goToStep(currentStep - 1)}>
          Volver
        </button>
      ) : null}

      {currentStep < jobSteps.length - 1 ? (
        <button type="button" className="primary-button" onClick={() => goToStep(currentStep + 1)}>
          {jobNextLabels[currentStep]}
        </button>
      ) : (
        <button type="button" className="primary-button" disabled={isSubmitting} onClick={() => void handleSave()}>
          {isSubmitting ? 'Guardando...' : 'Guardar servicio'}
        </button>
      )}
    </div>
  )

  return (
    <>
      <FullscreenStepFlow
        eyebrow="Operacion guiada"
        title="Nuevo servicio"
        description="Convierte el servicio en una accion fullview real, con contexto heredado y base de facturacion lista."
        steps={jobSteps}
        currentStep={currentStep}
        stepStates={stepStates}
        onStepSelect={goToStep}
        sideContent={sideContent}
        footerContent={footerContent}
        contextItems={contextItems}
      >
        {currentStep === 0 ? (
          <section className="cc-create-flow__section">
            <article className="cc-create-flow__hero-card">
              <span className="cc-step-flow__eyebrow">Paso 1</span>
              <strong>Fija el origen real del servicio</strong>
              <small>Cliente, propiedad y presupuesto se heredan cuando existen. Si falta algo, lo resuelves aqui mismo.</small>
            </article>

            <article className={`cc-create-flow__status-card ${currentStepError ? 'cc-create-flow__status-card--blocked' : 'cc-create-flow__status-card--ready'}`}>
              <span className="cc-create-flow__status-icon" aria-hidden="true">{currentStepError ? '!' : 'OK'}</span>
              <div className="cc-create-flow__status-copy">
                <span>{currentStepError ? 'Falta contexto base' : 'Contexto listo'}</span>
                <strong>{currentStepError ?? 'Cliente, propiedad y origen estan listos para programar el servicio.'}</strong>
              </div>
            </article>

            <div className="cc-create-flow__grid">
              <label className="form-field">
                <span>Cliente *</span>
                <select
                  value={form.client_id}
                  onChange={(event) => updateField('client_id', event.target.value)}
                  disabled={isClientLocked}
                >
                  {!isClientLocked ? <option value="">Selecciona un cliente</option> : null}
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {formatClientLabel(client)}
                    </option>
                  ))}
                </select>
              </label>

              {!isClientLocked ? (
                <ContextualCreateSection
                  actionLabel="Crear cliente en este flujo"
                  title="Cliente pendiente"
                  description="Si el servicio nace sobre un cliente nuevo, lo creas aqui sin perder el resto del flujo."
                  isOpen={showClientCreate}
                  onToggle={() => setShowClientCreate((current) => !current)}
                >
                  <ClientCreateForm
                    onCreated={onRefreshData}
                    onDirtyChange={setIsDirty}
                    title="Nuevo cliente para este servicio"
                    description="El cliente quedara fijado y el servicio seguira en este mismo punto."
                    submitLabel="Guardar cliente y usarlo"
                    onCreatedClient={async (client) => {
                      await completeContextualActionFlow({
                        created: client,
                        applyCreated: async (createdClient) => {
                          setForm((current) => ({
                            ...current,
                            client_id: createdClient.id,
                            property_id: '',
                            quote_id: '',
                          }))
                        },
                        closeSubflow: () => setShowClientCreate(false),
                        markDirty,
                      })
                    }}
                  />
                </ContextualCreateSection>
              ) : null}

              <label className="form-field">
                <span>Propiedad *</span>
                <select
                  value={form.property_id}
                  onChange={(event) => updateField('property_id', event.target.value)}
                  disabled={isPropertyLocked}
                >
                  {!isPropertyLocked ? <option value="">Selecciona una propiedad</option> : null}
                  {availableProperties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {formatPropertyLabel(property)}
                    </option>
                  ))}
                </select>
              </label>

              {form.client_id && !isPropertyLocked ? (
                <ContextualCreateSection
                  actionLabel="Crear propiedad en este flujo"
                  title="Propiedad pendiente"
                  description="La propiedad se da de alta dentro del mismo servicio y vuelve ya seleccionada."
                  isOpen={showPropertyCreate}
                  onToggle={() => setShowPropertyCreate((current) => !current)}
                >
                  <PropertyCreateFlow
                    clients={clients}
                    onRefreshData={onRefreshData}
                    onCompleted={async () => {}}
                    onDirtyChange={setIsDirty}
                    contextClientId={form.client_id}
                    title="Nueva propiedad para este servicio"
                    description="La propiedad quedara lista para seguir con la programacion del servicio."
                    submitLabel="Guardar propiedad y usarla"
                    onCreatedProperty={async (property) => {
                      await completeContextualActionFlow({
                        created: property,
                        applyCreated: async (createdProperty) => {
                          setForm((current) => ({
                            ...current,
                            property_id: createdProperty.id,
                            quote_id: '',
                          }))
                        },
                        closeSubflow: () => setShowPropertyCreate(false),
                        markDirty,
                      })
                    }}
                  />
                </ContextualCreateSection>
              ) : null}

              <label className="form-field form-field-full">
                <span>Presupuesto aceptado</span>
                <select
                  value={form.quote_id}
                  onChange={(event) => updateField('quote_id', event.target.value)}
                  disabled={isQuoteLocked}
                >
                  {!isQuoteLocked ? <option value="">Sin presupuesto previo</option> : null}
                  {availableQuotes.map((quote) => (
                    <option key={quote.id} value={quote.id}>
                      {formatQuoteLabel({
                        ...quote,
                        client_name: quote.client_name ?? selectedClient?.full_name ?? null,
                        property_name: properties.find((property) => property.id === quote.property_id)?.name ?? null,
                      })}
                    </option>
                  ))}
                </select>
              </label>

              {form.client_id && !isQuoteLocked ? (
                <ContextualCreateSection
                  actionLabel="Crear presupuesto en este flujo"
                  title="Presupuesto en contexto"
                  description="Si aun no existe el presupuesto aceptado, lo creas aqui y lo usas como origen del servicio."
                  isOpen={showQuoteCreate}
                  onToggle={() => setShowQuoteCreate((current) => !current)}
                >
                  <QuoteCreateFlow
                    clients={clients}
                    properties={properties}
                    onRefreshData={onRefreshData}
                    onCompleted={async () => {}}
                    onDirtyChange={setIsDirty}
                    contextClientId={form.client_id}
                    contextPropertyId={form.property_id || null}
                    onCreatedQuote={async (quote) => {
                      await completeContextualActionFlow({
                        created: quote,
                        applyCreated: async (createdQuote) => {
                          setForm((current) => ({
                            ...current,
                            quote_id: createdQuote.id,
                            client_id: createdQuote.client_id,
                            property_id: createdQuote.property_id ?? current.property_id,
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
              <strong>Programa el servicio</strong>
              <small>Define fecha, estado operativo y tipo de servicio sin volver a pensar en la estructura del CRM.</small>
            </article>

            <article className={`cc-create-flow__status-card ${currentStepError ? 'cc-create-flow__status-card--blocked' : 'cc-create-flow__status-card--ready'}`}>
              <span className="cc-create-flow__status-icon" aria-hidden="true">{currentStepError ? '!' : 'OK'}</span>
              <div className="cc-create-flow__status-copy">
                <span>{currentStepError ? 'Programacion pendiente' : 'Programacion lista'}</span>
                <strong>{currentStepError ?? 'La agenda operativa del servicio ya esta clara.'}</strong>
              </div>
            </article>

            <div className="cc-create-flow__grid">
              <label className="form-field">
                <span>Fecha programada *</span>
                <input
                  type="date"
                  value={form.scheduled_date}
                  onChange={(event) => updateField('scheduled_date', event.target.value)}
                  required
                />
              </label>

              <label className="form-field">
                <span>Estado</span>
                <select value={form.status} onChange={(event) => updateField('status', event.target.value)}>
                  {jobStatusOptions.map((status) => (
                    <option key={status} value={status}>{getStatusOptionLabel(status)}</option>
                  ))}
                </select>
              </label>

              <label className="form-field form-field-full">
                <span>Tipo de servicio</span>
                <select value={form.service_type} onChange={(event) => updateField('service_type', event.target.value)}>
                  <option value="standard_cleaning">{getServiceTypeOptionLabel('standard_cleaning')}</option>
                  <option value="deep_cleaning">{getServiceTypeOptionLabel('deep_cleaning')}</option>
                  <option value="post_construction">{getServiceTypeOptionLabel('post_construction')}</option>
                  <option value="check_out_cleaning">{getServiceTypeOptionLabel('check_out_cleaning')}</option>
                  <option value="airbnb_turnover">{getServiceTypeOptionLabel('airbnb_turnover')}</option>
                  <option value="glass_cleaning">{getServiceTypeOptionLabel('glass_cleaning')}</option>
                </select>
              </label>
            </div>
          </section>
        ) : null}

        {currentStep === 2 ? (
          <section className="cc-create-flow__section">
            <article className="cc-create-flow__hero-card">
              <span className="cc-step-flow__eyebrow">Paso 3</span>
              <strong>Prepara operacion y facturacion</strong>
              <small>La base queda lista para que la siguiente accion natural sea facturar desde el servicio.</small>
            </article>

            <article className={`cc-create-flow__status-card ${currentStepError ? 'cc-create-flow__status-card--blocked' : 'cc-create-flow__status-card--ready'}`}>
              <span className="cc-create-flow__status-icon" aria-hidden="true">{currentStepError ? '!' : 'OK'}</span>
              <div className="cc-create-flow__status-copy">
                <span>{currentStepError ? 'Base de facturacion pendiente' : 'Base de facturacion lista'}</span>
                <strong>{currentStepError ?? 'Cantidad, unidad, concepto y notas ya no bloquean el guardado.'}</strong>
              </div>
            </article>

            <div className="cc-create-flow__grid">
              <label className="form-field form-field-full">
                <span>Concepto de facturacion</span>
                <input
                  value={form.billing_concept}
                  onChange={(event) => updateField('billing_concept', event.target.value)}
                  placeholder="Descripcion profesional que se mostrara en factura"
                />
              </label>

              <label className="form-field">
                <span>Cantidad *</span>
                <input
                  value={form.billing_quantity}
                  onChange={(event) => updateField('billing_quantity', event.target.value)}
                  required
                />
              </label>

              <label className="form-field">
                <span>Unidad *</span>
                <input
                  value={form.billing_unit}
                  onChange={(event) => updateField('billing_unit', event.target.value)}
                  placeholder="servicio, hora, m2..."
                  required
                />
              </label>

              <label className="form-field">
                <span>Precio unitario</span>
                <input
                  value={form.billing_unit_price}
                  onChange={(event) => updateField('billing_unit_price', event.target.value)}
                  placeholder="Opcional"
                />
              </label>

              <label className="form-field form-field-full">
                <span>Notas operativas</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => updateField('notes', event.target.value)}
                  placeholder="Notas operativas del servicio"
                  rows={4}
                />
              </label>
            </div>
          </section>
        ) : null}

        {currentStep === 3 ? (
          <section className="cc-create-flow__section">
            <article className="cc-create-flow__hero-card">
              <span className="cc-step-flow__eyebrow">Paso 4</span>
              <strong>Revisa y guarda el servicio</strong>
              <small>Si algo no cierra, te devolvemos al paso correcto sin perder contexto ni subflujos resueltos.</small>
            </article>

            <article className="cc-create-flow__status-card cc-create-flow__status-card--ready">
              <span className="cc-create-flow__status-icon" aria-hidden="true">OK</span>
              <div className="cc-create-flow__status-copy">
                <span>Servicio listo</span>
                <strong>Al guardar volveras al contexto anterior con el servicio ya disponible.</strong>
              </div>
            </article>

            <div className="cc-create-flow__review-grid">
              <article className="cc-create-flow__review-card">
                <span>Origen</span>
                <strong>{originMode === 'quote' ? 'Presupuesto aceptado' : 'Servicio directo'}</strong>
                <small>{selectedQuote ? formatQuoteLabel(selectedQuote) : 'Sin presupuesto forzado'}</small>
              </article>
              <article className="cc-create-flow__review-card">
                <span>Agenda</span>
                <strong>{form.scheduled_date || 'Pendiente'}</strong>
                <small>{getStatusOptionLabel(form.status)}</small>
              </article>
              <article className="cc-create-flow__review-card">
                <span>Cliente</span>
                <strong>{selectedClient ? formatClientLabel(selectedClient) : 'Pendiente'}</strong>
                <small>{selectedProperty ? formatPropertyLabel(selectedProperty) : 'Falta propiedad'}</small>
              </article>
              <article className="cc-create-flow__review-card">
                <span>Facturacion</span>
                <strong>{form.billing_concept.trim() || 'Sin concepto'}</strong>
                <small>{`${form.billing_quantity || '0'} ${form.billing_unit || 'servicio'}`}</small>
              </article>
            </div>

            {submitError ? (
              <div className="cc-alert cc-alert--error">
                <strong>No se pudo crear el servicio</strong>
                <p>{submitError}</p>
              </div>
            ) : null}
          </section>
        ) : null}
      </FullscreenStepFlow>

      <DuplicateReviewOverlay
        isOpen={pendingDuplicateGroups.length > 0}
        title="Posible servicio duplicado"
        description="Hemos encontrado coincidencias por cliente, propiedad, fecha o tipo de servicio. Revisa antes de guardar un servicio nuevo."
        groups={pendingDuplicateGroups}
        onClose={() => setPendingDuplicateGroups([])}
        onOpenRecord={(jobId) => {
          setPendingDuplicateGroups([])
          onOpenExistingJob?.(jobId)
        }}
        onUseRecord={(jobId) => {
          setPendingDuplicateGroups([])
          onOpenExistingJob?.(jobId)
        }}
        onContinueAnyway={() => {
          setPendingDuplicateGroups([])
          void handleSave(true)
        }}
      />

      <ConfirmDialog
        isOpen={showCancelConfirm}
        title="Descartar servicio en curso"
        description="Perderas los cambios no guardados de este servicio si cierras ahora."
        confirmLabel="Descartar"
        onCancel={() => setShowCancelConfirm(false)}
        onConfirm={() => {
          setShowCancelConfirm(false)
          onCancel?.()
        }}
      />
    </>
  )
}
