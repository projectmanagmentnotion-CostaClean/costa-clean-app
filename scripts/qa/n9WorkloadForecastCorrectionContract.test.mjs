import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

const migration = readFileSync('supabase/migrations/20260923220000_n9_fix_team_workload_forecast_aggregate.sql', 'utf8')

test('N9 workload correction uses two-stage aggregation', () => {
  expect(migration).toContain('create or replace function public.get_team_workload_forecast(p_through_date date)')
  expect(migration).toContain('with workload as (')
  expect(migration).toContain('group by a.team_member_id, m.full_name')
  expect(migration).toContain("'planned_hours', planned_hours")
  expect(migration).not.toMatch(/jsonb_agg\([\s\S]*sum\(/i)
  expect(migration).toContain('security definer')
  expect(migration).toContain('portal_private.is_active_internal_staff(auth.uid())')
  expect(migration).toContain('revoke all on function public.get_team_workload_forecast(date) from public, anon')
  expect(migration).toContain('grant execute on function public.get_team_workload_forecast(date) to authenticated')
})

test('N9 workload correction is explicitly a forward migration', () => {
  expect(migration).toContain('forward correction')
  expect(migration).not.toContain('drop table')
  expect(migration).not.toContain('drop function')
})
