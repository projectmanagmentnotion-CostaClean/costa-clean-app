import { useState, type FormEvent } from 'react'
import { submitPublicQuoteRequest, type PublicQuoteRequestSuccess } from './publicQuoteRequestApi'
import type { PreferredQuoteChannel, QuoteRequestNormalizedInput } from './types'

type StepId = 'contact' | 'service' | 'property' | 'dateLocation' | 'details' | 'consent'

type ErrorMap = Partial<Record<keyof QuoteRequestNormalizedInput, string>>

interface StepConfig {
  id: StepId
  label: string
  title: string
  helper: string
}

const steps: StepConfig[] = [
  {
    id: 'contact',
    label: 'Contacto',
    title: 'Datos de contacto',
    helper: 'Solo lo imprescindible para poder responderte.',
  },
  {
    id: 'service',
    label: 'Servicio',
    title: 'Tipo de limpieza',
    helper: 'Ayúdanos a entender el servicio que estás buscando.',
  },
  {
    id: 'property',
    label: 'Propiedad',
    title: 'Tamaño y características',
    helper: 'Una estimación es suficiente para preparar el presupuesto.',
  },
  {
    id: 'dateLocation',
    label: 'Fecha y zona',
    title: 'Cuándo y dónde',
    helper: 'Nos ayuda a valorar disponibilidad y desplazamiento.',
  },
  {
    id: 'details',
    label: 'Detalles',
    title: 'Notas importantes',
    helper: 'Cuanto más contexto tengamos, más precisa será la propuesta.',
  },
  {
    id: 'consent',
    label: 'Consentimiento',
    title: 'Preferencias finales',
    helper: 'Confirma cómo quieres recibir el presupuesto.',
  },
]

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
  { value: 'email', label: 'Correo electrónico' },
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
    if (!form.phone.trim()) errors.phone = 'Indica un teléfono con prefijo.'
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

  if (stepId === 'dateLocation') {
    if (!form.city) errors.city = 'Indica la población.'
    if (!form.postalCode) errors.postalCode = 'Indica el código postal.'
  }

  if (stepId === 'consent') {
    if (form.preferredQuoteChannel === 'unknown') {
      errors.preferredQuoteChannel = 'Selecciona cómo prefieres recibir el presupuesto.'
    }

    if (!form.consentQuoteProcessing) {
      errors.consentQuoteProcessing = 'Necesitamos tu autorización para preparar el presupuesto.'
    }
  }

  return errors
}

function getStepFieldKeys(stepId: StepId): Array<keyof QuoteRequestNormalizedInput> {
  if (stepId === 'contact') return ['fullName', 'phone', 'email']
  if (stepId === 'service') return ['serviceNeedLabel', 'serviceFrequencyLabel']
  if (stepId === 'property') return ['propertyType', 'sqmBand', 'rooms', 'bathrooms', 'hasOutdoorAreas', 'hasPets']
  if (stepId === 'dateLocation') return ['requestedServiceDate', 'preferredTimeSlot', 'city', 'postalCode', 'urgencyLabel']
  if (stepId === 'details') return ['scopeNotes', 'previousCleaningIssues']
  return ['preferredQuoteChannel', 'consentQuoteProcessing']
}

function hasStepErrors(stepId: StepId, errors: ErrorMap): boolean {
  return getStepFieldKeys(stepId).some((field) => Boolean(errors[field]))
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="cc-public-intake-field__error">{message}</p> : null
}

