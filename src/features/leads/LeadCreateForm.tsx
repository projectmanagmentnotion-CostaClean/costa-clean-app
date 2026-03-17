import { useState, type FormEvent } from 'react'
import { getSupabaseClient } from '../../lib/supabase'

interface LeadCreateFormProps {
  onCreated: () => Promise<void>
}

interface FormState {
  full_name: string
  phone: string
  email: string
  service_type: string
  property_type: string
  city: string
  postal_code: string
  notes: string
}

const initialFormState: FormState = {
  full_name: '',
  phone: '',
  email: '',
  service_type: 'deep_cleaning',
  property_type: 'apartment',
  city: '',
  postal_code: '',
  notes: '',
}

export function LeadCreateForm({ onCreated }: LeadCreateFormProps) {
  const [form, setForm] = useState<FormState>(initialFormState)
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

    const { client, error } = getSupabaseClient()

    if (error || !client) {
      setSubmitError(error ?? 'No se pudo crear el cliente Supabase.')
      return
    }

    setIsSubmitting(true)

    try {
      const leadId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? `LEAD-${crypto.randomUUID()}`
          : `LEAD-${Date.now()}`

      const payload = {
        id: leadId,
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        service_type: form.service_type,
        property_type: form.property_type || null,
        city: form.city.trim() || null,
        postal_code: form.postal_code.trim() || null,
        notes: form.notes.trim() || null,
      }

      const { error: insertError } = await client.from('leads').insert(payload)

      if (insertError) {
        setSubmitError(insertError.message)
        return
      }

      setForm(initialFormState)
      setSuccessMessage('Lead creado correctamente.')
      await onCreated()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido creando el lead.'

      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="data-section">
      <div className="section-header">
        <h2>Nuevo lead</h2>
        <p>Formulario mínimo inicial conectado a Supabase.</p>
      </div>

      <form className="lead-form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Nombre completo *</span>
          <input
            value={form.full_name}
            onChange={(event) => updateField('full_name', event.target.value)}
            placeholder="Ej. Marta López"
            required
          />
        </label>

        <label className="form-field">
          <span>Teléfono *</span>
          <input
            value={form.phone}
            onChange={(event) => updateField('phone', event.target.value)}
            placeholder="Ej. 600123123"
            required
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
          <span>Tipo de servicio *</span>
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

        <label className="form-field">
          <span>Tipo de inmueble</span>
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

        <label className="form-field">
          <span>Ciudad</span>
          <input
            value={form.city}
            onChange={(event) => updateField('city', event.target.value)}
            placeholder="Ej. Barcelona"
          />
        </label>

        <label className="form-field">
          <span>Código postal</span>
          <input
            value={form.postal_code}
            onChange={(event) => updateField('postal_code', event.target.value)}
            placeholder="Ej. 08001"
          />
        </label>

        <label className="form-field form-field-full">
          <span>Notas</span>
          <textarea
            value={form.notes}
            onChange={(event) => updateField('notes', event.target.value)}
            placeholder="Notas iniciales del lead"
            rows={4}
          />
        </label>

        <div className="form-actions">
          <button type="submit" className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar lead'}
          </button>
        </div>

        {submitError ? (
          <div className="empty-state">
            <strong>No se pudo crear el lead</strong>
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
    </section>
  )
}
