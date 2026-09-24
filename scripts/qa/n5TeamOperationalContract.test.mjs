import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync('supabase/migrations/20260923170000_n5_team_operational_hours.sql', 'utf8')
const helpers = readFileSync('src/features/jobs/teamOperational.ts', 'utf8')
const teamUi = readFileSync('src/features/jobs/TeamManagement.tsx', 'utf8')
const workforceUi = readFileSync('src/features/jobs/JobWorkforcePanel.tsx', 'utf8')

describe('N5 team and operational hours contract', () => {
  it('separates the operational roster from authorization memberships', () => {
    expect(migration).toContain('create table if not exists public.team_members')
    expect(migration).not.toMatch(/auth_user_id|user_id|password|bank_account|social_security|payroll/i)
    expect(migration).toContain("status in ('active', 'inactive')")
    expect(migration).toContain('default_hourly_cost numeric check (default_hourly_cost is null or default_hourly_cost >= 0)')
    expect(migration).toContain('portal_private.is_active_internal_staff(auth.uid())')
    expect(migration).toContain('revoke all on table public.team_members from public, anon, authenticated')
  })

  it('protects assignment and time relationships and snapshots cost', () => {
    expect(migration).toContain('create table if not exists public.job_team_assignments')
    expect(migration).toContain('unique (job_id, team_member_id)')
    expect(migration).toContain('create table if not exists public.job_time_entries')
    expect(migration).toContain('unique (job_id, team_member_id, work_date)')
    expect(migration).toContain('team_assignment_duplicate_worker')
    expect(migration).toContain('team_worker_invalid')
    expect(migration).toContain('team_time_worker_not_assigned')
    expect(migration).toContain('team_time_minutes_invalid')
    expect(migration).toContain('coalesce(nullif(a ->> \'hourly_cost_snapshot\', \'\')::numeric, t.default_hourly_cost)')
    expect(migration).toContain('coalesce(job_time_entries.hourly_cost_snapshot, excluded.hourly_cost_snapshot)')
  })

  it('uses authenticated atomic RPCs without payroll or financial writes', () => {
    expect(migration).toContain('save_job_team_assignments')
    expect(migration).toContain('save_job_time_entry')
    expect(migration).toContain('delete from public.job_team_assignments where job_id = p_job_id')
    expect(migration).not.toMatch(/insert into public\.(invoices|payments)|create_invoice|create_payment|payroll|salary/i)
    expect(helpers).toContain('normalizeHoursToMinutes')
    expect(helpers).toContain('calculateLaborCost')
  })

  it('exposes internal team actions and a non-blocking no-hours warning', () => {
    expect(teamUi).toContain('Nuevo miembro')
    expect(teamUi).toContain('Editar / desactivar')
    expect(teamUi).toContain('Editar / reactivar')
    expect(workforceUi).toContain('Guardar equipo')
    expect(workforceUi).toContain('Guardar horas')
    expect(workforceUi).toContain('Servicio sin horas registradas.')
  })
})
