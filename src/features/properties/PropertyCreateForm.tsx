import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { formatClientLabel } from '../../app/relationshipLabels'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ContextualCreateSection } from '../../components/ContextualCreateSection'
import { FullscreenStepFlow } from '../../components/FullscreenStepFlow'
import { fetchAuthenticatedSupabaseWrite, readSingleAuthenticatedWriteRow } from '../../lib/authenticatedSupabaseWrite'
import { operationalWriteRpcPaths } from '../../lib/operationalWriteRpc'
import { ClientCreateForm } from '../clients/ClientCreateForm'
import { DuplicateReviewOverlay } from '../duplicates/DuplicateReviewOverlay'
import { findPropertyDuplicateGroups } from '../duplicates/duplicateEngine'
import type { PropertyListItem } from './types'
import type { ClientListItem } from '../clients/types'
import './property-create-form.css'

interface PropertyCreateFormProps {
  clients: ClientListItem[]
  properties?: PropertyListItem[]
  onCreated: () => Promise<void>
  contextClientId?: string | null
  onCreatedProperty?: (property: PropertyListItem) => void | Promise<void>
  onOpenExistingProperty?: (propertyId: string) => void
  onCancel?: () => void
  onDirtyChange?: (isDirty: boolean) => void
  title?: string
  description?: string
  submitLabel?: string
}

interface FormState {
  client_id: string
  name: string
  property_type: string
  address: string
  city: string
  postal_code: string
  notes: string
}

function getPropertyTypeLabel(value: string): string {
  switch (value) {
    case 'apartment': return 'Apartamento'
    case 'house': return 'Casa'
    case 'office': return 'Oficina'
    case 'local': return 'Local'
    case 'tourist_apartment': return 'Piso turístico'
    case 'community': return 'Comunidad'
    case 'construction_site': return 'Obra'
    default: return value
  }
}

