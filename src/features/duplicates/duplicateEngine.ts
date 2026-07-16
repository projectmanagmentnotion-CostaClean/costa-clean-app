import type { ClientListItem } from '../clients/types'
import type { ExpenseListItem } from '../expenses/types'
import type { InvoiceListItem } from '../invoices/types'
import type { JobListItem } from '../jobs/types'
import type { LeadListItem } from '../leads/types'
import type { PaymentListItem } from '../payments/types'
import type { PropertyListItem } from '../properties/types'
import { comparePropertyCandidates } from '../properties/propertyDuplicateGuard'
import type { QuoteListItem } from '../quotes/types'
import type { RecurringInvoicePlanListItem } from '../recurringInvoices/types'
import {
  daysBetween,
  normalizeAddress,
  normalizeDateKey,
  normalizeEmail,
  normalizeLooseText,
  normalizeMoney,
  normalizePhone,
  normalizeTaxId,
  normalizeText,
} from './normalization'
import type {
  DuplicateEntityType,
  DuplicateGroup,
  DuplicateMatch,
  DuplicateReason,
  DuplicateRecordSummary,
  DuplicateSeverity,
} from './types'

type PairCompare<TRecord> = (left: TRecord, right: TRecord) => DuplicateReason[]
type SummaryBuilder<TRecord> = (record: TRecord) => DuplicateRecordSummary
type RecordIdGetter<TRecord> = (record: TRecord) => string

const severityWeight: Record<DuplicateSeverity, number> = {
  exact: 4,
  strong: 3,
  probable: 2,
  contextual: 1,
}

function getHighestSeverity(reasons: DuplicateReason[]): DuplicateSeverity {
  return reasons.reduce<DuplicateSeverity>((current, reason) => (
    severityWeight[reason.severity] > severityWeight[current] ? reason.severity : current
  ), 'contextual')
}

function dedupeReasons(reasons: DuplicateReason[]): DuplicateReason[] {
  const map = new Map<string, DuplicateReason>()
  for (const reason of reasons) {
    const existing = map.get(reason.code)
    if (!existing || severityWeight[reason.severity] > severityWeight[existing.severity]) {
      map.set(reason.code, reason)
    }
  }
  return [...map.values()].sort((left, right) => severityWeight[right.severity] - severityWeight[left.severity])
}

function createMatch<TRecord>(
  entityType: DuplicateEntityType,
  record: TRecord,
  recordId: string,
  reasons: DuplicateReason[],
  buildSummary: SummaryBuilder<TRecord>,
): DuplicateMatch<TRecord> {
  return {
    entityType,
    record,
    recordId,
    reasons: dedupeReasons(reasons),
    severity: getHighestSeverity(reasons),
    summary: buildSummary(record),
  }
}

function createGroups<TRecord>(
  entityType: DuplicateEntityType,
  records: TRecord[],
  getId: RecordIdGetter<TRecord>,
  compare: PairCompare<TRecord>,
  buildSummary: SummaryBuilder<TRecord>,
): Array<DuplicateGroup<TRecord>> {
  const parent = new Map<string, string>()
  const pairReasons = new Map<string, DuplicateReason[]>()
  const recordsById = new Map(records.map((record) => [getId(record), record]))

  function find(id: string): string {
    const current = parent.get(id) ?? id
    if (current === id) return id
    const root = find(current)
    parent.set(id, root)
    return root
  }

  function union(leftId: string, rightId: string) {
    const leftRoot = find(leftId)
    const rightRoot = find(rightId)
    if (leftRoot !== rightRoot) {
      parent.set(rightRoot, leftRoot)
    }
  }

  for (let index = 0; index < records.length; index += 1) {
    const left = records[index]
    const leftId = getId(left)
    if (!parent.has(leftId)) parent.set(leftId, leftId)

    for (let cursor = index + 1; cursor < records.length; cursor += 1) {
      const right = records[cursor]
      const rightId = getId(right)
      const reasons = dedupeReasons(compare(left, right)).filter((reason) => reason.severity !== 'contextual')

      if (reasons.length === 0) continue

      pairReasons.set([leftId, rightId].sort().join('::'), reasons)
      union(leftId, rightId)
    }
  }

  const groups = new Map<string, string[]>()
  for (const record of records) {
    const id = getId(record)
    if (!parent.has(id)) continue
    const root = find(id)
    const current = groups.get(root) ?? []
    current.push(id)
    groups.set(root, current)
  }

  return [...groups.values()]
    .filter((groupRecordIds) => groupRecordIds.length > 1)
    .map((groupRecordIds) => {
      const groupReasons = dedupeReasons(groupRecordIds.flatMap((leftId, leftIndex) => (
        groupRecordIds.slice(leftIndex + 1).flatMap((rightId) => pairReasons.get([leftId, rightId].sort().join('::')) ?? [])
      )))

      const groupSeverity = groupReasons.length > 0 ? getHighestSeverity(groupReasons) : 'probable'
      const matches: Array<DuplicateMatch<TRecord>> = []

      for (const recordId of groupRecordIds) {
        const record = recordsById.get(recordId)
        if (!record) continue
        matches.push(createMatch(entityType, record, recordId, groupReasons, buildSummary))
      }

      return {
        entityType,
        groupId: `${entityType}-${groupRecordIds.join('-')}`,
        severity: groupSeverity,
        reasons: groupReasons,
        records: matches,
      }
    })
    .sort((left, right) => severityWeight[right.severity] - severityWeight[left.severity] || right.records.length - left.records.length)
}

