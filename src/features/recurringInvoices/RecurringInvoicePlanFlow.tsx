import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { businessRules } from '../../app/businessRules'
import { formatPropertyLabel, formatQuoteLabel, formatRecurringPlanLabel } from '../../app/relationshipLabels'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ContextualCreateSection } from '../../components/ContextualCreateSection'
import { FullscreenStepFlow } from '../../components/FullscreenStepFlow'
import { ClientCreateForm } from '../clients/ClientCreateForm'
import type { ClientListItem } from '../clients/types'
import { PropertyCreateFlow } from '../properties/PropertyCreateFlow'
import type { PropertyListItem } from '../properties/types'
import { QuoteCreateFlow } from '../quotes/QuoteCreateFlow'
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
import type { QuoteListItem } from '../quotes/types'
import type { FullViewActionFlowProps } from '../shared/actionFlowLifecycle'
import { completeContextualActionFlow, completeFullViewActionFlow } from '../shared/actionFlowLifecycle'
import { saveRecurringInvoicePlan } from './recurringInvoiceApi'
import { calculateNextRecurringIssueDate, getRecurringFrequencyLabel } from './recurringInvoiceSchedule'
import type {
  RecurringInvoiceFrequency,
  RecurringInvoicePlanInvoiceStatus,
  RecurringInvoicePlanListItem,
  RecurringInvoicePlanStatus,
} from './types'

interface RecurringInvoicePlanFlowProps extends FullViewActionFlowProps {
  clientId?: string | null
  clients: ClientListItem[]
  properties: PropertyListItem[]
  quotes: QuoteListItem[]
  initialPlan?: RecurringInvoicePlanListItem | null
}

