import { getSupabaseClient } from '../../lib/supabase'
import type { LeadDraftRecord } from './types'

export interface LeadMessageDraftResponse {
  ok: true
  source: 'openai' | 'fallback'
  email_subject: string
  email_body: string
  whatsapp_message: string
  review_notes: string[]
  metadata: Record<string, unknown>
}

function isLeadMessageDraftResponse(value: unknown): value is LeadMessageDraftResponse {
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

function getDraftPricing(leadDraft: LeadDraftRecord) {
  return leadDraft.pricing_breakdown ?? leadDraft.quote_draft_seed.pricingBreakdown ?? null
}

function getClientOrThrow() {
  const { client, error } = getSupabaseClient()

  if (!client) {
    throw new Error(error ?? 'No se pudo inicializar Supabase.')
  }

  return client
}

export async function regenerateLeadDraftMessages(leadDraft: LeadDraftRecord): Promise<LeadMessageDraftResponse> {
  const pricing = getDraftPricing(leadDraft)
  if (!pricing) {
    throw new Error('El borrador no tiene pricing para generar comunicaciones.')
  }

  const response = await fetch('/api/lead-message-drafts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lead_draft_id: leadDraft.id,
      normalized_input: leadDraft.normalized_input,
      pricing_breakdown: pricing,
      quote_draft_seed: leadDraft.quote_draft_seed,
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
      ai_email_draft: responseBody.email_body,
      ai_whatsapp_draft: responseBody.whatsapp_message,
      ai_draft_status: 'drafted',
      ai_generation_metadata: metadata,
    })
    .eq('id', leadDraft.id)

  if (error) {
    throw new Error(error.message || 'No se pudieron guardar los borradores generados.')
  }

  return responseBody
}
