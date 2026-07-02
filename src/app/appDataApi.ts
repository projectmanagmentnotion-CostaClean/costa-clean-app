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
import type { RecurringInvoicePlanListItem } from '../features/recurringInvoices/types'
import { getSupabaseClient } from '../lib/supabase'
import { getSupabasePublicEnv } from '../lib/supabaseEnv'
import { fetchSupabaseRestList, fetchSupabaseRestListDetailed, SupabaseRestError } from '../lib/supabaseRest'

type JobLineRecord = {
  id?: string
  job_id: string
  sort_order?: number | string | null
  concept: string
  quantity: number | string
  unit: string
  unit_price: number | string
  line_subtotal: number | string
}

export type JobLinesDebugPayload = {
  authMode: 'session' | 'anon'
  attachedPropertyName: 'billing_lines'
  groupedJobIds: string[]
  jobCount: number
  jobLinesError: string | null
  jobLinesFetchStatus: number | null
  jobLinesRawCount: number
  jobLinesRestPath: string
  sampleForJob0052: JobLineRecord[]
  sampleJobId: string | null
  sessionError: string | null
}

export const jobLinesRestPath = 'job_lines?select=id,job_id,sort_order,concept,quantity,unit,unit_price,line_subtotal,created_at&order=sort_order.asc'

function shouldExposeJobLinesDebug() {
  return typeof window !== 'undefined' && window.location.search.includes('debugJobLines=1')
}

function writeJobLinesDebug(payload: JobLinesDebugPayload) {
  if (!shouldExposeJobLinesDebug()) {
    return
  }

  window.__COSTA_CLEAN_JOB_LINES_DEBUG__ = payload
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
  return fetchSupabaseRestList<ClientListItem>('clients?select=id,display_code,created_at,full_name,phone,email,tax_id,billing_address,status,archived_at,deleted_at,source_lead_id&order=created_at.desc')
}

export function groupJobLines(lines: JobLineRecord[]) {
  const linesByJobId = new Map<string, NonNullable<JobListItem['billing_lines']>>()

  for (const line of lines) {
    const normalizedLine = {
      ...line,
      sort_order: line.sort_order === null || line.sort_order === undefined ? undefined : Number(line.sort_order),
      quantity: Number(line.quantity),
      unit_price: Number(line.unit_price),
      line_subtotal: Number(line.line_subtotal),
    }
    const currentLines = linesByJobId.get(line.job_id) ?? []
    currentLines.push(normalizedLine)
    linesByJobId.set(line.job_id, currentLines)
  }

  for (const jobLines of linesByJobId.values()) {
    jobLines.sort((left, right) => Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0))
  }

  if (import.meta.env.DEV) {
    const jobsWithLines = [...linesByJobId.entries()].filter(([, jobLines]) => jobLines.length > 0)
    console.info('[appDataApi] jobs billing lines grouped', {
      jobsWithLines: jobsWithLines.length,
      sample: jobsWithLines.slice(0, 3).map(([jobId, jobLines]) => ({
        jobId,
        lineCount: jobLines.length,
        concepts: jobLines.map((line) => line.concept),
      })),
    })
  }

  return linesByJobId
}

export function attachJobLinesToJobs(loadedJobs: JobListItem[], linesByJobId: Map<string, NonNullable<JobListItem['billing_lines']>>) {
  return loadedJobs.map((job) => ({
    ...job,
    billing_lines: linesByJobId.get(job.id) ?? [],
  }))
}

export function buildJobLinesDebugPayload(input: {
  accessToken: string | null
  loadedJobs: JobListItem[]
  sampleJobId: string | null
  sessionError: string | null
  jobLines: JobLineRecord[]
  jobLinesFetchStatus: number | null
  jobLinesError: string | null
  linesByJobId?: Map<string, NonNullable<JobListItem['billing_lines']>>
}): JobLinesDebugPayload {
  return {
    authMode: input.accessToken ? 'session' : 'anon',
    attachedPropertyName: 'billing_lines',
    groupedJobIds: input.linesByJobId ? [...input.linesByJobId.keys()] : [],
    jobCount: input.loadedJobs.length,
    jobLinesError: input.jobLinesError,
    jobLinesFetchStatus: input.jobLinesFetchStatus,
    jobLinesRawCount: input.jobLines.length,
    jobLinesRestPath,
    sampleForJob0052: input.sampleJobId ? input.jobLines.filter((line) => line.job_id === input.sampleJobId).slice(0, 3) : [],
    sampleJobId: input.sampleJobId,
    sessionError: input.sessionError,
  }
}

export async function listProperties(): Promise<PropertyListItem[]> {
  return fetchSupabaseRestList<PropertyListItem>('properties?select=id,display_code,client_id,name,status,archived_at,deleted_at,property_type,address,city,postal_code,notes&order=created_at.desc')
}

export async function listQuotes(): Promise<QuoteListItem[]> {
  return fetchSupabaseRestList<QuoteListItem>('quotes?select=id,display_code,lead_id,client_id,property_id,status,archived_at,deleted_at,cancelled_at,cancel_reason,subtotal,tax_amount,total,notes,internal_notes,pricing_metadata,created_at,updated_at&order=created_at.desc')
}

