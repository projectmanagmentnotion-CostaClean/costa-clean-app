import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { recoverAuthenticatedQaSession } from './auth/recoveredQaSession.mjs'
import {
  awaitConcurrentSettlementRequests,
  assertConcurrentSettlement,
  assertDraftInvoiceFixture,
  assertExpectedFixtureCleanup,
  assertIdempotentCleanup,
  assertQaSnapshotRestored,
  countCleanupActions,
} from './n2ConcurrentSettlementCore.mjs'
import {
  N2_QA_PROJECT_REF,
  assertBaselineRestored,
  assertReadinessPlan,
} from './n2FinancialQaReadinessCore.mjs'

const SETTLEMENT_RPC_PATH = '/rest/v1/rpc/settle_invoice_by_transfer'

function normalizeRpc(value) {
  return Array.isArray(value) && value.length === 1 ? value[0] : value
}

async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args)
  if (error) throw new Error(`N2_RPC_FAILED_${name.toUpperCase()}`)
  return normalizeRpc(data)
}

async function readOne(client, table, id) {
  const { data, error } = await client.from(table).select('id').eq('id', id).maybeSingle()
  if (error || !data) throw new Error(`N2_FIXTURE_READBACK_FAILED_${table.toUpperCase()}`)
  return data
}

async function readInvoice(client, invoiceId) {
  const { data, error } = await client.from('invoices')
    .select('id,status,total,invoice_number,display_code')
    .eq('id', invoiceId)
    .single()
  if (error || !data) throw new Error('N2_CONCURRENCY_INVOICE_READBACK_FAILED')
  return data
}

async function readPayments(client, invoiceId) {
  const { data, error } = await client.from('payments')
    .select('id,amount')
    .eq('invoice_id', invoiceId)
    .order('id')
  if (error || !Array.isArray(data)) throw new Error('N2_CONCURRENCY_PAYMENT_READBACK_FAILED')
  return data
}

function createSettlementProbe(startedAt) {
  const intervals = []
  const fetchWithProbe = async (input, init) => {
    const rawUrl = typeof input === 'string' || input instanceof URL ? String(input) : input?.url
    let tracksSettlement = false
    try {
      tracksSettlement = new URL(rawUrl).pathname.endsWith(SETTLEMENT_RPC_PATH)
    } catch {
      // The underlying fetch will surface malformed requests normally.
    }

    const interval = tracksSettlement ? { startMs: performance.now() - startedAt, endMs: null } : null
    if (interval) intervals.push(interval)
    try {
      return await globalThis.fetch(input, init)
    } finally {
      if (interval) interval.endMs = performance.now() - startedAt
    }
  }
  return { intervals, fetch: fetchWithProbe }
}

function createAuthenticatedClient({ supabaseUrl, supabaseAnonKey, accessToken, fetch }) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    accessToken: async () => accessToken,
    global: { fetch },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

