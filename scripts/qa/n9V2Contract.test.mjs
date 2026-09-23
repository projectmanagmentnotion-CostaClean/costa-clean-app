import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const original = read('supabase/migrations/20260923210000_n9_recurring_operational_templates.sql');
const v2 = read('supabase/migrations/20260923230000_n9_recurring_operational_templates_v2.sql');

const workloadFunction = /create or replace function public\.get_team_workload_forecast\(p_through_date date\)[\s\S]*?\n\$\$;/u;
const canonical = (source) => source
  .replace(/^-- N9[^\n]*\n(?:-- Fresh-install replacement[^\n]*\n)?-- Source-only;[^\n]*\n-- Planned rows[^\n]*\n/u, '')
  .replace(workloadFunction, '__WORKLOAD_FUNCTION__')
  .trimEnd();

test('N9 V2 preserves the original N9 object and security contract except workload implementation', () => {
  expect(canonical(v2)).toBe(canonical(original));
  expect(v2).toMatch(/security definer/iu);
  expect(v2).toMatch(/set search_path = pg_catalog, public, portal_private, pg_temp/iu);
  expect(v2).toMatch(/revoke all on function[\s\S]*from public, anon/iu);
  expect(v2).toMatch(/grant execute on function[\s\S]*to authenticated/iu);
});

test('N9 V2 embeds the two-stage workload aggregate and rejects the historical nested aggregate', () => {
  const workload = v2.match(workloadFunction)?.[0] ?? '';
  expect(workload).toMatch(/with workload as \(/iu);
  expect(workload).toMatch(/group by a\.team_member_id, m\.full_name/iu);
  expect(workload).toMatch(/jsonb_agg\([\s\S]*'planned_hours', planned_hours[\s\S]*from workload/iu);
  expect(workload).not.toMatch(/jsonb_agg\([\s\S]*sum\(/iu);
  expect(workload).not.toMatch(/round\(sum\([^)]*\),\s*2\)/iu);
});

test('N9 V2 has no dependency on obsolete N4 slot/occurrence tables or RC2 correction', () => {
  expect(v2).not.toMatch(/public\.recurring_service_(?:plan_slots|occurrences)\b/iu);
  expect(v2).not.toContain('20260923220000_n9_fix_team_workload_forecast_aggregate');
  expect(v2).toMatch(/public\.recurring_service_team_templates/iu);
  expect(v2).toMatch(/public\.recurring_service_material_templates/iu);
  expect(v2).toMatch(/public\.job_material_requirements/iu);
});

test('N9 V2 preserves planned-only behavior and internal operational isolation', () => {
  expect(v2).toMatch(/Planned rows never represent actual time, stock consumption or fiscal activity/iu);
  expect(v2).not.toMatch(/insert into public\.(?:payments|invoices|expenses)\b/iu);
  expect(v2).toMatch(/portal_private\.is_active_internal_staff\(auth\.uid\(\)\)/iu);
  expect(v2).toMatch(/for select to authenticated using/iu);
  expect(v2).not.toMatch(/grant .* to anon/iu);
});

test('N9 V2 SQL audit rejects known same-class aggregate and rounding hazards', () => {
  const functionBodies = [...v2.matchAll(/create or replace function[\s\S]*?\$\$;/giu)].map(([body]) => body);
  expect(functionBodies.length).toBeGreaterThanOrEqual(7);
  for (const body of functionBodies) {
    expect(body).not.toMatch(/jsonb_agg\([\s\S]*sum\(/iu);
    expect(body).not.toMatch(/round\(\s*[^,]+::double precision\s*,/iu);
    expect(body).not.toMatch(/select\s+\([^)]*\)\s+into\s+[^;]+from\s+[^;]+group by/iu);
  }
});
