import type { ClientListItem } from '../clients/types'
import type { InvoiceListItem } from '../invoices/types'
import type { PaymentListItem } from '../payments/types'

export const FISCAL_SEMESTER_EMITTED_STATUSES = ['issued', 'paid'] as const

export type FiscalSemesterEmittedStatus = (typeof FISCAL_SEMESTER_EMITTED_STATUSES)[number]
export type FiscalSemesterReviewSeverity = 'critical' | 'warning' | 'info'

export interface FiscalSemesterPeriod {
  mode: 'custom'
  year: number
  startDate: string
  endDate: string
  label: string
  folderLabel: string
}

export interface FiscalSemesterIncludedInvoice {
  id: string
  invoiceNumber: string | null
  displayCode: string | null
  reference: string
  clientLabel: string
  issueDate: string
  baseAmount: number
  vatAmount: number
  totalAmount: number
  status: string
  paidAmount: number
  pendingAmount: number
}

export interface FiscalSemesterExcludedInvoice {
  id: string
  invoiceNumber: string | null
  displayCode: string | null
  reference: string
  issueDate: string | null
  status: string
  reason: string
}

export interface FiscalSemesterReviewItem {
  id: string
  severity: FiscalSemesterReviewSeverity
  reference: string
  message: string
}

export interface FiscalSemesterAuditSummary {
  year: number
  semester: 2
  period: FiscalSemesterPeriod
  emittedStatuses: readonly FiscalSemesterEmittedStatus[]
  includedInvoices: FiscalSemesterIncludedInvoice[]
  excludedInvoices: FiscalSemesterExcludedInvoice[]
  reviewItems: FiscalSemesterReviewItem[]
  totals: {
    invoiceCount: number
    baseAmount: number
    vatAmount: number
    totalAmount: number
    paidAmount: number
    pendingAmount: number
  }
  statusBreakdown: Record<string, number>
}