export async function listJobs(): Promise<JobListItem[]> {
  const loadedJobs = await fetchSupabaseRestList<JobListItem>('jobs?select=id,display_code,client_id,property_id,quote_id,scheduled_date,status,archived_at,deleted_at,cancelled_at,cancel_reason,updated_at,service_type,billing_concept,billing_quantity,billing_unit,billing_unit_price,notes&order=created_at.desc')
  const sampleJob = loadedJobs.find((job) => job.display_code === 'JOB-0052') ?? null
  let accessToken: string | null = null
  let sessionError: string | null = null

  const { client, error } = getSupabaseClient()
  if (error || !client) {
    sessionError = error ?? 'No se pudo crear el cliente de Supabase.'
  } else {
    const {
      data: { session },
      error: authError,
    } = await client.auth.getSession()

    if (authError) {
      sessionError = authError.message
    } else {
      accessToken = session?.access_token ?? null
    }
  }

  try {
    const jobLinesResponse = await fetchSupabaseRestListDetailed<JobLineRecord>(
      jobLinesRestPath,
      { accessToken },
    )
    const jobLines = jobLinesResponse.rows
    const linesByJobId = groupJobLines(jobLines)
    writeJobLinesDebug(buildJobLinesDebugPayload({
      accessToken,
      loadedJobs,
      sampleJobId: sampleJob?.id ?? null,
      sessionError,
      jobLines,
      jobLinesFetchStatus: jobLinesResponse.status,
      jobLinesError: null,
      linesByJobId,
    }))

    return attachJobLinesToJobs(loadedJobs, linesByJobId)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const hasRecoverableJobLinesFailure = message.includes('REST') || message.includes('job_lines')

    writeJobLinesDebug(buildJobLinesDebugPayload({
      accessToken,
      loadedJobs,
      sampleJobId: sampleJob?.id ?? null,
      sessionError,
      jobLines: [],
      jobLinesFetchStatus: error instanceof SupabaseRestError ? error.status : null,
      jobLinesError: error instanceof Error ? error.message : 'Error desconocido cargando job_lines.',
    }))

    if (!hasRecoverableJobLinesFailure) {
      throw error
    }

    return attachJobLinesToJobs(loadedJobs, new Map())
  }
}

export async function listInvoices(): Promise<InvoiceListItem[]> {
  let loadedInvoices: InvoiceListItem[]

  try {
    loadedInvoices = await fetchSupabaseRestList<InvoiceListItem>(
      'invoices?select=id,display_code,invoice_number,job_id,quote_id,client_id,property_id,issue_date,status,created_at,archived_at,deleted_at,cancelled_at,cancel_reason,updated_at,subtotal,tax_amount,total,notes,internal_notes,pricing_metadata&order=created_at.desc',
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const hasRecoverableSchemaMismatch =
      message.includes('REST 400')
      && (
        message.includes('property_id')
        || message.includes('internal_notes')
        || message.includes('pricing_metadata')
      )

    if (!hasRecoverableSchemaMismatch) {
      throw error
    }

    const legacyInvoices = await fetchSupabaseRestList<Array<
      Pick<InvoiceListItem, 'id' | 'display_code' | 'invoice_number' | 'job_id' | 'client_id' | 'issue_date' | 'status' | 'subtotal' | 'tax_amount' | 'total' | 'notes'>
      & { quote_id?: string | null }
    >[number]>(
      'invoices?select=id,display_code,invoice_number,job_id,quote_id,client_id,issue_date,status,created_at,archived_at,deleted_at,cancelled_at,cancel_reason,updated_at,subtotal,tax_amount,total,notes&order=created_at.desc',
    )

    loadedInvoices = legacyInvoices.map((invoice) => ({
      ...invoice,
      quote_id: invoice.quote_id ?? null,
      property_id: null,
      internal_notes: null,
      pricing_metadata: {},
    }))
  }

  const invoiceLines = await fetchSupabaseRestList<NonNullable<InvoiceListItem['lines']>[number]>('invoice_lines?select=id,invoice_id,sort_order,concept,quantity,unit,unit_price,line_subtotal,created_at&order=sort_order.asc')
  const linesByInvoiceId = groupInvoiceLines(invoiceLines)

  return loadedInvoices.map((invoice) => ({
    ...invoice,
    lines: linesByInvoiceId.get(invoice.id) ?? [],
  }))
}

export async function listPayments(): Promise<PaymentListItem[]> {
  return fetchSupabaseRestList<PaymentListItem>('payments?select=id,display_code,invoice_id,payment_date,created_at,amount,payment_method,origin_type,notes&order=created_at.desc')
}

export async function listRecurringInvoicePlans(): Promise<RecurringInvoicePlanListItem[]> {
  return fetchSupabaseRestList<RecurringInvoicePlanListItem>('recurring_invoice_plans?select=id,client_id,property_id,quote_id,title,frequency,status,default_invoice_status,next_issue_date,last_issued_at,tax_rate,notes,internal_notes,pricing_metadata,template_lines,created_at,updated_at&order=next_issue_date.asc')
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
