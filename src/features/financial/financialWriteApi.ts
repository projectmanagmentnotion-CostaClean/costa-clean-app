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
  const client = getClientOrThrow()
  const { error } = await client.rpc(functionName, params)

  if (error) {
    throw new Error(error.message || fallbackMessage)
  }
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
    metadata: { line_count: lines.length },
  })
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
    metadata: { line_count: lines.length },
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
    metadata: { invoice_id: payment.invoice_id },
  })
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
