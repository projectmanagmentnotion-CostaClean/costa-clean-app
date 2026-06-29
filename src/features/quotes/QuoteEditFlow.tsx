import { useEffect, useMemo, useState } from 'react'
import { businessRules } from '../../app/businessRules'
import { formatCurrency } from '../../app/displayFormat'
import { formatClientLabel, formatPropertyLabel } from '../../app/relationshipLabels'
import { getStatusOptionLabel, quoteStatusOptions } from '../../app/statusOptions'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { FullscreenStepFlow, type FullscreenStepFlowContextItem } from '../../components/FullscreenStepFlow'
import { findQuoteDuplicateGroups } from '../duplicates/duplicateEngine'
import { DuplicateReviewOverlay } from '../duplicates/DuplicateReviewOverlay'
import { saveQuoteWithLines } from '../financial/financialWriteApi'
import { completeFullViewActionFlow, type FullViewActionFlowProps } from '../shared/actionFlowLifecycle'
import {
  buildQuoteLinePayloads,
  calculateQuoteSubtotal,
  createBlankQuoteLine,
  formatMoneyInput,
  formatQuoteLineSubtotalInput,
  getFormLinesFromQuote,
  roundMoney,
} from './quoteLineUtils'
import type { QuoteLineFormState } from './quoteLineUtils'
import type { QuoteListItem } from './types'
import type { ClientListItem } from '../clients/types'
import type { PropertyListItem } from '../properties/types'
import '../shared/fullscreen-create-flow.css'

interface QuoteEditFlowProps extends FullViewActionFlowProps {
  quote: QuoteListItem
  clients: ClientListItem[]
  properties: PropertyListItem[]
  title?: string
  description?: string
  submitLabel?: string
  allQuotes?: QuoteListItem[]
  onOpenExistingQuote?: (quoteId: string) => void
}

interface EditFormState {
  client_id: string | null
  property_id: string
  status: string
  notes: string
}

const quoteEditSteps = [
  { id: 'context', label: 'Contexto comercial', description: 'Cliente, propiedad, estado y notas visibles.' },
  { id: 'lines', label: 'Lineas e importes', description: 'Edita alcance, cantidades y precios sin mezclar otras tareas.' },
  { id: 'review', label: 'Revision final', description: 'Confirma la lectura final antes de guardar.' },
]

function buildClientSummaryLabel(quote: QuoteListItem, clients: ClientListItem[]): string {
  const client = clients.find((item) => item.id === quote.client_id)
  return client?.full_name?.trim()
    || quote.client_display_code
    || quote.lead_name
    || quote.lead_display_code
    || quote.client_id
    || 'Lead sin cliente'
}

function buildPropertySummaryLabel(quote: QuoteListItem, properties: PropertyListItem[]): string {
  if (!quote.property_id) return 'Sin propiedad'

  const property = properties.find((item) => item.id === quote.property_id)
  return property?.name?.trim() || quote.property_display_code || quote.property_id
}

