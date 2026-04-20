import { getSupabaseClient } from '../../lib/supabase'
import {
  calculatePricing,
  costaCleanLeadQuoteMessagingEngine,
  isForbiddenServiceRequested,
  mapPropertyType,
  mapServiceType,
} from '../../config/leadQuoteMessagingEngineAccess'
import type { ClientListItem } from '../clients/types'
import { convertLeadToClient, saveQuoteWithLines } from '../financial/financialWriteApi'
import type { LeadListItem } from '../leads/types'
import { createLocalId, roundMoney } from '../quotes/quoteLineUtils'
import type { QuoteLinePayload } from '../quotes/quoteLineUtils'
import { simplifyBaseQuoteLineConcept, simplifySupplementLineConcept } from '../quotes/lineConcepts'
import type { LeadDraftRecord } from './types'

type ClientAction = 'created' | 'linked_existing' | 'already_converted'

export interface LeadDraftClientLinkResult {
  clientId: string
  clientAction: ClientAction
}

export interface LeadDraftQuoteConversionResult {
  quoteId: string
  leadId: string
}

const convertibleDraftStatuses = new Set<LeadDraftRecord['status']>([
  'matched_existing_lead',
  'ready_for_review',
  'converted',
])

const replaceableQuoteStatuses = new Set(['draft', 'sent'])

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

function formatRequestValue(value: string | number | null | undefined, fallback = 'Pendiente de concretar'): string {
  const normalized = String(value ?? '').trim()
  return normalized || fallback
}

function buildRoomsLabel(leadDraft: LeadDraftRecord): string {
  return `Habitaciones: ${formatRequestValue(leadDraft.normalized_input.rooms)}`
}

function buildBathroomsLabel(leadDraft: LeadDraftRecord): string {
  return `Banos: ${formatRequestValue(leadDraft.normalized_input.bathrooms)}`
}

function buildVisibleQuoteNotes(leadDraft: LeadDraftRecord): string {
  const pricing = getEnginePricing(leadDraft)

  return [
    'Servicio solicitado:',
    formatRequestValue(leadDraft.quote_draft_seed.serviceSummary || leadDraft.normalized_input.serviceNeedLabel, 'Servicio de limpieza'),
    '',
    'Resumen de la estimacion:',
    `- ${formatRequestValue(pricing.operators, '-')} operario(s) x ${formatRequestValue(pricing.hoursPerOperator, '-')} horas`,
    `- ${buildRoomsLabel(leadDraft)}`,
    `- ${buildBathroomsLabel(leadDraft)}`,
    `- Horario solicitado: ${formatRequestValue(leadDraft.normalized_input.preferredTimeSlot)}`,
    `- Fecha solicitada: ${formatRequestValue(leadDraft.normalized_input.requestedServiceDate)}`,
    '',
    'Observaciones:',
    'Presupuesto estimado en base a la informacion facilitada. El precio final podra ajustarse si el estado real del inmueble o el alcance del servicio difieren de lo indicado inicialmente.',
    '',
    'Condiciones:',
    '- Si el servicio finaliza antes, solo se cobran las horas realmente trabajadas.',
    '- Si se necesita mas tiempo, se informara previamente.',
    '- Precios sin IVA.',
  ].join('\n')
}

function buildInternalQuoteNotes(leadDraft: LeadDraftRecord): string {
  const pricing = getEnginePricing(leadDraft)
  const internalNotes = [
    leadDraft.quote_draft_seed.notes?.trim() || null,
    pricing.limitations?.length ? `Limitaciones operativas: ${pricing.limitations.join(' ')}` : null,
    pricing.adjustments?.length ? `Suplementos aplicados: ${pricing.adjustments.map((item) => item.label).join(', ')}` : null,
    'Creado desde lead draft revisado. No enviado automaticamente.',
  ].filter(Boolean)

  return internalNotes.join('\n\n')
}

function buildPricingMetadata(leadDraft: LeadDraftRecord): Record<string, unknown> {
  const pricing = getEnginePricing(leadDraft)

  return {
    source: 'lead_draft_engine_quote',
    lead_draft_id: leadDraft.id,
    intake_submission_id: leadDraft.intake_submission_id,
    engine_id: pricing.engineId ?? costaCleanLeadQuoteMessagingEngine.engineId,
    engine_version: pricing.engineVersion ?? costaCleanLeadQuoteMessagingEngine.version,
    pricing_version: pricing.version,
    currency: pricing.currency,
    confidence: pricing.confidence,
    service_type: pricing.serviceType ?? mapServiceType(leadDraft.normalized_input.serviceNeedLabel),
    property_type: pricing.propertyType ?? mapPropertyType(leadDraft.normalized_input.propertyType),
    operators: pricing.operators,
    hours_per_operator: pricing.hoursPerOperator,
    minimum_total_hours: pricing.minimumTotalHours,
    total_hours: pricing.totalHours,
    hourly_rate: pricing.hourlyRate ?? costaCleanLeadQuoteMessagingEngine.pricing.baseHourlyRateStandard,
    price_structure: pricing.priceStructure,
    subtotal: pricing.subtotal,
    tax_rate: pricing.taxRate,
    tax_amount: pricing.taxAmount,
    total: pricing.total,
    supplements_total: pricing.supplementsTotal ?? 0,
    discount_total: pricing.discountTotal ?? 0,
    adjustments: pricing.adjustments,
    limitations: pricing.limitations ?? [],
    mandatory_messages: pricing.mandatoryMessages ?? costaCleanLeadQuoteMessagingEngine.mandatoryMessages,
  }
}

