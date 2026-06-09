import { useState, type FormEvent } from 'react'
import type { ClientListItem } from './types'

interface ClientBillingDetailsInlineFormProps {
  client: ClientListItem
  onSaved: (client: ClientListItem) => Promise<void> | void
}

interface FormState {
  tax_id: string
  billing_address: string
}

function buildHeaders(supabaseAnonKey: string) {
  return {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
    'Content-Type': 'application/json',
  }
}

export function ClientBillingDetailsInlineForm({
  client,
  onSaved,
}: ClientBillingDetailsInlineFormProps) {
  const [form, setForm] = useState<FormState>({
    tax_id: client.tax_id ?? '',
    billing_address: client.billing_address ?? '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSaving(true)

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseAnonKey) {
        setError('Faltan las variables de entorno de Supabase.')
        return
      }

      const taxId = form.tax_id.trim()
      const billingAddress = form.billing_address.trim()

      if (!taxId || !billingAddress) {
        setError('Debes completar NIF/CIF y direccion de facturacion.')
        return
      }

      const response = await fetch(
        `${supabaseUrl}/rest/v1/clients?id=eq.${encodeURIComponent(client.id)}`,
        {
          method: 'PATCH',
          headers: buildHeaders(supabaseAnonKey),
          body: JSON.stringify({
            tax_id: taxId,
            billing_address: billingAddress,
          }),
        },
      )

      if (!response.ok) {
        const errorText = await response.text()
        setError(`REST ${response.status}: ${errorText || response.statusText}`)
        return
      }

      await onSaved({
        ...client,
        tax_id: taxId,
        billing_address: billingAddress,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la ficha fiscal.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form className="lead-form" onSubmit={handleSubmit}>
      <label className="form-field">
        <span>NIF / CIF *</span>
        <input
          value={form.tax_id}
          onChange={(event) => updateField('tax_id', event.target.value)}
          placeholder="Ej. B12345678"
          required
        />
      </label>

      <label className="form-field form-field-full">
        <span>Direccion de facturacion *</span>
        <textarea
          value={form.billing_address}
          onChange={(event) => updateField('billing_address', event.target.value)}
          placeholder="Calle, numero, ciudad y codigo postal"
          rows={3}
          required
        />
      </label>

      {error ? (
        <div className="cc-alert cc-alert--error">
          <strong>No se pudo completar la ficha fiscal</strong>
          <p>{error}</p>
        </div>
      ) : null}

      <div className="form-actions">
        <button type="submit" className="primary-button" disabled={isSaving}>
          {isSaving ? 'Guardando...' : 'Guardar datos fiscales'}
        </button>
      </div>
    </form>
  )
}
