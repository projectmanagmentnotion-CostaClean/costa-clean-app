import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppNav } from './AppNav'
import { Suspense, lazy } from 'react'
import '../features/shell/shell-dashboard.css'
import '../features/shell/shell-dashboard-polish.css'
import '../features/shell/shell-dashboard-structure.css'
import '../features/shell/detail-panels.css'
import '../features/shell/document-views.css'
import '../features/shell/document-density.css'
import '../features/shell/forms-feedback-accessibility.css'
import '../features/shell/compact-lists.css'
import '../features/shell/qa-visual-fixes.css'
import '../features/shell/status-badges.css'
import '../features/clients/client-workspace.css'
import type { AppView } from './navigation'
import type { AppTheme } from './theme'
import { useDashboardMetrics } from './dashboardMetrics'
import { useClosingSummaries } from './useClosingSummaries'
import { useShellNavigation } from './useShellNavigation'
import { useAppData } from './useAppData'
import {
  applyExpenseFilter,
  applyInvoiceFilter,
  applyJobFilter,
  applyPaymentFilter,
  applyQuoteFilter,
  emptyModuleFilterState,
  getExpenseFilterLabel,
  getInvoiceFilterLabel,
  getJobFilterLabel,
  getPaymentFilterLabel,
  getQuoteFilterLabel,
  type ModuleFilterState,
} from './moduleFilters'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { PropertyListItem } from '../features/properties/types'
import { buildJobCreatePrefillFromQuote } from '../features/jobs/jobCreatePrefill'
import type { QuoteListItem } from '../features/quotes/types'
import type { JobListItem } from '../features/jobs/types'
import { buildInvoiceCreatePrefillFromJob } from '../features/invoices/invoiceCreatePrefill'
import type { InvoiceListItem } from '../features/invoices/types'
import { buildInvoicePaymentSummary } from '../features/invoices/paymentState'
import { settleInvoiceByTransfer } from '../features/financial/financialWriteApi'
import {
  applyDashboardKpiAction,
  dashboardKpiActionConfig,
  type DashboardKpiActionId,
} from '../features/dashboard/kpiActions'
import {
  buildOperationalIncidents,
  buildOperationalQuickViews,
  type OperationalAction,
} from '../features/dashboard/operationalControl'
import { saveQuarterlyClosing } from '../features/quarterlyClosing/quarterlyClosingApi'
import { buildQuarterlyClosingSnapshot } from '../features/quarterlyClosing/quarterlyClosingSummary'
import type { QuarterlyClosingIncidence } from '../features/quarterlyClosing/types'
import { saveAnnualClosing } from '../features/annualClosing/annualClosingApi'
import { buildAnnualClosingSnapshot } from '../features/annualClosing/annualClosingSummary'
import type { AnnualClosingIncidence } from '../features/annualClosing/types'
import { buildAutomationAlerts } from '../features/automation/alertRules'
import type { AutomationAlertItem } from '../features/automation/types'
import { buildRecurringPlanPersistenceInput } from '../features/recurringInvoices/planPersistence'
import { generateInvoiceFromRecurringPlan, saveRecurringInvoicePlan } from '../features/recurringInvoices/recurringInvoiceApi'
import { isRecurringPlanDue } from '../features/recurringInvoices/recurringInvoiceSchedule'
import { formatClientLabel, formatInvoiceLabel, formatQuoteLabel } from './relationshipLabels'
import { setClientWorkspaceLocation, type ClientWorkspaceTab } from '../features/clients/useClientWorkspaceNavigation'
import { setPropertyWorkspaceLocation, type PropertyWorkspaceTab } from '../features/properties/usePropertyWorkspaceNavigation'
import { setJobWorkspaceLocation, type JobWorkspaceTab } from '../features/jobs/useJobWorkspaceNavigation'

const reviewedAlertsStorageKey = 'costaclean-reviewed-alerts'

interface AppShellProps {
  theme: AppTheme
  onToggleTheme: () => void
}

const HomePage = lazy(async () => ({ default: (await import('../pages/HomePage')).HomePage }))
const LeadsPage = lazy(async () => ({ default: (await import('../pages/LeadsPage')).LeadsPage }))
const ClientsPage = lazy(async () => ({ default: (await import('../pages/ClientsPage')).ClientsPage }))
const PropertiesPage = lazy(async () => ({ default: (await import('../pages/PropertiesPage')).PropertiesPage }))
const QuotesPage = lazy(async () => ({ default: (await import('../pages/QuotesPage')).QuotesPage }))
const JobsPage = lazy(async () => ({ default: (await import('../pages/JobsPage')).JobsPage }))
const InvoicesPage = lazy(async () => ({ default: (await import('../pages/InvoicesPage')).InvoicesPage }))
const ExpensesPage = lazy(async () => ({ default: (await import('../pages/ExpensesPage')).ExpensesPage }))
const PaymentsPage = lazy(async () => ({ default: (await import('../pages/PaymentsPage')).PaymentsPage }))
const QuarterlyClosingPage = lazy(async () => ({ default: (await import('../pages/QuarterlyClosingPage')).QuarterlyClosingPage }))
const AnnualClosingPage = lazy(async () => ({ default: (await import('../pages/AnnualClosingPage')).AnnualClosingPage }))
const AlertsCenterPage = lazy(async () => ({ default: (await import('../pages/AlertsCenterPage')).AlertsCenterPage }))

function normalizeInvoiceLines(invoice: InvoiceListItem): InvoiceListItem['lines'] {
  return [...(invoice.lines?.length ? invoice.lines : invoice.invoice_lines ?? [])].sort(
    (left, right) => Number(left.sort_order) - Number(right.sort_order),
  )
}

