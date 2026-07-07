import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const TARGET_INVOICE_NUMBER = '2026-045'
const TARGET_CLIENT_NAME = 'FUSTERIA PINEDA MAR SL'
const TARGET_CONCEPT = 'limpieza de taller'
const EXPECTED_DISPLAY_CODE = 'INV-0045'
const EXPECTED_LINE_QUANTITY = 1
const CORRECTED_LINE_QUANTITY = 6
const EXPECTED_UNIT_PRICE = 18
const EXPECTED_LINE_SUBTOTAL = 18
const CORRECTED_LINE_SUBTOTAL = 108
const EXPECTED_SUBTOTAL = 324
const EXPECTED_TAX = 68.04
const EXPECTED_TOTAL = 392.04
const SAVE_INVOICE_WITH_RESULT_RPC = 'save_invoice_with_lines_v2'

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function formatMoney(value) {
  return roundMoney(value).toFixed(2)
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .trim()
    .toLowerCase()
}

function loadEnvFile(filename) {
  const envPath = path.resolve(process.cwd(), filename)
  if (!fs.existsSync(envPath)) return {}
  return Object.fromEntries(
    fs.readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separatorIndex = line.indexOf('=')
        return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)]
      }),
  )
}

function getEnvValue(name, env) {
  return process.env[name] || env[name] || ''
}

async function createSupabaseClient() {
  const localEnv = {
    ...loadEnvFile('.env.local'),
    ...loadEnvFile('.env'),
  }
  const supabaseUrl = getEnvValue('SUPABASE_URL', localEnv) || getEnvValue('VITE_SUPABASE_URL', localEnv)
  const supabaseKey =
    getEnvValue('SUPABASE_SERVICE_ROLE_KEY', localEnv)
    || getEnvValue('SUPABASE_ANON_KEY', localEnv)
    || getEnvValue('VITE_SUPABASE_ANON_KEY', localEnv)

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase env. Expected SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY.')
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const authEmail =
    getEnvValue('SUPABASE_AUTH_EMAIL', localEnv)
    || getEnvValue('VITE_SUPABASE_AUTH_EMAIL', localEnv)
  const authPassword =
    getEnvValue('SUPABASE_AUTH_PASSWORD', localEnv)
    || getEnvValue('VITE_SUPABASE_AUTH_PASSWORD', localEnv)

  if (authEmail && authPassword) {
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    })

    if (error) {
      throw new Error(`Supabase auth sign-in failed: ${error.message}`)
    }
  }

  return supabase
}

