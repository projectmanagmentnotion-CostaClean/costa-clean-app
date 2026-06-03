import { getSupabaseClient } from '../../lib/supabase'
import { recordAuditEvent } from '../auditTrail/auditTrailApi'

type JsonRecord = Record<string, unknown>
type JsonPayload = object

function getClientOrThrow() {
  const { client, error } = getSupabaseClient()

  if (!client) {
    throw new Error(error ?? 'No se pudo inicializar Supabase.')
  }

  return client
}

async function callFinancialRpc(
  functionName: string,
  params: JsonRecord,
  fallbackMessage: string,
): Promise<void> {
  await callFinancialRpcForResult(functionName, params, fallbackMessage)
}

async function callFinancialRpcForResult<T>(
  functionName: string,
  params: JsonRecord,
  fallbackMessage: string,
): Promise<T> {
  const client = getClientOrThrow()
  const { data, error } = await client.rpc(functionName, params)

  if (error) {
    throw new Error(error.message || fallbackMessage)
  }

  return data as T
}

export async function saveQuoteWithLines(
  quote: JsonPayload,
  lines: JsonPayload[],
): Promise<void> {
  const quoteRecord = quote as JsonRecord

  await callFinancialRpc(
    'save_quote_with_lines',
    { p_quote: quote, p_lines: lines },
    'No se pudo guardar el presupuesto y sus lineas.',
  )
  await recordAuditEvent({
    entityType: 'quote',
    entityId: String(quoteRecord.id ?? ''),
    action: 'upsert',
    changedFields: Object.keys(quoteRecord),
    newValues: quoteRecord,
    metadata: {
      line_count: lines.length,
      pricing_metadata: quoteRecord.pricing_metadata ?? null,
      has_internal_notes: Boolean(quoteRecord.internal_notes),
    },
  })
}

export interface LeadQuoteSaveRpcResult {
  quote_id: string
  lead_id: string
  action: string
}

export async function saveLeadQuoteWithLines({
  leadId,
  intakeSubmissionId,
  quote,
  lines,
}: {
  leadId: string
  intakeSubmissionId: string | null
  quote: JsonPayload
  lines: JsonPayload[]
}): Promise<LeadQuoteSaveRpcResult> {
  const quoteRecord = quote as JsonRecord
  const result = await callFinancialRpcForResult<LeadQuoteSaveRpcResult>(
    'save_lead_quote_with_lines',
    {
      p_lead_id: leadId,
      p_intake_submission_id: intakeSubmissionId,
      p_quote: quote,
      p_lines: lines,
    },
    'No se pudo guardar el presupuesto del lead y sus lineas.',
  )

  await recordAuditEvent({
    entityType: 'quote',
    entityId: result.quote_id,
    action: 'upsert',
    changedFields: Object.keys(quoteRecord),
    newValues: { ...quoteRecord, id: result.quote_id, lead_id: result.lead_id },
    metadata: {
      lead_id: result.lead_id,
      intake_submission_id: intakeSubmissionId,
      action: result.action,
      line_count: lines.length,
      pricing_metadata: quoteRecord.pricing_metadata ?? null,
      has_internal_notes: Boolean(quoteRecord.internal_notes),
    },
  })

  return result
}

export async function saveInvoiceWithLines(
  invoice: JsonPayload,
  lines: JsonPayload[],
): Promise<void> {
  const invoiceRecord = invoice as JsonRecord

  await callFinancialRpc(
    'save_invoice_with_lines',
    { p_invoice: invoice, p_lines: lines },
    'No se pudo guardar la factura y sus lineas.',
  )
  await recordAuditEvent({
    entityType: 'invoice',
    entityId: String(invoiceRecord.id ?? ''),
    action: 'upsert',
    changedFields: Object.keys(invoiceRecord),
    newValues: invoiceRecord,
    metadata: {
      line_count: lines.length,
      pricing_metadata: invoiceRecord.pricing_metadata ?? null,
      has_internal_notes: Boolean(invoiceRecord.internal_notes),
    },
  })
}

export async function savePaymentAndRefreshInvoice(payment: JsonRecord): Promise<void> {
  await callFinancialRpc(
    'save_payment_and_refresh_invoice',
    { p_payment: payment },
    'No se pudo guardar el pago y sincronizar la factura.',
  )
  await recordAuditEvent({
    entityType: 'payment',
    entityId: String(payment.id ?? ''),
    action: 'upsert',
    changedFields: Object.keys(payment),
    newValues: payment,
    metadata: { invoice_id: payment.invoice_id, origin_type: payment.origin_type ?? 'manual' },
  })
}

