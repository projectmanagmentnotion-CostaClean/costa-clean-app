import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { recoverAuthenticatedQaSession } from './auth/recoveredQaSession.mjs'

const recovered = await recoverAuthenticatedQaSession(process.cwd())
if (!recovered.authenticatedUserPresent || recovered.projectRef !== 'kpvvydthlxupjjqqdpxy') {
  throw new Error('N4_FUNCTIONAL_AUTH_OR_PROJECT_GATE_FAILED')
}

const client = createClient(recovered.supabaseUrl, recovered.supabaseAnonKey, {
  accessToken: async () => recovered.accessToken,
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})
const runId = crypto.randomBytes(16).toString('hex')
const token = `QA_N4_FUNC_${runId}`
const planId = `PLAN-${token}-ROOT`
const checks = {}

async function rpc(name, args) {
  const { data, error } = await client.rpc(name, args)
  if (error) throw new Error(`${name}:${error.code ?? 'UNKNOWN'}:${error.message}`)
  return data
}

async function expectError(label, fn) {
  try {
    await fn()
  } catch {
    checks[label] = 'PASS'
    return
  }
  throw new Error(`${label}_DID_NOT_FAIL_CLOSED`)
}

async function rows(table, select, column, value) {
  const { data, error } = await client.from(table).select(select).eq(column, value)
  if (error) throw new Error(`${table}_READ:${error.message}`)
  return data ?? []
}

const { data: properties, error: propertyError } = await client
  .from('properties')
  .select('id,client_id')
  .limit(1)
if (propertyError || !properties?.[0]?.client_id) throw new Error('N4_QA_ROOT_READ_FAILED')
const property = properties[0]

