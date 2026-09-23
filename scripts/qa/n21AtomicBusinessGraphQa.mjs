import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { recoverAuthenticatedQaSession } from './auth/recoveredQaSession.mjs'

const runId = crypto.randomUUID().replaceAll('-', '')
const prefix = `QA_N2_FUNC_${runId}_`
const id = (kind, label) => `${kind}-${prefix}${label}`
const today = new Date().toISOString().slice(0, 10)

async function main() {
  const recovered = await recoverAuthenticatedQaSession()
  if (recovered.projectRef !== 'kpvvydthlxupjjqqdpxy' || !recovered.authenticatedUserPresent) throw new Error('N21_AUTH_OR_PROJECT_GATE_FAILED')
  const client = createClient(recovered.supabaseUrl, recovered.supabaseAnonKey, { accessToken: async () => recovered.accessToken, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  const created = { clients: [], properties: [], invoices: [], jobs: [], payments: [] }
  async function rpc(name, args) { const { data, error } = await client.rpc(name, args); if (error) throw new Error(`${name}: ${error.message}`); return Array.isArray(data) && data.length === 1 ? data[0] : data }
  async function read(table, value) { const { data, error } = await client.from(table).select('*').eq('id', value).maybeSingle(); if (error || !data) throw new Error(`READBACK_${table}_${value}`); return data }
  async function createClientFixture(label = 'PRIMARY') { const value = { id: id('CLIENT', label), full_name: `${prefix}CLIENT-${label}`, phone: '600000000', email: `${runId}-${label}@qa.invalid`, tax_id: `QA${runId.slice(0, 8)}${label.slice(0, 1)}`, billing_address: `${prefix} address`, status: 'active' }; await rpc('create_client', { p_client: value }); created.clients.push(value.id); return read('clients', value.id) }
  async function createProperty(owner, label) { const value = { id: id('PROPERTY', label), client_id: owner.id, name: `${prefix}${label}`, property_type: 'apartment', address: `${prefix}${label}`, city: 'Barcelona', postal_code: '08001', notes: prefix }; await rpc('create_property', { p_property: value }); created.properties.push(value.id); return read('properties', value.id) }
  async function graph(owner, property, label, operationKey, lines = 2) { const invoiceId = id('INVOICE', label); const payloadLines = Array.from({ length: lines }, (_, index) => ({ id: id('INVOICE-LINE', `${label}-${index + 1}`), invoice_id: invoiceId, sort_order: index + 1, concept: `${prefix}${label}-${index + 1}`, quantity: 1, unit: 'servicio', unit_price: 50, line_subtotal: 50 })); const result = await rpc('save_invoice_business_graph', { p_request: { operation_key: operationKey, service_origin: 'AUTO_CREATE', service_date: today, invoice: { id: invoiceId, client_id: owner.id, property_id: property.id, quote_id: null, job_id: null, issue_date: today, status: 'draft', subtotal: lines * 50, tax_amount: lines * 10.5, total: lines * 60.5, notes: prefix, pricing_metadata: {} }, lines: payloadLines } }); created.invoices.push(invoiceId); created.jobs.push(result.job_id); return { result, invoice: await read('invoices', invoiceId), job: await read('jobs', result.job_id), payloadLines, lines: (await client.from('job_lines').select('*').eq('job_id', result.job_id).order('sort_order')).data }
  }
  try {
    const owner = await createClientFixture(); const property = await createProperty(owner, 'PRIMARY'); const otherOwner = await createClientFixture('OTHER'); const otherProperty = await createProperty(otherOwner, 'SECONDARY')
    const first = await graph(owner, property, 'AUTO', `${prefix}OP_AUTO`, 2)
    if (first.invoice.job_id !== first.job.id || first.lines?.length !== 2 || first.job.source_metadata?.source !== 'invoice_auto_service') throw new Error('N21_AUTO_CREATE_PARITY_FAILED')
    const retry = await rpc('save_invoice_business_graph', { p_request: { operation_key: `${prefix}OP_AUTO`, service_origin: 'AUTO_CREATE', service_date: today, invoice: { id: first.invoice.id, client_id: owner.id, property_id: property.id, quote_id: null, job_id: null, issue_date: today, status: 'draft', subtotal: 100, tax_amount: 21, total: 121, notes: prefix, pricing_metadata: {} }, lines: first.payloadLines } })
    if (retry.job_id !== first.job.id) throw new Error('N21_IDEMPOTENT_RETRY_FAILED')
    const settlement = await rpc('settle_invoice_business', { p_request: { invoice_id: first.invoice.id, payment_method: 'transfer', payment_date: today, operation_key: `${prefix}SETTLE` } }); const settlementRetry = await rpc('settle_invoice_business', { p_request: { invoice_id: first.invoice.id, payment_method: 'transfer', payment_date: today, operation_key: `${prefix}SETTLE` } }); if (!settlement.created_payment || settlementRetry.payment_id !== settlement.payment_id) throw new Error('N21_SETTLEMENT_IDEMPOTENCY_FAILED'); created.payments.push(settlement.payment_id)
    let rejected = false; try { await graph(owner, otherProperty, 'WRONG_PROPERTY', `${prefix}OP_WRONG_PROPERTY`, 1) } catch { rejected = true } if (!rejected) throw new Error('N21_RELATION_GUARD_FAILED')
    process.stdout.write(JSON.stringify({ N21_QA: 'PASS', RUN_ID: runId, AUTO_CREATE: 'PASS', LINE_PARITY: first.lines?.length === 2 ? 'PASS' : 'FAIL', IDEMPOTENCY: 'PASS', SETTLEMENT: 'PASS', RELATION_GUARD: 'PASS', CREATED: created }, null, 2) + '\n')
  } finally {
    const cleanup = await rpc('qa_cleanup_financial_fixtures', { p_run_id: runId })
    process.stderr.write(JSON.stringify({ CLEANUP: cleanup, OPERATION_ROWS_REQUIRE_PRIVILEGED_TEARDOWN: true }) + '\n')
  }
}

main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1 })
