import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppNav } from './AppNav'
import '../features/shell/shell-dashboard.css'
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
import { HomePage } from '../pages/HomePage'
import { LeadsPage } from '../pages/LeadsPage'
import { ClientsPage } from '../pages/ClientsPage'
import { PropertiesPage } from '../pages/PropertiesPage'
import { QuotesPage } from '../pages/QuotesPage'
import { JobsPage } from '../pages/JobsPage'
import { InvoicesPage } from '../pages/InvoicesPage'
import { ExpensesPage } from '../pages/ExpensesPage'
import { PaymentsPage } from '../pages/PaymentsPage'
import { QuarterlyClosingPage } from '../pages/QuarterlyClosingPage'
import { AnnualClosingPage } from '../pages/AnnualClosingPage'
import { AlertsCenterPage } from '../pages/AlertsCenterPage'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { PropertyListItem } from '../features/properties/types'
import { buildJobCreatePrefillFromQuote } from '../features/jobs/jobCreatePrefill'
import type { QuoteListItem } from '../features/quotes/types'
import type { JobListItem } from '../features/jobs/types'
import { buildInvoiceCreatePrefillFromJob } from '../features/invoices/invoiceCreatePrefill'
import type { InvoiceListItem } from '../features/invoices/types'
import {
  applyDashboardKpiAction,
  dashboardKpiActionConfig,
  type DashboardKpiActionId,
} from '../features/dashboard/kpiActions'
import { saveQuarterlyClosing } from '../features/quarterlyClosing/quarterlyClosingApi'
import { buildQuarterlyClosingSnapshot } from '../features/quarterlyClosing/quarterlyClosingSummary'
import type { QuarterlyClosingIncidence } from '../features/quarterlyClosing/types'
import { saveAnnualClosing } from '../features/annualClosing/annualClosingApi'
import { buildAnnualClosingSnapshot } from '../features/annualClosing/annualClosingSummary'
import type { AnnualClosingIncidence } from '../features/annualClosing/types'
import { buildAutomationAlerts } from '../features/automation/alertRules'
import type { AutomationAlertItem } from '../features/automation/types'

const reviewedAlertsStorageKey = 'costaclean-reviewed-alerts'