function toCandidateGroup<TRecord>(
  entityType: DuplicateEntityType,
  record: TRecord,
  getId: RecordIdGetter<TRecord>,
  buildSummary: SummaryBuilder<TRecord>,
  reasonsByRecord: Array<{ record: TRecord; reasons: DuplicateReason[] }>,
): Array<DuplicateGroup<TRecord>> {
  if (reasonsByRecord.length === 0) return []
  const reasons = dedupeReasons(reasonsByRecord.flatMap((item) => item.reasons))
  return [{
    entityType,
    groupId: `${entityType}-candidate-${getId(record)}`,
    severity: getHighestSeverity(reasons),
    reasons,
    records: [record, ...reasonsByRecord.map((item) => item.record)].map((entry) => {
      const id = getId(entry)
      const entryReasons = entry === record
        ? reasons
        : reasonsByRecord.find((item) => getId(item.record) === id)?.reasons ?? reasons
      return createMatch(entityType, entry, id, entryReasons, buildSummary)
    }),
  }]
}

function buildLeadSummary(lead: LeadListItem): DuplicateRecordSummary {
  return {
    title: lead.full_name,
    subtitle: lead.display_code ?? lead.id,
    meta: [lead.phone, lead.email ?? 'Sin email', lead.city ?? 'Sin ciudad'],
    facts: [
      { label: 'Telefono', value: lead.phone },
      { label: 'Email', value: lead.email ?? 'Sin email' },
      { label: 'Ciudad', value: lead.city ?? 'Sin ciudad' },
    ],
  }
}

function compareLeads(left: LeadListItem, right: LeadListItem): DuplicateReason[] {
  const reasons: DuplicateReason[] = []
  const leftPhone = normalizePhone(left.phone)
  const rightPhone = normalizePhone(right.phone)
  const leftEmail = normalizeEmail(left.email)
  const rightEmail = normalizeEmail(right.email)
  const leftName = normalizeLooseText(left.full_name)
  const rightName = normalizeLooseText(right.full_name)
  const leftCity = normalizeLooseText(left.city)
  const rightCity = normalizeLooseText(right.city)

  if (leftPhone && leftPhone === rightPhone) reasons.push({ code: 'lead-phone', label: 'Coincide el telefono', severity: 'strong' })
  if (leftEmail && leftEmail === rightEmail) reasons.push({ code: 'lead-email', label: 'Coincide el email', severity: 'strong' })
  if (leftName && leftName === rightName && leftCity && leftCity === rightCity) {
    reasons.push({ code: 'lead-name-city', label: 'Coinciden nombre y ciudad', severity: 'probable' })
  }

  return reasons
}

export function buildLeadDuplicateGroups(leads: LeadListItem[]) {
  return createGroups('lead', leads, (lead) => lead.id, compareLeads, buildLeadSummary)
}

