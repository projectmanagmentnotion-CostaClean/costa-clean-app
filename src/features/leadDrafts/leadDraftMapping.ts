import type { LeadDraftCreateInput, QuoteDraftSeed } from './types'
import type { PublicQuotePricingBreakdown, QuoteRequestNormalizedInput } from '../publicIntake/types'
import { buildQuoteDraftSeed } from '../../config/leadQuoteMessagingEngineAccess'

function joinParts(parts: Array<string | null>): string {
  return parts.filter((part): part is string => Boolean(part)).join(' · ')
}

export function buildQuoteDraftSeedFromIntake(input: QuoteRequestNormalizedInput): QuoteDraftSeed {
  const serviceSummary = joinParts([
    input.serviceNeedLabel,
    input.serviceFrequencyLabel,
    input.propertyType,
    input.sqmBand,
  ]) || 'Solicitud de presupuesto de limpieza'

  const notes = [
    input.scopeNotes,
    input.rooms ? `Habitaciones: ${input.rooms}` : null,
    input.bathrooms ? `Baños: ${input.bathrooms}` : null,
    input.hasOutdoorAreas === null ? null : `Zonas exteriores: ${input.hasOutdoorAreas ? 'sí' : 'no'}`,
    input.hasPets === null ? null : `Mascotas: ${input.hasPets ? 'sí' : 'no'}`,
    input.urgencyLabel ? `Urgencia: ${input.urgencyLabel}` : null,
    input.previousCleaningIssues ? `Historial: ${input.previousCleaningIssues}` : null,
  ].filter((part): part is string => Boolean(part)).join('\n')

  return {
    status: 'draft',
    serviceSummary,
    notes,
    requestedServiceDate: input.requestedServiceDate,
    preferredTimeSlot: input.preferredTimeSlot,
    preferredQuoteChannel: input.preferredQuoteChannel,
  }
}

export function buildLeadDraftFromIntake(
  intakeSubmissionId: string,
  normalizedInput: QuoteRequestNormalizedInput,
  matchedLeadId: string | null = null,
  pricingBreakdown?: PublicQuotePricingBreakdown,
): LeadDraftCreateInput {
  return {
    intakeSubmissionId,
    normalizedInput,
    suggestedFullName: normalizedInput.fullName,
    phone: normalizedInput.phone,
    email: normalizedInput.email,
    city: normalizedInput.city,
    postalCode: normalizedInput.postalCode,
    status: matchedLeadId ? 'matched_existing_lead' : 'ready_for_review',
    matchedLeadId,
    quoteDraftSeed: {
      ...(pricingBreakdown
        ? buildQuoteDraftSeed(normalizedInput, pricingBreakdown)
        : buildQuoteDraftSeedFromIntake(normalizedInput)),
      ...(pricingBreakdown ? { pricingBreakdown } : {}),
    },
    ...(pricingBreakdown ? { pricingBreakdown } : {}),
  }
}
