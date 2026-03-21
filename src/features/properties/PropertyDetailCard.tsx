import { useEffect, useState, type FormEvent } from 'react'
import { getPropertyTypeLabel } from '../../app/displayFormat'
import type { PropertyListItem } from './types'

interface PropertyDetailCardProps {
  property: PropertyListItem | null
  onPropertyUpdated: () => Promise<void>
}

interface EditFormState {
  name: string
  property_type: string
  address: string
  city: string
  postal_code: string
  notes: string
}

export function PropertyDetailCard({
  property,
  onPropertyUpdated,
}: PropertyDetailCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [form, setForm] = useState<EditFormState>({
    name: '',
    property_type: 'apartment',
    address: '',
    city: '',
    postal_code: '',
    notes: '',
  })

  useEffect(() => {
    if (!property) {
      setIsEditing(false)
      setSaveError(null)
      setSuccessMessage(null)
      setForm({
        name: '',
        property_type: 'apartment',
        address: '',
        city: '',
        postal_code: '',
        notes: '',
      })
      return
    }

    setIsEditing(false)
    setSaveError(null)
    setSuccessMessage(null)
    setForm({
      name: property.name,
      property_type: property.property_type,
      address: property.address,
      city: property.city ?? '',
      postal_code: property.postal_code ?? '',
      notes: property.notes ?? '',
    })
  }, [property])

  function updateField<K extends keyof EditFormState>(
    field: K,
    value: EditFormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!property) {
      return
    }

    setSaveError(null)
    setSuccessMessage(null)
    setIsSaving(true)

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseAnonKey) {
        setSaveError('Faltan las variables de entorno de Supabase.')
        return
      }

      const response = await fetch(
        `${supabaseUrl}/rest/v1/properties?id=eq.${encodeURIComponent(property.id)}`,
        {
          method: 'PATCH',
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: form.name.trim(),
            property_type: form.property_type,
            address: form.address.trim(),
            city: form.city.trim() || null,
            postal_code: form.postal_code.trim() || null,
            notes: form.notes.trim() || null,
          }),
        },
      )

      if (!response.ok) {
        const errorText = await response.text()
        setSaveError(`REST ${response.status}: ${errorText || response.statusText}`)
        return
      }

      await onPropertyUpdated()
      setSuccessMessage('Propiedad actualizada correctamente.')
      setIsEditing(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido actualizando la propiedad.'

      setSaveError(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="data-section">
      <div className="section-header page-header-actions">
        <div>
          <h2>Detalle de la propiedad</h2>
          <p>Vista inicial de detalle del inmueble seleccionado.</p>
        </div>

        {property ? (
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setIsEditing((current) => !current)
              setSaveError(null)
              setSuccessMessage(null)
              setForm({
                name: property.name,
                property_type: property.property_type,
                address: property.address,
                city: property.city ?? '',
                postal_code: property.postal_code ?? '',
                notes: property.notes ?? '',
              })
            }}
          >
            {isEditing ? 'Cancelar edición' : 'Editar propiedad'}
          </button>
        ) : null}
      </div>

      {property ? (
        <div className="lead-detail-card">
          <div className="lead-detail-header">
            <div>
              <h3>{property.name}</h3>
              <p>{property.display_code ?? property.id}</p>
            </div>

            <span className="lead-badge">{getPropertyTypeLabel(property.property_type)}</span>
          </div>

          {isEditing ? (
            <form className="lead-form" onSubmit={handleSubmit}>
              <label className="form-field">
                <span>Nombre *</span>
                <input
                  value={form.name}
                  onChange={(event) => updateField('name', event.target.value)}
                  required
                />
              </label>

              <label className="form-field">
                <span>Tipo *</span>
                <select
                  value={form.property_type}
                  onChange={(event) => updateField('property_type', event.target.value)}
                >
                  <option value="apartment">apartment</option>
                  <option value="house">house</option>
                  <option value="office">office</option>
                  <option value="local">local</option>
                  <option value="tourist_apartment">tourist_apartment</option>
                  <option value="community">community</option>
                  <option value="construction_site">construction_site</option>
                </select>
              </label>

              <label className="form-field form-field-full">
                <span>Dirección *</span>
                <input
                  value={form.address}
                  onChange={(event) => updateField('address', event.target.value)}
                  required
                />
              </label>

              <label className="form-field">
                <span>Ciudad</span>
                <input
                  value={form.city}
                  onChange={(event) => updateField('city', event.target.value)}
                />
              </label>

              <label className="form-field">
                <span>Código postal</span>
                <input
                  value={form.postal_code}
                  onChange={(event) => updateField('postal_code', event.target.value)}
                />
              </label>

              <label className="form-field form-field-full">
                <span>Notas</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => updateField('notes', event.target.value)}
                  rows={4}
                />
              </label>

              <div className="form-actions">
                <button type="submit" className="primary-button" disabled={isSaving}>
                  {isSaving ? 'Guardando cambios...' : 'Guardar cambios'}
                </button>
              </div>

              {saveError ? (
                <div className="empty-state">
                  <strong>No se pudo actualizar la propiedad</strong>
                  <p>{saveError}</p>
                </div>
              ) : null}

              {successMessage ? (
                <div className="empty-state">
                  <strong>Operación correcta</strong>
                  <p>{successMessage}</p>
                </div>
              ) : null}
            </form>
          ) : (
            <div className="lead-detail-grid">
              <div className="detail-row">
                <span className="detail-label">Código</span>
                <strong>{property.display_code ?? property.id}</strong>
              </div>

              <div className="detail-row">
                <span className="detail-label">Nombre</span>
                <strong>{property.name}</strong>
              </div>

              <div className="detail-row">
                <span className="detail-label">Tipo</span>
                <strong>{getPropertyTypeLabel(property.property_type)}</strong>
              </div>

              <div className="detail-row">
                <span className="detail-label">Dirección</span>
                <strong>{property.address}</strong>
              </div>

              <div className="detail-row">
                <span className="detail-label">Ciudad</span>
                <strong>{property.city ?? 'Sin ciudad'}</strong>
              </div>

              <div className="detail-row">
                <span className="detail-label">Código postal</span>
                <strong>{property.postal_code ?? 'Sin código postal'}</strong>
              </div>

              <div className="detail-row">
                <span className="detail-label">Cliente</span>
                <strong>{property.client_display_code ?? property.client_id}</strong>
              </div>

              <div className="detail-row">
                <span className="detail-label">Notas</span>
                <strong>{property.notes ?? 'Sin notas'}</strong>
              </div>
            </div>
          )}

          {!isEditing && saveError ? (
            <div className="empty-state">
              <strong>No se pudo actualizar la propiedad</strong>
              <p>{saveError}</p>
            </div>
          ) : null}

          {!isEditing && successMessage ? (
            <div className="empty-state">
              <strong>Operación correcta</strong>
              <p>{successMessage}</p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="empty-state">
          <strong>Ninguna propiedad seleccionada</strong>
          <p>Haz clic en una tarjeta del listado para ver su detalle.</p>
        </div>
      )}
    </section>
  )
}
