import type { PublicQuotePricingBreakdown, QuoteRequestNormalizedInput } from './types'

export interface PublicQuoteRequestSuccess {
  ok: true
  message: string
  intakeSubmissionId: string
  leadDraftId: string
  quoteDraftId: string
  leadId: string
  quoteId: string | null
  matchedExistingLead: boolean
  pricing: PublicQuotePricingBreakdown
}

function isPublicQuoteRequestSuccess(value: unknown): value is PublicQuoteRequestSuccess {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'ok' in value &&
    value.ok === true &&
    'intakeSubmissionId' in value &&
    'leadDraftId' in value,
  )
}

function getErrorMessage(value: unknown): string {
  if (value && typeof value === 'object' && 'error' in value && typeof value.error === 'string') {
    return value.error
  }

  return 'No se pudo enviar la solicitud de presupuesto.'
}

export async function submitPublicQuoteRequest(
  normalizedInput: QuoteRequestNormalizedInput,
): Promise<PublicQuoteRequestSuccess> {
  const response = await fetch('/api/public-quote-request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source: 'public_quote_form',
      normalizedInput,
    }),
  })

  const responseBody = await response.json().catch(() => null) as unknown

  if (!response.ok || !isPublicQuoteRequestSuccess(responseBody)) {
    throw new Error(getErrorMessage(responseBody))
  }

  return responseBody
}
