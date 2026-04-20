import { getSupabaseClient } from '../../lib/supabase'
import {
  calculatePricing,
  costaCleanLeadQuoteMessagingEngine,
  isForbiddenServiceRequested,
  mapPropertyType,
  mapServiceType,
} from '../../config/leadQuoteMessagingEngineAccess'
import type { ClientListItem } from '../clients/types'
import { saveQuoteWithLines } from '../financial/financialWriteApi'
import type { LeadListItem } from '../leads/types'
import { createLocalId, roundMoney } from '../quotes/quoteLineUtils'
import type { QuoteLinePayload } from '../quotes/quoteLineUtils'
import type { LeadDraftRecord } from './types'

type ClientAction = 'created' | 'linked' | 'already_linked'

export interface LeadDraftClientLinkResult {
  clientId: string
  clientAction: ClientAction
}

export interface LeadDraftQuoteConversionResult extends LeadDraftClientLinkResult {
  quoteId: string
}

const convertibleDraftStatuses = new Set<LeadDraftRecord['status']>([
  'matched_existing_lead',
  'ready_for_review',
])

function getClientOrThrow() {
  const { client, error } = getSupabaseClient()

  if (!client) {
    throw new Error(error ?? 'No se pudo inicializar Supabase.')
  }

  return client
}

function createRecordId(prefix: string): string {
  return createLocalId(prefix)
}

