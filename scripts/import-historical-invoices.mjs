import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const EXPECTED_FIRST = 1
const EXPECTED_LAST = 25
const TAX_RATE = 0.21
const IMPORT_PREFIX = 'HIST'
const DEFAULT_DATA_PATH = 'data/historical-invoices-2026.json'

function parseArgs(argv) {
  const options = {
    apply: false,
    dryRun: true,
    replaceImported: false,
    dataPath: DEFAULT_DATA_PATH,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--apply') {
      options.apply = true
      options.dryRun = false
    } else if (arg === '--dry-run') {
      options.apply = false
      options.dryRun = true
    } else if (arg === '--replace-imported') {
      options.replaceImported = true
    } else if (arg === '--data') {
      options.dataPath = argv[index + 1]
      index += 1
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (options.replaceImported && !options.apply) {
    throw new Error('--replace-imported requires --apply')
  }

  return options
}

function hashId(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 16).toUpperCase()
}

function expectedInvoiceNumbers() {
  return Array.from({ length: EXPECTED_LAST - EXPECTED_FIRST + 1 }, (_, index) => {
    const invoiceNumber = EXPECTED_FIRST + index
    return `2026-${String(invoiceNumber).padStart(3, '0')}`
  })
}

function toCents(value, fieldName) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round((value + Number.EPSILON) * 100)
  }

  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${fieldName} must be a decimal string or number`)
  }

  const normalized = value.trim().replace(',', '.')
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`${fieldName} must have at most 2 decimal places: ${value}`)
  }

  const [wholePart, decimalPart = ''] = normalized.split('.')
  const sign = wholePart.startsWith('-') ? -1 : 1
  const whole = Number(wholePart.replace('-', ''))
  const cents = Number(decimalPart.padEnd(2, '0'))

  if (!Number.isInteger(whole) || !Number.isInteger(cents)) {
    throw new Error(`${fieldName} is not a valid money value: ${value}`)
  }

  return sign * ((whole * 100) + cents)
}

function centsToNumber(cents) {
  return Number((cents / 100).toFixed(2))
}

function decimalToNumber(value, fieldName) {
  const normalized = typeof value === 'number' ? String(value) : String(value ?? '').trim().replace(',', '.')
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} is not a valid decimal: ${value}`)
  }
  return Number(parsed.toFixed(2))
}

function assertDate(value, fieldName) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${fieldName} must be YYYY-MM-DD`)
  }

  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${fieldName} is not a valid date: ${value}`)
  }
}

function importIds(invoice) {
  const clientHash = hashId(invoice.client_name)
  const propertyKey = invoice.property?.key || invoice.property?.address || invoice.property?.name || 'support-property'

  return {
    clientId: `${IMPORT_PREFIX}-CLIENT-${clientHash}`,
    propertyId: `${IMPORT_PREFIX}-PROPERTY-${hashId(`${invoice.client_name}|${propertyKey}`)}`,
    jobId: `${IMPORT_PREFIX}-JOB-${invoice.invoice_number}`,
    invoiceId: `${IMPORT_PREFIX}-INVOICE-${invoice.invoice_number}`,
    paymentId: `${IMPORT_PREFIX}-PAYMENT-${invoice.invoice_number}`,
  }
}

