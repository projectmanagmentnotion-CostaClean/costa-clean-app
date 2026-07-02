import { getSupabaseClient } from '../../lib/supabase'
import { recordAuditEvent } from '../auditTrail/auditTrailApi'
import type { ClientListItem } from '../clients/types'
import type { InvoiceListItem } from './types'
import { backfillInvoiceFiscalSnapshot, buildInvoiceFiscalAudit } from './invoiceFiscalSnapshot'

type SupabaseErrorLike = {
  code?: string | null
  message?: string | null
}

type InvoiceRowWriteResult = {
  id: string
  pricing_metadata?: Record<string, unknown> | null
}

type SupabaseLike = {
  from: (table: string) => {
    update: (payload: Record<string, unknown>) => {
      eq: (column: string, value: string) => {
        select: (fields: string) => {
          maybeSingle: () => Promise<{ data: InvoiceRowWriteResult | null; error: SupabaseErrorLike | null }>
        }
      }
    }
  }
  rpc: (functionName: string, params?: Record<string, unknown>) => Promise<{ data: unknown; error: SupabaseErrorLike | null }>
}

interface InvoiceFiscalBackfillDependencies {
  getClient: () => SupabaseLike
  recordAuditEventFn: typeof recordAuditEvent
}

export interface InvoiceFiscalBackfillRunResult {
  expectedRepairable: number
  repaired: number
  blocked: number
  failed: number
  mode: 'rpc' | 'rest'
  repairedInvoiceIds: string[]
  blockedInvoiceIds: string[]
  failedInvoiceIds: string[]
}

const defaultDependencies: InvoiceFiscalBackfillDependencies = {
  getClient: () => {
    const { client, error } = getSupabaseClient()

    if (!client) {
      throw new Error(error ?? 'No se pudo inicializar Supabase.')
    }

    return client as unknown as SupabaseLike
  },
  recordAuditEventFn: recordAuditEvent,
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function hasVerifiedFiscalSnapshot(value: unknown): boolean {
  return isPlainRecord(value) && isPlainRecord(value.client_fiscal_snapshot)
}

function parseCount(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function parseIdList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : []
}

function shouldFallbackToRest(error: SupabaseErrorLike | null | undefined): boolean {
  const message = (error?.message ?? '').toLowerCase()
  const code = (error?.code ?? '').toUpperCase()

  return code === 'PGRST202'
    || message.includes('backfill_invoice_fiscal_snapshots')
    && (
      message.includes('could not find the function')
      || message.includes('schema cache')
      || message.includes('does not exist')
      || message.includes('not found')
    )
}

function buildNoPersistMessage(): string {
  return 'El backfill detecto facturas reparables, pero Supabase no confirmo ninguna actualizacion.'
}

function normalizeRpcBackfillResult(
  payload: unknown,
  expectedRepairable: number,
  fallbackBlockedInvoiceIds: string[],
): InvoiceFiscalBackfillRunResult {
  if (!isPlainRecord(payload)) {
    throw new Error('La RPC de backfill fiscal devolvio una respuesta invalida.')
  }

  const repairedInvoiceIds = parseIdList(payload.repaired_invoice_ids)
  const repaired = parseCount(payload.repaired, repairedInvoiceIds.length)
  const blockedInvoiceIds = parseIdList(payload.blocked_invoice_ids)
  const failedInvoiceIds = parseIdList(payload.failed_invoice_ids)

  return {
    expectedRepairable,
    repaired,
    blocked: parseCount(payload.blocked, blockedInvoiceIds.length || fallbackBlockedInvoiceIds.length),
    failed: parseCount(payload.failed, failedInvoiceIds.length),
    mode: 'rpc',
    repairedInvoiceIds,
    blockedInvoiceIds: blockedInvoiceIds.length > 0 ? blockedInvoiceIds : fallbackBlockedInvoiceIds,
    failedInvoiceIds,
  }
}

async function persistSingleInvoiceFiscalSnapshot(
  invoice: InvoiceListItem,
  client: ClientListItem | null | undefined,
  dependencies: InvoiceFiscalBackfillDependencies,
): Promise<{ updated: boolean; invoiceId: string }> {
  const nextMetadata = backfillInvoiceFiscalSnapshot(invoice, client)
  if (!nextMetadata) {
    return { updated: false, invoiceId: invoice.id }
  }

  const supabase = dependencies.getClient()
  const { data, error } = await supabase
    .from('invoices')
    .update({
      pricing_metadata: nextMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoice.id)
    .select('id,pricing_metadata')
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'No se pudo completar el snapshot fiscal de la factura.')
  }

  if (!data?.id || !hasVerifiedFiscalSnapshot(data.pricing_metadata)) {
    throw new Error(buildNoPersistMessage())
  }

  await dependencies.recordAuditEventFn({
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

  return { updated: true, invoiceId: invoice.id }
}

export async function backfillSingleInvoiceFiscalSnapshot(invoice: InvoiceListItem, client: ClientListItem | null | undefined): Promise<boolean> {
  const result = await persistSingleInvoiceFiscalSnapshot(invoice, client, defaultDependencies)
  return result.updated
}

export async function runInvoiceFiscalBackfillWithDependencies(
  invoices: InvoiceListItem[],
  clients: ClientListItem[],
  dependencies: InvoiceFiscalBackfillDependencies,
): Promise<InvoiceFiscalBackfillRunResult> {
  const audit = buildInvoiceFiscalAudit(invoices, clients)
  const reparableEntries = audit.entries.filter((entry) => entry.status === 'reparable')
  const blockedEntries = audit.entries.filter((entry) => entry.status === 'incomplete')
  const expectedRepairable = reparableEntries.length
  const blockedInvoiceIds = blockedEntries.map((entry) => entry.invoice.id)
  const supabase = dependencies.getClient()

  const rpcAttempt = await supabase.rpc('backfill_invoice_fiscal_snapshots')
  if (!rpcAttempt.error) {
    return normalizeRpcBackfillResult(rpcAttempt.data, expectedRepairable, blockedInvoiceIds)
  }

  if (!shouldFallbackToRest(rpcAttempt.error)) {
    throw new Error(rpcAttempt.error.message || 'No se pudo ejecutar el backfill fiscal.')
  }

  const repairedInvoiceIds: string[] = []
  const failedInvoiceIds: string[] = []

  for (const entry of reparableEntries) {
    try {
      const result = await persistSingleInvoiceFiscalSnapshot(entry.invoice, entry.client, dependencies)
      if (result.updated) {
        repairedInvoiceIds.push(result.invoiceId)
      }
    } catch {
      failedInvoiceIds.push(entry.invoice.id)
    }
  }

  return {
    expectedRepairable,
    repaired: repairedInvoiceIds.length,
    blocked: blockedEntries.length,
    failed: failedInvoiceIds.length,
    mode: 'rest',
    repairedInvoiceIds,
    blockedInvoiceIds,
    failedInvoiceIds,
  }
}

export async function backfillInvoiceFiscalSnapshots(invoices: InvoiceListItem[], clients: ClientListItem[]): Promise<InvoiceFiscalBackfillRunResult> {
  return runInvoiceFiscalBackfillWithDependencies(invoices, clients, defaultDependencies)
}

export const __invoiceFiscalSnapshotApiTestUtils = {
  buildNoPersistMessage,
  hasVerifiedFiscalSnapshot,
  normalizeRpcBackfillResult,
  shouldFallbackToRest,
}
