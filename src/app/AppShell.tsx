import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppNav } from './AppNav'
import '../features/shell/shell-dashboard.css'
import type { AppView } from './navigation'
import type { SyncStatus } from './syncStatus'
import type { AppTheme } from './theme'
import { useDashboardMetrics } from './dashboardMetrics'
import { useClosingSummaries } from './useClosingSummaries'
import { useShellNavigation } from './useShellNavigation'
import {
  combineRefreshScopes,
  getRefreshScopeForTable,
  isBrowserOnline,
  realtimeTables,
  type RefreshScope,
} from './refreshInvalidation'
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
import type { LeadListItem } from '../features/leads/types'
import type { ClientListItem } from '../features/clients/types'
import type { PropertyListItem } from '../features/properties/types'
import { buildJobCreatePrefillFromQuote, type JobCreatePrefill } from '../features/jobs/jobCreatePrefill'
import type { QuoteListItem } from '../features/quotes/types'
import type { JobListItem } from '../features/jobs/types'
import { buildInvoiceCreatePrefillFromJob, type InvoiceCreatePrefill } from '../features/invoices/invoiceCreatePrefill'
import type { InvoiceListItem } from '../features/invoices/types'
import type { ExpenseListItem } from '../features/expenses/types'
import { listExpenses } from '../features/expenses/expenseApi'
import type { PaymentListItem } from '../features/payments/types'
import {
  applyDashboardKpiAction,
  dashboardKpiActionConfig,
  type DashboardKpiActionId,
} from '../features/dashboard/kpiActions'
import { listQuarterlyClosings, saveQuarterlyClosing } from '../features/quarterlyClosing/quarterlyClosingApi'
import { buildQuarterlyClosingSnapshot } from '../features/quarterlyClosing/quarterlyClosingSummary'
import type { QuarterlyClosingIncidence, QuarterlyClosingRecord } from '../features/quarterlyClosing/types'
import { listAnnualClosings, saveAnnualClosing } from '../features/annualClosing/annualClosingApi'
import { buildAnnualClosingSnapshot } from '../features/annualClosing/annualClosingSummary'
import type { AnnualClosingIncidence, AnnualClosingRecord } from '../features/annualClosing/types'
import { buildAutomationAlerts } from '../features/automation/alertRules'
import type { AutomationAlertItem } from '../features/automation/types'
import { getSupabaseClient } from '../lib/supabase'

const reviewedAlertsStorageKey = 'costaclean-reviewed-alerts'
const foregroundRefreshStaleTimeMs = 30_000
const realtimeRefreshDelayMs = 900

interface AppShellProps {
  theme: AppTheme
  onToggleTheme: () => void
}

function normalizeInvoiceLines(invoice: InvoiceListItem): InvoiceListItem['lines'] {
  return [...(invoice.lines?.length ? invoice.lines : invoice.invoice_lines ?? [])].sort(
    (left, right) => Number(left.sort_order) - Number(right.sort_order),
  )
}

