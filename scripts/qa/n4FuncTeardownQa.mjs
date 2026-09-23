import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { recoverAuthenticatedQaSession } from './auth/recoveredQaSession.mjs'

const rootDir = process.cwd()
const recovered = await recoverAuthenticatedQaSession(rootDir)
if (!recovered.authenticatedUserPresent || recovered.projectRef !== 'kpvvydthlxupjjqqdpxy') {
  throw new Error('N4_TEARDOWN_AUTH_OR_PROJECT_GATE_FAILED')
}

const client = createClient(recovered.supabaseUrl, recovered.supabaseAnonKey, {
  accessToken: async () => recovered.accessToken,
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

async function rpc(name, args) {
  const { data, error } = await client.rpc(name, args)
  if (error) throw new Error(`${name}:${error.code ?? 'UNKNOWN'}:${error.message}`)
  return data
}

const malformed = await client.rpc('qa_n4_func_teardown_plan', { p_run_id: 'not-a-run' })
if (!malformed.error) throw new Error('N4_MALFORMED_RUN_NOT_BLOCKED')

const requestedRunId = process.env.N4_TEARDOWN_RUN_ID?.trim().toLowerCase() || null
if (requestedRunId && !/^[0-9a-f]{32}$/u.test(requestedRunId)) {
  throw new Error('N4_TEARDOWN_RUN_ID_INVALID')
}

if (requestedRunId) {
  const before = await rpc('qa_n4_func_teardown_plan', { p_run_id: requestedRunId })
  if (before.safe_to_clean !== true) throw new Error(`N4_UNSAFE_EXISTING_PLAN:${JSON.stringify(before)}`)
  const cleaned = await rpc('qa_n4_func_teardown', { p_run_id: requestedRunId })
  const secondPlan = await rpc('qa_n4_func_teardown_plan', { p_run_id: requestedRunId })
  const secondCleanup = await rpc('qa_n4_func_teardown', { p_run_id: requestedRunId })
  console.log(JSON.stringify({
    run_id: requestedRunId,
    planner: before,
    deleted: cleaned.deleted,
    second_planner: secondPlan,
    second_cleanup: secondCleanup.deleted,
    malformed_run_blocked: true,
  }))
  process.exit(0)
}

const { data: properties, error: propertyError } = await client
  .from('properties')
  .select('id,client_id')
  .limit(1)
if (propertyError || !properties?.[0]?.client_id) {
  throw new Error(`N4_QA_ROOT_READ_FAILED:${propertyError?.message ?? 'no property'}`)
}

const property = properties[0]
const runId = crypto.randomBytes(16).toString('hex')
const token = `QA_N4_FUNC_${runId}`
const planId = `PLAN-${token}-ROOT`

await rpc('save_recurring_service_plan', {
  p_plan: {
    id: planId,
    client_id: property.client_id,
    property_id: property.id,
    title: `QA N4 ${runId}`,
    service_type: 'standard_cleaning',
    status: 'active',
    schedule_kind: 'weekly',
    weekdays: [1, 6],
    start_date: '2026-09-28',
    end_date: '2026-10-04',
    billing_concept: `QA N4 ${token}`,
    billing_quantity: 1,
    billing_unit: 'servicio',
    billing_unit_price: 90,
    notes: token,
    internal_notes: token,
    template_lines: [{
      sort_order: 1,
      concept: `QA N4 ${token}`,
      quantity: 1,
      unit: 'servicio',
      unit_price: 90,
      line_subtotal: 90,
    }],
  },
})

await rpc('save_recurring_service_plan_schedule', {
  p_plan_id: planId,
  p_slots: [
    { weekday: 1, start_time: '09:00', duration_minutes: 120, workers_required: 1 },
    { weekday: 6, start_time: '10:00', duration_minutes: 120, workers_required: 1 },
  ],
})

const generated = await rpc('generate_recurring_service_occurrences', {
  p_plan_id: planId,
  p_from_date: '2026-09-28',
  p_through_date: '2026-10-04',
})
const before = await rpc('qa_n4_func_teardown_plan', { p_run_id: runId })
if (
  before.safe_to_clean !== true
  || Number(before.untracked_relations) !== 0
  || Number(before.real_record_matches) !== 0
  || Number(before.generated_job_external_references) !== 0
  || Number(before.financial_references) !== 0
) {
  throw new Error(`N4_UNSAFE_TEARDOWN_PLAN:${JSON.stringify(before)}`)
}

const cleaned = await rpc('qa_n4_func_teardown', { p_run_id: runId })
const secondPlan = await rpc('qa_n4_func_teardown_plan', { p_run_id: runId })
const secondCleanup = await rpc('qa_n4_func_teardown', { p_run_id: runId })
const { data: remainingPlans, error: residueError } = await client
  .from('recurring_service_plans')
  .select('id')
  .eq('id', planId)
if (residueError) throw new Error(`N4_RESIDUE_READ_FAILED:${residueError.message}`)

console.log(JSON.stringify({
  run_id: runId,
  generated_count: generated?.created_count ?? null,
  planner: {
    plans: before.plans,
    slots: before.slots,
    occurrences: before.occurrences,
    jobs: before.jobs,
    job_lines: before.job_lines,
    untracked_relations: before.untracked_relations,
    real_record_matches: before.real_record_matches,
    generated_job_external_references: before.generated_job_external_references,
    safe_to_clean: before.safe_to_clean,
  },
  deleted: cleaned.deleted,
  second_planner: {
    plans: secondPlan.plans,
    slots: secondPlan.slots,
    occurrences: secondPlan.occurrences,
    jobs: secondPlan.jobs,
    job_lines: secondPlan.job_lines,
    safe_to_clean: secondPlan.safe_to_clean,
  },
  second_cleanup: secondCleanup.deleted,
  residue: remainingPlans?.length ?? 0,
  malformed_run_blocked: true,
}))
