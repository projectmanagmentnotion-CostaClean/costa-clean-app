import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const QA_PREFIX = 'QA_CERT_'

function id(kind, runId, label) {
  return `${kind}-${runId}-${label}-${crypto.randomUUID()}`
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

export async function createQaFinancialFixtures({ runId = crypto.randomUUID() } = {}) {
  const url = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const email = process.env.COSTACLEAN_QA_AUTH_EMAIL
  const password = process.env.COSTACLEAN_QA_AUTH_PASSWORD
  if (!url || !anonKey || !email || !password) throw new Error('QA_FINANCIAL_FIXTURE_ENV_MISSING')

  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: auth, error: authError } = await client.auth.signInWithPassword({ email, password })
  if (authError || !auth.session) throw new Error(`QA_FINANCIAL_FIXTURE_AUTH_FAILED ${authError?.message || ''}`)

  const created = { runId, prefix: `${QA_PREFIX}${runId}_`, clients: [], properties: [], jobs: [], quotes: [], invoices: [], payments: [], recurringPlans: [] }

  async function rpc(name, args) {
    const { data, error } = await client.rpc(name, args)
    if (error) throw new Error(`${name}: ${error.message}`)
    return Array.isArray(data) && data.length === 1 ? data[0] : data
  }

  async function rpcWithFallback(names, args) {
    let lastError
    for (const name of names) {
      try {
        return await rpc(name, args)
      } catch (error) {
        lastError = error
      }
    }
    throw lastError
  }

  async function read(table, idValue) {
    const { data, error } = await client.from(table).select('*').eq('id', idValue).maybeSingle()
    if (error || !data) throw new Error(`READBACK ${table}/${idValue}: ${error?.message || 'missing'}`)
    return data
  }

  async function clientFixture(label) {
    const value = { id: id('CLIENT', runId, label), full_name: `${created.prefix}${label}`, phone: '600000000', email: `${runId}.${label.toLowerCase()}@qa.invalid`, tax_id: `QA${String(created.clients.length + 1).padStart(6, '0')}X`, billing_address: `${created.prefix}${label} address`, status: 'active' }
    const row = await rpc('create_client', { p_client: value })
    created.clients.push(row.id || value.id)
    return await read('clients', row.id || value.id)
  }

  async function propertyFixture(owner, label) {
    const value = { id: id('PROPERTY', runId, label), client_id: owner.id, name: `${created.prefix}${label}`, property_type: 'apartment', address: `${created.prefix}${label} address`, city: 'Barcelona', postal_code: '08001', notes: created.prefix }
    const row = await rpc('create_property', { p_property: value })
    created.properties.push(row.id || value.id)
    return await read('properties', row.id || value.id)
  }

  async function jobFixture(owner, property, label, withInvoice = false) {
    const jobId = id('JOB', runId, label)
    const lineId = id('JOB-LINE', runId, label)
    const value = { id: jobId, client_id: owner.id, property_id: property.id, quote_id: null, scheduled_date: today(), status: 'scheduled', service_type: 'standard_cleaning', billing_concept: `${created.prefix}${label}`, billing_quantity: 1, billing_unit: 'servicio', billing_unit_price: 100, notes: created.prefix }
    await rpc('save_job_with_lines', { p_job: value, p_lines: [{ id: lineId, job_id: jobId, sort_order: 1, concept: value.billing_concept, quantity: 1, unit: 'servicio', unit_price: 100, line_subtotal: 100 }] })
    created.jobs.push(jobId)
    return { ...(await read('jobs', jobId)), withInvoice }
  }

  async function quoteFixture(owner, property, label, status = 'draft') {
    const quoteId = id('QUOTE', runId, label)
    const value = { id: quoteId, client_id: owner.id, lead_id: null, property_id: property?.id ?? null, status, subtotal: 100, tax_amount: 21, total: 121, notes: created.prefix }
    await rpc('save_quote_with_lines', { p_quote: value, p_lines: [{ id: id('QUOTE-LINE', runId, label), quote_id: quoteId, sort_order: 1, concept: `${created.prefix}${label}`, quantity: 1, unit: 'servicio', unit_price: 100, line_subtotal: 100 }] })
    created.quotes.push(quoteId)
    return await read('quotes', quoteId)
  }

  async function invoiceFixture(owner, property, job, label) {
    const invoiceId = id('INVOICE', runId, label)
    const value = { id: invoiceId, client_id: owner.id, job_id: job?.id ?? null, property_id: property?.id ?? null, quote_id: null, issue_date: today(), status: 'draft', subtotal: 100, tax_amount: 21, total: 121, notes: created.prefix }
    await rpcWithFallback(['save_invoice_with_lines_v2', 'save_invoice_with_lines'], { p_invoice: value, p_lines: [{ id: id('BILLING-LINE', runId, label), invoice_id: invoiceId, sort_order: 1, concept: `${created.prefix}${label}`, quantity: 1, unit: 'servicio', unit_price: 100, line_subtotal: 100 }] })
    created.invoices.push(invoiceId)
    return await read('invoices', invoiceId)
  }

  async function acceptQuote(quoteId, invoiceId) {
    const result = await rpc('accept_quote_workflow', {
      p_quote_id: quoteId,
      p_create_invoice: true,
      p_invoice_id: invoiceId,
      p_issue_date: today(),
    })
    if (!result?.invoice_id) throw new Error('accept_quote_workflow: invoice_id_missing')
    created.invoices.push(result.invoice_id)
    return { result, quote: await read('quotes', quoteId), invoice: await read('invoices', result.invoice_id) }
  }

  async function recurringPlanFixture(owner, property, label) {
    const planId = id('RECURRING', runId, label)
    const plan = await rpc('save_client_recurring_invoice_plan', {
      p_plan: {
        id: planId,
        client_id: owner.id,
        property_id: property?.id ?? null,
        quote_id: null,
        title: `${created.prefix}${label}`,
        frequency: 'monthly',
        status: 'active',
        default_invoice_status: 'draft',
        next_issue_date: today(),
        tax_rate: 0.21,
        notes: created.prefix,
        internal_notes: created.prefix,
        pricing_metadata: { qa_run_id: runId },
        template_lines: [{ concept: `${created.prefix}${label} line`, quantity: 1, unit: 'servicio', unit_price: 100, line_subtotal: 100 }],
      },
    })
    created.recurringPlans.push(plan.id || planId)
    return await read('recurring_invoice_plans', plan.id || planId)
  }

  async function issueRecurringPlan(planId, invoiceId) {
    const result = await rpc('generate_invoice_from_recurring_plan', {
      p_plan_id: planId,
      p_invoice_id: invoiceId,
      p_issue_date: today(),
    })
    if (!result?.invoice_id) throw new Error('generate_invoice_from_recurring_plan: invoice_id_missing')
    created.invoices.push(result.invoice_id)
    return { result, invoice: await read('invoices', result.invoice_id) }
  }

  async function settleInvoice(invoiceId) {
    const result = await rpc('settle_invoice_by_transfer', { p_invoice_id: invoiceId })
    if (!result?.payment_id) throw new Error('settle_invoice_by_transfer: payment_id_missing')
    created.payments.push(result.payment_id)
    return { result, payment: await read('payments', result.payment_id), invoice: await read('invoices', invoiceId) }
  }

  async function cleanup() {
    const result = await rpc('qa_cleanup_financial_fixtures', { p_run_id: runId })
    return { cleaned: result, failures: [] }
  }

  return { client, session: auth.session, user: auth.user, created, clientFixture, propertyFixture, jobFixture, quoteFixture, invoiceFixture, acceptQuote, recurringPlanFixture, issueRecurringPlan, settleInvoice, read, cleanup }
}
