import type { AppView } from '../../app/navigation'
import type {
  InvoiceModuleFilter,
  JobModuleFilter,
  QuoteModuleFilter,
} from '../../app/moduleFilters'
import { automationRuleThresholds } from '../automation/ruleConfig'
import type { ClientListItem } from '../clients/types'
import type { InvoiceListItem } from '../invoices/types'
import type { JobListItem } from '../jobs/types'
import type { PropertyListItem } from '../properties/types'
import type { QuoteListItem } from '../quotes/types'
import { isRecurringPlanDue } from '../recurringInvoices/recurringInvoiceSchedule'
import type { RecurringInvoicePlanListItem } from '../recurringInvoices/types'

export type OperationalSeverity = 'critical' | 'warning' | 'info'

export type OperationalAction =
  | {
      kind: 'module_view'
      label: string
      view: AppView
      filterKey: 'invoices' | 'quotes' | 'jobs'
      filterValue: InvoiceModuleFilter | QuoteModuleFilter | JobModuleFilter
    }
  | {
      kind: 'open_client_workspace'
      label: string
      clientId: string
      tab?: 'summary' | 'properties' | 'jobs' | 'quotes' | 'invoices' | 'payments' | 'activity'
    }
  | {
      kind: 'open_property_workspace'
      label: string
      propertyId: string
      tab?: 'summary' | 'jobs' | 'quotes' | 'invoices' | 'payments' | 'activity'
    }
  | {
      kind: 'open_job_workspace'
      label: string
      jobId: string
      tab?: 'summary' | 'operations' | 'billing' | 'activity'
    }
  | {
      kind: 'open_invoice_detail'
      label: string
      invoiceId: string
    }
  | {
      kind: 'open_quote_detail'
      label: string
      quoteId: string
    }
  | {
      kind: 'open_invoice_payments'
      label: string
      invoiceId: string
    }
  | {
      kind: 'create_job_from_quote'
      label: string
      quoteId: string
    }
  | {
      kind: 'settle_invoice_by_transfer'
      label: string
      invoiceId: string
    }
  | {
      kind: 'emit_recurring_plan'
      label: string
      planId: string
    }
  | {
      kind: 'resume_recurring_plan'
      label: string
      planId: string
    }

export interface OperationalIncident {
  id: string
  severity: OperationalSeverity
  title: string
  summary: string
  detail: string
  entityLabel: string
  contextLabel?: string
  primaryAction: OperationalAction
  secondaryAction?: OperationalAction
}

export interface OperationalQuickView {
  id: string
  label: string
  value: string
  summary: string
  tone: OperationalSeverity
  action: OperationalAction
}

interface BuildOperationalControlInput {
  clients: ClientListItem[]
  properties: PropertyListItem[]
  quotes: QuoteListItem[]
  jobs: JobListItem[]
  invoices: InvoiceListItem[]
  recurringInvoicePlans: RecurringInvoicePlanListItem[]
}

