import type { InvoiceListItem } from '../invoices/types'
import type { PaymentListItem } from '../payments/types'
import type { JobBillingLineItem } from './types'
import type { JobTeamAssignment, JobTimeEntry } from './teamOperational'

export type ProfitabilityCompleteness = 'COMPLETE' | 'PARTIAL_NO_INVOICE' | 'PARTIAL_NO_TIME' | 'PLANNED_ONLY' | 'EMPTY'

export interface JobProfitability {
  job_id: string
  client_name?: string | null
  property_name?: string | null
  planned_revenue_base: number
  planned_minutes: number
  planned_labor_cost: number
  planned_direct_contribution: number
  actual_invoiced_base: number
  draft_invoice_base: number
  invoice_total_with_vat: number
  collected_amount: number
  outstanding_amount: number
  actual_minutes: number
  actual_labor_cost: number
  actual_direct_contribution: number
  direct_margin_percent: number | null
  revenue_variance: number
  labor_variance: number
  margin_variance: number
  assigned_worker_count: number
  time_entry_count: number
  invoice_count: number
  completeness_status: ProfitabilityCompleteness
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function plannedRevenueBase(lines: JobBillingLineItem[], quantity = 0, unitPrice = 0) {
  if (lines.length > 0) return roundMoney(lines.reduce((sum, line) => sum + Number(line.line_subtotal || 0), 0))
  return roundMoney(Number(quantity || 0) * Number(unitPrice || 0))
}

export function isRealizedInvoice(invoice: Pick<InvoiceListItem, 'status' | 'deleted_at' | 'archived_at' | 'cancelled_at'>) {
  return (invoice.status === 'issued' || invoice.status === 'paid') && !invoice.deleted_at && !invoice.archived_at && !invoice.cancelled_at
}

export function buildJobProfitability({ jobId, lines, billingQuantity, billingUnitPrice, invoices, payments, assignments, entries, clientName, propertyName }: { jobId: string; lines: JobBillingLineItem[]; billingQuantity?: number | null; billingUnitPrice?: number | null; invoices: InvoiceListItem[]; payments: PaymentListItem[]; assignments: JobTeamAssignment[]; entries: JobTimeEntry[]; clientName?: string | null; propertyName?: string | null }): JobProfitability {
  const plannedRevenue = plannedRevenueBase(lines, billingQuantity ?? 0, billingUnitPrice ?? 0)
  const plannedMinutes = assignments.filter((item) => item.status !== 'cancelled').reduce((sum, item) => sum + (item.planned_minutes ?? 0), 0)
  const plannedLabor = roundMoney(assignments.filter((item) => item.status !== 'cancelled').reduce((sum, item) => sum + ((item.planned_minutes ?? 0) / 60 * Number(item.hourly_cost_snapshot ?? 0)), 0))
  const realizedInvoices = invoices.filter(isRealizedInvoice)
  const draftInvoices = invoices.filter((invoice) => invoice.status === 'draft' && !invoice.deleted_at && !invoice.archived_at && !invoice.cancelled_at)
  const actualRevenue = roundMoney(realizedInvoices.reduce((sum, invoice) => sum + Number(invoice.subtotal || 0), 0))
  const draftRevenue = roundMoney(draftInvoices.reduce((sum, invoice) => sum + Number(invoice.subtotal || 0), 0))
  const invoiceTotal = roundMoney(realizedInvoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0))
  const collected = roundMoney(payments.filter((payment) => {
    const record = payment as PaymentListItem & { archived_at?: string | null; deleted_at?: string | null; cancelled_at?: string | null }
    return !record.archived_at && !record.deleted_at && !record.cancelled_at
  }).reduce((sum, payment) => sum + Number(payment.amount || 0), 0))
  const actualMinutes = entries.reduce((sum, entry) => sum + entry.minutes, 0)
  const actualLabor = roundMoney(entries.reduce((sum, entry) => sum + (entry.minutes / 60 * Number(entry.hourly_cost_snapshot ?? 0)), 0))
  const plannedContribution = roundMoney(plannedRevenue - plannedLabor)
  const actualContribution = roundMoney(actualRevenue - actualLabor)
  const completenessStatus: ProfitabilityCompleteness = actualRevenue > 0 && actualMinutes > 0
    ? 'COMPLETE'
    : actualMinutes > 0
      ? 'PARTIAL_NO_INVOICE'
      : actualRevenue > 0
        ? 'PARTIAL_NO_TIME'
        : plannedRevenue > 0 || plannedMinutes > 0 ? 'PLANNED_ONLY' : 'EMPTY'
  return {
    job_id: jobId, client_name: clientName, property_name: propertyName,
    planned_revenue_base: plannedRevenue, planned_minutes: plannedMinutes, planned_labor_cost: plannedLabor, planned_direct_contribution: plannedContribution,
    actual_invoiced_base: actualRevenue, draft_invoice_base: draftRevenue, invoice_total_with_vat: invoiceTotal, collected_amount: collected, outstanding_amount: roundMoney(Math.max(invoiceTotal - collected, 0)),
    actual_minutes: actualMinutes, actual_labor_cost: actualLabor, actual_direct_contribution: actualContribution, direct_margin_percent: actualRevenue > 0 ? roundMoney(actualContribution / actualRevenue * 100) : null,
    revenue_variance: roundMoney(actualRevenue - plannedRevenue), labor_variance: roundMoney(actualLabor - plannedLabor), margin_variance: roundMoney(actualContribution - plannedContribution),
    assigned_worker_count: assignments.filter((item) => item.status !== 'cancelled').length, time_entry_count: entries.length, invoice_count: realizedInvoices.length, completeness_status: completenessStatus,
  }
}