function normalizeInvoice(rawInvoice) {
  if (!rawInvoice || typeof rawInvoice !== 'object') {
    throw new Error('Each invoice must be an object')
  }

  const invoiceNumber = rawInvoice.invoice_number
  if (typeof invoiceNumber !== 'string' || !/^2026-\d{3}$/.test(invoiceNumber)) {
    throw new Error(`Invalid invoice_number: ${invoiceNumber}`)
  }

  const clientName = rawInvoice.client_name
  if (typeof clientName !== 'string' || !clientName.trim()) {
    throw new Error(`${invoiceNumber}: client_name is required`)
  }

  if (clientName !== clientName.trim()) {
    throw new Error(`${invoiceNumber}: client_name has leading/trailing whitespace`)
  }

  assertDate(rawInvoice.issue_date, `${invoiceNumber}.issue_date`)
  if (rawInvoice.paid_date) {
    assertDate(rawInvoice.paid_date, `${invoiceNumber}.paid_date`)
  }

  if (!Array.isArray(rawInvoice.lines) || rawInvoice.lines.length === 0) {
    throw new Error(`${invoiceNumber}: at least one line is required`)
  }

  const normalizedLines = rawInvoice.lines.map((line, index) => {
    if (!line || typeof line !== 'object') {
      throw new Error(`${invoiceNumber}: line ${index + 1} must be an object`)
    }

    const concept = String(line.concept ?? '').trim()
    if (!concept) {
      throw new Error(`${invoiceNumber}: line ${index + 1} concept is required`)
    }

    const quantity = decimalToNumber(line.quantity ?? '1.00', `${invoiceNumber}.lines[${index}].quantity`)
    if (quantity <= 0) {
      throw new Error(`${invoiceNumber}: line ${index + 1} quantity must be > 0`)
    }

    const unitPriceCents = toCents(line.unit_price, `${invoiceNumber}.lines[${index}].unit_price`)
    if (unitPriceCents < 0) {
      throw new Error(`${invoiceNumber}: line ${index + 1} unit_price must be >= 0`)
    }

    const lineSubtotalCents = toCents(
      line.line_subtotal ?? (quantity * centsToNumber(unitPriceCents)).toFixed(2),
      `${invoiceNumber}.lines[${index}].line_subtotal`,
    )

    const calculatedLineSubtotalCents = Math.round(quantity * unitPriceCents)
    if (line.line_subtotal == null && lineSubtotalCents !== calculatedLineSubtotalCents) {
      throw new Error(`${invoiceNumber}: line ${index + 1} subtotal rounding mismatch`)
    }

    return {
      sort_order: index + 1,
      concept,
      quantity,
      unit: String(line.unit ?? 'servicio').trim() || 'servicio',
      unit_price: centsToNumber(unitPriceCents),
      line_subtotal: centsToNumber(lineSubtotalCents),
      line_subtotal_cents: lineSubtotalCents,
    }
  })

  const subtotalCents = normalizedLines.reduce((sum, line) => sum + line.line_subtotal_cents, 0)
  const taxAmountCents = rawInvoice.tax_amount == null
    ? Math.round(subtotalCents * TAX_RATE)
    : toCents(rawInvoice.tax_amount, `${invoiceNumber}.tax_amount`)
  const totalCents = rawInvoice.total == null
    ? subtotalCents + taxAmountCents
    : toCents(rawInvoice.total, `${invoiceNumber}.total`)

  if (rawInvoice.subtotal != null) {
    const explicitSubtotalCents = toCents(rawInvoice.subtotal, `${invoiceNumber}.subtotal`)
    if (explicitSubtotalCents !== subtotalCents) {
      throw new Error(`${invoiceNumber}: explicit subtotal does not equal line subtotal sum`)
    }
  }

  if (subtotalCents + taxAmountCents !== totalCents) {
    throw new Error(`${invoiceNumber}: subtotal + tax_amount must equal total`)
  }

  const normalizedInvoice = {
    invoice_number: invoiceNumber,
    issue_date: rawInvoice.issue_date,
    paid_date: rawInvoice.paid_date || rawInvoice.issue_date,
    client_name: clientName,
    client_phone: rawInvoice.client_phone ?? null,
    client_email: rawInvoice.client_email ?? null,
    property: rawInvoice.property ?? null,
    lines: normalizedLines,
    subtotal: centsToNumber(subtotalCents),
    tax_amount: centsToNumber(taxAmountCents),
    total: centsToNumber(totalCents),
    notes: rawInvoice.notes ?? null,
  }

  return {
    ...normalizedInvoice,
    ids: importIds(normalizedInvoice),
  }
}