function parseDate(dateValue: string | null | undefined): Date | null {
  if (!dateValue) return null
  const normalized = dateValue.length > 10 ? dateValue : `${dateValue}T00:00:00`
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

function isOlderThanDays(dateValue: string | null | undefined, days: number): boolean {
  const date = parseDate(dateValue)
  if (!date) return false
  const threshold = new Date()
  threshold.setHours(0, 0, 0, 0)
  threshold.setDate(threshold.getDate() - days)
  return date < threshold
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(dateValue: string | null | undefined): string {
  const date = parseDate(dateValue)
  if (!date) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function getClientLabel(client: ClientListItem): string {
  return client.display_code?.trim()
    ? `${client.display_code} · ${client.full_name}`
    : client.full_name
}

function getPropertyLabel(property: PropertyListItem): string {
  return property.display_code?.trim()
    ? `${property.display_code} · ${property.name}`
    : property.name
}

function getQuoteLabel(quote: QuoteListItem): string {
  return quote.display_code?.trim() ?? quote.id
}

function getJobLabel(job: JobListItem): string {
  return job.display_code?.trim() ?? job.id
}

function getInvoiceLabel(invoice: InvoiceListItem): string {
  return invoice.invoice_number?.trim() || invoice.display_code?.trim() || invoice.id
}

function buildClientPendingBalanceMap(invoices: InvoiceListItem[]) {
  const totalsByClientId = new Map<string, { pendingAmount: number; pendingInvoices: number }>()

  for (const invoice of invoices) {
    if (!invoice.client_id || invoice.status === 'cancelled') continue
    const outstandingAmount = Number(invoice.outstanding_amount ?? 0)
    if (outstandingAmount <= 0.009) continue

    const current = totalsByClientId.get(invoice.client_id) ?? { pendingAmount: 0, pendingInvoices: 0 }
    current.pendingAmount += outstandingAmount
    current.pendingInvoices += 1
    totalsByClientId.set(invoice.client_id, current)
  }

  return totalsByClientId
}

function buildClientActivityMap(
  quotes: QuoteListItem[],
  jobs: JobListItem[],
  invoices: InvoiceListItem[],
  recurringInvoicePlans: RecurringInvoicePlanListItem[],
) {
  const counts = new Map<string, number>()

  const bump = (clientId: string | null | undefined) => {
    if (!clientId) return
    counts.set(clientId, (counts.get(clientId) ?? 0) + 1)
  }

  for (const quote of quotes) bump(quote.client_id)
  for (const job of jobs) bump(job.client_id)
  for (const invoice of invoices) bump(invoice.client_id)
  for (const plan of recurringInvoicePlans) bump(plan.client_id)

  return counts
}

export function buildOperationalIncidents({
  clients,
  properties,
  quotes,
  jobs,
  invoices,
  recurringInvoicePlans,
}: BuildOperationalControlInput): OperationalIncident[] {
  const incidents: OperationalIncident[] = []
  const clientById = new Map(clients.map((client) => [client.id, client]))
  const pendingBalanceByClientId = buildClientPendingBalanceMap(invoices)
  const clientActivityById = buildClientActivityMap(quotes, jobs, invoices, recurringInvoicePlans)

  for (const job of jobs) {
    if (job.status !== 'completed' || job.invoice_id) continue

    const stale = isOlderThanDays(job.scheduled_date, automationRuleThresholds.completedJobsWithoutInvoiceOlderThanDays)
    incidents.push({
      id: `job-without-invoice-${job.id}`,
      severity: stale ? 'critical' : 'warning',
      title: stale ? 'Servicio completado sin factura fuera de plazo' : 'Servicio completado sin factura',
      summary: `${job.client_name ?? 'Cliente sin nombre'} · ${formatDate(job.scheduled_date)}`,
      detail: stale
        ? `Este servicio sigue sin factura despues de ${automationRuleThresholds.completedJobsWithoutInvoiceOlderThanDays} dias.`
        : 'El servicio ya termino y debe pasar a facturacion.',
      entityLabel: getJobLabel(job),
      contextLabel: job.property_name ?? job.service_type,
      primaryAction: {
        kind: 'open_job_workspace',
        label: 'Crear factura',
        jobId: job.id,
        tab: 'billing',
      },
      secondaryAction: {
        kind: 'open_client_workspace',
        label: 'Ver cliente',
        clientId: job.client_id,
        tab: 'jobs',
      },
    })
  }

  for (const invoice of invoices) {
    const outstanding = Number(invoice.outstanding_amount ?? 0)
    if (invoice.status === 'cancelled' || outstanding <= 0.009) continue

    if (invoice.payment_status === 'partially_paid') {
      incidents.push({
        id: `invoice-partial-${invoice.id}`,
        severity: 'warning',
        title: 'Factura parcialmente cobrada',
        summary: `${formatCurrency(outstanding)} pendientes · ${invoice.client_name ?? 'Cliente sin nombre'}`,
        detail: 'La factura tiene cobros registrados, pero todavia conserva saldo pendiente.',
        entityLabel: getInvoiceLabel(invoice),
        contextLabel: invoice.job_display_code ?? invoice.property_name ?? invoice.client_name ?? undefined,
        primaryAction: {
          kind: 'settle_invoice_by_transfer',
          label: 'Cobrar restante',
          invoiceId: invoice.id,
        },
        secondaryAction: {
          kind: 'open_invoice_detail',
          label: 'Ver factura',
          invoiceId: invoice.id,
        },
      })
      continue
    }

    if (invoice.payment_status === 'pending') {
      const stale = isOlderThanDays(invoice.issue_date, automationRuleThresholds.unpaidInvoicesOlderThanDays)
      incidents.push({
        id: `invoice-pending-${invoice.id}`,
        severity: stale ? 'critical' : 'warning',
        title: stale ? 'Factura emitida sin cobro fuera de plazo' : 'Factura emitida sin cobro',
        summary: `${formatCurrency(outstanding)} pendientes · ${invoice.client_name ?? 'Cliente sin nombre'}`,
        detail: stale
          ? `La factura sigue abierta tras ${automationRuleThresholds.unpaidInvoicesOlderThanDays} dias desde la emision.`
          : 'La factura esta emitida y todavia no registra cobros.',
        entityLabel: getInvoiceLabel(invoice),
        contextLabel: formatDate(invoice.issue_date),
        primaryAction: {
          kind: 'settle_invoice_by_transfer',
          label: 'Cobrar por transferencia',
          invoiceId: invoice.id,
        },
        secondaryAction: {
          kind: 'open_invoice_detail',
          label: 'Ver factura',
          invoiceId: invoice.id,
        },
      })
    }
  }

  for (const plan of recurringInvoicePlans) {
    if (plan.status === 'active' && isRecurringPlanDue(plan.next_issue_date)) {
      incidents.push({
        id: `recurring-due-${plan.id}`,
        severity: isOlderThanDays(plan.next_issue_date, 0) ? 'critical' : 'warning',
        title: 'Automatizacion recurrente lista para emitir',
        summary: `${plan.client_name ?? 'Cliente sin nombre'} · ${formatDate(plan.next_issue_date)}`,
        detail: 'La siguiente emision ya esta disponible y conviene procesarla hoy.',
        entityLabel: plan.title,
        contextLabel: plan.property_name ?? plan.quote_display_code ?? undefined,
        primaryAction: {
          kind: 'emit_recurring_plan',
          label: 'Emitir ahora',
          planId: plan.id,
        },
        secondaryAction: {
          kind: 'open_client_workspace',
          label: 'Ver cliente',
          clientId: plan.client_id,
          tab: 'invoices',
        },
      })
      continue
    }

    if (plan.status === 'paused') {
      incidents.push({
        id: `recurring-paused-${plan.id}`,
        severity: 'info',
        title: 'Automatizacion recurrente pausada',
        summary: `${plan.client_name ?? 'Cliente sin nombre'} · ${plan.title}`,
        detail: 'El plan esta detenido y no generara nuevas facturas hasta reanudarlo.',
        entityLabel: plan.title,
        contextLabel: plan.property_name ?? formatDate(plan.next_issue_date),
        primaryAction: {
          kind: 'resume_recurring_plan',
          label: 'Reanudar automatizacion',
          planId: plan.id,
        },
        secondaryAction: {
          kind: 'open_client_workspace',
          label: 'Abrir cliente',
          clientId: plan.client_id,
          tab: 'invoices',
        },
      })
    }
  }

  for (const quote of quotes) {
    if (quote.status !== 'accepted' || quote.job_id) continue

    const stale = isOlderThanDays(quote.created_at ?? null, automationRuleThresholds.acceptedQuotesWithoutJobOlderThanDays)
    incidents.push({
      id: `accepted-quote-without-job-${quote.id}`,
      severity: stale ? 'critical' : 'warning',
      title: stale ? 'Presupuesto aceptado sin servicio fuera de plazo' : 'Presupuesto aceptado sin servicio',
      summary: `${formatCurrency(quote.total)} · ${quote.client_name ?? quote.lead_name ?? 'Sin cliente'}`,
      detail: stale
        ? `Sigue aceptado sin generar servicio tras ${automationRuleThresholds.acceptedQuotesWithoutJobOlderThanDays} dias.`
        : 'El presupuesto ya esta aceptado y debe convertirse en servicio.',
      entityLabel: getQuoteLabel(quote),
      contextLabel: quote.property_display_code ?? quote.client_display_code ?? undefined,
      primaryAction: {
        kind: 'create_job_from_quote',
        label: 'Crear servicio',
        quoteId: quote.id,
      },
      secondaryAction: {
        kind: 'open_quote_detail',
        label: 'Ver presupuesto',
        quoteId: quote.id,
      },
    })
  }

  for (const client of clients) {
    const isRelevant = (clientActivityById.get(client.id) ?? 0) > 0
    const missingTaxProfile = !client.tax_id?.trim() || !client.billing_address?.trim()
    if (isRelevant && missingTaxProfile) {
      incidents.push({
        id: `client-missing-fiscal-${client.id}`,
        severity: 'warning',
        title: 'Cliente con datos fiscales incompletos',
        summary: client.full_name,
        detail: !client.tax_id?.trim() && !client.billing_address?.trim()
          ? 'Faltan NIF/CIF y direccion fiscal.'
          : !client.tax_id?.trim()
            ? 'Falta NIF/CIF para completar la ficha fiscal.'
            : 'Falta direccion fiscal para completar la ficha del cliente.',
        entityLabel: getClientLabel(client),
        primaryAction: {
          kind: 'open_client_workspace',
          label: 'Completar cliente',
          clientId: client.id,
          tab: 'summary',
        },
      })
    }

    const pendingBalance = pendingBalanceByClientId.get(client.id)
    if (pendingBalance && pendingBalance.pendingAmount > 0.009) {
      incidents.push({
        id: `client-pending-balance-${client.id}`,
        severity: pendingBalance.pendingAmount > 1000 ? 'warning' : 'info',
        title: 'Cliente con saldo pendiente',
        summary: `${formatCurrency(pendingBalance.pendingAmount)} · ${pendingBalance.pendingInvoices} factura(s) abiertas`,
        detail: 'La cartera del cliente requiere seguimiento de cobro.',
        entityLabel: getClientLabel(client),
        primaryAction: {
          kind: 'open_client_workspace',
          label: 'Ver cobros',
          clientId: client.id,
          tab: 'payments',
        },
      })
    }
  }

  for (const property of properties) {
    const mismatchedClients = new Set<string>()

    for (const job of jobs) {
      if (job.property_id === property.id && job.client_id !== property.client_id) {
        mismatchedClients.add(job.client_id)
      }
    }

    for (const quote of quotes) {
      if (quote.property_id === property.id && quote.client_id && quote.client_id !== property.client_id) {
        mismatchedClients.add(quote.client_id)
      }
    }

    for (const invoice of invoices) {
      if (invoice.property_id === property.id && invoice.client_id !== property.client_id) {
        mismatchedClients.add(invoice.client_id)
      }
    }

    if (mismatchedClients.size === 0) continue

    const firstMismatchedClient = clientById.get([...mismatchedClients][0])
    incidents.push({
      id: `property-relation-anomaly-${property.id}`,
      severity: 'critical',
      title: 'Propiedad con relacion anomala',
      summary: `${mismatchedClients.size} cliente(s) vinculados fuera del titular esperado`,
      detail: 'Hay servicios, presupuestos o facturas asociados a una propiedad con cliente distinto al titular principal.',
      entityLabel: getPropertyLabel(property),
      contextLabel: firstMismatchedClient ? getClientLabel(firstMismatchedClient) : undefined,
      primaryAction: {
        kind: 'open_property_workspace',
        label: 'Revisar propiedad',
        propertyId: property.id,
        tab: 'summary',
      },
      secondaryAction: {
        kind: 'open_client_workspace',
        label: 'Ver titular',
        clientId: property.client_id,
        tab: 'summary',
      },
    })
  }

  const severityOrder: Record<OperationalSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  }

  return incidents.sort((left, right) => {
    const severityDiff = severityOrder[left.severity] - severityOrder[right.severity]
    if (severityDiff !== 0) return severityDiff
    return left.title.localeCompare(right.title, 'es')
  })
}

export function buildOperationalQuickViews({
  clients,
  quotes,
  jobs,
  invoices,
  recurringInvoicePlans,
}: BuildOperationalControlInput): OperationalQuickView[] {
  const pendingBalanceByClientId = buildClientPendingBalanceMap(invoices)
  const clientsWithPendingBalance = [...pendingBalanceByClientId.entries()]
    .sort((left, right) => right[1].pendingAmount - left[1].pendingAmount)

  const firstClientWithPendingBalance = clientsWithPendingBalance[0]
  const firstPendingFiscalClient = clients.find((client) =>
    (!client.tax_id?.trim() || !client.billing_address?.trim())
    && invoices.some((invoice) => invoice.client_id === client.id),
  ) ?? null
  const dueRecurringPlans = recurringInvoicePlans.filter((plan) => plan.status === 'active' && isRecurringPlanDue(plan.next_issue_date))
  const firstDueRecurringPlan = dueRecurringPlans[0] ?? null
  const acceptedWithoutJob = quotes.filter((quote) => quote.status === 'accepted' && !quote.job_id)

  return [
    {
      id: 'pending-billing',
      label: 'Pendientes de facturar',
      value: String(jobs.filter((job) => job.status === 'completed' && !job.invoice_id).length),
      summary: 'Servicios completados listos para pasar a facturacion.',
      tone: 'warning',
      action: {
        kind: 'module_view',
        label: 'Abrir servicios pendientes',
        view: 'jobs',
        filterKey: 'jobs',
        filterValue: 'completed_without_invoice',
      },
    },
    {
      id: 'jobs-today',
      label: 'Servicios de hoy',
      value: String(jobs.filter((job) => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const scheduled = parseDate(job.scheduled_date)
        return Boolean(scheduled) && scheduled!.getTime() === today.getTime() && job.status !== 'cancelled'
      }).length),
      summary: 'Agenda inmediata para ejecucion y seguimiento.',
      tone: 'info',
      action: {
        kind: 'module_view',
        label: 'Abrir agenda de hoy',
        view: 'jobs',
        filterKey: 'jobs',
        filterValue: 'today',
      },
    },
    {
      id: 'pending-collections',
      label: 'Cobros pendientes',
      value: String(invoices.filter((invoice) => (invoice.outstanding_amount ?? 0) > 0.009 && invoice.status !== 'cancelled').length),
      summary: 'Facturas con saldo abierto y seguimiento pendiente.',
      tone: 'warning',
      action: {
        kind: 'module_view',
        label: 'Abrir facturas pendientes',
        view: 'invoices',
        filterKey: 'invoices',
        filterValue: 'pending',
      },
    },
    {
      id: 'partial-collections',
      label: 'Facturas parcialmente cobradas',
      value: String(invoices.filter((invoice) => invoice.payment_status === 'partially_paid').length),
      summary: 'Casos ya movidos que todavia necesitan cierre.',
      tone: 'warning',
      action: {
        kind: 'module_view',
        label: 'Abrir parciales',
        view: 'invoices',
        filterKey: 'invoices',
        filterValue: 'partially_paid',
      },
    },
    {
      id: 'overdue-internal',
      label: 'Cobros fuera de plazo interno',
      value: String(invoices.filter((invoice) =>
        (invoice.outstanding_amount ?? 0) > 0.009
        && invoice.status !== 'cancelled'
        && isOlderThanDays(invoice.issue_date, automationRuleThresholds.unpaidInvoicesOlderThanDays),
      ).length),
      summary: 'Pendientes con mas de siete dias desde emision.',
      tone: 'critical',
      action: {
        kind: 'module_view',
        label: 'Abrir urgentes',
        view: 'invoices',
        filterKey: 'invoices',
        filterValue: 'unpaid_older_7d',
      },
    },
    {
      id: 'recurring-due',
      label: 'Automaticas por emitir',
      value: String(dueRecurringPlans.length),
      summary: 'Planes activos cuya siguiente emision ya esta disponible.',
      tone: firstDueRecurringPlan ? 'warning' : 'info',
      action: firstDueRecurringPlan
        ? {
            kind: 'open_client_workspace',
            label: 'Abrir primer cliente',
            clientId: firstDueRecurringPlan.client_id,
            tab: 'invoices',
          }
        : {
            kind: 'module_view',
            label: 'Abrir servicios de hoy',
            view: 'jobs',
            filterKey: 'jobs',
            filterValue: 'today',
          },
    },
    {
      id: 'clients-pending-balance',
      label: 'Clientes con saldo pendiente',
      value: String(clientsWithPendingBalance.length),
      summary: clientsWithPendingBalance.length > 0
        ? `${formatCurrency(clientsWithPendingBalance[0][1].pendingAmount)} en el cliente mas expuesto.`
        : 'No hay cartera pendiente relevante.',
      tone: firstClientWithPendingBalance ? 'warning' : 'info',
      action: firstClientWithPendingBalance
        ? {
            kind: 'open_client_workspace',
            label: 'Abrir principal',
            clientId: firstClientWithPendingBalance[0],
            tab: 'payments',
          }
        : {
            kind: 'module_view',
            label: 'Abrir cobros pendientes',
            view: 'invoices',
            filterKey: 'invoices',
            filterValue: 'pending',
          },
    },
    {
      id: 'quotes-without-conversion',
      label: 'Presupuestos sin conversion',
      value: String(acceptedWithoutJob.length),
      summary: 'Aceptados comercialmente aun sin servicio creado.',
      tone: acceptedWithoutJob.length > 0 ? 'warning' : 'info',
      action: {
        kind: 'module_view',
        label: 'Abrir presupuestos',
        view: 'quotes',
        filterKey: 'quotes',
        filterValue: 'accepted_without_job',
      },
    },
    {
      id: 'clients-missing-fiscal',
      label: 'Clientes fiscales incompletos',
      value: String(clients.filter((client) => !client.tax_id?.trim() || !client.billing_address?.trim()).length),
      summary: 'Fichas que necesitan NIF/CIF o direccion fiscal.',
      tone: firstPendingFiscalClient ? 'warning' : 'info',
      action: firstPendingFiscalClient
        ? {
            kind: 'open_client_workspace',
            label: 'Abrir cliente',
            clientId: firstPendingFiscalClient.id,
            tab: 'summary',
          }
        : {
            kind: 'module_view',
            label: 'Abrir clientes con saldo',
            view: 'invoices',
            filterKey: 'invoices',
            filterValue: 'pending',
          },
    },
  ]
}
