function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function normalizeText(value: string | null | undefined): string {
  return collapseWhitespace(String(value ?? ''))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-ES')
}

export function normalizeLooseText(value: string | null | undefined): string {
  return normalizeText(value).replace(/[^\p{L}\p{N}\s]/gu, '')
}

export function normalizeEmail(value: string | null | undefined): string {
  return normalizeText(value)
}

export function normalizePhone(value: string | null | undefined): string {
  const digits = String(value ?? '').replace(/[^\d+]/g, '')
  if (!digits) return ''

  if (digits.startsWith('+')) {
    return `+${digits.slice(1).replace(/[^\d]/g, '')}`
  }

  const numeric = digits.replace(/[^\d]/g, '')
  if (!numeric) return ''
  if (numeric.startsWith('00')) return `+${numeric.slice(2)}`
  if (numeric.length === 9) return `+34${numeric}`
  return `+${numeric}`
}

export function normalizeTaxId(value: string | null | undefined): string {
  return normalizeText(value).replace(/[^a-z0-9]/g, '')
}

export function normalizeAddress(value: string | null | undefined): string {
  return normalizeLooseText(value)
    .replace(/\b(calle|carrer|avenida|avda|avinguda|plaza|placa|paseo|pg|passatge)\b/gu, '')
    .replace(/\b(numero|num)\b/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeMoney(value: number | string | null | undefined): string {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'))
  if (!Number.isFinite(parsed)) return ''
  return parsed.toFixed(2)
}

export function normalizeDateKey(value: string | null | undefined): string {
  if (!value) return ''
  return value.slice(0, 10)
}

export function daysBetween(left: string | null | undefined, right: string | null | undefined): number {
  if (!left || !right) return Number.POSITIVE_INFINITY
  const leftDate = new Date(left.length > 10 ? left : `${left}T00:00:00`)
  const rightDate = new Date(right.length > 10 ? right : `${right}T00:00:00`)
  if (Number.isNaN(leftDate.getTime()) || Number.isNaN(rightDate.getTime())) {
    return Number.POSITIVE_INFINITY
  }

  return Math.abs(leftDate.getTime() - rightDate.getTime()) / 86400000
}
