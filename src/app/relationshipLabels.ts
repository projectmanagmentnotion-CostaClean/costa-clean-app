import { getServiceTypeLabel } from './displayFormat'

type NullableText = string | null | undefined

function normalizeText(value: NullableText): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function joinLabelParts(...parts: Array<NullableText>): string {
  const normalizedParts = parts
    .map((part) => normalizeText(part))
    .filter((part, index, array): part is string => Boolean(part) && array.indexOf(part) === index)

  return normalizedParts.length > 0 ? normalizedParts.join(' - ') : 'Sin referencia'
}

function resolveCode(code: NullableText, fallback: NullableText): string {
  return normalizeText(code) ?? normalizeText(fallback) ?? 'Sin referencia'
}

function truncateDescriptor(value: NullableText, maxLength = 56): string | null {
  const normalizedValue = normalizeText(value)
  if (!normalizedValue) return null
  if (normalizedValue.length <= maxLength) return normalizedValue
  return `${normalizedValue.slice(0, maxLength - 3).trimEnd()}...`
}

export function formatClientLabel(client: {
  id?: NullableText
  display_code?: NullableText
  full_name?: NullableText
  client_id?: NullableText
  client_display_code?: NullableText
  client_name?: NullableText
}): string {
  const code = resolveCode(client.display_code ?? client.client_display_code, client.id ?? client.client_id)
  const name = normalizeText(client.full_name ?? client.client_name)
  return joinLabelParts(code, name)
}

export function formatPropertyLabel(property: {
  id?: NullableText
  display_code?: NullableText
  name?: NullableText
  city?: NullableText
}): string {
  const code = resolveCode(property.display_code, property.id)
  const descriptor = truncateDescriptor(property.name)
  const city = normalizeText(property.city)
  return joinLabelParts(code, descriptor, city)
}

function getQuoteDescriptor(quote: {
  notes?: NullableText
  quote_lines?: Array<{ concept?: NullableText }> | null
  lines?: Array<{ concept?: NullableText }> | null
  property_name?: NullableText
  property_display_code?: NullableText
  client_name?: NullableText
  client_display_code?: NullableText
  lead_name?: NullableText
  lead_display_code?: NullableText
}): string | null {
  return truncateDescriptor(
    quote.notes
      ?? quote.property_name
      ?? quote.client_name
      ?? quote.lead_name
      ?? quote.property_display_code
      ?? quote.client_display_code
      ?? quote.lead_display_code,
  )
}

export function formatQuoteLabel(quote: {
  id?: NullableText
  display_code?: NullableText
  notes?: NullableText
  quote_lines?: Array<{ concept?: NullableText }> | null
  lines?: Array<{ concept?: NullableText }> | null
  property_name?: NullableText
  property_display_code?: NullableText
  client_name?: NullableText
  client_display_code?: NullableText
  lead_name?: NullableText
  lead_display_code?: NullableText
}): string {
  const code = resolveCode(quote.display_code, quote.id)
  const descriptor = getQuoteDescriptor(quote)
  const context = normalizeText(quote.client_name ?? quote.lead_name ?? quote.property_name ?? quote.property_display_code)
  return joinLabelParts(code, descriptor, context)
}

function getJobDescriptor(job: {
  billing_concept?: NullableText
  service_type?: NullableText
}): string | null {
  const normalizedConcept = truncateDescriptor(job.billing_concept)
  if (normalizedConcept) return normalizedConcept
  const normalizedServiceType = normalizeText(job.service_type)
  return normalizedServiceType ? getServiceTypeLabel(normalizedServiceType) : null
}

export function formatJobLabel(job: {
  id?: NullableText
  display_code?: NullableText
  billing_concept?: NullableText
  service_type?: NullableText
  property_name?: NullableText
  property_display_code?: NullableText
  client_name?: NullableText
  client_display_code?: NullableText
}): string {
  const code = resolveCode(job.display_code, job.id)
  const descriptor = getJobDescriptor(job)
  const context = normalizeText(job.property_name ?? job.client_name ?? job.property_display_code ?? job.client_display_code)
  return joinLabelParts(code, descriptor, context)
}

export function formatJobWithClientLabel(job: {
  id?: NullableText
  display_code?: NullableText
  billing_concept?: NullableText
  service_type?: NullableText
  property_name?: NullableText
  property_display_code?: NullableText
  client_id?: NullableText
  client_display_code?: NullableText
  client_name?: NullableText
}): string {
  return joinLabelParts(formatJobLabel(job), normalizeText(job.client_name ?? job.client_display_code ?? job.client_id))
}

export function formatInvoiceLabel(invoice: {
  id?: NullableText
  display_code?: NullableText
  invoice_number?: NullableText
  client_name?: NullableText
  client_display_code?: NullableText
  client_id?: NullableText
  service_description?: NullableText
  service_reference?: NullableText
  property_name?: NullableText
  property_display_code?: NullableText
}): string {
  const code = resolveCode(invoice.display_code, invoice.id)
  const number = normalizeText(invoice.invoice_number)
  const descriptor = truncateDescriptor(
    invoice.client_name
      ?? invoice.service_description
      ?? invoice.property_name
      ?? invoice.service_reference
      ?? invoice.client_display_code
      ?? invoice.client_id,
  )
  return joinLabelParts(code, number, descriptor)
}

export function formatRecurringPlanLabel(plan: {
  id?: NullableText
  title?: NullableText
  property_name?: NullableText
  property_display_code?: NullableText
  client_name?: NullableText
  client_display_code?: NullableText
}): string {
  const code = resolveCode(plan.id, plan.title)
  const descriptor = truncateDescriptor(plan.title)
  const context = normalizeText(plan.property_name ?? plan.client_name ?? plan.property_display_code ?? plan.client_display_code)
  return joinLabelParts(code, descriptor, context)
}
