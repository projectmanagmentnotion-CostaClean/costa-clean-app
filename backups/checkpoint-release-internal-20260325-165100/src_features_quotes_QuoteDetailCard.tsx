import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { QuoteListItem } from './types'
import type { ClientListItem } from '../clients/types'
import type { PropertyListItem } from '../properties/types'
import { businessRules } from '../../app/businessRules'
import { QuoteDocumentPreview } from './QuoteDocumentPreview'
import { getStatusLabel } from '../../app/displayText'
import { formatCurrency } from '../../app/displayFormat'

interface QuoteDetailCardProps {
  quote: QuoteListItem | null
  clients: ClientListItem[]
  properties: PropertyListItem[]
  onQuoteUpdated: () => Promise<void>
  onOpenDocument: () => void
}

interface EditFormState {
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

export function QuoteDetailCard({
  quote,
  clients,
  properties,
  onQuoteUpdated,
  onOpenDocument,
}: QuoteDetailCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [form, setForm] = useState<EditFormState>({
    client_id: '',
    property_id: '',
    status: 'draft',
    subtotal: '0',
    notes: '',
  })

  useEffect(() => {
    if (!quote) {
      setIsEditing(false)
      setSaveError(null)
      setSuccessMessage(null)
      setForm({
        client_id: '',
        property_id: '',
        status: 'draft',
        subtotal: '0',
        notes: '',
      })
      return
    }

    setIsEditing(false)
    setSaveError(null)
    setSuccessMessage(null)
    setForm({
      client_id: quote.client_id,
      property_id: quote.property_id ?? '',
      status: quote.status,
      subtotal: String(quote.subtotal),
      notes: quote.notes ?? '',
    })
  }, [quote])

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
      }

      return next
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!quote) {
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
        setSaveError('Debes seleccionar un cliente.')
        return
      }

      if (
        Number.isNaN(subtotalValue) ||
        Number.isNaN(taxAmountValue) ||
        Number.isNaN(totalValue)
      ) {
        setSaveError('El subtotal debe ser un número válido.')
        return
      }

      const response = await fetch(
        `${supabaseUrl}/rest/v1/quotes?id=eq.${encodeURIComponent(quote.id)}`,
        {
          method: 'PATCH',
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: form.client_id,
            property_id: form.property_id || null,
            status: form.status,
            subtotal: Number(formatMoneyInput(subtotalValue)),
            tax_amount: Number(formatMoneyInput(taxAmountValue)),
            total: Number(formatMoneyInput(totalValue)),
            notes: form.notes.trim() || null,
          }),
        },
      )

      if (!response.ok) {
        const errorText = await response.text()
        setSaveError(`REST ${response.status}: ${errorText || response.statusText}`)
        return
      }

      await onQuoteUpdated()
      setSuccessMessage('Presupuesto actualizado correctamente.')
      setIsEditing(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido actualizando el presupuesto.'

      setSaveError(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <section className="data-section">
        <div className="section-header page-header-actions">
          <div>
            <h2>Detalle del presupuesto</h2>
            <p>Consulta el presupuesto seleccionado, edítalo o abre su documento.</p>
          </div>

          {quote ? (
            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                className="primary-button"
                onClick={onOpenDocument}
              >
                Abrir documento
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setIsEditing((current) => !current)
                  setSaveError(null)
                  setSuccessMessage(null)
                  setForm({
                    client_id: quote.client_id,
                    property_id: quote.property_id ?? '',
                    status: quote.status,
                    subtotal: String(quote.subtotal),
                    notes: quote.notes ?? '',
                  })
                }}
              >
                {isEditing ? 'Cancelar edición' : 'Editar presupuesto'}
              </button>
            </div>
          ) : null}
        </div>

        {quote ? (
          <div className="lead-detail-card">
            <div className="lead-detail-header">
              <div>
                <h3>{quote.display_code ?? quote.id}</h3>
              </div>

              <span className="lead-badge">{getStatusLabel(quote.status)}</span>
            </div>

            {isEditing ? (
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
                    required
                  />
                </label>

                <label className="form-field">
                  <span>IVA (automático)</span>
                  <input value={taxAmountDisplay} readOnly />
                </label>

                <label className="form-field">
                  <span>Total (automático)</span>
                  <input value={totalDisplay} readOnly />
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
                  <div className="cc-alert cc-alert--error">
                    <strong>No se pudo actualizar el presupuesto</strong>
                    <p>{saveError}</p>
                  </div>
                ) : null}

                {successMessage ? (
                  <div className="cc-alert cc-alert--success">
                    <strong>Operación correcta</strong>
                    <p>{successMessage}</p>
                  </div>
                ) : null}
              </form>
            ) : (
              <div className="lead-detail-grid">
                <div className="detail-row">
                  <span className="detail-label">Código</span>
                  <strong>{quote.display_code ?? quote.id}</strong>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Cliente</span>
                  <strong>{quote.client_display_code ?? quote.client_id}</strong>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Propiedad</span>
                  <strong>{quote.property_display_code ?? quote.property_id ?? 'Sin propiedad'}</strong>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Estado</span>
                  <strong>{getStatusLabel(quote.status)}</strong>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Subtotal</span>
                  <strong>{formatCurrency(quote.subtotal)}</strong>
                </div>

                <div className="detail-row">
                  <span className="detail-label">IVA</span>
                  <strong>{formatCurrency(quote.tax_amount ?? 0)}</strong>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Total</span>
                  <strong>{formatCurrency(quote.total)}</strong>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Notas</span>
                  <strong>{quote.notes ?? 'Sin notas'}</strong>
                </div>
              </div>
            )}

            {!isEditing && saveError ? (
              <div className="cc-alert cc-alert--error">
                <strong>No se pudo actualizar el presupuesto</strong>
                <p>{saveError}</p>
              </div>
            ) : null}

            {!isEditing && successMessage ? (
              <div className="cc-alert cc-alert--success">
                <strong>Operación correcta</strong>
                <p>{successMessage}</p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="empty-state">
            <strong>Ningún presupuesto seleccionado</strong>
            <p>Haz clic en una tarjeta del listado para ver su detalle.</p>
          </div>
        )}
      </section>

      <QuoteDocumentPreview
        quote={quote}
        clients={clients}
        properties={properties}
      />
    </>
  )
}
