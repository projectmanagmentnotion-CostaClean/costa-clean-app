import { useState, type FormEvent } from 'react'
import type { ClientListItem } from '../clients/types'

interface PropertyCreateFormProps {
  clients: ClientListItem[]
  onCreated: () => Promise<void>
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
}: PropertyCreateFormProps) {
  const [form, setForm] = useState<FormState>({
    client_id: clients[0]?.id ?? '',
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
      setForm({
        client_id: clients[0]?.id ?? '',
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
        <h2>Nueva propiedad</h2>
      </div>

      {clients.length === 0 ? (
        <div className="empty-state">
          <strong>No hay clientes disponibles</strong>
          <p>Primero debes crear al menos un cliente para poder registrar una propiedad.</p>
        </div>
      ) : (
        <form className="lead-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Cliente *</span>
            <select
              value={form.client_id}
              onChange={(event) => updateField('client_id', event.target.value)}
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.full_name} · {client.display_code ?? client.id}
                </option>
              ))}
            </select>
          </label>

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
              {isSubmitting ? 'Guardando...' : 'Guardar propiedad'}
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


