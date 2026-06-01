type NullableText = string | null | undefined

function normalizeText(value: NullableText): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function buildCodeAndNameLabel(code: NullableText, name: NullableText, fallback: NullableText): string {
  const normalizedCode = normalizeText(code)
  const normalizedName = normalizeText(name)
  const normalizedFallback = normalizeText(fallback)

  if (normalizedCode && normalizedName) {
    return `${normalizedCode} · ${normalizedName}`
  }

  return normalizedName ?? normalizedCode ?? normalizedFallback ?? 'Sin referencia'
}

export function formatClientLabel(client: {
  id?: NullableText
  display_code?: NullableText
  full_name?: NullableText
  client_id?: NullableText
  client_display_code?: NullableText
  client_name?: NullableText
}): string {
  return buildCodeAndNameLabel(
    client.display_code ?? client.client_display_code,
    client.full_name ?? client.client_name,
    client.id ?? client.client_id,
  )
}

export function formatPropertyLabel(property: {
  id?: NullableText
  display_code?: NullableText
  name?: NullableText
}): string {
  const name = normalizeText(property.name)
  const code = normalizeText(property.display_code)
  const identifier = normalizeText(property.id)

  if (name && code) {
    return `${name} · ${code}`
  }

  return name ?? code ?? identifier ?? 'Sin propiedad'
}

export function formatQuoteLabel(quote: {
  id?: NullableText
  display_code?: NullableText
}): string {
  return normalizeText(quote.display_code) ?? normalizeText(quote.id) ?? 'Sin presupuesto'
}

export function formatJobLabel(job: {
  id?: NullableText
  display_code?: NullableText
}): string {
  return normalizeText(job.display_code) ?? normalizeText(job.id) ?? 'Sin servicio'
}

export function formatJobWithClientLabel(job: {
  id?: NullableText
  display_code?: NullableText
  client_id?: NullableText
  client_display_code?: NullableText
  client_name?: NullableText
}): string {
  return `${formatJobLabel(job)} · ${formatClientLabel(job)}`
}
