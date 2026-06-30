import type { InvoiceListItem } from '../invoices/types'
import { extractInvoiceFiscalSnapshot, getClientFiscalData, normalizeClientFiscalData, type ClientFiscalMissingField } from './clientFiscalData'
import { applyClientFiscalBackfillRecord } from './clientWriteApi'
import type { ClientListItem } from './types'

interface BackfillInvoiceCandidate {
  invoiceId: string
  fiscal_name: string | null
  tax_id: string | null
  billing_address: string | null
}

export type ClientFiscalBackfillAppliedField = 'full_name' | 'tax_id' | 'billing_address' | 'status'

export interface ClientFiscalBackfillUpdate {
  clientId: string
  clientLabel: string
  missingFields: ClientFiscalMissingField[]
  nextFullName: string | null
  nextTaxId: string | null
  nextBillingAddress: string | null
  nextStatus: 'active'
  appliedFields: ClientFiscalBackfillAppliedField[]
  sourceInvoiceIds: string[]
}

export interface ClientFiscalBackfillConflict {
  clientId: string
  clientLabel: string
  field: ClientFiscalMissingField
  candidateValues: string[]
  sourceInvoiceIds: string[]
}

export interface ClientFiscalBackfillSkipped {
  clientId: string
  clientLabel: string
  reason: 'already_complete' | 'no_issued_invoices' | 'no_structured_fiscal_data'
  sourceInvoiceIds: string[]
}

export interface ClientFiscalBackfillPlan {
  updates: ClientFiscalBackfillUpdate[]
  conflicts: ClientFiscalBackfillConflict[]
  skipped: ClientFiscalBackfillSkipped[]
}

export interface ClientFiscalBackfillResult {
  reviewedInvoices: number
  invoicesWithoutStructuredFiscalData: string[]
  updatedClients: Array<{ clientId: string; clientLabel: string; appliedFields: ClientFiscalBackfillAppliedField[] }>
  skippedClients: ClientFiscalBackfillSkipped[]
  conflicts: ClientFiscalBackfillConflict[]
}

export function extractFiscalDataFromInvoice(invoice: InvoiceListItem): BackfillInvoiceCandidate | null {
  if (invoice.status !== 'issued' && invoice.status !== 'paid') {
    return null
  }

  const snapshot = extractInvoiceFiscalSnapshot(invoice)
  if (!snapshot) return null

  const normalized = normalizeClientFiscalData(snapshot)

  if (!normalized.tax_id && !normalized.billing_address && !normalized.fiscal_name) {
    return null
  }

  return {
    invoiceId: invoice.id,
    fiscal_name: normalized.fiscal_name,
    tax_id: normalized.tax_id,
    billing_address: normalized.billing_address,
  }
}