async function createSyntheticGraph(client, runId) {
  const clientId = `QA_N2_CLIENT_${runId}_CONC`
  const propertyId = `QA_N2_PROPERTY_${runId}_CONC`
  const jobId = `QA_N2_JOB_${runId}_CONC`
  const invoiceId = `QA_N2_INVOICE_${runId}_CONC`
  const provenance = `QA_N2_CONC_${runId}|source=n2_concurrency_certification`
  const localDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
    .toISOString().slice(0, 10)

  await rpc(client, 'create_client', {
    p_client: {
      id: clientId,
      full_name: clientId,
      phone: '600000000',
      email: `qa_n2+${runId}@qa.invalid`,
      tax_id: `QA_N2_CONC_${runId}`,
      billing_address: `QA_N2_CONC_${runId} synthetic address`,
      status: 'active',
    },
  })
  await readOne(client, 'clients', clientId)

  await rpc(client, 'create_property', {
    p_property: {
      id: propertyId,
      client_id: clientId,
      name: propertyId,
      property_type: 'apartment',
      address: `QA_N2_CONC_${runId} synthetic address`,
      city: 'Barcelona',
      postal_code: '08001',
      notes: provenance,
    },
  })
  await readOne(client, 'properties', propertyId)

  await rpc(client, 'save_job_with_lines', {
    p_job: {
      id: jobId,
      client_id: clientId,
      property_id: propertyId,
      quote_id: null,
      scheduled_date: localDate,
      status: 'scheduled',
      service_type: 'standard_cleaning',
      notes: provenance,
      billing_concept: `QA_N2_CONC_${runId} canary`,
      billing_quantity: 1,
      billing_unit: 'servicio',
      billing_unit_price: 100,
    },
    p_lines: [{
      id: `${jobId}_LINE_1`,
      job_id: jobId,
      sort_order: 1,
      concept: `QA_N2_CONC_${runId} canary`,
      quantity: 1,
      unit: 'servicio',
      unit_price: 100,
      line_subtotal: 100,
    }],
  })
  await readOne(client, 'jobs', jobId)

  const created = await rpc(client, 'qa_n2_create_concurrency_invoice', { p_run_id: runId })
  if (created?.invoice_id !== invoiceId) throw new Error('N2_CONCURRENCY_INVOICE_ID_MISMATCH')
  assertDraftInvoiceFixture(created)
  return { clientId, propertyId, jobId, invoiceId }
}

async function assertRunPlan(client, runId, expectedPayments) {
  const plan = await rpc(client, 'qa_financial_fixture_plan', { p_run_id: runId })
  const expected = {
    clients: 1,
    properties: 1,
    quotes: 0,
    quote_lines: 0,
    jobs: 1,
    job_lines: 1,
    invoices: 1,
    invoice_lines: 0,
    payments: expectedPayments,
  }
  for (const [field, count] of Object.entries(expected)) {
    if (Number(plan?.[field]) !== count) throw new Error(`N2_EXACT_FIXTURE_PLAN_${field.toUpperCase()}`)
  }
  return plan
}

