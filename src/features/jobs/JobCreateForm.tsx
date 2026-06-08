import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { formatClientLabel, formatPropertyLabel, formatQuoteLabel } from '../../app/relationshipLabels'
import { getStatusOptionLabel, jobStatusOptions } from '../../app/statusOptions'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ContextualCreateSection } from '../../components/ContextualCreateSection'
import { ClientCreateForm } from '../clients/ClientCreateForm'
import type { ClientListItem } from '../clients/types'
import { PropertyCreateForm } from '../properties/PropertyCreateForm'
import type { PropertyListItem } from '../properties/types'
import { QuoteCreateForm } from '../quotes/QuoteCreateForm'
import type { QuoteListItem } from '../quotes/types'
import type { JobCreatePrefill } from './jobCreatePrefill'
import type { JobListItem } from './types'

interface JobCreateFormProps {
  clients: ClientListItem[]
  properties: PropertyListItem[]
  quotes: QuoteListItem[]
  onCreated: () => Promise<void>
  prefill?: JobCreatePrefill | null
  onCreatedJob?: (job: JobListItem) => void | Promise<void>
  onOpenCreatedJob?: (jobId: string) => void
  onCreateInvoiceFromJob?: (job: JobListItem) => void
  onCancel?: () => void
  onDirtyChange?: (isDirty: boolean) => void
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

export function JobCreateForm({
  clients,
  properties,
  quotes,
  onCreated,
  prefill = null,
  onCreatedJob,
  onOpenCreatedJob,
  onCreateInvoiceFromJob,
  onCancel,
  onDirtyChange,
}: JobCreateFormProps) {
  const [form, setForm] = useState<FormState>(() => (
    prefill ? applyPrefillToForm(prefill) : createDefaultFormState()
  ))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [lastAppliedPrefillId, setLastAppliedPrefillId] = useState<string | null>(prefill?.request_id ?? null)
  const [showClientCreate, setShowClientCreate] = useState(false)
  const [showPropertyCreate, setShowPropertyCreate] = useState(false)
  const [showQuoteCreate, setShowQuoteCreate] = useState(false)
  const [createdJob, setCreatedJob] = useState<JobListItem | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

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

  useEffect(() => {
    if (!prefill || prefill.request_id === lastAppliedPrefillId) {
      return
    }

    setForm(applyPrefillToForm(prefill))
    setSubmitError(null)
    setSuccessMessage(null)
    setCreatedJob(null)
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

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setIsDirty(true)
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
    setCreatedJob(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError(null)
    setSuccessMessage(null)
    setIsSubmitting(true)

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseAnonKey) {
        setSubmitError('Faltan las variables de entorno de Supabase.')
        return
      }

      if (!form.client_id) {
        setSubmitError('Debes seleccionar un cliente.')
        return
      }

      if (!form.property_id) {
        setSubmitError('Debes seleccionar una propiedad.')
        return
      }

      if (!form.scheduled_date) {
        setSubmitError('Debes indicar la fecha programada.')
        return
      }

      const billingQuantity = parseDecimalInput(form.billing_quantity)
      const billingUnitPrice = form.billing_unit_price.trim()
        ? parseDecimalInput(form.billing_unit_price)
        : null

      if (Number.isNaN(billingQuantity) || billingQuantity <= 0) {
        setSubmitError('La cantidad de facturacion debe ser mayor que 0.')
        return
      }

      if (billingUnitPrice !== null && (Number.isNaN(billingUnitPrice) || billingUnitPrice < 0)) {
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

      await onCreated()
      const nextCreatedJob = {
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
      await onCreatedJob?.(nextCreatedJob)
      setForm(createDefaultFormState())
      setCreatedJob(nextCreatedJob)
      setIsDirty(false)
      setSuccessMessage('Servicio creado correctamente.')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido creando el servicio.'

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

  return (
    <section className="data-section cc-form-shell cc-form-shell--job">
      <div className="section-header cc-form-shell__header">
        <div className="cc-form-shell__intro">
          <span className="cc-form-shell__eyebrow">Operacion guiada</span>
          <h2>Nuevo servicio</h2>
          <p>El servicio es el centro de ejecucion. Si ya vienes con contexto, el sistema lo hereda y evita volver a pedirlo.</p>
        </div>

        <div className="cc-form-shell__summary">
          <div className="cc-form-shell__summary-card">
            <span>Origen</span>
            <strong>{originSummary}</strong>
            <small>{selectedQuote ? formatQuoteLabel(selectedQuote) : 'Sin presupuesto forzado'}</small>
          </div>
          <div className="cc-form-shell__summary-card">
            <span>Cliente / propiedad</span>
            <strong>{selectedClient ? formatClientLabel(selectedClient) : 'Pendiente'}</strong>
            <small>{selectedProperty ? formatPropertyLabel(selectedProperty) : 'Define la ubicacion del servicio'}</small>
          </div>
        </div>
      </div>

      {clients.length === 0 ? (
        <ContextualCreateSection
          actionLabel="Crear cliente"
          title="Falta el cliente base"
          description="Crea el cliente sin salir del servicio y continúa después con la propiedad y la planificación."
          isOpen={showClientCreate}
          onToggle={() => setShowClientCreate((current) => !current)}
        >
          <ClientCreateForm
            onCreated={onCreated}
            onDirtyChange={setIsDirty}
            title="Nuevo cliente para este servicio"
            description="El cliente quedará listo para seguir con la ruta operativa."
            submitLabel="Guardar cliente y continuar"
            onCreatedClient={async (client) => {
              setForm((current) => ({
                ...current,
                client_id: client.id,
              }))
              setIsDirty(true)
              setShowClientCreate(false)
            }}
          />
        </ContextualCreateSection>
      ) : (
        <form className="lead-form cc-form-shell__grid" onSubmit={handleSubmit}>
          <div className="cc-form-shell__main">
            <section className="cc-form-shell__section">
              <div className="cc-form-shell__section-head">
                <strong>Base operativa</strong>
                <span>Cliente y propiedad mandan. El presupuesto solo entra como apoyo cuando ya existe y aporta continuidad.</span>
              </div>

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
                  actionLabel="Crear cliente"
                  title="Cliente en contexto"
                  description="Si el servicio nace sobre un cliente nuevo, créalo aquí y el flujo seguirá sin reiniciarse."
                  isOpen={showClientCreate}
                  onToggle={() => setShowClientCreate((current) => !current)}
                >
                  <ClientCreateForm
                    onCreated={onCreated}
                    onDirtyChange={setIsDirty}
                    title="Nuevo cliente para este servicio"
                    description="El cliente se asignará automáticamente al servicio en curso."
                    submitLabel="Guardar cliente y usarlo"
                    onCreatedClient={async (client) => {
                      setForm((current) => ({
                        ...current,
                        client_id: client.id,
                        property_id: '',
                        quote_id: '',
                      }))
                      setIsDirty(true)
                      setShowClientCreate(false)
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
                  actionLabel="Crear propiedad"
                  title="Propiedad en contexto"
                  description="Da de alta la propiedad del cliente actual sin romper la planificación del servicio."
                  isOpen={showPropertyCreate}
                  onToggle={() => setShowPropertyCreate((current) => !current)}
                >
                  <PropertyCreateForm
                    clients={clients}
                    onCreated={onCreated}
                    onDirtyChange={setIsDirty}
                    contextClientId={form.client_id}
                    title="Nueva propiedad para este servicio"
                    description="La nueva propiedad quedará seleccionada al volver al servicio."
                    submitLabel="Guardar propiedad y usarla"
                    onCreatedProperty={async (property) => {
                      setForm((current) => ({
                        ...current,
                        property_id: property.id,
                        quote_id: '',
                      }))
                      setIsDirty(true)
                      setShowPropertyCreate(false)
                    }}
                  />
                </ContextualCreateSection>
              ) : null}

              <label className="form-field">
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
                  actionLabel="Crear presupuesto"
                  title="Presupuesto en contexto"
                  description="Si todavía no existe el presupuesto aceptado, créalo aquí y úsalo como origen secundario del servicio."
                  isOpen={showQuoteCreate}
                  onToggle={() => setShowQuoteCreate((current) => !current)}
                >
                  <QuoteCreateForm
                    clients={clients}
                    properties={properties}
                    onCreated={onCreated}
                    onDirtyChange={setIsDirty}
                    contextClientId={form.client_id}
                    contextPropertyId={form.property_id || null}
                    onCreatedQuote={async (quote) => {
                      setForm((current) => ({
                        ...current,
                        quote_id: quote.id,
                        client_id: quote.client_id,
                        property_id: quote.property_id ?? current.property_id,
                      }))
                      setIsDirty(true)
                      setShowQuoteCreate(false)
                    }}
                  />
                </ContextualCreateSection>
              ) : null}
            </section>

            <section className="cc-form-shell__section">
              <div className="cc-form-shell__section-head">
                <strong>Planificacion</strong>
                <span>Fecha, estado operativo y tipo de servicio.</span>
              </div>

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
                <select
                  value={form.status}
                  onChange={(event) => updateField('status', event.target.value)}
                >
                  {jobStatusOptions.map((status) => (
                    <option key={status} value={status}>{getStatusOptionLabel(status)}</option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span>Tipo de servicio</span>
                <select
                  value={form.service_type}
                  onChange={(event) => updateField('service_type', event.target.value)}
                >
                  <option value="standard_cleaning">{getServiceTypeOptionLabel('standard_cleaning')}</option>
                  <option value="deep_cleaning">{getServiceTypeOptionLabel('deep_cleaning')}</option>
                  <option value="post_construction">{getServiceTypeOptionLabel('post_construction')}</option>
                  <option value="check_out_cleaning">{getServiceTypeOptionLabel('check_out_cleaning')}</option>
                  <option value="airbnb_turnover">{getServiceTypeOptionLabel('airbnb_turnover')}</option>
                  <option value="glass_cleaning">{getServiceTypeOptionLabel('glass_cleaning')}</option>
                </select>
              </label>
            </section>

            <section className="cc-form-shell__section cc-form-shell__section--full">
              <div className="cc-form-shell__section-head">
                <strong>Base de facturacion</strong>
                <span>Queda lista para que la siguiente acción natural sea crear factura desde este servicio.</span>
              </div>

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
            </section>

            <section className="cc-form-shell__section cc-form-shell__section--full">
              <div className="cc-form-shell__section-head">
                <strong>Notas operativas</strong>
                <span>Instrucciones internas y contexto del servicio.</span>
              </div>

              <label className="form-field form-field-full">
                <span>Notas</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => updateField('notes', event.target.value)}
                  placeholder="Notas operativas del servicio"
                  rows={4}
                />
              </label>
            </section>

            {submitError ? (
              <div className="cc-alert cc-alert--error">
                <strong>No se pudo crear el servicio</strong>
                <p>{submitError}</p>
              </div>
            ) : null}

            {successMessage ? (
              <div className="cc-alert cc-alert--success">
                <strong>Operacion correcta</strong>
                <p>{successMessage}</p>
              </div>
            ) : null}

            {createdJob ? (
              <div className="cc-detail-panel__next-step">
                <span>Siguiente paso recomendado</span>
                <strong>El servicio ya está creado. Ahora conviene facturarlo o abrir su workspace.</strong>
                <div className="form-actions">
                  {onCreateInvoiceFromJob ? (
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => onCreateInvoiceFromJob(createdJob)}
                    >
                      Crear factura
                    </button>
                  ) : null}
                  {onOpenCreatedJob ? (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => onOpenCreatedJob(createdJob.id)}
                    >
                      Ver servicio
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <aside className="cc-form-shell__aside">
            <div className="cc-form-shell__sticky">
              <div className="cc-form-shell__summary-card cc-form-shell__summary-card--stack">
                <span>Resultado</span>
                <strong>{originMode === 'quote' ? 'Servicio trazable' : 'Servicio directo'}</strong>
                <small>
                  {originMode === 'quote'
                    ? 'Mantendra cliente, propiedad y presupuesto enlazados.'
                    : 'Quedara listo para facturar desde el servicio, sin presupuesto forzado.'}
                </small>
              </div>

              <div className="cc-form-shell__summary-card cc-form-shell__summary-card--stack">
                <span>Contexto activo</span>
                <strong>{selectedProperty ? formatPropertyLabel(selectedProperty) : 'Falta propiedad'}</strong>
                <small>{selectedQuote ? formatQuoteLabel(selectedQuote) : 'Sin presupuesto origen'}</small>
              </div>

              <div className="form-actions cc-form-shell__actions">
                {onCancel ? (
                  <button type="button" className="secondary-button" onClick={requestCancel}>
                    Cancelar
                  </button>
                ) : null}
                <button type="submit" className="primary-button" disabled={isSubmitting}>
                  {isSubmitting ? 'Guardando...' : 'Guardar servicio'}
                </button>
              </div>
            </div>
          </aside>
        </form>
      )}

      <ConfirmDialog
        isOpen={showCancelConfirm}
        title="Descartar servicio en curso"
        description="Has empezado a completar este servicio. Si cierras ahora, perderas los cambios no guardados."
        confirmLabel="Descartar cambios"
        tone="warning"
        onCancel={() => setShowCancelConfirm(false)}
        onConfirm={() => {
          setShowCancelConfirm(false)
          onCancel?.()
        }}
      />
    </section>
  )
}
