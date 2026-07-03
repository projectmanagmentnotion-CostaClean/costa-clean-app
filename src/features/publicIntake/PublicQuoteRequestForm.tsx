import { useMemo, useState, type FormEvent } from 'react'
import { FullscreenStepFlow, type FullscreenStepFlowContextItem } from '../../components/FullscreenStepFlow'
import type { StepFlowStatus } from '../stepflow'
import { submitPublicQuoteRequest, type PublicQuoteRequestSuccess } from './publicQuoteRequestApi'
import type { PreferredQuoteChannel, QuoteRequestNormalizedInput } from './types'

type StepId =
  | 'contact'
  | 'service'
  | 'property'
  | 'schedule'
  | 'details'
  | 'review'
  | 'success'

type ErrorMap = Partial<Record<keyof QuoteRequestNormalizedInput, string>>

interface StepConfig {
  id: StepId
  label: string
  title: string
  helper: string
  description: string
}

const steps: StepConfig[] = [
  {
    id: 'contact',
    label: 'Contacto',
    title: 'Datos de contacto',
    helper: 'Solo lo imprescindible para poder responderte con una propuesta revisada.',
    description: 'Quien solicita el presupuesto y como podemos localizarle.',
  },
  {
    id: 'service',
    label: 'Servicio',
    title: 'Tipo de servicio',
    helper: 'Elige el tipo de limpieza y la frecuencia que mejor encajan con tu caso.',
    description: 'Servicio principal y frecuencia prevista.',
  },
  {
    id: 'property',
    label: 'Propiedad',
    title: 'Datos de la propiedad',
    helper: 'Una aproximacion es suficiente para calcular tiempo, equipo y desplazamiento.',
    description: 'Tipo de inmueble, tamano y rasgos basicos.',
  },
  {
    id: 'schedule',
    label: 'Fecha',
    title: 'Fecha, urgencia y disponibilidad',
    helper: 'Nos sirve para valorar agenda, prioridad y zona antes de preparar tu presupuesto.',
    description: 'Cuando lo necesitas y en que zona se realizaria el servicio.',
  },
  {
    id: 'details',
    label: 'Detalles',
    title: 'Detalles adicionales',
    helper: 'Anade contexto util y dinos por que canal prefieres recibir la propuesta.',
    description: 'Notas, antecedentes y preferencia de respuesta.',
  },
  {
    id: 'review',
    label: 'Revision',
    title: 'Revision final',
    helper: 'Revisa los datos antes de enviarlos. Todavia no se ha generado ni enviado nada automaticamente.',
    description: 'Confirmacion final antes de registrar la solicitud.',
  },
  {
    id: 'success',
    label: 'Confirmacion',
    title: 'Solicitud recibida',
    helper: 'Todo ha quedado registrado para revision manual por parte de Costa Clean.',
    description: 'Siguiente paso y expectativa de respuesta.',
  },
]

const stepIndexById = Object.fromEntries(steps.map((step, index) => [step.id, index])) as Record<StepId, number>

const initialForm: QuoteRequestNormalizedInput = {
  submittedAt: null,
  fullName: '',
  phone: '',
  email: null,
  serviceNeedLabel: null,
  scopeNotes: null,
  propertyType: null,
  sqmBand: null,
  rooms: null,
  bathrooms: null,
  hasOutdoorAreas: null,
  hasPets: null,
  requestedServiceDate: null,
  preferredTimeSlot: null,
  serviceFrequencyLabel: null,
  preferredQuoteChannel: 'unknown',
  consentQuoteProcessing: false,
  postalCode: null,
  city: null,
  urgencyLabel: null,
  previousCleaningIssues: null,
  legacyUnusedField: null,
}

const channelOptions: Array<{ value: PreferredQuoteChannel; label: string }> = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Correo electronico' },
  { value: 'phone', label: 'Llamada' },
]