function validateDataset(rawData) {
  const rawInvoices = Array.isArray(rawData) ? rawData : rawData.invoices
  if (!Array.isArray(rawInvoices)) {
    throw new Error('Data file must be an array or an object with an invoices array')
  }

  const invoices = rawInvoices.map(normalizeInvoice)
  const expected = expectedInvoiceNumbers()
  const invoiceNumbers = new Set(invoices.map((invoice) => invoice.invoice_number))
  const missing = expected.filter((invoiceNumber) => !invoiceNumbers.has(invoiceNumber))
  const unexpected = [...invoiceNumbers].filter((invoiceNumber) => !expected.includes(invoiceNumber))

  if (missing.length > 0 || unexpected.length > 0 || invoices.length !== expected.length) {
    throw new Error(`Expected exactly invoices ${expected[0]} through ${expected.at(-1)}. Missing: ${missing.join(', ') || 'none'}. Unexpected: ${unexpected.join(', ') || 'none'}. Count: ${invoices.length}`)
  }

  const duplicates = invoices
    .map((invoice) => invoice.invoice_number)
    .filter((invoiceNumber, index, all) => all.indexOf(invoiceNumber) !== index)
  if (duplicates.length > 0) {
    throw new Error(`Duplicate invoice numbers: ${[...new Set(duplicates)].join(', ')}`)
  }

  const invoice014 = invoices.find((invoice) => invoice.invoice_number === '2026-014')
  if (invoice014?.client_name !== 'ALCAPA SPORT SL') {
    throw new Error('2026-014 client_name must be exactly ALCAPA SPORT SL')
  }

  const invoice016 = invoices.find((invoice) => invoice.invoice_number === '2026-016')
  if (invoice016?.issue_date !== '2026-02-28') {
    throw new Error('2026-016 issue_date must be exactly 2026-02-28')
  }

  return invoices.sort((left, right) => left.invoice_number.localeCompare(right.invoice_number))
}

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY')
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

async function fetchExistingByIds(supabase, table, ids) {
  if (ids.length === 0) return new Map()
  const { data, error } = await supabase.from(table).select('*').in('id', ids)
  if (error) throw new Error(`${table} preflight failed: ${error.message}`)
  return new Map((data ?? []).map((row) => [row.id, row]))
}

async function fetchExistingInvoicesByNumber(supabase, invoiceNumbers) {
  const { data, error } = await supabase
    .from('invoices')
    .select('id,invoice_number,total,status')
    .in('invoice_number', invoiceNumbers)

  if (error) throw new Error(`invoices invoice_number preflight failed: ${error.message}`)
  return data ?? []
}

async function fetchExistingQuotes(supabase) {
  const { data, error } = await supabase
    .from('quotes')
    .select('id,display_code')
    .not('display_code', 'is', null)
    .order('display_code', { ascending: false })
    .limit(1)

  if (error) throw new Error(`quotes preflight failed: ${error.message}`)
  return data ?? []
}

async function preflight(supabase, invoices, options) {
  const invoiceNumbers = invoices.map((invoice) => invoice.invoice_number)
  const expectedInvoiceIds = new Set(invoices.map((invoice) => invoice.ids.invoiceId))
  const existingInvoicesByNumber = await fetchExistingInvoicesByNumber(supabase, invoiceNumbers)
  const conflictingInvoices = existingInvoicesByNumber.filter((invoice) => !expectedInvoiceIds.has(invoice.id))

  if (conflictingInvoices.length > 0) {
    throw new Error(`Non-import invoice_number conflicts found: ${conflictingInvoices.map((invoice) => `${invoice.invoice_number} (${invoice.id})`).join(', ')}`)
  }

  const existingImportInvoices = existingInvoicesByNumber.filter((invoice) => expectedInvoiceIds.has(invoice.id))
  if (existingImportInvoices.length > 0 && !options.replaceImported) {
    console.log(`Found ${existingImportInvoices.length} existing imported invoices. They will be verified/skipped. Use --replace-imported to recreate HIST-* invoice rows.`)
  }

  const quotes = await fetchExistingQuotes(supabase)
  if (quotes.length > 0) {
    console.log(`Quote display code preflight: current highest visible quote display_code is ${quotes[0].display_code}`)
  } else {
    console.log('Quote display code preflight: no visible quote display_code found.')
  }
}

