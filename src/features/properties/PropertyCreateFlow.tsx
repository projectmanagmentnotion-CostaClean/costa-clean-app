import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { formatClientLabel } from '../../app/relationshipLabels'
import { FullscreenStepFlow } from '../../components/FullscreenStepFlow'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ContextualCreateSection } from '../../components/ContextualCreateSection'
import { DSSmartPostalCodeInput } from '../../design-system/components'
import { DuplicateReviewOverlay } from '../duplicates/DuplicateReviewOverlay'
import { findPropertyDuplicateGroups } from '../duplicates/duplicateEngine'
import type { FullViewActionFlowProps } from '../shared/actionFlowLifecycle'
import { completeFullViewActionFlow } from '../shared/actionFlowLifecycle'
import { ClientCreateForm } from '../clients/ClientCreateForm'
import type { ClientListItem } from '../clients/types'
import type { PropertyListItem } from './types'

interface PropertyCreateFlowProps extends FullViewActionFlowProps {
  clients: ClientListItem[]
  properties?: PropertyListItem[]
  contextClientId?: string | null
  onCreatedProperty?: (property: PropertyListItem) => void | Promise<void>
  title?: string
  description?: string
  submitLabel?: string
  onOpenExistingProperty?: (propertyId: string) => void
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
    case 'tourist_apartment': return 'Piso turistico'
    case 'community': return 'Comunidad'
    case 'construction_site': return 'Obra'
    default: return value
  }
}

const defaultFormState: FormState = {
  client_id: '',
  name: '',
  property_type: 'apartment',
  address: '',
  city: '',
  postal_code: '',
  notes: '',
}

