export type QuoteRelationshipInput = {
  clientId?: string | null
  leadId?: string | null
  propertyClientId?: string | null
  clientExists?: boolean
  leadExists?: boolean
}

export type QuoteRelationshipStatus = 'valid' | 'orphan' | 'mismatch'

export function classifyQuoteRelationship(input: QuoteRelationshipInput): QuoteRelationshipStatus {
  const clientId = input.clientId?.trim() || null
  const leadId = input.leadId?.trim() || null

  if (clientId && input.propertyClientId && input.propertyClientId !== clientId) {
    return 'mismatch'
  }

  const validClientPath = Boolean(clientId && input.clientExists !== false)
  const validLeadPath = Boolean(leadId && input.leadExists !== false)

  return validClientPath || validLeadPath ? 'valid' : 'orphan'
}
