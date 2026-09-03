import { Suspense, lazy, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { businessRules } from '../../app/businessRules'
import { formatCurrency, formatDateEs } from '../../app/displayFormat'
import { getStatusLabel } from '../../app/displayText'
import { formatClientLabel, formatJobLabel } from '../../app/relationshipLabels'
import { getStatusOptionLabel, invoiceManualStatusOptions } from '../../app/statusOptions'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ActionFlowOverlay } from '../../components/ActionFlowOverlay'
import { CollapsibleDetailSection } from '../../components/CollapsibleDetailSection'
import { DeferredContentFallback } from '../../components/DeferredContentFallback'
import { FeedbackDialog } from '../../components/FeedbackDialog'
import { ActionGroup, type ActionGroupItem } from '../../components/ActionGroup'
import { buildInvoicePricingMetadataWithClientFiscalSnapshot, getClientFiscalIssueMessage } from '../clients/clientFiscalData'
import type { ClientListItem } from '../clients/types'
import {
  InvoiceNumberingMismatchError,
  saveInvoiceWithLines,
  settleInvoiceByTransfer,
  updateInvoiceStatus as updateInvoiceStatusRpc,
} from '../financial/financialWriteApi'
import { getJobBillingDraftLines } from '../jobs/jobBilling'
import type { JobListItem } from '../jobs/types'
import type { PaymentListItem } from '../payments/types'
import { normalizeLineConcept, simplifyLineConcept } from '../quotes/lineConcepts'
import type { QuoteListItem } from '../quotes/types'
import { getBillingDraftLinesFromQuote } from '../shared/quoteBillingDrafts'
import './invoiceWorkspace.css'
import {
  buildInvoicePaymentMeta,
  buildInvoicePaymentSummary,
  getInvoiceFinancialStatusLabel,
} from './paymentState'
import type { InvoiceLineItem, InvoiceListItem } from './types'
import { useToast } from '../../shared/toasts/useToast'
import { patchLifecycleEntity } from '../../shared/lifecycle/lifecycleApi'
import { isArchivedEntity } from '../../shared/lifecycle/entityLifecycle'
import { backfillSingleInvoiceFiscalSnapshot } from './invoiceFiscalSnapshotApi'
import { InvoiceCorrectionNotice } from './InvoiceCorrectionNotice'
import { canBackfillInvoiceFiscalSnapshot, hasCompleteInvoiceFiscalSnapshot } from './invoiceFiscalSnapshot'
import type { InvoiceCreatePrefill } from './invoiceCreatePrefill'
import { buildInvoiceNumber, buildInvoiceNumberingAudit, getInvoiceIssueYear } from './invoiceNumbering'
import { withInvoiceWriteTrace } from './invoiceWriteTrace'

const LazyPaymentCreateFlow = lazy(async () => ({
  default: (await import('../payments/PaymentCreateFlow')).PaymentCreateFlow,
}))