interface AppShellProps {
  theme: AppTheme
  onToggleTheme: () => void
}

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
  invoice: InvoiceListItem,
  job: JobListItem | undefined,
  property: PropertyListItem | undefined,
): string | null {
  const parts = [
    invoice.job_display_code ?? job?.display_code ?? invoice.job_id ?? null,
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

  const clientCodeById = useMemo(() => new Map(clients.map((client) => [client.id, client.display_code ?? client.id])), [clients])
  const clientById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients])
  const propertyCodeById = useMemo(() => new Map(properties.map((property) => [property.id, property.display_code ?? property.id])), [properties])
  const propertyById = useMemo(() => new Map(properties.map((property) => [property.id, property])), [properties])
  const quoteCodeById = useMemo(() => new Map(quotes.map((quote) => [quote.id, quote.display_code ?? quote.id])), [quotes])
  const quoteById = useMemo(() => new Map(quotes.map((quote) => [quote.id, quote])), [quotes])
  const jobCodeById = useMemo(() => new Map(jobs.map((job) => [job.id, job.display_code ?? job.id])), [jobs])
  const jobById = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs])
  const invoiceById = useMemo(() => new Map(invoices.map((invoice) => [invoice.id, invoice])), [invoices])

  const dashboardMetrics = useDashboardMetrics({
    leads,
    clients,
    properties,
    quotes,
    jobs,
    invoices,
    expenses,
    payments,
  })

  const propertiesWithCodes = useMemo(
    () => properties.map((property) => ({ ...property, client_display_code: clientCodeById.get(property.client_id) ?? property.client_id })),
    [properties, clientCodeById],
  )

  const quotesWithCodes = useMemo(
    () => quotes.map((quote) => ({
      ...quote,
      client_display_code: clientCodeById.get(quote.client_id) ?? quote.client_id,
      property_display_code: quote.property_id ? propertyCodeById.get(quote.property_id) ?? quote.property_id : null,
      job_id: jobs.find((job) => job.quote_id === quote.id)?.id ?? null,
    })),
    [quotes, jobs, clientCodeById, propertyCodeById],
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
      const client = clientById.get(invoice.client_id)
      const job = invoice.job_id ? jobById.get(invoice.job_id) : undefined
      const property = job?.property_id ? propertyById.get(job.property_id) : undefined
      const quote = job?.quote_id ? quoteById.get(job.quote_id) : undefined

      return {
        ...invoice,
        client_display_code: clientCodeById.get(invoice.client_id) ?? invoice.client_id,
        job_display_code: invoice.job_id ? jobCodeById.get(invoice.job_id) ?? invoice.job_id : null,
        client_name: client?.full_name ?? null,
        client_phone: client?.phone ?? null,
        client_email: client?.email ?? null,
        property_id: property?.id ?? job?.property_id ?? quote?.property_id ?? null,
        property_display_code: property?.display_code ?? (job?.property_id ? propertyCodeById.get(job.property_id) ?? job.property_id : null),
        property_name: property?.name ?? null,
        property_address_line: buildPropertyAddressLine(property),
        quote_id: job?.quote_id ?? null,
        service_reference: buildServiceReference(invoice, job, property),
        service_description: buildServiceDescription(job, property),
        billing_concept: invoice.billing_concept ?? job?.billing_concept ?? null,
        billing_quantity: invoice.billing_quantity ?? job?.billing_quantity ?? null,
        billing_unit: invoice.billing_unit ?? job?.billing_unit ?? null,
        billing_unit_price: invoice.billing_unit_price ?? job?.billing_unit_price ?? null,
        lines: normalizeInvoiceLines(invoice),
      }
    }),
    [invoices, clientById, clientCodeById, jobById, jobCodeById, propertyById, propertyCodeById, quoteById],
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
      }),
    [expenses, invoicesWithCodes, jobsWithCodes, leadDrafts, paymentsWithCodes, quarterlyClosings, quotesWithCodes],
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

  const handleCreateInvoiceFromJob = useCallback((job: JobListItem) => {
    const prefill = buildInvoiceCreatePrefillFromJob(job)
    if (!prefill) {
      return
    }

    runWithNavigationGuard(() => {
      setInvoiceCreatePrefill(prefill)
      commitViewChange('invoices')
    }, {
      description: `Hay ${unsavedChangesContext ?? 'cambios sin guardar'}. Si creas la factura desde este servicio ahora, perderás esos cambios.`,
      confirmLabel: 'Crear factura',
    })
  }, [commitViewChange, runWithNavigationGuard, unsavedChangesContext])

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
          ) : currentView === 'alerts' ? (
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
              onOpenView={navigateToView}
              onRunKpiAction={handleDashboardKpiAction}
              alerts={automationAlerts}
              onOpenAlert={handleOpenAutomationAlert}
            />
          ) : currentView === 'leads' ? (
            <LeadsPage leads={leads} leadDrafts={leadDrafts} clients={clients} error={leadError ?? leadDraftError} onLeadCreated={refreshOperations} onLeadConverted={reloadLeadsAndClients} />
          ) : currentView === 'clients' ? (
            <ClientsPage clients={clients} error={clientError} onClientCreated={refreshOperations} />
          ) : currentView === 'properties' ? (
            <PropertiesPage properties={propertiesWithCodes} clients={clients} error={propertyError} onPropertyCreated={refreshOperations} />
          ) : currentView === 'quotes' ? (
            <QuotesPage
              quotes={filteredQuotes}
              clients={clients}
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
              clients={clients}
              properties={properties}
              quotes={quotes}
              error={jobError}
              onJobCreated={refreshOperations}
              onCreateInvoiceFromJob={handleCreateInvoiceFromJob}
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
              jobs={jobsWithCodes}
              quotes={quotesWithCodes}
              error={invoiceError}
              onInvoiceCreated={refreshBilling}
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
              error={paymentError}
              onPaymentCreated={reloadInvoicesAndPayments}
              activeFilterLabel={getPaymentFilterLabel(moduleFilters.payments)}
              onClearFilter={() => clearModuleFilter('payments')}
              onUnsavedChange={updateUnsavedChanges}
              confirmNavigation={runWithNavigationGuard}
            />
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