function buildPropertyAddressLine(property: PropertyListItem | undefined): string | null {
  if (!property) return null

  const parts = [
    property.address?.trim(),
    property.postal_code?.trim(),
    property.city?.trim(),
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(', ') : null
}

function buildServiceReference(
  resolvedQuoteId: string | null,
  resolvedJobId: string | null,
  job: JobListItem | undefined,
  property: PropertyListItem | undefined,
  quote: QuoteListItem | undefined,
): string | null {
  const parts = [
    quote?.display_code ?? resolvedQuoteId ?? null,
    job?.display_code ?? resolvedJobId ?? null,
    property?.display_code ?? null,
    property?.name ?? null,
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(' · ') : null
}

function buildServiceDescription(
  job: JobListItem | undefined,
  property: PropertyListItem | undefined,
): string | null {
  const serviceType = job?.service_type?.trim() || 'Servicio de limpieza'
  const propertyName = property?.name?.trim()
  const propertyType = property?.property_type?.trim()
  const city = property?.city?.trim()

  const locationBits = [propertyName, propertyType, city].filter(Boolean)
  return locationBits.length > 0
    ? `${serviceType} en ${locationBits.join(' · ')}`
    : serviceType
}

function getDateKey(dateValue: string): string | null {
  if (!dateValue) return null
  const normalizedValue = dateValue.length > 10 ? dateValue : `${dateValue}T00:00:00`
  const date = new Date(normalizedValue)
  if (Number.isNaN(date.getTime())) return null
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createDayKey(offsetDays = 0): string {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + offsetDays)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function ShellLoadingState({ currentView }: { currentView: AppView }) {
  const titleByView: Record<AppView, string> = {
    dashboard: 'Preparando panel de control',
    alerts: 'Preparando centro de alertas',
    quarterly_closing: 'Preparando cierre trimestral',
    annual_closing: 'Preparando cierre anual',
    leads: 'Cargando leads',
    clients: 'Cargando clientes',
    properties: 'Cargando propiedades',
    quotes: 'Cargando presupuestos',
    jobs: 'Cargando servicios',
    invoices: 'Cargando facturas',
    expenses: 'Cargando gastos',
    payments: 'Cargando cobros',
  }

  return (
    <section className="cc-shell-loading" aria-live="polite" aria-busy="true">
      <div className="cc-shell-loading__hero">
        <div className="cc-shell-loading__eyebrow" />
        <div className="cc-shell-loading__title" />
        <div className="cc-shell-loading__text" />
      </div>

      <div className="cc-shell-loading__grid">
        <article className="cc-shell-loading__card">
          <div className="cc-shell-loading__line cc-shell-loading__line--short" />
          <div className="cc-shell-loading__line cc-shell-loading__line--value" />
          <div className="cc-shell-loading__line cc-shell-loading__line--wide" />
        </article>
        <article className="cc-shell-loading__card">
          <div className="cc-shell-loading__line cc-shell-loading__line--short" />
          <div className="cc-shell-loading__line cc-shell-loading__line--value" />
          <div className="cc-shell-loading__line cc-shell-loading__line--medium" />
        </article>
        <article className="cc-shell-loading__card">
          <div className="cc-shell-loading__line cc-shell-loading__line--short" />
          <div className="cc-shell-loading__line cc-shell-loading__line--value" />
          <div className="cc-shell-loading__line cc-shell-loading__line--wide" />
        </article>
      </div>

      <div className="empty-state cc-state-card cc-state-card--loading">
        <strong>{titleByView[currentView]}</strong>
        <p>Sincronizando datos y preparando la vista operativa.</p>
      </div>
    </section>
  )
}

export function AppShell({ theme, onToggleTheme }: AppShellProps) {
  const {
    currentView,
    unsavedChangesContext,
    pendingGuardedAction,
    navigationBackTarget,
    updateUnsavedChanges,
    commitViewChange,
    runWithNavigationGuard,
    handleConfirmGuardedAction,
    navigateToView,
    navigateBack,
    setPendingGuardedAction,
  } = useShellNavigation()
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [compactMobileNav, setCompactMobileNav] = useState(false)
  const [operationalToast, setOperationalToast] = useState<{ title: string; summary: string } | null>(null)
  const [moduleFilters, setModuleFilters] = useState<ModuleFilterState>(emptyModuleFilterState)
  const [quarterlyClosingFocus, setQuarterlyClosingFocus] = useState<{ fiscalYear: number; fiscalQuarter: number } | null>(null)
  const [jobCreatePrefill, setJobCreatePrefill] = useState<ReturnType<typeof buildJobCreatePrefillFromQuote> | null>(null)
  const [invoiceCreatePrefill, setInvoiceCreatePrefill] = useState<ReturnType<typeof buildInvoiceCreatePrefillFromJob> | null>(null)
  const {
    isInitialDataLoading,
    syncStatus,
    leads,
    leadDrafts,
    clients,
    properties,
    quotes,
    jobs,
    invoices,
    expenses,
    payments,
    recurringInvoicePlans,
    quarterlyClosings,
    annualClosings,
    leadError,
    leadDraftError,
    clientError,
    propertyError,
    quoteError,
    jobError,
    invoiceError,
    expenseError,
    paymentError,
    quarterlyClosingError,
    annualClosingError,
    refreshBilling,
    refreshOperations,
    refreshClosings,
    reloadInvoicesAndPayments,
    reloadLeadsAndClients,
    intakeRealtimeNotifications,
    dismissIntakeRealtimeNotification,
  } = useAppData()
  const [reviewedAlertIds, setReviewedAlertIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []

    try {
      const storedValue = window.localStorage.getItem(reviewedAlertsStorageKey)
      if (!storedValue) return []
      const parsedValue = JSON.parse(storedValue)
      return Array.isArray(parsedValue) ? parsedValue.filter((value): value is string => typeof value === 'string') : []
    } catch {
      return []
    }
  })
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset || 0
      setShowScrollTop(scrollY > 360)
      setCompactMobileNav(scrollY > 96)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(reviewedAlertsStorageKey, JSON.stringify(reviewedAlertIds))
    } catch {
      // Keep alert review state best-effort and local-only.
    }
  }, [reviewedAlertIds])

  useEffect(() => {
    if (!unsavedChangesContext) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [unsavedChangesContext])

  const latestIntakeNotification = intakeRealtimeNotifications[0] ?? null

  useEffect(() => {
    if (!latestIntakeNotification) return

    const timeoutId = window.setTimeout(() => {
      dismissIntakeRealtimeNotification(latestIntakeNotification.id)
    }, 6500)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [dismissIntakeRealtimeNotification, latestIntakeNotification])

  useEffect(() => {
    if (!operationalToast) return

    const timeoutId = window.setTimeout(() => {
      setOperationalToast(null)
    }, 5200)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [operationalToast])

  const clientCodeById = useMemo(() => new Map(clients.map((client) => [client.id, client.display_code ?? client.id])), [clients])
  const clientById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients])
  const leadById = useMemo(() => new Map(leads.map((lead) => [lead.id, lead])), [leads])
  const propertyCodeById = useMemo(() => new Map(properties.map((property) => [property.id, property.display_code ?? property.id])), [properties])
  const propertyById = useMemo(() => new Map(properties.map((property) => [property.id, property])), [properties])
  const quoteCodeById = useMemo(() => new Map(quotes.map((quote) => [quote.id, quote.display_code ?? quote.id])), [quotes])
  const quoteById = useMemo(() => new Map(quotes.map((quote) => [quote.id, quote])), [quotes])
  const jobCodeById = useMemo(() => new Map(jobs.map((job) => [job.id, job.display_code ?? job.id])), [jobs])
  const jobById = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs])
  const invoiceById = useMemo(() => new Map(invoices.map((invoice) => [invoice.id, invoice])), [invoices])
  const paymentsByInvoiceId = useMemo(() => {
    const map = new Map<string, typeof payments>()

    for (const payment of payments) {
      const currentItems = map.get(payment.invoice_id) ?? []
      currentItems.push(payment)
      map.set(payment.invoice_id, currentItems)
    }

    return map
  }, [payments])

  const dashboardMetrics = useDashboardMetrics({
    leads,
    clients,
    properties,
    quotes,
    jobs,
    invoices,
    expenses,
    payments,
    recurringInvoicePlans,
  })

  const propertiesWithCodes = useMemo(
    () => properties.map((property) => ({
      ...property,
      client_display_code: clientCodeById.get(property.client_id) ?? property.client_id,
      client_name: clientById.get(property.client_id)?.full_name ?? null,
    })),
    [properties, clientById, clientCodeById],
  )

  const clientsWithContext = useMemo(
    () => clients.map((client) => ({
      ...client,
      source_lead_display_code: client.source_lead_id
        ? leadById.get(client.source_lead_id)?.display_code ?? client.source_lead_id
        : null,
      source_lead_name: client.source_lead_id
        ? leadById.get(client.source_lead_id)?.full_name ?? null
        : null,
    })),
    [clients, leadById],
  )

  const quotesWithCodes = useMemo(
    () => quotes.map((quote) => ({
      ...quote,
      client_display_code: quote.client_id ? clientCodeById.get(quote.client_id) ?? quote.client_id : null,
      client_name: quote.client_id ? clientById.get(quote.client_id)?.full_name ?? null : null,
      lead_display_code: quote.lead_id ? leadById.get(quote.lead_id)?.display_code ?? quote.lead_id : null,
      lead_name: quote.lead_id ? leadById.get(quote.lead_id)?.full_name ?? null : null,
      property_display_code: quote.property_id ? propertyCodeById.get(quote.property_id) ?? quote.property_id : null,
      job_id: jobs.find((job) => job.quote_id === quote.id)?.id ?? null,
      invoice_id: invoices.find((invoice) => invoice.quote_id === quote.id)?.id ?? null,
    })),
    [quotes, jobs, invoices, clientById, clientCodeById, leadById, propertyCodeById],
  )

  const jobsWithCodes = useMemo(
    () => jobs.map((job) => ({
      ...job,
      client_display_code: clientCodeById.get(job.client_id) ?? job.client_id,
      client_name: clientById.get(job.client_id)?.full_name ?? null,
      property_display_code: propertyCodeById.get(job.property_id) ?? job.property_id,
      property_name: propertyById.get(job.property_id)?.name ?? null,
      quote_display_code: job.quote_id ? quoteCodeById.get(job.quote_id) ?? job.quote_id : null,
      invoice_id: invoices.find((invoice) => invoice.job_id === job.id)?.id ?? null,
    })),
    [jobs, invoices, clientById, clientCodeById, propertyById, propertyCodeById, quoteCodeById],
  )

  const dashboardAgenda = useMemo(() => {
    const todayKey = createDayKey(0)
    const tomorrowKey = createDayKey(1)

    const activeJobs = [...jobsWithCodes]
      .filter((job) => job.status !== 'cancelled')
      .sort((left, right) => left.scheduled_date.localeCompare(right.scheduled_date))

    return {
      todayJobs: activeJobs.filter((job) => getDateKey(job.scheduled_date) === todayKey),
      tomorrowJobs: activeJobs.filter((job) => getDateKey(job.scheduled_date) === tomorrowKey),
      upcomingJobs: activeJobs
        .filter((job) => {
          const dateKey = getDateKey(job.scheduled_date)
          return Boolean(dateKey) && dateKey! > tomorrowKey && job.status !== 'completed'
        })
        .slice(0, 5),
    }
  }, [jobsWithCodes])

  const invoicesWithCodes = useMemo(
    () => invoices.map((invoice) => {
      const job = invoice.job_id ? jobById.get(invoice.job_id) : undefined
      const resolvedClientId = job?.client_id ?? invoice.client_id
      const resolvedJobId = job?.id ?? invoice.job_id ?? null
      const resolvedQuoteId = job?.quote_id ?? invoice.quote_id ?? null
      const quote = resolvedQuoteId ? quoteById.get(resolvedQuoteId) : undefined
      const resolvedPropertyId = invoice.property_id ?? job?.property_id ?? quote?.property_id ?? null
      const property = resolvedPropertyId ? propertyById.get(resolvedPropertyId) : undefined
      const client = clientById.get(resolvedClientId)
      const paymentSummary = buildInvoicePaymentSummary(invoice, paymentsByInvoiceId.get(invoice.id) ?? [])

      return {
        ...invoice,
        client_id: resolvedClientId,
        client_display_code: clientCodeById.get(resolvedClientId) ?? resolvedClientId,
        job_display_code: resolvedJobId ? jobCodeById.get(resolvedJobId) ?? resolvedJobId : null,
        client_name: client?.full_name ?? null,
        client_phone: client?.phone ?? null,
        client_email: client?.email ?? null,
        property_id: resolvedPropertyId,
        property_display_code: property?.display_code ?? (resolvedPropertyId ? propertyCodeById.get(resolvedPropertyId) ?? resolvedPropertyId : null),
        property_name: property?.name ?? null,
        property_address_line: buildPropertyAddressLine(property),
        quote_id: resolvedQuoteId,
        quote_display_code: quote?.display_code ?? resolvedQuoteId,
        client_label: formatClientLabel({
          client_id: resolvedClientId,
          client_display_code: clientCodeById.get(resolvedClientId) ?? resolvedClientId,
          client_name: client?.full_name ?? null,
        }),
        service_reference: buildServiceReference(resolvedQuoteId, resolvedJobId, job, property, quote),
        service_description: buildServiceDescription(job, property),
        billing_concept: invoice.billing_concept ?? job?.billing_concept ?? null,
        billing_quantity: invoice.billing_quantity ?? job?.billing_quantity ?? null,
        billing_unit: invoice.billing_unit ?? job?.billing_unit ?? null,
        billing_unit_price: invoice.billing_unit_price ?? job?.billing_unit_price ?? null,
        payment_status: paymentSummary.financialStatus,
        paid_amount: paymentSummary.paidAmount,
        outstanding_amount: paymentSummary.outstandingAmount,
        payment_count: paymentSummary.paymentCount,
        last_payment_date: paymentSummary.lastPayment?.payment_date ?? null,
        last_payment_method: paymentSummary.lastPayment?.payment_method ?? null,
        last_payment_origin_type: paymentSummary.lastPayment?.origin_type ?? null,
        lines: normalizeInvoiceLines(invoice),
      }
    }),
    [invoices, clientById, clientCodeById, jobById, jobCodeById, paymentsByInvoiceId, propertyById, propertyCodeById, quoteById],
  )

  const paymentsWithCodes = useMemo(
    () => payments.map((payment) => {
      const linkedInvoice = invoiceById.get(payment.invoice_id)
      return {
        ...payment,
        invoice_display_code: linkedInvoice?.display_code ?? payment.invoice_id,
        invoice_number: linkedInvoice?.invoice_number ?? null,
      }
    }),
    [payments, invoiceById],
  )

  const recurringInvoicePlansWithCodes = useMemo(
    () => recurringInvoicePlans.map((plan) => {
      const property = plan.property_id ? propertyById.get(plan.property_id) : undefined
      return {
        ...plan,
        client_display_code: clientCodeById.get(plan.client_id) ?? plan.client_id,
        client_name: clientById.get(plan.client_id)?.full_name ?? null,
        property_display_code: plan.property_id ? propertyCodeById.get(plan.property_id) ?? plan.property_id : null,
        property_name: property?.name ?? null,
        quote_display_code: plan.quote_id ? quoteCodeById.get(plan.quote_id) ?? plan.quote_id : null,
      }
    }),
    [recurringInvoicePlans, clientById, clientCodeById, propertyById, propertyCodeById, quoteCodeById],
  )

  const clientBalanceLeaders = useMemo(() => {
    const totalsByClientId = new Map<string, { pendingAmount: number; pendingInvoices: number }>()

    for (const invoice of invoicesWithCodes) {
      if (!invoice.client_id || invoice.status === 'cancelled') continue
      const outstandingAmount = Number(invoice.outstanding_amount ?? 0)
      if (outstandingAmount <= 0.009) continue

      const current = totalsByClientId.get(invoice.client_id) ?? { pendingAmount: 0, pendingInvoices: 0 }
      current.pendingAmount += outstandingAmount
      current.pendingInvoices += 1
      totalsByClientId.set(invoice.client_id, current)
    }

    return [...totalsByClientId.entries()]
      .map(([clientId, value]) => ({
        clientId,
        clientLabel: formatClientLabel(clientById.get(clientId) ?? {
          client_id: clientId,
          client_display_code: clientCodeById.get(clientId) ?? clientId,
        }),
        pendingAmount: value.pendingAmount,
        pendingInvoices: value.pendingInvoices,
      }))
      .sort((left, right) => right.pendingAmount - left.pendingAmount)
      .slice(0, 5)
  }, [clientById, clientCodeById, invoicesWithCodes])

  const dueRecurringPlansPreview = useMemo(
    () => recurringInvoicePlansWithCodes
      .filter((plan) => plan.status === 'active' && isRecurringPlanDue(plan.next_issue_date))
      .sort((left, right) => left.next_issue_date.localeCompare(right.next_issue_date))
      .slice(0, 5),
    [recurringInvoicePlansWithCodes],
  )

  const operationalIncidents = useMemo(
    () => buildOperationalIncidents({
      clients: clientsWithContext,
      properties: propertiesWithCodes,
      quotes: quotesWithCodes,
      jobs: jobsWithCodes,
      invoices: invoicesWithCodes,
      recurringInvoicePlans: recurringInvoicePlansWithCodes,
    }),
    [
      clientsWithContext,
      propertiesWithCodes,
      quotesWithCodes,
      jobsWithCodes,
      invoicesWithCodes,
      recurringInvoicePlansWithCodes,
    ],
  )

  const operationalQuickViews = useMemo(
    () => buildOperationalQuickViews({
      clients: clientsWithContext,
      properties: propertiesWithCodes,
      quotes: quotesWithCodes,
      jobs: jobsWithCodes,
      invoices: invoicesWithCodes,
      recurringInvoicePlans: recurringInvoicePlansWithCodes,
    }),
    [
      clientsWithContext,
      propertiesWithCodes,
      quotesWithCodes,
      jobsWithCodes,
      invoicesWithCodes,
      recurringInvoicePlansWithCodes,
    ],
  )

  const {
    quarterlyClosingSummaryByPeriod,
    availableClosingYears,
    annualClosingSummaryByYear,
    availableAnnualClosingYears,
    currentFiscalYear,
    currentFiscalQuarter,
  } = useClosingSummaries({
    invoices: invoicesWithCodes,
    payments: paymentsWithCodes,
    expenses,
    quarterlyClosings,
    annualClosings,
  })

  const automationAlerts = useMemo(
    () =>
        buildAutomationAlerts({
          invoices: invoicesWithCodes,
          jobs: jobsWithCodes,
          quotes: quotesWithCodes,
          expenses,
          payments: paymentsWithCodes,
          quarterlyClosings,
          leadDrafts,
          recurringInvoicePlans: recurringInvoicePlansWithCodes,
        }),
    [expenses, invoicesWithCodes, jobsWithCodes, leadDrafts, paymentsWithCodes, quarterlyClosings, quotesWithCodes, recurringInvoicePlansWithCodes],
  )

  const activeReviewedAlertIds = useMemo(() => {
    const activeIds = new Set(automationAlerts.map((alert) => alert.id))
    return reviewedAlertIds.filter((id) => activeIds.has(id))
  }, [automationAlerts, reviewedAlertIds])

  const quoteFilter = moduleFilters.quotes
  const jobFilter = moduleFilters.jobs
  const invoiceFilter = moduleFilters.invoices
  const expenseFilter = moduleFilters.expenses
  const paymentFilter = moduleFilters.payments

  const filteredQuotes = useMemo(
    () => applyQuoteFilter(quotesWithCodes, quoteFilter),
    [quotesWithCodes, quoteFilter],
  )

  const filteredJobs = useMemo(
    () => applyJobFilter(jobsWithCodes, jobFilter),
    [jobsWithCodes, jobFilter],
  )

  const filteredInvoices = useMemo(
    () => applyInvoiceFilter(invoicesWithCodes, invoiceFilter),
    [invoicesWithCodes, invoiceFilter],
  )

  const filteredExpenses = useMemo(
    () => applyExpenseFilter(expenses, expenseFilter),
    [expenses, expenseFilter],
  )

  const filteredPayments = useMemo(
    () => applyPaymentFilter(paymentsWithCodes, paymentFilter),
    [paymentsWithCodes, paymentFilter],
  )

  const handleDashboardKpiAction = useCallback((actionId: DashboardKpiActionId) => {
    const action = dashboardKpiActionConfig[actionId]
    runWithNavigationGuard(() => {
      setModuleFilters((current) => applyDashboardKpiAction(current, actionId))
      commitViewChange(action.view)
    }, {
      description: `Hay ${unsavedChangesContext ?? 'cambios sin guardar'}. Si abres este indicador ahora, perderás esos cambios.`,
      confirmLabel: 'Abrir indicador',
    })
  }, [commitViewChange, runWithNavigationGuard, unsavedChangesContext])

  const handleOpenAutomationAlert = useCallback((alert: AutomationAlertItem) => {
    const routing = alert.routing

    if (routing.kind === 'quarterly_closing') {
      runWithNavigationGuard(() => {
        setQuarterlyClosingFocus({
          fiscalYear: routing.fiscalYear,
          fiscalQuarter: routing.fiscalQuarter,
        })
        commitViewChange('quarterly_closing')
      }, {
        description: `Hay ${unsavedChangesContext ?? 'cambios sin guardar'}. Si abres esta alerta ahora, perderás esos cambios.`,
        confirmLabel: 'Abrir alerta',
      })
      return
    }

    if (routing.kind === 'view') {
      runWithNavigationGuard(() => {
        commitViewChange(routing.view)
      }, {
        description: `Hay ${unsavedChangesContext ?? 'cambios sin guardar'}. Si abres esta alerta ahora, perderás esos cambios.`,
        confirmLabel: 'Abrir alerta',
      })
      return
    }

    runWithNavigationGuard(() => {
      setModuleFilters((current) => ({
        ...current,
        [routing.filterKey]: routing.filterValue,
      }))
      commitViewChange(routing.view)
    }, {
      description: `Hay ${unsavedChangesContext ?? 'cambios sin guardar'}. Si abres esta alerta ahora, perderás esos cambios.`,
      confirmLabel: 'Abrir alerta',
    })
  }, [commitViewChange, runWithNavigationGuard, unsavedChangesContext])

  const handleToggleReviewedAlert = useCallback((alertId: string) => {
    setReviewedAlertIds((current) =>
      current.includes(alertId)
        ? current.filter((value) => value !== alertId)
        : [...current, alertId],
    )
  }, [])

  const handleQuarterlyClosingNavigation = useCallback((
    view: AppView,
    scope: QuarterlyClosingIncidence['scope'],
    fiscalYear: number,
    fiscalQuarter: number,
  ) => {
    setModuleFilters((current) => {
      if (scope === 'invoice_quarter_all') {
        return {
          ...current,
          invoices: { type: 'quarter', fiscalYear, fiscalQuarter, scope: 'all' },
        }
      }

      if (scope === 'invoice_quarter_pending') {
        return {
          ...current,
          invoices: { type: 'quarter', fiscalYear, fiscalQuarter, scope: 'pending' },
        }
      }

      if (scope === 'payment_quarter_all') {
        return {
          ...current,
          payments: { type: 'quarter', fiscalYear, fiscalQuarter, scope: 'all' },
        }
      }

      if (scope === 'expense_quarter_all') {
        return {
          ...current,
          expenses: { type: 'quarter', fiscalYear, fiscalQuarter, scope: 'all' },
        }
      }

      if (scope === 'expense_quarter_closure') {
        return {
          ...current,
          expenses: { type: 'quarter', fiscalYear, fiscalQuarter, scope: 'closure' },
        }
      }

      if (scope === 'expense_quarter_missing_support') {
        return {
          ...current,
          expenses: { type: 'quarter', fiscalYear, fiscalQuarter, scope: 'missing_support' },
        }
      }

      if (scope === 'expense_quarter_pending_review') {
        return {
          ...current,
          expenses: { type: 'quarter', fiscalYear, fiscalQuarter, scope: 'pending_review' },
        }
      }

      return {
        ...current,
        expenses: { type: 'quarter', fiscalYear, fiscalQuarter, scope: 'risk' },
      }
    })
    commitViewChange(view)
  }, [commitViewChange])

  const handleAnnualClosingNavigation = useCallback((
    view: AppView,
    scope: AnnualClosingIncidence['scope'],
    fiscalYear: number,
  ) => {
    setModuleFilters((current) => {
      if (scope === 'invoice_year_all') {
        return {
          ...current,
          invoices: { type: 'year', fiscalYear, scope: 'all' },
        }
      }

      if (scope === 'invoice_year_pending') {
        return {
          ...current,
          invoices: { type: 'year', fiscalYear, scope: 'pending' },
        }
      }

      if (scope === 'payment_year_all') {
        return {
          ...current,
          payments: { type: 'year', fiscalYear, scope: 'all' },
        }
      }

      if (scope === 'expense_year_all') {
        return {
          ...current,
          expenses: { type: 'year', fiscalYear, scope: 'all' },
        }
      }

      if (scope === 'expense_year_closure') {
        return {
          ...current,
          expenses: { type: 'year', fiscalYear, scope: 'closure' },
        }
      }

      if (scope === 'expense_year_missing_support') {
        return {
          ...current,
          expenses: { type: 'year', fiscalYear, scope: 'missing_support' },
        }
      }

      if (scope === 'expense_year_pending_review') {
        return {
          ...current,
          expenses: { type: 'year', fiscalYear, scope: 'pending_review' },
        }
      }

      return {
        ...current,
        expenses: { type: 'year', fiscalYear, scope: 'risk' },
      }
    })
    commitViewChange(view)
  }, [commitViewChange])

  const handleSaveQuarterlyClosing = useCallback(async ({
    fiscalYear,
    fiscalQuarter,
    notes,
  }: {
    fiscalYear: number
    fiscalQuarter: number
    notes: string | null
  }) => {
    const summary = quarterlyClosingSummaryByPeriod.get(`${fiscalYear}-Q${fiscalQuarter}`)

    if (!summary) {
      throw new Error('No se pudo construir el resumen del trimestre seleccionado.')
    }

    await saveQuarterlyClosing({
      fiscalYear,
      fiscalQuarter,
      status: summary.readiness === 'issues' ? 'issues' : 'prepared',
      notes,
      snapshot: buildQuarterlyClosingSnapshot(summary),
    })

    await refreshClosings()
  }, [quarterlyClosingSummaryByPeriod, refreshClosings])

  const handleSaveAnnualClosing = useCallback(async ({
    fiscalYear,
    notes,
  }: {
    fiscalYear: number
    notes: string | null
  }) => {
    const summary = annualClosingSummaryByYear.get(fiscalYear)

    if (!summary) {
      throw new Error('No se pudo construir el resumen anual seleccionado.')
    }

    await saveAnnualClosing({
      fiscalYear,
      status: summary.readiness === 'issues' ? 'issues' : 'prepared',
      notes,
      snapshot: buildAnnualClosingSnapshot(summary),
    })

    await refreshClosings()
  }, [annualClosingSummaryByYear, refreshClosings])

  const handleOpenQuarterFromAnnual = useCallback((fiscalYear: number, fiscalQuarter: number) => {
    setQuarterlyClosingFocus({ fiscalYear, fiscalQuarter })
    commitViewChange('quarterly_closing')
  }, [commitViewChange])

  const handleCreateJobFromQuote = useCallback((quote: QuoteListItem) => {
    const prefill = buildJobCreatePrefillFromQuote(quote)
    if (!prefill) {
      return
    }

    runWithNavigationGuard(() => {
      setJobCreatePrefill(prefill)
      commitViewChange('jobs')
    }, {
      description: `Hay ${unsavedChangesContext ?? 'cambios sin guardar'}. Si creas el servicio desde este presupuesto ahora, perderás esos cambios.`,
      confirmLabel: 'Crear servicio',
    })
  }, [commitViewChange, runWithNavigationGuard, unsavedChangesContext])

  const handleOpenClientWorkspace = useCallback((clientId: string, tab: ClientWorkspaceTab = 'summary') => {
    runWithNavigationGuard(() => {
      setClientWorkspaceLocation({ clientId, tab })
      commitViewChange('clients')
    }, {
      description: `Hay ${unsavedChangesContext ?? 'cambios sin guardar'}. Si abres este cliente ahora, perderas esos cambios.`,
      confirmLabel: 'Abrir cliente',
    })
  }, [commitViewChange, runWithNavigationGuard, unsavedChangesContext])

  const handleOpenPropertyWorkspace = useCallback((propertyId: string, tab: PropertyWorkspaceTab = 'summary') => {
    runWithNavigationGuard(() => {
      setPropertyWorkspaceLocation({ propertyId, tab })
      commitViewChange('properties')
    }, {
      description: `Hay ${unsavedChangesContext ?? 'cambios sin guardar'}. Si abres esta propiedad ahora, perderas esos cambios.`,
      confirmLabel: 'Abrir propiedad',
    })
  }, [commitViewChange, runWithNavigationGuard, unsavedChangesContext])

  const handleOpenJobWorkspace = useCallback((jobId: string, tab: JobWorkspaceTab = 'summary') => {
    runWithNavigationGuard(() => {
      setModuleFilters((current) => ({
        ...current,
        jobs: null,
      }))
      setJobWorkspaceLocation({ jobId, tab })
      commitViewChange('jobs')
    }, {
      description: `Hay ${unsavedChangesContext ?? 'cambios sin guardar'}. Si abres este servicio ahora, perderas esos cambios.`,
      confirmLabel: 'Abrir servicio',
    })
  }, [commitViewChange, runWithNavigationGuard, unsavedChangesContext])

  const handleOpenInvoiceDetail = useCallback((invoiceId: string) => {
    const invoice = invoicesWithCodes.find((entry) => entry.id === invoiceId)
    const invoiceLabel = invoice
      ? formatInvoiceLabel(invoice)
      : invoiceId

    runWithNavigationGuard(() => {
      setModuleFilters((current) => ({
        ...current,
        invoices: {
          type: 'invoice',
          invoiceId,
          invoiceLabel,
        },
      }))
      commitViewChange('invoices')
    }, {
      description: `Hay ${unsavedChangesContext ?? 'cambios sin guardar'}. Si abres esta factura ahora, perderas esos cambios.`,
      confirmLabel: 'Abrir factura',
    })
  }, [commitViewChange, invoicesWithCodes, runWithNavigationGuard, unsavedChangesContext])

  const handleOpenQuoteDetail = useCallback((quoteId: string) => {
    const quote = quotesWithCodes.find((entry) => entry.id === quoteId)
    const quoteLabel = quote
      ? formatQuoteLabel(quote)
      : quoteId

    runWithNavigationGuard(() => {
      setModuleFilters((current) => ({
        ...current,
        quotes: {
          type: 'quote',
          quoteId,
          quoteLabel,
        },
      }))
      commitViewChange('quotes')
    }, {
      description: `Hay ${unsavedChangesContext ?? 'cambios sin guardar'}. Si abres este presupuesto ahora, perderas esos cambios.`,
      confirmLabel: 'Abrir presupuesto',
    })
  }, [commitViewChange, quotesWithCodes, runWithNavigationGuard, unsavedChangesContext])

  const handleViewPaymentsForInvoice = useCallback((invoiceId: string) => {
    const invoice = invoicesWithCodes.find((entry) => entry.id === invoiceId)
    const invoiceLabel = invoice
      ? formatInvoiceLabel(invoice)
      : invoiceId

    runWithNavigationGuard(() => {
      setModuleFilters((current) => ({
        ...current,
        payments: {
          type: 'invoice',
          invoiceId,
          invoiceLabel,
        },
      }))
      commitViewChange('payments')
    }, {
      description: `Hay ${unsavedChangesContext ?? 'cambios sin guardar'}. Si abres los cobros ahora, perderas esos cambios.`,
      confirmLabel: 'Abrir cobros',
    })
  }, [commitViewChange, invoicesWithCodes, runWithNavigationGuard, unsavedChangesContext])

  const handleRunOperationalAction = useCallback(async (action: OperationalAction) => {
    if (action.kind === 'module_view') {
      runWithNavigationGuard(() => {
        setModuleFilters((current) => ({
          ...current,
          [action.filterKey]: action.filterValue,
        }))
        commitViewChange(action.view)
      }, {
        description: `Hay ${unsavedChangesContext ?? 'cambios sin guardar'}. Si abres esta vista ahora, perderas esos cambios.`,
        confirmLabel: action.label,
      })
      return
    }

    if (action.kind === 'open_client_workspace') {
      handleOpenClientWorkspace(action.clientId, action.tab ?? 'summary')
      return
    }

    if (action.kind === 'open_property_workspace') {
      handleOpenPropertyWorkspace(action.propertyId, action.tab ?? 'summary')
      return
    }

    if (action.kind === 'open_job_workspace') {
      handleOpenJobWorkspace(action.jobId, action.tab ?? 'summary')
      return
    }

    if (action.kind === 'open_invoice_detail') {
      handleOpenInvoiceDetail(action.invoiceId)
      return
    }

    if (action.kind === 'open_quote_detail') {
      handleOpenQuoteDetail(action.quoteId)
      return
    }

    if (action.kind === 'open_invoice_payments') {
      handleViewPaymentsForInvoice(action.invoiceId)
      return
    }

    if (action.kind === 'create_job_from_quote') {
      const quote = quotesWithCodes.find((entry) => entry.id === action.quoteId)
      if (quote) {
        handleCreateJobFromQuote(quote)
      }
      return
    }

    if (action.kind === 'settle_invoice_by_transfer') {
      try {
        const result = await settleInvoiceByTransfer(action.invoiceId)
        await reloadInvoicesAndPayments()
        setOperationalToast({
          title: result.created_payment ? 'Cobro registrado por transferencia' : 'Factura ya cubierta',
          summary: result.created_payment
            ? 'Se liquido el pendiente exacto y el estado financiero se sincronizo.'
            : 'No fue necesario crear un nuevo cobro porque la factura ya estaba cubierta.',
        })
      } catch (error) {
        setOperationalToast({
          title: 'No se pudo registrar el cobro',
          summary: error instanceof Error ? error.message : 'Error desconocido.',
        })
      }
      return
    }

    if (action.kind === 'emit_recurring_plan') {
      try {
        await generateInvoiceFromRecurringPlan(action.planId)
        await refreshBilling()
        setOperationalToast({
          title: 'Factura recurrente emitida',
          summary: 'La automatizacion genero la factura y actualizo su siguiente emision.',
        })
      } catch (error) {
        setOperationalToast({
          title: 'No se pudo emitir la recurrente',
          summary: error instanceof Error ? error.message : 'Error desconocido.',
        })
      }
      return
    }

    if (action.kind === 'resume_recurring_plan') {
      const plan = recurringInvoicePlansWithCodes.find((entry) => entry.id === action.planId)
      if (!plan) return

      try {
        await saveRecurringInvoicePlan(buildRecurringPlanPersistenceInput(plan, { status: 'active' }))
        await refreshBilling()
        setOperationalToast({
          title: 'Automatizacion reanudada',
          summary: 'El plan vuelve a estar activo y listo para su siguiente ciclo.',
        })
      } catch (error) {
        setOperationalToast({
          title: 'No se pudo reanudar la automatizacion',
          summary: error instanceof Error ? error.message : 'Error desconocido.',
        })
      }
    }
  }, [
    commitViewChange,
    handleCreateJobFromQuote,
    handleOpenClientWorkspace,
    handleOpenInvoiceDetail,
    handleOpenJobWorkspace,
    handleOpenPropertyWorkspace,
    handleOpenQuoteDetail,
    handleViewPaymentsForInvoice,
    quotesWithCodes,
    recurringInvoicePlansWithCodes,
    refreshBilling,
    reloadInvoicesAndPayments,
    runWithNavigationGuard,
    unsavedChangesContext,
  ])

  const clearModuleFilter = useCallback((filterKey: keyof ModuleFilterState) => {
    setModuleFilters((current) => ({
      ...current,
      [filterKey]: null,
    }))
  }, [])

  const handleScrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return (
    <main className={compactMobileNav ? 'app-shell app-shell--mobile-scrolled' : 'app-shell'}>
      <section className="hero-card cc-shell cc-shell-frame">
        <AppNav
          currentView={currentView}
          onChangeView={navigateToView}
          compactMobile={compactMobileNav}
          syncStatus={syncStatus}
          alerts={automationAlerts}
          reviewedAlertIds={activeReviewedAlertIds}
          onOpenAlert={handleOpenAutomationAlert}
          onOpenAlertsCenter={() => navigateToView('alerts')}
          theme={theme}
          onToggleTheme={onToggleTheme}
          backTargetView={navigationBackTarget}
          onBack={navigateBack}
        />
        <div className="cc-shell-content">
          {isInitialDataLoading ? (
            <ShellLoadingState currentView={currentView} />
          ) : (
            <Suspense fallback={<ShellLoadingState currentView={currentView} />}>
              {currentView === 'alerts' ? (
                <AlertsCenterPage
                  alerts={automationAlerts}
                  reviewedAlertIds={activeReviewedAlertIds}
                  onToggleReviewed={handleToggleReviewedAlert}
                  onOpenAlert={handleOpenAutomationAlert}
                />
              ) : currentView === 'annual_closing' ? (
                <AnnualClosingPage
                  availableYears={availableAnnualClosingYears}
                  defaultFiscalYear={currentFiscalYear}
                  summaryByYear={annualClosingSummaryByYear}
                  closings={annualClosings}
                  invoices={invoicesWithCodes}
                  payments={paymentsWithCodes}
                  expenses={expenses}
                  error={annualClosingError}
                  onNavigateToIncidence={handleAnnualClosingNavigation}
                  onOpenQuarter={handleOpenQuarterFromAnnual}
                  onSaveClosing={handleSaveAnnualClosing}
                />
              ) : currentView === 'quarterly_closing' ? (
                <QuarterlyClosingPage
                  availableYears={availableClosingYears}
                  defaultFiscalYear={quarterlyClosingFocus?.fiscalYear ?? currentFiscalYear}
                  defaultFiscalQuarter={quarterlyClosingFocus?.fiscalQuarter ?? currentFiscalQuarter}
                  summaryByPeriod={quarterlyClosingSummaryByPeriod}
                  closings={quarterlyClosings}
                  invoices={invoicesWithCodes}
                  payments={paymentsWithCodes}
                  expenses={expenses}
                  error={quarterlyClosingError}
                  onNavigateToIncidence={handleQuarterlyClosingNavigation}
                  onSaveClosing={handleSaveQuarterlyClosing}
                />
              ) : currentView === 'dashboard' ? (
                <HomePage
                  metrics={dashboardMetrics}
                  agenda={dashboardAgenda}
                  clientBalanceLeaders={clientBalanceLeaders}
                  dueRecurringPlans={dueRecurringPlansPreview}
                  onOpenJobWorkspace={handleOpenJobWorkspace}
                  onOpenClientWorkspace={handleOpenClientWorkspace}
                  onOpenView={navigateToView}
                  onRunKpiAction={handleDashboardKpiAction}
                  alerts={automationAlerts}
                  onOpenAlert={handleOpenAutomationAlert}
                  operationalIncidents={operationalIncidents}
                  operationalQuickViews={operationalQuickViews}
                  onRunOperationalAction={handleRunOperationalAction}
                />
              ) : currentView === 'leads' ? (
                <LeadsPage leads={leads} leadDrafts={leadDrafts} clients={clients} error={leadError ?? leadDraftError} onLeadCreated={refreshOperations} onLeadConverted={reloadLeadsAndClients} />
              ) : currentView === 'clients' ? (
                <ClientsPage
                  clients={clientsWithContext}
                  properties={propertiesWithCodes}
                  jobs={jobsWithCodes}
                  quotes={quotesWithCodes}
                  invoices={invoicesWithCodes}
                  payments={paymentsWithCodes}
                    recurringInvoicePlans={recurringInvoicePlansWithCodes}
                  error={clientError}
                  onClientCreated={async () => {
                    await Promise.all([
                      refreshOperations(),
                      reloadInvoicesAndPayments(),
                    ])
                  }}
                  onOpenPropertyWorkspace={handleOpenPropertyWorkspace}
                  onOpenJobWorkspace={handleOpenJobWorkspace}
                  onOpenQuoteDetail={handleOpenQuoteDetail}
                  onOpenInvoiceDetail={handleOpenInvoiceDetail}
                  onUnsavedChange={updateUnsavedChanges}
                  confirmNavigation={runWithNavigationGuard}
                />
                ) : currentView === 'properties' ? (
                  <PropertiesPage
                    properties={propertiesWithCodes}
                    clients={clientsWithContext}
                    jobs={jobsWithCodes}
                    quotes={quotesWithCodes}
                    invoices={invoicesWithCodes}
                    payments={paymentsWithCodes}
                    error={propertyError}
                    onPropertyCreated={refreshOperations}
                    onOpenClientWorkspace={handleOpenClientWorkspace}
                    onOpenJobWorkspace={handleOpenJobWorkspace}
                    onOpenQuoteDetail={handleOpenQuoteDetail}
                    onOpenInvoiceDetail={handleOpenInvoiceDetail}
                    onUnsavedChange={updateUnsavedChanges}
                    confirmNavigation={runWithNavigationGuard}
                  />
              ) : currentView === 'quotes' ? (
                <QuotesPage
                  quotes={filteredQuotes}
                  clients={clientsWithContext}
                  properties={properties}
                  error={quoteError}
                  onQuoteCreated={refreshOperations}
                  onCreateJobFromQuote={handleCreateJobFromQuote}
                  activeFilterLabel={getQuoteFilterLabel(moduleFilters.quotes)}
                  onClearFilter={() => clearModuleFilter('quotes')}
                  onUnsavedChange={updateUnsavedChanges}
                  confirmNavigation={runWithNavigationGuard}
                />
              ) : currentView === 'jobs' ? (
                <JobsPage
                  jobs={filteredJobs}
                  clients={clientsWithContext}
                  properties={properties}
                  quotes={quotes}
                  invoices={invoicesWithCodes}
                  payments={paymentsWithCodes}
                  error={jobError}
                  onJobCreated={refreshOperations}
                  onOpenClientWorkspace={handleOpenClientWorkspace}
                  onOpenPropertyWorkspace={handleOpenPropertyWorkspace}
                  onOpenQuoteDetail={handleOpenQuoteDetail}
                  onOpenInvoiceDetail={handleOpenInvoiceDetail}
                  createPrefill={jobCreatePrefill}
                  onPrefillConsumed={() => setJobCreatePrefill(null)}
                  activeFilterLabel={getJobFilterLabel(moduleFilters.jobs)}
                  onClearFilter={() => clearModuleFilter('jobs')}
                  onUnsavedChange={updateUnsavedChanges}
                  confirmNavigation={runWithNavigationGuard}
                />
              ) : currentView === 'invoices' ? (
                <InvoicesPage
                  invoices={filteredInvoices}
                  clients={clientsWithContext}
                  properties={properties}
                  jobs={jobsWithCodes}
                  quotes={quotesWithCodes}
                  payments={paymentsWithCodes}
                  error={invoiceError}
                  onInvoiceCreated={refreshBilling}
                  onViewPayments={handleViewPaymentsForInvoice}
                  onOpenJobWorkspace={handleOpenJobWorkspace}
                  onOpenClientWorkspace={handleOpenClientWorkspace}
                  onOpenPropertyWorkspace={handleOpenPropertyWorkspace}
                  onOpenQuoteDetail={handleOpenQuoteDetail}
                  createPrefill={invoiceCreatePrefill}
                  onPrefillConsumed={() => setInvoiceCreatePrefill(null)}
                  activeFilterLabel={getInvoiceFilterLabel(moduleFilters.invoices)}
                  onClearFilter={() => clearModuleFilter('invoices')}
                  onUnsavedChange={updateUnsavedChanges}
                  confirmNavigation={runWithNavigationGuard}
                />
              ) : currentView === 'expenses' ? (
                <ExpensesPage
                  expenses={filteredExpenses}
                  error={expenseError}
                  onExpenseCreated={refreshBilling}
                  activeFilterLabel={getExpenseFilterLabel(moduleFilters.expenses)}
                  onClearFilter={() => clearModuleFilter('expenses')}
                  onUnsavedChange={updateUnsavedChanges}
                  confirmNavigation={runWithNavigationGuard}
                />
              ) : (
                <PaymentsPage
                  payments={filteredPayments}
                  invoices={invoicesWithCodes}
                  clients={clientsWithContext}
                  properties={properties}
                  jobs={jobsWithCodes}
                  quotes={quotesWithCodes}
                  error={paymentError}
                  onPaymentCreated={reloadInvoicesAndPayments}
                  onOpenInvoiceDetail={handleOpenInvoiceDetail}
                  onOpenClientWorkspace={handleOpenClientWorkspace}
                  activeFilterLabel={getPaymentFilterLabel(moduleFilters.payments)}
                  onClearFilter={() => clearModuleFilter('payments')}
                  onUnsavedChange={updateUnsavedChanges}
                  confirmNavigation={runWithNavigationGuard}
                />
              )}
            </Suspense>
          )}
        </div>
      </section>
      <button
        type="button"
        className={showScrollTop ? 'cc-scroll-top is-visible' : 'cc-scroll-top'}
        onClick={handleScrollToTop}
        aria-label="Volver arriba"
      >
        <span aria-hidden="true">↑</span>
      </button>
      {operationalToast ? (
        <div className="cc-realtime-toast" role="status" aria-live="polite" aria-atomic="true">
          <span>Operativa</span>
          <strong>{operationalToast.title}</strong>
          <p>{operationalToast.summary}</p>
        </div>
      ) : null}
      {latestIntakeNotification ? (
        <div className="cc-realtime-toast" role="status" aria-live="polite" aria-atomic="true">
          <span>Nueva entrada</span>
          <strong>{latestIntakeNotification.title}</strong>
          <p>{latestIntakeNotification.summary}</p>
        </div>
      ) : null}
      <ConfirmDialog
        isOpen={Boolean(pendingGuardedAction)}
        title={pendingGuardedAction?.title ?? 'Salir sin guardar'}
        description={pendingGuardedAction?.description ?? 'Hay cambios sin guardar. Si continúas, perderás esos cambios.'}
        confirmLabel={pendingGuardedAction?.confirmLabel ?? 'Salir sin guardar'}
        tone="warning"
        onCancel={() => setPendingGuardedAction(null)}
        onConfirm={handleConfirmGuardedAction}
      />
    </main>
  )
}