export function findLeadDuplicateGroups(input: Pick<LeadListItem, 'id' | 'full_name' | 'phone' | 'email' | 'city'>, leads: LeadListItem[]) {
  const candidate = {
    ...input,
    display_code: null,
    status: 'new',
  } satisfies LeadListItem

  return toCandidateGroup('lead', candidate, (lead) => lead.id, buildLeadSummary, leads
    .filter((lead) => lead.id !== input.id)
    .map((lead) => ({ record: lead, reasons: compareLeads(candidate, lead) }))
    .filter((item) => item.reasons.length > 0))
}

function buildClientSummary(client: ClientListItem): DuplicateRecordSummary {
  return {
    title: client.full_name,
    subtitle: client.display_code ?? client.id,
    meta: [client.phone ?? 'Sin telefono', client.email ?? 'Sin email', client.tax_id ?? 'Sin NIF/CIF'],
    facts: [
      { label: 'Telefono', value: client.phone ?? 'Sin telefono' },
      { label: 'Email', value: client.email ?? 'Sin email' },
      { label: 'NIF/CIF', value: client.tax_id ?? 'Sin NIF/CIF' },
      { label: 'Direccion fiscal', value: client.billing_address ?? 'Sin direccion fiscal' },
    ],
  }
}

function compareClients(left: ClientListItem, right: ClientListItem): DuplicateReason[] {
  const reasons: DuplicateReason[] = []
  const leftTaxId = normalizeTaxId(left.tax_id)
  const rightTaxId = normalizeTaxId(right.tax_id)
  const leftPhone = normalizePhone(left.phone)
  const rightPhone = normalizePhone(right.phone)
  const leftEmail = normalizeEmail(left.email)
  const rightEmail = normalizeEmail(right.email)
  const leftName = normalizeLooseText(left.full_name)
  const rightName = normalizeLooseText(right.full_name)
  const leftAddress = normalizeAddress(left.billing_address)
  const rightAddress = normalizeAddress(right.billing_address)

  if (leftTaxId && leftTaxId === rightTaxId) reasons.push({ code: 'client-tax-id', label: 'Coincide el NIF/CIF', severity: 'exact' })
  if (leftPhone && leftPhone === rightPhone) reasons.push({ code: 'client-phone', label: 'Coincide el telefono', severity: 'strong' })
  if (leftEmail && leftEmail === rightEmail) reasons.push({ code: 'client-email', label: 'Coincide el email', severity: 'strong' })
  if (leftName && leftName === rightName && leftAddress && leftAddress === rightAddress) {
    reasons.push({ code: 'client-name-address', label: 'Coinciden nombre y direccion fiscal', severity: 'probable' })
  }

  return reasons
}

export function buildClientDuplicateGroups(clients: ClientListItem[]) {
  return createGroups('client', clients, (client) => client.id, compareClients, buildClientSummary)
}

export function findClientDuplicateGroups(input: Pick<ClientListItem, 'id' | 'full_name' | 'phone' | 'email' | 'tax_id' | 'billing_address' | 'status' | 'source_lead_id'>, clients: ClientListItem[]) {
  const candidate = {
    ...input,
    display_code: null,
  } satisfies ClientListItem

  return toCandidateGroup('client', candidate, (client) => client.id, buildClientSummary, clients
    .filter((client) => client.id !== input.id)
    .map((client) => ({ record: client, reasons: compareClients(candidate, client) }))
    .filter((item) => item.reasons.length > 0))
}

function buildPropertySummary(property: PropertyListItem): DuplicateRecordSummary {
  return {
    title: property.name,
    subtitle: property.display_code ?? property.id,
    meta: [property.client_name ?? property.client_display_code ?? property.client_id, property.address, property.city ?? 'Sin ciudad'],
    facts: [
      { label: 'Cliente', value: property.client_name ?? property.client_display_code ?? property.client_id },
      { label: 'Direccion', value: property.address },
      { label: 'Ciudad', value: property.city ?? 'Sin ciudad' },
      { label: 'Codigo postal', value: property.postal_code ?? 'Sin CP' },
    ],
  }
}

function compareProperties(left: PropertyListItem, right: PropertyListItem): DuplicateReason[] {
  return comparePropertyCandidates(left, right)
}

