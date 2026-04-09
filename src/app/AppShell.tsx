import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppNav } from './AppNav'
import '../features/shell/shell-dashboard.css'
import type { AppView } from './navigation'
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

function getExpenseMonthKey(dateValue: string): string | null {
  if (!dateValue) return null
  const date = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function getExpenseQuarterKey(dateValue: string): string | null {
  if (!dateValue) return null
  const date = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  const year = date.getFullYear()
  const quarter = Math.floor(date.getMonth() / 3) + 1
  return `${year}-Q${quarter}`
}

function getMonthKey(dateValue: string): string | null {
  if (!dateValue) return null
  const date = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
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

function isOlderThanDays(dateValue: string, days: number): boolean {
  if (!dateValue) return false
  const normalizedValue = dateValue.length > 10 ? dateValue : `${dateValue}T00:00:00`
  const date = new Date(normalizedValue)
  if (Number.isNaN(date.getTime())) return false
  const threshold = new Date()
  threshold.setHours(0, 0, 0, 0)
  threshold.setDate(threshold.getDate() - days)
  return date < threshold
}

export function AppShell() {
  const [currentView, setCurrentView] = useState<AppView>('dashboard')
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [compactMobileNav, setCompactMobileNav] = useState(false)
  const [moduleFilters, setModuleFilters] = useState<ModuleFilterState>(emptyModuleFilterState)
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
  const [leadError, setLeadError] = useState<string | null>(null)
  const [clientError, setClientError] = useState<string | null>(null)
  const [propertyError, setPropertyError] = useState<string | null>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [jobError, setJobError] = useState<string | null>(null)
  const [invoiceError, setInvoiceError] = useState<string | null>(null)
  const [expenseError, setExpenseError] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)

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

  const reloadInvoicesAndPayments = useCallback(async () => {
    await Promise.all([loadInvoices(), loadPayments()])
  }, [loadInvoices, loadPayments])

  const reloadLeadsAndClients = useCallback(async () => {
    await Promise.all([loadLeads(), loadClients()])
  }, [loadLeads, loadClients])

  useEffect(() => {
    void Promise.all([
      loadLeads(),
      loadClients(),
      loadProperties(),
      loadQuotes(),
      loadJobs(),
      loadInvoices(),
      loadExpenses(),
      loadPayments(),
    ])
  }, [loadLeads, loadClients, loadProperties, loadQuotes, loadJobs, loadInvoices, loadExpenses, loadPayments])

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

  const clientCodeById = useMemo(() => new Map(clients.map((client) => [client.id, client.display_code ?? client.id])), [clients])
  const clientById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients])
  const propertyCodeById = useMemo(() => new Map(properties.map((property) => [property.id, property.display_code ?? property.id])), [properties])
  const propertyById = useMemo(() => new Map(properties.map((property) => [property.id, property])), [properties])
  const quoteCodeById = useMemo(() => new Map(quotes.map((quote) => [quote.id, quote.display_code ?? quote.id])), [quotes])
  const quoteById = useMemo(() => new Map(quotes.map((quote) => [quote.id, quote])), [quotes])
  const jobCodeById = useMemo(() => new Map(jobs.map((job) => [job.id, job.display_code ?? job.id])), [jobs])
  const jobById = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs])
  const invoiceById = useMemo(() => new Map(invoices.map((invoice) => [invoice.id, invoice])), [invoices])

  const dashboardMetrics = useMemo(() => {
    const invoicePaidById = new Map<string, number>()
    for (const payment of payments) {
      const currentPaid = invoicePaidById.get(payment.invoice_id) ?? 0
      invoicePaidById.set(payment.invoice_id, currentPaid + Number(payment.amount || 0))
    }

    const invoiceIdsWithLinks = new Set(invoices.map((invoice) => invoice.job_id))
    const quoteIdsWithJobs = new Set(jobs.map((job) => job.quote_id).filter(Boolean))
    const openQuotesCount = quotes.filter((quote) => quote.status === 'draft' || quote.status === 'sent').length
    const scheduledJobsCount = jobs.filter((job) => job.status === 'scheduled' || job.status === 'in_progress').length
    const pendingInvoicesCount = invoices.filter((invoice) => invoice.status !== 'paid').length
    const completedJobsWithoutInvoiceCount = jobs.filter((job) => job.status === 'completed' && !invoiceIdsWithLinks.has(job.id)).length
    const acceptedQuotesWithoutJobCount = quotes.filter((quote) => quote.status === 'accepted' && !quoteIdsWithJobs.has(quote.id)).length
    const unpaidInvoicesOlderThan7DaysCount = invoices.filter((invoice) => invoice.status !== 'paid' && isOlderThanDays(invoice.issue_date, 7)).length
    const sentQuotesOlderThan5DaysCount = quotes.filter((quote) => quote.status === 'sent' && isOlderThanDays(quote.created_at ?? '', 5)).length
    const completedJobsWithoutInvoiceOlderThan2DaysCount = jobs.filter((job) => job.status === 'completed' && !invoiceIdsWithLinks.has(job.id) && isOlderThanDays(job.scheduled_date, 2)).length
    const totalInvoiced = invoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0)
    const totalCollected = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.total || 0), 0)
    const expensesWithReceiptCount = expenses.filter((expense) => Boolean(expense.receipt_file_path)).length
    const expensesWithoutReceiptCount = expenses.filter((expense) => !expense.receipt_file_path).length
    const deductibleExpensesCount = expenses.filter((expense) => expense.is_deductible).length

    const now = new Date()
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const currentQuarterKey = `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`
    const todayKey = createDayKey(0)
    const tomorrowKey = createDayKey(1)
    const invoicedThisMonthTotal = invoices
      .filter((invoice) => getMonthKey(invoice.issue_date) === currentMonthKey)
      .reduce((sum, invoice) => sum + Number(invoice.total || 0), 0)
    const collectedThisMonthTotal = payments
      .filter((payment) => getMonthKey(payment.payment_date) === currentMonthKey)
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    const outstandingReceivablesTotal = invoices.reduce((sum, invoice) => {
      if (invoice.status === 'paid') {
        return sum
      }

      const invoiceTotal = Number(invoice.total || 0)
      const paidAmount = invoicePaidById.get(invoice.id) ?? 0
      const remainingAmount = Math.max(invoiceTotal - paidAmount, 0)
      return sum + remainingAmount
    }, 0)

    const expensesThisMonthTotal = expenses
      .filter((expense) => getExpenseMonthKey(expense.expense_date) === currentMonthKey)
      .reduce((sum, expense) => sum + Number(expense.total || 0), 0)

    const expensesThisQuarterTotal = expenses
      .filter((expense) => getExpenseQuarterKey(expense.expense_date) === currentQuarterKey)
      .reduce((sum, expense) => sum + Number(expense.total || 0), 0)

    const jobsScheduledTodayCount = jobs.filter((job) => getDateKey(job.scheduled_date) === todayKey && job.status !== 'cancelled').length
    const jobsScheduledTomorrowCount = jobs.filter((job) => getDateKey(job.scheduled_date) === tomorrowKey && job.status !== 'cancelled').length

    return {
      leadsCount: leads.length,
      clientsCount: clients.length,
      propertiesCount: properties.length,
      quotesCount: quotes.length,
      jobsCount: jobs.length,
      invoicesCount: invoices.length,
      paymentsCount: payments.length,
      expensesCount: expenses.length,
      openQuotesCount,
      scheduledJobsCount,
      pendingInvoicesCount,
      invoicedThisMonthTotal,
      collectedThisMonthTotal,
      outstandingReceivablesTotal,
      completedJobsWithoutInvoiceCount,
      acceptedQuotesWithoutJobCount,
      unpaidInvoicesOlderThan7DaysCount,
      sentQuotesOlderThan5DaysCount,
      completedJobsWithoutInvoiceOlderThan2DaysCount,
      jobsScheduledTodayCount,
      jobsScheduledTomorrowCount,
      totalInvoiced,
      totalCollected,
      totalExpenses,
      expensesThisMonthTotal,
      expensesThisQuarterTotal,
      expensesWithReceiptCount,
      expensesWithoutReceiptCount,
      deductibleExpensesCount,
    }
  }, [leads, clients, properties, quotes, jobs, invoices, expenses, payments])

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
    setModuleFilters((current) => applyDashboardKpiAction(current, actionId))
    setCurrentView(action.view)
  }, [])

  const handleCreateJobFromQuote = useCallback((quote: QuoteListItem) => {
    const prefill = buildJobCreatePrefillFromQuote(quote)
    if (!prefill) {
      return
    }

    setJobCreatePrefill(prefill)
    setCurrentView('jobs')
  }, [])

  const handleCreateInvoiceFromJob = useCallback((job: JobListItem) => {
    const prefill = buildInvoiceCreatePrefillFromJob(job)
    if (!prefill) {
      return
    }

    setInvoiceCreatePrefill(prefill)
    setCurrentView('invoices')
  }, [])

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
      <section className="hero-card cc-shell">
        <AppNav
          currentView={currentView}
          onChangeView={setCurrentView}
          compactMobile={compactMobileNav}
        />
        <div className="cc-shell-content">
          {currentView === 'dashboard' ? (
            <HomePage
              metrics={dashboardMetrics}
              agenda={dashboardAgenda}
              onOpenView={setCurrentView}
              onRunKpiAction={handleDashboardKpiAction}
            />
          ) : currentView === 'leads' ? (
            <LeadsPage leads={leads} clients={clients} error={leadError} onLeadCreated={loadLeads} onLeadConverted={reloadLeadsAndClients} />
          ) : currentView === 'clients' ? (
            <ClientsPage clients={clients} error={clientError} onClientCreated={loadClients} />
          ) : currentView === 'properties' ? (
            <PropertiesPage properties={propertiesWithCodes} clients={clients} error={propertyError} onPropertyCreated={loadProperties} />
          ) : currentView === 'quotes' ? (
            <QuotesPage
              quotes={filteredQuotes}
              clients={clients}
              properties={properties}
              error={quoteError}
              onQuoteCreated={loadQuotes}
              onCreateJobFromQuote={handleCreateJobFromQuote}
              activeFilterLabel={getQuoteFilterLabel(moduleFilters.quotes)}
              onClearFilter={() => clearModuleFilter('quotes')}
            />
          ) : currentView === 'jobs' ? (
            <JobsPage
              jobs={filteredJobs}
              clients={clients}
              properties={properties}
              quotes={quotes}
              error={jobError}
              onJobCreated={loadJobs}
              onCreateInvoiceFromJob={handleCreateInvoiceFromJob}
              createPrefill={jobCreatePrefill}
              onPrefillConsumed={() => setJobCreatePrefill(null)}
              activeFilterLabel={getJobFilterLabel(moduleFilters.jobs)}
              onClearFilter={() => clearModuleFilter('jobs')}
            />
          ) : currentView === 'invoices' ? (
            <InvoicesPage
              invoices={filteredInvoices}
              jobs={jobsWithCodes}
              quotes={quotesWithCodes}
              error={invoiceError}
              onInvoiceCreated={loadInvoices}
              createPrefill={invoiceCreatePrefill}
              onPrefillConsumed={() => setInvoiceCreatePrefill(null)}
              activeFilterLabel={getInvoiceFilterLabel(moduleFilters.invoices)}
              onClearFilter={() => clearModuleFilter('invoices')}
            />
          ) : currentView === 'expenses' ? (
            <ExpensesPage
              expenses={filteredExpenses}
              error={expenseError}
              onExpenseCreated={loadExpenses}
              activeFilterLabel={getExpenseFilterLabel(moduleFilters.expenses)}
              onClearFilter={() => clearModuleFilter('expenses')}
            />
          ) : (
            <PaymentsPage
              payments={filteredPayments}
              invoices={invoicesWithCodes}
              error={paymentError}
              onPaymentCreated={reloadInvoicesAndPayments}
              activeFilterLabel={getPaymentFilterLabel(moduleFilters.payments)}
              onClearFilter={() => clearModuleFilter('payments')}
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
    </main>
  )
}