function groupInvoiceLines(lines: NonNullable<InvoiceListItem['lines']>) {
  const linesByInvoiceId = new Map<string, NonNullable<InvoiceListItem['lines']>>()

  for (const line of lines) {
    const currentLines = linesByInvoiceId.get(line.invoice_id) ?? []
    currentLines.push(line)
    linesByInvoiceId.set(line.invoice_id, currentLines)
  }

  for (const invoiceLines of linesByInvoiceId.values()) {
    invoiceLines.sort((left, right) => Number(left.sort_order) - Number(right.sort_order))
  }

  return linesByInvoiceId
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
    invoice.job_display_code ?? job?.display_code ?? invoice.job_id,
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
  const [isInitialDataLoading, setIsInitialDataLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => (isBrowserOnline() ? 'fresh' : 'offline'))
  const [moduleFilters, setModuleFilters] = useState<ModuleFilterState>(emptyModuleFilterState)
  const [quarterlyClosingFocus, setQuarterlyClosingFocus] = useState<{ fiscalYear: number; fiscalQuarter: number } | null>(null)
  const [jobCreatePrefill, setJobCreatePrefill] = useState<JobCreatePrefill | null>(null)
  const [invoiceCreatePrefill, setInvoiceCreatePrefill] = useState<InvoiceCreatePrefill | null>(null)
  const [leads, setLeads] = useState<LeadListItem[]>([])
  const [clients, setClients] = useState<ClientListItem[]>([])
  const [properties, setProperties] = useState<PropertyListItem[]>([])
  const [quotes, setQuotes] = useState<QuoteListItem[]>([])
  const [jobs, setJobs] = useState<JobListItem[]>([])
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([])
  const [expenses, setExpenses] = useState<ExpenseListItem[]>([])
  const [payments, setPayments] = useState<PaymentListItem[]>([])
  const [quarterlyClosings, setQuarterlyClosings] = useState<QuarterlyClosingRecord[]>([])
  const [annualClosings, setAnnualClosings] = useState<AnnualClosingRecord[]>([])
  const [leadError, setLeadError] = useState<string | null>(null)
  const [clientError, setClientError] = useState<string | null>(null)
  const [propertyError, setPropertyError] = useState<string | null>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [jobError, setJobError] = useState<string | null>(null)
  const [invoiceError, setInvoiceError] = useState<string | null>(null)
  const [expenseError, setExpenseError] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [quarterlyClosingError, setQuarterlyClosingError] = useState<string | null>(null)
  const [annualClosingError, setAnnualClosingError] = useState<string | null>(null)
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
  const lastRefreshAtRef = useRef(0)
  const isRefreshingRef = useRef(false)
  const pendingRealtimeRefreshRef = useRef<number | null>(null)
  const pendingRealtimeScopeRef = useRef<RefreshScope | null>(null)

  const loadLeads = useCallback(async () => {
    try {
      setLeadError(null)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      if (!supabaseUrl || !supabaseAnonKey) {
        setLeadError('Faltan las variables de entorno de Supabase.')
        return
      }
      const response = await fetch(`${supabaseUrl}/rest/v1/leads?select=id,display_code,full_name,phone,email,city,status,archived_at&order=created_at.desc`, {
        method: 'GET',
        headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
      })
      if (!response.ok) {
        setLeadError(`REST ${response.status}: ${response.statusText}`)
        return
      }
      setLeads(((await response.json()) as LeadListItem[]) ?? [])
    } catch (err) {
      setLeadError(err instanceof Error ? err.message : 'Error desconocido cargando leads.')
    }
  }, [])

  const loadClients = useCallback(async () => {
    try {
      setClientError(null)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      if (!supabaseUrl || !supabaseAnonKey) {
        setClientError('Faltan las variables de entorno de Supabase.')
        return
      }
      const response = await fetch(`${supabaseUrl}/rest/v1/clients?select=id,display_code,full_name,phone,email,status,source_lead_id&order=created_at.desc`, {
        method: 'GET',
        headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
      })
      if (!response.ok) {
        setClientError(`REST ${response.status}: ${response.statusText}`)
        return
      }
      setClients(((await response.json()) as ClientListItem[]) ?? [])
    } catch (err) {
      setClientError(err instanceof Error ? err.message : 'Error desconocido cargando clients.')
    }
  }, [])

  const loadProperties = useCallback(async () => {
    try {
      setPropertyError(null)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      if (!supabaseUrl || !supabaseAnonKey) {
        setPropertyError('Faltan las variables de entorno de Supabase.')
        return
      }
      const response = await fetch(`${supabaseUrl}/rest/v1/properties?select=id,display_code,client_id,name,property_type,address,city,postal_code,notes&order=created_at.desc`, {
        method: 'GET',
        headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
      })
      if (!response.ok) {
        setPropertyError(`REST ${response.status}: ${response.statusText}`)
        return
      }
      setProperties(((await response.json()) as PropertyListItem[]) ?? [])
    } catch (err) {
      setPropertyError(err instanceof Error ? err.message : 'Error desconocido cargando properties.')
    }
  }, [])

  const loadQuotes = useCallback(async () => {
    try {
      setQuoteError(null)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      if (!supabaseUrl || !supabaseAnonKey) {
        setQuoteError('Faltan las variables de entorno de Supabase.')
        return
      }
      const response = await fetch(`${supabaseUrl}/rest/v1/quotes?select=id,display_code,client_id,property_id,status,subtotal,tax_amount,total,notes,created_at&order=created_at.desc`, {
        method: 'GET',
        headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
      })
      if (!response.ok) {
        setQuoteError(`REST ${response.status}: ${response.statusText}`)
        return
      }
      setQuotes(((await response.json()) as QuoteListItem[]) ?? [])
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : 'Error desconocido cargando quotes.')
    }
  }, [])

  const loadJobs = useCallback(async () => {
    try {
      setJobError(null)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      if (!supabaseUrl || !supabaseAnonKey) {
        setJobError('Faltan las variables de entorno de Supabase.')
        return
      }
      const response = await fetch(`${supabaseUrl}/rest/v1/jobs?select=id,display_code,client_id,property_id,quote_id,scheduled_date,status,service_type,billing_concept,billing_quantity,billing_unit,billing_unit_price,notes&order=created_at.desc`, {
        method: 'GET',
        headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
      })
      if (!response.ok) {
        setJobError(`REST ${response.status}: ${response.statusText}`)
        return
      }
      setJobs(((await response.json()) as JobListItem[]) ?? [])
    } catch (err) {
      setJobError(err instanceof Error ? err.message : 'Error desconocido cargando jobs.')
    }
  }, [])

  const loadInvoices = useCallback(async () => {
    try {
      setInvoiceError(null)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      if (!supabaseUrl || !supabaseAnonKey) {
        setInvoiceError('Faltan las variables de entorno de Supabase.')
        return
      }
      const response = await fetch(`${supabaseUrl}/rest/v1/invoices?select=id,display_code,invoice_number,job_id,client_id,issue_date,status,subtotal,tax_amount,total,notes&order=created_at.desc`, {
        method: 'GET',
        headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
      })
      if (!response.ok) {
        setInvoiceError(`REST ${response.status}: ${response.statusText}`)
        return
      }
      const loadedInvoices = ((await response.json()) as InvoiceListItem[]) ?? []

      const linesResponse = await fetch(`${supabaseUrl}/rest/v1/invoice_lines?select=id,invoice_id,sort_order,concept,quantity,unit,unit_price,line_subtotal,created_at&order=sort_order.asc`, {
        method: 'GET',
        headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
      })
      if (!linesResponse.ok) {
        setInvoiceError(`REST ${linesResponse.status}: ${linesResponse.statusText}`)
        return
      }

      const linesByInvoiceId = groupInvoiceLines(((await linesResponse.json()) as NonNullable<InvoiceListItem['lines']>) ?? [])
      setInvoices(loadedInvoices.map((invoice) => ({
        ...invoice,
        lines: linesByInvoiceId.get(invoice.id) ?? [],
      })))
    } catch (err) {
      setInvoiceError(err instanceof Error ? err.message : 'Error desconocido cargando invoices.')
    }
  }, [])

  const loadExpenses = useCallback(async () => {
    try {
      setExpenseError(null)
      const data = await listExpenses()
      setExpenses(data)
    } catch (err) {
      setExpenseError(err instanceof Error ? err.message : 'Error desconocido cargando expenses.')
    }
  }, [])

  const loadPayments = useCallback(async () => {
    try {
      setPaymentError(null)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      if (!supabaseUrl || !supabaseAnonKey) {
        setPaymentError('Faltan las variables de entorno de Supabase.')
        return
      }
      const response = await fetch(`${supabaseUrl}/rest/v1/payments?select=id,display_code,invoice_id,payment_date,amount,payment_method,notes&order=created_at.desc`, {
        method: 'GET',
        headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
      })
      if (!response.ok) {
        setPaymentError(`REST ${response.status}: ${response.statusText}`)
        return
      }
      setPayments(((await response.json()) as PaymentListItem[]) ?? [])
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Error desconocido cargando payments.')
    }
  }, [])

  const loadQuarterlyClosings = useCallback(async () => {
    try {
      setQuarterlyClosingError(null)
      const data = await listQuarterlyClosings()
      setQuarterlyClosings(data)
    } catch (err) {
      setQuarterlyClosingError(err instanceof Error ? err.message : 'Error desconocido cargando cierres trimestrales.')
    }
  }, [])

  const loadAnnualClosings = useCallback(async () => {
    try {
      setAnnualClosingError(null)
      const data = await listAnnualClosings()
      setAnnualClosings(data)
    } catch (err) {
      setAnnualClosingError(err instanceof Error ? err.message : 'Error desconocido cargando cierres anuales.')
    }
  }, [])

  const runRefresh = useCallback(async (loaders: Array<() => Promise<void>>) => {
    if (!isBrowserOnline()) {
      setSyncStatus('offline')
      return
    }

    if (isRefreshingRef.current) {
      return
    }

    isRefreshingRef.current = true
    setSyncStatus('syncing')

    try {
      await Promise.all(loaders.map((loader) => loader()))
      lastRefreshAtRef.current = Date.now()
      setSyncStatus('fresh')
    } finally {
      isRefreshingRef.current = false
    }
  }, [])

  const refreshAll = useCallback(async () => {
    await runRefresh([
      loadLeads,
      loadClients,
      loadProperties,
      loadQuotes,
      loadJobs,
      loadInvoices,
      loadExpenses,
      loadPayments,
      loadQuarterlyClosings,
      loadAnnualClosings,
    ])
  }, [loadAnnualClosings, loadClients, loadExpenses, loadInvoices, loadJobs, loadLeads, loadPayments, loadProperties, loadQuarterlyClosings, loadQuotes, runRefresh])

  const refreshBilling = useCallback(async () => {
    await runRefresh([
      loadQuotes,
      loadJobs,
      loadInvoices,
      loadPayments,
      loadExpenses,
    ])
  }, [loadExpenses, loadInvoices, loadJobs, loadPayments, loadQuotes, runRefresh])

  const refreshOperations = useCallback(async () => {
    await runRefresh([
      loadLeads,
      loadClients,
      loadProperties,
      loadQuotes,
      loadJobs,
      loadInvoices,
    ])
  }, [loadClients, loadInvoices, loadJobs, loadLeads, loadProperties, loadQuotes, runRefresh])

  const refreshClosings = useCallback(async () => {
    await runRefresh([loadQuarterlyClosings, loadAnnualClosings])
  }, [loadAnnualClosings, loadQuarterlyClosings, runRefresh])

  const reloadInvoicesAndPayments = useCallback(async () => {
    await refreshBilling()
  }, [refreshBilling])

  const reloadLeadsAndClients = useCallback(async () => {
    await refreshOperations()
  }, [refreshOperations])

  useEffect(() => {
    let isMounted = true

    void refreshAll().finally(() => {
      if (isMounted) {
        setIsInitialDataLoading(false)
      }
    })

    return () => {
      isMounted = false
    }
  }, [refreshAll])

  const requestForegroundRefresh = useCallback(() => {
    if (!isBrowserOnline()) {
      setSyncStatus('offline')
      return
    }

    if (Date.now() - lastRefreshAtRef.current < foregroundRefreshStaleTimeMs) {
      return
    }

    void refreshAll()
  }, [refreshAll])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestForegroundRefresh()
      }
    }

    const handleOnline = () => {
      void refreshAll()
    }

    const handleOffline = () => {
      setSyncStatus('offline')
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pageshow', requestForegroundRefresh)
    window.addEventListener('focus', requestForegroundRefresh)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pageshow', requestForegroundRefresh)
      window.removeEventListener('focus', requestForegroundRefresh)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [refreshAll, requestForegroundRefresh])

  const runScopedRefresh = useCallback((scope: RefreshScope) => {
    if (scope === 'billing') {
      void refreshBilling()
      return
    }

    if (scope === 'operations') {
      void refreshOperations()
      return
    }

    if (scope === 'closings') {
      void refreshClosings()
      return
    }

    void refreshAll()
  }, [refreshAll, refreshBilling, refreshClosings, refreshOperations])

  const scheduleRealtimeRefresh = useCallback((scope: RefreshScope) => {
    if (!isBrowserOnline()) {
      setSyncStatus('offline')
      return
    }

    pendingRealtimeScopeRef.current = combineRefreshScopes(pendingRealtimeScopeRef.current, scope)
    setSyncStatus('changed')

    if (pendingRealtimeRefreshRef.current !== null) {
      window.clearTimeout(pendingRealtimeRefreshRef.current)
    }

    pendingRealtimeRefreshRef.current = window.setTimeout(() => {
      const scopeToRefresh = pendingRealtimeScopeRef.current ?? 'all'
      pendingRealtimeRefreshRef.current = null
      pendingRealtimeScopeRef.current = null
      runScopedRefresh(scopeToRefresh)
    }, realtimeRefreshDelayMs)
  }, [runScopedRefresh])

  useEffect(() => {
    const { client } = getSupabaseClient()
    if (!client) return

    const channel = client.channel('costaclean-app-sync')

    for (const table of realtimeTables) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        scheduleRealtimeRefresh(getRefreshScopeForTable(payload.table ?? table))
      })
    }

    void channel.subscribe()

    return () => {
      if (pendingRealtimeRefreshRef.current !== null) {
        window.clearTimeout(pendingRealtimeRefreshRef.current)
        pendingRealtimeRefreshRef.current = null
        pendingRealtimeScopeRef.current = null
      }

      void client.removeChannel(channel)
    }
  }, [scheduleRealtimeRefresh])

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
      const job = jobById.get(invoice.job_id)
      const property = job?.property_id ? propertyById.get(job.property_id) : undefined
      const quote = job?.quote_id ? quoteById.get(job.quote_id) : undefined

      return {
        ...invoice,
        client_display_code: clientCodeById.get(invoice.client_id) ?? invoice.client_id,
        job_display_code: jobCodeById.get(invoice.job_id) ?? invoice.job_id,
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
      }),
    [expenses, invoicesWithCodes, jobsWithCodes, paymentsWithCodes, quarterlyClosings, quotesWithCodes],
  )

  useEffect(() => {
    const activeIds = new Set(automationAlerts.map((alert) => alert.id))
    setReviewedAlertIds((current) => current.filter((id) => activeIds.has(id)))
  }, [automationAlerts])

  const filteredQuotes = useMemo(
    () => applyQuoteFilter(quotesWithCodes, moduleFilters.quotes),
    [quotesWithCodes, moduleFilters.quotes],
  )

  const filteredJobs = useMemo(
    () => applyJobFilter(jobsWithCodes, moduleFilters.jobs),
    [jobsWithCodes, moduleFilters.jobs],
  )

  const filteredInvoices = useMemo(
    () => applyInvoiceFilter(invoicesWithCodes, moduleFilters.invoices),
    [invoicesWithCodes, moduleFilters.invoices],
  )

  const filteredExpenses = useMemo(
    () => applyExpenseFilter(expenses, moduleFilters.expenses),
    [expenses, moduleFilters.expenses],
  )

  const filteredPayments = useMemo(
    () => applyPaymentFilter(paymentsWithCodes, moduleFilters.payments),
    [paymentsWithCodes, moduleFilters.payments],
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
          reviewedAlertIds={reviewedAlertIds}
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
              reviewedAlertIds={reviewedAlertIds}
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
            <LeadsPage leads={leads} clients={clients} error={leadError} onLeadCreated={refreshOperations} onLeadConverted={reloadLeadsAndClients} />
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
              onQuoteCreated={refreshBilling}
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
