import { useEffect, useState, type FormEvent } from 'react'
import { getStatusLabel } from '../../app/displayText'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { FullscreenStepFlow } from '../../components/FullscreenStepFlow'
import { DSSmartLocationFields } from '../../design-system/components'
import { findClientDuplicateGroups } from '../duplicates/duplicateEngine'
import { DuplicateReviewOverlay } from '../duplicates/DuplicateReviewOverlay'
import { createClientRecord } from './clientWriteApi'
import type { ClientListItem } from './types'
import './client-create-form.css'

interface ClientCreateFormProps {
  onCreated: () => Promise<void>
  onCreatedClient?: (client: ClientListItem) => void | Promise<void>
  onCancel?: () => void
  onDirtyChange?: (isDirty: boolean) => void
  title?: string
  description?: string
  submitLabel?: string
  existingClients?: ClientListItem[]
  onOpenExistingClient?: (clientId: string) => void
}

interface FormState {
  full_name: string
  phone: string
  email: string
  tax_id: string
  billing_address: string
  status: string
}

interface BillingLocationDraft {
  postalCode: string
  city: string
  province: string
}

const initialFormState: FormState = {
  full_name: '',
  phone: '',
  email: '',
  tax_id: '',
  billing_address: '',
  status: 'active',
}

const initialBillingLocationDraft: BillingLocationDraft = {
  postalCode: '',
  city: '',
  province: '',
}

function composeBillingAddress(addressLine: string, location: BillingLocationDraft) {
  const locationLine = [location.postalCode.trim(), location.city.trim()].filter(Boolean).join(' ')
  return [addressLine.trim(), locationLine, location.province.trim()].filter(Boolean).join(', ')
}

