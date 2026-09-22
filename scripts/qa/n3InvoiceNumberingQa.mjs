import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { recoverAuthenticatedQaSession } from './auth/recoveredQaSession.mjs'
import { N2_QA_PROJECT_REF } from './n2FinancialQaReadinessCore.mjs'

const ISSUE_RPC = '/rest/v1/rpc/save_invoice_with_lines_v2'
const SETTLE_RPC = '/rest/v1/rpc/settle_invoice_by_transfer'

function normalizeRpc(value) {
  return Array.isArray(value) && value.length === 1 ? value[0] : value
}

function createProbeFetch(path, startedAt, intervals) {
  return async (input, init) => {
    const rawUrl = typeof input === 'string' || input instanceof URL ? String(input) : input?.url
    let tracked = false
    try { tracked = new URL(rawUrl).pathname.endsWith(path) } catch { /* fetch reports invalid URLs */ }
    const interval = tracked ? { startMs: performance.now() - startedAt, endMs: null } : null
    if (interval) intervals.push(interval)
    try { return await globalThis.fetch(input, init) } finally { if (interval) interval.endMs = performance.now() - startedAt }
  }
}

function makeClient(session, fetch = globalThis.fetch) {
  return createClient(session.supabaseUrl, session.supabaseAnonKey, {
    accessToken: async () => session.accessToken,
    global: { fetch },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args)
  if (error) throw new Error(`N3_RPC_FAILED_${name.toUpperCase()}`)
  return normalizeRpc(data)
}

async function invoiceRows(client, ids) {
  const { data, error } = await client.from('invoices')
    .select('id,client_id,issue_date,status,total,invoice_number,display_code,notes,pricing_metadata')
    .in('id', ids)
  if (error || !Array.isArray(data)) throw new Error('N3_INVOICE_READBACK_FAILED')
  return data
}

async function createDrafts(client, runId, year, count) {
  const result = await rpc(client, 'qa_n3_create_drafts', { p_run_id: runId, p_year: year, p_count: count })
  if (result?.count !== count || !Array.isArray(result.invoice_ids) || result.invoice_ids.length !== count) {
    throw new Error('N3_FIXTURE_CREATE_COUNT_MISMATCH')
  }
  return { ids: result.invoice_ids, clientId: result.client_id }
}

async function fiscalSnapshot(client, clientId) {
  const { data, error } = await client.from('clients').select('full_name,tax_id,billing_address').eq('id', clientId).single()
  if (error || !data?.full_name || !data?.tax_id || !data?.billing_address) throw new Error('N3_FISCAL_CLIENT_READBACK_FAILED')
  return { fiscal_name: data.full_name, name: data.full_name, tax_id: data.tax_id, billing_address: data.billing_address }
}

function invoicePayload(id, row, fiscal, runId, lineId = `${id}_LINE_01`) {
  return {
    p_invoice: {
      id,
      client_id: row.client_id,
      job_id: null,
      quote_id: null,
      property_id: null,
      issue_date: row.issue_date,
      status: 'issued',
      subtotal: 100,
      tax_amount: 21,
      total: 121,
      notes: `QA_N3_${runId}|source=n3_numbering_certification`,
      pricing_metadata: { source: 'n3_numbering_certification', run_id: runId, client_fiscal_snapshot: fiscal },
    },
    p_lines: [{
      id: lineId, invoice_id: id, sort_order: 1, concept: 'QA N3 prueba controlada',
      quantity: 1, unit: 'servicio', unit_price: 100, line_subtotal: 100,
    }],
  }
}

async function issue(client, id, row, fiscal, runId, lineId) {
  const result = await rpc(client, 'save_invoice_with_lines_v2', invoicePayload(id, row, fiscal, runId, lineId))
  if (result?.status !== 'issued' || !result?.invoice_number || !result?.display_code) throw new Error('N3_ISSUE_RESULT_INVALID')
  return result
}

async function cleanupExistingN3Fixtures(client) {
  const { data, error } = await client.from('invoices').select('id,notes').like('id', 'QA_N3_INVOICE_%')
  if (error || !Array.isArray(data)) throw new Error('N3_EXISTING_FIXTURE_READ_FAILED')
  const runs = new Set()
  for (const row of data) {
    const match = typeof row.notes === 'string'
      ? row.notes.match(/^QA_N3_([0-9a-f]{32})\|source=n3_numbering_certification$/)
      : null
    if (!match || !row.id.startsWith(`QA_N3_INVOICE_${match[1]}_`)) {
      throw new Error('N3_EXISTING_FIXTURE_PROVENANCE_MISMATCH')
    }
    runs.add(match[1])
  }
  for (const runId of runs) {
    const { data, error: cleanupError } = await client.rpc('qa_n3_cleanup', { p_run_id: runId })
    if (cleanupError) throw new Error(`N3_CLEANUP_RPC_ERROR_${cleanupError.code ?? 'UNKNOWN'}_${cleanupError.message ?? 'NO_MESSAGE'}`)
    const result = normalizeRpc(data)
    if (Number(result?.qa_n3_residue) !== 0) throw new Error('N3_EXISTING_FIXTURE_CLEANUP_RESIDUE')
  }
  const snapshot = await rpc(client, 'qa_n3_numbering_snapshot', {})
  if (Number(snapshot.qa_n3_invoice_count) !== 0) throw new Error('N3_EXISTING_FIXTURE_CLEANUP_INCOMPLETE')
  return { cleaned_runs: runs.size, snapshot }
}

function assertOverlap(intervals, expected) {
  if (intervals.length !== expected) throw new Error('N3_CONCURRENCY_REQUEST_COUNT_INVALID')
  const ordered = [...intervals].sort((a, b) => a.startMs - b.startMs)
  let furthestEnd = ordered[0]?.endMs ?? -Infinity
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index].startMs >= furthestEnd) throw new Error('N3_ISSUANCE_REQUESTS_DID_NOT_OVERLAP')
    furthestEnd = Math.max(furthestEnd, ordered[index].endMs)
  }
}

