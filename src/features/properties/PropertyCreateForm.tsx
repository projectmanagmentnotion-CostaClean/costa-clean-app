import { useMemo, useState, type FormEvent } from 'react'
import { formatClientLabel } from '../../app/relationshipLabels'
import { ContextualCreateSection } from '../../components/ContextualCreateSection'
import { ClientCreateForm } from '../clients/ClientCreateForm'
import type { PropertyListItem } from './types'
import type { ClientListItem } from '../clients/types'

interface PropertyCreateFormProps {
  clients: ClientListItem[]
  onCreated: () => Promise<void>
  contextClientId?: string | null
  onCreatedProperty?: (property: PropertyListItem) => void | Promise<void>
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
  onCreated,
  contextClientId = null,
  onCreatedProperty,
  title = 'Nueva propiedad',
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

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
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

      await onCreated()
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
      setForm({
        client_id: contextClientId ?? '',
        name: '',
        property_type: 'apartment',
        address: '',
        city: '',
        postal_code: '',
        notes: '',
      })
      setSuccessMessage('Propiedad creada correctamente.')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido creando la propiedad.'

      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="data-section">
      <div className="section-header">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>

      {clients.length === 0 ? (
        <ContextualCreateSection
          actionLabel="Crear cliente"
          title="Falta el cliente base"
          description="Crea el cliente sin salir del flujo y se seleccionará automáticamente para esta propiedad."
          isOpen={showClientCreate}
          onToggle={() => setShowClientCreate((current) => !current)}
        >
          <ClientCreateForm
            onCreated={onCreated}
            title="Nuevo cliente en contexto"
            description="Guarda el cliente y vuelve directamente al alta de propiedad."
            submitLabel="Guardar cliente y volver"
            onCreatedClient={async (client) => {
              setForm((current) => ({
                ...current,
                client_id: client.id,
              }))
              setShowClientCreate(false)
            }}
          />
        </ContextualCreateSection>
      ) : (
        <form className="lead-form" onSubmit={handleSubmit}>
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
              description="Abre un subflujo rápido para crear el cliente y seguir con esta propiedad sin perder lo ya escrito."
              isOpen={showClientCreate}
              onToggle={() => setShowClientCreate((current) => !current)}
            >
              <ClientCreateForm
                onCreated={onCreated}
                title="Nuevo cliente en contexto"
                description="Al guardarlo, quedará seleccionado aquí automáticamente."
                submitLabel="Guardar cliente y usarlo"
                onCreatedClient={async (client) => {
                  setForm((current) => ({
                    ...current,
                    client_id: client.id,
                  }))
                  setShowClientCreate(false)
                }}
              />
            </ContextualCreateSection>
          ) : null}

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

          <label className="form-field form-field-full">
            <span>Dirección *</span>
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
            <span>Código postal</span>
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

          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : submitLabel}
            </button>
          </div>

          {submitError ? (
            <div className="empty-state">
              <strong>No se pudo crear la propiedad</strong>
              <p>{submitError}</p>
            </div>
          ) : null}

          {successMessage ? (
            <div className="empty-state">
              <strong>Operación correcta</strong>
              <p>{successMessage}</p>
            </div>
          ) : null}
        </form>
      )}
    </section>
  )
}