async function fetchInvoiceContext(supabase) {
  const { data: invoices, error: invoiceError } = await supabase
    .from('invoices')
    .select('id,display_code,invoice_number,client_id,issue_date,status,created_at,updated_at,archived_at,deleted_at,cancelled_at,cancel_reason,subtotal,tax_amount,total,notes,internal_notes,pricing_metadata,job_id,quote_id,property_id')
    .or(`invoice_number.eq.${TARGET_INVOICE_NUMBER},display_code.eq.${TARGET_INVOICE_NUMBER}`)

  if (invoiceError) {
    throw new Error(`Invoice lookup failed: ${invoiceError.message}`)
  }

  if (!invoices || invoices.length !== 1) {
    throw new Error(`Expected exactly one invoice match for ${TARGET_INVOICE_NUMBER}. Found ${invoices?.length ?? 0}.`)
  }

  const invoice = invoices[0]
  const [{ data: lines, error: linesError }, { data: client, error: clientError }, { data: payments, error: paymentError }, { count, error: countError }] = await Promise.all([
    supabase
      .from('invoice_lines')
      .select('id,invoice_id,sort_order,concept,quantity,unit,unit_price,line_subtotal,created_at')
      .eq('invoice_id', invoice.id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('clients')
      .select('id,full_name,tax_id,billing_address')
      .eq('id', invoice.client_id)
      .maybeSingle(),
    supabase
      .from('payments')
      .select('id,amount,payment_date,payment_method,origin_type')
      .eq('invoice_id', invoice.id),
    supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('invoice_number', TARGET_INVOICE_NUMBER),
  ])

  if (linesError) throw new Error(`Invoice lines lookup failed: ${linesError.message}`)
  if (clientError) throw new Error(`Client lookup failed: ${clientError.message}`)
  if (paymentError) throw new Error(`Payments lookup failed: ${paymentError.message}`)
  if (countError) throw new Error(`Invoice uniqueness lookup failed: ${countError.message}`)

  return {
    invoice,
    lines: lines ?? [],
    client,
    payments: payments ?? [],
    sameNumberCount: count ?? 0,
  }
}

function getCorrectionTargetLine(lines) {
  return lines.find((line) => normalizeText(line.concept) === TARGET_CONCEPT) ?? null
}

function assertPreconditions(context) {
  const { invoice, lines, client, payments, sameNumberCount } = context

  if (sameNumberCount !== 1) {
    throw new Error(`Expected exactly one persisted invoice_number ${TARGET_INVOICE_NUMBER}. Found ${sameNumberCount}.`)
  }

  if (!client || !String(client.full_name ?? '').includes(TARGET_CLIENT_NAME)) {
    throw new Error(`Client mismatch. Expected ${TARGET_CLIENT_NAME}.`)
  }

  if (invoice.display_code !== EXPECTED_DISPLAY_CODE) {
    throw new Error(`Unexpected display_code ${invoice.display_code ?? 'null'}. Expected ${EXPECTED_DISPLAY_CODE}.`)
  }

  if (invoice.archived_at || invoice.deleted_at || invoice.cancelled_at) {
    throw new Error('Invoice is archived, deleted or cancelled. Refusing correction.')
  }

  if (invoice.status !== 'issued') {
    throw new Error(`Unexpected invoice status ${invoice.status}. Expected issued.`)
  }

  if (payments.length > 0) {
    throw new Error(`Invoice already has ${payments.length} payment(s). Refusing silent amount correction.`)
  }

  const renumberedReason = String(invoice.pricing_metadata?.renumbered_reason ?? '')
  if (!/no enviada/i.test(renumberedReason)) {
    throw new Error('No explicit "no enviada" signal found in pricing_metadata. Refusing correction.')
  }

  if (lines.length !== 2) {
    throw new Error(`Unexpected invoice line count ${lines.length}. Expected 2.`)
  }

  const targetLine = getCorrectionTargetLine(lines)
  if (!targetLine) {
    throw new Error(`Target concept "${TARGET_CONCEPT}" not found in invoice lines.`)
  }

  const normalizedUnit = normalizeText(targetLine.unit)
  if (roundMoney(Number(targetLine.unit_price)) !== EXPECTED_UNIT_PRICE) {
    throw new Error(`Unexpected unit_price ${targetLine.unit_price}. Expected ${EXPECTED_UNIT_PRICE}.`)
  }

  if (normalizedUnit !== normalizeText('Horas')) {
    throw new Error(`Unexpected unit ${targetLine.unit}. Expected Horas.`)
  }

  return targetLine
}

function buildCorrectedLines(lines) {
  return lines.map((line) => {
    if (normalizeText(line.concept) !== TARGET_CONCEPT) {
      return {
        id: line.id,
        invoice_id: line.invoice_id,
        sort_order: line.sort_order,
        concept: line.concept,
        quantity: roundMoney(Number(line.quantity)),
        unit: line.unit,
        unit_price: roundMoney(Number(line.unit_price)),
        line_subtotal: roundMoney(Number(line.line_subtotal)),
      }
    }

    return {
      id: line.id,
      invoice_id: line.invoice_id,
      sort_order: line.sort_order,
      concept: line.concept,
      quantity: CORRECTED_LINE_QUANTITY,
      unit: line.unit,
      unit_price: EXPECTED_UNIT_PRICE,
      line_subtotal: CORRECTED_LINE_SUBTOTAL,
    }
  })
}

function computeTotals(lines) {
  const subtotal = roundMoney(lines.reduce((sum, line) => sum + roundMoney(Number(line.line_subtotal)), 0))
  const taxAmount = roundMoney(subtotal * 0.21)
  const total = roundMoney(subtotal + taxAmount)
  return { subtotal, taxAmount, total }
}

function isAlreadyCorrected(context) {
  const { invoice, lines } = context
  const targetLine = getCorrectionTargetLine(lines)
  if (!targetLine) return false

  return roundMoney(Number(targetLine.quantity)) === CORRECTED_LINE_QUANTITY
    && roundMoney(Number(targetLine.unit_price)) === EXPECTED_UNIT_PRICE
    && roundMoney(Number(targetLine.line_subtotal)) === CORRECTED_LINE_SUBTOTAL
    && roundMoney(Number(invoice.subtotal)) === EXPECTED_SUBTOTAL
    && roundMoney(Number(invoice.tax_amount)) === EXPECTED_TAX
    && roundMoney(Number(invoice.total)) === EXPECTED_TOTAL
}

function printSummary(label, context) {
  const { invoice, lines, client, payments, sameNumberCount } = context
  console.log(`\n[${label}]`)
  console.log(JSON.stringify({
    invoice: {
      id: invoice.id,
      display_code: invoice.display_code,
      invoice_number: invoice.invoice_number,
      status: invoice.status,
      subtotal: invoice.subtotal,
      tax_amount: invoice.tax_amount,
      total: invoice.total,
      updated_at: invoice.updated_at,
    },
    client: client ? {
      id: client.id,
      full_name: client.full_name,
      tax_id: client.tax_id,
      billing_address: client.billing_address,
    } : null,
    payments,
    sameNumberCount,
    lines: lines.map((line) => ({
      id: line.id,
      sort_order: line.sort_order,
      concept: line.concept,
      quantity: line.quantity,
      unit: line.unit,
      unit_price: line.unit_price,
      line_subtotal: line.line_subtotal,
    })),
  }, null, 2))
}

function sanitizeInvoicePayload(invoice) {
  const payload = { ...invoice }
  delete payload.display_code
  delete payload.invoice_number
  delete payload.created_at
  delete payload.updated_at
  delete payload.archived_at
  delete payload.deleted_at
  delete payload.cancelled_at
  delete payload.cancel_reason
  return payload
}

function isMissingSaveInvoiceResultRpcError(message) {
  return message.includes(SAVE_INVOICE_WITH_RESULT_RPC)
    && (
      message.includes('Could not find the function')
      || message.includes('schema cache')
      || message.includes('PGRST')
    )
}

async function saveInvoiceWithRpc(supabase, invoicePayload, linePayloads) {
  const { data, error } = await supabase.rpc(SAVE_INVOICE_WITH_RESULT_RPC, {
    p_invoice: invoicePayload,
    p_lines: linePayloads,
  })

  if (!error) {
    return Array.isArray(data) ? data[0] : data
  }

  if (!isMissingSaveInvoiceResultRpcError(error.message || '')) {
    throw new Error(`save_invoice_with_lines_v2 failed: ${error.message}`)
  }

  const fallback = await supabase.rpc('save_invoice_with_lines', {
    p_invoice: invoicePayload,
    p_lines: linePayloads,
  })

  if (fallback.error) {
    throw new Error(`save_invoice_with_lines fallback failed: ${fallback.error.message}`)
  }

  const readback = await supabase
    .from('invoices')
    .select('id,display_code,invoice_number,status,issue_date')
    .eq('id', invoicePayload.id)
    .maybeSingle()

  if (readback.error) {
    throw new Error(`Readback after fallback failed: ${readback.error.message}`)
  }

  return readback.data
}

async function main() {
  const shouldApply = process.argv.includes('--apply')
  const supabase = await createSupabaseClient()

  const before = await fetchInvoiceContext(supabase)
  printSummary('before', before)
  const targetLine = assertPreconditions(before)

  if (isAlreadyCorrected(before)) {
    console.log('\nResult: invoice already corrected. No changes applied.')
    return
  }

  if (roundMoney(Number(targetLine.quantity)) !== EXPECTED_LINE_QUANTITY) {
    throw new Error(`Unexpected current quantity ${targetLine.quantity}. Expected ${EXPECTED_LINE_QUANTITY}.`)
  }

  if (roundMoney(Number(targetLine.line_subtotal)) !== EXPECTED_LINE_SUBTOTAL) {
    throw new Error(`Unexpected current line_subtotal ${targetLine.line_subtotal}. Expected ${EXPECTED_LINE_SUBTOTAL}.`)
  }

  const correctedLines = buildCorrectedLines(before.lines)
  const totals = computeTotals(correctedLines)

  if (totals.subtotal !== EXPECTED_SUBTOTAL || totals.taxAmount !== EXPECTED_TAX || totals.total !== EXPECTED_TOTAL) {
    throw new Error(`Computed totals mismatch. Got ${formatMoney(totals.subtotal)} / ${formatMoney(totals.taxAmount)} / ${formatMoney(totals.total)}.`)
  }

  console.log('\n[planned-update]')
  console.log(JSON.stringify({
    invoice_number: before.invoice.invoice_number,
    display_code: before.invoice.display_code,
    target_concept: targetLine.concept,
    quantity_from: targetLine.quantity,
    quantity_to: CORRECTED_LINE_QUANTITY,
    subtotal_to: totals.subtotal,
    tax_to: totals.taxAmount,
    total_to: totals.total,
    apply: shouldApply,
  }, null, 2))

  if (!shouldApply) {
    console.log('\nDry run only. Re-run with --apply to persist the correction.')
    return
  }

  const invoicePayload = sanitizeInvoicePayload({
    ...before.invoice,
    subtotal: totals.subtotal,
    tax_amount: totals.taxAmount,
    total: totals.total,
  })

  const savedInvoice = await saveInvoiceWithRpc(supabase, invoicePayload, correctedLines)

  if (!savedInvoice?.id || savedInvoice.id !== before.invoice.id) {
    throw new Error(`Unexpected saved invoice id ${savedInvoice?.id ?? 'null'}. Expected ${before.invoice.id}.`)
  }

  if (savedInvoice.invoice_number !== before.invoice.invoice_number) {
    throw new Error(`invoice_number changed unexpectedly from ${before.invoice.invoice_number} to ${savedInvoice.invoice_number}.`)
  }

  if (savedInvoice.display_code !== before.invoice.display_code) {
    throw new Error(`display_code changed unexpectedly from ${before.invoice.display_code} to ${savedInvoice.display_code}.`)
  }

  const after = await fetchInvoiceContext(supabase)
  printSummary('after', after)

  if (!isAlreadyCorrected(after)) {
    throw new Error('Post-update readback does not match the expected corrected values.')
  }

  console.log('\nResult: correction applied successfully.')
}

main().catch((error) => {
  console.error(`\n[error] ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
