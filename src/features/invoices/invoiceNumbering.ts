import type { InvoiceListItem } from './types'

export interface InvoiceNumberingGap {
  from: number
  to: number
}

export interface InvoiceNumberingIssueEntry {
  id: string
  display_code: string | null
  invoice_number: string | null
  status: string
  issue_date: string
  created_at?: string | null
  deleted_at?: string | null
  archived_at?: string | null
  cancelled_at?: string | null
}

export interface InvoiceNumberingAudit {
  year: number
  lastIssuedSequence: number | null
  lastIssuedInvoice: InvoiceNumberingIssueEntry | null
  firstMissingSequence: number | null
  hasBlockingGaps: boolean
  nextSuggestedSequence: number
  nextSuggestedInvoiceNumber: string
  nextSuggestedDisplayCode: string
  gaps: InvoiceNumberingGap[]
  duplicateInvoiceNumbers: string[]
  duplicateDisplayCodes: string[]
  draftsWithReservedNumbers: InvoiceNumberingIssueEntry[]
  cancelledWithNumberCount: number
  archivedWithNumberCount: number
  deletedWithNumberCount: number
  outOfSyncEntries: InvoiceNumberingIssueEntry[]
}

function toIssueEntry(invoice: InvoiceListItem): InvoiceNumberingIssueEntry {
  return {
    id: invoice.id,
    display_code: invoice.display_code,
    invoice_number: invoice.invoice_number,
    status: invoice.status,
    issue_date: invoice.issue_date,
    created_at: invoice.created_at ?? null,
    deleted_at: invoice.deleted_at ?? null,
    archived_at: invoice.archived_at ?? null,
    cancelled_at: invoice.cancelled_at ?? null,
  }
}

export function parseInvoiceFiscalSequence(invoiceNumber: string | null | undefined, year?: number | null): number | null {
  if (!invoiceNumber) return null
  const match = invoiceNumber.trim().match(/^(\d{4})-(\d+)$/)
  if (!match) return null
  if (year && Number(match[1]) !== year) return null
  const value = Number(match[2])
  return Number.isInteger(value) && value > 0 ? value : null
}

export function parseInvoiceDisplaySequence(displayCode: string | null | undefined): number | null {
  if (!displayCode) return null
  const match = displayCode.trim().match(/^INV-(\d+)$/i)
  if (!match) return null
  const value = Number(match[1])
  return Number.isInteger(value) && value > 0 ? value : null
}

export function buildInvoiceNumber(year: number, sequence: number): string {
  return `${year}-${String(sequence).padStart(3, '0')}`
}

export function buildInvoiceDisplayCode(sequence: number): string {
  return `INV-${String(sequence).padStart(4, '0')}`
}

export function getInvoiceIssueYear(issueDate: string | null | undefined): number | null {
  if (!issueDate) return null
  const match = issueDate.match(/^(\d{4})-/)
  if (!match) return null
  const year = Number(match[1])
  return Number.isInteger(year) ? year : null
}

export function buildInvoiceNumberingAudit(invoices: InvoiceListItem[], year: number): InvoiceNumberingAudit {
  const fiscalInvoices = invoices
    .filter((invoice) => parseInvoiceFiscalSequence(invoice.invoice_number, year) !== null)
    .map((invoice) => ({
      invoice,
      fiscalSequence: parseInvoiceFiscalSequence(invoice.invoice_number, year) as number,
      displaySequence: parseInvoiceDisplaySequence(invoice.display_code),
    }))
    .sort((left, right) => left.fiscalSequence - right.fiscalSequence)

  const seenInvoiceNumbers = new Map<string, number>()
  const seenDisplayCodes = new Map<string, number>()
  const duplicateInvoiceNumbers = new Set<string>()
  const duplicateDisplayCodes = new Set<string>()

  for (const invoice of invoices) {
    if (invoice.invoice_number) {
      seenInvoiceNumbers.set(invoice.invoice_number, (seenInvoiceNumbers.get(invoice.invoice_number) ?? 0) + 1)
      if ((seenInvoiceNumbers.get(invoice.invoice_number) ?? 0) > 1) {
        duplicateInvoiceNumbers.add(invoice.invoice_number)
      }
    }

    if (invoice.display_code) {
      seenDisplayCodes.set(invoice.display_code, (seenDisplayCodes.get(invoice.display_code) ?? 0) + 1)
      if ((seenDisplayCodes.get(invoice.display_code) ?? 0) > 1) {
        duplicateDisplayCodes.add(invoice.display_code)
      }
    }
  }

  const sequences = fiscalInvoices.map((entry) => entry.fiscalSequence)
  const gaps: InvoiceNumberingGap[] = []

  if (sequences.length > 1) {
    let gapStart: number | null = null

    for (let index = 1; index < sequences.length; index += 1) {
      const previous = sequences[index - 1]
      const current = sequences[index]

      if (current - previous > 1) {
        gapStart = previous + 1
        gaps.push({
          from: gapStart,
          to: current - 1,
        })
      }
    }
  }

  const lastIssued = fiscalInvoices.at(-1) ?? null
  const firstMissingSequence = gaps[0]?.from ?? null
  const hasBlockingGaps = gaps.length > 0
  const nextSuggestedSequence = firstMissingSequence ?? ((lastIssued?.fiscalSequence ?? 0) + 1)
  const draftsWithReservedNumbers = invoices
    .filter((invoice) => invoice.status === 'draft' && (invoice.invoice_number || invoice.display_code))
    .map(toIssueEntry)

  const outOfSyncEntries = fiscalInvoices
    .filter((entry) => entry.displaySequence !== null && entry.displaySequence !== entry.fiscalSequence)
    .map((entry) => toIssueEntry(entry.invoice))

  return {
    year,
    lastIssuedSequence: lastIssued?.fiscalSequence ?? null,
    lastIssuedInvoice: lastIssued ? toIssueEntry(lastIssued.invoice) : null,
    firstMissingSequence,
    hasBlockingGaps,
    nextSuggestedSequence,
    nextSuggestedInvoiceNumber: buildInvoiceNumber(year, nextSuggestedSequence),
    nextSuggestedDisplayCode: buildInvoiceDisplayCode(nextSuggestedSequence),
    gaps,
    duplicateInvoiceNumbers: [...duplicateInvoiceNumbers].sort(),
    duplicateDisplayCodes: [...duplicateDisplayCodes].sort(),
    draftsWithReservedNumbers,
    cancelledWithNumberCount: invoices.filter((invoice) => invoice.status === 'cancelled' && Boolean(invoice.invoice_number)).length,
    archivedWithNumberCount: invoices.filter((invoice) => Boolean(invoice.archived_at) && Boolean(invoice.invoice_number)).length,
    deletedWithNumberCount: invoices.filter((invoice) => Boolean(invoice.deleted_at) && Boolean(invoice.invoice_number)).length,
    outOfSyncEntries,
  }
}

export function describeInvoiceNumberingGap(audit: InvoiceNumberingAudit): string | null {
  const firstGap = audit.gaps[0]
  if (!firstGap) return null
  const previousSequence = firstGap.from - 1
  const nextRealSequence = firstGap.to + 1
  return `Hay huecos en la numeracion fiscal entre ${buildInvoiceNumber(audit.year, previousSequence)} y ${buildInvoiceNumber(audit.year, nextRealSequence)}.`
}