async function findReplaceableLeadQuote(leadId: string, intakeQuoteId: string | null): Promise<string | null> {
  const client = getClientOrThrow()

  if (intakeQuoteId) {
    const { data, error } = await client
      .from('quotes')
      .select('id,status')
      .eq('id', intakeQuoteId)
      .limit(1)

    if (error) {
      throw new Error(error.message || 'No se pudo comprobar el presupuesto existente del intake.')
    }

    const existingQuote = data?.[0] as { id?: string; status?: string | null } | undefined
    if (!existingQuote?.id) return null
    if (replaceableQuoteStatuses.has(existingQuote.status ?? '')) return existingQuote.id

    throw new Error('Este intake ya tiene un presupuesto finalizado o no reemplazable. No se sobrescribira automaticamente.')
  }

  const { data, error } = await client
    .from('quotes')
    .select('id,status')
    .eq('lead_id', leadId)
    .in('status', Array.from(replaceableQuoteStatuses))
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    throw new Error(error.message || 'No se pudo comprobar si el lead ya tiene presupuesto borrador.')
  }

  const existingQuote = data?.[0] as { id?: string } | undefined
  return existingQuote?.id ?? null
}

async function ensureNoFinalizedLeadQuoteConflict(leadId: string): Promise<void> {
  const client = getClientOrThrow()
  const { data, error } = await client
    .from('quotes')
    .select('id,status')
    .eq('lead_id', leadId)
    .in('status', ['accepted', 'rejected', 'expired', 'cancelled'])
    .limit(1)

  if (error) {
    throw new Error(error.message || 'No se pudo comprobar presupuestos finalizados del lead.')
  }

  if (data && data.length > 0) {
    throw new Error('Este lead ya tiene un presupuesto finalizado. No se creara otro borrador automaticamente.')
  }
}

function buildEngineQuoteLines(leadDraft: LeadDraftRecord, quoteId: string): QuoteLinePayload[] {
  const pricing = getEnginePricing(leadDraft)
  const serviceConcept = simplifyBaseQuoteLineConcept({
    input: leadDraft.normalized_input,
    serviceType: pricing.serviceType,
    propertyType: pricing.propertyType,
    fallback: leadDraft.quote_draft_seed.serviceSummary,
  })

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
      concept: simplifySupplementLineConcept(adjustment),
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
    .in('status', ['matched_existing_lead', 'ready_for_review', 'converted'])

  if (error) {
    throw new Error(error.message || 'No se pudo marcar el borrador como revisado.')
  }
}

export async function createOrLinkClientFromReviewedLeadDraft(
  lead: LeadListItem,
  leadDraft: LeadDraftRecord,
  _clients: ClientListItem[],
  _newClientStatus: 'active' | 'inactive' = 'active',
): Promise<LeadDraftClientLinkResult> {
  assertReviewedDraft(leadDraft)

  const result = await convertLeadToClient(lead.id)
  return { clientId: result.client_id, clientAction: result.client_action }
}

export async function convertReviewedLeadDraftToQuote(
  lead: LeadListItem,
  leadDraft: LeadDraftRecord,
  _clients: ClientListItem[],
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
  const existingQuoteId = await findReplaceableLeadQuote(lead.id, intakeRow?.quote_id ?? null)
  if (!existingQuoteId) {
    await ensureNoFinalizedLeadQuoteConflict(lead.id)
  }

  const quoteId = existingQuoteId ?? createRecordId('QUOTE')
  const subtotal = roundMoney(pricing.subtotal)
  const taxAmount = roundMoney(pricing.taxAmount)
  const total = roundMoney(pricing.total)
  const quoteLines = buildEngineQuoteLines(leadDraft, quoteId)

  await saveQuoteWithLines(
    {
      id: quoteId,
      client_id: null,
      lead_id: lead.id,
      property_id: null,
      status: 'draft',
      subtotal,
      tax_amount: taxAmount,
      total,
      notes: buildVisibleQuoteNotes(leadDraft),
      internal_notes: buildInternalQuoteNotes(leadDraft),
      pricing_metadata: buildPricingMetadata(leadDraft),
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

  if (intakeUpdateError) {
    throw new Error(intakeUpdateError.message || 'El presupuesto se creo, pero no se pudo vincular el intake.')
  }

  return {
    quoteId,
    leadId: lead.id,
  }
}
