import { useEffect, useState, type FormEvent } from 'react'
import { getDisplayStatusLabel } from '../../app/displayFormat'
import type { ClientListItem } from './types'

interface ClientDetailCardProps {
  client: ClientListItem | null
  onClientUpdated: () => Promise<void>
}

interface EditFormState {
  full_name: string
  phone: string
  email: string
  status: string
}

export function ClientDetailCard({
  client,
  onClientUpdated,
}: ClientDetailCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [form, setForm] = useState<EditFormState>({
    full_name: '',
    phone: '',
    email: '',
    status: 'active',
  })

  useEffect(() => {
    if (!client) {
      setIsEditing(false)
      setSaveError(null)
      setSuccessMessage(null)
      setForm({
        full_name: '',
        phone: '',
        email: '',
        status: 'active',
      })
      return
    }

    setIsEditing(false)
    setSaveError(null)
    setSuccessMessage(null)
    setForm({
      full_name: client.full_name,
      phone: client.phone ?? '',
      email: client.email ?? '',
      status: client.status,
    })
  }, [client])

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

    if (!client) {
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
        `${supabaseUrl}/rest/v1/clients?id=eq.${encodeURIComponent(client.id)}`,
        {
          method: 'PATCH',
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            full_name: form.full_name.trim(),
            phone: form.phone.trim() || null,
            email: form.email.trim() || null,
            status: form.status,
          }),
        },
      )

      if (!response.ok) {
        const errorText = await response.text()
        setSaveError(`REST ${response.status}: ${errorText || response.statusText}`)
        return
      }

      await onClientUpdated()
      setSuccessMessage('Cliente actualizado correctamente.')
      setIsEditing(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido actualizando el cliente.'

      setSaveError(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="data-section">
      <div className="section-header page-header-actions">
        <div>
          <h2>Detalle del cliente</h2>
          <p>Vista inicial de detalle del cliente seleccionado.</p>
        </div>

        {client ? (
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setIsEditing((current) => !current)
              setSaveError(null)
              setSuccessMessage(null)
              setForm({
                full_name: client.full_name,
                phone: client.phone ?? '',
                email: client.email ?? '',
                status: client.status,
              })
            }}
          >
            {isEditing ? 'Cancelar edición' : 'Editar cliente'}
          </button>
        ) : null}
      </div>

      {client ? (
        <div className="lead-detail-card">
          <div className="lead-detail-header">
            <div>
              <h3>{client.full_name}</h3>
              <p>{client.display_code ?? client.id}</p>
            </div>

            <span className="lead-badge">{getDisplayStatusLabel(client.status)}</span>
          </div>

          {isEditing ? (
            <form className="lead-form" onSubmit={handleSubmit}>
              <label className="form-field">
                <span>Nombre completo *</span>
                <input
                  value={form.full_name}
                  onChange={(event) => updateField('full_name', event.target.value)}
                  required
                />
              </label>

              <label className="form-field">
                <span>Teléfono</span>
                <input
                  value={form.phone}
                  onChange={(event) => updateField('phone', event.target.value)}
                />
              </label>

              <label className="form-field">
                <span>Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                />
              </label>

              <label className="form-field">
                <span>Estado</span>
                <select
                  value={form.status}
                  onChange={(event) => updateField('status', event.target.value)}
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </label>

              <div className="form-actions">
                <button
                  type="submit"
                  className="primary-button"
                  disabled={isSaving}
                >
                  {isSaving ? 'Guardando cambios...' : 'Guardar cambios'}
                </button>
              </div>

              {saveError ? (
                <div className="empty-state">
                  <strong>No se pudo actualizar el cliente</strong>
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
                <strong>{client.display_code ?? client.id}</strong>
              </div>

              <div className="detail-row">
                <span className="detail-label">Nombre</span>
                <strong>{client.full_name}</strong>
              </div>

              <div className="detail-row">
                <span className="detail-label">Teléfono</span>
                <strong>{client.phone ?? 'Sin teléfono'}</strong>
              </div>

              <div className="detail-row">
                <span className="detail-label">Email</span>
                <strong>{client.email ?? 'Sin email'}</strong>
              </div>

              <div className="detail-row">
                <span className="detail-label">Estado</span>
                <strong>{getDisplayStatusLabel(client.status)}</strong>
              </div>

              <div className="detail-row">
                <span className="detail-label">Lead origen</span>
                <strong>{client.source_lead_id ?? 'Sin lead origen'}</strong>
              </div>
            </div>
          )}

          {!isEditing && saveError ? (
            <div className="empty-state">
              <strong>No se pudo actualizar el cliente</strong>
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
          <strong>Ningún cliente seleccionado</strong>
          <p>Haz clic en una tarjeta del listado para ver su detalle.</p>
        </div>
      )}
    </section>
  )
}
