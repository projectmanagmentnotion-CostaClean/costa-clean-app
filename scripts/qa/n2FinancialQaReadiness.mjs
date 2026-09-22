import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { recoverAuthenticatedQaSession } from './auth/recoveredQaSession.mjs'
import {
  N2_QA_PROJECT_REF,
  assertBaselineRestored,
  assertDraftFixturePlan,
  assertReadinessPlan,
  assertRollbackHarnessResult,
} from './n2FinancialQaReadinessCore.mjs'

const CERTIFY_FLAG = '--certify'

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

function isoDate() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

async function createDraftGraph(client, runId) {
  const clientId = `QA_N2_CLIENT_${runId}_PRIMARY`
  const propertyId = `QA_N2_PROPERTY_${runId}_PRIMARY`
  const quoteId = `QA_N2_QUOTE_${runId}_PRIMARY`
  const jobId = `QA_N2_JOB_${runId}_PRIMARY`
  const invoiceId = `QA_N2_INVOICE_${runId}_PRIMARY`
  const concept = `QA_N2_${runId}_LIMPIEZA`

  await rpc(client, 'create_client', {
    p_client: {
      id: clientId,
      full_name: `QA_N2_CLIENT_${runId}_PRIMARY`,
      phone: '600000000',
      email: `qa_n2+${runId}@qa.invalid`,
      tax_id: `QA_N2_${runId}`,
      billing_address: `QA_N2_${runId} address`,
      status: 'active',
    },
  })
  await readOne(client, 'clients', clientId)

  await rpc(client, 'create_property', {
    p_property: {
      id: propertyId,
      client_id: clientId,
      name: `QA_N2_PROPERTY_${runId}_PRIMARY`,
      property_type: 'apartment',
      address: `QA_N2_${runId} address`,
      city: 'Barcelona',
      postal_code: '08001',
      notes: `QA_N2|run_id=${runId}|source=qa_n2_certification`,
    },
  })
  await readOne(client, 'properties', propertyId)

  await rpc(client, 'save_quote_with_lines', {
    p_quote: {
      id: quoteId,
      client_id: clientId,
      property_id: propertyId,
      lead_id: null,
      status: 'draft',
      subtotal: 100,
      tax_amount: 21,
      total: 121,
      notes: `QA_N2|run_id=${runId}|source=qa_n2_certification`,
      pricing_metadata: { source: 'qa_n2_certification', run_id: runId },
    },
    p_lines: [{
      id: `${quoteId}_LINE_1`, quote_id: quoteId, sort_order: 1,
      concept, quantity: 1, unit: 'servicio', unit_price: 100, line_subtotal: 100,
    }],
  })
  await readOne(client, 'quotes', quoteId)

  await rpc(client, 'save_job_with_lines', {
    p_job: {
      id: jobId,
      client_id: clientId,
      property_id: propertyId,
      quote_id: quoteId,
      scheduled_date: isoDate(),
      status: 'scheduled',
      service_type: 'standard_cleaning',
      notes: `QA_N2|run_id=${runId}|source=qa_n2_certification`,
      billing_concept: concept,
      billing_quantity: 1,
      billing_unit: 'servicio',
      billing_unit_price: 100,
    },
    p_lines: [{
      id: `${jobId}_LINE_1`, job_id: jobId, sort_order: 1,
      concept, quantity: 1, unit: 'servicio', unit_price: 100, line_subtotal: 100,
    }],
  })
  await readOne(client, 'jobs', jobId)

  await rpc(client, 'save_invoice_with_lines_v2', {
    p_invoice: {
      id: invoiceId,
      job_id: jobId,
      quote_id: quoteId,
      client_id: clientId,
      property_id: propertyId,
      issue_date: isoDate(),
      status: 'draft',
      subtotal: 100,
      tax_amount: 21,
      total: 121,
      notes: `QA_N2|run_id=${runId}|source=qa_n2_certification`,
      pricing_metadata: { source: 'qa_n2_certification', run_id: runId },
    },
    p_lines: [{
      id: `${invoiceId}_LINE_1`, invoice_id: invoiceId, sort_order: 1,
      concept, quantity: 1, unit: 'servicio', unit_price: 100, line_subtotal: 100,
    }],
  })
  await readOne(client, 'invoices', invoiceId)

  return { clientId, propertyId, quoteId, jobId, invoiceId }
}