interface InvoiceDetailCardProps {
  invoice: InvoiceListItem | null
  clients: ClientListItem[]
  jobs: JobListItem[]
  quotes: QuoteListItem[]
  payments: PaymentListItem[]
  allInvoices?: InvoiceListItem[]
  onInvoiceUpdated: () => Promise<void>
  onOpenDocument: () => void
  onViewPayments: (invoiceId: string) => void
  onCreateSimilarInvoice?: (invoice: InvoiceListItem) => void
  onPrepareCorrectionDraft?: (prefill: InvoiceCreatePrefill) => void
  correctionDraftPrefill?: InvoiceCreatePrefill | null
  onOpenJobWorkspace: (jobId: string) => void
  onOpenClientWorkspace: (clientId: string) => void
  onOpenPropertyWorkspace: (propertyId: string) => void
  onOpenQuoteDetail: (quoteId: string) => void
  onUnsavedChange?: (hasUnsavedChanges: boolean) => void
  hideHeaderActions?: boolean
  majorEditMode?: boolean
  onRequestMajorEdit?: () => void
  onMajorEditClose?: () => void
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
  clients,
  jobs,
  quotes,
  payments,
  allInvoices = [],
  onInvoiceUpdated,
  onOpenDocument,
  onViewPayments,
  onCreateSimilarInvoice,
  onPrepareCorrectionDraft,
  correctionDraftPrefill = null,
  onOpenJobWorkspace,
  onOpenClientWorkspace,
  onOpenPropertyWorkspace,
  onOpenQuoteDetail,
  onUnsavedChange,
  hideHeaderActions = false,
  majorEditMode = false,
  onRequestMajorEdit,
  onMajorEditClose,
  emptyState,
}: InvoiceDetailCardProps) {
  const toast = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [paymentActionMode, setPaymentActionMode] = useState<PaymentActionMode>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [hasPaymentFormDirty, setHasPaymentFormDirty] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showTrashConfirm, setShowTrashConfirm] = useState(false)
  const isDirtyRef = useRef(false)
  const hasPaymentFormDirtyRef = useRef(false)
  const [form, setForm] = useState<EditFormState>({
    job_id: '',
    client_id: '',
    issue_date: '',
    status: 'draft',
    notes: '',
  })
  const [lines, setLines] = useState<LineFormState[]>([createBlankLine()])

  useEffect(() => {
    isDirtyRef.current = isDirty
  }, [isDirty])

  useEffect(() => {
    hasPaymentFormDirtyRef.current = hasPaymentFormDirty
  }, [hasPaymentFormDirty])

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === form.job_id) ?? null,
    [jobs, form.job_id],
  )

  const linkedQuote = useMemo(() => {
    if (!selectedJob?.quote_id) return null
    return quotes.find((quote) => quote.id === selectedJob.quote_id) ?? null
  }, [quotes, selectedJob])
  const selectedClient = useMemo(
    () => clients.find((client) => client.id === form.client_id) ?? null,
    [clients, form.client_id],
  )
  const invoiceClient = useMemo(
    () => clients.find((client) => client.id === invoice?.client_id) ?? null,
    [clients, invoice?.client_id],
  )

  const subtotalValue = useMemo(() => calculateSubtotal(lines), [lines])
  const taxAmountValue = useMemo(
    () => roundMoney(subtotalValue * businessRules.defaultTaxRate),
    [subtotalValue],
  )
  const totalValue = useMemo(
    () => roundMoney(subtotalValue + taxAmountValue),
    [subtotalValue, taxAmountValue],
  )
  const clientFiscalIssue = getClientFiscalIssueMessage(selectedClient)
  const hasCompleteFiscalSnapshot = invoice ? hasCompleteInvoiceFiscalSnapshot(invoice) : false
  const canBackfillFiscalSnapshot = invoice ? canBackfillInvoiceFiscalSnapshot(invoice, invoiceClient) : false
  const pricingMetadataWithFiscalSnapshot = useMemo(
    () => buildInvoicePricingMetadataWithClientFiscalSnapshot(invoice?.pricing_metadata ?? linkedQuote?.pricing_metadata ?? null, selectedClient),
    [invoice?.pricing_metadata, linkedQuote, selectedClient],
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
  const numberingAuditYear = useMemo(() => getInvoiceIssueYear(form.issue_date) ?? new Date().getFullYear(), [form.issue_date])
  const numberingAudit = useMemo(
    () => buildInvoiceNumberingAudit(allInvoices, numberingAuditYear),
    [allInvoices, numberingAuditYear],
  )
  const pricingMetadataForSave = useMemo(
    () => withInvoiceWriteTrace(pricingMetadataWithFiscalSnapshot, {
      sourceFlow: 'invoice_detail_card',
      writeApiVersion: 'save_invoice_with_lines_v2',
      expectedInvoiceNumber: form.status !== 'draft' ? numberingAudit.nextSuggestedInvoiceNumber : null,
      expectedDisplayCode: form.status !== 'draft' ? numberingAudit.nextSuggestedDisplayCode : null,
    }),
    [form.status, numberingAudit, pricingMetadataWithFiscalSnapshot],
  )

  useEffect(() => {
    if (isDirtyRef.current || hasPaymentFormDirtyRef.current) return
    if (!invoice) {
      setIsEditing(false)
      setSaveError(null)
      setSuccessMessage(null)
      setPaymentActionMode(null)
      setIsDirty(false)
      setHasPaymentFormDirty(false)
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
    setIsDirty(false)
    setHasPaymentFormDirty(false)
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
    onUnsavedChange?.(isDirty || hasPaymentFormDirty)
    return () => onUnsavedChange?.(false)
  }, [hasPaymentFormDirty, isDirty, onUnsavedChange])

  useEffect(() => {
    if (!invoice || !majorEditMode) return
    setIsEditing(true)
  }, [invoice, majorEditMode])

  function updateField<K extends keyof EditFormState>(field: K, value: EditFormState[K]) {
    setIsDirty(true)
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
    setIsDirty(false)
  }

  function syncFromJobQuote() {
    if (!selectedJob) return

    setIsDirty(true)
    setForm((current) => ({
      ...current,
      client_id: selectedJob.client_id,
      notes: current.notes.trim() ? current.notes : linkedQuote ? buildVisibleInvoiceNotes() : '',
    }))
    const jobLines = getJobBillingDraftLines(selectedJob)
    const quoteLines = getBillingDraftLinesFromQuote(linkedQuote)
    setLines(jobLines.length > 0 ? jobLines : quoteLines.length > 0 ? quoteLines : [createBlankLine()])
  }

  async function handleFiscalSnapshotBackfill() {
    if (!invoice) return

    setSaveError(null)
    setSuccessMessage(null)
    setIsSaving(true)
    const toastId = toast.loading('Completando datos fiscales...', 'Guardando snapshot fiscal en la factura.')

    try {
      const updated = await backfillSingleInvoiceFiscalSnapshot(invoice, invoiceClient)
      if (!updated) {
        toast.update(toastId, {
          type: 'info',
          title: 'Sin cambios',
          description: 'La factura ya tenia snapshot fiscal completo o el cliente sigue incompleto.',
        })
        return
      }

      await onInvoiceUpdated()
      setSuccessMessage('Snapshot fiscal completado en la factura.')
      toast.update(toastId, {
        type: 'success',
        title: 'Datos fiscales completados',
        description: 'La factura ya conserva su snapshot fiscal para PDF y emision.',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo completar el snapshot fiscal.'
      setSaveError(message)
      toast.update(toastId, {
        type: 'error',
        title: 'No se pudo completar el snapshot fiscal',
        description: message,
        persistent: true,
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function updateInvoiceStatus(nextStatus: string) {
    if (!invoice || invoice.status === nextStatus) return

    setSaveError(null)
    setSuccessMessage(null)
    setIsSaving(true)
    const toastId = toast.loading('Actualizando factura...', 'Guardando el nuevo estado administrativo.')

    try {
      if (nextStatus !== 'draft' && !hasCompleteInvoiceFiscalSnapshot(invoice)) {
        throw new Error(canBackfillInvoiceFiscalSnapshot(invoice, invoiceClient)
          ? 'La factura necesita completar su snapshot fiscal antes de emitirse. Usa "Completar ahora".'
          : 'Faltan NIF/CIF o direccion fiscal en el cliente. Completa la ficha antes de emitir.')
      }

      await updateInvoiceStatusRpc(invoice.id, nextStatus)

      await onInvoiceUpdated()
      setSuccessMessage(`Estado administrativo de la factura actualizado a ${getStatusLabel(nextStatus)}.`)
      toast.update(toastId, {
        type: 'success',
        title: 'Factura actualizada',
        description: `Estado administrativo de la factura actualizado a ${getStatusLabel(nextStatus)}.`,
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido actualizando el estado de la factura.'
      setSaveError(message)
      toast.update(toastId, {
        type: 'error',
        title: 'No se pudo actualizar la factura',
        description: message,
        persistent: true,
      })
    } finally {
      setIsSaving(false)
    }
  }

  function requestInvoiceStatusUpdate(nextStatus: string) {
    if (nextStatus === 'cancelled') {
      setShowCancelConfirm(true)
      return
    }

    void updateInvoiceStatus(nextStatus)
  }

  async function handleArchiveInvoice() {
    if (!invoice) return
    setSaveError(null)
    setSuccessMessage(null)
    setIsSaving(true)
    const toastId = toast.loading('Archivando factura...', 'Seguira disponible en el historico.')

    try {
      await patchLifecycleEntity('invoices', invoice.id, { archived_at: new Date().toISOString() })
      await onInvoiceUpdated()
      setSuccessMessage('Factura archivada. Sigue disponible en el historico.')
      toast.update(toastId, { type: 'success', title: 'Factura archivada', description: 'Sigue disponible en el historico.' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo archivar la factura.'
      setSaveError(message)
      toast.update(toastId, { type: 'error', title: 'No se pudo archivar', description: message, persistent: true })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRestoreInvoice() {
    if (!invoice) return
    setSaveError(null)
    setSuccessMessage(null)
    setIsSaving(true)
    const toastId = toast.loading('Restaurando factura...', 'Volvera a estar visible.')

    try {
      await patchLifecycleEntity('invoices', invoice.id, { archived_at: null, deleted_at: null })
      await onInvoiceUpdated()
      setSuccessMessage('Factura restaurada correctamente.')
      toast.update(toastId, { type: 'success', title: 'Factura restaurada', description: 'Vuelve a estar visible.' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo restaurar la factura.'
      setSaveError(message)
      toast.update(toastId, { type: 'error', title: 'No se pudo restaurar', description: message, persistent: true })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCancelInvoice() {
    if (!invoice) return
    setSaveError(null)
    setSuccessMessage(null)
    setIsSaving(true)
    const toastId = toast.loading('Anulando factura...', 'Se mantendra en el historico fiscal.')

    try {
      await patchLifecycleEntity('invoices', invoice.id, {
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancel_reason: 'Anulada desde la gestion operativa',
      })
      await onInvoiceUpdated()
      setSuccessMessage('Factura anulada. Se mantiene en el historico fiscal.')
      toast.update(toastId, { type: 'success', title: 'Factura anulada', description: 'Se mantiene en el historico fiscal.' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo anular la factura.'
      setSaveError(message)
      toast.update(toastId, { type: 'error', title: 'No se pudo anular', description: message, persistent: true })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleTrashInvoice() {
    if (!invoice) return
    setSaveError(null)
    setSuccessMessage(null)
    setIsSaving(true)
    const toastId = toast.loading('Moviendo borrador a papelera...', 'Quedara oculto de las vistas principales.')

    try {
      await patchLifecycleEntity('invoices', invoice.id, { deleted_at: new Date().toISOString() })
      await onInvoiceUpdated()
      setSuccessMessage('Factura borrador movida a papelera.')
      toast.update(toastId, { type: 'success', title: 'Borrador en papelera', description: 'Queda oculto de las vistas principales.' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo mover el borrador a papelera.'
      setSaveError(message)
      toast.update(toastId, { type: 'error', title: 'No se pudo mover a papelera', description: message, persistent: true })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleTransferSettlement() {
    if (!invoice || !paymentSummary) return

    setSaveError(null)
    setSuccessMessage(null)
    setIsSaving(true)
    const toastId = toast.loading('Registrando cobro...', 'Sincronizando la factura con el pago por transferencia.')

    try {
      const result = await settleInvoiceByTransfer(invoice.id)
      await onInvoiceUpdated()

      if (!result.created_payment) {
        setSuccessMessage('La factura ya estaba completamente cubierta por cobros reales. No se creó otro cobro.')
        toast.update(toastId, {
          type: 'info',
          title: 'Factura ya cubierta',
          description: 'No se creo otro cobro porque la factura ya estaba completamente cubierta.',
        })
        return
      }

      setSuccessMessage(
        paymentSummary.financialStatus === 'partially_paid'
          ? 'Se registró por transferencia el importe restante y la factura quedó cobrada.'
          : 'Se registró el cobro por transferencia con el importe pendiente exacto.',
      )
      toast.update(toastId, {
        type: 'success',
        title: 'Cobro registrado',
        description: paymentSummary.financialStatus === 'partially_paid'
          ? 'Se registro por transferencia el importe restante y la factura quedo cobrada.'
          : 'Se registro el cobro por transferencia con el importe pendiente exacto.',
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido registrando el cobro por transferencia.'
      setSaveError(message)
      toast.update(toastId, {
        type: 'error',
        title: 'No se pudo registrar el cobro',
        description: message,
        persistent: true,
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function saveInvoiceEdits() {
    if (!invoice) return

    setSaveError(null)
    setSuccessMessage(null)
    setIsSaving(true)
    const toastId = toast.loading('Guardando factura...', 'Actualizando lineas y datos administrativos.')

    try {
      if (!form.client_id) {
        setSaveError('No se pudo resolver el cliente de la factura.')
        toast.update(toastId, {
          type: 'error',
          title: 'No se pudo actualizar la factura',
          description: 'No se pudo resolver el cliente de la factura.',
          persistent: true,
        })
        return
      }

      if (!form.issue_date) {
        setSaveError('Debes indicar la fecha de emision.')
        toast.update(toastId, {
          type: 'error',
          title: 'No se pudo actualizar la factura',
          description: 'Debes indicar la fecha de emision.',
          persistent: true,
        })
        return
      }

      if (form.status !== 'draft' && clientFiscalIssue) {
        setSaveError(clientFiscalIssue)
        toast.update(toastId, {
          type: 'error',
          title: 'No se puede emitir factura',
          description: 'Completa el NIF/CIF y la direccion fiscal del cliente antes de emitir.',
          persistent: true,
        })
        return
      }

      if (form.status !== 'draft' && numberingAudit.hasBlockingGaps) {
        const gapLabel = numberingAudit.gaps.map((gap) => (
          gap.from === gap.to
            ? buildInvoiceNumber(numberingAudit.year, gap.from)
            : `${buildInvoiceNumber(numberingAudit.year, gap.from)} a ${buildInvoiceNumber(numberingAudit.year, gap.to)}`
        )).join(' | ')
        setSaveError(`No se puede emitir factura. Hay huecos en la numeracion fiscal: ${gapLabel}. Regulariza la secuencia antes de emitir.`)
        toast.update(toastId, {
          type: 'error',
          title: 'No se puede emitir factura',
          description: `Hay huecos en la numeracion fiscal: ${gapLabel}. Regulariza la secuencia antes de emitir.`,
          persistent: true,
        })
        return
      }

      const linePayloads = buildLinePayloads(lines, invoice.id)

      if (!linePayloads || linePayloads.length === 0) {
        setSaveError('Cada linea debe tener concepto, cantidad mayor que 0 y precio unitario valido.')
        toast.update(toastId, {
          type: 'error',
          title: 'No se pudo actualizar la factura',
          description: 'Cada linea debe tener concepto, cantidad mayor que 0 y precio unitario valido.',
          persistent: true,
        })
        return
      }

      const savedInvoice = await saveInvoiceWithLines(
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
          pricing_metadata: pricingMetadataForSave,
        },
        linePayloads,
      )

      await onInvoiceUpdated()
      setSuccessMessage('Factura actualizada correctamente.')
      toast.update(toastId, {
        type: 'success',
        title: 'Factura actualizada',
        description: savedInvoice.status === 'draft'
          ? 'El borrador sigue sin consumir numero fiscal definitivo.'
          : `Las lineas y el documento quedaron actualizados con numero ${savedInvoice.invoice_number ?? 'pendiente'}.`,
      })
      if (majorEditMode) {
        onMajorEditClose?.()
      } else {
        setIsEditing(false)
      }
      setIsDirty(false)
    } catch (err) {
      if (err instanceof InvoiceNumberingMismatchError) {
        await onInvoiceUpdated()
      }
      const message =
        err instanceof InvoiceNumberingMismatchError
          ? `${err.message} La factura persistida quedo como ${err.details.persistedDisplayCode ?? err.details.invoiceId}. Regularizala antes de continuar.`
          : err instanceof Error
            ? err.message
            : 'Error desconocido actualizando la factura.'

      setSaveError(message)
      toast.update(toastId, {
        type: 'error',
        title: 'No se pudo actualizar la factura',
        description: message,
        persistent: true,
      })
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
  const shouldShowPaymentPrimary = Boolean(
    invoice
    && invoice.status !== 'cancelled'
    && (paymentSummary?.outstandingAmount ?? invoice.total) > 0.009,
  )
  const shouldShowDocumentPrimary = Boolean(invoice)
  const shouldShowEditPrimary = Boolean(invoice && invoice.status === 'draft')
  const headerActions: ActionGroupItem[] = []

  if (invoice) {
    if (shouldShowPaymentPrimary) {
      headerActions.push({
        key: 'open-document-primary',
        label: invoice.status === 'draft' ? 'Previsualizar documento' : 'Abrir documento',
        tone: 'primary',
        onClick: onOpenDocument,
      })

      headerActions.push({
        key: 'register-payment-primary',
        label: 'Registrar cobro',
        onClick: () => setPaymentActionMode('manual'),
      })
    } else if (shouldShowDocumentPrimary) {
      headerActions.push({
        key: 'open-document-primary',
        label: invoice.status === 'draft' ? 'Previsualizar documento' : 'Abrir documento',
        tone: 'primary',
        onClick: onOpenDocument,
      })
    }
  }

  if (invoice) {
    headerActions.push(
      {
        key: 'view-payments',
        label: 'Ver cobros',
        onClick: () => onViewPayments(invoice.id),
      },
    )
  }

  if (invoice && onCreateSimilarInvoice) {
    headerActions.push({
      key: 'duplicate-invoice',
      label: 'Crear factura como esta',
      onClick: () => onCreateSimilarInvoice(invoice),
    })
  }

  if (invoice) {
    headerActions.push(
      isArchivedEntity(invoice)
        ? {
            key: 'restore-invoice',
            label: 'Restaurar factura',
            onClick: () => setShowRestoreConfirm(true),
          }
        : {
            key: 'archive-invoice',
            label: 'Archivar factura',
            onClick: () => setShowArchiveConfirm(true),
          },
    )

    if (invoice.status === 'draft') {
      headerActions.push({
        key: 'trash-invoice',
        label: 'Mover borrador a papelera',
        onClick: () => setShowTrashConfirm(true),
      })
    }
  }

  if (invoice && !hideHeaderActions) {
    headerActions.push({
      key: 'edit-invoice',
      label: isEditing ? 'Cancelar edicion' : 'Editar factura',
      tone: shouldShowEditPrimary ? 'primary' : 'default',
      onClick: () => {
        if (onRequestMajorEdit && !majorEditMode) {
          onRequestMajorEdit()
          return
        }

        if (isEditing && isDirty) {
          setShowDiscardConfirm(true)
          return
        }

        setIsEditing((current) => !current)
        setSaveError(null)
        setSuccessMessage(null)
        setPaymentActionMode(null)
        setHasPaymentFormDirty(false)
        setIsDirty(false)
        resetFormFromInvoice()
      },
    })
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

        {invoice && !hideHeaderActions ? (
          <div className="cc-detail-panel__actions">
            <ActionGroup
              actions={dedupedHeaderActions}
              moreLabel="Mas acciones"
              compactVisibleSecondaryCount={shouldShowPaymentPrimary ? 1 : 0}
            />
          </div>
        ) : null}
      </div>

      {invoice ? (
        <div className="lead-detail-card cc-invoice-detail-card">
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
                <span>Total</span>
                <strong>{formatCurrency(invoice.total)}</strong>
                <small>{formatDateEs(invoice.issue_date)} · {displayLines.length} linea(s)</small>
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

          {!hasCompleteFiscalSnapshot ? (
            <div className={`cc-alert ${canBackfillFiscalSnapshot ? 'cc-alert--warning' : 'cc-alert--error'}`}>
              <strong>{canBackfillFiscalSnapshot ? 'Factura reparable' : 'Factura sin datos fiscales completos'}</strong>
              <p>
                {canBackfillFiscalSnapshot
                  ? 'Esta factura aun no conserva snapshot fiscal completo, pero se puede completar desde la ficha actual del cliente.'
                  : 'No hay snapshot fiscal completo y el cliente sigue sin NIF/CIF o direccion fiscal. La emision debe quedar bloqueada.'}
              </p>
              <div className="form-actions">
                {canBackfillFiscalSnapshot ? (
                  <button type="button" className="secondary-button" onClick={() => void handleFiscalSnapshotBackfill()} disabled={isSaving}>
                    Completar ahora
                  </button>
                ) : (
                  <button type="button" className="secondary-button" onClick={() => onOpenClientWorkspace(invoice.client_id)} disabled={isSaving}>
                    Abrir cliente
                  </button>
                )}
              </div>
            </div>
          ) : null}

          {isEditing ? (
            <form className="lead-form cc-detail-panel__editor" onSubmit={handleSubmit}>
              {invoice.status === 'issued' ? (
                <div className="cc-alert cc-alert--warning">
                  <strong>Factura emitida</strong>
                  <p>Antes de guardar cambios en lineas o importes, confirma si tu proceso requiere rectificativa. Este editor no crea una rectificativa automatica.</p>
                </div>
              ) : null}

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
                  onClick={() => {
                    setIsDirty(true)
                    setLines((current) => [...current, createBlankLine()])
                  }}
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
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    if (isDirty) {
                      setShowDiscardConfirm(true)
                      return
                    }

                    if (majorEditMode) {
                      onMajorEditClose?.()
                      return
                    }

                    setIsEditing(false)
                    resetFormFromInvoice()
                  }}
                >
                  Cancelar
                </button>
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
              <div className="cc-invoice-detail-card__section cc-invoice-detail-card__section--payments">
                <div className="section-header page-header-actions">
                  <div>
                    <h2>Cobro y conciliacion</h2>
                    <p>El estado financiero se deriva solo de los cobros reales asociados a la factura.</p>
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
                </div>

                <CollapsibleDetailSection title="Ver detalle de cobro" count={2} tone="info">
                  <div className="lead-detail-grid cc-detail-panel__grid">
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
                </CollapsibleDetailSection>

              {paymentActions.length > 0 ? (
                <div className="form-actions cc-invoice-detail-card__action-row">
                  <ActionGroup actions={paymentActions} moreLabel="Mas cobros" />
                </div>
              ) : null}

                {paymentActionMode ? (
                  <ActionFlowOverlay
                    isOpen={Boolean(paymentActionMode)}
                    title={paymentActionMode === 'partial' ? 'Registrar cobro parcial' : 'Registrar cobro'}
                    description="El cobro se registra en una superficie guiada y al cerrar vuelves exactamente al detalle de la factura."
                    onClose={() => {
                      if (hasPaymentFormDirty) {
                        setShowDiscardConfirm(true)
                        return
                      }

                      setPaymentActionMode(null)
                      setHasPaymentFormDirty(false)
                    }}
                  >
                    <Suspense fallback={<DeferredContentFallback title="Cargando flujo de cobro" description="Preparando el registro guiado del cobro." />}>
                      <LazyPaymentCreateFlow
                        invoices={[invoice]}
                        clients={[]}
                        properties={[]}
                        jobs={[]}
                        quotes={[]}
                        onRefreshData={onInvoiceUpdated}
                        onCompleted={async () => {
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
                        onCancel={() => {
                          setPaymentActionMode(null)
                          setHasPaymentFormDirty(false)
                        }}
                        onDirtyChange={setHasPaymentFormDirty}
                      />
                    </Suspense>
                  </ActionFlowOverlay>
                ) : null}

              </div>

              {invoice ? (
                <InvoiceCorrectionNotice
                  invoice={invoice}
                  correctionPrefill={correctionDraftPrefill}
                  onPrepareDraft={onPrepareCorrectionDraft}
                />
              ) : null}

              <CollapsibleDetailSection title="Documento y gestion" tone="neutral">
                <div className="cc-invoice-detail-card__section">
                <div className="section-header page-header-actions">
                  <div>
                    <h2>Documento y gestion</h2>
                    <p>Acciones administrativas y de contexto que no deben competir con el cobro principal.</p>
                  </div>
                </div>

                <div className="cc-invoice-detail-card__action-block">
                  <div className="cc-invoice-detail-card__action-copy">
                    <strong>Documento y archivo</strong>
                    <p>Abre el documento, edita con cautela o mueve la factura al historico desde las acciones superiores.</p>
                  </div>
                </div>

                {relationActions.length > 0 ? (
                  <div className="form-actions cc-invoice-detail-card__action-row">
                    <ActionGroup actions={relationActions} moreLabel="Mas relaciones" />
                  </div>
                ) : null}

                {statusActions.length > 0 ? (
                  <div className="form-actions cc-detail-panel__status-actions cc-invoice-detail-card__action-row">
                    <ActionGroup actions={statusActions} moreLabel="Estado admin." />
                  </div>
                ) : null}
                </div>
              </CollapsibleDetailSection>

              <CollapsibleDetailSection title="Contexto de factura" tone="neutral">
                <div className="cc-invoice-detail-card__section">
                <div className="section-header page-header-actions">
                  <div>
                    <h2>Contexto de factura</h2>
                    <p>Referencia fiscal, servicio y contenido visible de la factura seleccionada.</p>
                  </div>
                </div>

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
                  <span className="detail-label">Fecha de emision</span>
                  <strong>{formatDateEs(invoice.issue_date)}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Lineas</span>
                  <strong>
                    {displayLines.slice(0, 2).map((line) => `${line.concept} · ${formatLineSubtotalDisplay(line)}`).join(' | ')}
                    {displayLines.length > 2 ? ` | +${displayLines.length - 2} linea(s)` : ''}
                  </strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Notas</span>
                  <strong>{invoice.notes ?? 'Sin notas'}</strong>
                </div>
              </div>
                </div>
              </CollapsibleDetailSection>
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

      <ConfirmDialog
        isOpen={showDiscardConfirm}
        title={paymentActionMode ? 'Descartar cobro en curso' : 'Descartar cambios de factura'}
        description={paymentActionMode
          ? 'Has empezado a registrar un cobro. Si cierras ahora, perderas los cambios no guardados.'
          : 'Has modificado esta factura. Si cierras ahora, perderas los cambios no guardados.'}
        confirmLabel="Descartar cambios"
        tone="warning"
        onCancel={() => setShowDiscardConfirm(false)}
        onConfirm={() => {
          setShowDiscardConfirm(false)
          if (paymentActionMode) {
            setPaymentActionMode(null)
            setHasPaymentFormDirty(false)
            return
          }

          if (majorEditMode) {
            setIsDirty(false)
            resetFormFromInvoice()
            onMajorEditClose?.()
            return
          }

          setIsEditing(false)
          setIsDirty(false)
          resetFormFromInvoice()
        }}
      />

      <ConfirmDialog
        isOpen={showArchiveConfirm}
        title="Archivar factura"
        description="La factura seguira disponible en el historico, pero no dominara las vistas principales."
        confirmLabel="Archivar factura"
        tone="warning"
        onCancel={() => setShowArchiveConfirm(false)}
        onConfirm={() => {
          setShowArchiveConfirm(false)
          void handleArchiveInvoice()
        }}
      />

      <ConfirmDialog
        isOpen={showRestoreConfirm}
        title="Restaurar factura"
        description="La factura volvera a las vistas operativas."
        confirmLabel="Restaurar factura"
        tone="warning"
        onCancel={() => setShowRestoreConfirm(false)}
        onConfirm={() => {
          setShowRestoreConfirm(false)
          void handleRestoreInvoice()
        }}
      />

      <ConfirmDialog
        isOpen={showCancelConfirm}
        title="Anular factura emitida"
        description="Esta factura quedara marcada como anulada en el historico fiscal. No se eliminara."
        confirmLabel="Anular factura"
        tone="warning"
        onCancel={() => setShowCancelConfirm(false)}
        onConfirm={() => {
          setShowCancelConfirm(false)
          void handleCancelInvoice()
        }}
      />

      <ConfirmDialog
        isOpen={showTrashConfirm}
        title="Eliminar borrador"
        description="Esta accion movera el borrador a papelera."
        confirmLabel="Mover a papelera"
        tone="warning"
        onCancel={() => setShowTrashConfirm(false)}
        onConfirm={() => {
          setShowTrashConfirm(false)
          void handleTrashInvoice()
        }}
      />
    </section>
  )
}