export function QuoteEditFlow({
  quote,
  clients,
  properties,
  onRefreshData,
  onCompleted,
  onCancel,
  onDirtyChange,
  title = 'Editar presupuesto',
  description = 'La edicion principal vive en un flujo separado para no convertir la card de detalle en un formulario largo.',
  submitLabel = 'Guardar cambios',
  allQuotes = [],
  onOpenExistingQuote,
}: QuoteEditFlowProps) {
  const [form, setForm] = useState<EditFormState>({
    client_id: quote.client_id ?? null,
    property_id: quote.property_id ?? '',
    status: quote.status,
    notes: quote.notes ?? '',
  })
  const [lines, setLines] = useState<QuoteLineFormState[]>(getFormLinesFromQuote(quote, properties))
  const [currentStep, setCurrentStep] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showRejectedConfirm, setShowRejectedConfirm] = useState(false)
  const [pendingDuplicateGroups, setPendingDuplicateGroups] = useState<ReturnType<typeof findQuoteDuplicateGroups>>([])

  useEffect(() => {
    setForm({
      client_id: quote.client_id ?? null,
      property_id: quote.property_id ?? '',
      status: quote.status,
      notes: quote.notes ?? '',
    })
    setLines(getFormLinesFromQuote(quote, properties))
    setCurrentStep(0)
    setError(null)
    setIsDirty(false)
  }, [properties, quote])

  useEffect(() => {
    onDirtyChange?.(isDirty)
    return () => onDirtyChange?.(false)
  }, [isDirty, onDirtyChange])

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === form.client_id) ?? null,
    [clients, form.client_id],
  )
  const availableProperties = useMemo(() => {
    if (!form.client_id) return []
    return properties.filter((property) => property.client_id === form.client_id)
  }, [form.client_id, properties])
  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === form.property_id) ?? null,
    [form.property_id, properties],
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

  function updateField<K extends keyof EditFormState>(field: K, value: EditFormState[K]) {
    setIsDirty(true)
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

  function addLine() {
    setIsDirty(true)
    setLines((current) => [...current, createBlankQuoteLine()])
  }

  function getStepError(stepIndex: number): string | null {
    if (stepIndex === 0 && !form.client_id && !quote.lead_id) {
      return 'El presupuesto necesita cliente o lead vinculado.'
    }

    if (stepIndex === 1) {
      const linePayloads = buildQuoteLinePayloads(lines, quote.id)
      if (!linePayloads || linePayloads.length === 0) {
        return 'Necesitas al menos una linea valida con concepto, cantidad y precio.'
      }
    }

    return null
  }

  function goToStep(nextStep: number) {
    const boundedStep = Math.max(0, Math.min(quoteEditSteps.length - 1, nextStep))

    if (boundedStep > currentStep) {
      for (let index = 0; index < boundedStep; index += 1) {
        const stepError = getStepError(index)
        if (stepError) {
          setCurrentStep(index)
          setError(stepError)
          return
        }
      }
    }

    setError(null)
    setCurrentStep(boundedStep)
  }

  async function persistQuote(confirmedRejected = false, skipDuplicateCheck = false) {
    if (form.status === 'rejected' && quote.status !== 'rejected' && !confirmedRejected) {
      setShowRejectedConfirm(true)
      return
    }

    setError(null)
    setIsSaving(true)

    try {
      const linePayloads = buildQuoteLinePayloads(lines, quote.id)

      if (!linePayloads || linePayloads.length === 0) {
        setCurrentStep(1)
        setError('Cada linea debe tener concepto, cantidad mayor que 0 y precio unitario valido.')
        return
      }

      if (!skipDuplicateCheck) {
        const duplicateGroups = findQuoteDuplicateGroups({
          ...quote,
          client_id: form.client_id,
          property_id: form.property_id || null,
          status: form.status,
          subtotal: subtotalValue,
          tax_amount: taxAmountValue,
          total: totalValue,
          notes: form.notes.trim() || null,
          quote_lines: linePayloads,
          lines: linePayloads,
        }, allQuotes)

        if (duplicateGroups.length > 0) {
          setPendingDuplicateGroups(duplicateGroups)
          return
        }
      }

      await saveQuoteWithLines(
        {
          id: quote.id,
          client_id: form.client_id,
          lead_id: quote.lead_id ?? null,
          property_id: form.property_id || null,
          status: form.status,
          subtotal: subtotalValue,
          tax_amount: taxAmountValue,
          total: totalValue,
          notes: form.notes.trim() || null,
          internal_notes: quote.internal_notes ?? null,
          pricing_metadata: quote.pricing_metadata ?? null,
        },
        linePayloads,
      )

      setIsDirty(false)
      await completeFullViewActionFlow({ onRefreshData, onCompleted })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido actualizando el presupuesto.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSave() {
    for (let index = 0; index < quoteEditSteps.length - 1; index += 1) {
      const stepError = getStepError(index)
      if (stepError) {
        setCurrentStep(index)
        setError(stepError)
        return
      }
    }

    await persistQuote()
  }

  function requestCancel() {
    if (!onCancel) return
    if (!isDirty) {
      onCancel()
      return
    }

    setShowCancelConfirm(true)
  }

  const contextItems: FullscreenStepFlowContextItem[] = [
    {
      label: 'Presupuesto',
      value: quote.display_code ?? quote.id,
      hint: buildClientSummaryLabel(quote, clients),
    },
    {
      label: 'Estado',
      value: getStatusOptionLabel(form.status),
      hint: selectedProperty ? formatPropertyLabel(selectedProperty) : buildPropertySummaryLabel(quote, properties),
    },
    {
      label: 'Total',
      value: formatCurrency(totalValue),
      hint: `${lines.length} linea(s) en edicion`,
    },
  ]

  const currentStepError = getStepError(currentStep)
  const stepStates = quoteEditSteps.map((_, index) => {
    const stepError = getStepError(index)
    if (index < currentStep) return stepError ? 'blocked' : 'complete'
    if (index === currentStep && stepError) return 'blocked'
    if (index === currentStep) return 'current'
    return 'pending'
  }) as ('complete' | 'current' | 'blocked' | 'pending')[]

  const sideContent = (
    <>
      <section className="cc-create-flow__summary-card">
        <span className="cc-step-flow__eyebrow">Lectura rapida</span>
        <strong>{selectedClient ? formatClientLabel(selectedClient) : buildClientSummaryLabel(quote, clients)}</strong>
        <small>{selectedProperty ? formatPropertyLabel(selectedProperty) : buildPropertySummaryLabel(quote, properties)}</small>
      </section>

      <section className="cc-create-flow__summary-card">
        <span className="cc-step-flow__eyebrow">Totales</span>
        <div className="cc-create-flow__totals">
          <div className="cc-create-flow__totals-row">
            <span>Subtotal</span>
            <strong>{formatMoneyInput(subtotalValue)} EUR</strong>
          </div>
          <div className="cc-create-flow__totals-row">
            <span>IVA</span>
            <strong>{formatMoneyInput(taxAmountValue)} EUR</strong>
          </div>
          <div className="cc-create-flow__totals-row cc-create-flow__totals-row--grand">
            <span>Total</span>
            <strong>{formatMoneyInput(totalValue)} EUR</strong>
          </div>
        </div>
      </section>
    </>
  )

  const footerContent = (
    <>
      <div className="cc-create-flow__footer-meta">
        <strong>{quoteEditSteps[currentStep].label}</strong>
        <small className="cc-create-flow__helper">
          {currentStep < quoteEditSteps.length - 1
            ? 'La edicion mayor avanza por bloques para evitar scroll largo dentro del detalle.'
            : 'Al guardar vuelves al mismo presupuesto y la card sigue centrada en lectura y acciones.'}
        </small>
      </div>

      <div className="cc-create-flow__footer-actions">
        {onCancel ? (
          <button type="button" className="secondary-button" onClick={requestCancel}>
            Cancelar
          </button>
        ) : null}
        <button
          type="button"
          className="secondary-button"
          onClick={() => goToStep(currentStep - 1)}
          disabled={currentStep === 0}
        >
          Atras
        </button>
        {currentStep < quoteEditSteps.length - 1 ? (
          <button type="button" className="primary-button" onClick={() => goToStep(currentStep + 1)}>
            Siguiente
          </button>
        ) : (
          <button type="button" className="primary-button" onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? 'Guardando...' : submitLabel}
          </button>
        )}
      </div>
    </>
  )

  return (
    <>
      <FullscreenStepFlow
        eyebrow="Presupuesto"
        title={title}
        description={description}
        steps={quoteEditSteps}
        currentStep={currentStep}
        stepStates={stepStates}
        onStepSelect={goToStep}
        contextItems={contextItems}
        sideContent={sideContent}
        footerContent={footerContent}
      >
        {currentStep === 0 ? (
          <section className="cc-create-flow__section">
            <article className="cc-create-flow__hero-card">
              <span className="cc-step-flow__eyebrow">Paso 1</span>
              <strong>Contexto comercial y estado</strong>
              <small>Cliente, propiedad y estado quedan juntos para cerrar la lectura base sin mezclar lineas.</small>
            </article>

            <article className={`cc-create-flow__status-card ${currentStepError ? 'cc-create-flow__status-card--blocked' : 'cc-create-flow__status-card--ready'}`}>
              <span className="cc-create-flow__status-icon" aria-hidden="true">{currentStepError ? '!' : 'OK'}</span>
              <div className="cc-create-flow__status-copy">
                <span>{currentStepError ? 'Contexto pendiente' : 'Contexto listo'}</span>
                <strong>{currentStepError ?? 'Puedes pasar a lineas e importes sin rehacer contexto.'}</strong>
              </div>
            </article>

            <div className="cc-create-flow__grid">
              <label className="form-field">
                <span>Cliente</span>
                <select
                  value={form.client_id ?? ''}
                  onChange={(event) => updateField('client_id', event.target.value || null)}
                >
                  {quote.lead_id ? <option value="">Lead sin cliente hasta aceptacion</option> : null}
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
                >
                  <option value="">Sin propiedad</option>
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

              <label className="form-field form-field-full">
                <span>Notas</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => updateField('notes', event.target.value)}
                  rows={5}
                  placeholder="Notas comerciales o de alcance"
                />
              </label>
            </div>
          </section>
        ) : null}

        {currentStep === 1 ? (
          <section className="cc-create-flow__section">
            <article className="cc-create-flow__hero-card">
              <span className="cc-step-flow__eyebrow">Paso 2</span>
              <strong>Edita lineas sin ruido alrededor</strong>
              <small>Las microacciones de anadir o quitar viven aqui, aisladas de estados, relaciones y conversiones.</small>
            </article>

            <article className={`cc-create-flow__status-card ${currentStepError ? 'cc-create-flow__status-card--blocked' : 'cc-create-flow__status-card--ready'}`}>
              <span className="cc-create-flow__status-icon" aria-hidden="true">{currentStepError ? '!' : 'OK'}</span>
              <div className="cc-create-flow__status-copy">
                <span>{currentStepError ? 'Lineas pendientes' : 'Lineas listas'}</span>
                <strong>{currentStepError ?? `${lines.length} linea(s) preparadas para la revision final.`}</strong>
              </div>
            </article>

            <div className="cc-create-flow__line-list">
              {lines.map((line, index) => (
                <article key={line.local_id} className="cc-create-flow__line-card">
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

                  <div className="cc-create-flow__line-actions">
                    <small className="cc-create-flow__helper">La linea se guarda exactamente como la dejes aqui.</small>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => removeLine(line.local_id)}
                      disabled={lines.length === 1}
                    >
                      Quitar linea
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <div className="cc-create-flow__microactions">
              <strong>Microacciones</strong>
              <div className="cc-create-flow__microactions-row">
                <button type="button" className="secondary-button" onClick={addLine}>
                  Anadir linea
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {currentStep === 2 ? (
          <section className="cc-create-flow__section">
            <article className="cc-create-flow__hero-card">
              <span className="cc-step-flow__eyebrow">Paso 3</span>
              <strong>Revision final antes de guardar</strong>
              <small>Se confirma el documento sin perder foco ni volver al scroll largo de la card.</small>
            </article>

            <article className="cc-create-flow__status-card cc-create-flow__status-card--ready">
              <span className="cc-create-flow__status-icon" aria-hidden="true">OK</span>
              <div className="cc-create-flow__status-copy">
                <span>Documento listo</span>
                <strong>La card de detalle seguira reservada para lectura, estados y acciones.</strong>
              </div>
            </article>

            <div className="cc-create-flow__review-grid">
              <article className="cc-create-flow__review-card">
                <span>Cliente</span>
                <strong>{selectedClient ? formatClientLabel(selectedClient) : buildClientSummaryLabel(quote, clients)}</strong>
                <small>{selectedProperty ? formatPropertyLabel(selectedProperty) : buildPropertySummaryLabel(quote, properties)}</small>
              </article>
              <article className="cc-create-flow__review-card">
                <span>Estado</span>
                <strong>{getStatusOptionLabel(form.status)}</strong>
                <small>{lines.length} linea(s)</small>
              </article>
            </div>

            {lines.map((line, index) => (
              <article key={line.local_id} className="cc-create-flow__panel">
                <strong>Linea {index + 1}</strong>
                <small>{line.concept || 'Concepto pendiente'}</small>
                <div className="cc-create-flow__summary-list">
                  <div className="cc-create-flow__summary-item">
                    <span>Cantidad</span>
                    <strong>{line.quantity}</strong>
                  </div>
                  <div className="cc-create-flow__summary-item">
                    <span>Unidad</span>
                    <strong>{line.unit}</strong>
                  </div>
                  <div className="cc-create-flow__summary-item">
                    <span>Precio</span>
                    <strong>{line.unit_price} EUR</strong>
                  </div>
                  <div className="cc-create-flow__summary-item">
                    <span>Importe</span>
                    <strong>{formatQuoteLineSubtotalInput(line)} EUR</strong>
                  </div>
                </div>
              </article>
            ))}
          </section>
        ) : null}

        {error ? (
          <div className="cc-alert cc-alert--error">
            <strong>No se pudo actualizar el presupuesto</strong>
            <p>{error}</p>
          </div>
        ) : null}
      </FullscreenStepFlow>

      <DuplicateReviewOverlay
        isOpen={pendingDuplicateGroups.length > 0}
        title="Posible presupuesto duplicado"
        description="La edicion actual se parece mucho a otro presupuesto ya existente. Revisa la coincidencia antes de guardar."
        groups={pendingDuplicateGroups}
        onClose={() => setPendingDuplicateGroups([])}
        onOpenRecord={(quoteId) => {
          setPendingDuplicateGroups([])
          onOpenExistingQuote?.(quoteId)
        }}
        onUseRecord={(quoteId) => {
          setPendingDuplicateGroups([])
          onOpenExistingQuote?.(quoteId)
        }}
        onContinueAnyway={() => {
          setPendingDuplicateGroups([])
          void persistQuote(false, true)
        }}
      />

      <ConfirmDialog
        isOpen={showCancelConfirm}
        title="Descartar cambios del presupuesto"
        description="Has empezado a editar este presupuesto. Si cierras ahora, perderas los cambios no guardados."
        confirmLabel="Descartar cambios"
        tone="warning"
        onCancel={() => setShowCancelConfirm(false)}
        onConfirm={() => {
          setShowCancelConfirm(false)
          onCancel?.()
        }}
      />

      <ConfirmDialog
        isOpen={showRejectedConfirm}
        title="Guardar presupuesto como rechazado"
        description="Vas a guardar la edicion dejando el presupuesto en estado rechazado. Confirma solo si ya no debe seguir tratandose como oportunidad activa."
        confirmLabel="Guardar como rechazado"
        tone="warning"
        isBusy={isSaving}
        onCancel={() => setShowRejectedConfirm(false)}
        onConfirm={() => {
          setShowRejectedConfirm(false)
          void persistQuote(true)
        }}
      />
    </>
  )
}
