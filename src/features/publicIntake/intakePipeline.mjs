import {
  buildCommunicationDraftPlaceholders,
  buildNotes,
  buildQuoteDraftSeed,
  calculatePricing,
  costaCleanLeadQuoteMessagingEngine,
  getDefaultTaxRate,
  mapPropertyType,
  mapServiceType,
} from '../../config/costaCleanLeadQuoteMessagingEngine.runtime.mjs'

export {
  buildCommunicationDraftPlaceholders,
  buildNotes,
  buildQuoteDraftSeed,
  calculatePricing,
  mapPropertyType,
  mapServiceType,
}

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
}

export const nativeQuoteRequestFieldMap = Object.fromEntries(
  Object.keys(googleFormsQuoteRequestFields).map((field) => [field, `native.${field}`]),
)

export const taxRate = getDefaultTaxRate()

export function createId(prefix) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function normalizeText(value) {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
    return null
  }

  const normalized = String(value).replace(/\s+/g, ' ').trim()
  return normalized || null
}

export function normalizeRequiredText(value) {
  return normalizeText(value) || ''
}

export function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value
  const text = normalizeText(value)?.toLocaleLowerCase('es-ES')
  if (!text) return null
  if (['si', 'sí', 'yes', 'true', '1', 'autorizo', 'acepto'].includes(text)) return true
  if (['no', 'false', '0', 'no autorizo'].includes(text)) return false
  return null
}

export function normalizeChannel(value) {
  const text = normalizeText(value)?.toLocaleLowerCase('es-ES') || ''
  if (['email', 'whatsapp', 'phone'].includes(text)) return text
  if (text.includes('whatsapp') || text.includes('wasap')) return 'whatsapp'
  if (text.includes('correo') || text.includes('email') || text.includes('e-mail')) return 'email'
  if (text.includes('tel') || text.includes('llamada')) return 'phone'
  return 'unknown'
}

export function normalizeEmail(value) {
  const email = normalizeText(value)?.toLocaleLowerCase('es-ES') || null
  if (!email) return null
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

export function normalizePhone(value) {
  const raw = normalizeRequiredText(value)
  const digits = raw.replace(/[^\d]/g, '')

  if (!digits) return { raw, normalized: '' }
  if (raw.trim().startsWith('+')) return { raw, normalized: `+${digits}` }
  if (digits.startsWith('00')) return { raw, normalized: `+${digits.slice(2)}` }
  if (digits.length === 9) return { raw, normalized: `+34${digits}` }

  return { raw, normalized: `+${digits}` }
}

export function normalizeRequestInput(input) {
  const phone = normalizePhone(input?.phone)

  return {
    normalizedInput: {
      submittedAt: normalizeText(input?.submittedAt) || new Date().toISOString(),
      fullName: normalizeRequiredText(input?.fullName),
      phone: phone.raw,
      email: normalizeEmail(input?.email),
      serviceNeedLabel: normalizeText(input?.serviceNeedLabel),
      scopeNotes: normalizeText(input?.scopeNotes),
      propertyType: normalizeText(input?.propertyType),
      sqmBand: normalizeText(input?.sqmBand),
      rooms: normalizeText(input?.rooms),
      bathrooms: normalizeText(input?.bathrooms),
      hasOutdoorAreas: normalizeBoolean(input?.hasOutdoorAreas),
      hasPets: normalizeBoolean(input?.hasPets),
      requestedServiceDate: normalizeText(input?.requestedServiceDate),
      preferredTimeSlot: normalizeText(input?.preferredTimeSlot),
      serviceFrequencyLabel: normalizeText(input?.serviceFrequencyLabel),
      preferredQuoteChannel: normalizeChannel(input?.preferredQuoteChannel),
      consentQuoteProcessing: normalizeBoolean(input?.consentQuoteProcessing) === true,
      postalCode: normalizeText(input?.postalCode),
      city: normalizeText(input?.city),
      urgencyLabel: normalizeText(input?.urgencyLabel),
      previousCleaningIssues: normalizeText(input?.previousCleaningIssues),
      legacyUnusedField: normalizeText(input?.legacyUnusedField),
    },
    normalizedPhone: phone.normalized,
  }
}

export function normalizeGoogleFormsQuoteRequestRow(row) {
  const mappedInput = {}

  for (const [field, header] of Object.entries(googleFormsQuoteRequestFields)) {
    mappedInput[field] = row[header]
  }

  return normalizeRequestInput(mappedInput)
}

export function validateInput(input, normalizedPhone) {
  const errors = {}
  const mandatoryMessages = costaCleanLeadQuoteMessagingEngine.mandatoryConditions.intake

  if (!input.fullName) errors.fullName = mandatoryMessages.fullName
  if (!input.phone || !normalizedPhone) errors.phone = mandatoryMessages.phone
  if (!input.serviceNeedLabel) errors.serviceNeedLabel = mandatoryMessages.serviceNeedLabel
  if (!input.serviceFrequencyLabel) errors.serviceFrequencyLabel = mandatoryMessages.serviceFrequencyLabel
  if (!input.propertyType) errors.propertyType = mandatoryMessages.propertyType
  if (!input.sqmBand) errors.sqmBand = mandatoryMessages.sqmBand
  if (!input.city) errors.city = mandatoryMessages.city
  if (!input.postalCode) errors.postalCode = mandatoryMessages.postalCode
  if (input.preferredQuoteChannel === 'unknown') errors.preferredQuoteChannel = mandatoryMessages.preferredQuoteChannel
  if (!input.consentQuoteProcessing) errors.consentQuoteProcessing = mandatoryMessages.consentQuoteProcessing

  return errors
}

export const googleFormLegacyAllowedMissingFields = [
  'consentQuoteProcessing',
  'city',
  'postalCode',
  'preferredQuoteChannel',
]

function normalizeGoogleFormLegacyTimestamp(value) {
  const text = normalizeText(value)
  if (!text) return text

  const legacyMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/)
  if (!legacyMatch) return text

  const [, dayText, monthText, yearText, hourText, minuteText, secondText] = legacyMatch
  const day = Number.parseInt(dayText, 10)
  const month = Number.parseInt(monthText, 10)
  const year = Number.parseInt(yearText, 10)
  const hour = Number.parseInt(hourText, 10)
  const minute = Number.parseInt(minuteText, 10)
  const second = Number.parseInt(secondText, 10)

  const timestamp = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  const isValidLegacyTimestamp =
    timestamp.getUTCFullYear() === year &&
    timestamp.getUTCMonth() === month - 1 &&
    timestamp.getUTCDate() === day &&
    timestamp.getUTCHours() === hour &&
    timestamp.getUTCMinutes() === minute &&
    timestamp.getUTCSeconds() === second

  return isValidLegacyTimestamp ? timestamp.toISOString() : text
}

