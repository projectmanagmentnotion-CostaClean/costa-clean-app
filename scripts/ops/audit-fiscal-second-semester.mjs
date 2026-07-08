import fs from 'node:fs'
import path from 'node:path'
import { buildFiscalSemesterAuditSummary } from '../../src/features/closing/fiscalSemesterAudit.ts'

function loadEnvFile(filename) {
  const filePath = path.join(process.cwd(), filename)
  if (!fs.existsSync(filePath)) return {}

  const raw = fs.readFileSync(filePath, 'utf8')
  const env = {}

  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue
    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) continue
    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim()
    env[key] = value
  }

  return env
}

function getEnvValue(name, loadedEnv) {
  return process.env[name] || loadedEnv[name] || ''
}

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
}

function formatMoney(value) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

async function fetchSupabaseList(baseUrl, apiKey, query) {
  const response = await fetch(`${baseUrl}/rest/v1/${query}`, {
    method: 'GET',
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
  })

  if (!response.ok) {
    throw new Error(`REST ${response.status}: ${await response.text()}`)
  }

  return response.json()
}

function buildInvoiceLinesMap(lines) {
  const linesByInvoiceId = new Map()

  for (const line of lines) {
    const currentLines = linesByInvoiceId.get(line.invoice_id) ?? []
    currentLines.push({
      id: line.id,
      invoice_id: line.invoice_id,
      sort_order: Number(line.sort_order ?? 0),
      concept: line.concept,
      quantity: Number(line.quantity ?? 0),
      unit: line.unit,
      unit_price: Number(line.unit_price ?? 0),
      line_subtotal: Number(line.line_subtotal ?? 0),
    })
    linesByInvoiceId.set(line.invoice_id, currentLines)
  }

  return linesByInvoiceId
}

function getLatestInvoiceYear(invoices) {
  return invoices
    .map((invoice) => Number(String(invoice.issue_date ?? '').slice(0, 4)))
    .filter((year) => Number.isFinite(year))
    .sort((left, right) => right - left)[0] ?? new Date().getFullYear()
}

function buildWarnings(auditSummary) {
  const warnings = []

  if (auditSummary.includedInvoices.length === 0) {
    warnings.push(`No hay facturas emitidas entre ${auditSummary.period.startDate} y ${auditSummary.period.endDate}.`)
  }

  for (const item of auditSummary.reviewItems) {
    warnings.push(`${item.reference}: ${item.message}`)
  }

  for (const invoice of auditSummary.excludedInvoices) {
    warnings.push(`${invoice.reference}: ${invoice.reason}`)
  }

  return warnings
}

async function main() {
  const loadedEnv = {
    ...loadEnvFile('.env.local'),
    ...loadEnvFile('.env'),
  }
  const supabaseUrl = getEnvValue('VITE_SUPABASE_URL', loadedEnv) || getEnvValue('SUPABASE_URL', loadedEnv)
  const supabaseKey =
    getEnvValue('VITE_SUPABASE_ANON_KEY', loadedEnv)
    || getEnvValue('SUPABASE_ANON_KEY', loadedEnv)
    || getEnvValue('SUPABASE_SERVICE_ROLE_KEY', loadedEnv)

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase env. Expected VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY or equivalent.')
  }

  const invoices = await fetchSupabaseList(
    supabaseUrl,
    supabaseKey,
    'invoices?select=id,display_code,invoice_number,job_id,quote_id,client_id,property_id,issue_date,status,created_at,archived_at,deleted_at,cancelled_at,cancel_reason,updated_at,subtotal,tax_amount,total,notes,internal_notes,pricing_metadata&order=issue_date.desc&limit=5000',
  )
  const payments = await fetchSupabaseList(
    supabaseUrl,
    supabaseKey,
    'payments?select=id,display_code,invoice_id,payment_date,created_at,amount,payment_method,origin_type,notes&limit=5000',
  )
  const clients = await fetchSupabaseList(
    supabaseUrl,
    supabaseKey,
    'clients?select=id,display_code,created_at,full_name,phone,email,tax_id,billing_address,status,archived_at,deleted_at,source_lead_id&limit=5000',
  )
  const invoiceLines = await fetchSupabaseList(
    supabaseUrl,
    supabaseKey,
    'invoice_lines?select=id,invoice_id,sort_order,concept,quantity,unit,unit_price,line_subtotal,created_at&limit=20000',
  )

  const linesByInvoiceId = buildInvoiceLinesMap(invoiceLines)
  const hydratedInvoices = invoices.map((invoice) => ({
    ...invoice,
    subtotal: Number(invoice.subtotal ?? 0),
    tax_amount: Number(invoice.tax_amount ?? 0),
    total: Number(invoice.total ?? 0),
    paid_amount: invoice.paid_amount === null || invoice.paid_amount === undefined ? null : Number(invoice.paid_amount),
    lines: linesByInvoiceId.get(invoice.id) ?? [],
  }))

  const year = Number(process.argv[2]) || getLatestInvoiceYear(hydratedInvoices)
  const auditSummary = buildFiscalSemesterAuditSummary({
    year,
    invoices: hydratedInvoices,
    payments,
    clients,
  })

  const warnings = buildWarnings(auditSummary)
  const result = {
    year: auditSummary.year,
    period: auditSummary.period,
    emitted_statuses: [...auditSummary.emittedStatuses],
    included_invoice_count: auditSummary.totals.invoiceCount,
    excluded_invoice_count: auditSummary.excludedInvoices.length,
    totals: {
      base_amount: auditSummary.totals.baseAmount,
      vat_amount: auditSummary.totals.vatAmount,
      total_amount: auditSummary.totals.totalAmount,
      paid_amount: auditSummary.totals.paidAmount,
      pending_amount: auditSummary.totals.pendingAmount,
    },
    status_breakdown: auditSummary.statusBreakdown,
    review_items: auditSummary.reviewItems,
    excluded_invoices: auditSummary.excludedInvoices,
    included_invoices: auditSummary.includedInvoices,
    warnings,
  }

  console.log(`Periodo auditado: ${auditSummary.period.label} (${auditSummary.period.startDate} -> ${auditSummary.period.endDate})`)
  console.log(`Facturas emitidas incluidas: ${auditSummary.totals.invoiceCount}`)
  console.log(`Base imponible: ${formatMoney(auditSummary.totals.baseAmount)}`)
  console.log(`IVA: ${formatMoney(auditSummary.totals.vatAmount)}`)
  console.log(`Total facturado: ${formatMoney(auditSummary.totals.totalAmount)}`)
  console.log(`Cobrado: ${formatMoney(auditSummary.totals.paidAmount)}`)
  console.log(`Pendiente: ${formatMoney(auditSummary.totals.pendingAmount)}`)

  if (auditSummary.includedInvoices.length > 0) {
    console.table(auditSummary.includedInvoices.map((invoice) => ({
      factura: invoice.reference,
      cliente: invoice.clientLabel,
      fecha: invoice.issueDate,
      base: roundMoney(invoice.baseAmount),
      iva: roundMoney(invoice.vatAmount),
      total: roundMoney(invoice.totalAmount),
      estado: invoice.status,
      cobrado: roundMoney(invoice.paidAmount),
      pendiente: roundMoney(invoice.pendingAmount),
    })))
  }

  if (warnings.length > 0) {
    console.log('Advertencias:')
    for (const warning of warnings) {
      console.log(`- ${warning}`)
    }
  }

  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