function uniqueNonEmpty(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

function normalizeComparableName(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null

  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

  return normalized || null
}

export function buildClientFiscalBackfillPlan(
  clients: ClientListItem[],
  invoices: InvoiceListItem[],
): ClientFiscalBackfillPlan {
  const invoicesByClientId = new Map<string, InvoiceListItem[]>()

  for (const invoice of invoices) {
    if (!invoice.client_id) continue
    const current = invoicesByClientId.get(invoice.client_id) ?? []
    current.push(invoice)
    invoicesByClientId.set(invoice.client_id, current)
  }

  const plan: ClientFiscalBackfillPlan = {
    updates: [],
    conflicts: [],
    skipped: [],
  }

  for (const client of clients) {
    const fiscalData = getClientFiscalData(client)
    const currentFullName = client.full_name.trim() || null
    const currentComparableName = normalizeComparableName(currentFullName)

    if (fiscalData.isComplete) {
      plan.skipped.push({
        clientId: client.id,
        clientLabel: client.full_name,
        reason: 'already_complete',
        sourceInvoiceIds: [],
      })
      continue
    }

    const clientInvoices = invoicesByClientId.get(client.id) ?? []
    if (clientInvoices.length === 0) {
      plan.skipped.push({
        clientId: client.id,
        clientLabel: client.full_name,
        reason: 'no_issued_invoices',
        sourceInvoiceIds: [],
      })
      continue
    }

    const candidates = clientInvoices
      .map(extractFiscalDataFromInvoice)
      .filter((candidate): candidate is BackfillInvoiceCandidate => candidate !== null)

    if (candidates.length === 0) {
      plan.skipped.push({
        clientId: client.id,
        clientLabel: client.full_name,
        reason: 'no_structured_fiscal_data',
        sourceInvoiceIds: clientInvoices.map((invoice) => invoice.id),
      })
      continue
    }

    const taxCandidates = !fiscalData.taxId ? uniqueNonEmpty(candidates.map((candidate) => candidate.tax_id)) : []
    const addressCandidates = !fiscalData.billingAddress ? uniqueNonEmpty(candidates.map((candidate) => candidate.billing_address)) : []
    const nameCandidates = !currentComparableName
      ? uniqueNonEmpty(candidates.map((candidate) => candidate.fiscal_name))
      : uniqueNonEmpty(
          candidates
            .map((candidate) => candidate.fiscal_name)
            .filter((value) => normalizeComparableName(value) === currentComparableName),
        )

    if (taxCandidates.length > 1) {
      plan.conflicts.push({
        clientId: client.id,
        clientLabel: client.full_name,
        field: 'tax_id',
        candidateValues: taxCandidates,
        sourceInvoiceIds: candidates.filter((candidate) => candidate.tax_id).map((candidate) => candidate.invoiceId),
      })
    }

    if (addressCandidates.length > 1) {
      plan.conflicts.push({
        clientId: client.id,
        clientLabel: client.full_name,
        field: 'billing_address',
        candidateValues: addressCandidates,
        sourceInvoiceIds: candidates.filter((candidate) => candidate.billing_address).map((candidate) => candidate.invoiceId),
      })
    }

    if (taxCandidates.length > 1 || addressCandidates.length > 1) {
      continue
    }

    const nextFullName = currentFullName ?? nameCandidates[0] ?? null
    const nextTaxId = fiscalData.taxId ?? taxCandidates[0] ?? null
    const nextBillingAddress = fiscalData.billingAddress ?? addressCandidates[0] ?? null
    const appliedFields: ClientFiscalBackfillAppliedField[] = []

    if (!currentFullName && nextFullName) {
      appliedFields.push('full_name')
    }
    if (!fiscalData.taxId && nextTaxId) {
      appliedFields.push('tax_id')
    }
    if (!fiscalData.billingAddress && nextBillingAddress) {
      appliedFields.push('billing_address')
    }

    if (appliedFields.length === 0) {
      plan.skipped.push({
        clientId: client.id,
        clientLabel: client.full_name,
        reason: 'no_structured_fiscal_data',
        sourceInvoiceIds: candidates.map((candidate) => candidate.invoiceId),
      })
      continue
    }

    plan.updates.push({
      clientId: client.id,
      clientLabel: client.full_name,
      missingFields: fiscalData.missingFields,
      nextFullName,
      nextTaxId,
      nextBillingAddress,
      nextStatus: 'active',
      appliedFields: [...appliedFields, 'status'],
      sourceInvoiceIds: candidates.map((candidate) => candidate.invoiceId),
    })
  }

  return plan
}

export function summarizeClientFiscalBackfill(plan: ClientFiscalBackfillPlan) {
  return {
    updatableClients: plan.updates.length,
    conflictedClients: plan.conflicts.length,
    skippedClients: plan.skipped.length,
  }
}

export async function applyClientFiscalBackfill(plan: ClientFiscalBackfillPlan): Promise<ClientFiscalBackfillResult> {
  const updatedClients: Array<{ clientId: string; clientLabel: string; appliedFields: ClientFiscalBackfillAppliedField[] }> = []

  for (const update of plan.updates) {
    const payload: {
      full_name?: string
      tax_id?: string | null
      billing_address?: string | null
      status: 'active'
    } = {
      status: update.nextStatus,
    }

    if (update.appliedFields.includes('full_name') && update.nextFullName) {
      payload.full_name = update.nextFullName
    }
    if (update.appliedFields.includes('tax_id')) {
      payload.tax_id = update.nextTaxId
    }
    if (update.appliedFields.includes('billing_address')) {
      payload.billing_address = update.nextBillingAddress
    }

    if (Object.keys(payload).length === 1) {
      continue
    }

    await applyClientFiscalBackfillRecord(update.clientId, payload)
    updatedClients.push({
      clientId: update.clientId,
      clientLabel: update.clientLabel,
      appliedFields: update.appliedFields,
    })
  }

  return {
    reviewedInvoices: plan.updates.reduce((total, update) => total + update.sourceInvoiceIds.length, 0)
      + plan.skipped.reduce((total, skip) => total + skip.sourceInvoiceIds.length, 0),
    invoicesWithoutStructuredFiscalData: plan.skipped
      .filter((skip) => skip.reason === 'no_structured_fiscal_data')
      .flatMap((skip) => skip.sourceInvoiceIds),
    updatedClients,
    skippedClients: plan.skipped,
    conflicts: plan.conflicts,
  }
}