export function buildPropertyDuplicateGroups(properties: PropertyListItem[]) {
  return createGroups('property', properties, (property) => property.id, compareProperties, buildPropertySummary)
}

export function findPropertyDuplicateGroups(input: PropertyListItem, properties: PropertyListItem[]) {
  return toCandidateGroup('property', input, (property) => property.id, buildPropertySummary, properties
    .filter((property) => property.id !== input.id)
    .map((property) => ({ record: property, reasons: compareProperties(input, property) }))
    .filter((item) => item.reasons.length > 0))
}

function buildJobSummary(job: JobListItem): DuplicateRecordSummary {
  return {
    title: job.billing_concept?.trim() || job.service_type,
    subtitle: job.display_code ?? job.id,
    meta: [job.client_name ?? job.client_display_code ?? job.client_id, job.property_name ?? job.property_display_code ?? job.property_id, job.scheduled_date],
    facts: [
      { label: 'Cliente', value: job.client_name ?? job.client_display_code ?? job.client_id },
      { label: 'Propiedad', value: job.property_name ?? job.property_display_code ?? job.property_id },
      { label: 'Fecha', value: job.scheduled_date },
      { label: 'Tipo', value: job.service_type },
    ],
  }
}

function compareJobs(left: JobListItem, right: JobListItem): DuplicateReason[] {
  const reasons: DuplicateReason[] = []
  const sameDate = normalizeDateKey(left.scheduled_date) && normalizeDateKey(left.scheduled_date) === normalizeDateKey(right.scheduled_date)
  const sameType = normalizeText(left.service_type) && normalizeText(left.service_type) === normalizeText(right.service_type)
  const sameConcept = normalizeLooseText(left.billing_concept) && normalizeLooseText(left.billing_concept) === normalizeLooseText(right.billing_concept)

  if (left.client_id === right.client_id && left.property_id === right.property_id && sameDate && sameType) {
    reasons.push({ code: 'job-core-context', label: 'Coinciden cliente, propiedad, fecha y tipo', severity: 'strong' })
  }
  if (left.quote_id && left.quote_id === right.quote_id && sameDate) {
    reasons.push({ code: 'job-quote-date', label: 'Coinciden presupuesto origen y fecha', severity: 'probable' })
  }
  if (left.property_id === right.property_id && sameDate && sameConcept) {
    reasons.push({ code: 'job-property-concept', label: 'Coinciden propiedad, fecha y concepto', severity: 'probable' })
  }

  return reasons
}

export function buildJobDuplicateGroups(jobs: JobListItem[]) {
  return createGroups('job', jobs, (job) => job.id, compareJobs, buildJobSummary)
}

export function findJobDuplicateGroups(input: JobListItem, jobs: JobListItem[]) {
  return toCandidateGroup('job', input, (job) => job.id, buildJobSummary, jobs
    .filter((job) => job.id !== input.id)
    .map((job) => ({ record: job, reasons: compareJobs(input, job) }))
    .filter((item) => item.reasons.length > 0))
}

function buildQuoteSummary(quote: QuoteListItem): DuplicateRecordSummary {
  return {
    title: quote.display_code ?? quote.id,
    subtitle: quote.client_name ?? quote.lead_name ?? 'Sin cliente',
    meta: [quote.property_display_code ?? quote.property_id ?? 'Sin propiedad', normalizeMoney(quote.total), quote.created_at?.slice(0, 10) ?? 'Sin fecha'],
    facts: [
      { label: 'Cliente', value: quote.client_name ?? quote.lead_name ?? quote.client_display_code ?? quote.lead_display_code ?? 'Sin cliente' },
      { label: 'Propiedad', value: quote.property_display_code ?? quote.property_id ?? 'Sin propiedad' },
      { label: 'Total', value: normalizeMoney(quote.total) || 'Sin total' },
      { label: 'Fecha', value: quote.created_at?.slice(0, 10) ?? 'Sin fecha' },
    ],
  }
}