async function upsertRows(supabase, table, rows, conflictTarget = 'id') {
  if (rows.length === 0) return
  const { error } = await supabase.from(table).upsert(rows, { onConflict: conflictTarget })
  if (error) throw new Error(`${table} upsert failed: ${error.message}`)
}

async function deleteImportedRowsForInvoices(supabase, invoices) {
  const invoiceIds = invoices.map((invoice) => invoice.ids.invoiceId)
  const jobIds = invoices.map((invoice) => invoice.ids.jobId)
  const propertyIds = [...new Set(invoices.map((invoice) => invoice.ids.propertyId))]
  const clientIds = [...new Set(invoices.map((invoice) => invoice.ids.clientId))]

  for (const [table, ids] of [
    ['payments', invoices.map((invoice) => invoice.ids.paymentId)],
    ['invoice_lines', invoiceIds],
  ]) {
    const column = table === 'invoice_lines' ? 'invoice_id' : 'id'
    const { error } = await supabase.from(table).delete().in(column, ids)
    if (error) throw new Error(`${table} cleanup failed: ${error.message}`)
  }

  for (const [table, ids] of [
    ['invoices', invoiceIds],
    ['jobs', jobIds],
    ['properties', propertyIds],
    ['clients', clientIds],
  ]) {
    const { error } = await supabase.from(table).delete().in('id', ids)
    if (error) throw new Error(`${table} cleanup failed: ${error.message}`)
  }
}

async function deleteImportedInvoiceLinesOnly(supabase, invoices) {
  const invoiceIds = invoices.map((invoice) => invoice.ids.invoiceId)
  const { error } = await supabase.from('invoice_lines').delete().in('invoice_id', invoiceIds)
  if (error) throw new Error(`invoice_lines cleanup failed: ${error.message}`)
}

function buildRows(invoices) {
  const clientsById = new Map()
  const propertiesById = new Map()
  const jobs = []
  const invoiceRows = []
  const invoiceLines = []
  const payments = []

  for (const invoice of invoices) {
    const propertyName = invoice.property?.name || `Histórico ${invoice.client_name}`
    const propertyAddress = invoice.property?.address || 'Importación histórica'

    clientsById.set(invoice.ids.clientId, {
      id: invoice.ids.clientId,
      full_name: invoice.client_name,
      phone: invoice.client_phone,
      email: invoice.client_email,
      status: 'active',
      source_lead_id: null,
    })

    propertiesById.set(invoice.ids.propertyId, {
      id: invoice.ids.propertyId,
      client_id: invoice.ids.clientId,
      name: propertyName,
      property_type: invoice.property?.property_type || 'apartment',
      address: propertyAddress,
      city: invoice.property?.city ?? null,
      postal_code: invoice.property?.postal_code ?? null,
      notes: invoice.property?.notes || `Soporte de importación histórica para factura ${invoice.invoice_number}.`,
    })

    jobs.push({
      id: invoice.ids.jobId,
      client_id: invoice.ids.clientId,
      property_id: invoice.ids.propertyId,
      quote_id: null,
      scheduled_date: invoice.issue_date,
      status: 'completed',
      service_type: 'standard_cleaning',
      billing_concept: invoice.lines[0]?.concept ?? 'Servicio de limpieza',
      billing_quantity: invoice.lines[0]?.quantity ?? 1,
      billing_unit: invoice.lines[0]?.unit ?? 'servicio',
      billing_unit_price: invoice.lines[0]?.unit_price ?? null,
      notes: `Servicio histórico de soporte para factura ${invoice.invoice_number}.`,
    })

    invoiceRows.push({
      id: invoice.ids.invoiceId,
      job_id: invoice.ids.jobId,
      client_id: invoice.ids.clientId,
      invoice_number: invoice.invoice_number,
      issue_date: invoice.issue_date,
      status: 'paid',
      subtotal: invoice.subtotal,
      tax_amount: invoice.tax_amount,
      total: invoice.total,
      notes: invoice.notes,
    })

    for (const line of invoice.lines) {
      invoiceLines.push({
        id: `${invoice.ids.invoiceId}-LINE-${String(line.sort_order).padStart(2, '0')}`,
        invoice_id: invoice.ids.invoiceId,
        sort_order: line.sort_order,
        concept: line.concept,
        quantity: line.quantity,
        unit: line.unit,
        unit_price: line.unit_price,
        line_subtotal: line.line_subtotal,
      })
    }

    payments.push({
      id: invoice.ids.paymentId,
      invoice_id: invoice.ids.invoiceId,
      payment_date: invoice.paid_date,
      amount: invoice.total,
      payment_method: 'transfer',
      notes: `Pago histórico importado para factura ${invoice.invoice_number}.`,
    })
  }

  return {
    clients: [...clientsById.values()],
    properties: [...propertiesById.values()],
    jobs,
    invoices: invoiceRows,
    invoiceLines,
    payments,
  }
}