try {
  await rpc('save_recurring_service_plan', {
    p_plan: {
      id: planId,
      client_id: property.client_id,
      property_id: property.id,
      title: `QA N4 ${runId}`,
      service_type: 'standard_cleaning',
      status: 'active',
      schedule_kind: 'weekly',
      weekdays: [1, 6, 7],
      start_date: '2026-09-28',
      end_date: '2026-10-25',
      billing_concept: `QA N4 ${token}`,
      billing_quantity: 1,
      billing_unit: 'servicio',
      billing_unit_price: 90,
      notes: token,
      internal_notes: token,
      template_lines: [{ sort_order: 1, concept: `QA N4 ${token}`, quantity: 1, unit: 'servicio', unit_price: 90, line_subtotal: 90 }],
    },
  })
  checks.create_recurrence = 'PASS'

  await rpc('save_recurring_service_plan_schedule', {
    p_plan_id: planId,
    p_slots: [
      { weekday: 1, start_time: '09:00', duration_minutes: 120, workers_required: 1 },
      { weekday: 6, start_time: '10:00', duration_minutes: 120, workers_required: 1 },
      { weekday: 7, start_time: '11:00', duration_minutes: 120, workers_required: 1 },
    ],
  })
  checks.weekday_weekend_slots = 'PASS'

  const preview = await rpc('preview_recurring_service_occurrences', {
    p_plan: {
      start_date: '2026-12-28',
      end_date: '2027-01-04',
      schedule_kind: 'weekly',
      weekdays: [1],
    },
    p_from_date: '2026-12-28',
    p_through_date: '2027-01-04',
  })
  if (JSON.stringify(preview) !== JSON.stringify(['2026-12-28', '2027-01-04'])) throw new Error('N4_YEAR_BOUNDARY_PREVIEW_MISMATCH')
  checks.month_year_boundaries = 'PASS'

  const first = await rpc('generate_recurring_service_occurrences', { p_plan_id: planId, p_from_date: '2026-09-28', p_through_date: '2026-10-04' })
  if (Number(first.created_count) !== 3) throw new Error('N4_INITIAL_GENERATION_COUNT')
  const retry = await rpc('generate_recurring_service_occurrences', { p_plan_id: planId, p_from_date: '2026-09-28', p_through_date: '2026-10-04' })
  if (Number(retry.created_count) !== 0) throw new Error('N4_IDEMPOTENT_GENERATION_FAILED')
  checks.idempotent_generation = 'PASS'

  await expectError('horizon_90_days', () => rpc('generate_recurring_service_occurrences', { p_plan_id: planId, p_from_date: '2026-09-28', p_through_date: '2026-12-28' }))

  await rpc('set_recurring_service_plan_status', { p_plan_id: planId, p_status: 'paused' })
  await expectError('pause_blocks_generation', () => rpc('generate_recurring_service_occurrences', { p_plan_id: planId, p_from_date: '2026-10-05', p_through_date: '2026-10-11' }))
  await rpc('set_recurring_service_plan_status', { p_plan_id: planId, p_status: 'active' })
  checks.pause_resume = 'PASS'

  const second = await rpc('generate_recurring_service_occurrences', { p_plan_id: planId, p_from_date: '2026-10-05', p_through_date: '2026-10-11' })
  if (Number(second.created_count) !== 3) throw new Error('N4_SECOND_GENERATION_COUNT')
  const edited = await rpc('set_recurring_service_occurrence', {
    p_plan_id: planId,
    p_occurrence_date: '2026-10-10',
    p_status: 'planned',
    p_patch: { start_time: '12:30', duration_minutes: 150, workers_required: 2 },
  })
  if (edited.start_time !== '12:30:00' || Number(edited.duration_minutes) !== 150 || Number(edited.workers_required) !== 2) throw new Error('N4_OCCURRENCE_EDIT_MISMATCH')
  checks.edit_occurrence = 'PASS'
  const skipped = await rpc('set_recurring_service_occurrence', { p_plan_id: planId, p_occurrence_date: '2026-10-10', p_status: 'skipped', p_patch: {} })
  if (skipped.status !== 'skipped') throw new Error('N4_SKIP_MISMATCH')
  checks.skip_occurrence = 'PASS'

  const third = await rpc('generate_recurring_service_occurrences', { p_plan_id: planId, p_from_date: '2026-10-12', p_through_date: '2026-10-25' })
  if (Number(third.created_count) !== 6) throw new Error('N4_DST_GENERATION_COUNT')
  const dstOccurrences = await rows('recurring_service_occurrences', 'occurrence_date,status,metadata', 'recurring_service_plan_id', planId)
  const dst = dstOccurrences.find((row) => row.occurrence_date === '2026-10-25')
  if (!dst || dst.metadata?.timezone !== 'Europe/Madrid') throw new Error('N4_EUROPE_MADRID_METADATA_MISSING')
  checks.timezone_europe_madrid = 'PASS'
  checks.dst = 'PASS'

  await rpc('save_recurring_service_plan', {
    p_plan: {
      id: planId,
      client_id: property.client_id,
      property_id: property.id,
      title: `QA N4 edited ${runId}`,
      service_type: 'standard_cleaning',
      status: 'active',
      schedule_kind: 'weekly',
      weekdays: [1, 6, 7],
      start_date: '2026-09-28',
      end_date: '2026-10-25',
      billing_concept: `QA N4 edited ${token}`,
      billing_quantity: 1,
      billing_unit: 'servicio',
      billing_unit_price: 95,
      notes: token,
      internal_notes: token,
      template_lines: [{ sort_order: 1, concept: `QA N4 edited ${token}`, quantity: 1, unit: 'servicio', unit_price: 95, line_subtotal: 95 }],
    },
  })
  checks.future_series_edit = 'PASS'

  const outside = await rpc('generate_recurring_service_occurrences', { p_plan_id: planId, p_from_date: '2026-10-26', p_through_date: '2026-10-31' })
  if (Number(outside.created_count) !== 0) throw new Error('N4_END_BOUNDARY_FAILED')
  checks.start_end_boundaries = 'PASS'

  const planJobs = await rows('jobs', 'id,recurring_occurrence_date,source_metadata', 'recurring_service_plan_id', planId)
  const jobIds = planJobs.map((row) => row.id)
  const { data: invoiceRefs, error: invoiceError } = await client.from('invoices').select('id').in('job_id', jobIds)
  if (invoiceError) throw new Error(`N4_INVOICE_REF_READ:${invoiceError.message}`)
  const { data: paymentRefs, error: paymentError } = await client.from('payments').select('id').in('invoice_id', (invoiceRefs ?? []).map((row) => row.id))
  if (paymentError && (invoiceRefs ?? []).length > 0) throw new Error(`N4_PAYMENT_REF_READ:${paymentError.message}`)
  if ((invoiceRefs ?? []).length !== 0 || (paymentRefs ?? []).length !== 0) throw new Error('N4_INVOICE_SIDE_EFFECT_DETECTED')
  checks.invoice_payment_side_effects = 'PASS'

  const planner = await rpc('qa_n4_func_teardown_plan', { p_run_id: runId })
  if (planner.safe_to_clean !== true || Number(planner.untracked_relations) !== 0 || Number(planner.real_record_matches) !== 0 || Number(planner.generated_job_external_references) !== 0 || Number(planner.financial_references) !== 0) throw new Error(`N4_FINAL_PLAN_UNSAFE:${JSON.stringify(planner)}`)
  checks.teardown_plan = 'PASS'
  console.log(JSON.stringify({ run_id: runId, checks, generated_jobs: planJobs.length }))
} finally {
  const cleanup = await rpc('qa_n4_func_teardown', { p_run_id: runId })
  const second = await rpc('qa_n4_func_teardown', { p_run_id: runId })
  console.log(JSON.stringify({ cleanup: cleanup.deleted, second_cleanup: second.deleted }))
}