async function main() {
  const recovered = await recoverAuthenticatedQaSession()
  if (recovered.projectRef !== N2_QA_PROJECT_REF) throw new Error('N2_QA_PROJECT_REF_MISMATCH')

  const initialClient = createAuthenticatedClient({ ...recovered, fetch: globalThis.fetch })
  const readinessBefore = await rpc(initialClient, 'qa_financial_fixture_plan', { p_run_id: null })
  assertReadinessPlan(readinessBefore)
  const before = await rpc(initialClient, 'qa_n2_concurrency_snapshot', {})
  if (before?.settlement_serialization_primitive !== 'SELECT FOR UPDATE') {
    throw new Error('N2_CANONICAL_SERIALIZATION_PRIMITIVE_MISSING')
  }
  for (const field of ['qa_n2_clients', 'qa_n2_properties', 'qa_n2_jobs', 'qa_n2_invoices', 'qa_n2_payments']) {
    if (Number(before[field]) !== 0) throw new Error(`N2_PREEXISTING_RESIDUE_${field.toUpperCase()}`)
  }

  if (process.argv.includes('--preflight')) {
    process.stdout.write(`${JSON.stringify({
      PREFLIGHT: 'PASS',
      QA_PROJECT: recovered.projectRef,
      AUTH_SESSION_PRESENT: true,
      AUTH_BYPASS_USED: false,
      SETTLEMENT_SERIALIZATION_PRIMITIVE: before.settlement_serialization_primitive,
      FISCAL_MAPPING_HASH: before.fiscal_mapping_hash,
      REAL_QA_BUSINESS_ROWS_HASH: before.real_qa_business_rows_hash,
      INVOICE_COUNT: before.invoice_count,
      PAYMENT_COUNT: before.payment_count,
      SEQUENCE_LAST_VALUE: before.sequence_last_value,
      SEQUENCE_IS_CALLED: before.sequence_is_called,
      QA_N2_RESIDUE: {
        clients: before.qa_n2_clients,
        properties: before.qa_n2_properties,
        jobs: before.qa_n2_jobs,
        invoices: before.qa_n2_invoices,
        payments: before.qa_n2_payments,
      },
      BUSINESS_WRITES: 0,
    }, null, 2)}\n`)
    return
  }

  const runId = crypto.randomBytes(16).toString('hex')
  const invoiceId = `QA_N2_INVOICE_${runId}_CONC`
  let fixtureAttempted = false
  let cleanupVerified = false

  try {
    const exactPlanBefore = await rpc(initialClient, 'qa_financial_fixture_plan', { p_run_id: runId })
    if (Number(exactPlanBefore?.clients) !== 0) throw new Error('N2_RUN_ID_COLLISION')

    fixtureAttempted = true
    const graph = await createSyntheticGraph(initialClient, runId)
    const invoiceDraft = await readInvoice(initialClient, graph.invoiceId)
    if (invoiceDraft.status !== 'draft' || invoiceDraft.invoice_number !== null || invoiceDraft.display_code !== null) {
      throw new Error('N2_DRAFT_INVOICE_NUMBERING_GUARD_FAILED')
    }

    const afterInsert = await rpc(initialClient, 'qa_n2_concurrency_snapshot', {})
    if (
      before.sequence_last_value !== afterInsert.sequence_last_value
      || before.sequence_is_called !== afterInsert.sequence_is_called
    ) {
      throw new Error('N2_SEQUENCE_CHANGED_BY_FIXTURE_INSERT')
    }

    await assertRunPlan(initialClient, runId, 0)

    const probeOrigin = performance.now()
    const probeA = createSettlementProbe(probeOrigin)
    const probeB = createSettlementProbe(probeOrigin)
    const clientA = createAuthenticatedClient({ ...recovered, fetch: probeA.fetch })
    const clientB = createAuthenticatedClient({ ...recovered, fetch: probeB.fetch })
    let release
    const gate = new Promise((resolve) => { release = resolve })
    let ready = 0
    const settle = async (client) => {
      ready += 1
      if (ready === 2) release()
      await gate
      return await rpc(client, 'settle_invoice_by_transfer', { p_invoice_id: invoiceId })
    }

    const settlementResults = await awaitConcurrentSettlementRequests([settle(clientA), settle(clientB)])
    const intervals = [...probeA.intervals, ...probeB.intervals]
    if (intervals.length !== 2) throw new Error('N2_SETTLEMENT_HTTP_REQUEST_COUNT_INVALID')
    const duringInvoice = await readInvoice(initialClient, invoiceId)
    const paymentRows = await readPayments(initialClient, invoiceId)
    const concurrency = assertConcurrentSettlement({
      results: settlementResults,
      requestIntervals: intervals,
      paymentRows,
      invoice: duringInvoice,
    })
    const during = await rpc(initialClient, 'qa_n2_concurrency_snapshot', {})
    if (
      before.sequence_last_value !== during.sequence_last_value
      || before.sequence_is_called !== during.sequence_is_called
    ) {
      throw new Error('N2_SEQUENCE_CHANGED_DURING_SETTLEMENT')
    }

    const fixturePlan = await assertRunPlan(initialClient, runId, 1)
    if (Number(fixturePlan?.qa_n2_residue) < 1) throw new Error('N2_FIXTURE_PROVENANCE_NOT_RECOGNIZED')

    const firstCleanup = await rpc(initialClient, 'qa_cleanup_financial_fixtures', { p_run_id: runId })
    if (firstCleanup?.cleaned !== true || firstCleanup?.run_id !== runId) {
      throw new Error('N2_EXACT_FIXTURE_CLEANUP_FAILED')
    }
    const hardDeletes = assertExpectedFixtureCleanup(firstCleanup)
    const secondCleanup = await rpc(initialClient, 'qa_cleanup_financial_fixtures', { p_run_id: runId })
    assertIdempotentCleanup(secondCleanup)

    const finalPlan = await rpc(initialClient, 'qa_financial_fixture_plan', { p_run_id: null })
    assertReadinessPlan(finalPlan)
    const after = await rpc(initialClient, 'qa_n2_concurrency_snapshot', {})
    assertQaSnapshotRestored(before, after)
    assertBaselineRestored(
      { ...readinessBefore.baseline, invariants: readinessBefore.invariants },
      { ...finalPlan.baseline, invariants: finalPlan.invariants, qa_n2_residue: finalPlan.qa_n2_residue },
    )
    cleanupVerified = true

    process.stdout.write(`${JSON.stringify({
      N2_QA_READINESS_BEFORE: 'PASS',
      N2_QA_READINESS_AFTER: 'PASS',
      QA_PROJECT: recovered.projectRef,
      AUTH_SESSION_PRESENT: true,
      AUTH_BYPASS_USED: false,
      RUN_ID: runId,
      BASELINE: {
        fiscal_mapping_hash: before.fiscal_mapping_hash,
        sequence_last_value: before.sequence_last_value,
        sequence_is_called: before.sequence_is_called,
        invoice_count: before.invoice_count,
        payment_count: before.payment_count,
        qa_n2: {
          clients: before.qa_n2_clients,
          properties: before.qa_n2_properties,
          jobs: before.qa_n2_jobs,
          invoices: before.qa_n2_invoices,
          payments: before.qa_n2_payments,
        },
      },
      FIXTURE_INSERT: {
        status: invoiceDraft.status,
        invoice_number: invoiceDraft.invoice_number,
        display_code: invoiceDraft.display_code,
        sequence_changed: false,
      },
      SETTLEMENT_SERIALIZATION_PRIMITIVE: 'SELECT FOR UPDATE',
      CONCURRENT_SETTLEMENT_CALLS: concurrency.calls,
      CONCURRENT_REQUESTS_OVERLAPPED: concurrency.overlapped,
      REQUEST_INTERVALS_MS: intervals.map(({ startMs, endMs }) => ({
        start_ms: Number(startMs.toFixed(3)),
        end_ms: Number(endMs.toFixed(3)),
      })),
      CONCURRENT_PAYMENT_ROWS_CREATED: concurrency.paymentsCreated,
      CONCURRENT_SETTLEMENT_DUPLICATES: concurrency.duplicates,
      CONCURRENT_OVERPAYMENT: concurrency.overpayment,
      TEMP_SYNTHETIC_INVOICE_NUMBER: duringInvoice.invoice_number,
      TEMP_SYNTHETIC_DISPLAY_CODE: duringInvoice.display_code,
      SETTLEMENT_SEQUENCE_SIDE_EFFECT: 0,
      QA_FIXTURE_HARD_DELETES: hardDeletes,
      SECOND_CLEANUP_ACTIONS: countCleanupActions(secondCleanup),
      FINAL: {
        fiscal_mapping_hash: after.fiscal_mapping_hash,
        sequence_last_value: after.sequence_last_value,
        sequence_is_called: after.sequence_is_called,
        invoice_count: after.invoice_count,
        payment_count: after.payment_count,
        qa_n2: {
          clients: after.qa_n2_clients,
          properties: after.qa_n2_properties,
          jobs: after.qa_n2_jobs,
          invoices: after.qa_n2_invoices,
          payments: after.qa_n2_payments,
        },
        real_qa_business_rows_changed: 0,
      },
    }, null, 2)}\n`)
  } finally {
    if (fixtureAttempted && !cleanupVerified) {
      const cleanup = await initialClient.rpc('qa_cleanup_financial_fixtures', { p_run_id: runId })
      if (cleanup.error || cleanup.data?.cleaned !== true) {
        throw new Error('N2_EMERGENCY_EXACT_CLEANUP_FAILED')
      }
    }
  }
}

main().catch((error) => {
  process.stderr.write(`N2 concurrent settlement failed: ${error instanceof Error ? error.message : 'UNKNOWN'}\n`)
  process.exitCode = 1
})
