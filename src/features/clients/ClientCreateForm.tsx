import { useEffect, useState, type FormEvent } from 'react'
import { getStatusLabel } from '../../app/displayText'
import { ConfirmDialog } from '../../components/ConfirmDialog'
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

  return (
    <section className="data-section cc-client-create-form">
      <div className="section-header">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>

      <form className="lead-form" onSubmit={handleSubmit}>
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

        <div className="form-actions">
          {onCancel ? (
            <button type="button" className="secondary-button" onClick={requestCancel}>
              Cancelar
            </button>
          ) : null}
          <button type="submit" className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : submitLabel}
          </button>
        </div>

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
    </section>
  )
}