function cleanText(value: string): string | null {
  const trimmed = value.replace(/\s+/g, ' ').trim()
  return trimmed.length > 0 ? trimmed : null
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function validateStep(stepId: StepId, form: QuoteRequestNormalizedInput): ErrorMap {
  const errors: ErrorMap = {}

  if (stepId === 'contact') {
    if (!form.fullName.trim()) errors.fullName = 'Indica tu nombre completo.'
    if (!form.phone.trim()) errors.phone = 'Indica un telefono con prefijo.'
    if (form.email && !isValidEmail(form.email)) errors.email = 'Revisa el formato del correo.'
  }

  if (stepId === 'service') {
    if (!form.serviceNeedLabel) errors.serviceNeedLabel = 'Selecciona el tipo de servicio.'
    if (!form.serviceFrequencyLabel) errors.serviceFrequencyLabel = 'Selecciona la frecuencia.'
  }

  if (stepId === 'property') {
    if (!form.propertyType) errors.propertyType = 'Selecciona el tipo de propiedad.'
    if (!form.sqmBand) errors.sqmBand = 'Selecciona una franja aproximada.'
  }

  if (stepId === 'schedule') {
    if (!form.city) errors.city = 'Indica la poblacion.'
    if (!form.postalCode) errors.postalCode = 'Indica el codigo postal.'
  }

  if (stepId === 'details' || stepId === 'review') {
    if (form.preferredQuoteChannel === 'unknown') {
      errors.preferredQuoteChannel = 'Selecciona como prefieres recibir el presupuesto.'
    }

    if (!form.consentQuoteProcessing) {
      errors.consentQuoteProcessing = 'Necesitamos tu autorizacion para preparar el presupuesto.'
    }
  }

  return errors
}

function getStepFieldKeys(stepId: StepId): Array<keyof QuoteRequestNormalizedInput> {
  if (stepId === 'contact') return ['fullName', 'phone', 'email']
  if (stepId === 'service') return ['serviceNeedLabel', 'serviceFrequencyLabel']
  if (stepId === 'property') return ['propertyType', 'sqmBand', 'rooms', 'bathrooms', 'hasOutdoorAreas', 'hasPets']
  if (stepId === 'schedule') return ['requestedServiceDate', 'preferredTimeSlot', 'city', 'postalCode', 'urgencyLabel']
  if (stepId === 'details') {
    return ['scopeNotes', 'previousCleaningIssues', 'preferredQuoteChannel', 'consentQuoteProcessing']
  }
  if (stepId === 'review') {
    return ['preferredQuoteChannel', 'consentQuoteProcessing']
  }
  return []
}

function hasStepErrors(stepId: StepId, errors: ErrorMap): boolean {
  return getStepFieldKeys(stepId).some((field) => Boolean(errors[field]))
}

function getReviewValue(value: string | null | undefined, fallback = 'No indicado'): string {
  if (!value) return fallback
  return value
}

function formatBooleanLabel(value: boolean | null, positive: string, fallback = 'No indicado') {
  if (value === true) return positive
  if (value === false) return 'No'
  return fallback
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="cc-public-intake-field__error">{message}</p> : null
}

export function PublicQuoteRequestForm() {
  const [form, setForm] = useState<QuoteRequestNormalizedInput>(initialForm)
  const [startedAt] = useState(() => new Date().toISOString())
  const [website, setWebsite] = useState('')
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [errors, setErrors] = useState<ErrorMap>({})
  const [submitState, setSubmitState] = useState<{
    isSubmitting: boolean
    error: string | null
    success: PublicQuoteRequestSuccess | null
  }>({
    isSubmitting: false,
    error: null,
    success: null,
  })

  const currentStep = steps[currentStepIndex]
  const isSuccessStep = currentStep.id === 'success'
  const canGoBack = currentStepIndex > 0 && !isSuccessStep
  const isReviewStep = currentStep.id === 'review'

  function setField<K extends keyof QuoteRequestNormalizedInput>(
    field: K,
    value: QuoteRequestNormalizedInput[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setSubmitState((current) => ({ ...current, error: null, success: current.success }))
  }

  function setTextField(field: keyof QuoteRequestNormalizedInput, value: string) {
    if (field === 'fullName' || field === 'phone') {
      setField(field, value)
      return
    }

    setField(field, cleanText(value) as never)
  }

  function validateAndShowStep(stepId: StepId): boolean {
    const nextErrors = validateStep(stepId, form)
    setErrors((current) => ({ ...current, ...nextErrors }))
    return !hasStepErrors(stepId, nextErrors)
  }

  function handleNext() {
    if (isSuccessStep) return
    if (!validateAndShowStep(currentStep.id)) return
    setCurrentStepIndex((current) => Math.min(current + 1, steps.length - 1))
  }

  function handlePrevious() {
    if (isSuccessStep) return
    setCurrentStepIndex((current) => Math.max(current - 1, 0))
  }

  function handleStepSelect(stepIndex: number) {
    if (stepIndex === currentStepIndex) return
    const selectedStep = steps[stepIndex]
    if (selectedStep.id === 'success' && !submitState.success) return

    if (stepIndex > currentStepIndex && !validateAndShowStep(currentStep.id)) {
      return
    }

    setCurrentStepIndex(stepIndex)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationStepIds = steps
      .filter((step) => step.id !== 'success')
      .map((step) => step.id)

    const allErrors = validationStepIds.reduce<ErrorMap>((accumulator, stepId) => ({
      ...accumulator,
      ...validateStep(stepId, form),
    }), {})

    setErrors(allErrors)

    const firstInvalidStepIndex = validationStepIds.findIndex((stepId) => hasStepErrors(stepId, allErrors))
    if (firstInvalidStepIndex >= 0) {
      setCurrentStepIndex(firstInvalidStepIndex)
      return
    }

    const submissionInput = {
      ...form,
      submittedAt: new Date().toISOString(),
    }

    setSubmitState({ isSubmitting: true, error: null, success: null })

    try {
      const result = await submitPublicQuoteRequest(submissionInput, {
        startedAt,
        website,
      })
      setForm(submissionInput)
      setSubmitState({ isSubmitting: false, error: null, success: result })
      setCurrentStepIndex(stepIndexById.success)
    } catch (error) {
      setSubmitState({
        isSubmitting: false,
        error: error instanceof Error ? error.message : 'No se pudo enviar la solicitud.',
        success: null,
      })
    }
  }

  const reviewGroups = useMemo(() => ([
    {
      title: 'Contacto',
      items: [
        { label: 'Nombre', value: getReviewValue(form.fullName, 'Pendiente') },
        { label: 'Telefono', value: getReviewValue(form.phone, 'Pendiente') },
        { label: 'Correo', value: getReviewValue(form.email) },
      ],
    },
    {
      title: 'Servicio',
      items: [
        { label: 'Servicio', value: getReviewValue(form.serviceNeedLabel, 'Pendiente') },
        { label: 'Frecuencia', value: getReviewValue(form.serviceFrequencyLabel, 'Pendiente') },
      ],
    },
    {
      title: 'Propiedad',
      items: [
        { label: 'Tipo', value: getReviewValue(form.propertyType, 'Pendiente') },
        { label: 'Metros', value: getReviewValue(form.sqmBand, 'Pendiente') },
        { label: 'Habitaciones', value: getReviewValue(form.rooms) },
        { label: 'Banos', value: getReviewValue(form.bathrooms) },
        { label: 'Exterior', value: formatBooleanLabel(form.hasOutdoorAreas, 'Si') },
        { label: 'Mascotas', value: formatBooleanLabel(form.hasPets, 'Si') },
      ],
    },
    {
      title: 'Fecha y zona',
      items: [
        { label: 'Fecha deseada', value: getReviewValue(form.requestedServiceDate) },
        { label: 'Horario', value: getReviewValue(form.preferredTimeSlot, 'Flexible') },
        { label: 'Poblacion', value: getReviewValue(form.city, 'Pendiente') },
        { label: 'Codigo postal', value: getReviewValue(form.postalCode, 'Pendiente') },
        { label: 'Urgencia', value: getReviewValue(form.urgencyLabel, 'Sin urgencia concreta') },
      ],
    },
    {
      title: 'Detalles y canal',
      items: [
        { label: 'Notas', value: getReviewValue(form.scopeNotes) },
        { label: 'Problemas anteriores', value: getReviewValue(form.previousCleaningIssues) },
        { label: 'Canal preferido', value: form.preferredQuoteChannel === 'unknown' ? 'Pendiente' : form.preferredQuoteChannel },
        { label: 'Autorizacion', value: form.consentQuoteProcessing ? 'Confirmada' : 'Pendiente' },
      ],
    },
  ]), [form])

  const contextItems: FullscreenStepFlowContextItem[] = [
    { label: 'Canal', value: form.preferredQuoteChannel === 'unknown' ? 'Por definir' : form.preferredQuoteChannel },
    { label: 'Zona', value: getReviewValue(form.city, 'Pendiente') },
    { label: 'Servicio', value: getReviewValue(form.serviceNeedLabel, 'Pendiente') },
  ]

  const sideContent = isSuccessStep ? (
    <section className="cc-public-intake-summary-card cc-public-intake-summary-card--success">
      <span className="cc-public-intake-summary-card__eyebrow">Que ocurre ahora</span>
      <h3>Revision manual de Costa Clean</h3>
      <p>Revisaremos tu solicitud y prepararemos una propuesta sin enviar presupuestos, emails ni WhatsApps automaticamente.</p>
      <ul className="cc-public-intake-support-list">
        <li>Respuesta por el canal que has indicado.</li>
        <li>Confirmacion manual del alcance antes de emitir propuesta.</li>
        <li>Compatibilidad legacy y borradores preservados en el pipeline.</li>
      </ul>
    </section>
  ) : (
    <section className="cc-public-intake-summary-card">
      <span className="cc-public-intake-summary-card__eyebrow">Resumen rapido</span>
      <h3>{currentStep.title}</h3>
      <p>{currentStep.helper}</p>
      <ul className="cc-public-intake-support-list">
        <li>Sin envios automaticos.</li>
        <li>Presupuesto revisado manualmente.</li>
        <li>Todos los datos se conservan para lead draft y quote draft seed.</li>
      </ul>
    </section>
  )

  const stepStates = steps.map<StepFlowStatus>((step, index) => {
    if (step.id === 'success') {
      if (submitState.success) {
        return index === currentStepIndex ? 'current' : 'complete'
      }
      return 'pending'
    }

    const stepErrors = validateStep(step.id, form)
    const isComplete = index < currentStepIndex || submitState.success !== null

    if (index === currentStepIndex) {
      return Object.keys(stepErrors).length > 0 ? 'blocked' : 'current'
    }

    if (isComplete) {
      return Object.keys(stepErrors).length > 0 ? 'blocked' : 'complete'
    }

    return 'pending'
  })

  const footerContent = (
    <div className="cc-public-intake-footer">
      <div className="cc-public-intake-footer__meta">
        <span>{isSuccessStep ? 'Solicitud registrada' : `Paso ${currentStepIndex + 1} de ${steps.length}`}</span>
        <strong>{isSuccessStep ? 'Revision manual en curso' : currentStep.title}</strong>
      </div>

      <div className="cc-public-intake-actions">
        {!isSuccessStep ? (
          <button
            type="button"
            className="cc-public-intake-button cc-public-intake-button--secondary"
            onClick={handlePrevious}
            disabled={!canGoBack || submitState.isSubmitting}
          >
            Anterior
          </button>
        ) : null}

        {isReviewStep ? (
          <button
            type="submit"
            className="cc-public-intake-button cc-public-intake-button--primary"
            disabled={submitState.isSubmitting}
          >
            {submitState.isSubmitting ? 'Enviando...' : 'Confirmar y solicitar presupuesto'}
          </button>
        ) : isSuccessStep ? (
          <button
            type="button"
            className="cc-public-intake-button cc-public-intake-button--primary"
            onClick={() => {
              setForm(initialForm)
              setErrors({})
              setSubmitState({ isSubmitting: false, error: null, success: null })
              setWebsite('')
              setCurrentStepIndex(0)
            }}
          >
            Enviar otra solicitud
          </button>
        ) : (
          <button
            type="button"
            className="cc-public-intake-button cc-public-intake-button--primary"
            onClick={handleNext}
          >
            Continuar
          </button>
        )}
      </div>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} noValidate className="cc-public-intake-stepflow-form">
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
        }}
      >
        <label>
          Website
          <input
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
        </label>
      </div>

      <FullscreenStepFlow
        eyebrow="Presupuesto publico"
        title="Cuentanos que necesitas"
        description="Te guiaremos paso a paso para recoger solo lo necesario, revisar la solicitud y dejarla lista para revision manual."
        steps={steps.map((step) => ({
          id: step.id,
          label: step.label,
          description: step.description,
        }))}
        currentStep={currentStepIndex}
        stepStates={stepStates}
        onStepSelect={submitState.isSubmitting ? undefined : handleStepSelect}
        contextItems={contextItems}
        sideContent={sideContent}
        footerContent={footerContent}
      >
        <section className="cc-public-intake-step-card" aria-label={currentStep.title}>
          <div className="cc-public-intake-step-heading cc-public-intake-step-heading--flow">
            <p>{currentStep.label}</p>
            <h2>{currentStep.title}</h2>
            <span>{currentStep.helper}</span>
          </div>

          {submitState.error && !isSuccessStep ? (
            <div className="cc-public-intake-error" role="alert">
              <strong>No se pudo enviar la solicitud</strong>
              <p>{submitState.error}</p>
            </div>
          ) : null}

          {currentStep.id === 'contact' ? (
            <div className="cc-public-intake-fields">
              <label className={errors.fullName ? 'cc-public-intake-field has-error' : 'cc-public-intake-field'}>
                <span>Nombre completo *</span>
                <input
                  value={form.fullName}
                  onChange={(event) => setField('fullName', event.target.value)}
                  autoComplete="name"
                  placeholder="Tu nombre"
                  aria-invalid={Boolean(errors.fullName)}
                />
                <FieldError message={errors.fullName} />
              </label>

              <label className={errors.phone ? 'cc-public-intake-field has-error' : 'cc-public-intake-field'}>
                <span>Telefono con prefijo *</span>
                <input
                  value={form.phone}
                  onChange={(event) => setField('phone', event.target.value)}
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="+34 600 000 000"
                  aria-invalid={Boolean(errors.phone)}
                />
                <FieldError message={errors.phone} />
              </label>

              <label className={errors.email ? 'cc-public-intake-field has-error' : 'cc-public-intake-field'}>
                <span>Correo electronico</span>
                <input
                  value={form.email ?? ''}
                  onChange={(event) => setTextField('email', event.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  placeholder="nombre@correo.com"
                  aria-invalid={Boolean(errors.email)}
                />
                <FieldError message={errors.email} />
              </label>
            </div>
          ) : null}

          {currentStep.id === 'service' ? (
            <div className="cc-public-intake-fields">
              <label className={errors.serviceNeedLabel ? 'cc-public-intake-field has-error' : 'cc-public-intake-field'}>
                <span>Que tipo de servicio necesitas? *</span>
                <select
                  value={form.serviceNeedLabel ?? ''}
                  onChange={(event) => setTextField('serviceNeedLabel', event.target.value)}
                  aria-invalid={Boolean(errors.serviceNeedLabel)}
                >
                  <option value="">Selecciona una opcion</option>
                  <option>Limpieza puntual</option>
                  <option>Limpieza profunda</option>
                  <option>Limpieza turistica</option>
                  <option>Limpieza de oficina</option>
                  <option>Otro servicio</option>
                </select>
                <FieldError message={errors.serviceNeedLabel} />
              </label>

              <label className={errors.serviceFrequencyLabel ? 'cc-public-intake-field has-error' : 'cc-public-intake-field'}>
                <span>Frecuencia del servicio *</span>
                <select
                  value={form.serviceFrequencyLabel ?? ''}
                  onChange={(event) => setTextField('serviceFrequencyLabel', event.target.value)}
                  aria-invalid={Boolean(errors.serviceFrequencyLabel)}
                >
                  <option value="">Selecciona una opcion</option>
                  <option>Una sola vez</option>
                  <option>Semanal</option>
                  <option>Quincenal</option>
                  <option>Mensual</option>
                  <option>Temporada vacacional</option>
                </select>
                <FieldError message={errors.serviceFrequencyLabel} />
              </label>
            </div>
          ) : null}

          {currentStep.id === 'property' ? (
            <div className="cc-public-intake-fields">
              <label className={errors.propertyType ? 'cc-public-intake-field has-error' : 'cc-public-intake-field'}>
                <span>Tipo de propiedad *</span>
                <select
                  value={form.propertyType ?? ''}
                  onChange={(event) => setTextField('propertyType', event.target.value)}
                  aria-invalid={Boolean(errors.propertyType)}
                >
                  <option value="">Selecciona una opcion</option>
                  <option>Piso</option>
                  <option>Casa</option>
                  <option>Villa</option>
                  <option>Oficina</option>
                  <option>Local</option>
                  <option>Alojamiento turistico</option>
                </select>
                <FieldError message={errors.propertyType} />
              </label>

              <label className={errors.sqmBand ? 'cc-public-intake-field has-error' : 'cc-public-intake-field'}>
                <span>Metros cuadrados aproximados *</span>
                <select
                  value={form.sqmBand ?? ''}
                  onChange={(event) => setTextField('sqmBand', event.target.value)}
                  aria-invalid={Boolean(errors.sqmBand)}
                >
                  <option value="">Selecciona una franja</option>
                  <option>Menos de 50 m2</option>
                  <option>50-80 m2</option>
                  <option>80-120 m2</option>
                  <option>120-180 m2</option>
                  <option>Mas de 180 m2</option>
                </select>
                <FieldError message={errors.sqmBand} />
              </label>

              <div className="cc-public-intake-field-row">
                <label className="cc-public-intake-field">
                  <span>Habitaciones</span>
                  <input
                    value={form.rooms ?? ''}
                    onChange={(event) => setTextField('rooms', event.target.value)}
                    inputMode="numeric"
                    placeholder="3"
                  />
                </label>

                <label className="cc-public-intake-field">
                  <span>Banos</span>
                  <input
                    value={form.bathrooms ?? ''}
                    onChange={(event) => setTextField('bathrooms', event.target.value)}
                    inputMode="numeric"
                    placeholder="2"
                  />
                </label>
              </div>

              <div className="cc-public-intake-toggle-grid">
                <button
                  type="button"
                  className={form.hasOutdoorAreas === true ? 'cc-public-intake-choice is-selected' : 'cc-public-intake-choice'}
                  onClick={() => setField('hasOutdoorAreas', form.hasOutdoorAreas === true ? null : true)}
                >
                  Terraza o exterior
                </button>
                <button
                  type="button"
                  className={form.hasPets === true ? 'cc-public-intake-choice is-selected' : 'cc-public-intake-choice'}
                  onClick={() => setField('hasPets', form.hasPets === true ? null : true)}
                >
                  Hay mascotas
                </button>
              </div>
            </div>
          ) : null}

          {currentStep.id === 'schedule' ? (
            <div className="cc-public-intake-fields">
              <label className="cc-public-intake-field">
                <span>Fecha deseada</span>
                <input
                  value={form.requestedServiceDate ?? ''}
                  onChange={(event) => setTextField('requestedServiceDate', event.target.value)}
                  type="date"
                />
              </label>

              <label className="cc-public-intake-field">
                <span>Horario preferido</span>
                <select
                  value={form.preferredTimeSlot ?? ''}
                  onChange={(event) => setTextField('preferredTimeSlot', event.target.value)}
                >
                  <option value="">Flexible</option>
                  <option>Manana</option>
                  <option>Mediodia</option>
                  <option>Tarde</option>
                </select>
              </label>

              <div className="cc-public-intake-field-row">
                <label className={errors.postalCode ? 'cc-public-intake-field has-error' : 'cc-public-intake-field'}>
                  <span>Codigo postal *</span>
                  <input
                    value={form.postalCode ?? ''}
                    onChange={(event) => setTextField('postalCode', event.target.value)}
                    autoComplete="postal-code"
                    inputMode="numeric"
                    placeholder="29640"
                    aria-invalid={Boolean(errors.postalCode)}
                  />
                  <FieldError message={errors.postalCode} />
                </label>

                <label className={errors.city ? 'cc-public-intake-field has-error' : 'cc-public-intake-field'}>
                  <span>Poblacion *</span>
                  <input
                    value={form.city ?? ''}
                    onChange={(event) => setTextField('city', event.target.value)}
                    autoComplete="address-level2"
                    placeholder="Fuengirola"
                    aria-invalid={Boolean(errors.city)}
                  />
                  <FieldError message={errors.city} />
                </label>
              </div>

              <label className="cc-public-intake-field">
                <span>Cuando necesitas el servicio?</span>
                <select
                  value={form.urgencyLabel ?? ''}
                  onChange={(event) => setTextField('urgencyLabel', event.target.value)}
                >
                  <option value="">Sin urgencia concreta</option>
                  <option>Lo antes posible</option>
                  <option>Esta semana</option>
                  <option>Este mes</option>
                  <option>Estoy planificando con antelacion</option>
                </select>
              </label>
            </div>
          ) : null}

          {currentStep.id === 'details' ? (
            <div className="cc-public-intake-fields">
              <label className="cc-public-intake-field">
                <span>Cuentanos brevemente que necesitas</span>
                <textarea
                  value={form.scopeNotes ?? ''}
                  onChange={(event) => setTextField('scopeNotes', event.target.value)}
                  placeholder="Ej. limpieza profunda antes de entrar, cristales, cocina, banos..."
                  rows={5}
                />
              </label>

              <label className="cc-public-intake-field">
                <span>Problemas anteriores con servicios de limpieza</span>
                <textarea
                  value={form.previousCleaningIssues ?? ''}
                  onChange={(event) => setTextField('previousCleaningIssues', event.target.value)}
                  placeholder="Opcional"
                  rows={4}
                />
              </label>

              <fieldset className={errors.preferredQuoteChannel ? 'cc-public-intake-fieldset has-error' : 'cc-public-intake-fieldset'}>
                <legend>Como prefieres recibir tu presupuesto? *</legend>
                <div className="cc-public-intake-choice-group">
                  {channelOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={form.preferredQuoteChannel === option.value ? 'cc-public-intake-choice is-selected' : 'cc-public-intake-choice'}
                      onClick={() => setField('preferredQuoteChannel', option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <FieldError message={errors.preferredQuoteChannel} />
              </fieldset>

              <label className={errors.consentQuoteProcessing ? 'cc-public-intake-consent has-error' : 'cc-public-intake-consent'}>
                <input
                  type="checkbox"
                  checked={form.consentQuoteProcessing}
                  onChange={(event) => setField('consentQuoteProcessing', event.target.checked)}
                  aria-invalid={Boolean(errors.consentQuoteProcessing)}
                />
                <span>
                  Autorizo a Costa Clean a usar esta informacion solo para preparar y responder mi presupuesto.
                </span>
              </label>
              <FieldError message={errors.consentQuoteProcessing} />
            </div>
          ) : null}

          {currentStep.id === 'review' ? (
            <div className="cc-public-intake-review">
              {submitState.error ? (
                <div className="cc-public-intake-error" role="alert">
                  <strong>No se pudo enviar la solicitud</strong>
                  <p>{submitState.error}</p>
                </div>
              ) : null}

              <div className="cc-public-intake-review-note">
                <strong>Revision obligatoria antes de enviar</strong>
                <p>Confirmaras estos datos y luego Costa Clean revisara manualmente la solicitud antes de responder.</p>
              </div>

              {reviewGroups.map((group) => (
                <section key={group.title} className="cc-public-intake-review-group">
                  <div className="cc-public-intake-review-group__header">
                    <h3>{group.title}</h3>
                  </div>
                  <div className="cc-public-intake-review-grid">
                    {group.items.map((item) => (
                      <article key={`${group.title}-${item.label}`} className="cc-public-intake-review-item">
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : null}

          {currentStep.id === 'success' ? (
            <div className="cc-public-intake-success" role="status">
              <strong>Solicitud recibida</strong>
              <p>{submitState.success?.message ?? 'Hemos registrado tu solicitud para revision manual.'}</p>
              <div className="cc-public-intake-success__meta">
                <article>
                  <span>Canal de contacto</span>
                  <strong>{form.preferredQuoteChannel === 'unknown' ? 'Por revisar' : form.preferredQuoteChannel}</strong>
                </article>
                <article>
                  <span>Referencia</span>
                  <strong>{submitState.success?.leadDraftId ?? 'Pendiente'}</strong>
                </article>
                <article>
                  <span>Que ocurre ahora</span>
                  <strong>Revision manual y respuesta posterior</strong>
                </article>
              </div>
              <p className="cc-public-intake-success__next">
                Revisaremos alcance, zona y disponibilidad. La respuesta llegara por el canal que has indicado.
              </p>
            </div>
          ) : null}
        </section>
      </FullscreenStepFlow>
    </form>
  )
}
