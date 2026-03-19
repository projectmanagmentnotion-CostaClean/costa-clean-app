import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppNav } from './AppNav'
import type { AppView } from './navigation'
import { HomePage } from '../pages/HomePage'
import { LeadsPage } from '../pages/LeadsPage'
import { ClientsPage } from '../pages/ClientsPage'
import { PropertiesPage } from '../pages/PropertiesPage'
import { QuotesPage } from '../pages/QuotesPage'
import { JobsPage } from '../pages/JobsPage'
import { InvoicesPage } from '../pages/InvoicesPage'
import { PaymentsPage } from '../pages/PaymentsPage'
import type { LeadListItem } from '../features/leads/types'
import type { ClientListItem } from '../features/clients/types'
import type { PropertyListItem } from '../features/properties/types'
import type { QuoteListItem } from '../features/quotes/types'
import type { JobListItem } from '../features/jobs/types'
import type { InvoiceListItem } from '../features/invoices/types'
import type { PaymentListItem } from '../features/payments/types'

export function AppShell() {
  const [currentView, setCurrentView] = useState<AppView>('dashboard')
  const [leads, setLeads] = useState<LeadListItem[]>([])
  const [clients, setClients] = useState<ClientListItem[]>([])
  const [properties, setProperties] = useState<PropertyListItem[]>([])
  const [quotes, setQuotes] = useState<QuoteListItem[]>([])
  const [jobs, setJobs] = useState<JobListItem[]>([])
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([])
  const [payments, setPayments] = useState<PaymentListItem[]>([])
  const [leadError, setLeadError] = useState<string | null>(null)
  const [clientError, setClientError] = useState<string | null>(null)
  const [propertyError, setPropertyError] = useState<string | null>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [jobError, setJobError] = useState<string | null>(null)
  const [invoiceError, setInvoiceError] = useState<string | null>(null)
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
      const response = await fetch(`${supabaseUrl}/rest/v1/quotes?select=id,display_code,client_id,property_id,status,subtotal,tax_amount,total,notes&order=created_at.desc`, {
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
      const response = await fetch(`${supabaseUrl}/rest/v1/jobs?select=id,display_code,client_id,property_id,quote_id,scheduled_date,status,service_type,notes&order=created_at.desc`, {
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
      setInvoices(((await response.json()) as InvoiceListItem[]) ?? [])
    } catch (err) {
      setInvoiceError(err instanceof Error ? err.message : 'Error desconocido cargando invoices.')
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

  const reloadLeadsAndClients = useCallback(async () => {
    await Promise.all([loadLeads(), loadClients()])
  }, [loadLeads, loadClients])

  useEffect(() => {
    void Promise.all([loadLeads(), loadClients(), loadProperties(), loadQuotes(), loadJobs(), loadInvoices(), loadPayments()])
  }, [loadLeads, loadClients, loadProperties, loadQuotes, loadJobs, loadInvoices, loadPayments])

  const clientCodeById = useMemo(() => new Map(clients.map((client) => [client.id, client.display_code ?? client.id])), [clients])
  const propertyCodeById = useMemo(() => new Map(properties.map((property) => [property.id, property.display_code ?? property.id])), [properties])
  const quoteCodeById = useMemo(() => new Map(quotes.map((quote) => [quote.id, quote.display_code ?? quote.id])), [quotes])
  const jobCodeById = useMemo(() => new Map(jobs.map((job) => [job.id, job.display_code ?? job.id])), [jobs])
  const invoiceById = useMemo(() => new Map(invoices.map((invoice) => [invoice.id, invoice])), [invoices])

  const propertiesWithCodes = useMemo(
    () => properties.map((property) => ({ ...property, client_display_code: clientCodeById.get(property.client_id) ?? property.client_id })),
    [properties, clientCodeById],
  )

  const quotesWithCodes = useMemo(
    () => quotes.map((quote) => ({
      ...quote,
      client_display_code: clientCodeById.get(quote.client_id) ?? quote.client_id,
      property_display_code: quote.property_id ? propertyCodeById.get(quote.property_id) ?? quote.property_id : null,
    })),
    [quotes, clientCodeById, propertyCodeById],
  )

  const jobsWithCodes = useMemo(
    () => jobs.map((job) => ({
      ...job,
      client_display_code: clientCodeById.get(job.client_id) ?? job.client_id,
      property_display_code: propertyCodeById.get(job.property_id) ?? job.property_id,
      quote_display_code: job.quote_id ? quoteCodeById.get(job.quote_id) ?? job.quote_id : null,
    })),
    [jobs, clientCodeById, propertyCodeById, quoteCodeById],
  )

  const invoicesWithCodes = useMemo(
    () => invoices.map((invoice) => ({
      ...invoice,
      client_display_code: clientCodeById.get(invoice.client_id) ?? invoice.client_id,
      job_display_code: jobCodeById.get(invoice.job_id) ?? invoice.job_id,
    })),
    [invoices, clientCodeById, jobCodeById],
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

  return (
    <main className="app-shell">
      <section className="hero-card">
        <AppNav currentView={currentView} onChangeView={setCurrentView} />

        {currentView === 'dashboard' ? (
          <HomePage leads={leads} />
        ) : currentView === 'leads' ? (
          <LeadsPage leads={leads} clients={clients} error={leadError} onLeadCreated={loadLeads} onLeadConverted={reloadLeadsAndClients} />
        ) : currentView === 'clients' ? (
          <ClientsPage clients={clients} error={clientError} onClientCreated={loadClients} />
        ) : currentView === 'properties' ? (
          <PropertiesPage properties={propertiesWithCodes} clients={clients} error={propertyError} onPropertyCreated={loadProperties} />
        ) : currentView === 'quotes' ? (
          <QuotesPage quotes={quotesWithCodes} clients={clients} properties={properties} error={quoteError} onQuoteCreated={loadQuotes} />
        ) : currentView === 'jobs' ? (
          <JobsPage jobs={jobsWithCodes} clients={clients} properties={properties} quotes={quotes} error={jobError} onJobCreated={loadJobs} />
        ) : currentView === 'invoices' ? (
          <InvoicesPage invoices={invoicesWithCodes} jobs={jobsWithCodes} quotes={quotesWithCodes} error={invoiceError} onInvoiceCreated={loadInvoices} />
        ) : (
          <PaymentsPage payments={paymentsWithCodes} invoices={invoicesWithCodes} error={paymentError} onPaymentCreated={loadPayments} />
        )}
      </section>
    </main>
  )
}
