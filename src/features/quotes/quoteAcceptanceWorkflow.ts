import { getSupabaseClient } from '../../lib/supabase'
import { recordAuditEvent } from '../auditTrail/auditTrailApi'
import { saveInvoiceWithLines, updateQuoteStatus } from '../financial/financialWriteApi'
import type { QuoteLineItem, QuoteListItem } from './types'
import { createLocalId, roundMoney } from './quoteLineUtils'

type ClientAction = 'activated' | 'linked_to_lead' | 'created_from_lead' | 'already_ready'

interface IntakeLeadLink {
  leadId: string | null
}

interface ClientRow {
  id: string
  status: string | null
  source_lead_id: string | null
}

interface LeadRow {
  id: string
  full_name: string
  phone: string | null
  email: string | null
}

export interface QuoteAcceptanceResult {
  invoiceId: string
  clientId: string
  clientAction: ClientAction
  leadId: string | null
}

function getClientOrThrow() {
  const { client, error } = getSupabaseClient()

  if (!client) {
    throw new Error(error ?? 'No se pudo inicializar Supabase.')
  }

  return client
}

function todayLocalDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getQuoteLines(quote: QuoteListItem): QuoteLineItem[] {
  return [...(quote.lines?.length ? quote.lines : quote.quote_lines ?? [])].sort(
    (left, right) => Number(left.sort_order) - Number(right.sort_order),
  )
}

async function getLeadLinkForQuote(quoteId: string): Promise<IntakeLeadLink> {
  const client = getClientOrThrow()
  const { data, error } = await client
    .from('intake_submissions')
    .select('lead_id')
    .eq('quote_id', quoteId)
    .limit(1)

  if (error) {
    throw new Error(error.message || 'No se pudo comprobar el lead origen del presupuesto.')
  }

  const row = data?.[0] as { lead_id?: string | null } | undefined
  return { leadId: row?.lead_id ?? null }
}

async function getClientRow(clientId: string): Promise<ClientRow | null> {
  const client = getClientOrThrow()
  const { data, error } = await client
    .from('clients')
    .select('id,status,source_lead_id')
    .eq('id', clientId)
    .limit(1)

  if (error) {
    throw new Error(error.message || 'No se pudo comprobar el cliente del presupuesto.')
  }

  return (data?.[0] as ClientRow | undefined) ?? null
}

async function getLeadRow(leadId: string): Promise<LeadRow | null> {
  const client = getClientOrThrow()
  const { data, error } = await client
    .from('leads')
    .select('id,full_name,phone,email')
    .eq('id', leadId)
    .limit(1)

  if (error) {
    throw new Error(error.message || 'No se pudo cargar el lead origen.')
  }

  return (data?.[0] as LeadRow | undefined) ?? null
}

async function ensureClientForAcceptedQuote(
  quote: QuoteListItem,
  leadId: string | null,
): Promise<{ clientId: string; clientAction: ClientAction }> {
  const client = getClientOrThrow()
  const existingClient = await getClientRow(quote.client_id)

  if (!existingClient) {
    if (!leadId) {
      throw new Error('El presupuesto no tiene cliente ni lead origen suficiente para convertir la aceptacion.')
    }

    const lead = await getLeadRow(leadId)
    if (!lead) {
      throw new Error('No se encontro el lead origen para crear el cliente.')
    }

    const { error } = await client
      .from('clients')
      .insert({
        id: quote.client_id,
        full_name: lead.full_name,
        phone: lead.phone,
        email: lead.email,
        status: 'active',
        source_lead_id: lead.id,
      })

    if (error) {
      throw new Error(error.message || 'No se pudo crear el cliente al aceptar el presupuesto.')
    }

    return { clientId: quote.client_id, clientAction: 'created_from_lead' }
  }

  const patch: Partial<Pick<ClientRow, 'status' | 'source_lead_id'>> = {}
  if (existingClient.status !== 'active') patch.status = 'active'
  if (leadId && !existingClient.source_lead_id) patch.source_lead_id = leadId

  if (Object.keys(patch).length > 0) {
    const { error } = await client
      .from('clients')
      .update(patch)
      .eq('id', existingClient.id)

    if (error) {
      throw new Error(error.message || 'No se pudo actualizar el cliente al aceptar el presupuesto.')
    }

    return {
      clientId: existingClient.id,
      clientAction: patch.source_lead_id ? 'linked_to_lead' : 'activated',
    }
  }

  return { clientId: existingClient.id, clientAction: 'already_ready' }
}

async function markLeadWon(leadId: string | null): Promise<void> {
  if (!leadId) return

  const client = getClientOrThrow()
  const { error } = await client
    .from('leads')
    .update({ status: 'won' })
    .eq('id', leadId)

  if (error) {
    throw new Error(error.message || 'No se pudo marcar el lead como ganado.')
  }
}

function buildInvoiceLinesFromQuote(quote: QuoteListItem, invoiceId: string) {
  const quoteLines = getQuoteLines(quote)
  if (quoteLines.length === 0) {
    throw new Error('El presupuesto necesita lineas cargadas para convertirlo en factura.')
  }

  return quoteLines.map((line, index) => ({
    id: createLocalId('INVOICE-LINE'),
    invoice_id: invoiceId,
    sort_order: index + 1,
    concept: line.concept,
    quantity: roundMoney(Number(line.quantity)),
    unit: line.unit?.trim() || 'servicio',
    unit_price: roundMoney(Number(line.unit_price)),
    line_subtotal: roundMoney(Number(line.line_subtotal)),
  }))
}

function buildInvoiceNotes(quote: QuoteListItem, leadId: string | null): string {
  return [
    `Factura creada automaticamente al aceptar presupuesto ${quote.display_code ?? quote.id}.`,
    leadId ? `Lead convertido: ${leadId}.` : null,
    quote.notes?.trim() || null,
  ].filter(Boolean).join('\n\n')
}

export async function acceptQuoteAndCreateInvoice(
  quote: QuoteListItem,
): Promise<QuoteAcceptanceResult> {
  if (quote.status === 'accepted') {
    throw new Error('Este presupuesto ya esta aceptado.')
  }

  const { leadId } = await getLeadLinkForQuote(quote.id)
  const { clientId, clientAction } = await ensureClientForAcceptedQuote(quote, leadId)
  const invoiceId = createLocalId('INVOICE')
  const invoiceLines = buildInvoiceLinesFromQuote(quote, invoiceId)

  await saveInvoiceWithLines(
    {
      id: invoiceId,
      job_id: quote.job_id ?? null,
      client_id: clientId,
      issue_date: todayLocalDate(),
      status: 'issued',
      subtotal: roundMoney(Number(quote.subtotal)),
      tax_amount: roundMoney(Number(quote.tax_amount ?? 0)),
      total: roundMoney(Number(quote.total)),
      notes: buildInvoiceNotes(quote, leadId),
    },
    invoiceLines,
  )

  await updateQuoteStatus(quote.id, 'accepted')
  await markLeadWon(leadId)
  await recordAuditEvent({
    entityType: 'quote',
    entityId: quote.id,
    action: 'status_update',
    changedFields: ['status'],
    newValues: {
      status: 'accepted',
    },
    metadata: {
      invoice_id: invoiceId,
      client_id: clientId,
      lead_id: leadId,
      client_action: clientAction,
    },
  })

  return {
    invoiceId,
    clientId,
    clientAction,
    leadId,
  }
}