interface BuildFiscalSemesterAuditInput {
  year: number
  invoices: InvoiceListItem[]
  payments?: PaymentListItem[]
  clients?: ClientListItem[]
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function buildReference(invoice: Pick<InvoiceListItem, 'invoice_number' | 'display_code' | 'id'>): string {
  return invoice.invoice_number ?? invoice.display_code ?? invoice.id
}

function buildClientLabel(
  invoice: Pick<InvoiceListItem, 'client_id' | 'client_name' | 'client_display_code' | 'client_label'>,
  clientById: Map<string, ClientListItem>,
): string {
  const relatedClient = clientById.get(invoice.client_id)
  return invoice.client_name
    ?? invoice.client_label
    ?? relatedClient?.full_name
    ?? invoice.client_display_code
    ?? relatedClient?.display_code
    ?? invoice.client_id
}

function isSecondSemesterDate(dateValue: string | null | undefined, year: number): boolean {
  if (!dateValue) return false
  const normalizedDate = dateValue.length > 10 ? dateValue.slice(0, 10) : dateValue
  return normalizedDate >= `${year}-07-01` && normalizedDate <= `${year}-12-31`
}

function getExcludedReason(invoice: InvoiceListItem): string {
  if (!invoice.issue_date) return 'Sin fecha fiscal valida'
  if (invoice.cancelled_at || invoice.status === 'cancelled') return 'Factura anulada'
  if (invoice.archived_at) return 'Factura archivada'
  if (invoice.deleted_at) return 'Factura eliminada'
  if (!FISCAL_SEMESTER_EMITTED_STATUSES.includes(invoice.status as FiscalSemesterEmittedStatus)) {
    return `Estado no emitido: ${invoice.status || 'sin estado'}`
  }
  return 'Excluida por revision'
}

export function buildSecondSemesterPeriod(year: number): FiscalSemesterPeriod {
  return {
    mode: 'custom',
    year,
    startDate: `${year}-07-01`,
    endDate: `${year}-12-31`,
    label: `Segundo semestre ${year}`,
    folderLabel: `${year}_S2`,
  }
}

export function buildSecondSemesterSelection(year: number) {
  return {
    mode: 'custom' as const,
    year,
    month: 7,
    quarter: 3,
    startDate: `${year}-07-01`,
    endDate: `${year}-12-31`,
  }
}

export function buildFiscalSemesterAuditSummary({
  year,
  invoices,
  payments = [],
  clients = [],
}: BuildFiscalSemesterAuditInput): FiscalSemesterAuditSummary {
  const period = buildSecondSemesterPeriod(year)
  const clientById = new Map(clients.map((client) => [client.id, client]))
  const paidAmountByInvoiceId = new Map<string, number>()

  for (const payment of payments) {
    paidAmountByInvoiceId.set(
      payment.invoice_id,
      roundMoney((paidAmountByInvoiceId.get(payment.invoice_id) ?? 0) + Number(payment.amount || 0)),
    )
  }

  const includedInvoices: FiscalSemesterIncludedInvoice[] = []
  const excludedInvoices: FiscalSemesterExcludedInvoice[] = []
  const reviewItems: FiscalSemesterReviewItem[] = []
  const invoiceNumberCounts = new Map<string, number>()
  const displayCodeCounts = new Map<string, number>()

  for (const invoice of invoices) {
    const reference = buildReference(invoice)
    if (!isSecondSemesterDate(invoice.issue_date, year)) {
      if (!invoice.issue_date && FISCAL_SEMESTER_EMITTED_STATUSES.includes(invoice.status as FiscalSemesterEmittedStatus)) {
        excludedInvoices.push({
          id: invoice.id,
          invoiceNumber: invoice.invoice_number ?? null,
          displayCode: invoice.display_code ?? null,
          reference,
          issueDate: invoice.issue_date ?? null,
          status: invoice.status,
          reason: 'Sin fecha fiscal valida',
        })
        reviewItems.push({
          id: `missing-date-${invoice.id}`,
          severity: 'critical',
          reference,
          message: 'Factura emitida sin fecha fiscal valida.',
        })
      }
      continue
    }

    const isIncluded =
      FISCAL_SEMESTER_EMITTED_STATUSES.includes(invoice.status as FiscalSemesterEmittedStatus)
      && !invoice.cancelled_at
      && !invoice.archived_at
      && !invoice.deleted_at

    if (!isIncluded) {
      excludedInvoices.push({
        id: invoice.id,
        invoiceNumber: invoice.invoice_number ?? null,
        displayCode: invoice.display_code ?? null,
        reference,
        issueDate: invoice.issue_date,
        status: invoice.status,
        reason: getExcludedReason(invoice),
      })
      continue
    }

    const baseAmount = roundMoney(Number(invoice.subtotal || 0))
    const vatAmount = roundMoney(Number(invoice.tax_amount || 0))
    const totalAmount = roundMoney(Number(invoice.total || 0))
    const paidAmount = roundMoney(invoice.paid_amount ?? paidAmountByInvoiceId.get(invoice.id) ?? 0)
    const pendingAmount = roundMoney(Math.max(totalAmount - paidAmount, 0))

    includedInvoices.push({
      id: invoice.id,
      invoiceNumber: invoice.invoice_number ?? null,
      displayCode: invoice.display_code ?? null,
      reference,
      clientLabel: buildClientLabel(invoice, clientById),
      issueDate: invoice.issue_date,
      baseAmount,
      vatAmount,
      totalAmount,
      status: invoice.status,
      paidAmount,
      pendingAmount,
    })

    if (invoice.invoice_number) {
      invoiceNumberCounts.set(invoice.invoice_number, (invoiceNumberCounts.get(invoice.invoice_number) ?? 0) + 1)
    } else {
      reviewItems.push({
        id: `missing-number-${invoice.id}`,
        severity: 'warning',
        reference,
        message: 'Factura emitida sin invoice_number.',
      })
    }

    if (invoice.display_code) {
      displayCodeCounts.set(invoice.display_code, (displayCodeCounts.get(invoice.display_code) ?? 0) + 1)
    } else {
      reviewItems.push({
        id: `missing-display-code-${invoice.id}`,
        severity: 'warning',
        reference,
        message: 'Factura emitida sin display_code.',
      })
    }

    if (Math.abs(roundMoney(baseAmount + vatAmount) - totalAmount) > 0.01) {
      reviewItems.push({
        id: `header-total-mismatch-${invoice.id}`,
        severity: 'critical',
        reference,
        message: 'Subtotal + IVA no coincide con el total de cabecera.',
      })
    }

    if (invoice.lines && invoice.lines.length > 0) {
      const linesSubtotal = roundMoney(
        invoice.lines.reduce((sum, line) => sum + Number(line.line_subtotal || 0), 0),
      )
      if (Math.abs(linesSubtotal - baseAmount) > 0.01) {
        reviewItems.push({
          id: `line-total-mismatch-${invoice.id}`,
          severity: 'critical',
          reference,
          message: 'La suma de lineas no coincide con la base de cabecera.',
        })
      }
    }
  }

  for (const [invoiceNumber, count] of invoiceNumberCounts.entries()) {
    if (count > 1) {
      reviewItems.push({
        id: `duplicate-invoice-number-${invoiceNumber}`,
        severity: 'critical',
        reference: invoiceNumber,
        message: 'Invoice_number duplicado dentro del semestre auditado.',
      })
    }
  }

  for (const [displayCode, count] of displayCodeCounts.entries()) {
    if (count > 1) {
      reviewItems.push({
        id: `duplicate-display-code-${displayCode}`,
        severity: 'critical',
        reference: displayCode,
        message: 'Display_code duplicado dentro del semestre auditado.',
      })
    }
  }

  includedInvoices.sort((left, right) => left.issueDate.localeCompare(right.issueDate) || left.reference.localeCompare(right.reference))
  excludedInvoices.sort((left, right) => (left.issueDate ?? '').localeCompare(right.issueDate ?? '') || left.reference.localeCompare(right.reference))

  const statusBreakdown = includedInvoices.reduce<Record<string, number>>((accumulator, invoice) => {
    accumulator[invoice.status] = (accumulator[invoice.status] ?? 0) + 1
    return accumulator
  }, {})

  const totals = includedInvoices.reduce((accumulator, invoice) => ({
    invoiceCount: accumulator.invoiceCount + 1,
    baseAmount: roundMoney(accumulator.baseAmount + invoice.baseAmount),
    vatAmount: roundMoney(accumulator.vatAmount + invoice.vatAmount),
    totalAmount: roundMoney(accumulator.totalAmount + invoice.totalAmount),
    paidAmount: roundMoney(accumulator.paidAmount + invoice.paidAmount),
    pendingAmount: roundMoney(accumulator.pendingAmount + invoice.pendingAmount),
  }), {
    invoiceCount: 0,
    baseAmount: 0,
    vatAmount: 0,
    totalAmount: 0,
    paidAmount: 0,
    pendingAmount: 0,
  })

  return {
    year,
    semester: 2,
    period,
    emittedStatuses: FISCAL_SEMESTER_EMITTED_STATUSES,
    includedInvoices,
    excludedInvoices,
    reviewItems,
    totals,
    statusBreakdown,
  }
}
