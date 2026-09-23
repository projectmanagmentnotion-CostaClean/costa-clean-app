import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync('supabase/migrations/20260923150000_n4_recurring_service_plans.sql', 'utf8')
const api = readFileSync('src/features/jobs/recurringServiceApi.ts', 'utf8')
const ui = readFileSync('src/features/jobs/RecurringServicePlans.tsx', 'utf8')

describe('N4 recurring service contract', () => {
  it('persists bounded plans and keeps occurrence identity unique', () => {
    expect(migration).toContain('create table if not exists public.recurring_service_plans')
    expect(migration).toContain("status in ('active', 'paused', 'ended', 'archived')")
    expect(migration).toContain("schedule_kind text not null check (schedule_kind in ('weekly', 'biweekly', 'monthly'))")
    expect(migration).toContain('jobs_recurring_plan_occurrence_uidx')
    expect(migration).toContain('on conflict (id) do update')
    expect(migration).toContain('save_recurring_service_plan')
    expect(migration).toContain('recurring_relationship_required')
    expect(migration).toContain('recurring_property_client_mismatch')
    expect(migration).toContain('recurring_template_invalid')
    expect(migration).toContain('recurring_service_plan_slots')
    expect(migration).toContain('recurring_service_occurrences')
    expect(migration).toContain('save_recurring_service_plan_schedule')
  })

  it('bounds generation, preserves idempotency, and has no financial side effects', () => {
    expect(migration).toContain("p_through_date - p_from_date > 90")
    expect(migration).toContain('generate_recurring_service_occurrences')
    expect(migration).toContain('on conflict (recurring_service_plan_id, recurring_occurrence_date)')
    expect(migration).toContain('insert into public.job_lines')
    expect(migration).toContain("'Europe/Madrid'")
    expect(migration).toContain('workers_required')
    expect(migration).not.toMatch(/insert into public\.(invoices|payments)|createAtomicFinancialOperation|create_invoice|create_payment/i)
  })

  it('exposes authenticated API actions and explicit 30/60/90-day generation', () => {
    expect(api).toContain("rpc('save_recurring_service_plan'")
    expect(api).toContain("rpc('generate_recurring_service_occurrences'")
    expect(api).toContain("rpc('set_recurring_service_plan_status'")
    expect(ui).toContain('value="30"')
    expect(ui).toContain('value="60"')
    expect(ui).toContain('value="90"')
    expect(ui).toContain('generationHorizon')
  })
})