export function PropertyCreateFlow({
  clients,
  properties = [],
  onRefreshData,
  onCompleted,
  contextClientId = null,
  onCreatedProperty,
  onCancel,
  onDirtyChange,
  title = 'Nueva propiedad',
  description = 'Alta corta para inmueble, cliente y direccion.',
  submitLabel = 'Guardar propiedad',
  onOpenExistingProperty,
}: PropertyCreateFlowProps) {
  const contextualClient = useMemo(
    () => (contextClientId ? clients.find((client) => client.id === contextClientId) ?? null : null),
    [clients, contextClientId],
  )
  const [form, setForm] = useState<FormState>({
    ...defaultFormState,
    client_id: contextClientId ?? '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showClientCreate, setShowClientCreate] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [pendingDuplicateGroups, setPendingDuplicateGroups] = useState<ReturnType<typeof findPropertyDuplicateGroups>>([])

  useEffect(() => {
    onDirtyChange?.(isDirty)
    return () => onDirtyChange?.(false)
  }, [isDirty, onDirtyChange])

  const contextItems = [
    {
      label: 'Cliente',
      value: contextualClient
        ? formatClientLabel(contextualClient)
        : form.client_id
          ? formatClientLabel(clients.find((client) => client.id === form.client_id) ?? { id: form.client_id })
          : 'Pendiente',
      hint: contextualClient ? 'Heredado del contexto actual' : 'Se usara como propietario base',
    },
    {
      label: 'Tipo',
      value: getPropertyTypeLabel(form.property_type),
      hint: 'Define el contexto operativo principal',
    },
  ]

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setIsDirty(true)
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function submitProperty(skipDuplicateReview = false) {
    setSubmitError(null)
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

      if (!form.name.trim()) {
        setSubmitError('Debes indicar un nombre interno para la propiedad.')
        return
      }

      if (!form.address.trim()) {
        setSubmitError('Debes indicar la direccion operativa de la propiedad.')
        return
      }

      if (!skipDuplicateReview) {
        const duplicateGroups = findPropertyDuplicateGroups({
          id: 'PROPERTY-DRAFT',
          display_code: null,
          client_id: form.client_id,
          client_display_code: contextualClient?.display_code ?? null,
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

      const response = await fetch(`${supabaseUrl}/rest/v1/properties`, {
        method: 'POST',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: propertyId,
          client_id: form.client_id,
          name: form.name.trim(),
          property_type: form.property_type,
          address: form.address.trim(),
          city: form.city.trim() || null,
          postal_code: form.postal_code.trim() || null,
          notes: form.notes.trim() || null,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        setSubmitError(`REST ${response.status}: ${errorText || response.statusText}`)
        return
      }

      await onCreatedProperty?.({
        id: propertyId,
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
      })

      setIsDirty(false)
      await completeFullViewActionFlow({ onRefreshData, onCompleted })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido creando la propiedad.'
      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
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

  return (
    <FullscreenStepFlow
      eyebrow="Propiedad"
      title={title}
      description={description}
      steps={[
        { id: 'owner', label: 'Cliente y tipo', description: 'Contexto base del inmueble' },
        { id: 'location', label: 'Datos operativos', description: 'Direccion y lectura del inmueble' },
      ]}
      currentStep={1}
      stepStates={['complete', 'current']}
      contextItems={contextItems}
      sideContent={(
        <div className="cc-form-shell__summary-card cc-form-shell__summary-card--stack">
          <span>Resultado</span>
          <strong>{form.name.trim() || 'Nueva propiedad'}</strong>
          <small>{form.address.trim() || 'Sin direccion'}</small>
        </div>
      )}
    >
      {clients.length === 0 ? (
        <ContextualCreateSection
          actionLabel="Crear cliente"
          title="Falta el cliente base"
          description="Crea el cliente y seguiremos aqui."
          isOpen={showClientCreate}
          onToggle={() => setShowClientCreate((current) => !current)}
        >
          <ClientCreateForm
            onCreated={onRefreshData}
            onDirtyChange={setIsDirty}
            title="Nuevo cliente en contexto"
            description="Guarda y vuelve al alta."
            submitLabel="Guardar cliente y volver"
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
        <form className="lead-form cc-detail-panel__editor" onSubmit={handleSubmit}>
          {showClientCreate ? (
            <ContextualCreateSection
              actionLabel="Crear cliente"
              title="Debes crear el cliente antes de seguir"
              description="Completa primero el cliente y volveras a la propiedad con ese contexto ya fijado."
              isOpen
              onToggle={() => setShowClientCreate(false)}
            >
              <ClientCreateForm
                onCreated={onRefreshData}
                onDirtyChange={setIsDirty}
                existingClients={clients}
                title="Nuevo cliente en contexto"
                description="Al guardarlo, quedara seleccionado automaticamente aqui."
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
          ) : (
            <>
          <section className="cc-form-shell__section">
            <div className="cc-form-shell__section-head">
              <strong>Base del inmueble</strong>
              <span>Cliente, nombre interno y tipologia.</span>
            </div>

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
                title="Falta el cliente"
                description="Abre un subflujo corto para resolver el propietario sin perder lo ya escrito."
                isOpen={showClientCreate}
                onToggle={() => setShowClientCreate(true)}
              >
                <></>
              </ContextualCreateSection>
            ) : null}

            <label className="form-field">
              <span>Nombre interno *</span>
              <input
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                placeholder="Ej. Oficina Pineda centro"
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

          <section className="cc-form-shell__section">
            <div className="cc-form-shell__section-head">
              <strong>Datos operativos</strong>
              <span>Direccion y notas operativas.</span>
            </div>

            <label className="form-field form-field-full">
              <span>Direccion *</span>
              <input
                value={form.address}
                onChange={(event) => updateField('address', event.target.value)}
                placeholder="Ej. Carrer Example 12, 2 1"
                required
              />
            </label>

            <div className="form-field form-field-full">
              <DSSmartPostalCodeInput
                postalCodeValue={form.postal_code}
                cityValue={form.city}
                onPostalCodeChange={(value) => updateField('postal_code', value)}
                onCityChange={(value) => updateField('city', value)}
                postalCodeHint="Sugerencias locales sin tocar backend."
                cityHint="Selecciona una sugerencia o escribe libre."
              />
            </div>

            <label className="form-field form-field-full">
              <span>Notas operativas</span>
              <textarea
                value={form.notes}
                onChange={(event) => updateField('notes', event.target.value)}
                rows={4}
                placeholder="Accesos, referencias o detalles de operativa"
              />
            </label>
          </section>

          {submitError ? (
            <div className="cc-alert cc-alert--error">
              <strong>No se pudo crear la propiedad</strong>
              <p>{submitError}</p>
            </div>
          ) : null}

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
            </>
          )}
        </form>
      )}

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
        description="Antes de crear otra propiedad, revisa si el inmueble ya existe con la misma dirección o el mismo cliente."
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
    </FullscreenStepFlow>
  )
}