function compareQuotes(left: QuoteListItem, right: QuoteListItem): DuplicateReason[] {
  const reasons: DuplicateReason[] = []
  const sameClient = left.client_id && left.client_id === right.client_id
  const sameLead = left.lead_id && left.lead_id === right.lead_id
  const sameProperty = left.property_id && left.property_id === right.property_id
  const sameTotal = normalizeMoney(left.total) && normalizeMoney(left.total) === normalizeMoney(right.total)
  const closeDays = daysBetween(left.created_at ?? null, right.created_at ?? null)

  if (sameClient && sameProperty && sameTotal && closeDays <= 7) {
    reasons.push({ code: 'quote-client-property-total', label: 'Coinciden cliente, propiedad y total reciente', severity: 'strong' })
  }
  if ((sameClient || sameLead) && sameTotal && closeDays <= 14) {
    reasons.push({ code: 'quote-context-total', label: 'Coincide el contexto comercial y el total', severity: 'probable' })
  }

  return reasons
}

export function buildQuoteDuplicateGroups(quotes: QuoteListItem[]) {
  return createGroups('quote', quotes, (quote) => quote.id, compareQuotes, buildQuoteSummary)
}

export function findQuoteDuplicateGroups(input: QuoteListItem, quotes: QuoteListItem[]) {
  return toCandidateGroup('quote', input, (quote) => quote.id, buildQuoteSummary, quotes
    .filter((quote) => quote.id !== input.id)
    .map((quote) => ({ record: quote, reasons: compareQuotes(input, quote) }))
    .filter((item) => item.reasons.length > 0))
}

function buildInvoiceSummary(invoice: InvoiceListItem): DuplicateRecordSummary {
  return {
    title: invoice.invoice_number ?? invoice.display_code ?? invoice.id,
    subtitle: invoice.client_name ?? invoice.client_display_code ?? invoice.client_id,
    meta: [invoice.issue_date, normalizeMoney(invoice.total), invoice.service_reference ?? 'Sin referencia'],
    facts: [
      { label: 'Cliente', value: invoice.client_name ?? invoice.client_display_code ?? invoice.client_id },
      { label: 'Fecha', value: invoice.issue_date },
      { label: 'Total', value: normalizeMoney(invoice.total) || 'Sin total' },
      { label: 'Referencia', value: invoice.invoice_number ?? invoice.display_code ?? invoice.id },
    ],
  }
}

function compareInvoices(left: InvoiceListItem, right: InvoiceListItem): DuplicateReason[] {
  const reasons: DuplicateReason[] = []
  const leftInvoiceNumber = normalizeLooseText(left.invoice_number)
  const rightInvoiceNumber = normalizeLooseText(right.invoice_number)
  const sameTotal = normalizeMoney(left.total) && normalizeMoney(left.total) === normalizeMoney(right.total)
  const sameDate = normalizeDateKey(left.issue_date) && normalizeDateKey(left.issue_date) === normalizeDateKey(right.issue_date)

  if (leftInvoiceNumber && leftInvoiceNumber === rightInvoiceNumber) {
    reasons.push({ code: 'invoice-number', label: 'Coincide la referencia de factura', severity: 'exact' })
  }
  if (left.job_id && left.job_id === right.job_id) {
    reasons.push({ code: 'invoice-job', label: 'Coincide el servicio origen', severity: 'exact' })
  }
  if (left.quote_id && left.quote_id === right.quote_id) {
    reasons.push({ code: 'invoice-quote', label: 'Coincide el presupuesto origen', severity: 'strong' })
  }
  if (left.client_id === right.client_id && sameDate && sameTotal) {
    reasons.push({ code: 'invoice-client-date-total', label: 'Coinciden cliente, fecha e importe', severity: 'probable' })
  }

  return reasons
}

export function buildInvoiceDuplicateGroups(invoices: InvoiceListItem[]) {
  return createGroups('invoice', invoices, (invoice) => invoice.id, compareInvoices, buildInvoiceSummary)
}

export function findInvoiceDuplicateGroups(input: InvoiceListItem, invoices: InvoiceListItem[]) {
  return toCandidateGroup('invoice', input, (invoice) => invoice.id, buildInvoiceSummary, invoices
    .filter((invoice) => invoice.id !== input.id)
    .map((invoice) => ({ record: invoice, reasons: compareInvoices(input, invoice) }))
    .filter((item) => item.reasons.length > 0))
}

