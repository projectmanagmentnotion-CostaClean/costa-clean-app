import {
  normalizeBoolean,
  normalizeConsent,
  normalizeOptionalText,
  normalizePreferredQuoteChannel,
  normalizeRequiredText,
} from './normalization'
import type { IntakeSubmissionCreateInput, QuoteRequestNormalizedInput } from './types'

export const googleFormsQuoteRequestFields = {
  submittedAt: 'Marca temporal',
  fullName: 'Nombre completo',
  phone: 'Teléfono de contacto (con prefijo)',
  email: 'Correo electrónico',
  serviceNeedLabel: '¿Qué tipo de servicio necesitas?',
  scopeNotes: '¿Podrías contarnos brevemente qué necesitas o algún detalle adicional?',
  propertyType: '¿Qué tipo de propiedad es?',
  sqmBand: '¿Cuántos metros cuadrados tiene aproximadamente?',
  rooms: '¿Cuántas habitaciones tiene?',
  bathrooms: '¿Cuántos baños tiene?',
  hasOutdoorAreas: '¿Tiene terraza, balcón o zonas exteriores?',
  hasPets: '¿Hay mascotas en el lugar?',
  requestedServiceDate: '¿Para qué fecha necesitas el servicio?',
  preferredTimeSlot: '¿A qué hora puede realizarse la limpieza?',
  serviceFrequencyLabel: '¿Qué tipo de servicio estás buscando?',
  preferredQuoteChannel: '¿Cómo prefieres recibir tu presupuesto?',
  consentQuoteProcessing: '¿Nos autorizas a usar esta información solo para darte presupuesto?',
  postalCode: 'Código Postal',
  city: 'Población',
  urgencyLabel: '¿Cuándo necesita el servicio?',
  previousCleaningIssues: '¿Ha tenido problemas anteriormente con servicios de limpieza?',
  legacyUnusedField: 'Columna 19',
} as const

export type GoogleFormsQuoteRequestField = keyof typeof googleFormsQuoteRequestFields

type GoogleFormsQuoteRequestRow = Partial<Record<(typeof googleFormsQuoteRequestFields)[GoogleFormsQuoteRequestField], unknown>>

function getField(row: GoogleFormsQuoteRequestRow, field: GoogleFormsQuoteRequestField): unknown {
  return row[googleFormsQuoteRequestFields[field]]
}

export function normalizeGoogleFormsQuoteRequestRow(
  row: GoogleFormsQuoteRequestRow,
): QuoteRequestNormalizedInput {
  return {
    submittedAt: normalizeOptionalText(getField(row, 'submittedAt')),
    fullName: normalizeRequiredText(getField(row, 'fullName')),
    phone: normalizeRequiredText(getField(row, 'phone')),
    email: normalizeOptionalText(getField(row, 'email')),
    serviceNeedLabel: normalizeOptionalText(getField(row, 'serviceNeedLabel')),
    scopeNotes: normalizeOptionalText(getField(row, 'scopeNotes')),
    propertyType: normalizeOptionalText(getField(row, 'propertyType')),
    sqmBand: normalizeOptionalText(getField(row, 'sqmBand')),
    rooms: normalizeOptionalText(getField(row, 'rooms')),
    bathrooms: normalizeOptionalText(getField(row, 'bathrooms')),
    hasOutdoorAreas: normalizeBoolean(getField(row, 'hasOutdoorAreas')),
    hasPets: normalizeBoolean(getField(row, 'hasPets')),
    requestedServiceDate: normalizeOptionalText(getField(row, 'requestedServiceDate')),
    preferredTimeSlot: normalizeOptionalText(getField(row, 'preferredTimeSlot')),
    serviceFrequencyLabel: normalizeOptionalText(getField(row, 'serviceFrequencyLabel')),
    preferredQuoteChannel: normalizePreferredQuoteChannel(getField(row, 'preferredQuoteChannel')),
    consentQuoteProcessing: normalizeConsent(getField(row, 'consentQuoteProcessing')),
    postalCode: normalizeOptionalText(getField(row, 'postalCode')),
    city: normalizeOptionalText(getField(row, 'city')),
    urgencyLabel: normalizeOptionalText(getField(row, 'urgencyLabel')),
    previousCleaningIssues: normalizeOptionalText(getField(row, 'previousCleaningIssues')),
    legacyUnusedField: normalizeOptionalText(getField(row, 'legacyUnusedField')),
  }
}

export function buildGoogleFormsIntakeSubmissionInput(
  row: GoogleFormsQuoteRequestRow,
): IntakeSubmissionCreateInput {
  return {
    source: 'google_forms_csv',
    normalizedInput: normalizeGoogleFormsQuoteRequestRow(row),
    rawPayload: { ...row },
    sourceFieldMap: { ...googleFormsQuoteRequestFields },
  }
}