function printPlan(rows, invoices) {
  const totalCents = invoices.reduce((sum, invoice) => sum + toCents(invoice.total, `${invoice.invoice_number}.total`), 0)
  console.log('Import plan:')
  console.log(`- invoices: ${invoices.length}`)
  console.log(`- clients: ${rows.clients.length}`)
  console.log(`- properties: ${rows.properties.length}`)
  console.log(`- jobs: ${rows.jobs.length}`)
  console.log(`- invoice_lines: ${rows.invoiceLines.length}`)
  console.log(`- payments: ${rows.payments.length}`)
  console.log(`- imported total: ${centsToNumber(totalCents).toFixed(2)} EUR`)
}

function printContinuitySql() {
  console.log('')
  console.log('Post-import numbering SQL to run in Supabase SQL editor after --apply:')
  console.log('begin;')
  console.log("select setval('public.invoices_invoice_number_seq'::regclass, 25, true);")
  console.log("select setval('public.invoices_display_code_seq'::regclass, greatest((select last_value from public.invoices_display_code_seq), 25), true);")
  console.log("select setval('public.quotes_display_code_seq'::regclass, 28, true);")
  console.log('commit;')
  console.log('')
  console.log('Expected next generated invoice_number: 2026-026')
  console.log('Expected next generated quote display_code: PRO-2026-0029')
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const dataPath = resolve(process.cwd(), options.dataPath)
  const rawFile = await readFile(dataPath, 'utf8')
  const rawData = JSON.parse(rawFile)
  const invoices = validateDataset(rawData)
  const rows = buildRows(invoices)

  printPlan(rows, invoices)

  const supabase = getSupabaseClient()
  await preflight(supabase, invoices, options)

  if (options.dryRun) {
    console.log('Dry run complete. No rows were written.')
    printContinuitySql()
    return
  }

  if (options.replaceImported) {
    await deleteImportedRowsForInvoices(supabase, invoices)
  } else {
    const existingImportInvoices = await fetchExistingByIds(supabase, 'invoices', rows.invoices.map((invoice) => invoice.id))
    if (existingImportInvoices.size > 0) {
      console.log(`Skipping cleanup because ${existingImportInvoices.size} imported invoices already exist. Upsert will verify/update HIST-* rows only.`)
    }
  }

  await upsertRows(supabase, 'clients', rows.clients)
  await upsertRows(supabase, 'properties', rows.properties)
  await upsertRows(supabase, 'jobs', rows.jobs)
  await upsertRows(supabase, 'invoices', rows.invoices)
  await deleteImportedInvoiceLinesOnly(supabase, invoices)
  await upsertRows(supabase, 'invoice_lines', rows.invoiceLines)
  await upsertRows(supabase, 'payments', rows.payments)

  console.log('Apply complete.')
  printContinuitySql()
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