function buildPaymentSummary(payment: PaymentListItem): DuplicateRecordSummary {
  return {
    title: payment.display_code ?? payment.id,
    subtitle: payment.invoice_number ?? payment.invoice_display_code ?? payment.invoice_id,
    meta: [payment.payment_date, normalizeMoney(payment.amount), payment.payment_method ?? 'Sin metodo'],
    facts: [
      { label: 'Factura', value: payment.invoice_number ?? payment.invoice_display_code ?? payment.invoice_id },
      { label: 'Fecha', value: payment.payment_date },
      { label: 'Importe', value: normalizeMoney(payment.amount) || 'Sin importe' },
      { label: 'Metodo', value: payment.payment_method ?? 'Sin metodo' },
    ],
  }
}

function comparePayments(left: PaymentListItem, right: PaymentListItem): DuplicateReason[] {
  const reasons: DuplicateReason[] = []
  const sameAmount = normalizeMoney(left.amount) && normalizeMoney(left.amount) === normalizeMoney(right.amount)
  const sameMethod = normalizeText(left.payment_method) && normalizeText(left.payment_method) === normalizeText(right.payment_method)
  const sameDate = normalizeDateKey(left.payment_date) && normalizeDateKey(left.payment_date) === normalizeDateKey(right.payment_date)

  if (left.invoice_id === right.invoice_id && sameAmount && sameDate && sameMethod) {
    reasons.push({ code: 'payment-full-match', label: 'Coinciden factura, fecha, importe y metodo', severity: 'strong' })
  }
  if (left.invoice_id === right.invoice_id && sameAmount && sameDate) {
    reasons.push({ code: 'payment-core-match', label: 'Coinciden factura, fecha e importe', severity: 'probable' })
  }

  return reasons
}

export function buildPaymentDuplicateGroups(payments: PaymentListItem[]) {
  return createGroups('payment', payments, (payment) => payment.id, comparePayments, buildPaymentSummary)
}

export function findPaymentDuplicateGroups(input: PaymentListItem, payments: PaymentListItem[]) {
  return toCandidateGroup('payment', input, (payment) => payment.id, buildPaymentSummary, payments
    .filter((payment) => payment.id !== input.id)
    .map((payment) => ({ record: payment, reasons: comparePayments(input, payment) }))
    .filter((item) => item.reasons.length > 0))
}

function buildExpenseSummary(expense: ExpenseListItem): DuplicateRecordSummary {
  return {
    title: expense.supplier_name,
    subtitle: expense.display_code ?? expense.id,
    meta: [expense.expense_date, normalizeMoney(expense.total), expense.description],
    facts: [
      { label: 'Proveedor', value: expense.supplier_name },
      { label: 'Fecha', value: expense.expense_date },
      { label: 'Importe', value: normalizeMoney(expense.total) || 'Sin importe' },
      { label: 'Descripcion', value: expense.description },
    ],
  }
}

function compareExpenses(left: ExpenseListItem, right: ExpenseListItem): DuplicateReason[] {
  const reasons: DuplicateReason[] = []
  const sameTaxId = normalizeTaxId(left.supplier_tax_id) && normalizeTaxId(left.supplier_tax_id) === normalizeTaxId(right.supplier_tax_id)
  const sameReference = normalizeLooseText(left.reference_number) && normalizeLooseText(left.reference_number) === normalizeLooseText(right.reference_number)
  const sameSupplier = normalizeLooseText(left.supplier_name) && normalizeLooseText(left.supplier_name) === normalizeLooseText(right.supplier_name)
  const sameDescription = normalizeLooseText(left.description) && normalizeLooseText(left.description) === normalizeLooseText(right.description)
  const sameDate = normalizeDateKey(left.expense_date) && normalizeDateKey(left.expense_date) === normalizeDateKey(right.expense_date)
  const sameTotal = normalizeMoney(left.total) && normalizeMoney(left.total) === normalizeMoney(right.total)

  if (sameTaxId && sameReference) {
    reasons.push({ code: 'expense-tax-reference', label: 'Coinciden proveedor fiscal y referencia', severity: 'exact' })
  }
  if (sameSupplier && sameDate && sameTotal) {
    reasons.push({ code: 'expense-supplier-date-total', label: 'Coinciden proveedor, fecha e importe', severity: 'strong' })
  }
  if (sameSupplier && sameDescription && sameTotal && daysBetween(left.expense_date, right.expense_date) <= 3) {
    reasons.push({ code: 'expense-supplier-description', label: 'Coinciden proveedor, concepto e importe cercano', severity: 'probable' })
  }

  return reasons
}

