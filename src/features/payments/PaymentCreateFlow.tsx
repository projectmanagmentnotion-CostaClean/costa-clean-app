import { useEffect, useMemo, useState } from 'react'
import { formatCurrency, formatDateEs, getPaymentMethodLabel } from '../../app/displayFormat'
import { formatClientLabel, formatInvoiceLabel, formatJobLabel, formatPropertyLabel, formatQuoteLabel } from '../../app/relationshipLabels'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ContextualCreateSection } from '../../components/ContextualCreateSection'
import { FullscreenStepFlow, type FullscreenStepFlowContextItem } from '../../components/FullscreenStepFlow'
import { InvoiceCreateFlow } from '../invoices/InvoiceCreateFlow'
import { getInvoiceFinancialStatusLabel, getPaymentOriginLabel } from '../invoices/paymentState'
import type { InvoiceListItem } from '../invoices/types'
import type { JobListItem } from '../jobs/types'
import type { PropertyListItem } from '../properties/types'
import type { QuoteListItem } from '../quotes/types'
import {
  completeContextualActionFlow,
  completeFullViewActionFlow,
  type FullViewActionFlowProps,
} from '../shared/actionFlowLifecycle'
import { savePaymentAndRefreshInvoice } from '../financial/financialWriteApi'
import type { ClientListItem } from '../clients/types'
import '../shared/fullscreen-create-flow.css'

interface PaymentCreateFlowProps extends FullViewActionFlowProps {
  invoices: InvoiceListItem[]
  clients: ClientListItem[]
  properties: PropertyListItem[]
  jobs: JobListItem[]
  quotes: QuoteListItem[]
  title?: string
  description?: string
  submitLabel?: string
  prefillInvoiceId?: string
  prefillAmount?: string
  prefillPaymentMethod?: string
  prefillNotes?: string
  lockInvoiceSelection?: boolean
  hideInvoiceCreateAction?: boolean
  originType?: 'manual' | 'transfer_auto'
}

interface FormState {
  invoice_id: string
  payment_date: string
  amount: string
  payment_method: string
  notes: string
}

const paymentSteps = [
  { id: 'origin', label: 'Factura y contexto', description: 'Resuelve la factura origen y fija el contexto correcto.' },
  { id: 'amount', label: 'Importe y metodo', description: 'Define importe, metodo y caracter del cobro.' },
  { id: 'review', label: 'Revision y registro', description: 'Confirma el cobro antes de registrarlo.' },
]

const paymentNextLabels = [
  'Confirmar importe',
  'Ir a revision final',
]

function todayLocalDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDecimalInput(value: string): number {
  const normalized = value.trim().replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function formatMoneyInput(value: number): string {
  return value.toFixed(2)
}

function buildInitialState({
  prefillInvoiceId,
  prefillAmount,
  prefillPaymentMethod,
  prefillNotes,
}: Pick<
  PaymentCreateFlowProps,
  'prefillInvoiceId' | 'prefillAmount' | 'prefillPaymentMethod' | 'prefillNotes'
>): FormState {
  return {
    invoice_id: prefillInvoiceId ?? '',
    payment_date: todayLocalDate(),
    amount: prefillAmount ?? '',
    payment_method: prefillPaymentMethod ?? 'transfer',
    notes: prefillNotes ?? '',
  }
}

function getPreferredInvoiceId(invoices: InvoiceListItem[]): string {
  const openInvoice = invoices.find((invoice) => Number(invoice.outstanding_amount ?? invoice.total) > 0.009)
  return openInvoice?.id ?? invoices[0]?.id ?? ''
}

function getAmountIntentLabel(amount: number, outstandingAmount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return 'Pendiente'
  return amount + 0.009 < outstandingAmount ? 'Cobro parcial' : 'Cobro total'
}

export function PaymentCreateFlow({
  invoices,
  clients,
  properties,
  jobs,
  quotes,
  onRefreshData,
  onCompleted,
  title = 'Registrar cobro',
  description = 'Registra el cobro dentro de una superficie guiada y vuelve al contexto exacto sin rutas paralelas.',
  submitLabel = 'Registrar cobro',
  prefillInvoiceId,
  prefillAmount,
  prefillPaymentMethod,
  prefillNotes,
  lockInvoiceSelection = false,
  hideInvoiceCreateAction = false,
  originType = 'manual',
  onCancel,
  onDirtyChange,
}: PaymentCreateFlowProps) {
  const availableInvoices = useMemo(() => (
    invoices.filter((invoice) => {
      if (prefillInvoiceId && invoice.id === prefillInvoiceId) return true
      return Number(invoice.outstanding_amount ?? invoice.total) > 0.009
    })
  ), [invoices, prefillInvoiceId])

  const [form, setForm] = useState<FormState>(() => buildInitialState({
    prefillInvoiceId: prefillInvoiceId ?? getPreferredInvoiceId(availableInvoices),
    prefillAmount,
    prefillPaymentMethod,
    prefillNotes,
  }))
  const [currentStep, setCurrentStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showInvoiceCreate, setShowInvoiceCreate] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  useEffect(() => {
    onDirtyChange?.(isDirty)
    return () => onDirtyChange?.(false)
  }, [isDirty, onDirtyChange])

  useEffect(() => {
    setForm(buildInitialState({
      prefillInvoiceId: prefillInvoiceId ?? getPreferredInvoiceId(availableInvoices),
      prefillAmount,
      prefillPaymentMethod,
      prefillNotes,
    }))
    setIsDirty(false)
  }, [availableInvoices, prefillAmount, prefillInvoiceId, prefillNotes, prefillPaymentMethod])

  const selectedInvoice = useMemo(
    () => invoices.find((invoice) => invoice.id === form.invoice_id) ?? null,
    [form.invoice_id, invoices],
  )
  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedInvoice?.client_id) ?? null,
    [clients, selectedInvoice?.client_id],
  )
  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === selectedInvoice?.property_id) ?? null,
    [properties, selectedInvoice?.property_id],
  )
  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedInvoice?.job_id) ?? null,
    [jobs, selectedInvoice?.job_id],
  )
  const selectedQuote = useMemo(
    () => quotes.find((quote) => quote.id === selectedInvoice?.quote_id) ?? null,
    [quotes, selectedInvoice?.quote_id],
  )
  const outstandingAmount = Number(selectedInvoice?.outstanding_amount ?? selectedInvoice?.total ?? 0)
  const enteredAmount = parseDecimalInput(form.amount)
  const amountIntentLabel = getAmountIntentLabel(enteredAmount, outstandingAmount)

  useEffect(() => {
    if (!selectedInvoice || prefillAmount) return

    setForm((current) => {
      if (current.amount.trim()) return current

      return {
        ...current,
        amount: formatMoneyInput(outstandingAmount),
      }
    })
  }, [outstandingAmount, prefillAmount, selectedInvoice])

  function markDirty() {
    setIsDirty(true)
  }

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    markDirty()
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function syncAmountFromInvoice() {
    if (!selectedInvoice) {
      setSubmitError('Selecciona una factura antes de traer su pendiente real.')
      return
    }

    setSubmitError(null)
    markDirty()
    setForm((current) => ({
      ...current,
      amount: formatMoneyInput(outstandingAmount),
    }))
  }

  function getStepError(stepIndex: number): string | null {
    if (stepIndex === 0 && !form.invoice_id) {
      return 'Debes fijar una factura valida antes de seguir.'
    }

    if (stepIndex === 1) {
      if (!form.payment_date) return 'Debes indicar la fecha de cobro.'

      const amount = parseDecimalInput(form.amount)
      if (Number.isNaN(amount)) return 'El importe debe ser un numero valido.'
      if (amount <= 0) return 'El importe del cobro debe ser mayor que cero.'
    }

    return null
  }

  function goToStep(nextStep: number) {
    const boundedStep = Math.max(0, Math.min(paymentSteps.length - 1, nextStep))

    if (boundedStep > currentStep) {
      for (let index = 0; index < boundedStep; index += 1) {
        const error = getStepError(index)
        if (error) {
          setCurrentStep(index)
          setSubmitError(error)
          return
        }
      }
    }

    setSubmitError(null)
    setCurrentStep(boundedStep)
  }

  async function handleSave() {
    setSubmitError(null)

    for (let index = 0; index < paymentSteps.length - 1; index += 1) {
      const error = getStepError(index)
      if (error) {
        setCurrentStep(index)
        setSubmitError(error)
        return
      }
    }

    setIsSubmitting(true)

    try {
      if (!form.invoice_id) {
        setCurrentStep(0)
        setSubmitError('Debes seleccionar una factura.')
        return
      }

      if (!selectedInvoice) {
        setCurrentStep(0)
        setSubmitError('No se pudo resolver la factura seleccionada. Actualiza la lista antes de guardar.')
        return
      }

      const amount = parseDecimalInput(form.amount)
      if (Number.isNaN(amount)) {
        setCurrentStep(1)
        setSubmitError('El importe debe ser un numero valido.')
        return
      }

      if (amount <= 0) {
        setCurrentStep(1)
        setSubmitError('El importe del cobro debe ser mayor que cero.')
        return
      }

      const paymentId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? `PAYMENT-${crypto.randomUUID()}`
          : `PAYMENT-${Date.now()}`

      await savePaymentAndRefreshInvoice({
        id: paymentId,
        invoice_id: form.invoice_id,
        payment_date: form.payment_date,
        amount: Number(formatMoneyInput(amount)),
        payment_method: form.payment_method || null,
        origin_type: originType,
        notes: form.notes.trim() || null,
      })

      setIsDirty(false)
      await completeFullViewActionFlow({
        onRefreshData,
        onCompleted,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido creando el cobro.'
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

  const contextItems: FullscreenStepFlowContextItem[] = [
    {
      label: 'Factura origen',
      value: selectedInvoice ? formatInvoiceLabel(selectedInvoice) : 'Pendiente',
      hint: selectedInvoice ? getInvoiceFinancialStatusLabel(selectedInvoice.payment_status ?? 'pending') : 'Sin factura fijada',
    },
    {
      label: 'Cliente',
      value: selectedClient ? formatClientLabel(selectedClient) : selectedInvoice?.client_name ?? 'Pendiente',
      hint: selectedProperty ? formatPropertyLabel(selectedProperty) : selectedInvoice?.property_name ?? 'Sin propiedad fija',
    },
    {
      label: 'Pendiente real',
      value: selectedInvoice ? formatCurrency(outstandingAmount) : 'Pendiente',
      hint: selectedJob ? formatJobLabel(selectedJob) : selectedQuote ? formatQuoteLabel(selectedQuote) : 'Sin servicio enlazado',
    },
  ]

  const stepStates = paymentSteps.map((_, index) => {
    const error = getStepError(index)
    if (index < currentStep) return error ? 'blocked' : 'complete'
    if (index === currentStep && error) return 'blocked'
    if (index === currentStep) return 'current'
    return 'pending'
  }) as ('complete' | 'current' | 'blocked' | 'pending')[]

  const currentStepError = getStepError(currentStep)

  const sideContent = (
    <>
      <section className="cc-create-flow__summary-card">
        <span className="cc-step-flow__eyebrow">Lectura del cobro</span>
        <div className="cc-create-flow__summary-list">
          <div className="cc-create-flow__summary-item">
            <span>Tipo</span>
            <strong>{amountIntentLabel}</strong>
          </div>
          <div className="cc-create-flow__summary-item">
            <span>Metodo</span>
            <strong>{getPaymentMethodLabel(form.payment_method)}</strong>
          </div>
          <div className="cc-create-flow__summary-item">
            <span>Origen</span>
            <strong>{getPaymentOriginLabel(originType)}</strong>
          </div>
        </div>
      </section>

      <section className="cc-create-flow__summary-card">
        <span className="cc-step-flow__eyebrow">Importes</span>
        <div className="cc-create-flow__totals">
          <div className="cc-create-flow__totals-row">
            <span>Pendiente real</span>
            <strong>{selectedInvoice ? formatCurrency(outstandingAmount) : 'Pendiente'}</strong>
          </div>
          <div className="cc-create-flow__totals-row">
            <span>Cobro preparado</span>
            <strong>{Number.isFinite(enteredAmount) ? formatCurrency(enteredAmount) : 'Pendiente'}</strong>
          </div>
          <div className="cc-create-flow__totals-row cc-create-flow__totals-row--grand">
            <span>Resultado</span>
            <strong>{amountIntentLabel}</strong>
          </div>
        </div>
      </section>
    </>
  )

  const footerContent = (
    <div className="cc-create-flow__footer-actions">
      {onCancel ? (
        <button type="button" className="secondary-button" onClick={requestCancel}>
          Cancelar
        </button>
      ) : null}

      {currentStep > 0 ? (
        <button type="button" className="secondary-button" onClick={() => goToStep(currentStep - 1)}>
          Volver
        </button>
      ) : null}

      {currentStep < paymentSteps.length - 1 ? (
        <button type="button" className="primary-button" onClick={() => goToStep(currentStep + 1)}>
          {paymentNextLabels[currentStep]}
        </button>
      ) : (
        <button type="button" className="primary-button" disabled={isSubmitting} onClick={handleSave}>
          {isSubmitting ? 'Registrando...' : submitLabel}
        </button>
      )}
    </div>
  )

  return (
    <>
      <FullscreenStepFlow
        eyebrow="Documento de cobro"
        title={title}
        description={description}
        steps={paymentSteps}
        currentStep={currentStep}
        stepStates={stepStates}
        onStepSelect={goToStep}
        sideContent={sideContent}
        footerContent={footerContent}
        contextItems={contextItems}
      >
        {currentStep === 0 ? (
          <section className="cc-create-flow__section">
            <article className="cc-create-flow__hero-card">
              <span className="cc-step-flow__eyebrow">Paso 1</span>
              <strong>Fija la factura origen</strong>
              <small>El cobro debe nacer de una factura valida. Si falta, la resuelves dentro de esta misma superficie.</small>
            </article>

            <article className={`cc-create-flow__status-card ${currentStepError ? 'cc-create-flow__status-card--blocked' : 'cc-create-flow__status-card--ready'}`}>
              <span className="cc-create-flow__status-icon" aria-hidden="true">{currentStepError ? '!' : 'OK'}</span>
              <div className="cc-create-flow__status-copy">
                <span>{currentStepError ? 'Falta factura base' : 'Factura lista'}</span>
                <strong>{currentStepError ?? 'La factura origen ya esta resuelta para seguir con el cobro.'}</strong>
              </div>
            </article>

            <div className="cc-create-flow__grid">
              {selectedInvoice ? (
                <article className="cc-create-flow__panel">
                  <strong>Contexto del documento</strong>
                  <div className="cc-create-flow__summary-list">
                    <div className="cc-create-flow__summary-item">
                      <span>Factura</span>
                      <strong>{formatInvoiceLabel(selectedInvoice)}</strong>
                    </div>
                    <div className="cc-create-flow__summary-item">
                      <span>Cliente</span>
                      <strong>{selectedClient ? formatClientLabel(selectedClient) : selectedInvoice.client_name ?? 'Sin cliente'}</strong>
                    </div>
                    <div className="cc-create-flow__summary-item">
                      <span>Origen</span>
                      <strong>{selectedJob ? formatJobLabel(selectedJob) : selectedQuote ? formatQuoteLabel(selectedQuote) : 'Ruta administrativa'}</strong>
                    </div>
                  </div>
                </article>
              ) : null}

              <label className="form-field form-field-full">
                <span>Factura *</span>
                <select
                  value={form.invoice_id}
                  onChange={(event) => updateField('invoice_id', event.target.value)}
                  disabled={lockInvoiceSelection}
                >
                  {!lockInvoiceSelection ? <option value="">Selecciona una factura</option> : null}
                  {availableInvoices.map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>
                      {`${formatInvoiceLabel(invoice)} - Pendiente ${formatMoneyInput(Number(invoice.outstanding_amount ?? invoice.total))}`}
                    </option>
                  ))}
                </select>
              </label>

              {!hideInvoiceCreateAction ? (
                <ContextualCreateSection
                  actionLabel={availableInvoices.length === 0 ? 'Crear factura en este flujo' : 'Crear factura excepcional'}
                  title="Falta la factura base"
                  description="Si el cobro no puede arrancar desde una factura existente, la creas aqui y vuelves con el contexto fijado."
                  isOpen={showInvoiceCreate}
                  onToggle={() => setShowInvoiceCreate((current) => !current)}
                >
                  <InvoiceCreateFlow
                    clients={clients}
                    properties={properties}
                    jobs={jobs}
                    quotes={quotes}
                    onRefreshData={onRefreshData}
                    onCompleted={async () => {}}
                    onDirtyChange={setIsDirty}
                    onCreatedInvoice={async (invoice) => {
                      await completeContextualActionFlow({
                        created: invoice,
                        applyCreated: async (createdInvoice) => {
                          setForm((current) => ({
                            ...current,
                            invoice_id: createdInvoice.id,
                          }))
                        },
                        closeSubflow: () => setShowInvoiceCreate(false),
                        markDirty,
                      })
                    }}
                  />
                </ContextualCreateSection>
              ) : null}
            </div>
          </section>
        ) : null}

        {currentStep === 1 ? (
          <section className="cc-create-flow__section">
            <article className="cc-create-flow__hero-card">
              <span className="cc-step-flow__eyebrow">Paso 2</span>
              <strong>Define importe y metodo</strong>
              <small>El flow distingue si estas cubriendo todo el pendiente o registrando un parcial con intencion manual.</small>
            </article>

            <article className={`cc-create-flow__status-card ${currentStepError ? 'cc-create-flow__status-card--blocked' : 'cc-create-flow__status-card--ready'}`}>
              <span className="cc-create-flow__status-icon" aria-hidden="true">{currentStepError ? '!' : 'OK'}</span>
              <div className="cc-create-flow__status-copy">
                <span>{currentStepError ? 'Cobro pendiente' : 'Cobro listo para revisar'}</span>
                <strong>{currentStepError ?? `${amountIntentLabel} con ${getPaymentMethodLabel(form.payment_method)} listo para registrar.`}</strong>
              </div>
            </article>

            <div className="cc-create-flow__grid">
              <label className="form-field">
                <span>Fecha de cobro *</span>
                <input
                  type="date"
                  value={form.payment_date}
                  onChange={(event) => updateField('payment_date', event.target.value)}
                  required
                />
              </label>

              <label className="form-field">
                <span>Importe *</span>
                <input
                  value={form.amount}
                  onChange={(event) => updateField('amount', event.target.value)}
                  placeholder="Ej. 121.00"
                  required
                />
              </label>

              <label className="form-field">
                <span>Metodo de cobro</span>
                <select
                  value={form.payment_method}
                  onChange={(event) => updateField('payment_method', event.target.value)}
                >
                  <option value="transfer">{getPaymentMethodLabel('transfer')}</option>
                  <option value="cash">{getPaymentMethodLabel('cash')}</option>
                  <option value="bizum">{getPaymentMethodLabel('bizum')}</option>
                  <option value="card">{getPaymentMethodLabel('card')}</option>
                </select>
              </label>

              <article className="cc-create-flow__panel">
                <strong>Lectura rapida</strong>
                <div className="cc-create-flow__summary-list">
                  <div className="cc-create-flow__summary-item">
                    <span>Pendiente</span>
                    <strong>{selectedInvoice ? formatCurrency(outstandingAmount) : 'Pendiente'}</strong>
                  </div>
                  <div className="cc-create-flow__summary-item">
                    <span>Cobro</span>
                    <strong>{Number.isFinite(enteredAmount) ? formatCurrency(enteredAmount) : 'Pendiente'}</strong>
                  </div>
                  <div className="cc-create-flow__summary-item">
                    <span>Resultado</span>
                    <strong>{amountIntentLabel}</strong>
                  </div>
                </div>
                <div className="cc-create-flow__microactions-row" style={{ marginTop: '0.75rem' }}>
                  <button type="button" className="secondary-button" onClick={syncAmountFromInvoice}>
                    Traer pendiente real
                  </button>
                </div>
              </article>

              <label className="form-field form-field-full">
                <span>Notas</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => updateField('notes', event.target.value)}
                  rows={4}
                  placeholder="Notas del cobro"
                />
              </label>
            </div>
          </section>
        ) : null}

        {currentStep === 2 ? (
          <section className="cc-create-flow__section">
            <article className="cc-create-flow__hero-card">
              <span className="cc-step-flow__eyebrow">Paso 3</span>
              <strong>Revisa y registra el cobro</strong>
              <small>El registro mantiene la relacion con la factura y te devuelve al mismo contexto al cerrar.</small>
            </article>

            <article className="cc-create-flow__status-card cc-create-flow__status-card--ready">
              <span className="cc-create-flow__status-icon" aria-hidden="true">OK</span>
              <div className="cc-create-flow__status-copy">
                <span>Cobro listo</span>
                <strong>Se registrara sobre la factura correcta con importe, metodo y origen ya validados.</strong>
              </div>
            </article>

            <div className="cc-create-flow__review-grid">
              <article className="cc-create-flow__review-card">
                <span>Factura</span>
                <strong>{selectedInvoice ? formatInvoiceLabel(selectedInvoice) : 'Pendiente'}</strong>
                <small>{selectedInvoice ? formatDateEs(selectedInvoice.issue_date) : 'Sin fecha'}</small>
              </article>
              <article className="cc-create-flow__review-card">
                <span>Cliente</span>
                <strong>{selectedClient ? formatClientLabel(selectedClient) : selectedInvoice?.client_name ?? 'Pendiente'}</strong>
                <small>{selectedProperty ? formatPropertyLabel(selectedProperty) : selectedInvoice?.property_name ?? 'Sin propiedad'}</small>
              </article>
              <article className="cc-create-flow__review-card">
                <span>Cobro preparado</span>
                <strong>{Number.isFinite(enteredAmount) ? formatCurrency(enteredAmount) : 'Pendiente'}</strong>
                <small>{amountIntentLabel}</small>
              </article>
              <article className="cc-create-flow__review-card">
                <span>Metodo</span>
                <strong>{getPaymentMethodLabel(form.payment_method)}</strong>
                <small>{getPaymentOriginLabel(originType)}</small>
              </article>
            </div>

            {submitError ? (
              <div className="cc-alert cc-alert--error">
                <strong>No se pudo registrar el cobro</strong>
                <p>{submitError}</p>
              </div>
            ) : null}
          </section>
        ) : null}
      </FullscreenStepFlow>

      <ConfirmDialog
        isOpen={showCancelConfirm}
        title="Descartar cobro en curso"
        description="Perderas los cambios no guardados de este cobro si cierras ahora."
        confirmLabel="Descartar"
        onCancel={() => setShowCancelConfirm(false)}
        onConfirm={() => {
          setShowCancelConfirm(false)
          onCancel?.()
        }}
      />
    </>
  )
}