async function main() {
  const session = await recoverAuthenticatedQaSession()
  if (session.projectRef !== N2_QA_PROJECT_REF) throw new Error('N3_QA_PROJECT_REF_MISMATCH')
  const baseClient = makeClient(session)
  if (process.argv.includes('--cleanup-existing')) {
    const result = await cleanupExistingN3Fixtures(baseClient)
    process.stdout.write(`${JSON.stringify({
      QA_PROJECT: session.projectRef,
      AUTH_SESSION_PRESENT: true,
      AUTH_BYPASS_USED: false,
      CLEANED_RUNS: result.cleaned_runs,
      QA_N3_RESIDUE: 0,
      LEGACY_SEQUENCE_LAST_VALUE: result.snapshot.sequence_last_value,
      FISCAL_MAPPING_HASH: result.snapshot.fiscal_mapping_hash,
      BUSINESS_WRITES: 0,
      FIXTURE_TEARDOWN: 'EXACT_QA_N3_PROVENANCE_ONLY',
    }, null, 2)}\n`)
    return
  }
  const before = await rpc(baseClient, 'qa_n3_numbering_snapshot', {})
  if (Number(before.qa_n3_invoice_count) !== 0) throw new Error('N3_PREEXISTING_FIXTURE_RESIDUE')
  const runs = []
  const run = () => { const id = crypto.randomBytes(16).toString('hex'); runs.push(id); return id }
  let cleanupComplete = false

  let primaryFailure = null
  try {
    const concurrentRun = run()
    const concurrentFixture = await createDrafts(baseClient, concurrentRun, 2026, 10)
    const draftRows = await invoiceRows(baseClient, concurrentFixture.ids)
    if (draftRows.length !== 10 || draftRows.some((row) => row.status !== 'draft' || row.invoice_number !== null || row.display_code !== null)) {
      throw new Error('N3_DRAFT_FIXTURE_NOT_NONFISCAL')
    }
    const afterDraft = await rpc(baseClient, 'qa_n3_numbering_snapshot', {})
    if (afterDraft.sequence_last_value !== before.sequence_last_value || afterDraft.sequence_is_called !== before.sequence_is_called) {
      throw new Error('N3_DRAFT_MOVED_LEGACY_SEQUENCE')
    }
    const fiscal = await fiscalSnapshot(baseClient, concurrentFixture.clientId)
    const expectedFirstSequence = Number(afterDraft.next_sequence_2026)
    const intervals = []
    const startedAt = performance.now()
    const clients = Array.from({ length: 10 }, () => makeClient(session, createProbeFetch(ISSUE_RPC, startedAt, intervals)))
    const gate = Promise.resolve()
    const results = await Promise.all(concurrentFixture.ids.map(async (id, index) => {
      await gate
      return issue(clients[index], id, draftRows.find((row) => row.id === id), fiscal, concurrentRun)
    }))
    assertOverlap(intervals, 10)
    const issuedRows = await invoiceRows(baseClient, concurrentFixture.ids)
    const fiscalCodes = issuedRows.map((row) => row.invoice_number)
    const displayCodes = issuedRows.map((row) => row.display_code)
    const sortedSequences = fiscalCodes.map((code) => Number(code.slice(5))).sort((a, b) => a - b)
    if (issuedRows.some((row) => row.status !== 'issued')
      || new Set(fiscalCodes).size !== 10 || new Set(displayCodes).size !== 10
      || sortedSequences.some((sequence, index) => sequence !== expectedFirstSequence + index)
      || issuedRows.some((row) => !/^2026-\d{3,}$/.test(row.invoice_number)
        || !new RegExp(`^INV-2026-${row.invoice_number.slice(5)}$`).test(row.display_code))) {
      throw new Error('N3_CONCURRENT_NUMBERING_INVARIANT_FAILED')
    }

    const firstId = concurrentFixture.ids[0]
    const firstRow = issuedRows.find((row) => row.id === firstId)
    await issue(baseClient, firstId, firstRow, fiscal, concurrentRun)
    const afterRetry = (await invoiceRows(baseClient, [firstId]))[0]
    if (afterRetry.invoice_number !== firstRow.invoice_number || afterRetry.display_code !== firstRow.display_code) {
      throw new Error('N3_RETRY_RENUMBERED')
    }
    const issuedCancelled = await rpc(baseClient, 'qa_n3_cancel_invoice', { p_run_id: concurrentRun, p_invoice_id: firstId })
    if (issuedCancelled.status !== 'cancelled' || issuedCancelled.invoice_number !== firstRow.invoice_number
      || issuedCancelled.display_code !== firstRow.display_code) throw new Error('N3_ISSUED_CANCEL_DID_NOT_PRESERVE_NUMBER')
    const protections = await rpc(baseClient, 'qa_n3_assert_fiscal_protections', { p_run_id: concurrentRun, p_invoice_id: firstId })
    if (protections?.renumber_blocked !== true || protections?.year_change_blocked !== true || protections?.delete_blocked !== true) {
      throw new Error('N3_FISCAL_IMMUTABILITY_GUARDS_FAILED')
    }

    const draftCancelRun = run()
    const draftCancelFixture = await createDrafts(baseClient, draftCancelRun, 2026, 1)
    const cancelledDraft = await rpc(baseClient, 'qa_n3_cancel_invoice', { p_run_id: draftCancelRun, p_invoice_id: draftCancelFixture.ids[0] })
    if (cancelledDraft.status !== 'cancelled' || cancelledDraft.invoice_number !== null || cancelledDraft.display_code !== null) {
      throw new Error('N3_DRAFT_CANCEL_CONSUMED_NUMBER')
    }
    const cancelledDraftRow = (await invoiceRows(baseClient, draftCancelFixture.ids))[0]
    const cancelledDraftFiscal = await fiscalSnapshot(baseClient, draftCancelFixture.clientId)
    const reissuedCancelledDraft = await issue(baseClient, draftCancelFixture.ids[0], cancelledDraftRow, cancelledDraftFiscal, draftCancelRun)
    if (!reissuedCancelledDraft.invoice_number || !reissuedCancelledDraft.display_code) {
      throw new Error('N3_CANCELLED_DRAFT_REISSUE_DID_NOT_ALLOCATE')
    }

    const rolloverRun = run()
    const rolloverFixture = await createDrafts(baseClient, rolloverRun, 2027, 1)
    const rolloverDraft = (await invoiceRows(baseClient, rolloverFixture.ids))[0]
    const rolloverFiscal = await fiscalSnapshot(baseClient, rolloverFixture.clientId)
    const rollover = await issue(baseClient, rolloverFixture.ids[0], rolloverDraft, rolloverFiscal, rolloverRun)
    if (rollover.invoice_number !== '2027-001' || rollover.display_code !== 'INV-2027-001') throw new Error('N3_YEAR_ROLLOVER_FAILED')

    const rollbackRun = run()
    const rollbackFixture = await createDrafts(baseClient, rollbackRun, 2026, 1)
    const rollbackDraft = (await invoiceRows(baseClient, rollbackFixture.ids))[0]
    const rollbackFiscal = await fiscalSnapshot(baseClient, rollbackFixture.clientId)
    const beforeFailedIssue = await rpc(baseClient, 'qa_n3_numbering_snapshot', {})
    const { data: existingLine, error: lineError } = await baseClient.from('invoice_lines').select('id').limit(1).single()
    if (lineError || !existingLine?.id) throw new Error('N3_ROLLBACK_DUPLICATE_LINE_SEED_MISSING')
    const failedIssue = await baseClient.rpc('save_invoice_with_lines_v2', invoicePayload(
      rollbackFixture.ids[0], rollbackDraft, rollbackFiscal, rollbackRun, existingLine.id,
    ))
    if (!failedIssue.error) throw new Error('N3_EXPECTED_POST_ALLOCATION_FAILURE_NOT_RAISED')
    const afterFailedIssue = (await invoiceRows(baseClient, rollbackFixture.ids))[0]
    if (afterFailedIssue.status !== 'draft' || afterFailedIssue.invoice_number !== null || afterFailedIssue.display_code !== null) {
      throw new Error('N3_FAILED_ISSUE_LEFT_FISCAL_RESIDUE')
    }
    const afterFailedIssueSnapshot = await rpc(baseClient, 'qa_n3_numbering_snapshot', {})
    if (afterFailedIssueSnapshot.next_sequence_2026 !== beforeFailedIssue.next_sequence_2026
      || afterFailedIssueSnapshot.fiscal_mapping_hash !== beforeFailedIssue.fiscal_mapping_hash) {
      throw new Error('N3_FAILED_ISSUE_MAPPING_OR_NEXT_NUMBER_INVARIANT_FAILED')
    }

    const paidRun = run()
    const paidFixture = await createDrafts(baseClient, paidRun, 2026, 1)
    const paidIntervals = []
    const paidClient = makeClient(session, createProbeFetch(SETTLE_RPC, performance.now(), paidIntervals))
    const paidResult = await rpc(paidClient, 'settle_invoice_by_transfer', { p_invoice_id: paidFixture.ids[0] })
    const paidRow = (await invoiceRows(baseClient, paidFixture.ids))[0]
    if (paidRow.status !== 'paid' || !paidRow.invoice_number || !paidRow.display_code
      || paidResult?.created_payment !== true) throw new Error('N3_DIRECT_PAID_NUMBERING_FAILED')

    const settlementRun = run()
    const settlementFixture = await createDrafts(baseClient, settlementRun, 2026, 1)
    const settlementIntervals = []
    const settlementStartedAt = performance.now()
    const settlementClients = Array.from({ length: 2 }, () => makeClient(session, createProbeFetch(SETTLE_RPC, settlementStartedAt, settlementIntervals)))
    const settlementResults = await Promise.all(settlementClients.map((client) => rpc(client, 'settle_invoice_by_transfer', { p_invoice_id: settlementFixture.ids[0] })))
    assertOverlap(settlementIntervals, 2)
    const { data: payments, error: paymentError } = await baseClient.from('payments').select('id,amount').eq('invoice_id', settlementFixture.ids[0])
    const settled = (await invoiceRows(baseClient, settlementFixture.ids))[0]
    const paymentTotal = (payments ?? []).reduce((sum, row) => sum + Number(row.amount), 0)
    if (paymentError || payments?.length !== 1 || paymentTotal > Number(settled.total)
      || settlementResults.filter((result) => result?.created_payment === true).length !== 1
      || settlementResults.filter((result) => result?.created_payment === false).length !== 1
      || settled.status !== 'paid' || !settled.invoice_number) throw new Error('N3_SAME_INVOICE_SETTLEMENT_REGRESSION_FAILED')

    for (const runId of runs) {
      const cleanup = await rpc(baseClient, 'qa_n3_cleanup', { p_run_id: runId })
      if (Number(cleanup?.qa_n3_residue) !== 0) throw new Error('N3_FIXTURE_CLEANUP_RESIDUE')
    }
    cleanupComplete = true
    const after = await rpc(baseClient, 'qa_n3_numbering_snapshot', {})
    if (after.fiscal_mapping_hash !== before.fiscal_mapping_hash
      || after.invoice_count !== before.invoice_count
      || after.sequence_last_value !== before.sequence_last_value
      || after.sequence_is_called !== before.sequence_is_called
      || Number(after.qa_n3_invoice_count) !== 0) throw new Error('N3_QA_BASELINE_NOT_RESTORED')

    process.stdout.write(`${JSON.stringify({
      QA_PROJECT: session.projectRef,
      AUTH_SESSION_PRESENT: true,
      QA_IDENTITY_PRESENT: true,
      AUTH_BYPASS_USED: false,
      DRAFTS_CREATED_WITHOUT_NUMBERS: 10,
      DRAFTS_MOVE_LEGACY_SEQUENCE: false,
      CONCURRENT_ISSUES: intervals.length,
      UNIQUE_FISCAL_NUMBERS: new Set(fiscalCodes).size,
      UNIQUE_DISPLAY_CODES: new Set(displayCodes).size,
      NUMBERING_SERIALIZATION: 'PASS',
      ISSUE_RETRY_RENUMBERING: 0,
      ISSUED_TO_CANCELLED_NUMBER_PRESERVED: true,
      DRAFT_TO_CANCELLED_NEW_NUMBER: false,
      CANCELLED_DRAFT_REISSUE_ALLOCATES: true,
      NORMAL_RENUMBERING_BLOCKED: protections.renumber_blocked,
      NORMAL_FISCAL_HARD_DELETE: protections.delete_blocked,
      PAID_ALLOCATES_NUMBER: true,
      FAILED_ISSUE_RESIDUE: 0,
      FAILED_ISSUE_NUMBERING_GAP: 0,
      SAME_INVOICE_CONCURRENT_SETTLEMENT: 'PASS',
      SAME_INVOICE_PAYMENT_ROWS: payments.length,
      YEAR_ROLLOVER: `${rollover.invoice_number}/${rollover.display_code}`,
      QA_N3_RESIDUE: 0,
      FISCAL_MAPPING_RESTORED: true,
      LEGACY_SEQUENCE_RESTORED: true,
      REAL_QA_BUSINESS_ROWS_CHANGED: 0,
      RUNTIME_BUSINESS_WRITES: 0,
    }, null, 2)}\n`)
  } catch (error) {
    primaryFailure = error
    throw error
  } finally {
    if (!cleanupComplete) {
      const cleanupFailures = []
      for (const runId of runs) {
        try {
          const { data, error } = await baseClient.rpc('qa_n3_cleanup', { p_run_id: runId })
          const result = normalizeRpc(data)
          if (error || Number(result?.qa_n3_residue) !== 0) cleanupFailures.push(runId)
        } catch {
          cleanupFailures.push(runId)
        }
      }
      if (cleanupFailures.length > 0) {
        const cleanupError = new Error(`N3_EMERGENCY_FIXTURE_CLEANUP_FAILED runs=${cleanupFailures.join(',')}`)
        if (primaryFailure) {
          throw new AggregateError(
            [primaryFailure, cleanupError],
            `${cleanupError.message}; original=${primaryFailure instanceof Error ? primaryFailure.message : 'UNKNOWN'}`,
          )
        }
        throw cleanupError
      }
    }
  }
}

main().catch((error) => {
  process.stderr.write(`N3 invoice numbering QA failed: ${error instanceof Error ? error.message : 'UNKNOWN'}\n`)
  process.exitCode = 1
})
