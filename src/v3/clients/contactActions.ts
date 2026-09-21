export interface ContactActionOptions {
  region?: 'ES'
  text?: string
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

export function normalizeContactPhone(value: string | null | undefined, region: 'ES' = 'ES'): string | null {
  const raw = value?.trim().replace(/^whatsapp:/i, '').replace(/^tel:/i, '') ?? ''
  if (!raw) return null
  const hasPlus = raw.startsWith('+')
  const digits = digitsOnly(raw)
  if (region === 'ES' && !hasPlus && digits.length === 9) return `+34${digits}`
  if (digits.length < 7 || digits.length > 15) return null
  if (hasPlus) return `+${digits}`
  return digits
}

export function buildWhatsAppUrl(phone: string | null | undefined, options: ContactActionOptions = {}): string | null {
  const normalized = normalizeContactPhone(phone, options.region)
  if (!normalized) return null
  const number = normalized.replace('+', '')
  const text = options.text?.trim()
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

export function buildTelUrl(phone: string | null | undefined, region: 'ES' = 'ES'): string | null {
  const normalized = normalizeContactPhone(phone, region)
  return normalized ? `tel:${normalized}` : null
}

export function buildMailtoUrl(email: string | null | undefined, options: { subject?: string; body?: string } = {}): string | null {
  const normalized = email?.trim() ?? ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null
  const query = new URLSearchParams()
  if (options.subject?.trim()) query.set('subject', options.subject.trim())
  if (options.body?.trim()) query.set('body', options.body.trim())
  const suffix = query.toString()
  return `mailto:${normalized}${suffix ? `?${suffix}` : ''}`
}