export function buildExpenseDuplicateGroups(expenses: ExpenseListItem[]) {
  return createGroups('expense', expenses, (expense) => expense.id, compareExpenses, buildExpenseSummary)
}

export function findExpenseDuplicateGroups(input: ExpenseListItem, expenses: ExpenseListItem[]) {
  return toCandidateGroup('expense', input, (expense) => expense.id, buildExpenseSummary, expenses
    .filter((expense) => expense.id !== input.id)
    .map((expense) => ({ record: expense, reasons: compareExpenses(input, expense) }))
    .filter((item) => item.reasons.length > 0))
}

function buildRecurringPlanSummary(plan: RecurringInvoicePlanListItem): DuplicateRecordSummary {
  return {
    title: plan.title,
    subtitle: plan.client_name ?? plan.client_display_code ?? plan.client_id,
    meta: [plan.frequency, plan.next_issue_date, normalizeMoney((plan.template_lines ?? []).reduce((sum, line) => sum + Number(line.line_subtotal ?? 0), 0))],
    facts: [
      { label: 'Cliente', value: plan.client_name ?? plan.client_display_code ?? plan.client_id },
      { label: 'Propiedad', value: plan.property_name ?? plan.property_display_code ?? 'Sin propiedad' },
      { label: 'Cadencia', value: plan.frequency },
      { label: 'Proxima emision', value: plan.next_issue_date },
    ],
  }
}

function compareRecurringPlans(left: RecurringInvoicePlanListItem, right: RecurringInvoicePlanListItem): DuplicateReason[] {
  const reasons: DuplicateReason[] = []
  const sameTitle = normalizeLooseText(left.title) && normalizeLooseText(left.title) === normalizeLooseText(right.title)
  const sameTotal = normalizeMoney((left.template_lines ?? []).reduce((sum, line) => sum + Number(line.line_subtotal ?? 0), 0))
    && normalizeMoney((left.template_lines ?? []).reduce((sum, line) => sum + Number(line.line_subtotal ?? 0), 0))
      === normalizeMoney((right.template_lines ?? []).reduce((sum, line) => sum + Number(line.line_subtotal ?? 0), 0))

  if (left.client_id === right.client_id && left.property_id === right.property_id && sameTitle && left.frequency === right.frequency) {
    reasons.push({ code: 'recurring-client-property-title', label: 'Coinciden cliente, propiedad, titulo y cadencia', severity: 'strong' })
  }
  if (left.quote_id && left.quote_id === right.quote_id) {
    reasons.push({ code: 'recurring-quote', label: 'Coincide el presupuesto de referencia', severity: 'probable' })
  }
  if (left.client_id === right.client_id && left.frequency === right.frequency && sameTotal) {
    reasons.push({ code: 'recurring-client-cycle-total', label: 'Coinciden cliente, cadencia e importe plantilla', severity: 'probable' })
  }

  return reasons
}

export function buildRecurringPlanDuplicateGroups(plans: RecurringInvoicePlanListItem[]) {
  return createGroups('recurring_plan', plans, (plan) => plan.id, compareRecurringPlans, buildRecurringPlanSummary)
}

export function findRecurringPlanDuplicateGroups(input: RecurringInvoicePlanListItem, plans: RecurringInvoicePlanListItem[]) {
  return toCandidateGroup('recurring_plan', input, (plan) => plan.id, buildRecurringPlanSummary, plans
    .filter((plan) => plan.id !== input.id)
    .map((plan) => ({ record: plan, reasons: compareRecurringPlans(input, plan) }))
    .filter((item) => item.reasons.length > 0))
}

export function getDuplicateSeverityLabel(severity: DuplicateSeverity): string {
  switch (severity) {
    case 'exact': return 'Coincidencia exacta'
    case 'strong': return 'Coincidencia fuerte'
    case 'probable': return 'Coincidencia probable'
    case 'contextual': return 'Coincidencia contextual'
  }
}
