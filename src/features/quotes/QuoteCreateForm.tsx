import { useMemo, useState, type FormEvent } from 'react'
import { businessRules } from '../../app/businessRules'
import { formatClientLabel, formatPropertyLabel } from '../../app/relationshipLabels'
import { getStatusOptionLabel, quoteStatusOptions } from '../../app/statusOptions'
import type { ClientListItem } from '../clients/types'
import { saveQuoteWithLines } from '../financial/financialWriteApi'
import type { PropertyListItem } from '../properties/types'
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
  contextClientId?: string | null
  contextPropertyId?: string | null
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
  contextClientId = null,
  contextPropertyId = null,
}: QuoteCreateFormProps) {
  const [form, setForm] = useState<FormState>({
    client_id: contextClientId ?? '',
    property_id: contextPropertyId ?? '',
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

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === form.client_id) ?? null,
    [clients, form.client_id],
  )
  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === form.property_id) ?? null,
    [properties, form.property_id],
  )

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
        next.property_id = contextPropertyId ?? ''
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
      if (!form.client_id) {
        setSubmitError('Debes seleccionar un cliente.')
        return
      }

      const quoteId = createLocalId('QUOTE')
      const linePayloads = buildQuoteLinePayloads(lines, quoteId)

      if (!linePayloads || linePayloads.length === 0) {
        setSubmitError('Cada linea debe tener concepto, cantidad mayor que 0 y precio unitario valido.')
        return
      }

      await saveQuoteWithLines(
        {
          id: quoteId,
          client_id: form.client_id,
          lead_id: null,
          property_id: form.property_id || null,
          status: form.status,
          subtotal: subtotalValue,
          tax_amount: taxAmountValue,
          total: totalValue,
          notes: form.notes.trim() || null,
        },
        linePayloads,
      )

      await onCreated()
      setForm({
        client_id: contextClientId ?? '',
        property_id: contextPropertyId ?? '',
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
    <section className="data-section cc-form-shell cc-form-shell--quote">
      <div className="section-header cc-form-shell__header">
        <div className="cc-form-shell__intro">
          <span className="cc-form-shell__eyebrow">Propuesta comercial</span>
          <h2>Nuevo presupuesto</h2>
          <p>
            Crea una propuesta conectada a cliente y propiedad para mantener la trazabilidad completa hacia servicio y factura.
          </p>
        </div>

        <div className="cc-form-shell__summary">
          <div className="cc-form-shell__summary-card">
            <span>Cliente</span>
            <strong>{selectedClient ? formatClientLabel(selectedClient) : 'Pendiente'}</strong>
            <small>{availableProperties.length} propiedad(es) disponibles</small>
          </div>
          <div className="cc-form-shell__summary-card">
            <span>Ruta</span>
            <strong>Cliente - presupuesto - servicio - factura</strong>
            <small>{selectedProperty ? formatPropertyLabel(selectedProperty) : 'Asocia una propiedad para reforzar la trazabilidad operativa'}</small>
          </div>
          <div className="cc-form-shell__summary-card">
            <span>Total actual</span>
            <strong>{formatMoneyInput(totalValue)} €</strong>
            <small>{lines.length} linea(s)</small>
          </div>
        </div>
      </div>

      {clients.length === 0 ? (
        <div className="empty-state">
          <strong>No hay clientes disponibles</strong>
          <p>Primero debes crear al menos un cliente para poder generar un presupuesto.</p>
        </div>
      ) : (
        <form className="lead-form cc-form-shell__grid" onSubmit={handleSubmit}>
          <div className="cc-form-shell__main">
            <section className="cc-form-shell__section">
              <div className="cc-form-shell__section-head">
                <strong>Base del presupuesto</strong>
                <span>Cliente, propiedad y estado inicial del flujo comercial.</span>
              </div>

              <label className="form-field">
                <span>Cliente *</span>
                <select
                  value={form.client_id}
                  onChange={(event) => updateField('client_id', event.target.value)}
                  disabled={Boolean(contextClientId)}
                >
                  {!contextClientId ? <option value="">Selecciona un cliente</option> : null}
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {formatClientLabel(client)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span>Propiedad</span>
                <select
                  value={form.property_id}
                  onChange={(event) => updateField('property_id', event.target.value)}
                  disabled={Boolean(contextPropertyId)}
                >
                  {!contextPropertyId ? <option value="">Sin propiedad</option> : null}
                  {availableProperties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {formatPropertyLabel(property)}
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
                  {quoteStatusOptions.map((status) => (
                    <option key={status} value={status}>{getStatusOptionLabel(status)}</option>
                  ))}
                </select>
              </label>
            </section>

            <section className="cc-form-shell__section cc-form-shell__section--full">
              <div className="cc-form-shell__section-head">
                <strong>Lineas y alcance</strong>
                <span>Conceptos, cantidades y precios con lectura mas clara.</span>
              </div>

              <div className="form-field form-field-full">
                <span>Lineas de presupuesto *</span>
                <p className="cc-line-editor-note">El concepto manual se guardara exactamente como lo escribas.</p>
                <div className="cc-form-shell__line-list">
                  {lines.map((line, index) => (
                    <div key={line.local_id} className="lead-form cc-line-editor-row cc-line-editor-row--premium">
                      <label className="form-field form-field-full cc-line-editor-row__concept">
                        <span>Concepto {index + 1}</span>
                        <input
                          value={line.concept}
                          onChange={(event) => updateLine(line.local_id, 'concept', event.target.value)}
                          required
                        />
                      </label>

                      <label className="form-field cc-line-editor-row__field cc-line-editor-row__field--quantity">
                        <span>Cantidad</span>
                        <input
                          value={line.quantity}
                          onChange={(event) => updateLine(line.local_id, 'quantity', event.target.value)}
                          required
                        />
                      </label>

                      <label className="form-field cc-line-editor-row__field cc-line-editor-row__field--unit">
                        <span>Unidad</span>
                        <input
                          value={line.unit}
                          onChange={(event) => updateLine(line.local_id, 'unit', event.target.value)}
                          required
                        />
                      </label>

                      <label className="form-field cc-line-editor-row__field cc-line-editor-row__field--price">
                        <span>Precio unitario</span>
                        <input
                          value={line.unit_price}
                          onChange={(event) => updateLine(line.local_id, 'unit_price', event.target.value)}
                          required
                        />
                      </label>

                      <label className="form-field cc-line-editor-row__field cc-line-editor-row__field--amount">
                        <span>Importe</span>
                        <input value={formatQuoteLineSubtotalInput(line)} readOnly />
                      </label>

                      <div className="form-actions form-field-full cc-line-editor-row__actions">
                        <button
                          type="button"
                          className="secondary-button cc-line-editor-row__remove"
                          onClick={() => removeLine(line.local_id)}
                          disabled={lines.length === 1}
                        >
                          Quitar linea
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setLines((current) => [...current, createBlankQuoteLine()])}
                >
                  Añadir linea
                </button>
              </div>
            </section>

            <section className="cc-form-shell__section cc-form-shell__section--full">
              <div className="cc-form-shell__section-head">
                <strong>Notas y condiciones</strong>
                <span>Aclaraciones para el cliente o para el equipo.</span>
              </div>

              <label className="form-field form-field-full">
                <span>Notas</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => updateField('notes', event.target.value)}
                  placeholder="Condiciones, alcance o notas del presupuesto"
                  rows={4}
                />
              </label>
            </section>

            {submitError ? (
              <div className="cc-alert cc-alert--error">
                <strong>No se pudo crear el presupuesto</strong>
                <p>{submitError}</p>
              </div>
            ) : null}

            {successMessage ? (
              <div className="cc-alert cc-alert--success">
                <strong>Operacion correcta</strong>
                <p>{successMessage}</p>
              </div>
            ) : null}
          </div>

          <aside className="cc-form-shell__aside">
            <div className="cc-form-shell__sticky">
              <div className="cc-form-shell__totals">
                <div className="cc-form-shell__totals-row">
                  <span>Subtotal</span>
                  <strong>{formatMoneyInput(subtotalValue)} €</strong>
                </div>
                <div className="cc-form-shell__totals-row">
                  <span>IVA</span>
                  <strong>{formatMoneyInput(taxAmountValue)} €</strong>
                </div>
                <div className="cc-form-shell__totals-row cc-form-shell__totals-row--grand">
                  <span>Total</span>
                  <strong>{formatMoneyInput(totalValue)} €</strong>
                </div>
              </div>

              <div className="cc-form-shell__summary-card cc-form-shell__summary-card--stack">
                <span>Resultado</span>
                <strong>Presupuesto trazable</strong>
                <small>Se guardara con sus lineas, totales y relacion operativa lista para pasar a servicio.</small>
              </div>

              <div className="form-actions cc-form-shell__actions">
                <button type="submit" className="primary-button" disabled={isSubmitting}>
                  {isSubmitting ? 'Guardando...' : 'Guardar presupuesto'}
                </button>
              </div>
            </div>
          </aside>
        </form>
      )}
    </section>
  )
}
