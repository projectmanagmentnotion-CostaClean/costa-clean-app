import { getSupabaseClient } from '../../lib/supabase'
import { buildQuoteDraftSeed, calculatePricing } from '../../config/leadQuoteMessagingEngineAccess'
import type { LeadDraftRecord, QuoteDraftSeed } from './types'
import type { PublicQuotePricingBreakdown } from '../publicIntake/types'

interface LeadMessageDraftApiResponse {
  ok: true
  source: 'openai' | 'fallback'
  email_subject: string
  email_body: string
  whatsapp_message: string
  review_notes: string[]
  metadata: Record<string, unknown>
}

export interface LeadMessageDraftResponse extends LeadMessageDraftApiResponse {
  pricing_breakdown: PublicQuotePricingBreakdown
  quote_draft_seed: QuoteDraftSeed
}

function isLeadMessageDraftResponse(value: unknown): value is LeadMessageDraftApiResponse {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'ok' in value &&
    value.ok === true &&
    'email_body' in value &&
    typeof value.email_body === 'string' &&
    'whatsapp_message' in value &&
    typeof value.whatsapp_message === 'string',
  )
}

function getClientOrThrow() {
  const { client, error } = getSupabaseClient()

  if (!client) {
    throw new Error(error ?? 'No se pudo inicializar Supabase.')
  }

  return client
}

export async function regenerateLeadDraftMessages(leadDraft: LeadDraftRecord): Promise<LeadMessageDraftResponse> {
  const pricing = calculatePricing(leadDraft.normalized_input)
  const quoteDraftSeed = buildQuoteDraftSeed(leadDraft.normalized_input, pricing)

  const response = await fetch('/api/lead-message-drafts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lead_draft_id: leadDraft.id,
      normalized_input: leadDraft.normalized_input,
      pricing_breakdown: pricing,
      quote_draft_seed: quoteDraftSeed,
    }),
  })

  const responseBody = await response.json().catch(() => null) as unknown
  if (!response.ok || !isLeadMessageDraftResponse(responseBody)) {
    const errorMessage = responseBody && typeof responseBody === 'object' && 'error' in responseBody && typeof responseBody.error === 'string'
      ? responseBody.error
      : 'No se pudieron generar los borradores de comunicacion.'
    throw new Error(errorMessage)
  }

  const client = getClientOrThrow()
  const metadata = {
    ...(leadDraft.ai_generation_metadata ?? {}),
    ...responseBody.metadata,
    email_subject: responseBody.email_subject,
    review_notes: responseBody.review_notes,
    source: responseBody.source,
  }

  const { error } = await client
    .from('lead_drafts')
    .update({
      quote_draft_seed: quoteDraftSeed,
      pricing_breakdown: pricing,
      ai_email_draft: responseBody.email_body,
      ai_whatsapp_draft: responseBody.whatsapp_message,
      ai_draft_status: 'drafted',
      ai_generation_metadata: metadata,
    })
    .eq('id', leadDraft.id)

  if (error) {
    throw new Error(error.message || 'No se pudieron guardar los borradores generados.')
  }

  return {
    ...responseBody,
    pricing_breakdown: pricing,
    quote_draft_seed: quoteDraftSeed,
  }
}
