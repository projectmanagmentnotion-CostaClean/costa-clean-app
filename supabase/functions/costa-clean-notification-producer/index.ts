import { createClient } from 'npm:@supabase/supabase-js@2.99.2'
import { buildProducerConditions, isAuthorizedProducerToken, produceReminders } from '../_shared/notificationProducers.mjs'

const runtime = globalThis as typeof globalThis & { Deno?: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Response | Promise<Response>): void } }
if (!runtime.Deno) throw new Error('Supabase Edge runtime is unavailable.')
const env = (name: string) => runtime.Deno?.env.get(name) ?? ''
const thresholds = { unpaidInvoicesOlderThanDays: 7, completedJobsWithoutInvoiceOlderThanDays: 2, acceptedQuotesWithoutJobOlderThanDays: 3 }

function json(status: number, body: Record<string, unknown>) { return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }) }
function authorized(request: Request) { return isAuthorizedProducerToken({ token: request.headers.get('authorization')?.replace(/^Bearer\s+/u, '') ?? '', secret: env('COSTA_CLEAN_NOTIFICATION_PRODUCER_SECRET'), serviceRoleKey: env('SUPABASE_SERVICE_ROLE_KEY') }) }
function requiredEnv(name: string) { const value = env(name); if (!value) throw new Error(`${name}_MISSING`); return value }
async function rows(supabase: ReturnType<typeof createClient>, table: string, select: string) { const { data, error } = await supabase.from(table).select(select); if (error) throw error; return data ?? [] }

async function produce() {
  const supabase = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'))
  const [invoices, payments, expenses, jobs, quotes, memberships, decisions] = await Promise.all([
    rows(supabase, 'invoices', 'id,job_id,issue_date,status,total,archived_at,deleted_at,cancelled_at'),
    rows(supabase, 'payments', 'invoice_id,amount,archived_at,deleted_at,cancelled_at'),
    rows(supabase, 'expenses', 'id,document_support_status,receipt_file_path,archived_at,deleted_at,cancelled_at'),
    rows(supabase, 'jobs', 'id,quote_id,scheduled_date,status,archived_at,deleted_at,cancelled_at'),
    rows(supabase, 'quotes', 'id,created_at,status,archived_at,deleted_at,cancelled_at'),
    rows(supabase, 'internal_staff_memberships', 'user_id,status,revoked_at'),
    rows(supabase, 'operational_alert_decisions', 'alert_key,fingerprint,scope,user_id,status'),
  ])
  const invoiceByJob = new Map(invoices.filter((invoice) => invoice.job_id).map((invoice) => [invoice.job_id, invoice.id]))
  const jobByQuote = new Map(jobs.filter((job) => job.quote_id).map((job) => [job.quote_id, job.id]))
  const conditions = buildProducerConditions({
    invoices,
    payments,
    expenses,
    jobs: jobs.map((job) => ({ ...job, invoice_id: invoiceByJob.get(job.id) ?? null })),
    quotes: quotes.map((quote) => ({ ...quote, job_id: jobByQuote.get(quote.id) ?? null })),
    thresholds,
  })
  const users = memberships.filter((membership) => membership.status === 'active' && !membership.revoked_at).map((membership) => membership.user_id).filter(Boolean)
  const result = await produceReminders({ conditions, users, decisions, insertReminder: async (reminder) => {
    const { error } = await supabase.from('notification_reminders').insert(reminder)
    if (error) throw error
  } })
  return result
}

runtime.Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' })
  if (!authorized(request)) return json(401, { error: 'unauthorized' })
  try { return json(200, await produce()) } catch (error) {
    console.error(JSON.stringify({ event: 'notification_producer_failed', errorCode: error instanceof Error ? error.message : 'UNKNOWN' }))
    return json(500, { error: 'producer_failed' })
  }
})
