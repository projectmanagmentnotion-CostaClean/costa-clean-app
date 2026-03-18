import { useState, type FormEvent } from 'react'

interface ClientCreateFormProps {
  onCreated: () => Promise<void>
}

interface FormState {
  full_name: string
  phone: string
  email: string
  status: string
}

const initialFormState: FormState = {
  full_name: '',
  phone: '',
  email: '',
  status: 'active',
}

export function ClientCreateForm({ onCreated }: ClientCreateFormProps) {
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
    setIsSubmitting(true)

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseAnonKey) {
        setSubmitError('Faltan las variables de entorno de Supabase.')
        return
      }

      const clientId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? `CLIENT-${crypto.randomUUID()}`
          : `CLIENT-${Date.now()}`

      const response = await fetch(`${supabaseUrl}/rest/v1/clients`, {
        method: 'POST',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: clientId,
          full_name: form.full_name.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          status: form.status,
          source_lead_id: null,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        setSubmitError(`REST ${response.status}: ${errorText || response.statusText}`)
        return
      }

      await onCreated()
      setForm(initialFormState)
      setSuccessMessage('Client creado correctamente.')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido creando el client.'

      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="data-section">
      <div className="section-header">
        <h2>Nuevo client</h2>
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
          <span>Teléfono</span>
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
          <button type="submit" className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar client'}
          </button>
        </div>

        {submitError ? (
          <div className="empty-state">
            <strong>No se pudo crear el client</strong>
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
