import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { businessRules } from '../../app/businessRules'
import { formatCurrency, formatDateEs, getServiceTypeLabel } from '../../app/displayFormat'
import { getStatusLabel } from '../../app/displayText'
import { formatClientLabel, formatJobLabel } from '../../app/relationshipLabels'
import { getStatusOptionLabel, invoiceManualStatusOptions } from '../../app/statusOptions'
import { FeedbackDialog } from '../../components/FeedbackDialog'
import { ActionGroup, type ActionGroupItem } from '../../components/ActionGroup'
import {
  saveInvoiceWithLines,
  settleInvoiceByTransfer,
  updateInvoiceStatus as updateInvoiceStatusRpc,
} from '../financial/financialWriteApi'
import type { JobListItem } from '../jobs/types'
import { PaymentCreateForm } from '../payments/PaymentCreateForm'
import type { PaymentListItem } from '../payments/types'
import { normalizeLineConcept, simplifyLineConcept } from '../quotes/lineConcepts'
import type { QuoteListItem } from '../quotes/types'
import {
  buildInvoicePaymentMeta,
  buildInvoicePaymentSummary,
  getInvoiceFinancialStatusLabel,
} from './paymentState'
import type { InvoiceLineItem, InvoiceListItem } from './types'

interface InvoiceDetailCardProps {
  invoice: InvoiceListItem | null
  jobs: JobListItem[]
  quotes: QuoteListItem[]
  payments: PaymentListItem[]
  onInvoiceUpdated: () => Promise<void>
  onOpenDocument: () => void
  onViewPayments: (invoiceId: string) => void
  onOpenJobWorkspace: (jobId: string) => void
  onOpenClientWorkspace: (clientId: string) => void
  onOpenPropertyWorkspace: (propertyId: string) => void
  onOpenQuoteDetail: (quoteId: string) => void
  onUnsavedChange?: (hasUnsavedChanges: boolean) => void
  emptyState?: {
    title: string
    description: string
  }
}

interface EditFormState {
  job_id: string
  client_id: string
  issue_date: string
  status: string
  notes: string
}

interface LineFormState {
  local_id: string
  concept: string
  quantity: string
  unit: string
  unit_price: string
}

interface LinePayload {
  id: string
  invoice_id: string
  sort_order: number
  concept: string
  quantity: number
  unit: string
  unit_price: number
  line_subtotal: number
}

type PaymentActionMode = 'manual' | 'partial' | null