export function ClientCreateForm({
  onCreated,
  onCreatedClient,
  onCancel,
  onDirtyChange,
  title = 'Nuevo cliente',
  description,
  submitLabel = 'Guardar cliente',
  existingClients = [],
  onOpenExistingClient,
}: ClientCreateFormProps) {
  const [form, setForm] = useState<FormState>(initialFormState)
  const [billingAddressLine, setBillingAddressLine] = useState('')
  const [billingLocation, setBillingLocation] = useState<BillingLocationDraft>(initialBillingLocationDraft)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [pendingDuplicateGroups, setPendingDuplicateGroups] = useState<ReturnType<typeof findClientDuplicateGroups>>([])
  const [currentStep, setCurrentStep] = useState(0)
  const steps = [
    { id: 'identity', label: 'Identidad', description: 'Nombre y estado base' },
    { id: 'contact', label: 'Contacto', description: 'Telefono, email y fiscal' },
    { id: 'billing', label: 'Direccion', description: 'Contexto de facturacion' },
  ] as const

  useEffect(() => {
    onDirtyChange?.(isDirty)
    return () => onDirtyChange?.(false)
  }, [isDirty, onDirtyChange])

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setIsDirty(true)
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function updateBillingAddress(nextAddressLine: string, nextLocation: BillingLocationDraft) {
    setIsDirty(true)
    setBillingAddressLine(nextAddressLine)
    setBillingLocation(nextLocation)
    setForm((current) => ({
      ...current,
      billing_address: composeBillingAddress(nextAddressLine, nextLocation),
    }))
  }

  async function submitClient(skipDuplicateReview = false) {
    setSubmitError(null)
    setSuccessMessage(null)
    setIsSubmitting(true)

    try {
      if (!skipDuplicateReview) {
        const duplicateGroups = findClientDuplicateGroups({
          id: 'CLIENT-DRAFT',
          full_name: form.full_name.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          tax_id: form.tax_id.trim() || null,
          billing_address: form.billing_address.trim() || null,
          status: form.status,
          source_lead_id: null,
        }, existingClients)

        if (duplicateGroups.length > 0) {
          setPendingDuplicateGroups(duplicateGroups)
          return
        }
      }

      const createdClient = await createClientRecord({
        full_name: form.full_name,
        phone: form.phone,
        email: form.email,
        tax_id: form.tax_id,
        billing_address: form.billing_address,
        status: form.status,
        source_lead_id: null,
      })

      await onCreated()
      await onCreatedClient?.(createdClient)
      setForm(initialFormState)
      setBillingAddressLine('')
      setBillingLocation(initialBillingLocationDraft)
      setIsDirty(false)
      setCurrentStep(0)
      setSuccessMessage('Cliente creado.')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido creando el cliente.'

      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (currentStep < steps.length - 1) {
      setCurrentStep((value) => Math.min(value + 1, steps.length - 1))
      return
    }

    await submitClient()
  }

  function requestCancel() {
    if (!onCancel) return
    if (!isDirty) {
      onCancel()
      return
    }

    setShowCancelConfirm(true)
  }

  const stepStates = steps.map((_, index) => (
    index < currentStep ? 'complete' : index === currentStep ? 'current' : 'pending'
  )) as Array<'complete' | 'current' | 'pending'>

  const footerContent = (
    <div className="cc-client-create-form__footer">
      {onCancel ? (
        <button type="button" className="secondary-button" onClick={requestCancel} disabled={isSubmitting}>
          Cancelar
        </button>
      ) : null}

      {currentStep > 0 ? (
        <button
          type="button"
          className="secondary-button"
          onClick={() => setCurrentStep((value) => Math.max(value - 1, 0))}
          disabled={isSubmitting}
        >
          Atrás
        </button>
      ) : null}

      {currentStep < steps.length - 1 ? (
        <button
          type="button"
          className="primary-button"
          onClick={() => setCurrentStep((value) => Math.min(value + 1, steps.length - 1))}
          disabled={isSubmitting}
        >
          Continuar
        </button>
      ) : (
        <button type="button" className="primary-button" onClick={() => void submitClient()} disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : submitLabel}
        </button>
      )}
    </div>
  )

  return (
    <FullscreenStepFlow
      eyebrow="Cliente"
      title={title}
      description={description ?? 'Alta guiada para identificar, contactar y cerrar la ficha fiscal sin perder contexto.'}
      steps={steps.map((step) => ({
        id: step.id,
        label: step.label,
        description: step.description,
      }))}
      currentStep={currentStep}
      stepStates={stepStates}
      onStepSelect={setCurrentStep}
      contextItems={[
        {
          label: 'Nombre',
          value: form.full_name.trim() || 'Pendiente',
          hint: 'Identidad principal del cliente',
        },
        {
          label: 'Estado',
          value: getStatusLabel(form.status),
          hint: 'Se preserva el mismo contrato de escritura',
        },
      ]}
      sideContent={(
        <div className="cc-client-create-form__review">
          <span>Revision</span>
          <strong>{form.full_name.trim() || 'Nuevo cliente'}</strong>
          <small>{billingAddressLine.trim() || 'Sin direccion fiscal aun'}</small>
        </div>
      )}
      footerContent={footerContent}
    >
      <form className="lead-form cc-client-create-form__flow" onSubmit={handleSubmit}>
        {currentStep === 0 ? (
          <section className="cc-client-create-form__step">
            <label className="form-field">
              <span>Nombre completo *</span>
              <input
                value={form.full_name}
                onChange={(event) => updateField('full_name', event.target.value)}
                placeholder="Ej. Marta Lopez"
                required
              />
            </label>

            <label className="form-field">
              <span>Estado</span>
              <select
                value={form.status}
                onChange={(event) => updateField('status', event.target.value)}
              >
                <option value="active">{getStatusLabel('active')}</option>
                <option value="inactive">{getStatusLabel('inactive')}</option>
              </select>
            </label>
          </section>
        ) : null}

        {currentStep === 1 ? (
          <section className="cc-client-create-form__step">
            <label className="form-field">
              <span>Telefono</span>
              <input
                value={form.phone}
                onChange={(event) => updateField('phone', event.target.value)}
                placeholder="Ej. 600123123"
              />
            </label>

            <label className="form-field">
              <span>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                placeholder="Ej. cliente@email.com"
              />
            </label>

            <label className="form-field">
              <span>DNI/NIF/CIF</span>
              <input
                value={form.tax_id}
                onChange={(event) => updateField('tax_id', event.target.value)}
                placeholder="Ej. B12345678"
              />
            </label>
          </section>
        ) : null}

        {currentStep === 2 ? (
          <section className="cc-client-create-form__step">
            <label className="form-field form-field-full">
              <span>Direccion fiscal</span>
              <textarea
                value={billingAddressLine}
                onChange={(event) => updateBillingAddress(event.target.value, billingLocation)}
                placeholder="Calle, numero y puerta fiscal"
                rows={2}
              />
            </label>

            <div className="form-field form-field-full">
              <DSSmartLocationFields
                postalCodeValue={billingLocation.postalCode}
                cityValue={billingLocation.city}
                provinceValue={billingLocation.province}
                onPostalCodeChange={(value) => updateBillingAddress(billingAddressLine, { ...billingLocation, postalCode: value })}
                onCityChange={(value) => updateBillingAddress(billingAddressLine, { ...billingLocation, city: value })}
                onProvinceChange={(value) => updateBillingAddress(billingAddressLine, { ...billingLocation, province: value })}
                showProvinceField
                cityHint="Ciudad fiscal sugerida o escrita."
                postalCodeHint="Sugerencia local y opcional."
              />
            </div>
          </section>
        ) : null}

        {submitError ? (
          <div className="empty-state">
            <strong>No se pudo crear el cliente</strong>
            <p>{submitError}</p>
          </div>
        ) : null}

        {successMessage ? (
          <div className="empty-state">
            <strong>Operacion correcta</strong>
            <p>{successMessage}</p>
          </div>
        ) : null}
      </form>

      <ConfirmDialog
        isOpen={showCancelConfirm}
        title="Descartar cliente en curso"
        description="Si cierras ahora, perderas los cambios no guardados."
        confirmLabel="Descartar cambios"
        tone="warning"
        onCancel={() => setShowCancelConfirm(false)}
        onConfirm={() => {
          setShowCancelConfirm(false)
          onCancel?.()
        }}
      />

      <DuplicateReviewOverlay
        isOpen={pendingDuplicateGroups.length > 0}
        title="Posible cliente duplicado"
        description="Antes de crear otra ficha, revisa si ya existe un cliente que puedas reutilizar."
        groups={pendingDuplicateGroups}
        onClose={() => setPendingDuplicateGroups([])}
        onOpenRecord={onOpenExistingClient ? (clientId) => {
          setPendingDuplicateGroups([])
          onOpenExistingClient(clientId)
        } : undefined}
        onUseRecord={onOpenExistingClient ? (clientId) => {
          setPendingDuplicateGroups([])
          onOpenExistingClient(clientId)
        } : undefined}
        onContinueAnyway={() => {
          setPendingDuplicateGroups([])
          void submitClient(true)
        }}
      />
    </FullscreenStepFlow>
  )
}