export interface TransferSettlementRpcResult {
  payment_id: string | null
  invoice_id: string
  created_payment: boolean
  outstanding_before: number
  paid_total_after: number
  outstanding_after: number
  financial_status: 'pending' | 'partially_paid' | 'paid'
}

export async function settleInvoiceByTransfer(invoiceId: string): Promise<TransferSettlementRpcResult> {
  const result = await callFinancialRpcForResult<TransferSettlementRpcResult>(
    'settle_invoice_by_transfer',
    { p_invoice_id: invoiceId },
    'No se pudo registrar el cobro por transferencia.',
  )

  if (result.created_payment && result.payment_id) {
    await recordAuditEvent({
      entityType: 'payment',
      entityId: result.payment_id,
      action: 'upsert',
      changedFields: ['invoice_id', 'payment_date', 'amount', 'payment_method', 'origin_type'],
      newValues: {
        id: result.payment_id,
        invoice_id: result.invoice_id,
        amount: result.outstanding_before,
        payment_method: 'transfer',
        origin_type: 'transfer_auto',
      },
      metadata: {
        invoice_id: result.invoice_id,
        origin_type: 'transfer_auto',
        outstanding_before: result.outstanding_before,
        outstanding_after: result.outstanding_after,
      },
    })
  }

  return result
}

export async function refreshInvoicePaymentStatus(invoiceId: string): Promise<void> {
  await callFinancialRpc(
    'refresh_invoice_payment_status',
    { p_invoice_id: invoiceId },
    'No se pudo sincronizar el estado de pago de la factura.',
  )
}

export async function updateQuoteStatus(
  quoteId: string,
  status: string,
): Promise<void> {
  await callFinancialRpc(
    'update_quote_status',
    { p_quote_id: quoteId, p_status: status },
    'No se pudo actualizar el estado del presupuesto.',
  )
  await recordAuditEvent({
    entityType: 'quote',
    entityId: quoteId,
    action: 'status_update',
    changedFields: ['status'],
    newValues: { status },
  })
}

export interface LeadConversionRpcResult {
  client_id: string
  lead_id: string
  client_action: 'created' | 'linked_existing' | 'already_converted'
}

export async function convertLeadToClient(
  leadId: string,
  clientId?: string | null,
): Promise<LeadConversionRpcResult> {
  const result = await callFinancialRpcForResult<LeadConversionRpcResult>(
    'convert_lead_to_client',
    { p_lead_id: leadId, p_client_id: clientId ?? null },
    'No se pudo convertir el lead en cliente.',
  )

  await recordAuditEvent({
    entityType: 'lead',
    entityId: leadId,
    action: 'convert_to_client',
    changedFields: ['status', 'converted_client_id', 'converted_at'],
    newValues: { ...result },
    metadata: { client_id: result.client_id, client_action: result.client_action },
  })

  return result
}

export interface QuoteAcceptanceRpcResult {
  quote_id: string
  lead_id: string | null
  client_id: string
  invoice_id: string | null
  created_invoice: boolean
  client_action: string
}

export async function acceptQuoteWorkflow({
  quoteId,
  createInvoice,
  invoiceId,
  issueDate,
}: {
  quoteId: string
  createInvoice: boolean
  invoiceId?: string | null
  issueDate?: string | null
}): Promise<QuoteAcceptanceRpcResult> {
  const result = await callFinancialRpcForResult<QuoteAcceptanceRpcResult>(
    'accept_quote_workflow',
    {
      p_quote_id: quoteId,
      p_create_invoice: createInvoice,
      p_invoice_id: invoiceId ?? null,
      p_issue_date: issueDate ?? null,
    },
    createInvoice
      ? 'No se pudo aceptar el presupuesto y crear la factura.'
      : 'No se pudo aceptar el presupuesto.',
  )

  await recordAuditEvent({
    entityType: 'quote',
    entityId: quoteId,
    action: createInvoice ? 'accept_and_invoice' : 'accept',
    changedFields: createInvoice ? ['status', 'client_id', 'invoice_id'] : ['status', 'client_id'],
    newValues: { ...result },
    metadata: {
      lead_id: result.lead_id,
      client_id: result.client_id,
      invoice_id: result.invoice_id,
      client_action: result.client_action,
    },
  })

  return result
}

export async function updateInvoiceStatus(
  invoiceId: string,
  status: string,
): Promise<void> {
  await callFinancialRpc(
    'update_invoice_status',
    { p_invoice_id: invoiceId, p_status: status },
    'No se pudo actualizar el estado de la factura.',
  )
  await recordAuditEvent({
    entityType: 'invoice',
    entityId: invoiceId,
    action: 'status_update',
    changedFields: ['status'],
    newValues: { status },
  })
}