export function PropertyCreateForm({
  clients,
  properties = [],
  onCreated,
  contextClientId = null,
  onCreatedProperty,
  onOpenExistingProperty,
  onCancel,
  onDirtyChange,
  title = 'Nueva Propiedad',
  description,
  submitLabel = 'Guardar propiedad',
}: PropertyCreateFormProps) {
  const contextualClient = useMemo(
    () => (contextClientId ? clients.find((client) => client.id === contextClientId) ?? null : null),
    [clients, contextClientId],
  )
  const [form, setForm] = useState<FormState>({
    client_id: contextClientId ?? '',
    name: '',
    property_type: 'apartment',
    address: '',
    city: '',
    postal_code: '',
    notes: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showClientCreate, setShowClientCreate] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [pendingDuplicateGroups, setPendingDuplicateGroups] = useState<ReturnType<typeof findPropertyDuplicateGroups>>([])
  const [currentStep, setCurrentStep] = useState(0)
  const steps = [
    { id: 'base', label: 'Base', description: 'Cliente y titularidad' },
    { id: 'operations', label: 'Datos operativos', description: 'Identidad y localizacion' },
    { id: 'review', label: 'Revision', description: 'Comprobacion final' },
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

  async function submitProperty(skipDuplicateReview = false) {
    setSubmitError(null)
    setSuccessMessage(null)
    setIsSubmitting(true)

    try {
      if (!form.client_id) {
        setSubmitError('Debes seleccionar un cliente.')
        return
      }

      if (!skipDuplicateReview) {
        const duplicateGroups = findPropertyDuplicateGroups({
          id: 'PROPERTY-DRAFT',
          display_code: null,
          client_id: form.client_id,
          client_display_code: contextualClient?.display_code ?? clients.find((client) => client.id === form.client_id)?.display_code ?? null,
          client_name: contextualClient?.full_name ?? clients.find((client) => client.id === form.client_id)?.full_name ?? null,
          name: form.name.trim(),
          property_type: form.property_type,
          address: form.address.trim(),
          city: form.city.trim() || null,
          postal_code: form.postal_code.trim() || null,
          notes: form.notes.trim() || null,
        }, properties)

        if (duplicateGroups.length > 0) {
          setPendingDuplicateGroups(duplicateGroups)
          return
        }
      }

      const propertyId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? `PROPERTY-${crypto.randomUUID()}`
          : `PROPERTY-${Date.now()}`

      const response = await fetchAuthenticatedSupabaseWrite(operationalWriteRpcPaths.createProperty, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_property: {
            id: propertyId,
            client_id: form.client_id,
            name: form.name.trim(),
            property_type: form.property_type,
            address: form.address.trim(),
            city: form.city.trim() || null,
            postal_code: form.postal_code.trim() || null,
            notes: form.notes.trim() || null,
          },
        }),
      })

      const createdRow = await readSingleAuthenticatedWriteRow<Partial<PropertyListItem>>(
        response,
        'La propiedad no se creo. Revisa tu sesion o permisos y vuelve a intentarlo.',
      )
      const createdProperty: PropertyListItem = {
        id: createdRow?.id ?? propertyId,
        display_code: createdRow?.display_code ?? null,
        client_id: createdRow?.client_id ?? form.client_id,
        client_display_code: contextualClient?.display_code ?? clients.find((client) => client.id === form.client_id)?.display_code ?? null,
        client_name: contextualClient?.full_name ?? clients.find((client) => client.id === form.client_id)?.full_name ?? null,
        name: createdRow?.name ?? form.name.trim(),
        property_type: createdRow?.property_type ?? form.property_type,
        address: createdRow?.address ?? form.address.trim(),
        city: createdRow?.city ?? (form.city.trim() || null),
        postal_code: createdRow?.postal_code ?? (form.postal_code.trim() || null),
        notes: createdRow?.notes ?? (form.notes.trim() || null),
      }

      await onCreated()
      await onCreatedProperty?.(createdProperty)
      setForm({
        client_id: contextClientId ?? '',
        name: '',
        property_type: 'apartment',
        address: '',
        city: '',
        postal_code: '',
        notes: '',
      })
      setIsDirty(false)
      setCurrentStep(0)
      setSuccessMessage('Propiedad creada correctamente.')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido creando la propiedad.'

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

    await submitProperty()
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
    <div className="cc-property-create-form__footer">
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
        <button type="button" className="primary-button" onClick={() => void submitProperty()} disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : submitLabel}
        </button>
      )}
    </div>
  )

  const sharedStepFlow = (
    <FullscreenStepFlow
      eyebrow="Alta de activo"
      title={title}
      description={description ?? 'Alta guiada para vincular cliente, inmueble y ubicacion sin romper el contrato existente.'}
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
          label: 'Cliente heredado',
          value: contextualClient
            ? formatClientLabel(contextualClient)
            : form.client_id
              ? formatClientLabel(clients.find((client) => client.id === form.client_id) ?? { id: form.client_id })
              : 'Pendiente',
          hint: contextualClient ? 'Heredado del contexto actual' : 'Se usara como propietario base',
        },
        {
          label: 'Tipo operativo',
          value: getPropertyTypeLabel(form.property_type),
          hint: 'Define el contexto operativo principal',
        },
      ]}
      sideContent={(
        <div className="cc-property-create-form__summary">
          <div className="cc-property-create-form__summary-top">
            <span className="cc-property-create-form__summary-avatar" aria-hidden="true">
              {(form.name.trim() || contextualClient?.full_name || 'N').trim().charAt(0).toUpperCase()}
            </span>
            <div className="cc-property-create-form__summary-copy">
              <span>Revision</span>
              <strong>{form.name.trim() || 'Nueva Propiedad'}</strong>
              <small>{form.address.trim() || 'Sin direccion operativa'}</small>
            </div>
          </div>
          <div className="cc-property-create-form__summary-grid">
            <div>
              <span>Cliente</span>
              <strong>
                {contextualClient
                  ? formatClientLabel(contextualClient)
                  : form.client_id
                    ? formatClientLabel(clients.find((client) => client.id === form.client_id) ?? { id: form.client_id })
                    : 'Pendiente'}
              </strong>
            </div>
            <div>
              <span>Tipo</span>
              <strong>{getPropertyTypeLabel(form.property_type)}</strong>
            </div>
          </div>
        </div>
      )}
      footerContent={footerContent}
    >
      <form className="lead-form cc-property-create-form__flow" onSubmit={handleSubmit}>
        {currentStep === 0 ? (
          <section className="cc-property-create-form__step">
            <label className="form-field">
              <span>Cliente *</span>
              <select
                value={form.client_id}
                onChange={(event) => updateField('client_id', event.target.value)}
                disabled={Boolean(contextualClient)}
              >
                {!contextualClient ? <option value="">Selecciona un cliente</option> : null}
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {formatClientLabel(client)}
                  </option>
                ))}
              </select>
            </label>

            {!contextualClient ? (
              <ContextualCreateSection
                actionLabel="Crear cliente"
                title="¿Falta el cliente?"
                description="Abre un subflujo rapido para crear el cliente y seguir con esta propiedad sin perder lo ya escrito."
                isOpen={showClientCreate}
                onToggle={() => setShowClientCreate((current) => !current)}
              >
                <ClientCreateForm
                  onCreated={onCreated}
                  onDirtyChange={setIsDirty}
                  title="Nuevo cliente en contexto"
                  description="Al guardarlo, quedara seleccionado aqui automaticamente."
                  submitLabel="Guardar cliente y usarlo"
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
            ) : null}
          </section>
        ) : null}

        {currentStep === 1 ? (
          <section className="cc-property-create-form__step">
            <label className="form-field">
              <span>Nombre interno *</span>
              <input
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                placeholder="Ej. Piso Calella Centro"
                required
              />
            </label>

            <label className="form-field">
              <span>Tipo de inmueble *</span>
              <select
                value={form.property_type}
                onChange={(event) => updateField('property_type', event.target.value)}
              >
                <option value="apartment">{getPropertyTypeLabel('apartment')}</option>
                <option value="house">{getPropertyTypeLabel('house')}</option>
                <option value="office">{getPropertyTypeLabel('office')}</option>
                <option value="local">{getPropertyTypeLabel('local')}</option>
                <option value="tourist_apartment">{getPropertyTypeLabel('tourist_apartment')}</option>
                <option value="community">{getPropertyTypeLabel('community')}</option>
                <option value="construction_site">{getPropertyTypeLabel('construction_site')}</option>
              </select>
            </label>
          </section>
        ) : null}

        {currentStep === 2 ? (
          <section className="cc-property-create-form__step">
            <label className="form-field form-field-full">
              <span>Direccion *</span>
              <input
                value={form.address}
                onChange={(event) => updateField('address', event.target.value)}
                placeholder="Ej. Carrer Example 12, 2º 1ª"
                required
              />
            </label>

            <label className="form-field">
              <span>Ciudad</span>
              <input
                value={form.city}
                onChange={(event) => updateField('city', event.target.value)}
                placeholder="Ej. Calella"
              />
            </label>

            <label className="form-field">
              <span>Codigo postal</span>
              <input
                value={form.postal_code}
                onChange={(event) => updateField('postal_code', event.target.value)}
                placeholder="Ej. 08370"
              />
            </label>

            <label className="form-field form-field-full">
              <span>Notas</span>
              <textarea
                value={form.notes}
                onChange={(event) => updateField('notes', event.target.value)}
                placeholder="Accesos, instrucciones o detalles operativos"
                rows={4}
              />
            </label>
          </section>
        ) : null}

        {submitError ? (
          <div className="empty-state">
            <strong>No se pudo crear la propiedad</strong>
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
    </FullscreenStepFlow>
  )

  return (
    <section className="data-section cc-property-create-form">
      {sharedStepFlow}

      <ConfirmDialog
        isOpen={showCancelConfirm}
        title="Descartar propiedad en curso"
        description="Has empezado a completar esta propiedad. Si cierras ahora, perderas los cambios no guardados."
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
        title="Posible propiedad duplicada"
        description="Ya existe una propiedad muy parecida para este cliente. Puedes usar la existente o crear otra de forma explicita."
        groups={pendingDuplicateGroups}
        onClose={() => setPendingDuplicateGroups([])}
        onOpenRecord={onOpenExistingProperty ? (propertyId) => {
          setPendingDuplicateGroups([])
          onOpenExistingProperty(propertyId)
        } : undefined}
        onUseRecord={onOpenExistingProperty ? (propertyId) => {
          setPendingDuplicateGroups([])
          onOpenExistingProperty(propertyId)
        } : undefined}
        onContinueAnyway={() => {
          setPendingDuplicateGroups([])
          void submitProperty(true)
        }}
      />
    </section>
  )
}
