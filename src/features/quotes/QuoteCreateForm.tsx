import { useMemo, useState, type FormEvent } from 'react'
import type { ClientListItem } from '../clients/types'
import type { PropertyListItem } from '../properties/types'
import { businessRules } from '../../app/businessRules'
import { getStatusLabel } from '../../app/displayText'
import {
  buildQuoteLinePayloads,
  calculateQuoteSubtotal,
  createBlankQuoteLine,
  createLocalId,
  formatMoneyInput,
  formatQuoteLineSubtotalInput,
  roundMoney,
} from './quoteLineUtils'
import type { QuoteLineFormState } from './quoteLineUtils'

interface QuoteCreateFormProps {
  clients: ClientListItem[]
  properties: PropertyListItem[]
  onCreated: () => Promise<void>
}

interface FormState {
  client_id: string
  property_id: string
  status: string
  notes: string
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
    notes: '',
  })
  const [lines, setLines] = useState<QuoteLineFormState[]>([createBlankQuoteLine()])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const availableProperties = useMemo(() => {
    if (!form.client_id) {
      return []
    }

    return properties.filter((property) => property.client_id === form.client_id)
  }, [properties, form.client_id])

  const subtotalValue = useMemo(() => calculateQuoteSubtotal(lines), [lines])
  const taxAmountValue = useMemo(
    () => roundMoney(subtotalValue * businessRules.defaultTaxRate),
    [subtotalValue],
  )
  const totalValue = useMemo(
    () => roundMoney(subtotalValue + taxAmountValue),
    [subtotalValue, taxAmountValue],
  )

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

  function updateLine<K extends keyof QuoteLineFormState>(
    localId: string,
    field: K,
    value: QuoteLineFormState[K],
  ) {
    setLines((current) => current.map((line) => (
      line.local_id === localId ? { ...line, [field]: value } : line
    )))
  }

  function removeLine(localId: string) {
    setLines((current) => (
      current.length > 1 ? current.filter((line) => line.local_id !== localId) : current
    ))
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

      const quoteId = createLocalId('QUOTE')
      const linePayloads = buildQuoteLinePayloads(lines, quoteId)

      if (!linePayloads || linePayloads.length === 0) {
        setSubmitError('Cada línea debe tener concepto, cantidad mayor que 0 y precio unitario válido.')
        return
      }

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
          subtotal: subtotalValue,
          tax_amount: taxAmountValue,
          total: totalValue,
          notes: form.notes.trim() || null,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        setSubmitError(`REST ${response.status}: ${errorText || response.statusText}`)
        return
      }

      const linesResponse = await fetch(`${supabaseUrl}/rest/v1/quote_lines`, {
        method: 'POST',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(linePayloads),
      })

      if (!linesResponse.ok) {
        const errorText = await linesResponse.text()
        setSubmitError(`Presupuesto creado, pero no se pudieron guardar las líneas. REST ${linesResponse.status}: ${errorText || linesResponse.statusText}`)
        return
      }

      await onCreated()
      setForm({
        client_id: clients[0]?.id ?? '',
        property_id: '',
        status: 'draft',
        notes: '',
      })
      setLines([createBlankQuoteLine()])
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
          Crea una propuesta comercial con líneas detalladas e IVA automático del {businessRules.defaultTaxRate * 100}%.
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

          <div className="form-field form-field-full">
            <span>Líneas de presupuesto *</span>
            {lines.map((line, index) => (
              <div key={line.local_id} className="lead-form" style={{ marginTop: '0.75rem' }}>
                <label className="form-field form-field-full">
                  <span>Concepto {index + 1}</span>
                  <input
                    value={line.concept}
                    onChange={(event) => updateLine(line.local_id, 'concept', event.target.value)}
                    required
                  />
                </label>

                <label className="form-field">
                  <span>Cantidad</span>
                  <input
                    value={line.quantity}
                    onChange={(event) => updateLine(line.local_id, 'quantity', event.target.value)}
                    required
                  />
                </label>

                <label className="form-field">
                  <span>Unidad</span>
                  <input
                    value={line.unit}
                    onChange={(event) => updateLine(line.local_id, 'unit', event.target.value)}
                    required
                  />
                </label>

                <label className="form-field">
                  <span>Precio unitario</span>
                  <input
                    value={line.unit_price}
                    onChange={(event) => updateLine(line.local_id, 'unit_price', event.target.value)}
                    required
                  />
                </label>

                <label className="form-field">
                  <span>Importe</span>
                  <input value={formatQuoteLineSubtotalInput(line)} readOnly />
                </label>

                <div className="form-actions form-field-full">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => removeLine(line.local_id)}
                    disabled={lines.length === 1}
                  >
                    Quitar línea
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              className="secondary-button"
              onClick={() => setLines((current) => [...current, createBlankQuoteLine()])}
              style={{ marginTop: '0.75rem' }}
            >
              Añadir línea
            </button>
          </div>

          <label className="form-field">
            <span>Subtotal</span>
            <input value={formatMoneyInput(subtotalValue)} readOnly />
          </label>

          <label className="form-field">
            <span>IVA (automático)</span>
            <input value={formatMoneyInput(taxAmountValue)} readOnly />
          </label>

          <label className="form-field">
            <span>Total (automático)</span>
            <input value={formatMoneyInput(totalValue)} readOnly />
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
