import type { InvoiceListItem } from '../invoices/types'
import { extractInvoiceFiscalSnapshot, getClientFiscalData, normalizeClientFiscalData, type ClientFiscalMissingField } from './clientFiscalData'
import { updateClientFiscalData } from './clientWriteApi'
import type { ClientListItem } from './types'

interface BackfillInvoiceCandidate {
  invoiceId: string
  tax_id: string | null
  billing_address: string | null
}

export interface ClientFiscalBackfillUpdate {
  clientId: string
  clientLabel: string
  missingFields: ClientFiscalMissingField[]
  nextTaxId: string | null
  nextBillingAddress: string | null
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
  updatedClients: Array<{ clientId: string; clientLabel: string }>
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

  if (!normalized.tax_id && !normalized.billing_address) {
    return null
  }

  return {
    invoiceId: invoice.id,
    tax_id: normalized.tax_id,
    billing_address: normalized.billing_address,
  }
}

function uniqueNonEmpty(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
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

    const nextTaxId = fiscalData.taxId ?? taxCandidates[0] ?? null
    const nextBillingAddress = fiscalData.billingAddress ?? addressCandidates[0] ?? null

    if ((fiscalData.taxId ?? nextTaxId) === null && (fiscalData.billingAddress ?? nextBillingAddress) === null) {
      plan.skipped.push({
        clientId: client.id,
        clientLabel: client.full_name,
        reason: 'no_structured_fiscal_data',
        sourceInvoiceIds: candidates.map((candidate) => candidate.invoiceId),
      })
      continue
    }

    if (nextTaxId === fiscalData.taxId && nextBillingAddress === fiscalData.billingAddress) {
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
      nextTaxId,
      nextBillingAddress,
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
  const updatedClients: Array<{ clientId: string; clientLabel: string }> = []

  for (const update of plan.updates) {
    if (!update.nextTaxId || !update.nextBillingAddress) {
      continue
    }

    await updateClientFiscalData(update.clientId, {
      tax_id: update.nextTaxId,
      billing_address: update.nextBillingAddress,
    })
    updatedClients.push({
      clientId: update.clientId,
      clientLabel: update.clientLabel,
    })
  }

  return {
    updatedClients,
    skippedClients: plan.skipped,
    conflicts: plan.conflicts,
  }
}