function createLocalId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function parseDecimalInput(value: string): number {
  const normalized = value.trim().replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function formatMoneyInput(value: number): string {
  return roundMoney(value).toFixed(2)
}

function formatQuantityInput(value: number): string {
  return roundMoney(value).toFixed(2)
}

function createBlankLine(): LineFormState {
  return {
    local_id: createLocalId('LINE-DRAFT'),
    concept: '',
    quantity: '1.00',
    unit: 'servicio',
    unit_price: '0.00',
  }
}

function lineItemToFormLine(line: InvoiceLineItem): LineFormState {
  return {
    local_id: line.id || createLocalId('LINE-DRAFT'),
    concept: normalizeLineConcept(line.concept),
    quantity: formatQuantityInput(Number(line.quantity)),
    unit: line.unit || 'servicio',
    unit_price: formatMoneyInput(Number(line.unit_price)),
  }
}

function getFallbackLineFromInvoice(invoice: InvoiceListItem): LineFormState {
  const quantity = Number(invoice.billing_quantity)
  const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1
  const unitPrice = Number(invoice.billing_unit_price)
  const safeUnitPrice = Number.isFinite(unitPrice) && unitPrice >= 0
    ? unitPrice
    : Number(invoice.subtotal) / safeQuantity

  return {
    local_id: createLocalId('LINE-DRAFT'),
    concept: normalizeLineConcept(
      invoice.billing_concept,
      simplifyLineConcept(invoice.service_description),
    ),
    quantity: formatQuantityInput(safeQuantity),
    unit: invoice.billing_unit?.trim() || 'servicio',
    unit_price: formatMoneyInput(safeUnitPrice),
  }
}

function getFormLinesFromInvoice(invoice: InvoiceListItem): LineFormState[] {
  const persistedLines = invoice.lines?.length ? invoice.lines : invoice.invoice_lines ?? []
  if (persistedLines.length > 0) {
    return [...persistedLines]
      .sort((left, right) => Number(left.sort_order) - Number(right.sort_order))
      .map(lineItemToFormLine)
  }

  return [getFallbackLineFromInvoice(invoice)]
}

function getJobBillingLine(job: JobListItem | null): LineFormState | null {
  if (!job) return null

  const quantity = Number(job.billing_quantity)
  const unitPrice = Number(job.billing_unit_price)

  if (
    !Number.isFinite(quantity) ||
    !Number.isFinite(unitPrice) ||
    quantity <= 0 ||
    unitPrice < 0
  ) {
    return null
  }

  return {
    local_id: createLocalId('LINE-DRAFT'),
    concept: normalizeLineConcept(job.billing_concept, simplifyLineConcept(getServiceTypeLabel(job.service_type))),
    quantity: formatQuantityInput(quantity),
    unit: job.billing_unit?.trim() || 'servicio',
    unit_price: formatMoneyInput(unitPrice),
  }
}

function getQuoteBillingLine(quote: QuoteListItem | null): LineFormState | null {
  if (!quote) return null

  const subtotal = Number(quote.subtotal)
  if (!Number.isFinite(subtotal) || subtotal < 0) return null

  return {
    local_id: createLocalId('LINE-DRAFT'),
    concept: normalizeLineConcept(
      quote.lines?.[0]?.concept ?? quote.quote_lines?.[0]?.concept,
      simplifyLineConcept(
        quote.notes,
        `Servicio segun presupuesto ${quote.display_code ?? quote.id}`,
      ),
    ),
    quantity: '1.00',
    unit: 'servicio',
    unit_price: formatMoneyInput(subtotal),
  }
}

function calculateLineSubtotal(line: LineFormState): number {
  const quantity = parseDecimalInput(line.quantity)
  const unitPrice = parseDecimalInput(line.unit_price)
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return Number.NaN
  return roundMoney(quantity * unitPrice)
}

function formatLineSubtotalInput(line: LineFormState): string {
  const lineSubtotal = calculateLineSubtotal(line)
  return Number.isNaN(lineSubtotal) ? '' : formatMoneyInput(lineSubtotal)
}

function formatLineSubtotalDisplay(line: LineFormState): string {
  const lineSubtotal = calculateLineSubtotal(line)
  return Number.isNaN(lineSubtotal) ? 'Importe no valido' : formatCurrency(lineSubtotal)
}

function getInvoicePrimaryReference(invoice: InvoiceListItem): string {
  return invoice.invoice_number ?? invoice.display_code ?? invoice.id
}

function getInvoiceInternalReference(invoice: InvoiceListItem): string {
  return invoice.display_code ?? invoice.id
}

function getInvoiceServiceReference(invoice: InvoiceListItem): string {
  return invoice.service_reference
    ?? invoice.service_description
    ?? invoice.job_display_code
    ?? invoice.job_id
    ?? 'Factura creada desde presupuesto aceptado'
}

function buildVisibleInvoiceNotes(): string {
  return [
    'Servicio realizado segun presupuesto aprobado.',
    'Condiciones economicas aplicadas segun presupuesto aceptado.',
    'Precios sin IVA.',
  ].join('\n')
}

function calculateSubtotal(lines: LineFormState[]): number {
  return roundMoney(lines.reduce((sum, line) => {
    const lineSubtotal = calculateLineSubtotal(line)
    return Number.isNaN(lineSubtotal) ? sum : sum + lineSubtotal
  }, 0))
}

function buildLinePayloads(lines: LineFormState[], invoiceId: string): LinePayload[] | null {
  const payloads: LinePayload[] = []

  for (const [index, line] of lines.entries()) {
    const concept = normalizeLineConcept(line.concept)
    const quantity = parseDecimalInput(line.quantity)
    const unitPrice = parseDecimalInput(line.unit_price)
    const lineSubtotal = calculateLineSubtotal(line)

    if (!concept || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || !Number.isFinite(lineSubtotal)) {
      return null
    }

    payloads.push({
      id: createLocalId('INVOICE-LINE'),
      invoice_id: invoiceId,
      sort_order: index + 1,
      concept,
      quantity: roundMoney(quantity),
      unit: line.unit.trim() || 'servicio',
      unit_price: roundMoney(unitPrice),
      line_subtotal: lineSubtotal,
    })
  }

  return payloads
}

export function InvoiceDetailCard({
  invoice,
  jobs,
  quotes,
  payments,
  onInvoiceUpdated,
  onOpenDocument,
  onViewPayments,
  onOpenJobWorkspace,
  onOpenClientWorkspace,
  onOpenPropertyWorkspace,
  onOpenQuoteDetail,
  onUnsavedChange,
  emptyState,
}: InvoiceDetailCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [paymentActionMode, setPaymentActionMode] = useState<PaymentActionMode>(null)
  const [form, setForm] = useState<EditFormState>({
    job_id: '',
    client_id: '',
    issue_date: '',
    status: 'draft',
    notes: '',
  })
  const [lines, setLines] = useState<LineFormState[]>([createBlankLine()])

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === form.job_id) ?? null,
    [jobs, form.job_id],
  )

  const linkedQuote = useMemo(() => {
    if (!selectedJob?.quote_id) return null
    return quotes.find((quote) => quote.id === selectedJob.quote_id) ?? null
  }, [quotes, selectedJob])

  const subtotalValue = useMemo(() => calculateSubtotal(lines), [lines])
  const taxAmountValue = useMemo(
    () => roundMoney(subtotalValue * businessRules.defaultTaxRate),
    [subtotalValue],
  )
  const totalValue = useMemo(
    () => roundMoney(subtotalValue + taxAmountValue),
    [subtotalValue, taxAmountValue],
  )

  const displayLines = useMemo(() => {
    if (!invoice) return []
    return getFormLinesFromInvoice(invoice)
  }, [invoice])

  const invoicePayments = useMemo(
    () => invoice ? payments.filter((payment) => payment.invoice_id === invoice.id) : [],
    [invoice, payments],
  )
  const paymentSummary = useMemo(
    () => invoice ? buildInvoicePaymentSummary(invoice, invoicePayments) : null,
    [invoice, invoicePayments],
  )

  useEffect(() => {
    if (!invoice) {
      setIsEditing(false)
      setSaveError(null)
      setSuccessMessage(null)
      setPaymentActionMode(null)
      setForm({
        job_id: '',
        client_id: '',
        issue_date: '',
        status: 'draft',
        notes: '',
      })
      setLines([createBlankLine()])
      return
    }

    setIsEditing(false)
    setSaveError(null)
    setSuccessMessage(null)
    setPaymentActionMode(null)
    setForm({
      job_id: invoice.job_id ?? '',
      client_id: invoice.client_id,
      issue_date: invoice.issue_date,
      status: invoice.status,
      notes: invoice.notes ?? '',
    })
    setLines(getFormLinesFromInvoice(invoice))
  }, [invoice])

  useEffect(() => {
    onUnsavedChange?.(isEditing || paymentActionMode !== null)
    return () => onUnsavedChange?.(false)
  }, [isEditing, onUnsavedChange, paymentActionMode])

  function updateField<K extends keyof EditFormState>(field: K, value: EditFormState[K]) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function updateLine<K extends keyof LineFormState>(
    localId: string,
    field: K,
    value: LineFormState[K],
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

  function resetFormFromInvoice() {
    if (!invoice) return

    setForm({
      job_id: invoice.job_id ?? '',
      client_id: invoice.client_id,
      issue_date: invoice.issue_date,
      status: invoice.status,
      notes: invoice.notes ?? '',
    })
    setLines(getFormLinesFromInvoice(invoice))
  }

  function syncFromJobQuote() {
    if (!selectedJob) return

    setForm((current) => ({
      ...current,
      client_id: selectedJob.client_id,
      notes: current.notes.trim() ? current.notes : linkedQuote ? buildVisibleInvoiceNotes() : '',
    }))
    setLines([getJobBillingLine(selectedJob) ?? getQuoteBillingLine(linkedQuote) ?? createBlankLine()])
  }

  async function updateInvoiceStatus(nextStatus: string) {
    if (!invoice || invoice.status === nextStatus) return

    setSaveError(null)
    setSuccessMessage(null)
    setIsSaving(true)

    try {
      await updateInvoiceStatusRpc(invoice.id, nextStatus)

      await onInvoiceUpdated()
      setSuccessMessage(`Estado administrativo de la factura actualizado a ${getStatusLabel(nextStatus)}.`)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido actualizando el estado de la factura.'
      setSaveError(message)
    } finally {
      setIsSaving(false)
    }
  }

  function requestInvoiceStatusUpdate(nextStatus: string) {
    void updateInvoiceStatus(nextStatus)
  }

  async function handleTransferSettlement() {
    if (!invoice || !paymentSummary) return

    setSaveError(null)
    setSuccessMessage(null)
    setIsSaving(true)

    try {
      const result = await settleInvoiceByTransfer(invoice.id)
      await onInvoiceUpdated()

      if (!result.created_payment) {
        setSuccessMessage('La factura ya estaba completamente cubierta por cobros reales. No se creó otro cobro.')
        return
      }

      setSuccessMessage(
        paymentSummary.financialStatus === 'partially_paid'
          ? 'Se registró por transferencia el importe restante y la factura quedó cobrada.'
          : 'Se registró el cobro por transferencia con el importe pendiente exacto.',
      )
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido registrando el cobro por transferencia.'
      setSaveError(message)
    } finally {
      setIsSaving(false)
    }
  }

  async function saveInvoiceEdits() {
    if (!invoice) return

    setSaveError(null)
    setSuccessMessage(null)
    setIsSaving(true)

    try {
      if (!form.client_id) {
        setSaveError('No se pudo resolver el cliente de la factura.')
        return
      }

      if (!form.issue_date) {
        setSaveError('Debes indicar la fecha de emision.')
        return
      }

      const linePayloads = buildLinePayloads(lines, invoice.id)

      if (!linePayloads || linePayloads.length === 0) {
        setSaveError('Cada linea debe tener concepto, cantidad mayor que 0 y precio unitario valido.')
        return
      }

      await saveInvoiceWithLines(
        {
          id: invoice.id,
          job_id: form.job_id || null,
          quote_id: invoice.quote_id ?? selectedJob?.quote_id ?? null,
          client_id: form.client_id,
          property_id: invoice.property_id ?? null,
          issue_date: form.issue_date,
          status: form.status,
          subtotal: subtotalValue,
          tax_amount: taxAmountValue,
          total: totalValue,
          notes: form.notes.trim() || null,
          internal_notes: invoice.internal_notes ?? linkedQuote?.internal_notes ?? null,
          pricing_metadata: invoice.pricing_metadata ?? linkedQuote?.pricing_metadata ?? null,
        },
        linePayloads,
      )

      await onInvoiceUpdated()
      setSuccessMessage('Factura actualizada correctamente.')
      setIsEditing(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido actualizando la factura.'

      setSaveError(message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await saveInvoiceEdits()
  }

  const invoiceNextStep = !invoice
    ? ''
    : invoice.status === 'cancelled'
      ? 'La factura esta cancelada y queda fuera del circuito normal de cobro.'
      : (paymentSummary?.outstandingAmount ?? invoice.total) > 0.009
        ? 'El siguiente paso natural es registrar o cerrar el cobro pendiente.'
        : 'La factura ya esta cubierta. Revisa cobros o documento solo si necesitas trazabilidad.'
  const headerActions: ActionGroupItem[] = []

  if (invoice && invoice.status !== 'cancelled' && (paymentSummary?.outstandingAmount ?? invoice.total) > 0.009) {
    headerActions.push({
      key: 'register-payment-primary',
      label: 'Registrar cobro',
      tone: 'primary',
      onClick: () => setPaymentActionMode('manual'),
      disabled: isSaving,
    })
  } else if (invoice) {
    headerActions.push({
      key: 'open-document-primary',
      label: 'Abrir documento',
      tone: 'primary',
      onClick: onOpenDocument,
    })
  }

  if (invoice) {
    headerActions.push(
      {
        key: 'open-document',
        label: 'Abrir documento',
        onClick: onOpenDocument,
      },
      {
        key: 'edit-invoice',
        label: isEditing ? 'Cancelar edicion' : 'Editar factura',
        onClick: () => {
          setIsEditing((current) => !current)
          setSaveError(null)
          setSuccessMessage(null)
          setPaymentActionMode(null)
          resetFormFromInvoice()
        },
      },
      {
        key: 'view-payments',
        label: 'Ver cobros',
        onClick: () => onViewPayments(invoice.id),
      },
    )
  }
  const dedupedHeaderActions = headerActions.filter(
    (action, index, actions) => actions.findIndex((candidate) => candidate.label === action.label) === index,
  )

  const paymentActions: ActionGroupItem[] = invoice ? [
    {
      key: 'manual-payment',
      label: 'Registrar cobro',
      tone: 'primary',
      onClick: () => setPaymentActionMode('manual'),
      disabled: isSaving || invoice.status === 'cancelled',
    },
    {
      key: 'partial-payment',
      label: 'Registrar cobro parcial',
      onClick: () => setPaymentActionMode('partial'),
      disabled: isSaving || invoice.status === 'cancelled' || (paymentSummary?.outstandingAmount ?? invoice.total) <= 0.009,
    },
    {
      key: 'settle-payment',
      label: paymentSummary?.financialStatus === 'partially_paid'
        ? 'Cobrar restante por transferencia'
        : 'Cobrar por transferencia',
      onClick: () => void handleTransferSettlement(),
      disabled: isSaving || !paymentSummary || paymentSummary.outstandingAmount <= 0.009 || invoice.status === 'cancelled',
    },
    {
      key: 'view-payments-secondary',
      label: 'Ver cobros',
      onClick: () => onViewPayments(invoice.id),
    },
  ] : []

  const relationActions: ActionGroupItem[] = []

  if (invoice?.job_id) {
    relationActions.push({
      key: 'open-job',
      label: 'Abrir servicio',
      tone: 'primary',
      onClick: () => onOpenJobWorkspace(invoice.job_id!),
    })
  }

  if (invoice) {
    relationActions.push({
      key: 'open-client',
      label: 'Abrir cliente',
      onClick: () => onOpenClientWorkspace(invoice.client_id),
    })
  }

  if (invoice?.property_id) {
    relationActions.push({
      key: 'open-property',
      label: 'Abrir propiedad',
      onClick: () => onOpenPropertyWorkspace(invoice.property_id!),
    })
  }

  if (invoice?.quote_id) {
    relationActions.push({
      key: 'open-quote',
      label: 'Ver presupuesto origen',
      onClick: () => onOpenQuoteDetail(invoice.quote_id!),
    })
  }

  const statusActions: ActionGroupItem[] = invoice
    ? invoiceManualStatusOptions
      .filter((status) => status !== invoice.status)
      .map((status, index) => ({
        key: `invoice-status-${status}`,
        label: getStatusOptionLabel(status),
        tone: index === 0 ? 'primary' : 'default',
        onClick: () => requestInvoiceStatusUpdate(status),
        disabled: isSaving,
      }))
    : []

  return (
    <section className="data-section cc-detail-panel cc-detail-panel--invoice">
      <div className="section-header page-header-actions">
        <div>
          <h2>Detalle de la factura</h2>
        </div>

        {invoice ? (
          <div className="cc-detail-panel__actions">
            <ActionGroup actions={dedupedHeaderActions} moreLabel="Mas acciones" />
          </div>
        ) : null}
      </div>

      {invoice ? (
        <div className="lead-detail-card">
          <div className="lead-detail-header">
            <div className="cc-detail-panel__identity">
              <span className="cc-detail-panel__eyebrow">Workspace financiero</span>
              <h3>{getInvoicePrimaryReference(invoice)}</h3>
              <p>Interno {getInvoiceInternalReference(invoice)}</p>
            </div>
            <span className={`lead-badge cc-status-badge cc-status-badge--${paymentSummary?.financialStatus ?? invoice.status}`}>
              {paymentSummary ? getInvoiceFinancialStatusLabel(paymentSummary.financialStatus) : getStatusLabel(invoice.status)}
            </span>
          </div>

          {!isEditing ? (
            <div className="cc-detail-panel__summary">
              <div className="cc-detail-panel__summary-card">
                <span>Cliente</span>
                <strong>{formatClientLabel({ client_id: invoice.client_id, client_display_code: invoice.client_display_code, client_name: invoice.client_name })}</strong>
                <small>
                  {invoice.job_id
                    ? formatJobLabel({
                      id: invoice.job_id,
                      display_code: invoice.job_display_code,
                      billing_concept: invoice.billing_concept,
                      property_name: invoice.property_name,
                      property_display_code: invoice.property_display_code,
                      client_name: invoice.client_name,
                      client_display_code: invoice.client_display_code,
                    })
                    : 'Sin servicio'}
                </small>
              </div>
              <div className="cc-detail-panel__summary-card">
                <span>Emision</span>
                <strong>{formatDateEs(invoice.issue_date)}</strong>
                <small>{displayLines.length} linea(s)</small>
              </div>
              <div className="cc-detail-panel__summary-card">
                <span>Total</span>
                <strong>{formatCurrency(invoice.total)}</strong>
                <small>{formatCurrency(invoice.tax_amount)} IVA</small>
              </div>
              <div className="cc-detail-panel__summary-card">
                <span>Estado financiero</span>
                <strong>{paymentSummary ? getInvoiceFinancialStatusLabel(paymentSummary.financialStatus) : 'Pendiente'}</strong>
                <small>{paymentSummary ? buildInvoicePaymentMeta(paymentSummary) : 'Sin cobros'}</small>
              </div>
            </div>
          ) : null}

          {!isEditing ? (
            <div className="cc-detail-panel__next-step">
              <span>Siguiente paso recomendado</span>
              <strong>{invoiceNextStep}</strong>
            </div>
          ) : null}

          {isEditing ? (
            <form className="lead-form cc-detail-panel__editor" onSubmit={handleSubmit}>
              <label className="form-field">
                <span>Servicio</span>
                <select
                  value={form.job_id}
                  onChange={(event) => updateField('job_id', event.target.value)}
                >
                  <option value="">Sin servicio vinculado</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {formatJobLabel(job)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span>Fecha de emision *</span>
                <input
                  type="date"
                  value={form.issue_date}
                  onChange={(event) => updateField('issue_date', event.target.value)}
                  required
                />
              </label>

              <label className="form-field">
                <span>Estado administrativo</span>
                <select
                  value={form.status}
                  onChange={(event) => updateField('status', event.target.value)}
                >
                  {invoiceManualStatusOptions.map((status) => (
                    <option key={status} value={status}>{getStatusOptionLabel(status)}</option>
                  ))}
                </select>
              </label>

              <div className="form-field form-field-full">
                <span>Lineas de factura *</span>
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
                        <input value={formatLineSubtotalInput(line)} readOnly />
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
                  onClick={() => setLines((current) => [...current, createBlankLine()])}
                  style={{ marginTop: '0.75rem' }}
                >
                  Añadir linea
                </button>
              </div>

              <label className="form-field">
                <span>Subtotal</span>
                <input value={formatMoneyInput(subtotalValue)} readOnly />
              </label>

              <label className="form-field">
                <span>IVA</span>
                <input value={formatMoneyInput(taxAmountValue)} readOnly />
              </label>

              <label className="form-field">
                <span>Total</span>
                <input value={formatMoneyInput(totalValue)} readOnly />
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
                <button type="button" className="secondary-button" onClick={syncFromJobQuote}>
                  Traer datos del servicio/presupuesto
                </button>

                <button type="submit" className="primary-button" disabled={isSaving}>
                  {isSaving ? 'Guardando cambios...' : 'Guardar cambios'}
                </button>
              </div>

              {saveError ? (
                <div className="cc-alert cc-alert--error">
                  <strong>No se pudo actualizar la factura</strong>
                  <p>{saveError}</p>
                </div>
              ) : null}

              {successMessage ? (
                <div className="cc-alert cc-alert--success">
                  <strong>Operacion correcta</strong>
                  <p>{successMessage}</p>
                </div>
              ) : null}
            </form>
          ) : (
            <>
              <section className="data-section" style={{ marginBottom: '1rem' }}>
                <div className="section-header page-header-actions">
                  <div>
                    <h2>Bloque de cobro</h2>
                    <p>El estado financiero se deriva solo de los cobros reales asociados.</p>
                  </div>
                </div>

                <div className="lead-detail-grid cc-detail-panel__grid">
                  <div className="detail-row">
                    <span className="detail-label">Total</span>
                    <strong>{formatCurrency(invoice.total)}</strong>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Cobrado</span>
                    <strong>{formatCurrency(paymentSummary?.paidAmount ?? 0)}</strong>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Pendiente</span>
                    <strong>{formatCurrency(paymentSummary?.outstandingAmount ?? invoice.total)}</strong>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Estado financiero</span>
                    <strong>{paymentSummary ? getInvoiceFinancialStatusLabel(paymentSummary.financialStatus) : 'Pendiente'}</strong>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Ultimo cobro</span>
                    <strong>
                      {paymentSummary?.lastPayment
                        ? `${formatDateEs(paymentSummary.lastPayment.payment_date)} · ${formatCurrency(paymentSummary.lastPayment.amount)}`
                        : 'Sin cobros'}
                    </strong>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Metodo y origen</span>
                    <strong>{paymentSummary ? buildInvoicePaymentMeta(paymentSummary) : 'Sin cobros'}</strong>
                  </div>
                </div>

              {relationActions.length > 0 ? (
                <div className="form-actions" style={{ marginTop: '1rem' }}>
                  <ActionGroup actions={relationActions} moreLabel="Mas relaciones" />
                </div>
              ) : null}

              {paymentActions.length > 0 ? (
                <div className="form-actions" style={{ marginTop: '1rem' }}>
                  <ActionGroup actions={paymentActions} moreLabel="Mas cobros" />
                </div>
              ) : null}

                {paymentActionMode ? (
                  <div style={{ marginTop: '1rem' }}>
                    <PaymentCreateForm
                      invoices={[invoice]}
                      clients={[]}
                      properties={[]}
                      jobs={[]}
                      quotes={[]}
                      onCreated={async () => {
                        await onInvoiceUpdated()
                        setPaymentActionMode(null)
                      }}
                      title={paymentActionMode === 'partial' ? 'Registrar cobro parcial' : 'Registrar cobro'}
                      description={
                        paymentActionMode === 'partial'
                          ? 'Registra un importe manual inferior o igual al pendiente real.'
                          : 'Registra un cobro asociado a esta factura sin salir del detalle.'
                      }
                      submitLabel={paymentActionMode === 'partial' ? 'Guardar cobro parcial' : 'Guardar cobro'}
                      prefillInvoiceId={invoice.id}
                      prefillAmount={paymentActionMode === 'manual'
                        ? formatMoneyInput(paymentSummary?.outstandingAmount ?? invoice.total)
                        : ''}
                      lockInvoiceSelection
                      hideInvoiceCreateAction
                    />
                    <div className="form-actions" style={{ marginTop: '0.75rem' }}>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setPaymentActionMode(null)}
                      >
                        Cancelar cobro
                      </button>
                    </div>
                  </div>
                ) : null}

                {statusActions.length > 0 ? (
                  <div className="form-actions cc-detail-panel__status-actions" style={{ marginTop: '1rem' }}>
                    <ActionGroup actions={statusActions} moreLabel="Estado admin." />
                  </div>
                ) : null}
              </section>

<div className="lead-detail-grid cc-detail-panel__grid">
                <div className="detail-row">
                  <span className="detail-label">Numero factura</span>
                  <strong>{invoice.invoice_number ?? 'Sin numero'}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Servicio</span>
                  <strong>{getInvoiceServiceReference(invoice)}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Cliente</span>
                  <strong>{formatClientLabel({ client_id: invoice.client_id, client_display_code: invoice.client_display_code, client_name: invoice.client_name })}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Fecha de emision</span>
                  <strong>{formatDateEs(invoice.issue_date)}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Cobro</span>
                  <strong>{paymentSummary ? getInvoiceFinancialStatusLabel(paymentSummary.financialStatus) : 'Pendiente'}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Lineas</span>
                  <strong>
                    {displayLines.slice(0, 2).map((line) => `${line.concept} · ${formatLineSubtotalDisplay(line)}`).join(' | ')}
                    {displayLines.length > 2 ? ` | +${displayLines.length - 2} linea(s)` : ''}
                  </strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Total</span>
                  <strong>{formatCurrency(invoice.total)}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Notas</span>
                  <strong>{invoice.notes ?? 'Sin notas'}</strong>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="empty-state">
          <strong>{emptyState?.title ?? 'Ninguna factura seleccionada'}</strong>
          <p>{emptyState?.description ?? 'Haz clic en una tarjeta del listado para ver su detalle.'}</p>
        </div>
      )}

      <FeedbackDialog
        isOpen={!isEditing && Boolean(saveError)}
        tone="error"
        title="No se pudo actualizar la factura"
        message={saveError ?? ''}
        onClose={() => setSaveError(null)}
      />

      <FeedbackDialog
        isOpen={!isEditing && Boolean(successMessage)}
        tone="success"
        title="Operacion correcta"
        message={successMessage ?? ''}
        onClose={() => setSuccessMessage(null)}
      />
    </section>
  )
}
