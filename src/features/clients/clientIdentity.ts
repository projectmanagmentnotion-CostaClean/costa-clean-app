import { normalizeClientFiscalData } from './clientFiscalData.ts'

export interface ClientCreateInput {
  id?: string | null
  full_name?: string | null
  phone?: string | null
  email?: string | null
  tax_id?: string | null
  billing_address?: string | null
  status?: string | null
  source_lead_id?: string | null
}

export interface NormalizedClientCreatePayload {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  tax_id: string | null
  billing_address: string | null
  status: string
  source_lead_id: string | null
}

export function trimNullable(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized ? normalized : null
}

export function createClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `CLIENT-${crypto.randomUUID()}`
  }

  return `CLIENT-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function normalizeClientStatus(status: string | null | undefined): string {
  return trimNullable(status)?.toLowerCase() ?? 'active'
}

export function validateClientForCreate(payload: NormalizedClientCreatePayload): NormalizedClientCreatePayload {
  if (!payload.id) {
    throw new Error('No se pudo crear el cliente porque falta identificador interno.')
  }

  if (!payload.full_name) {
    throw new Error('Debes indicar el nombre completo del cliente.')
  }

  return payload
}

export function normalizeClientInput(input: ClientCreateInput): NormalizedClientCreatePayload {
  const fullName = trimNullable(input.full_name)
  const fiscalData = normalizeClientFiscalData({
    tax_id: input.tax_id,
    billing_address: input.billing_address,
    fiscal_name: fullName,
  })

  return validateClientForCreate({
    id: trimNullable(input.id) ?? createClientId(),
    full_name: fullName ?? '',
    phone: trimNullable(input.phone),
    email: trimNullable(input.email),
    tax_id: fiscalData.tax_id,
    billing_address: fiscalData.billing_address,
    status: normalizeClientStatus(input.status),
    source_lead_id: trimNullable(input.source_lead_id),
  })
}
