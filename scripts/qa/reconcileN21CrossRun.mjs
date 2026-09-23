import { createClient } from '@supabase/supabase-js'
import { recoverAuthenticatedQaSession } from './auth/recoveredQaSession.mjs'

const runs = ['13131313131313131313131313131313', '26262626262626262626262626262626']
const tokens = runs.map((run) => `QA_N2_FUNC_${run}`)
const session = await recoverAuthenticatedQaSession()
const db = createClient(session.supabaseUrl, session.supabaseAnonKey, {
  accessToken: async () => session.accessToken,
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

async function rows(table, query) {
  const result = await query
  if (result.error) {
    if (table === 'invoice_business_operations' || table === 'invoice_settlement_operations') return []
    throw new Error(`${table}: ${result.error.message}`)
  }
  return result.data ?? []
}

function idRun(value) {
  const text = JSON.stringify(value ?? '')
  return runs.find((run) => text.includes(`QA_N2_FUNC_${run}`)) ?? null
}

const clients = await rows('clients', db.from('clients').select('id,full_name,email,status').or(tokens.map((token) => `full_name.ilike.${token}_%,email.ilike.${token.replace('QA_N2_FUNC_', '')}%@qa.invalid`).join(',')))
const clientIds = clients.map((row) => row.id)
const properties = clientIds.length ? await rows('properties', db.from('properties').select('id,client_id,name,notes,status').in('client_id', clientIds)) : []
const quotes = clientIds.length ? await rows('quotes', db.from('quotes').select('id,client_id,property_id,notes,pricing_metadata,status').in('client_id', clientIds)) : []
const jobs = clientIds.length ? await rows('jobs', db.from('jobs').select('id,client_id,property_id,quote_id,notes,source_metadata,status').in('client_id', clientIds)) : []
const invoices = await rows('invoices', db.from('invoices').select('id,client_id,property_id,job_id,quote_id,notes,internal_notes,pricing_metadata,status,invoice_number,display_code').or(tokens.map((token) => `id.ilike.INVOICE-${token}_%,notes.ilike.${token}_%,internal_notes.ilike.${token}_%`).join(',')))
const invoiceIds = invoices.map((row) => row.id)
const quoteIds = quotes.map((row) => row.id)
const jobIds = jobs.map((row) => row.id)
const invoiceLines = invoiceIds.length ? await rows('invoice_lines', db.from('invoice_lines').select('id,invoice_id').in('invoice_id', invoiceIds)) : []
const jobLines = jobIds.length ? await rows('job_lines', db.from('job_lines').select('id,job_id').in('job_id', jobIds)) : []
const quoteLines = quoteIds.length ? await rows('quote_lines', db.from('quote_lines').select('id,quote_id').in('quote_id', quoteIds)) : []
const payments = invoiceIds.length ? await rows('payments', db.from('payments').select('id,invoice_id,amount,payment_date').in('invoice_id', invoiceIds)) : []
const auditEvents = [...invoiceIds, ...jobIds, ...quoteIds, ...clientIds, ...properties.map((row) => row.id)].length
  ? await rows('audit_events', db.from('audit_events').select('id,entity_id').in('entity_id', [...invoiceIds, ...jobIds, ...quoteIds, ...clientIds, ...properties.map((row) => row.id)]))
  : []
const operations = await rows('invoice_business_operations', db.from('invoice_business_operations').select('operation_key,payload,result').limit(1000))
const settlementOperations = await rows('invoice_settlement_operations', db.from('invoice_settlement_operations').select('operation_key,payload,result').limit(1000))
const matchedOperations = operations.filter((row) => idRun(row.operation_key) || idRun(row.payload))
const matchedSettlementOperations = settlementOperations.filter((row) => idRun(row.operation_key) || idRun(row.payload))

const entities = [
  ...clients.map((row) => ({ table: 'clients', id: row.id, run: idRun(row), kind: 'root' })),
  ...properties.map((row) => ({ table: 'properties', id: row.id, run: idRun(row), client_id: row.client_id })),
  ...quotes.map((row) => ({ table: 'quotes', id: row.id, run: idRun(row), client_id: row.client_id })),
  ...quoteLines.map((row) => ({ table: 'quote_lines', id: row.id, run: idRun(row.quote_id), quote_id: row.quote_id })),
  ...jobs.map((row) => ({ table: 'jobs', id: row.id, run: idRun(row), client_id: row.client_id, quote_id: row.quote_id })),
  ...jobLines.map((row) => ({ table: 'job_lines', id: row.id, run: idRun(row.job_id), job_id: row.job_id })),
  ...invoices.map((row) => ({ table: 'invoices', id: row.id, run: idRun(row.notes) ?? idRun(row.pricing_metadata) ?? idRun(row.id), client_id: row.client_id, property_id: row.property_id, job_id: row.job_id, quote_id: row.quote_id, status: row.status, invoice_number: row.invoice_number, display_code: row.display_code })),
  ...invoiceLines.map((row) => ({ table: 'invoice_lines', id: row.id, run: idRun(row.invoice_id), invoice_id: row.invoice_id })),
  ...payments.map((row) => ({ table: 'payments', id: row.id, run: idRun(row.invoice_id), invoice_id: row.invoice_id, amount: row.amount })),
  ...auditEvents.map((row) => ({ table: 'audit_events', id: row.id, run: idRun(row.entity_id), entity_id: row.entity_id })),
  ...matchedOperations.map((row) => ({ table: 'invoice_business_operations', id: row.operation_key, run: idRun(row.operation_key) ?? idRun(row.payload) })),
  ...matchedSettlementOperations.map((row) => ({ table: 'invoice_settlement_operations', id: row.operation_key, run: idRun(row.operation_key) ?? idRun(row.payload) })),
]

const crossRun = invoices.map((invoice) => ({
  invoice_id: invoice.id,
  invoice_run: idRun(invoice.notes) ?? idRun(invoice.pricing_metadata) ?? idRun(invoice.id),
  client_run: idRun(invoice.client_id) ?? idRun(clients.find((client) => client.id === invoice.client_id)),
  property_run: idRun(invoice.property_id) ?? idRun(properties.find((property) => property.id === invoice.property_id)),
  job: jobs.find((job) => job.id === invoice.job_id) ?? null,
  payments: payments.filter((payment) => payment.invoice_id === invoice.id).map((payment) => payment.id),
  line_count: invoiceLines.filter((line) => line.invoice_id === invoice.id).length,
}))

console.log(JSON.stringify({
  runs,
  counts: { clients: clients.length, properties: properties.length, quotes: quotes.length, quoteLines: quoteLines.length, jobs: jobs.length, jobLines: jobLines.length, invoices: invoices.length, invoiceLines: invoiceLines.length, payments: payments.length, auditEvents: auditEvents.length, operations: matchedOperations.length, settlementOperations: matchedSettlementOperations.length },
  entities,
  crossRun,
}, null, 2))