export function PublicQuoteRequestForm() {
  const [form, setForm] = useState<QuoteRequestNormalizedInput>(initialForm)
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
  const progressPercent = Math.round(((currentStepIndex + 1) / steps.length) * 100)

  const canGoBack = currentStepIndex > 0
  const isFinalStep = currentStepIndex === steps.length - 1

  function setField<K extends keyof QuoteRequestNormalizedInput>(
    field: K,
    value: QuoteRequestNormalizedInput[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setSubmitState((current) => ({ ...current, error: null, success: null }))
  }

  function setTextField(field: keyof QuoteRequestNormalizedInput, value: string) {
    if (field === 'fullName' || field === 'phone') {
      setField(field, value)
      return
    }

    setField(field, cleanText(value) as never)
  }

  function validateAndShowCurrentStep(): boolean {
    const nextErrors = validateStep(currentStep.id, form)
    setErrors((current) => ({ ...current, ...nextErrors }))
    return !hasStepErrors(currentStep.id, nextErrors)
  }

  function handleNext() {
    if (!validateAndShowCurrentStep()) return
    setCurrentStepIndex((current) => Math.min(current + 1, steps.length - 1))
  }

  function handlePrevious() {
    setCurrentStepIndex((current) => Math.max(current - 1, 0))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const allErrors = steps.reduce<ErrorMap>((accumulator, step) => ({
      ...accumulator,
      ...validateStep(step.id, form),
    }), {})

    setErrors(allErrors)

    const firstInvalidStepIndex = steps.findIndex((step) => hasStepErrors(step.id, allErrors))
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
      const result = await submitPublicQuoteRequest(submissionInput)
      setForm(submissionInput)
      setSubmitState({ isSubmitting: false, error: null, success: result })
    } catch (error) {
      setSubmitState({
        isSubmitting: false,
        error: error instanceof Error ? error.message : 'No se pudo enviar la solicitud.',
        success: null,
      })
    }
  }

  return (
    <section className="cc-public-intake-panel" aria-label="Solicitud de presupuesto">
      <div className="cc-public-intake-progress" aria-label={`Paso ${currentStepIndex + 1} de ${steps.length}`}>
        <div className="cc-public-intake-progress__top">
          <span>{currentStep.label}</span>
          <strong>{currentStepIndex + 1}/{steps.length}</strong>
        </div>
        <div className="cc-public-intake-progress__track">
          <span style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <ol className="cc-public-intake-steps" aria-label="Progreso del formulario">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className={index === currentStepIndex ? 'is-active' : index < currentStepIndex ? 'is-done' : ''}
          >
            <span>{index + 1}</span>
            {step.label}
          </li>
        ))}
      </ol>

      <form onSubmit={handleSubmit} noValidate>
        <div className="cc-public-intake-step-heading">
          <p>{currentStep.label}</p>
          <h2>{currentStep.title}</h2>
          <span>{currentStep.helper}</span>
        </div>

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
              <span>Teléfono con prefijo *</span>
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
              <span>Correo electrónico</span>
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
              <span>¿Qué tipo de servicio necesitas? *</span>
              <select
                value={form.serviceNeedLabel ?? ''}
                onChange={(event) => setTextField('serviceNeedLabel', event.target.value)}
                aria-invalid={Boolean(errors.serviceNeedLabel)}
              >
                <option value="">Selecciona una opción</option>
                <option>Limpieza puntual</option>
                <option>Limpieza profunda</option>
                <option>Limpieza turística</option>
                <option>Limpieza de oficina</option>
                <option>Otro servicio</option>
              </select>
              <FieldError message={errors.serviceNeedLabel} />
            </label>

            <label className={errors.serviceFrequencyLabel ? 'cc-public-intake-field has-error' : 'cc-public-intake-field'}>
              <span>Tipo de servicio *</span>
              <select
                value={form.serviceFrequencyLabel ?? ''}
                onChange={(event) => setTextField('serviceFrequencyLabel', event.target.value)}
                aria-invalid={Boolean(errors.serviceFrequencyLabel)}
              >
                <option value="">Selecciona una opción</option>
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
                <option value="">Selecciona una opción</option>
                <option>Piso</option>
                <option>Casa</option>
                <option>Villa</option>
                <option>Oficina</option>
                <option>Local</option>
                <option>Alojamiento turístico</option>
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
                <option>Más de 180 m2</option>
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
                <span>Baños</span>
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

        {currentStep.id === 'dateLocation' ? (
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
                <option>Mañana</option>
                <option>Mediodía</option>
                <option>Tarde</option>
              </select>
            </label>

            <div className="cc-public-intake-field-row">
              <label className={errors.postalCode ? 'cc-public-intake-field has-error' : 'cc-public-intake-field'}>
                <span>Código postal *</span>
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
                <span>Población *</span>
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
              <span>¿Cuándo necesitas el servicio?</span>
              <select
                value={form.urgencyLabel ?? ''}
                onChange={(event) => setTextField('urgencyLabel', event.target.value)}
              >
                <option value="">Sin urgencia concreta</option>
                <option>Lo antes posible</option>
                <option>Esta semana</option>
                <option>Este mes</option>
                <option>Estoy planificando con antelación</option>
              </select>
            </label>
          </div>
        ) : null}

        {currentStep.id === 'details' ? (
          <div className="cc-public-intake-fields">
            <label className="cc-public-intake-field">
              <span>Cuéntanos brevemente qué necesitas</span>
              <textarea
                value={form.scopeNotes ?? ''}
                onChange={(event) => setTextField('scopeNotes', event.target.value)}
                placeholder="Ej. limpieza profunda antes de entrar, cristales, cocina, baños..."
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
          </div>
        ) : null}

        {currentStep.id === 'consent' ? (
          <div className="cc-public-intake-fields">
            <fieldset className={errors.preferredQuoteChannel ? 'cc-public-intake-fieldset has-error' : 'cc-public-intake-fieldset'}>
              <legend>¿Cómo prefieres recibir tu presupuesto? *</legend>
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
                Autorizo a CostaClean a usar esta información solo para preparar y responder mi presupuesto.
              </span>
            </label>
            <FieldError message={errors.consentQuoteProcessing} />

            {submitState.success ? (
              <div className="cc-public-intake-success" role="status">
                <strong>Solicitud recibida</strong>
                <p>{submitState.success.message}</p>
                <p>Referencia: {submitState.success.leadDraftId}</p>
              </div>
            ) : null}

            {submitState.error ? (
              <div className="cc-public-intake-error" role="alert">
                <strong>No se pudo enviar la solicitud</strong>
                <p>{submitState.error}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="cc-public-intake-actions">
          <button
            type="button"
            className="cc-public-intake-button cc-public-intake-button--secondary"
            onClick={handlePrevious}
            disabled={!canGoBack}
          >
            Anterior
          </button>

          {isFinalStep ? (
            <button
              type="submit"
              className="cc-public-intake-button cc-public-intake-button--primary"
              disabled={submitState.isSubmitting}
            >
              {submitState.isSubmitting ? 'Enviando...' : 'Solicitar presupuesto'}
            </button>
          ) : (
            <button
              type="button"
              className="cc-public-intake-button cc-public-intake-button--primary"
              onClick={handleNext}
            >
              Siguiente
            </button>
          )}
        </div>
      </form>
    </section>
  )
}
