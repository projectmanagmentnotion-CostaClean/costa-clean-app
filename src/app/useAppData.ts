import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AppView } from './navigation'
import type { SyncStatus } from './syncStatus'
import {
  filterDomainsByLoadedState,
  getDomainsForScope,
  getDomainsForView,
  mergeDomains,
  type AppDataDomain,
} from './dataLoadingPlan'
import {
  combineRefreshScopes,
  getRefreshScopeForTable,
  isBrowserOnline,
  realtimeTables,
  type RefreshScope,
} from './refreshInvalidation'
import {
  listAnnualClosings,
  listClients,
  listExpenses,
  listInvoices,
  listLeadDrafts,
  listJobs,
  listLeads,
  listPayments,
  listProperties,
  listQuarterlyClosings,
  listQuotes,
  listRecurringInvoicePlans,
} from './appDataApi'
import type { ClientListItem } from '../features/clients/types'
import type { ExpenseListItem } from '../features/expenses/types'
import type { InvoiceListItem } from '../features/invoices/types'
import type { JobListItem } from '../features/jobs/types'
import type { LeadDraftRecord } from '../features/leadDrafts/types'
import type { LeadListItem } from '../features/leads/types'
import type { PaymentListItem } from '../features/payments/types'
import type { PropertyListItem } from '../features/properties/types'
import type { AnnualClosingRecord } from '../features/annualClosing/types'
import type { QuarterlyClosingRecord } from '../features/quarterlyClosing/types'
import type { QuoteListItem } from '../features/quotes/types'
import type { RecurringInvoicePlanListItem } from '../features/recurringInvoices/types'
import { getSupabaseClient } from '../lib/supabase'

const foregroundRefreshStaleTimeMs = 30_000
const realtimeRefreshDelayMs = 900

export interface IntakeRealtimeNotification {
  id: string
  title: string
  summary: string
  createdAt: string
  intakeSubmissionId: string
}

function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

