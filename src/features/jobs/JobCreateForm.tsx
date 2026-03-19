import { useMemo, useState, type FormEvent } from 'react'
import type { ClientListItem } from '../clients/types'
import type { PropertyListItem } from '../properties/types'
import type { QuoteListItem } from '../quotes/types'

interface JobCreateFormProps {
  clients: ClientListItem[]
  properties: PropertyListItem[]
  quotes: QuoteListItem[]
  onCreated: () => Promise<void>
}

interface FormState {
  client_id: string
  property_id: string
  quote_id: string
  scheduled_date: string
  status: string
  service_type: string
  notes: string
}

export function JobCreateForm({
  clients,
  properties,
  quotes,
  onCreated,
}: JobCreateFormProps) {
  const [form, setForm] = useState<FormState>({
    client_id: clients[0]?.id ?? '',
    property_id: '',
    quote_id: '',
    scheduled_date: '',
    status: 'scheduled',
    service_type: 'standard_cleaning',
    notes: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

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

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
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
        setSubmitError('Debes seleccionar un client.')
        return
      }

      if (!form.property_id) {
        setSubmitError('Debes seleccionar una property.')
        return
      }

      if (!form.scheduled_date) {
        setSubmitError('Debes indicar la fecha programada.')
        return
      }

      const jobId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? `JOB-${crypto.randomUUID()}`
          : `JOB-${Date.now()}`

      const response = await fetch(`${supabaseUrl}/rest/v1/jobs`, {
        method: 'POST',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: jobId,
          client_id: form.client_id,
          property_id: form.property_id,
          quote_id: form.quote_id || null,
          scheduled_date: form.scheduled_date,
          status: form.status,
          service_type: form.service_type,
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
        property_id: '',
        quote_id: '',
        scheduled_date: '',
        status: 'scheduled',
        service_type: 'standard_cleaning',
        notes: '',
      })
      setSuccessMessage('Job creado correctamente.')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido creando el job.'

      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="data-section">
      <div className="section-header">
        <h2>Nuevo job</h2>
        <p>Formulario mínimo inicial conectado a Supabase.</p>
      </div>

      {clients.length === 0 ? (
        <div className="empty-state">
          <strong>No hay clients disponibles</strong>
          <p>Primero debes crear al menos un client para poder crear un job.</p>
        </div>
      ) : (
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
              placeholder="Notas operativas del job"
              rows={4}
            />
          </label>

          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar job'}
            </button>
          </div>

          {submitError ? (
            <div className="empty-state">
              <strong>No se pudo crear el job</strong>
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
