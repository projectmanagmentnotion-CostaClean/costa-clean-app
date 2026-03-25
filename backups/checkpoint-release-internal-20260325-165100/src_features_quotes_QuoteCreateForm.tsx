import { useMemo, useState, type FormEvent } from 'react'
import type { ClientListItem } from '../clients/types'
import type { PropertyListItem } from '../properties/types'
import { businessRules } from '../../app/businessRules'
import { getStatusLabel } from '../../app/displayText'

interface QuoteCreateFormProps {
  clients: ClientListItem[]
  properties: PropertyListItem[]
  onCreated: () => Promise<void>
}

interface FormState {
  client_id: string
  property_id: string
  status: string
  subtotal: string
  notes: string
}

function parseDecimalInput(value: string): number {
  const normalized = value.trim().replace(',', '.')
  const parsed = Number(normalized)

  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function formatMoneyInput(value: number): string {
  return value.toFixed(2)
}

export function QuoteCreateForm({
  clients,
  properties,
  onCreated,
}: QuoteCreateFormProps) {
  const [form, setForm] = useState<FormState>({
    client_id: clients[0]?.id ?? '',
    property_id: '',
    status: 'draft',
    subtotal: '0',
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

  const subtotalValue = useMemo(() => {
    return parseDecimalInput(form.subtotal)
  }, [form.subtotal])

  const taxAmountValue = useMemo(() => {
    if (Number.isNaN(subtotalValue)) {
      return Number.NaN
    }

    return subtotalValue * businessRules.defaultTaxRate
  }, [subtotalValue])

  const totalValue = useMemo(() => {
    if (Number.isNaN(subtotalValue) || Number.isNaN(taxAmountValue)) {
      return Number.NaN
    }

    return subtotalValue + taxAmountValue
  }, [subtotalValue, taxAmountValue])

  const taxAmountDisplay = Number.isNaN(taxAmountValue)
    ? ''
    : formatMoneyInput(taxAmountValue)

  const totalDisplay = Number.isNaN(totalValue)
    ? ''
    : formatMoneyInput(totalValue)

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => {
      const next = {
        ...current,
        [field]: value,
      }

      if (field === 'client_id') {
        next.property_id = ''
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
        setSubmitError('Debes seleccionar un cliente.')
        return
      }

      if (
        Number.isNaN(subtotalValue) ||
        Number.isNaN(taxAmountValue) ||
        Number.isNaN(totalValue)
      ) {
        setSubmitError('El subtotal debe ser un número válido.')
        return
      }

      const quoteId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? `QUOTE-${crypto.randomUUID()}`
          : `QUOTE-${Date.now()}`

      const response = await fetch(`${supabaseUrl}/rest/v1/quotes`, {
        method: 'POST',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: quoteId,
          client_id: form.client_id,
          property_id: form.property_id || null,
          status: form.status,
          subtotal: Number(formatMoneyInput(subtotalValue)),
          tax_amount: Number(formatMoneyInput(taxAmountValue)),
          total: Number(formatMoneyInput(totalValue)),
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
        status: 'draft',
        subtotal: '0',
        notes: '',
      })
      setSuccessMessage('Presupuesto creado correctamente.')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido creando el presupuesto.'

      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="data-section">
      <div className="section-header">
        <h2>Nuevo presupuesto</h2>
        <p>
          Crea una propuesta comercial con IVA automático del {businessRules.defaultTaxRate * 100}%.
        </p>
      </div>

      {clients.length === 0 ? (
        <div className="empty-state">
          <strong>No hay clientes disponibles</strong>
          <p>Primero debes crear al menos un cliente para poder generar un presupuesto.</p>
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
            <span>Propiedad</span>
            <select
              value={form.property_id}
              onChange={(event) => updateField('property_id', event.target.value)}
            >
              <option value="">Sin propiedad</option>
              {availableProperties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name} · {property.display_code ?? property.id}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Estado</span>
            <select
              value={form.status}
              onChange={(event) => updateField('status', event.target.value)}
            >
              <option value="draft">{getStatusLabel('draft')}</option>
              <option value="sent">{getStatusLabel('sent')}</option>
              <option value="accepted">{getStatusLabel('accepted')}</option>
              <option value="rejected">{getStatusLabel('rejected')}</option>
              <option value="expired">{getStatusLabel('expired')}</option>
            </select>
          </label>

          <label className="form-field">
            <span>Subtotal *</span>
            <input
              value={form.subtotal}
              onChange={(event) => updateField('subtotal', event.target.value)}
              placeholder="Ej. 120"
              required
            />
          </label>

          <label className="form-field">
            <span>IVA (automático)</span>
            <input
              value={taxAmountDisplay}
              placeholder="Calculado automáticamente"
              readOnly
            />
          </label>

          <label className="form-field">
            <span>Total (automático)</span>
            <input
              value={totalDisplay}
              placeholder="Calculado automáticamente"
              readOnly
            />
          </label>

          <label className="form-field form-field-full">
            <span>Notas</span>
            <textarea
              value={form.notes}
              onChange={(event) => updateField('notes', event.target.value)}
              placeholder="Condiciones, alcance o notas del presupuesto"
              rows={4}
            />
          </label>

          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar presupuesto'}
            </button>
          </div>

          {submitError ? (
            <div className="cc-alert cc-alert--error">
              <strong>No se pudo crear el presupuesto</strong>
              <p>{submitError}</p>
            </div>
          ) : null}

          {successMessage ? (
            <div className="cc-alert cc-alert--success">
              <strong>Operación correcta</strong>
              <p>{successMessage}</p>
            </div>
          ) : null}
        </form>
      )}
    </section>
  )
}
