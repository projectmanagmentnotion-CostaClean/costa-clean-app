import type { PublicQuotePricingAdjustment, QuoteRequestNormalizedInput } from '../publicIntake/types'

const maxConceptLength = 80
const maxManualConceptLength = 120

function normalizeText(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function compactConcept(value: string): string {
  const compacted = value.replace(/\s+/g, ' ').trim()
  if (compacted.length <= maxConceptLength) return compacted
  return `${compacted.slice(0, maxConceptLength - 3).trim()}...`
}

export function normalizeLineConcept(
  value: string | null | undefined,
  fallback = 'Servicio de limpieza',
): string {
  const compacted = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (!compacted) return fallback
  if (compacted.length <= maxManualConceptLength) return compacted
  return compacted.slice(0, maxManualConceptLength).trim()
}

function includesAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term))
}

function propertyLabelFromEngine(propertyType: string | null | undefined): string {
  if (propertyType === 'house_or_villa') return 'vivienda'
  if (propertyType === 'tourist_apartment') return 'apartamento'
  if (propertyType === 'office') return 'oficina'
  if (propertyType === 'local') return 'local'
  return 'piso'
}

function propertyLabelFromInput(input: QuoteRequestNormalizedInput): string {
  const raw = normalizeText(`${input.propertyType ?? ''} ${input.serviceNeedLabel ?? ''}`)
  if (includesAny(raw, ['casa', 'villa', 'vivienda'])) return 'vivienda'
  if (includesAny(raw, ['turist', 'airbnb', 'apartamento'])) return 'apartamento'
  if (includesAny(raw, ['oficina'])) return 'oficina'
  if (includesAny(raw, ['local'])) return 'local'
  return 'piso'
}

export function simplifyBaseQuoteLineConcept({
  input,
  serviceType,
  propertyType,
  fallback,
}: {
  input?: QuoteRequestNormalizedInput | null
  serviceType?: string | null
  propertyType?: string | null
  fallback?: string | null
}): string {
  const property = propertyType ? propertyLabelFromEngine(propertyType) : input ? propertyLabelFromInput(input) : 'piso'

  if (serviceType === 'deep_cleaning') return compactConcept(`Limpieza profunda de ${property}`)
  if (serviceType === 'airbnb_tourist') return compactConcept('Limpieza turistica de apartamento')
  if (serviceType === 'post_construction') return compactConcept(`Limpieza post-obra de ${property}`)
  if (serviceType === 'gym_fixed_model') return 'Servicio de limpieza de gimnasio'
  if (serviceType === 'hotel_or_multiroom') return 'Servicio de limpieza multiroom'
  if (serviceType === 'basic_cleaning') return compactConcept(`Limpieza basica de ${property}`)

  const text = normalizeText(`${input?.serviceNeedLabel ?? ''} ${input?.serviceFrequencyLabel ?? ''} ${fallback ?? ''}`)
  if (includesAny(text, ['profunda', 'deep'])) return compactConcept(`Limpieza profunda de ${property}`)
  if (includesAny(text, ['airbnb', 'turist', 'huesped'])) return 'Limpieza turistica de apartamento'
  if (includesAny(text, ['obra', 'post construction', 'fin de obra'])) return compactConcept(`Limpieza post-obra de ${property}`)
  if (includesAny(text, ['gimnasio', 'gym'])) return 'Servicio de limpieza de gimnasio'
  if (includesAny(text, ['cristal', 'ventana'])) return 'Limpieza de cristales'

  return compactConcept(`Limpieza basica de ${property}`)
}

export function simplifySupplementLineConcept(
  adjustment: PublicQuotePricingAdjustment | { code?: string | null; label?: string | null },
): string {
  const code = normalizeText(adjustment.code)
  const label = normalizeText(adjustment.label)
  const text = `${code} ${label}`

  if (includesAny(text, ['discount', 'descuento'])) return 'Descuento aplicado'
  if (includesAny(text, ['linen', 'ropa', 'cama', 'sabana'])) return 'Cambio de ropa de cama'
  if (includesAny(text, ['terrace', 'terraza', 'balcon', 'exterior'])) return 'Suplemento terraza'
  if (includesAny(text, ['garden', 'jardin'])) return 'Suplemento jardin'
  if (includesAny(text, ['window', 'ventana', 'cristal'])) return 'Limpieza de cristales'
  if (includesAny(text, ['bath', 'bano', 'baño'])) return 'Suplemento baños adicionales'
  if (includesAny(text, ['room', 'habitacion'])) return 'Suplemento habitaciones adicionales'
  if (includesAny(text, ['urgent', 'urgente'])) return 'Servicio urgente'

  return 'Suplemento servicio'
}

export function simplifyLineConcept(
  value: string | null | undefined,
  fallback = 'Servicio de limpieza',
): string {
  const text = normalizeText(value)

  if (!text) return fallback
  if (includesAny(text, ['descuento', 'discount'])) return 'Descuento aplicado'
  if (includesAny(text, ['suplemento', 'terrace', 'terraza', 'linen', 'ropa de cama', 'jardin', 'garden'])) {
    return simplifySupplementLineConcept({ label: value })
  }
  if (includesAny(text, ['profunda', 'deep'])) return 'Limpieza profunda de vivienda'
  if (includesAny(text, ['airbnb', 'turist', 'huesped'])) return 'Limpieza turistica de apartamento'
  if (includesAny(text, ['obra', 'post construction', 'fin de obra'])) return 'Limpieza post-obra de piso'
  if (includesAny(text, ['gimnasio', 'gym'])) return 'Servicio de limpieza de gimnasio'
  if (includesAny(text, ['cristal', 'ventana'])) return 'Limpieza de cristales'
  if (includesAny(text, ['limpieza'])) return 'Servicio de limpieza'

  return fallback
}
