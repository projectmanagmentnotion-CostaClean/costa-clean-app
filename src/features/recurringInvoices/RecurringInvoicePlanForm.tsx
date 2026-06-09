import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { formatPropertyLabel, formatQuoteLabel, formatRecurringPlanLabel } from '../../app/relationshipLabels'
import { businessRules } from '../../app/businessRules'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ContextualCreateSection } from '../../components/ContextualCreateSection'
import type { ClientListItem } from '../clients/types'
import type { PropertyListItem } from '../properties/types'
import { PropertyCreateForm } from '../properties/PropertyCreateForm'
import { QuoteCreateFlow } from '../quotes/QuoteCreateFlow'
import type { QuoteListItem } from '../quotes/types'
import {
  buildQuoteLinePayloads,
  calculateQuoteSubtotal,
  createBlankQuoteLine,
  createLocalId,
  formatMoneyInput,
  formatQuoteLineSubtotalInput,
  roundMoney,
} from '../quotes/quoteLineUtils'
import type { QuoteLineFormState } from '../quotes/quoteLineUtils'
import { saveRecurringInvoicePlan } from './recurringInvoiceApi'
import { getRecurringFrequencyLabel, calculateNextRecurringIssueDate } from './recurringInvoiceSchedule'
import type { RecurringInvoiceFrequency, RecurringInvoicePlanListItem } from './types'

interface RecurringInvoicePlanFormProps {
  clientId: string
  clients: ClientListItem[]
  properties: PropertyListItem[]
  quotes: QuoteListItem[]
  onSaved: () => Promise<void>
  initialPlan?: RecurringInvoicePlanListItem | null
  onCancel?: () => void
  onDirtyChange?: (isDirty: boolean) => void
}

interface FormState {
  property_id: string
  quote_id: string
  title: string
  frequency: RecurringInvoiceFrequency
  status: 'active' | 'paused' | 'archived'
  default_invoice_status: 'draft' | 'issued'
  next_issue_date: string
  tax_rate: string
  notes: string
  internal_notes: string
}

function todayLocalDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createDefaultState(): FormState {
  const today = todayLocalDate()

  return {
    property_id: '',
    quote_id: '',
    title: '',
    frequency: 'monthly',
    status: 'active',
    default_invoice_status: 'draft',
    next_issue_date: today,
    tax_rate: formatMoneyInput(businessRules.defaultTaxRate * 100),
    notes: '',
    internal_notes: '',
  }
}

function createFormStateFromPlan(plan: RecurringInvoicePlanListItem): FormState {
  return {
    property_id: plan.property_id ?? '',
    quote_id: plan.quote_id ?? '',
    title: plan.title,
    frequency: plan.frequency,
    status: plan.status,
    default_invoice_status: plan.default_invoice_status,
    next_issue_date: plan.next_issue_date,
    tax_rate: formatMoneyInput(plan.tax_rate * 100),
    notes: plan.notes ?? '',
    internal_notes: plan.internal_notes ?? '',
  }
}

function parsePercentInput(value: string): number {
  const normalized = value.trim().replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed / 100 : Number.NaN
}

