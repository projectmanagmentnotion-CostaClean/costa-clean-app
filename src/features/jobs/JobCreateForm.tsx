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
  billing_concept: string
  billing_quantity: string
  billing_unit: string
  billing_unit_price: string
  notes: string
}

function getServiceTypeOptionLabel(value: string): string {
  switch (value) {
    case 'standard_cleaning': return 'Limpieza estándar'
    case 'deep_cleaning': return 'Limpieza profunda'
    case 'post_construction': return 'Limpieza fin de obra'
    case 'check_out_cleaning': return 'Limpieza check-out'
    case 'airbnb_turnover': return 'Cambio Airbnb'
    case 'glass_cleaning': return 'Limpieza de cristales'
    default: return value
  }
}

function parseDecimalInput(value: string): number {
  const normalized = value.trim().replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : Number.NaN
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
    billing_concept: getServiceTypeOptionLabel('standard_cleaning'),
    billing_quantity: '1',
    billing_unit: 'servicio',
    billing_unit_price: '',
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

      if (field === 'service_type') {
        const currentConcept = current.billing_concept.trim()
        const previousServiceConcept = getServiceTypeOptionLabel(current.service_type)
        if (!currentConcept || currentConcept === previousServiceConcept) {
          next.billing_concept = getServiceTypeOptionLabel(String(value))
        }
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

      if (!form.property_id) {
        setSubmitError('Debes seleccionar una propiedad.')
        return
      }

      if (!form.scheduled_date) {
        setSubmitError('Debes indicar la fecha programada.')
        return
      }

      const billingQuantity = parseDecimalInput(form.billing_quantity)
      const billingUnitPrice = form.billing_unit_price.trim()
        ? parseDecimalInput(form.billing_unit_price)
        : null

      if (Number.isNaN(billingQuantity) || billingQuantity <= 0) {
        setSubmitError('La cantidad de facturación debe ser mayor que 0.')
        return
      }

      if (billingUnitPrice !== null && (Number.isNaN(billingUnitPrice) || billingUnitPrice < 0)) {
        setSubmitError('El precio unitario debe estar vacío o ser mayor o igual que 0.')
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
          billing_concept: form.billing_concept.trim() || null,
          billing_quantity: billingQuantity,
          billing_unit: form.billing_unit.trim() || 'servicio',
          billing_unit_price: billingUnitPrice,
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
        billing_concept: getServiceTypeOptionLabel('standard_cleaning'),
        billing_quantity: '1',
        billing_unit: 'servicio',
        billing_unit_price: '',
        notes: '',
      })
      setSuccessMessage('Servicio creado correctamente.')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido creando el servicio.'

      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="data-section">
      <div className="section-header">
        <h2>Nuevo servicio</h2>
        <p>Formulario mínimo inicial conectado a Supabase.</p>
      </div>

      {clients.length === 0 ? (
        <div className="empty-state">
          <strong>No hay clientes disponibles</strong>
          <p>Primero debes crear al menos un cliente para poder crear un servicio.</p>
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
            <span>Propiedad *</span>
            <select
              value={form.property_id}
              onChange={(event) => updateField('property_id', event.target.value)}
            >
              <option value="">Selecciona una propiedad</option>
              {availableProperties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name} · {property.display_code ?? property.id}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Presupuesto</span>
            <select
              value={form.quote_id}
              onChange={(event) => updateField('quote_id', event.target.value)}
            >
              <option value="">Sin presupuesto</option>
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
            <span>Concepto de facturación</span>
            <input
              value={form.billing_concept}
              onChange={(event) => updateField('billing_concept', event.target.value)}
              placeholder="Descripción profesional que se mostrará en factura"
            />
          </label>

          <label className="form-field">
            <span>Cantidad de facturación *</span>
            <input
              value={form.billing_quantity}
              onChange={(event) => updateField('billing_quantity', event.target.value)}
              required
            />
          </label>

          <label className="form-field">
            <span>Unidad de facturación *</span>
            <input
              value={form.billing_unit}
              onChange={(event) => updateField('billing_unit', event.target.value)}
              placeholder="servicio, hora, m²..."
              required
            />
          </label>

          <label className="form-field">
            <span>Precio unitario</span>
            <input
              value={form.billing_unit_price}
              onChange={(event) => updateField('billing_unit_price', event.target.value)}
              placeholder="Opcional"
            />
          </label>

          <label className="form-field form-field-full">
            <span>Notas</span>
            <textarea
              value={form.notes}
              onChange={(event) => updateField('notes', event.target.value)}
              placeholder="Notas operativas del servicio"
              rows={4}
            />
          </label>

          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar servicio'}
            </button>
          </div>

          {submitError ? (
            <div className="empty-state">
              <strong>No se pudo crear el servicio</strong>
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
