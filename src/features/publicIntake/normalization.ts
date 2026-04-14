import type { PreferredQuoteChannel } from './types'

export function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
    return null
  }

  const normalized = String(value).replace(/\s+/g, ' ').trim()
  return normalized.length > 0 ? normalized : null
}

export function normalizeRequiredText(value: unknown): string {
  return normalizeOptionalText(value) ?? ''
}

export function normalizeBoolean(value: unknown): boolean | null {
  const text = normalizeOptionalText(value)?.toLocaleLowerCase('es-ES')
  if (!text) return null

  if (['si', 'sí', 'yes', 'true', '1', 'autorizo', 'acepto'].includes(text)) {
    return true
  }

  if (['no', 'false', '0', 'no autorizo'].includes(text)) {
    return false
  }

  return null
}

export function normalizeConsent(value: unknown): boolean {
  return normalizeBoolean(value) === true
}

export function normalizePreferredQuoteChannel(value: unknown): PreferredQuoteChannel {
  const text = normalizeOptionalText(value)?.toLocaleLowerCase('es-ES') ?? ''

  if (text.includes('whatsapp') || text.includes('wasap')) return 'whatsapp'
  if (text.includes('correo') || text.includes('email') || text.includes('e-mail')) return 'email'
  if (text.includes('tel') || text.includes('llamada')) return 'phone'

  return 'unknown'
}