export function RecurringInvoicePlanForm({
  clientId,
  clients,
  properties,
  quotes,
  onSaved,
  initialPlan = null,
  onCancel,
  onDirtyChange,
}: RecurringInvoicePlanFormProps) {
  const [form, setForm] = useState<FormState>(() => (
    initialPlan ? createFormStateFromPlan(initialPlan) : createDefaultState()
  ))
  const [lines, setLines] = useState<QuoteLineFormState[]>(() => (
    initialPlan
      ? initialPlan.template_lines.map((line) => ({
        local_id: createLocalId('RECURRING-LINE'),
        concept: line.concept,
        quantity: formatMoneyInput(line.quantity),
        unit: line.unit,
        unit_price: formatMoneyInput(line.unit_price),
      }))
      : [createBlankQuoteLine()]
  ))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showPropertyCreate, setShowPropertyCreate] = useState(false)
  const [showQuoteCreate, setShowQuoteCreate] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  const availableQuotes = useMemo(
    () => quotes.filter((quote) => !form.property_id || quote.property_id === form.property_id),
    [form.property_id, quotes],
  )
  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === form.property_id) ?? null,
    [properties, form.property_id],
  )
  const selectedQuote = useMemo(
    () => quotes.find((quote) => quote.id === form.quote_id) ?? null,
    [quotes, form.quote_id],
  )
  const subtotal = useMemo(() => calculateQuoteSubtotal(lines), [lines])
  const taxRate = parsePercentInput(form.tax_rate)
  const taxAmount = Number.isFinite(taxRate) ? roundMoney(subtotal * taxRate) : 0
  const total = roundMoney(subtotal + taxAmount)

  useEffect(() => {
    onDirtyChange?.(isDirty)
    return () => onDirtyChange?.(false)
  }, [isDirty, onDirtyChange])

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setIsDirty(true)
    setForm((current) => {
      const next = {
        ...current,
        [field]: value,
      }

      if (field === 'property_id') {
        next.quote_id = ''
      }

      return next
    })
  }

  function updateLine<K extends keyof QuoteLineFormState>(localId: string, field: K, value: QuoteLineFormState[K]) {
    setIsDirty(true)
    setLines((current) => current.map((line) => (
      line.local_id === localId ? { ...line, [field]: value } : line
    )))
  }

  function removeLine(localId: string) {
    setIsDirty(true)
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
      if (!form.title.trim()) {
        setSubmitError('Debes indicar un titulo para la automatizacion.')
        return
      }

      if (!form.next_issue_date) {
        setSubmitError('Debes indicar la proxima fecha de emision.')
        return
      }

      const parsedTaxRate = parsePercentInput(form.tax_rate)
      if (!Number.isFinite(parsedTaxRate) || parsedTaxRate < 0) {
        setSubmitError('El tipo de IVA debe ser un porcentaje valido.')
        return
      }

      const linePayloads = buildQuoteLinePayloads(lines, 'PLAN-TEMPLATE')
      if (!linePayloads || linePayloads.length === 0) {
        setSubmitError('Cada linea debe tener concepto, cantidad mayor que 0 y precio unitario valido.')
        return
      }

      await saveRecurringInvoicePlan({
        id: initialPlan?.id ?? createLocalId('RECURRING-PLAN'),
        client_id: clientId,
        property_id: form.property_id || null,
        quote_id: form.quote_id || null,
        title: form.title.trim(),
        frequency: form.frequency,
        status: form.status,
        default_invoice_status: form.default_invoice_status,
        next_issue_date: form.next_issue_date,
        tax_rate: parsedTaxRate,
        notes: form.notes.trim() || null,
        internal_notes: form.internal_notes.trim() || null,
        pricing_metadata: {
          preview_subtotal: subtotal,
          preview_tax_amount: taxAmount,
          preview_total: total,
          next_cycle_preview: calculateNextRecurringIssueDate(form.frequency, form.next_issue_date),
        },
        template_lines: linePayloads.map((line) => ({
          concept: line.concept,
          quantity: line.quantity,
          unit: line.unit,
          unit_price: line.unit_price,
          line_subtotal: line.line_subtotal,
        })),
      })

      await onSaved()
      if (!initialPlan) {
        setForm(createDefaultState())
        setLines([createBlankQuoteLine()])
      }
      setIsDirty(false)
      setSuccessMessage('Automatizacion recurrente guardada correctamente.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido guardando la automatizacion recurrente.'
      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  function requestCancel() {
    if (!onCancel) return
    if (!isDirty) {
      onCancel()
      return
    }

    setShowCancelConfirm(true)
  }

  return (
    <section className="data-section cc-form-shell cc-form-shell--invoice">
      <div className="section-header cc-form-shell__header">
        <div className="cc-form-shell__intro">
          <span className="cc-form-shell__eyebrow">Automatizacion recurrente</span>
          <h2>{initialPlan ? 'Editar automatizacion' : 'Nueva automatizacion recurrente'}</h2>
          <p>Programa facturas repetitivas por cliente con lineas reales reutilizables y proxima emision visible.</p>
        </div>

        <div className="cc-form-shell__summary">
          <div className="cc-form-shell__summary-card">
            <span>Plan</span>
            <strong>{formatRecurringPlanLabel({ id: initialPlan?.id ?? null, title: form.title, property_name: selectedProperty?.name ?? null, property_display_code: selectedProperty?.display_code ?? null })}</strong>
            <small>{getRecurringFrequencyLabel(form.frequency)} - siguiente {form.next_issue_date || 'Pendiente'}</small>
          </div>
          <div className="cc-form-shell__summary-card">
            <span>Vista previa</span>
            <strong>{formatMoneyInput(total)} €</strong>
            <small>{lines.length} linea(s) recurrentes</small>
          </div>
        </div>
      </div>

      <form className="lead-form cc-form-shell__grid" onSubmit={handleSubmit}>
        <div className="cc-form-shell__main">
          <section className="cc-form-shell__section">
            <div className="cc-form-shell__section-head">
              <strong>Base del plan</strong>
              <span>Propiedad, documento de referencia y configuracion de emision.</span>
            </div>

            <label className="form-field">
              <span>Titulo *</span>
              <input
                value={form.title}
                onChange={(event) => updateField('title', event.target.value)}
                placeholder="Ej. mantenimiento mensual oficina"
                required
              />
            </label>

            <label className="form-field">
              <span>Propiedad</span>
              <select
                value={form.property_id}
                onChange={(event) => updateField('property_id', event.target.value)}
              >
                <option value="">Sin propiedad fija</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {formatPropertyLabel(property)}
                  </option>
                ))}
              </select>
            </label>

            <ContextualCreateSection
              actionLabel="Crear propiedad"
              title="Propiedad en contexto"
              description="Si el plan recurrente necesita una nueva propiedad, créala aquí sin salir del cliente actual."
              isOpen={showPropertyCreate}
              onToggle={() => setShowPropertyCreate((current) => !current)}
            >
              <PropertyCreateForm
                clients={clients}
                onCreated={onSaved}
                onDirtyChange={setIsDirty}
                contextClientId={clientId}
                title="Nueva propiedad para recurrencia"
                description="La propiedad quedará asignada al plan al volver."
                submitLabel="Guardar propiedad y usarla"
                onCreatedProperty={async (property) => {
                  setForm((current) => ({
                    ...current,
                    property_id: property.id,
                    quote_id: '',
                  }))
                  setIsDirty(true)
                  setShowPropertyCreate(false)
                }}
              />
            </ContextualCreateSection>

            <label className="form-field">
              <span>Presupuesto de referencia</span>
              <select
                value={form.quote_id}
                onChange={(event) => updateField('quote_id', event.target.value)}
              >
                <option value="">Sin presupuesto fijo</option>
                {availableQuotes.map((quote) => (
                  <option key={quote.id} value={quote.id}>
                    {formatQuoteLabel({ ...quote, property_name: properties.find((property) => property.id === quote.property_id)?.name ?? null })}
                  </option>
                ))}
              </select>
            </label>

            <ContextualCreateSection
              actionLabel="Crear presupuesto"
              title="Presupuesto en contexto"
              description="Genera un presupuesto de referencia sin salir del plan recurrente."
              isOpen={showQuoteCreate}
              onToggle={() => setShowQuoteCreate((current) => !current)}
            >
              <QuoteCreateFlow
                clients={clients}
                properties={properties}
                onRefreshData={onSaved}
                onCompleted={async () => {}}
                onDirtyChange={setIsDirty}
                contextClientId={clientId}
                contextPropertyId={form.property_id || null}
                onCreatedQuote={async (quote) => {
                  setForm((current) => ({
                    ...current,
                    quote_id: quote.id,
                    property_id: quote.property_id ?? current.property_id,
                  }))
                  setIsDirty(true)
                  setShowQuoteCreate(false)
                }}
              />
            </ContextualCreateSection>

            <label className="form-field">
              <span>Cadencia</span>
              <select
                value={form.frequency}
                onChange={(event) => updateField('frequency', event.target.value as RecurringInvoiceFrequency)}
              >
                <option value="weekly">{getRecurringFrequencyLabel('weekly')}</option>
                <option value="biweekly">{getRecurringFrequencyLabel('biweekly')}</option>
                <option value="monthly">{getRecurringFrequencyLabel('monthly')}</option>
                <option value="quarterly">{getRecurringFrequencyLabel('quarterly')}</option>
              </select>
            </label>

            <label className="form-field">
              <span>Proxima emision *</span>
              <input
                type="date"
                value={form.next_issue_date}
                onChange={(event) => updateField('next_issue_date', event.target.value)}
                required
              />
            </label>

            <label className="form-field">
              <span>Estado por defecto</span>
              <select
                value={form.default_invoice_status}
                onChange={(event) => updateField('default_invoice_status', event.target.value as 'draft' | 'issued')}
              >
                <option value="draft">Borrador</option>
                <option value="issued">Emitida</option>
              </select>
            </label>

            <label className="form-field">
              <span>Estado del plan</span>
              <select
                value={form.status}
                onChange={(event) => updateField('status', event.target.value as 'active' | 'paused' | 'archived')}
              >
                <option value="active">Activo</option>
                <option value="paused">Pausado</option>
                <option value="archived">Archivado</option>
              </select>
            </label>

            <label className="form-field">
              <span>IVA (%)</span>
              <input
                value={form.tax_rate}
                onChange={(event) => updateField('tax_rate', event.target.value)}
                placeholder="21.00"
              />
            </label>
          </section>

          <section className="cc-form-shell__section cc-form-shell__section--full">
            <div className="cc-form-shell__section-head">
              <strong>Lineas recurrentes</strong>
              <span>Base real que se reutilizara cada vez que el plan emita una factura.</span>
            </div>

            <div className="form-field form-field-full">
              <span>Lineas *</span>
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
                onClick={() => {
                  setIsDirty(true)
                  setLines((current) => [...current, createBlankQuoteLine()])
                }}
              >
                Añadir linea
              </button>
            </div>
          </section>

          <section className="cc-form-shell__section cc-form-shell__section--full">
            <div className="cc-form-shell__section-head">
              <strong>Notas</strong>
              <span>Texto visible en factura y notas internas de operacion.</span>
            </div>

            <label className="form-field form-field-full">
              <span>Notas visibles</span>
              <textarea
                value={form.notes}
                onChange={(event) => updateField('notes', event.target.value)}
                rows={3}
              />
            </label>

            <label className="form-field form-field-full">
              <span>Notas internas</span>
              <textarea
                value={form.internal_notes}
                onChange={(event) => updateField('internal_notes', event.target.value)}
                rows={3}
              />
            </label>
          </section>

          {submitError ? (
            <div className="cc-alert cc-alert--error">
              <strong>No se pudo guardar la automatizacion</strong>
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
                <strong>{formatMoneyInput(subtotal)} €</strong>
              </div>
              <div className="cc-form-shell__totals-row">
                <span>IVA</span>
                <strong>{formatMoneyInput(taxAmount)} €</strong>
              </div>
              <div className="cc-form-shell__totals-row cc-form-shell__totals-row--grand">
                <span>Total</span>
                <strong>{formatMoneyInput(total)} €</strong>
              </div>
            </div>

            <div className="cc-form-shell__summary-card cc-form-shell__summary-card--stack">
              <span>Contexto</span>
              <strong>{selectedProperty ? formatPropertyLabel(selectedProperty) : 'Sin propiedad fija'}</strong>
              <small>{selectedQuote ? formatQuoteLabel({ ...selectedQuote, property_name: properties.find((property) => property.id === selectedQuote.property_id)?.name ?? null }) : 'Sin presupuesto fijo'}</small>
            </div>

            <div className="cc-form-shell__summary-card cc-form-shell__summary-card--stack">
              <span>Siguiente ciclo</span>
              <strong>{calculateNextRecurringIssueDate(form.frequency, form.next_issue_date)}</strong>
              <small>Cadencia {getRecurringFrequencyLabel(form.frequency).toLowerCase()}</small>
            </div>

            <div className="form-actions cc-form-shell__actions">
              {onCancel ? (
                <button type="button" className="secondary-button" onClick={requestCancel}>
                  Cancelar
                </button>
              ) : null}
              <button type="submit" className="primary-button" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : initialPlan ? 'Actualizar automatizacion' : 'Guardar automatizacion'}
              </button>
            </div>
          </div>
        </aside>
      </form>

      <ConfirmDialog
        isOpen={showCancelConfirm}
        title="Descartar automatizacion en curso"
        description="Has empezado a configurar esta automatizacion. Si cierras ahora, perderas los cambios no guardados."
        confirmLabel="Descartar cambios"
        tone="warning"
        onCancel={() => setShowCancelConfirm(false)}
        onConfirm={() => {
          setShowCancelConfirm(false)
          onCancel?.()
        }}
      />
    </section>
  )
}
