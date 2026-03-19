import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { JobListItem } from './types'
import type { ClientListItem } from '../clients/types'
import type { PropertyListItem } from '../properties/types'
import type { QuoteListItem } from '../quotes/types'

interface JobDetailCardProps {
  job: JobListItem | null
  clients: ClientListItem[]
  properties: PropertyListItem[]
  quotes: QuoteListItem[]
  onJobUpdated: () => Promise<void>
}

interface EditFormState {
  client_id: string
  property_id: string
  quote_id: string
  scheduled_date: string
  status: string
  service_type: string
  notes: string
}

export function JobDetailCard({
  job,
  clients,
  properties,
  quotes,
  onJobUpdated,
}: JobDetailCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [form, setForm] = useState<EditFormState>({
    client_id: '',
    property_id: '',
    quote_id: '',
    scheduled_date: '',
    status: 'scheduled',
    service_type: 'standard_cleaning',
    notes: '',
  })

  useEffect(() => {
    if (!job) {
      setIsEditing(false)
      setSaveError(null)
      setSuccessMessage(null)
      setForm({
        client_id: '',
        property_id: '',
        quote_id: '',
        scheduled_date: '',
        status: 'scheduled',
        service_type: 'standard_cleaning',
        notes: '',
      })
      return
    }

    setIsEditing(false)
    setSaveError(null)
    setSuccessMessage(null)
    setForm({
      client_id: job.client_id,
      property_id: job.property_id,
      quote_id: job.quote_id ?? '',
      scheduled_date: job.scheduled_date,
      status: job.status,
      service_type: job.service_type,
      notes: job.notes ?? '',
    })
  }, [job])

  const availableProperties = useMemo(() => {
    if (!form.client_id) {
      return []
    }

    return properties.filter((property) => property.client_id === form.client_id)
  }, [properties, form.client_id])

  const availableQuotes = useMemo(() => {
    if (!form.client_id) {
      return []
    }

    return quotes.filter((quote) => quote.client_id === form.client_id)
  }, [quotes, form.client_id])

  function updateField<K extends keyof EditFormState>(
    field: K,
    value: EditFormState[K],
  ) {
    setForm((current) => {
      const next = {
        ...current,
        [field]: value,
      }

      if (field === 'client_id') {
        next.property_id = ''
        next.quote_id = ''
      }

      return next
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!job) {
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

      if (!form.client_id) {
        setSaveError('Debes seleccionar un client.')
        return
      }

      if (!form.property_id) {
        setSaveError('Debes seleccionar una property.')
        return
      }

      if (!form.scheduled_date) {
        setSaveError('Debes indicar la fecha programada.')
        return
      }

      const response = await fetch(
        `${supabaseUrl}/rest/v1/jobs?id=eq.${encodeURIComponent(job.id)}`,
        {
          method: 'PATCH',
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: form.client_id,
            property_id: form.property_id,
            quote_id: form.quote_id || null,
            scheduled_date: form.scheduled_date,
            status: form.status,
            service_type: form.service_type,
            notes: form.notes.trim() || null,
          }),
        },
      )

      if (!response.ok) {
        const errorText = await response.text()
        setSaveError(`REST ${response.status}: ${errorText || response.statusText}`)
        return
      }

      await onJobUpdated()
      setSuccessMessage('Job actualizado correctamente.')
      setIsEditing(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido actualizando el job.'

      setSaveError(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="data-section">
      <div className="section-header page-header-actions">
        <div>
          <h2>Detalle del job</h2>
          <p>Vista inicial de detalle del servicio seleccionado.</p>
        </div>

        {job ? (
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setIsEditing((current) => !current)
              setSaveError(null)
              setSuccessMessage(null)
              setForm({
                client_id: job.client_id,
                property_id: job.property_id,
                quote_id: job.quote_id ?? '',
                scheduled_date: job.scheduled_date,
                status: job.status,
                service_type: job.service_type,
                notes: job.notes ?? '',
              })
            }}
          >
            {isEditing ? 'Cancelar edición' : 'Editar job'}
          </button>
        ) : null}
      </div>

      {job ? (
        <div className="lead-detail-card">
          <div className="lead-detail-header">
            <div>
              <h3>{job.display_code ?? job.id}</h3>
            </div>

            <span className="lead-badge">{job.status}</span>
          </div>

          {isEditing ? (
            <form className="lead-form" onSubmit={handleSubmit}>
              <label className="form-field">
                <span>Client *</span>
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
                <span>Property *</span>
                <select
                  value={form.property_id}
                  onChange={(event) => updateField('property_id', event.target.value)}
                >
                  <option value="">Selecciona una property</option>
                  {availableProperties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name} · {property.display_code ?? property.id}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span>Quote</span>
                <select
                  value={form.quote_id}
                  onChange={(event) => updateField('quote_id', event.target.value)}
                >
                  <option value="">Sin quote</option>
                  {availableQuotes.map((quote) => (
                    <option key={quote.id} value={quote.id}>
                      {quote.display_code ?? quote.id}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span>Fecha programada *</span>
                <input
                  type="date"
                  value={form.scheduled_date}
                  onChange={(event) => updateField('scheduled_date', event.target.value)}
                  required
                />
              </label>

              <label className="form-field">
                <span>Estado</span>
                <select
                  value={form.status}
                  onChange={(event) => updateField('status', event.target.value)}
                >
                  <option value="scheduled">scheduled</option>
                  <option value="in_progress">in_progress</option>
                  <option value="completed">completed</option>
                  <option value="cancelled">cancelled</option>
                </select>
              </label>

              <label className="form-field">
                <span>Tipo de servicio</span>
                <select
                  value={form.service_type}
                  onChange={(event) => updateField('service_type', event.target.value)}
                >
                  <option value="standard_cleaning">standard_cleaning</option>
                  <option value="deep_cleaning">deep_cleaning</option>
                  <option value="post_construction">post_construction</option>
                  <option value="check_out_cleaning">check_out_cleaning</option>
                  <option value="airbnb_turnover">airbnb_turnover</option>
                  <option value="glass_cleaning">glass_cleaning</option>
                </select>
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
                  <strong>No se pudo actualizar el job</strong>
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
                <strong>{job.display_code ?? job.id}</strong>
              </div>

              <div className="detail-row">
                <span className="detail-label">Client</span>
                <strong>{job.client_display_code ?? job.client_id}</strong>
              </div>

              <div className="detail-row">
                <span className="detail-label">Property</span>
                <strong>{job.property_display_code ?? job.property_id}</strong>
              </div>

              <div className="detail-row">
                <span className="detail-label">Quote</span>
                <strong>{job.quote_display_code ?? job.quote_id ?? 'Sin quote'}</strong>
              </div>

              <div className="detail-row">
                <span className="detail-label">Fecha programada</span>
                <strong>{job.scheduled_date}</strong>
              </div>

              <div className="detail-row">
                <span className="detail-label">Estado</span>
                <strong>{job.status}</strong>
              </div>

              <div className="detail-row">
                <span className="detail-label">Tipo de servicio</span>
                <strong>{job.service_type}</strong>
              </div>

              <div className="detail-row">
                <span className="detail-label">Notas</span>
                <strong>{job.notes ?? 'Sin notas'}</strong>
              </div>
            </div>
          )}

          {!isEditing && saveError ? (
            <div className="empty-state">
              <strong>No se pudo actualizar el job</strong>
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
          <strong>Ningún job seleccionado</strong>
          <p>Haz clic en una tarjeta del listado para ver su detalle.</p>
        </div>
      )}
    </section>
  )
}
