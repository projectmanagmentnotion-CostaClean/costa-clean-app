import {
  buildInvoiceFiscalSnapshot,
  extractInvoiceFiscalSnapshot,
  getClientFiscalData,
  normalizeClientFiscalData,
  type InvoiceFiscalSnapshot,
} from '../clients/clientFiscalData'
import type { ClientListItem } from '../clients/types'
import type { InvoiceListItem } from './types'

export interface InvoiceFiscalSnapshotValidation {
  isComplete: boolean
  missingFields: Array<'name' | 'tax_id' | 'billing_address'>
}

export interface InvoiceFiscalAuditSummary {
  total: number
  complete: number
  reparable: number
  incomplete: number
}

export interface InvoiceFiscalAuditEntry {
  invoice: InvoiceListItem
  client: ClientListItem | null
  snapshot: InvoiceFiscalSnapshot | null
  validation: InvoiceFiscalSnapshotValidation
  status: 'complete' | 'reparable' | 'incomplete'
}

export interface InvoiceFiscalBlockedEntry {
  invoiceId: string
  displayCode: string | null
  invoiceNumber: string | null
  clientId: string | null
  clientLabel: string
  missingFields: Array<'name' | 'tax_id' | 'billing_address'>
}

function isNonEmpty(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function validateClientFiscalSnapshot(snapshot: InvoiceFiscalSnapshot | null | undefined): InvoiceFiscalSnapshotValidation {
  const missingFields: Array<'name' | 'tax_id' | 'billing_address'> = []

  if (!snapshot || !isNonEmpty(snapshot.fiscal_name)) missingFields.push('name')
  if (!snapshot || !isNonEmpty(snapshot.tax_id)) missingFields.push('tax_id')
  if (!snapshot || !isNonEmpty(snapshot.billing_address)) missingFields.push('billing_address')

  return {
    isComplete: missingFields.length === 0,
    missingFields,
  }
}

export function hasCompleteInvoiceFiscalSnapshot(invoice: Pick<InvoiceListItem, 'client_id' | 'pricing_metadata'>): boolean {
  return validateClientFiscalSnapshot(extractInvoiceFiscalSnapshot(invoice)).isComplete
}

export function canBackfillInvoiceFiscalSnapshot(
  invoice: Pick<InvoiceListItem, 'client_id' | 'pricing_metadata'>,
  client: Pick<ClientListItem, 'id' | 'full_name' | 'tax_id' | 'billing_address' | 'email'> | null | undefined,
): boolean {
  if (!client || client.id !== invoice.client_id) return false
  if (hasCompleteInvoiceFiscalSnapshot(invoice)) return false
  return getClientFiscalData(client).isComplete
}

export function backfillInvoiceFiscalSnapshot(
  invoice: Pick<InvoiceListItem, 'client_id' | 'pricing_metadata'>,
  client: Pick<ClientListItem, 'id' | 'full_name' | 'tax_id' | 'billing_address' | 'email'> | null | undefined,
  source: 'client_backfill' | 'manual_fix' = 'client_backfill',
): Record<string, unknown> | null {
  if (!client || client.id !== invoice.client_id) return null

  const currentSnapshot = extractInvoiceFiscalSnapshot(invoice)
  const currentValidation = validateClientFiscalSnapshot(currentSnapshot)
  if (currentValidation.isComplete) return null

  const normalizedClient = normalizeClientFiscalData({
    tax_id: client.tax_id,
    billing_address: client.billing_address,
    fiscal_name: client.full_name,
  })

  if (!normalizedClient.tax_id || !normalizedClient.billing_address) {
    return null
  }

  const nextSnapshot = {
    ...(currentSnapshot ?? buildInvoiceFiscalSnapshot(client) ?? {
      client_id: client.id,
      captured_at: new Date().toISOString(),
      source,
    }),
    client_id: client.id,
    fiscal_name: currentSnapshot?.fiscal_name ?? normalizedClient.fiscal_name,
    tax_id: currentSnapshot?.tax_id ?? normalizedClient.tax_id,
    billing_address: currentSnapshot?.billing_address ?? normalizedClient.billing_address,
    email: currentSnapshot?.email ?? client.email ?? null,
    captured_at: new Date().toISOString(),
    source,
  } satisfies InvoiceFiscalSnapshot

  const currentMetadata = invoice.pricing_metadata && typeof invoice.pricing_metadata === 'object' && !Array.isArray(invoice.pricing_metadata)
    ? { ...invoice.pricing_metadata }
    : {}

  return {
    ...currentMetadata,
    client_fiscal_snapshot: nextSnapshot,
    fiscal_backfilled_at: new Date().toISOString(),
    fiscal_backfill_source: 'client',
  }
}

export function buildInvoiceFiscalAudit(invoices: InvoiceListItem[], clients: ClientListItem[]): {
  summary: InvoiceFiscalAuditSummary
  entries: InvoiceFiscalAuditEntry[]
} {
  const clientById = new Map(clients.map((client) => [client.id, client]))
  const entries = invoices.map((invoice) => {
    const client = clientById.get(invoice.client_id) ?? null
    const snapshot = extractInvoiceFiscalSnapshot(invoice)
    const validation = validateClientFiscalSnapshot(snapshot)
    const status = validation.isComplete
      ? 'complete'
      : canBackfillInvoiceFiscalSnapshot(invoice, client)
        ? 'reparable'
        : 'incomplete'

    return {
      invoice,
      client,
      snapshot,
      validation,
      status,
    } satisfies InvoiceFiscalAuditEntry
  })

  return {
    summary: {
      total: entries.length,
      complete: entries.filter((entry) => entry.status === 'complete').length,
      reparable: entries.filter((entry) => entry.status === 'reparable').length,
      incomplete: entries.filter((entry) => entry.status === 'incomplete').length,
    },
    entries,
  }
}

export function buildInvoiceFiscalBlockedEntries(entries: InvoiceFiscalAuditEntry[]): InvoiceFiscalBlockedEntry[] {
  return entries
    .filter((entry) => entry.status === 'incomplete')
    .map((entry) => ({
      invoiceId: entry.invoice.id,
      displayCode: entry.invoice.display_code ?? null,
      invoiceNumber: entry.invoice.invoice_number ?? null,
      clientId: entry.client?.id ?? entry.invoice.client_id ?? null,
      clientLabel: entry.client?.full_name
        ?? entry.invoice.client_name
        ?? entry.invoice.client_label
        ?? entry.invoice.client_id,
      missingFields: entry.validation.missingFields,
    }))
}

export function describeInvoiceFiscalMissingFields(
  missingFields: Array<'name' | 'tax_id' | 'billing_address'>,
): string {
  const labels = missingFields.map((field) => {
    switch (field) {
      case 'name':
        return 'nombre fiscal'
      case 'tax_id':
        return 'NIF/CIF'
      case 'billing_address':
        return 'direccion fiscal'
      default:
        return field
    }
  })

  return labels.length > 0 ? `Falta ${labels.join(' y ')}` : 'Sin bloqueos fiscales'
}

export function shouldShowInvoiceFiscalDebug(): boolean {
  return typeof window !== 'undefined' && window.location.search.includes('debugInvoiceFiscal=1')
}