export function prepareGoogleFormLegacyImportInput(input, rowNumber) {
  const preparedInput = { ...input }

  preparedInput.submittedAt = normalizeGoogleFormLegacyTimestamp(preparedInput.submittedAt)

  if (!preparedInput.fullName) {
    const identity = preparedInput.phone || preparedInput.email || `fila ${rowNumber}`
    preparedInput.fullName = `Lead importado Google Form (${identity})`
  }

  if (!preparedInput.city) preparedInput.city = null
  if (!preparedInput.postalCode) preparedInput.postalCode = null
  if (preparedInput.preferredQuoteChannel === 'unknown') preparedInput.preferredQuoteChannel = null
  if (preparedInput.consentQuoteProcessing !== true) preparedInput.consentQuoteProcessing = null

  return preparedInput
}

export function validateGoogleFormLegacyImportInput(input, normalizedPhone) {
  const errors = {}
  const hasLeadIdentity = Boolean(input.fullName || input.phone || input.email || normalizedPhone)
  const hasServiceContext = Boolean(
    input.serviceNeedLabel ||
      input.serviceFrequencyLabel ||
      input.propertyType ||
      input.sqmBand ||
      input.scopeNotes ||
      input.requestedServiceDate,
  )

  if (!hasLeadIdentity) {
    errors.leadIdentity = 'La fila legacy necesita nombre, teléfono o email para crear un borrador revisable.'
  }

  if (input.phone && !normalizedPhone) {
    errors.phone = 'El teléfono informado no se pudo normalizar.'
  }

  if (!hasServiceContext) {
    errors.serviceContext = 'La fila legacy necesita algún contexto de servicio para crear el borrador.'
  }

  return errors
}

export function buildLeadPayload(input, normalizedPhone, intakeSubmissionId, pricing, existingLead = null, source = 'public_quote_form') {
  const metadata = {
    source,
    last_intake_submission_id: intakeSubmissionId,
    preferred_quote_channel: input.preferredQuoteChannel,
    pricing_version: pricing.version,
  }

  if (existingLead) {
    return {
      full_name: existingLead.full_name || input.fullName,
      phone: input.phone,
      email: existingLead.email || input.email,
      city: input.city || existingLead.city || null,
      status: existingLead.status === 'new' ? 'contacted' : existingLead.status,
      normalized_phone: normalizedPhone,
      public_intake_last_submission_id: intakeSubmissionId,
      public_intake_metadata: metadata,
    }
  }

  return {
    id: createId(source === 'google_form_import' ? 'LEAD-GFORM' : 'LEAD-PUBLIC'),
    full_name: input.fullName,
    phone: input.phone,
    email: input.email,
    service_type: mapServiceType(input.serviceNeedLabel),
    property_type: mapPropertyType(input.propertyType),
    city: input.city,
    postal_code: input.postalCode,
    notes: buildNotes(input, pricing),
    status: 'new',
    normalized_phone: normalizedPhone,
    public_intake_last_submission_id: intakeSubmissionId,
    public_intake_metadata: metadata,
  }
}