async function cleanupAndAssert(client, runId, expectedCount) {
  const plan = await rpc(client, 'qa_financial_fixture_plan', { p_run_id: runId })
  if (Number(plan.clients) !== expectedCount) throw new Error('N2_QA_CLEANUP_DRY_RUN_CLIENT_COUNT_MISMATCH')
  if (expectedCount === 1) assertDraftFixturePlan(plan)
  if (expectedCount === 0) {
    for (const table of ['properties', 'quotes', 'quote_lines', 'jobs', 'job_lines', 'invoices', 'invoice_lines', 'payments']) {
      if (Number(plan[table]) !== 0) throw new Error(`N2_QA_CLEANUP_DRY_RUN_REMAINDER_${table.toUpperCase()}`)
    }
  }
  return plan
}

async function main() {
  if (process.argv.includes('--help')) {
    process.stdout.write('Read-only by default. Add --certify to create one QA_N2 draft graph, run rollback-only financial checks, clean it, and verify baseline restoration.\n')
    return
  }

  const recovered = await recoverAuthenticatedQaSession()
  const { supabaseUrl, supabaseAnonKey, projectRef, accessToken } = recovered
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    accessToken: async () => accessToken,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  if (projectRef !== N2_QA_PROJECT_REF || !recovered.authenticatedUserPresent) {
    throw new Error('N2_QA_PROJECT_REF_MISMATCH')
  }

  const initialPlan = await rpc(client, 'qa_financial_fixture_plan', { p_run_id: null })
  assertReadinessPlan(initialPlan)
  const beforeBaseline = initialPlan.baseline
  const beforeInvariants = initialPlan.invariants

  if (!process.argv.includes(CERTIFY_FLAG)) {
    process.stdout.write(`${JSON.stringify({
      N2_QA_READINESS: 'PASS',
      QA_PROJECT: projectRef,
      PRODUCTION_REJECTED: true,
      SIGNED_QA_ISSUER_VERIFIED: true,
      BASELINE: beforeBaseline,
      INVARIANTS: beforeInvariants,
      QA_N2_RESIDUE: initialPlan.qa_n2_residue,
      MUTATIONS: 0,
    }, null, 2)}\n`)
    return
  }

  const runId = crypto.randomUUID().replaceAll('-', '')
  let graph = null
  let cleanupVerified = false
  try {
    graph = await createDraftGraph(client, runId)
    await cleanupAndAssert(client, runId, 1)
    const rollback = await rpc(client, 'qa_n2_financial_rollback_harness', {
      p_client_id: graph.clientId,
      p_property_id: graph.propertyId,
      p_run_id: runId,
    })
    assertRollbackHarnessResult(rollback)

    const firstCleanup = await rpc(client, 'qa_cleanup_financial_fixtures', { p_run_id: runId })
    if (firstCleanup?.cleaned !== true) throw new Error('N2_QA_CLEANUP_FAILED')
    await cleanupAndAssert(client, runId, 0)
    const secondCleanup = await rpc(client, 'qa_cleanup_financial_fixtures', { p_run_id: runId })
    const secondActions = Object.values(secondCleanup?.deleted ?? {}).reduce((sum, value) => sum + Number(value || 0), 0)
    if (secondActions !== 0) throw new Error('N2_QA_CLEANUP_NOT_IDEMPOTENT')
    cleanupVerified = true

    const finalPlan = await rpc(client, 'qa_financial_fixture_plan', { p_run_id: null })
    assertBaselineRestored(
      { ...beforeBaseline, invariants: beforeInvariants },
      { ...finalPlan.baseline, invariants: finalPlan.invariants, qa_n2_residue: finalPlan.qa_n2_residue },
    )
    process.stdout.write(`${JSON.stringify({
      N2_QA_READINESS: 'PASS',
      QA_PROJECT: projectRef,
      RUN_ID: runId,
      DRAFT_GRAPH_CREATED: true,
      DRAFT_GRAPH_CLEANED: true,
      ROLLBACK_HARNESS: rollback,
      QA_N2_REMAINING: finalPlan.qa_n2_residue,
      SECOND_CLEANUP_ACTIONS: secondActions,
      BASELINE_RESTORED: true,
      REAL_QA_BUSINESS_ROWS_CHANGED: 0,
      PRODUCTION_MUTATIONS: 0,
    }, null, 2)}\n`)
  } finally {
    if (process.argv.includes(CERTIFY_FLAG) && !cleanupVerified) {
      const cleanup = await client.rpc('qa_cleanup_financial_fixtures', { p_run_id: runId })
      if (cleanup.error) throw new Error('N2_QA_EMERGENCY_CLEANUP_FAILED')
    }
  }
}

main().catch((error) => {
  process.stderr.write(`N2 QA readiness failed: ${error instanceof Error ? error.message : 'UNKNOWN'}\n`)
  process.exitCode = 1
})
