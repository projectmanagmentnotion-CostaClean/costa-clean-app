import { listAnnualClosings } from '../features/annualClosing/annualClosingApi'
import type { AnnualClosingRecord } from '../features/annualClosing/types'
import type { ClientListItem } from '../features/clients/types'
import { listExpenses } from '../features/expenses/expenseApi'
import type { ExpenseListItem } from '../features/expenses/types'
import type { InvoiceListItem } from '../features/invoices/types'
import type { JobListItem } from '../features/jobs/types'
import type { LeadDraftRecord } from '../features/leadDrafts/types'
import type { LeadListItem } from '../features/leads/types'
import type { PaymentListItem } from '../features/payments/types'
import type { PropertyListItem } from '../features/properties/types'
import { listQuarterlyClosings } from '../features/quarterlyClosing/quarterlyClosingApi'
import type { QuarterlyClosingRecord } from '../features/quarterlyClosing/types'
import type { QuoteListItem } from '../features/quotes/types'
import { getSupabaseClient } from '../lib/supabase'
import { getSupabasePublicEnv } from '../lib/supabaseEnv'
import { fetchSupabaseRestList } from '../lib/supabaseRest'

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

export async function listLeads(): Promise<LeadListItem[]> {
  return fetchSupabaseRestList<LeadListItem>('leads?select=id,display_code,full_name,phone,email,city,status,archived_at,public_intake_last_submission_id,converted_client_id,converted_at&order=created_at.desc')
}

async function fetchLeadDraftsWithSession(path: string): Promise<LeadDraftRecord[]> {
  const { supabaseUrl, supabaseAnonKey } = getSupabasePublicEnv()

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Faltan las variables de entorno de Supabase.')
  }

  const { client, error } = getSupabaseClient()
  if (error || !client) {
    throw new Error(error ?? 'No se pudo crear el cliente de Supabase.')
  }

  const {
    data: { session },
    error: sessionError,
  } = await client.auth.getSession()

  if (sessionError) {
    throw new Error(sessionError.message)
  }

  if (!session?.access_token) {
    throw new Error('No hay una sesión activa para cargar borradores de intake.')
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method: 'GET',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${session.access_token}`,
    },
  })

  if (!response.ok) {
    throw new Error(`REST ${response.status}: ${response.statusText}`)
  }

  return ((await response.json()) as LeadDraftRecord[]) ?? []
}

export async function listLeadDrafts(): Promise<LeadDraftRecord[]> {
  return fetchLeadDraftsWithSession(
    'lead_drafts?select=id,intake_submission_id,suggested_full_name,phone,email,city,postal_code,status,matched_lead_id,normalized_input,quote_draft_seed,pricing_breakdown,ai_email_draft,ai_whatsapp_draft,ai_draft_status,ai_generation_metadata,created_at,updated_at&order=created_at.desc',
  )
}

export async function listClients(): Promise<ClientListItem[]> {
  return fetchSupabaseRestList<ClientListItem>('clients?select=id,display_code,created_at,full_name,phone,email,tax_id,billing_address,status,source_lead_id&order=created_at.desc')
}

export async function listProperties(): Promise<PropertyListItem[]> {
  return fetchSupabaseRestList<PropertyListItem>('properties?select=id,display_code,client_id,name,property_type,address,city,postal_code,notes&order=created_at.desc')
}

export async function listQuotes(): Promise<QuoteListItem[]> {
  return fetchSupabaseRestList<QuoteListItem>('quotes?select=id,display_code,lead_id,client_id,property_id,status,subtotal,tax_amount,total,notes,internal_notes,pricing_metadata,created_at&order=created_at.desc')
}

export async function listJobs(): Promise<JobListItem[]> {
  return fetchSupabaseRestList<JobListItem>('jobs?select=id,display_code,client_id,property_id,quote_id,scheduled_date,status,service_type,billing_concept,billing_quantity,billing_unit,billing_unit_price,notes&order=created_at.desc')
}

export async function listInvoices(): Promise<InvoiceListItem[]> {
  const loadedInvoices = await fetchSupabaseRestList<InvoiceListItem>('invoices?select=id,display_code,invoice_number,job_id,quote_id,client_id,issue_date,status,subtotal,tax_amount,total,notes,internal_notes,pricing_metadata&order=created_at.desc')
  const invoiceLines = await fetchSupabaseRestList<NonNullable<InvoiceListItem['lines']>[number]>('invoice_lines?select=id,invoice_id,sort_order,concept,quantity,unit,unit_price,line_subtotal,created_at&order=sort_order.asc')
  const linesByInvoiceId = groupInvoiceLines(invoiceLines)

  return loadedInvoices.map((invoice) => ({
    ...invoice,
    lines: linesByInvoiceId.get(invoice.id) ?? [],
  }))
}

export async function listPayments(): Promise<PaymentListItem[]> {
  return fetchSupabaseRestList<PaymentListItem>('payments?select=id,display_code,invoice_id,payment_date,amount,payment_method,notes&order=created_at.desc')
}

export {
  listAnnualClosings,
  listExpenses,
  listQuarterlyClosings,
}

export type {
  AnnualClosingRecord,
  ExpenseListItem,
  QuarterlyClosingRecord,
  LeadDraftRecord,
}
