import { useEffect, useState, type FormEvent } from 'react'
import { normalizeClientFiscalData } from './clientFiscalData'
import { updateClientFiscalData } from './clientWriteApi'
import type { ClientListItem } from './types'

interface ClientBillingDetailsInlineFormProps {
  client: ClientListItem
  onSaved: (client: ClientListItem) => Promise<void> | void
}

interface FormState {
  tax_id: string
  billing_address: string
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    setForm({
      tax_id: client.tax_id ?? '',
      billing_address: client.billing_address ?? '',
    })
    setError(null)
    setSuccessMessage(null)
  }, [client.billing_address, client.id, client.tax_id])

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setSuccessMessage(null)
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccessMessage(null)
    setIsSaving(true)

    try {
      const normalizedFiscalData = normalizeClientFiscalData(form)
      const taxId = normalizedFiscalData.tax_id
      const billingAddress = normalizedFiscalData.billing_address

      if (!taxId || !billingAddress) {
        setError('Debes completar NIF/CIF y direccion de facturacion.')
        return
      }

      const updatedClient = await updateClientFiscalData(client.id, {
        tax_id: taxId,
        billing_address: billingAddress,
      })
      setForm({
        tax_id: updatedClient.tax_id ?? taxId,
        billing_address: updatedClient.billing_address ?? billingAddress,
      })
      await onSaved(updatedClient)
      setSuccessMessage('Datos fiscales guardados correctamente.')
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

      {successMessage ? (
        <div className="cc-alert cc-alert--success">
          <strong>Ficha fiscal actualizada</strong>
          <p>{successMessage}</p>
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
