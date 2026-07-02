import type { InvoiceListItem } from '../invoices/types.ts'
import type { ClientListItem } from './types.ts'

export type ClientFiscalMissingField = 'tax_id' | 'billing_address'

export interface NormalizedClientFiscalInput {
  tax_id: string | null
  billing_address: string | null
  fiscal_name: string | null
}

export interface ClientFiscalData {
  taxId: string | null
  billingAddress: string | null
  fiscalName: string | null
  isComplete: boolean
  missingFields: ClientFiscalMissingField[]
}

export interface InvoiceFiscalSnapshot extends NormalizedClientFiscalInput {
  client_id: string | null
  name?: string | null
  email?: string | null
  captured_at: string
  source: 'client_record' | 'client_backfill' | 'manual_fix'
}

export interface InvoiceFiscalDisplayData {
  clientName: string | null
  taxId: string | null
  billingAddress: string | null
  email: string | null
  source: 'snapshot' | 'dynamic'
}

function normalizeSingleLineText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.replace(/[’`´]/g, "'").replace(/\s+/g, ' ').trim()
  return normalized ? normalized : null
}

function normalizeMultilineText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const normalized = value
    .replace(/[’`´]/g, "'")
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')

  return normalized ? normalized : null
}

export function normalizeClientFiscalData(input: {
  taxId?: string | null
  tax_id?: string | null
  billingAddress?: string | null
  billing_address?: string | null
  fiscalName?: string | null
  fiscal_name?: string | null
}): NormalizedClientFiscalInput {
  return {
    tax_id: normalizeSingleLineText(input.tax_id ?? input.taxId)?.toUpperCase() ?? null,
    billing_address: normalizeMultilineText(input.billing_address ?? input.billingAddress),
    fiscal_name: normalizeSingleLineText(input.fiscal_name ?? input.fiscalName),
  }
}

export function getClientFiscalData(
  client: Pick<ClientListItem, 'full_name' | 'tax_id' | 'billing_address'> | null | undefined,
): ClientFiscalData {
  const normalized = normalizeClientFiscalData({
    tax_id: client?.tax_id ?? null,
    billing_address: client?.billing_address ?? null,
    fiscal_name: client?.full_name ?? null,
  })
  const missingFields: ClientFiscalMissingField[] = []

  if (!normalized.tax_id) missingFields.push('tax_id')
  if (!normalized.billing_address) missingFields.push('billing_address')

  return {
    taxId: normalized.tax_id,
    billingAddress: normalized.billing_address,
    fiscalName: normalized.fiscal_name,
    isComplete: missingFields.length === 0,
    missingFields,
  }
}

export function hasCompleteClientFiscalData(
  client: Pick<ClientListItem, 'full_name' | 'tax_id' | 'billing_address'> | null | undefined,
): boolean {
  return getClientFiscalData(client).isComplete
}