function normalizePhone(value: string | null | undefined): string {
  return (value ?? '').replace(/[^\d]/g, '')
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function findLoadedClientMatch(
  lead: LeadListItem,
  clients: ClientListItem[],
): ClientListItem | null {
  const leadPhone = normalizePhone(lead.phone)
  const leadEmail = normalizeText(lead.email)

  return clients.find((client) => {
    if (client.source_lead_id === lead.id) return true
    if (client.source_lead_id) return false

    const clientPhone = normalizePhone(client.phone)
    const clientEmail = normalizeText(client.email)
    return Boolean(
      (leadPhone && clientPhone && leadPhone === clientPhone) ||
      (leadEmail && clientEmail && leadEmail === clientEmail),
    )
  }) ?? null
}

function getDraftPricing(leadDraft: LeadDraftRecord) {
  return leadDraft.pricing_breakdown ?? leadDraft.quote_draft_seed.pricingBreakdown ?? null
}

function getEnginePricing(leadDraft: LeadDraftRecord) {
  const pricing = calculatePricing(leadDraft.normalized_input)

  if (
    pricing.version !== costaCleanLeadQuoteMessagingEngine.pricingVersion ||
    pricing.currency !== costaCleanLeadQuoteMessagingEngine.currency ||
    pricing.confidence !== 'estimate'
  ) {
    throw new Error('El motor devolvio un pricing incompatible para crear el presupuesto CRM.')
  }

  return pricing
}

function assertReviewedDraft(leadDraft: LeadDraftRecord) {
  if (!convertibleDraftStatuses.has(leadDraft.status)) {
    throw new Error('Este borrador ya no esta disponible para conversion.')
  }

  if (leadDraft.ai_draft_status !== 'reviewed') {
    throw new Error('Marca la revision manual del borrador antes de crear cliente o presupuesto.')
  }

  if (isForbiddenServiceRequested(leadDraft.normalized_input)) {
    throw new Error('Este borrador contiene un servicio no disponible segun la politica interna. Revisalo antes de convertir.')
  }
}

function buildQuoteNotes(leadDraft: LeadDraftRecord): string {
  const pricing = getEnginePricing(leadDraft)
  const notes = leadDraft.quote_draft_seed.notes?.trim()
  const pricingNotes = [
    `Motor: ${pricing.engineId ?? costaCleanLeadQuoteMessagingEngine.engineId} v${pricing.engineVersion ?? costaCleanLeadQuoteMessagingEngine.version} / ${pricing.version}.`,
    `Clasificacion: servicio ${pricing.serviceType ?? mapServiceType(leadDraft.normalized_input.serviceNeedLabel)}; propiedad ${pricing.propertyType ?? mapPropertyType(leadDraft.normalized_input.propertyType)}.`,
    `Equipo: ${pricing.operators ?? '-'} operador(es) x ${pricing.hoursPerOperator ?? '-'}h; minimo ${pricing.minimumTotalHours ?? '-'}h; total ${pricing.totalHours ?? '-'}h.`,
    `Tarifa: ${pricing.hourlyRate ?? costaCleanLeadQuoteMessagingEngine.pricing.baseHourlyRateStandard} EUR/h. Suplementos: ${(pricing.supplementsTotal ?? 0).toFixed(2)} EUR. Descuento: ${(pricing.discountTotal ?? 0).toFixed(2)} EUR.`,
    `Modelo ${pricing.priceStructure ?? 'standard'}: base ${pricing.subtotal.toFixed(2)} EUR; base facturada ${(pricing.invoicedBase ?? pricing.subtotal).toFixed(2)} EUR; no facturada ${(pricing.nonInvoicedAmount ?? 0).toFixed(2)} EUR.`,
    `IVA ${pricing.taxRate * 100}%: ${pricing.taxAmount.toFixed(2)} EUR. Total cliente: ${pricing.total.toFixed(2)} EUR. Confianza: ${pricing.confidence}.`,
    ...(pricing.mandatoryMessages ?? costaCleanLeadQuoteMessagingEngine.mandatoryMessages),
    ...(pricing.limitations ?? []),
  ].join('\n')

  return [notes, pricingNotes, 'Creado desde lead draft revisado. No enviado automaticamente.']
    .filter((part): part is string => Boolean(part))
    .join('\n\n')
}

function buildEngineQuoteLines(leadDraft: LeadDraftRecord, quoteId: string): QuoteLinePayload[] {
  const pricing = getEnginePricing(leadDraft)
  const serviceConcept = [
    leadDraft.quote_draft_seed.serviceSummary.trim() || leadDraft.normalized_input.serviceNeedLabel || 'Servicio de limpieza',
    pricing.serviceType ? `motor:${pricing.serviceType}` : null,
    pricing.propertyType ? `propiedad:${pricing.propertyType}` : null,
  ].filter(Boolean).join(' · ')

  const lines: QuoteLinePayload[] = [
    {
      id: createRecordId('QUOTE-LINE'),
      quote_id: quoteId,
      sort_order: 1,
      concept: serviceConcept,
      quantity: roundMoney(pricing.totalHours ?? 1),
      unit: 'hora',
      unit_price: roundMoney(pricing.hourlyRate ?? pricing.baseAmount),
      line_subtotal: roundMoney(pricing.serviceAdjustedAmount),
    },
  ]

  for (const adjustment of pricing.adjustments) {
    lines.push({
      id: createRecordId('QUOTE-LINE'),
      quote_id: quoteId,
      sort_order: lines.length + 1,
      concept: `Suplemento motor: ${adjustment.label}`,
      quantity: 1,
      unit: 'suplemento',
      unit_price: roundMoney(adjustment.amount),
      line_subtotal: roundMoney(adjustment.amount),
    })
  }

  if ((pricing.discountTotal ?? 0) > 0) {
    lines.push({
      id: createRecordId('QUOTE-LINE'),
      quote_id: quoteId,
      sort_order: lines.length + 1,
      concept: 'Descuento motor aplicado sobre parte facturada',
      quantity: 1,
      unit: 'descuento',
      unit_price: -roundMoney(pricing.discountTotal ?? 0),
      line_subtotal: -roundMoney(pricing.discountTotal ?? 0),
    })
  }

  return lines
}

export async function markLeadDraftReviewed(leadDraftId: string): Promise<void> {
  const client = getClientOrThrow()
  const { error } = await client
    .from('lead_drafts')
    .update({ ai_draft_status: 'reviewed' })
    .eq('id', leadDraftId)
    .in('status', ['matched_existing_lead', 'ready_for_review'])

  if (error) {
    throw new Error(error.message || 'No se pudo marcar el borrador como revisado.')
  }
}

export async function createOrLinkClientFromReviewedLeadDraft(
  lead: LeadListItem,
  leadDraft: LeadDraftRecord,
  clients: ClientListItem[],
  newClientStatus: 'active' | 'inactive' = 'active',
): Promise<LeadDraftClientLinkResult> {
  assertReviewedDraft(leadDraft)

  const client = getClientOrThrow()
  const { data: linkedClients, error: linkedError } = await client
    .from('clients')
    .select('id,source_lead_id')
    .eq('source_lead_id', lead.id)
    .limit(1)

  if (linkedError) {
    throw new Error(linkedError.message || 'No se pudo comprobar el cliente vinculado.')
  }

  if (linkedClients && linkedClients.length > 0) {
    return { clientId: String(linkedClients[0].id), clientAction: 'already_linked' }
  }

  const loadedMatch = findLoadedClientMatch(lead, clients)
  if (loadedMatch) {
    if (loadedMatch.source_lead_id === lead.id) {
      return { clientId: loadedMatch.id, clientAction: 'already_linked' }
    }

    const { error: linkError } = await client
      .from('clients')
      .update({ source_lead_id: lead.id })
      .eq('id', loadedMatch.id)
      .is('source_lead_id', null)

    if (linkError) {
      throw new Error(linkError.message || 'No se pudo vincular el cliente existente.')
    }

    return { clientId: loadedMatch.id, clientAction: 'linked' }
  }

  const clientId = createRecordId('CLIENT')
  const { error: createError } = await client
    .from('clients')
    .insert({
      id: clientId,
      full_name: lead.full_name,
      phone: lead.phone || leadDraft.phone || null,
      email: lead.email ?? leadDraft.email ?? null,
      status: newClientStatus,
      source_lead_id: lead.id,
    })

  if (createError) {
    throw new Error(createError.message || 'No se pudo crear el cliente desde el lead.')
  }

  return { clientId, clientAction: 'created' }
}

export async function convertReviewedLeadDraftToQuote(
  lead: LeadListItem,
  leadDraft: LeadDraftRecord,
  clients: ClientListItem[],
): Promise<LeadDraftQuoteConversionResult> {
  assertReviewedDraft(leadDraft)

  const originalPricing = getDraftPricing(leadDraft)
  if (originalPricing && originalPricing.version !== costaCleanLeadQuoteMessagingEngine.pricingVersion) {
    throw new Error(`El borrador fue generado con ${originalPricing.version}; se necesita ${costaCleanLeadQuoteMessagingEngine.pricingVersion}.`)
  }

  const pricing = getEnginePricing(leadDraft)
  if (pricing.forbiddenServiceRequested || isForbiddenServiceRequested(leadDraft.normalized_input)) {
    throw new Error('Este borrador contiene un servicio no disponible segun la politica interna. Revisalo antes de convertir.')
  }

  const client = getClientOrThrow()
  const { data: intakeRows, error: intakeError } = await client
    .from('intake_submissions')
    .select('id,quote_id')
    .eq('id', leadDraft.intake_submission_id)
    .limit(1)

  if (intakeError) {
    throw new Error(intakeError.message || 'No se pudo comprobar el intake origen.')
  }

  const intakeRow = intakeRows?.[0] as { quote_id?: string | null } | undefined
  if (intakeRow?.quote_id) {
    throw new Error('Este intake ya tiene un presupuesto CRM vinculado.')
  }

  const clientLink = await createOrLinkClientFromReviewedLeadDraft(lead, leadDraft, clients, 'inactive')
  const quoteId = createRecordId('QUOTE')
  const subtotal = roundMoney(pricing.subtotal)
  const taxAmount = roundMoney(pricing.taxAmount)
  const total = roundMoney(pricing.total)
  const quoteLines = buildEngineQuoteLines(leadDraft, quoteId)

  await saveQuoteWithLines(
    {
      id: quoteId,
      client_id: clientLink.clientId,
      property_id: null,
      status: 'draft',
      subtotal,
      tax_amount: taxAmount,
      total,
      notes: buildQuoteNotes(leadDraft),
    },
    quoteLines,
  )

  const { error: leadError } = await client
    .from('leads')
    .update({ status: 'quoted' })
    .eq('id', lead.id)

  if (leadError) {
    throw new Error(leadError.message || 'El presupuesto se creo, pero no se pudo actualizar el lead.')
  }

  const { error: draftError } = await client
    .from('lead_drafts')
    .update({ status: 'converted', matched_lead_id: lead.id })
    .eq('id', leadDraft.id)

  if (draftError) {
    throw new Error(draftError.message || 'El presupuesto se creo, pero no se pudo cerrar el borrador.')
  }

  const { error: intakeUpdateError } = await client
    .from('intake_submissions')
    .update({
      status: 'converted',
      lead_id: lead.id,
      quote_id: quoteId,
    })
    .eq('id', leadDraft.intake_submission_id)
    .is('quote_id', null)

  if (intakeUpdateError) {
    throw new Error(intakeUpdateError.message || 'El presupuesto se creo, pero no se pudo vincular el intake.')
  }

  return {
    ...clientLink,
    quoteId,
  }
}