interface FormState {
  client_id: string
  property_id: string
  quote_id: string
  title: string
  frequency: RecurringInvoiceFrequency
  status: RecurringInvoicePlanStatus
  default_invoice_status: RecurringInvoicePlanInvoiceStatus
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

function createDefaultState(clientId: string | null): FormState {
  return {
    client_id: clientId ?? '',
    property_id: '',
    quote_id: '',
    title: '',
    frequency: 'monthly',
    status: 'active',
    default_invoice_status: 'draft',
    next_issue_date: todayLocalDate(),
    tax_rate: formatMoneyInput(businessRules.defaultTaxRate * 100),
    notes: '',
    internal_notes: '',
  }
}

function createFormStateFromPlan(plan: RecurringInvoicePlanListItem): FormState {
  return {
    client_id: plan.client_id,
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

export function RecurringInvoicePlanFlow({
  clientId = null,
  clients,
  properties,
  quotes,
  onRefreshData,
  onCompleted,
  initialPlan = null,
  onCancel,
  onDirtyChange,
}: RecurringInvoicePlanFlowProps) {
  const [form, setForm] = useState<FormState>(() => (
    initialPlan ? createFormStateFromPlan(initialPlan) : createDefaultState(clientId)
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
  const [currentStep, setCurrentStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showClientCreate, setShowClientCreate] = useState(false)
  const [showPropertyCreate, setShowPropertyCreate] = useState(false)
  const [showQuoteCreate, setShowQuoteCreate] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  useEffect(() => {
    onDirtyChange?.(isDirty)
    return () => onDirtyChange?.(false)
  }, [isDirty, onDirtyChange])

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === form.client_id) ?? null,
    [clients, form.client_id],
  )
  const availableProperties = useMemo(
    () => properties.filter((property) => !form.client_id || property.client_id === form.client_id),
    [form.client_id, properties],
  )
  const availableQuotes = useMemo(
    () => quotes.filter((quote) => {
      if (form.client_id && quote.client_id !== form.client_id) return false
      if (form.property_id && quote.property_id !== form.property_id) return false
      return true
    }),
    [form.client_id, form.property_id, quotes],
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

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setIsDirty(true)
    setForm((current) => {
      const next = {
        ...current,
        [field]: value,
      }

      if (field === 'client_id') {
        next.property_id = ''
        next.quote_id = ''
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
    setIsSubmitting(true)

    try {
      if (!form.client_id) {
        setSubmitError('Debes indicar el cliente base de la automatizacion.')
        return
      }

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
        client_id: form.client_id,
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

      setIsDirty(false)
      await completeFullViewActionFlow({ onRefreshData, onCompleted })
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
    <FullscreenStepFlow
      eyebrow="Recurrencia"
      title={initialPlan ? 'Editar automatizacion recurrente' : 'Nueva automatizacion recurrente'}
      description="Planifica facturas repetitivas con cliente, propiedad, frecuencia y plantilla real de lineas."
      steps={[
        { id: 'context', label: 'Contexto', description: 'Cliente, propiedad y origen' },
        { id: 'billing', label: 'Cadencia y lineas', description: 'Frecuencia, emision y plantilla' },
        { id: 'review', label: 'Revision final', description: 'Notas, estado y cierre' },
      ]}
      currentStep={currentStep}
      onStepSelect={setCurrentStep}
      contextItems={[
        {
          label: 'Cliente',
          value: selectedClient?.full_name ?? 'Pendiente',
          hint: clientId ? 'Heredado desde el contexto actual' : 'Obligatorio para el plan',
        },
        {
          label: 'Proxima emision',
          value: form.next_issue_date || 'Pendiente',
          hint: getRecurringFrequencyLabel(form.frequency),
        },
        {
          label: 'Vista previa',
          value: `${formatMoneyInput(total)} EUR`,
          hint: `${lines.length} linea(s) recurrentes`,
        },
      ]}
      sideContent={(
        <>
          <div className="cc-form-shell__summary-card cc-form-shell__summary-card--stack">
            <span>Plan</span>
            <strong>{formatRecurringPlanLabel({ id: initialPlan?.id ?? null, title: form.title, property_name: selectedProperty?.name ?? null, property_display_code: selectedProperty?.display_code ?? null })}</strong>
            <small>{getRecurringFrequencyLabel(form.frequency)} · siguiente {form.next_issue_date || 'Pendiente'}</small>
          </div>
          <div className="cc-form-shell__summary-card cc-form-shell__summary-card--stack">
            <span>Siguiente ciclo</span>
            <strong>{calculateNextRecurringIssueDate(form.frequency, form.next_issue_date)}</strong>
            <small>{selectedQuote ? formatQuoteLabel(selectedQuote) : 'Sin presupuesto fijo'}</small>
          </div>
        </>
      )}
    >
      <form className="lead-form cc-detail-panel__editor" onSubmit={handleSubmit}>
        {currentStep === 0 ? (
          <section className="cc-form-shell__section">
            <div className="cc-form-shell__section-head">
              <strong>Contexto base</strong>
              <span>Define que se automatiza y sobre que cliente o propiedad se apoyara.</span>
            </div>

            <label className="form-field">
              <span>Cliente *</span>
              <select
                value={form.client_id}
                onChange={(event) => updateField('client_id', event.target.value)}
                disabled={Boolean(clientId)}
              >
                {!clientId ? <option value="">Selecciona un cliente</option> : null}
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.full_name} · {client.display_code ?? client.id}
                  </option>
                ))}
              </select>
            </label>

            {!clientId ? (
              <ContextualCreateSection
                actionLabel="Crear cliente"
                title="Falta el cliente base"
                description="Resuelve el cliente dentro del mismo flujo sin perder lo ya configurado."
                isOpen={showClientCreate}
                onToggle={() => setShowClientCreate((current) => !current)}
              >
                <ClientCreateForm
                  onCreated={onRefreshData}
                  onDirtyChange={setIsDirty}
                  title="Nuevo cliente en contexto"
                  description="Al guardarlo, quedara seleccionado automaticamente en el plan."
                  submitLabel="Guardar cliente y usarlo"
                  onCreatedClient={async (client) => {
                    setForm((current) => ({
                      ...current,
                      client_id: client.id,
                    }))
                    setIsDirty(true)
                    setShowClientCreate(false)
                  }}
                />
              </ContextualCreateSection>
            ) : null}

            <label className="form-field">
              <span>Titulo *</span>
              <input
                value={form.title}
                onChange={(event) => updateField('title', event.target.value)}
                placeholder="Ej. mantenimiento mensual oficinas"
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
                {availableProperties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {formatPropertyLabel(property)}
                  </option>
                ))}
              </select>
            </label>

            <ContextualCreateSection
              actionLabel="Crear propiedad"
              title="Propiedad en contexto"
              description="Si el plan necesita un inmueble nuevo, crealo aqui y sigue sin romper el flujo."
              isOpen={showPropertyCreate}
              onToggle={() => setShowPropertyCreate((current) => !current)}
            >
              <PropertyCreateFlow
                clients={clients}
                onRefreshData={onRefreshData}
                onCompleted={async () => {}}
                onDirtyChange={setIsDirty}
                contextClientId={form.client_id || null}
                title="Nueva propiedad para recurrencia"
                description="La propiedad quedara lista para vincularse a este plan recurrente."
                submitLabel="Guardar propiedad y usarla"
                onCreatedProperty={async (property) => {
                  await completeContextualActionFlow({
                    created: property,
                    applyCreated: async (createdProperty) => {
                      setForm((current) => ({
                        ...current,
                        property_id: createdProperty.id,
                        quote_id: '',
                      }))
                    },
                    closeSubflow: () => setShowPropertyCreate(false),
                    markDirty: () => setIsDirty(true),
                  })
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
              description="Genera un presupuesto de referencia sin abandonar la automatizacion."
              isOpen={showQuoteCreate}
              onToggle={() => setShowQuoteCreate((current) => !current)}
            >
              <QuoteCreateFlow
                clients={clients}
                properties={properties}
                onRefreshData={onRefreshData}
                onCompleted={async () => {}}
                onDirtyChange={setIsDirty}
                contextClientId={form.client_id || null}
                contextPropertyId={form.property_id || null}
                onCreatedQuote={async (quote) => {
                  await completeContextualActionFlow({
                    created: quote,
                    applyCreated: async (createdQuote) => {
                      setForm((current) => ({
                        ...current,
                        quote_id: createdQuote.id,
                        property_id: createdQuote.property_id ?? current.property_id,
                      }))
                    },
                    closeSubflow: () => setShowQuoteCreate(false),
                    markDirty: () => setIsDirty(true),
                  })
                }}
              />
            </ContextualCreateSection>
          </section>
        ) : null}

        {currentStep === 1 ? (
          <section className="cc-form-shell__section">
            <div className="cc-form-shell__section-head">
              <strong>Cadencia y plantilla</strong>
              <span>Frecuencia, proxima emision y lineas reutilizables de cada ciclo.</span>
            </div>

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
              <span>IVA (%)</span>
              <input
                value={form.tax_rate}
                onChange={(event) => updateField('tax_rate', event.target.value)}
                placeholder="21.00"
              />
            </label>

            <div className="form-field form-field-full">
              <span>Lineas recurrentes *</span>
              <div className="cc-detail-panel__line-items">
                {lines.map((line, index) => (
                  <div key={line.local_id} className="lead-form cc-detail-panel__line-item" style={{ marginTop: '0.75rem' }}>
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
                style={{ marginTop: '0.75rem' }}
              >
                Añadir linea
              </button>
            </div>
          </section>
        ) : null}

        {currentStep === 2 ? (
          <section className="cc-form-shell__section">
            <div className="cc-form-shell__section-head">
              <strong>Revision final</strong>
              <span>Estado del plan, comportamiento por defecto y notas de seguimiento.</span>
            </div>

            <label className="form-field">
              <span>Estado por defecto de factura</span>
              <select
                value={form.default_invoice_status}
                onChange={(event) => updateField('default_invoice_status', event.target.value as RecurringInvoicePlanInvoiceStatus)}
              >
                <option value="draft">Borrador</option>
                <option value="issued">Emitida</option>
              </select>
            </label>

            <label className="form-field">
              <span>Estado del plan</span>
              <select
                value={form.status}
                onChange={(event) => updateField('status', event.target.value as RecurringInvoicePlanStatus)}
              >
                <option value="active">Activo</option>
                <option value="paused">Pausado</option>
                <option value="archived">Archivado</option>
              </select>
            </label>

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

            <div className="cc-form-shell__totals">
              <div className="cc-form-shell__totals-row">
                <span>Subtotal</span>
                <strong>{formatMoneyInput(subtotal)} EUR</strong>
              </div>
              <div className="cc-form-shell__totals-row">
                <span>IVA</span>
                <strong>{formatMoneyInput(taxAmount)} EUR</strong>
              </div>
              <div className="cc-form-shell__totals-row cc-form-shell__totals-row--grand">
                <span>Total</span>
                <strong>{formatMoneyInput(total)} EUR</strong>
              </div>
            </div>
          </section>
        ) : null}

        {submitError ? (
          <div className="cc-alert cc-alert--error">
            <strong>No se pudo guardar la automatizacion</strong>
            <p>{submitError}</p>
          </div>
        ) : null}

        <div className="form-actions">
          {currentStep > 0 ? (
            <button type="button" className="secondary-button" onClick={() => setCurrentStep((step) => step - 1)}>
              Volver
            </button>
          ) : onCancel ? (
            <button type="button" className="secondary-button" onClick={requestCancel}>
              Cancelar
            </button>
          ) : null}

          {currentStep < 2 ? (
            <button type="button" className="primary-button" onClick={() => setCurrentStep((step) => step + 1)}>
              Siguiente
            </button>
          ) : (
            <button type="submit" className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : initialPlan ? 'Actualizar automatizacion' : 'Guardar automatizacion'}
            </button>
          )}
        </div>
      </form>

      <ConfirmDialog
        isOpen={showCancelConfirm}
        title="Descartar automatizacion en curso"
        description="Has empezado a configurar esta automatizacion. Si la cierras ahora, perderas los cambios no guardados."
        confirmLabel="Descartar cambios"
        tone="warning"
        onCancel={() => setShowCancelConfirm(false)}
        onConfirm={() => {
          setShowCancelConfirm(false)
          onCancel?.()
        }}
      />
    </FullscreenStepFlow>
  )
}
