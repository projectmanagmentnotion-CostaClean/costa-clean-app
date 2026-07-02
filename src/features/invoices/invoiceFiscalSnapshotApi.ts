import { getSupabaseClient } from '../../lib/supabase'
import { recordAuditEvent } from '../auditTrail/auditTrailApi'
import type { ClientListItem } from '../clients/types'
import type { InvoiceListItem } from './types'
import { backfillInvoiceFiscalSnapshot, buildInvoiceFiscalAudit } from './invoiceFiscalSnapshot'

function getClientOrThrow() {
  const { client, error } = getSupabaseClient()

  if (!client) {
    throw new Error(error ?? 'No se pudo inicializar Supabase.')
  }

  return client
}

export interface InvoiceFiscalBackfillRunResult {
  updated: number
  skipped: number
  blocked: number
  updatedInvoiceIds: string[]
  blockedInvoiceIds: string[]
}

export async function backfillSingleInvoiceFiscalSnapshot(invoice: InvoiceListItem, client: ClientListItem | null | undefined): Promise<boolean> {
  const nextMetadata = backfillInvoiceFiscalSnapshot(invoice, client)
  if (!nextMetadata) return false

  const supabase = getClientOrThrow()
  const { error } = await supabase
    .from('invoices')
    .update({
      pricing_metadata: nextMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoice.id)

  if (error) {
    throw new Error(error.message || 'No se pudo completar el snapshot fiscal de la factura.')
  }

  await recordAuditEvent({
    entityType: 'invoice',
    entityId: invoice.id,
    action: 'upsert',
    changedFields: ['pricing_metadata'],
    newValues: { pricing_metadata: nextMetadata },
    metadata: {
      client_id: invoice.client_id,
      audit_reason: 'fiscal_snapshot_backfill',
      fiscal_backfill_source: 'client',
    },
  })

  return true
}

export async function backfillInvoiceFiscalSnapshots(invoices: InvoiceListItem[], clients: ClientListItem[]): Promise<InvoiceFiscalBackfillRunResult> {
  const audit = buildInvoiceFiscalAudit(invoices, clients)
  const reparableEntries = audit.entries.filter((entry) => entry.status === 'reparable')
  const blockedEntries = audit.entries.filter((entry) => entry.status === 'incomplete')
  const updatedInvoiceIds: string[] = []

  for (const entry of reparableEntries) {
    const updated = await backfillSingleInvoiceFiscalSnapshot(entry.invoice, entry.client)
    if (updated) {
      updatedInvoiceIds.push(entry.invoice.id)
    }
  }

  return {
    updated: updatedInvoiceIds.length,
    skipped: audit.entries.length - updatedInvoiceIds.length - blockedEntries.length,
    blocked: blockedEntries.length,
    updatedInvoiceIds,
    blockedInvoiceIds: blockedEntries.map((entry) => entry.invoice.id),
  }
}
