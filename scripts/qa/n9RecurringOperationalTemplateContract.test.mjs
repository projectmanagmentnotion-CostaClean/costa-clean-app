import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

const migration = readFileSync('supabase/migrations/20260923210000_n9_recurring_operational_templates.sql', 'utf8')
const helper = readFileSync('src/features/jobs/recurringOperational.ts', 'utf8')
const editor = readFileSync('src/features/jobs/RecurringOperationalTemplateEditor.tsx', 'utf8')
const plannedPanel = readFileSync('src/features/jobs/JobPlannedMaterialsPanel.tsx', 'utf8')
const forecasts = readFileSync('src/features/jobs/PlanningForecastPanels.tsx', 'utf8')

test('N9 uses separate planned entities and atomic generation', () => {
  expect(migration).toContain('recurring_service_team_templates')
  expect(migration).toContain('recurring_service_material_templates')
  expect(migration).toContain('job_material_requirements')
  expect(migration).toContain('unique (plan_id, team_member_id)')
  expect(migration).toContain('unique (plan_id, material_id)')
  expect(migration).toContain('unique (job_id, material_id)')
  expect(migration).toContain('recurring_team_template_worker_inactive')
  expect(migration).toContain('recurring_material_template_material_inactive')
  expect(migration).toContain('insert into public.job_team_assignments')
  expect(migration).toContain('insert into public.job_material_requirements')
  expect(migration).not.toContain('insert into public.job_time_entries')
  expect(migration).not.toContain('insert into public.material_movements')
  expect(migration).not.toContain('insert into public.invoices')
  expect(migration).not.toContain('insert into public.payments')
  expect(migration).not.toContain('insert into public.expenses')
})

test('N9 preserves snapshots and exposes bounded forecasts', () => {
  expect(migration).toContain('coalesce(t.hourly_cost_override, m.default_hourly_cost)')
  expect(migration).toContain('coalesce(t.unit_cost_override, m.default_unit_cost)')
  expect(migration).toContain('get_recurring_operational_forecast')
  expect(migration).toContain('get_material_needs_forecast')
  expect(migration).toContain('get_team_workload_forecast')
  expect(migration).toContain('shortage_quantity')
  expect(helper).toContain('plannedDirectCost')
  expect(helper).toContain('plannedMarginPercent')
  expect(helper).toContain('quantityVariance')
})

test('N9 UI keeps planned and actual material surfaces distinct', () => {
  expect(editor).toContain('recurring-operational-template')
  expect(editor).toContain('Guardar operativa')
  expect(plannedPanel).toContain('job-planned-materials')
  expect(plannedPanel).toContain('consumo real se registra por separado')
  expect(forecasts).toContain('planning-forecasts')
  expect(forecasts).toContain('no reserva ni descuenta stock')
})