function getStringValue(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function buildIntakeNotification(row: Record<string, unknown>): IntakeRealtimeNotification | null {
  if (row.source !== 'public_quote_form') return null

  const intakeSubmissionId = getStringValue(row, 'id')
  if (!intakeSubmissionId) return null

  const normalizedInput = row.normalized_input && typeof row.normalized_input === 'object'
    ? row.normalized_input as Record<string, unknown>
    : null
  const fullName = normalizedInput ? getStringValue(normalizedInput, 'fullName') : null
  const city = normalizedInput ? getStringValue(normalizedInput, 'city') : null
  const serviceNeedLabel = normalizedInput ? getStringValue(normalizedInput, 'serviceNeedLabel') : null
  const summaryParts = [fullName, city, serviceNeedLabel].filter(Boolean)

  return {
    id: `intake:${intakeSubmissionId}`,
    title: 'Nueva solicitud de presupuesto',
    summary: summaryParts.length > 0 ? summaryParts.join(' · ') : 'Solicitud recibida desde el formulario publico.',
    createdAt: getStringValue(row, 'created_at') ?? new Date().toISOString(),
    intakeSubmissionId,
  }
}

export function useAppData(currentView: AppView) {
  const [isCurrentViewDataLoading, setIsCurrentViewDataLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => (isBrowserOnline() ? 'fresh' : 'offline'))
  const [leads, setLeads] = useState<LeadListItem[]>([])
  const [leadDrafts, setLeadDrafts] = useState<LeadDraftRecord[]>([])
  const [clients, setClients] = useState<ClientListItem[]>([])
  const [properties, setProperties] = useState<PropertyListItem[]>([])
  const [quotes, setQuotes] = useState<QuoteListItem[]>([])
  const [jobs, setJobs] = useState<JobListItem[]>([])
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([])
  const [expenses, setExpenses] = useState<ExpenseListItem[]>([])
  const [payments, setPayments] = useState<PaymentListItem[]>([])
  const [recurringInvoicePlans, setRecurringInvoicePlans] = useState<RecurringInvoicePlanListItem[]>([])
  const [quarterlyClosings, setQuarterlyClosings] = useState<QuarterlyClosingRecord[]>([])
  const [annualClosings, setAnnualClosings] = useState<AnnualClosingRecord[]>([])
  const [leadError, setLeadError] = useState<string | null>(null)
  const [leadDraftError, setLeadDraftError] = useState<string | null>(null)
  const [clientError, setClientError] = useState<string | null>(null)
  const [propertyError, setPropertyError] = useState<string | null>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [jobError, setJobError] = useState<string | null>(null)
  const [invoiceError, setInvoiceError] = useState<string | null>(null)
  const [expenseError, setExpenseError] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [recurringInvoicePlanError, setRecurringInvoicePlanError] = useState<string | null>(null)
  const [quarterlyClosingError, setQuarterlyClosingError] = useState<string | null>(null)
  const [annualClosingError, setAnnualClosingError] = useState<string | null>(null)
  const [intakeRealtimeNotifications, setIntakeRealtimeNotifications] = useState<IntakeRealtimeNotification[]>([])
  const [loadedDomains, setLoadedDomains] = useState<AppDataDomain[]>([])
  const lastRefreshAtRef = useRef(0)
  const isRefreshingRef = useRef(false)
  const pendingRealtimeRefreshRef = useRef<number | null>(null)
  const pendingRealtimeScopeRef = useRef<RefreshScope | null>(null)
  const pendingDomainRefreshRef = useRef<AppDataDomain[]>([])
  const seenIntakeRealtimeNotificationIdsRef = useRef<Set<string>>(new Set())

  const loadLeads = useCallback(async () => {
    try {
      setLeadError(null)
      setLeads(await listLeads())
    } catch (err) {
      setLeadError(getErrorMessage(err, 'Error desconocido cargando leads.'))
    }
  }, [])

  const loadLeadDrafts = useCallback(async () => {
    try {
      setLeadDraftError(null)
      setLeadDrafts(await listLeadDrafts())
    } catch (err) {
      setLeadDraftError(getErrorMessage(err, 'Error desconocido cargando borradores de intake.'))
    }
  }, [])

  const loadClients = useCallback(async () => {
    try {
      setClientError(null)
      setClients(await listClients())
    } catch (err) {
      setClientError(getErrorMessage(err, 'Error desconocido cargando clients.'))
    }
  }, [])

  const loadProperties = useCallback(async () => {
    try {
      setPropertyError(null)
      setProperties(await listProperties())
    } catch (err) {
      setPropertyError(getErrorMessage(err, 'Error desconocido cargando properties.'))
    }
  }, [])

  const loadQuotes = useCallback(async () => {
    try {
      setQuoteError(null)
      setQuotes(await listQuotes())
    } catch (err) {
      setQuoteError(getErrorMessage(err, 'Error desconocido cargando quotes.'))
    }
  }, [])

  const loadJobs = useCallback(async () => {
    try {
      setJobError(null)
      setJobs(await listJobs())
    } catch (err) {
      setJobError(getErrorMessage(err, 'Error desconocido cargando jobs.'))
    }
  }, [])

  const loadInvoices = useCallback(async () => {
    try {
      setInvoiceError(null)
      setInvoices(await listInvoices())
    } catch (err) {
      setInvoiceError(getErrorMessage(err, 'Error desconocido cargando invoices.'))
    }
  }, [])

  const loadExpenses = useCallback(async () => {
    try {
      setExpenseError(null)
      setExpenses(await listExpenses())
    } catch (err) {
      setExpenseError(getErrorMessage(err, 'Error desconocido cargando expenses.'))
    }
  }, [])

  const loadPayments = useCallback(async () => {
    try {
      setPaymentError(null)
      setPayments(await listPayments())
    } catch (err) {
      setPaymentError(getErrorMessage(err, 'Error desconocido cargando payments.'))
    }
  }, [])

  const loadRecurringInvoicePlans = useCallback(async () => {
    try {
      setRecurringInvoicePlanError(null)
      setRecurringInvoicePlans(await listRecurringInvoicePlans())
    } catch (err) {
      setRecurringInvoicePlanError(getErrorMessage(err, 'Error desconocido cargando automatizaciones recurrentes.'))
    }
  }, [])

  const loadQuarterlyClosings = useCallback(async () => {
    try {
      setQuarterlyClosingError(null)
      setQuarterlyClosings(await listQuarterlyClosings())
    } catch (err) {
      setQuarterlyClosingError(getErrorMessage(err, 'Error desconocido cargando cierres trimestrales.'))
    }
  }, [])

  const loadAnnualClosings = useCallback(async () => {
    try {
      setAnnualClosingError(null)
      setAnnualClosings(await listAnnualClosings())
    } catch (err) {
      setAnnualClosingError(getErrorMessage(err, 'Error desconocido cargando cierres anuales.'))
    }
  }, [])

  const domainLoaders = useMemo<Record<AppDataDomain, () => Promise<void>>>(() => ({
    leads: loadLeads,
    leadDrafts: loadLeadDrafts,
    clients: loadClients,
    properties: loadProperties,
    quotes: loadQuotes,
    jobs: loadJobs,
    invoices: loadInvoices,
    payments: loadPayments,
    expenses: loadExpenses,
    recurringInvoicePlans: loadRecurringInvoicePlans,
    quarterlyClosings: loadQuarterlyClosings,
    annualClosings: loadAnnualClosings,
  }), [
    loadAnnualClosings,
    loadClients,
    loadExpenses,
    loadInvoices,
    loadJobs,
    loadLeadDrafts,
    loadLeads,
    loadPayments,
    loadProperties,
    loadQuarterlyClosings,
    loadQuotes,
    loadRecurringInvoicePlans,
  ])

  const markDomainsLoaded = useCallback((domains: Iterable<AppDataDomain>) => {
    setLoadedDomains((current) => mergeDomains(current, domains))
  }, [])

  const runRefresh = useCallback(async (domains: AppDataDomain[]) => {
    const domainsToRefresh = mergeDomains([], domains)
    if (domainsToRefresh.length === 0) return

    if (!isBrowserOnline()) {
      setSyncStatus('offline')
      return
    }

    if (isRefreshingRef.current) {
      pendingDomainRefreshRef.current = mergeDomains(pendingDomainRefreshRef.current, domainsToRefresh)
      return
    }

    isRefreshingRef.current = true
    setSyncStatus('syncing')

    try {
      await Promise.all(domainsToRefresh.map((domain) => domainLoaders[domain]()))
      markDomainsLoaded(domainsToRefresh)
      lastRefreshAtRef.current = Date.now()
      setSyncStatus('fresh')
    } finally {
      isRefreshingRef.current = false

      if (pendingDomainRefreshRef.current.length > 0) {
        const queuedDomains = pendingDomainRefreshRef.current
        pendingDomainRefreshRef.current = []
        void runRefresh(queuedDomains)
      }
    }
  }, [
    domainLoaders,
    markDomainsLoaded,
  ])

  const loadedDomainSet = useRef<Set<AppDataDomain>>(new Set<AppDataDomain>())

  useEffect(() => {
    loadedDomainSet.current = new Set(loadedDomains)
  }, [loadedDomains])

  const refreshDomains = useCallback(async (domains: AppDataDomain[]) => {
    await runRefresh(domains)
  }, [runRefresh])

  const refreshBilling = useCallback(async () => {
    const scopeDomains = getDomainsForScope('billing')
    const activeViewDomains = new Set(getDomainsForView(currentView))
    const domainsToRefresh = scopeDomains.filter(
      (domain) => loadedDomainSet.current.has(domain) || activeViewDomains.has(domain),
    )
    await refreshDomains(domainsToRefresh)
  }, [currentView, refreshDomains])

  const refreshOperations = useCallback(async () => {
    const scopeDomains = getDomainsForScope('operations')
    const activeViewDomains = new Set(getDomainsForView(currentView))
    const domainsToRefresh = scopeDomains.filter(
      (domain) => loadedDomainSet.current.has(domain) || activeViewDomains.has(domain),
    )
    await refreshDomains(domainsToRefresh)
  }, [currentView, refreshDomains])

  const refreshClosings = useCallback(async () => {
    const scopeDomains = getDomainsForScope('closings')
    const activeViewDomains = new Set(getDomainsForView(currentView))
    const domainsToRefresh = scopeDomains.filter(
      (domain) => loadedDomainSet.current.has(domain) || activeViewDomains.has(domain),
    )
    await refreshDomains(domainsToRefresh)
  }, [currentView, refreshDomains])

  const reloadInvoicesAndPayments = useCallback(async () => {
    await refreshBilling()
  }, [refreshBilling])

  const reloadLeadsAndClients = useCallback(async () => {
    await refreshOperations()
  }, [refreshOperations])

  useEffect(() => {
    let isMounted = true
    const requiredDomains = getDomainsForView(currentView)
    const missingDomains = requiredDomains.filter((domain) => !loadedDomainSet.current.has(domain))

    if (missingDomains.length === 0) {
      setIsCurrentViewDataLoading(false)
      return () => {
        isMounted = false
      }
    }

    setIsCurrentViewDataLoading(true)

    void refreshDomains(missingDomains).finally(() => {
      if (isMounted) {
        setIsCurrentViewDataLoading(false)
      }
    })

    return () => {
      isMounted = false
    }
  }, [currentView, refreshDomains])

  const requestForegroundRefresh = useCallback(() => {
    if (!isBrowserOnline()) {
      setSyncStatus('offline')
      return
    }

    if (Date.now() - lastRefreshAtRef.current < foregroundRefreshStaleTimeMs) {
      return
    }

    const activeViewDomains = getDomainsForView(currentView)
    const domainsToRefresh = filterDomainsByLoadedState(activeViewDomains, loadedDomainSet.current)
    void refreshDomains(domainsToRefresh.length > 0 ? domainsToRefresh : activeViewDomains)
  }, [currentView, refreshDomains])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestForegroundRefresh()
      }
    }

    const handleOnline = () => {
      const activeViewDomains = getDomainsForView(currentView)
      const domainsToRefresh = filterDomainsByLoadedState(activeViewDomains, loadedDomainSet.current)
      void refreshDomains(domainsToRefresh.length > 0 ? domainsToRefresh : activeViewDomains)
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
  }, [currentView, refreshDomains, requestForegroundRefresh])

  const runScopedRefresh = useCallback((scope: RefreshScope) => {
    const scopeDomains = getDomainsForScope(scope)
    const activeViewDomains = new Set(getDomainsForView(currentView))
    const loadedScopeDomains = scope === 'all'
      ? scopeDomains.filter((domain) => loadedDomainSet.current.has(domain))
      : scopeDomains.filter((domain) => loadedDomainSet.current.has(domain) || activeViewDomains.has(domain))

    void refreshDomains(loadedScopeDomains)
  }, [currentView, refreshDomains])

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

  const pushIntakeRealtimeNotification = useCallback((notification: IntakeRealtimeNotification) => {
    if (seenIntakeRealtimeNotificationIdsRef.current.has(notification.id)) return

    seenIntakeRealtimeNotificationIdsRef.current.add(notification.id)
    setIntakeRealtimeNotifications((current) => [notification, ...current].slice(0, 5))
  }, [])

  const dismissIntakeRealtimeNotification = useCallback((notificationId: string) => {
    setIntakeRealtimeNotifications((current) => current.filter((notification) => notification.id !== notificationId))
  }, [])

  useEffect(() => {
    const { client } = getSupabaseClient()
    if (!client) return

    const channel = client.channel('costaclean-app-sync')

    for (const table of realtimeTables) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        scheduleRealtimeRefresh(getRefreshScopeForTable(payload.table ?? table))

        if (table === 'intake_submissions' && payload.eventType === 'INSERT') {
          const notification = buildIntakeNotification(payload.new as Record<string, unknown>)
          if (notification) {
            pushIntakeRealtimeNotification(notification)
          }
        }
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
  }, [pushIntakeRealtimeNotification, scheduleRealtimeRefresh])

  return {
    isCurrentViewDataLoading,
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
    recurringInvoicePlanError,
    quarterlyClosingError,
    annualClosingError,
    refreshBilling,
    refreshOperations,
    refreshClosings,
    reloadInvoicesAndPayments,
    reloadLeadsAndClients,
    intakeRealtimeNotifications,
    dismissIntakeRealtimeNotification,
  }
}
