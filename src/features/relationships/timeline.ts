import { formatCurrency } from '../../app/displayFormat'
import type { ClientListItem } from '../clients/types'
import { buildInvoicePaymentSummary } from '../invoices/paymentState'
import type { InvoiceListItem } from '../invoices/types'
import type { JobListItem } from '../jobs/types'
import type { PaymentListItem } from '../payments/types'
import type { PropertyListItem } from '../properties/types'
import type { QuoteListItem } from '../quotes/types'
import type { RecurringInvoicePlanListItem } from '../recurringInvoices/types'

export interface RelationshipTimelineItem {
  id: string
  date: string
  title: string
  detail: string
  tone: 'info' | 'success' | 'warning'
  entityType: 'client' | 'property' | 'quote' | 'job' | 'invoice' | 'payment' | 'recurring'
  entityId: string
}

function compareByDateDesc(left: string, right: string) {
  return right.localeCompare(left)
}

function hasTimelineDate(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function describeQuoteStatus(status: string) {
  if (status === 'accepted') return 'Presupuesto aceptado'
  if (status === 'rejected') return 'Presupuesto rechazado'
  if (status === 'sent') return 'Presupuesto enviado'
  return 'Presupuesto creado'
}

function describeJobStatus(status: string) {
  if (status === 'completed') return 'Servicio completado'
  if (status === 'cancelled') return 'Servicio cancelado'
  if (status === 'in_progress') return 'Servicio en curso'
  return 'Servicio programado'
}

function describeInvoiceStatus(invoice: InvoiceListItem, payments: PaymentListItem[]) {
  const paymentSummary = buildInvoicePaymentSummary(invoice, payments)

  if (paymentSummary.financialStatus === 'paid') return 'Factura cobrada'
  if (paymentSummary.financialStatus === 'partially_paid') return 'Factura parcialmente cobrada'
  if (invoice.status === 'issued') return 'Factura emitida'
  return 'Factura registrada'
}

function describeRecurringStatus(status: string) {
  if (status === 'paused') return 'Automatizacion pausada'
  if (status === 'archived') return 'Automatizacion archivada'
  return 'Automatizacion activa'
}

function buildRecurringTimelineDate(plan: RecurringInvoicePlanListItem): string | null {
  if (hasTimelineDate(plan.last_issued_at)) return plan.last_issued_at
  if (hasTimelineDate(plan.created_at)) return plan.created_at
  if (hasTimelineDate(plan.next_issue_date)) return plan.next_issue_date
  return null
}

export function buildClientTimelineItems({
  client,
  properties,
  quotes,
  jobs,
  invoices,
  payments,
  recurringInvoicePlans,
}: {
  client: ClientListItem
  properties: PropertyListItem[]
  quotes: QuoteListItem[]
  jobs: JobListItem[]
  invoices: InvoiceListItem[]
  payments: PaymentListItem[]
  recurringInvoicePlans: RecurringInvoicePlanListItem[]
}): RelationshipTimelineItem[] {
  const items: RelationshipTimelineItem[] = []

  if (hasTimelineDate(client.created_at)) {
    items.push({
      id: `client-created-${client.id}`,
      date: client.created_at,
      title: 'Cliente creado',
      detail: client.full_name,
      tone: 'info',
      entityType: 'client',
      entityId: client.id,
    })
  }

  for (const property of properties) {
    const createdAt = (property as PropertyListItem & { created_at?: string }).created_at
    if (!hasTimelineDate(createdAt)) continue

    items.push({
      id: `property-${property.id}`,
      date: createdAt,
      title: 'Propiedad creada',
      detail: `${property.display_code ?? property.id} · ${property.name}`,
      tone: 'info',
      entityType: 'property',
      entityId: property.id,
    })
  }

  for (const quote of quotes) {
    if (!hasTimelineDate(quote.created_at)) continue

    items.push({
      id: `quote-${quote.id}`,
      date: quote.created_at,
      title: describeQuoteStatus(quote.status),
      detail: `${quote.display_code ?? quote.id} · ${formatCurrency(quote.total)}`,
      tone: quote.status === 'accepted' ? 'success' : quote.status === 'rejected' ? 'warning' : 'info',
      entityType: 'quote',
      entityId: quote.id,
    })
  }

  for (const job of jobs) {
    if (!hasTimelineDate(job.scheduled_date)) continue

    items.push({
      id: `job-${job.id}`,
      date: job.scheduled_date,
      title: describeJobStatus(job.status),
      detail: `${job.display_code ?? job.id} · ${job.billing_concept ?? job.service_type}`,
      tone: job.status === 'completed' ? 'success' : job.status === 'cancelled' ? 'warning' : 'info',
      entityType: 'job',
      entityId: job.id,
    })
  }

  for (const invoice of invoices) {
    if (!hasTimelineDate(invoice.issue_date)) continue
    const invoicePayments = payments.filter((payment) => payment.invoice_id === invoice.id)
    const paymentSummary = buildInvoicePaymentSummary(invoice, invoicePayments)

    items.push({
      id: `invoice-${invoice.id}`,
      date: invoice.issue_date,
      title: describeInvoiceStatus(invoice, invoicePayments),
      detail: `${invoice.display_code ?? invoice.id} · ${formatCurrency(invoice.total)}`,
      tone: paymentSummary.financialStatus === 'paid' ? 'success' : 'warning',
      entityType: 'invoice',
      entityId: invoice.id,
    })
  }

  for (const payment of payments) {
    if (!hasTimelineDate(payment.payment_date)) continue

    items.push({
      id: `payment-${payment.id}`,
      date: payment.payment_date,
      title: 'Cobro registrado',
      detail: `${payment.display_code ?? payment.id} · ${formatCurrency(payment.amount)}`,
      tone: 'success',
      entityType: 'payment',
      entityId: payment.id,
    })
  }

  for (const plan of recurringInvoicePlans) {
    const timelineDate = buildRecurringTimelineDate(plan)
    if (!timelineDate) continue

    items.push({
      id: `recurring-${plan.id}`,
      date: timelineDate,
      title: describeRecurringStatus(plan.status),
      detail: `${plan.title} · siguiente ${plan.next_issue_date}`,
      tone: plan.status === 'active' ? 'info' : plan.status === 'paused' ? 'warning' : 'success',
      entityType: 'recurring',
      entityId: plan.id,
    })
  }

  return items.sort((left, right) => compareByDateDesc(left.date, right.date))
}

export function buildPropertyTimelineItems({
  quotes,
  jobs,
  invoices,
  payments,
}: {
  property: PropertyListItem
  quotes: QuoteListItem[]
  jobs: JobListItem[]
  invoices: InvoiceListItem[]
  payments: PaymentListItem[]
}): RelationshipTimelineItem[] {
  const items: RelationshipTimelineItem[] = []

  for (const quote of quotes) {
    if (!hasTimelineDate(quote.created_at)) continue

    items.push({
      id: `quote-${quote.id}`,
      date: quote.created_at,
      title: describeQuoteStatus(quote.status),
      detail: `${quote.display_code ?? quote.id} · ${formatCurrency(quote.total)}`,
      tone: quote.status === 'accepted' ? 'success' : quote.status === 'rejected' ? 'warning' : 'info',
      entityType: 'quote',
      entityId: quote.id,
    })
  }

  for (const job of jobs) {
    if (!hasTimelineDate(job.scheduled_date)) continue

    items.push({
      id: `job-${job.id}`,
      date: job.scheduled_date,
      title: describeJobStatus(job.status),
      detail: `${job.display_code ?? job.id} · ${job.billing_concept ?? job.service_type}`,
      tone: job.status === 'completed' ? 'success' : job.status === 'cancelled' ? 'warning' : 'info',
      entityType: 'job',
      entityId: job.id,
    })
  }

  for (const invoice of invoices) {
    if (!hasTimelineDate(invoice.issue_date)) continue
    const invoicePayments = payments.filter((payment) => payment.invoice_id === invoice.id)
    const paymentSummary = buildInvoicePaymentSummary(invoice, invoicePayments)

    items.push({
      id: `invoice-${invoice.id}`,
      date: invoice.issue_date,
      title: describeInvoiceStatus(invoice, invoicePayments),
      detail: `${invoice.display_code ?? invoice.id} · ${formatCurrency(invoice.total)}`,
      tone: paymentSummary.financialStatus === 'paid' ? 'success' : 'warning',
      entityType: 'invoice',
      entityId: invoice.id,
    })
  }

  for (const payment of payments) {
    if (!hasTimelineDate(payment.payment_date)) continue

    items.push({
      id: `payment-${payment.id}`,
      date: payment.payment_date,
      title: 'Cobro registrado',
      detail: `${payment.display_code ?? payment.id} · ${formatCurrency(payment.amount)}`,
      tone: 'success',
      entityType: 'payment',
      entityId: payment.id,
    })
  }

  return items.sort((left, right) => compareByDateDesc(left.date, right.date))
}

export function buildJobTimelineItems({
  job,
  quote,
  invoice,
  payments,
}: {
  job: JobListItem
  quote: QuoteListItem | null
  invoice: InvoiceListItem | null
  payments: PaymentListItem[]
}): RelationshipTimelineItem[] {
  const items: RelationshipTimelineItem[] = []

  if (hasTimelineDate(job.scheduled_date)) {
    items.push({
      id: `job-${job.id}`,
      date: job.scheduled_date,
      title: describeJobStatus(job.status),
      detail: `${job.display_code ?? job.id} · ${job.billing_concept ?? job.service_type}`,
      tone: job.status === 'completed' ? 'success' : job.status === 'cancelled' ? 'warning' : 'info',
      entityType: 'job',
      entityId: job.id,
    })
  }

  if (quote && hasTimelineDate(quote.created_at)) {
    items.push({
      id: `job-quote-${quote.id}`,
      date: quote.created_at,
      title: describeQuoteStatus(quote.status),
      detail: `${quote.display_code ?? quote.id} · ${formatCurrency(quote.total)}`,
      tone: quote.status === 'accepted' ? 'success' : quote.status === 'rejected' ? 'warning' : 'info',
      entityType: 'quote',
      entityId: quote.id,
    })
  }

  if (invoice && hasTimelineDate(invoice.issue_date)) {
    const paymentSummary = buildInvoicePaymentSummary(invoice, payments)

    items.push({
      id: `job-invoice-${invoice.id}`,
      date: invoice.issue_date,
      title: describeInvoiceStatus(invoice, payments),
      detail: `${invoice.display_code ?? invoice.id} · ${formatCurrency(invoice.total)}`,
      tone: paymentSummary.financialStatus === 'paid' ? 'success' : 'warning',
      entityType: 'invoice',
      entityId: invoice.id,
    })
  }

  for (const payment of payments) {
    if (!hasTimelineDate(payment.payment_date)) continue

    items.push({
      id: `job-payment-${payment.id}`,
      date: payment.payment_date,
      title: 'Cobro registrado',
      detail: `${payment.display_code ?? payment.id} · ${formatCurrency(payment.amount)}`,
      tone: 'success',
      entityType: 'payment',
      entityId: payment.id,
    })
  }

  return items.sort((left, right) => compareByDateDesc(left.date, right.date))
}