export function getClientFiscalIssueMessage(
  client: Pick<ClientListItem, 'full_name' | 'tax_id' | 'billing_address'> | null | undefined,
): string | null {
  if (!client) return null
  return hasCompleteClientFiscalData(client)
    ? null
    : 'Faltan NIF/CIF o direccion de facturacion en la ficha del cliente.'
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function buildInvoiceFiscalSnapshot(
  client: Pick<ClientListItem, 'id' | 'full_name' | 'tax_id' | 'billing_address' | 'email'> | null | undefined,
): InvoiceFiscalSnapshot | null {
  if (!client) return null

  const normalized = normalizeClientFiscalData({
    tax_id: client.tax_id,
    billing_address: client.billing_address,
    fiscal_name: client.full_name,
  })

  if (!normalized.tax_id && !normalized.billing_address && !normalized.fiscal_name) {
    return null
  }

  return {
    ...normalized,
    client_id: client.id,
    name: normalized.fiscal_name,
    email: normalizeSingleLineText(client.email),
    captured_at: new Date().toISOString(),
    source: 'client_record',
  }
}

export function buildInvoicePricingMetadataWithClientFiscalSnapshot(
  pricingMetadata: Record<string, unknown> | null | undefined,
  client: Pick<ClientListItem, 'id' | 'full_name' | 'tax_id' | 'billing_address' | 'email'> | null | undefined,
): Record<string, unknown> | null {
  const snapshot = buildInvoiceFiscalSnapshot(client)
  const nextMetadata = isPlainRecord(pricingMetadata) ? { ...pricingMetadata } : {}

  if (!snapshot) {
    return Object.keys(nextMetadata).length > 0 ? nextMetadata : null
  }

  nextMetadata.client_fiscal_snapshot = snapshot
  return nextMetadata
}

export function extractInvoiceFiscalSnapshot(invoice: Pick<InvoiceListItem, 'client_id' | 'pricing_metadata'>): InvoiceFiscalSnapshot | null {
  const metadata = invoice.pricing_metadata
  if (!isPlainRecord(metadata)) return null

  const rawSnapshot = (
    (isPlainRecord(metadata.client_fiscal_snapshot) ? metadata.client_fiscal_snapshot : null)
    ?? (isPlainRecord(metadata.clientFiscalSnapshot) ? metadata.clientFiscalSnapshot : null)
  )

  if (!rawSnapshot) return null

  const normalized = normalizeClientFiscalData({
    tax_id: typeof rawSnapshot.tax_id === 'string' ? rawSnapshot.tax_id : null,
    taxId: typeof rawSnapshot.taxId === 'string' ? rawSnapshot.taxId : null,
    billing_address: typeof rawSnapshot.billing_address === 'string' ? rawSnapshot.billing_address : null,
    billingAddress: typeof rawSnapshot.billingAddress === 'string' ? rawSnapshot.billingAddress : null,
    fiscal_name: typeof rawSnapshot.fiscal_name === 'string'
      ? rawSnapshot.fiscal_name
      : typeof rawSnapshot.fiscalName === 'string'
        ? rawSnapshot.fiscalName
        : typeof rawSnapshot.name === 'string'
          ? rawSnapshot.name
          : null,
  })

  if (!normalized.tax_id && !normalized.billing_address && !normalized.fiscal_name) {
    return null
  }

  return {
    ...normalized,
    client_id: typeof rawSnapshot.client_id === 'string'
      ? rawSnapshot.client_id
      : typeof rawSnapshot.clientId === 'string'
        ? rawSnapshot.clientId
        : invoice.client_id,
    name: typeof rawSnapshot.name === 'string'
      ? normalizeSingleLineText(rawSnapshot.name)
      : normalized.fiscal_name,
    email: typeof rawSnapshot.email === 'string' ? normalizeSingleLineText(rawSnapshot.email) : null,
    captured_at: typeof rawSnapshot.captured_at === 'string'
      ? rawSnapshot.captured_at
      : typeof rawSnapshot.capturedAt === 'string'
        ? rawSnapshot.capturedAt
        : new Date(0).toISOString(),
    source: 'client_record',
  }
}

export function getInvoiceFiscalDisplayData(
  invoice: Pick<InvoiceListItem, 'client_id' | 'client_name' | 'client_email' | 'pricing_metadata'>,
): InvoiceFiscalDisplayData {
  const snapshot = extractInvoiceFiscalSnapshot(invoice)

  if (snapshot) {
    return {
      clientName: snapshot.fiscal_name ?? snapshot.name ?? invoice.client_name ?? null,
      taxId: snapshot.tax_id,
      billingAddress: snapshot.billing_address,
      email: snapshot.email ?? invoice.client_email ?? null,
      source: 'snapshot',
    }
  }

  return {
    clientName: invoice.client_name ?? null,
    taxId: null,
    billingAddress: null,
    email: invoice.client_email ?? null,
    source: 'dynamic',
  }
}
