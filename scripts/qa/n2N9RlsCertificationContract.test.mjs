import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const tableContracts = [
  { file: 'supabase/migrations/20260923120000_n2_atomic_financial_operation.sql', table: 'financial_operation_idempotency', forced: false },
  { file: 'supabase/migrations/20260923150000_n4_recurring_service_plans.sql', table: 'recurring_service_plans', forced: false },
  { file: 'supabase/migrations/20260923170000_n5_team_operational_hours.sql', table: 'team_members', forced: true },
  { file: 'supabase/migrations/20260923170000_n5_team_operational_hours.sql', table: 'job_team_assignments', forced: true },
  { file: 'supabase/migrations/20260923170000_n5_team_operational_hours.sql', table: 'job_time_entries', forced: true },
  { file: 'supabase/migrations/20260923190000_n7_material_control.sql', table: 'materials', forced: true },
  { file: 'supabase/migrations/20260923190000_n7_material_control.sql', table: 'material_movements', forced: true },
  { file: 'supabase/migrations/20260923200000_n8_direct_expense_allocations.sql', table: 'job_expense_allocations', forced: true },
  { file: 'supabase/migrations/20260923230000_n9_recurring_operational_templates_v2.sql', table: 'recurring_service_team_templates', forced: true },
  { file: 'supabase/migrations/20260923230000_n9_recurring_operational_templates_v2.sql', table: 'recurring_service_material_templates', forced: true },
  { file: 'supabase/migrations/20260923230000_n9_recurring_operational_templates_v2.sql', table: 'job_material_requirements', forced: true },
];

test('RC3 RLS certifier derives FORCE expectations per source table, never universally', () => {
  for (const contract of tableContracts) {
    const source = read(contract.file);
    expect(source).toMatch(new RegExp(`alter table public\\.${contract.table} enable row level security`, 'iu'));
    const forcePattern = new RegExp(`alter table public\\.${contract.table} force row level security`, 'iu');
    expect(source.test ? source.test(forcePattern) : forcePattern.test(source)).toBe(contract.forced);
  }
  const n2 = read('supabase/migrations/20260923120000_n2_atomic_financial_operation.sql');
  expect(n2).not.toMatch(/financial_operation_idempotency[\s\S]*force row level security/iu);
});

test('financial idempotency ledger is RPC-only and does not require FORCE RLS', () => {
  const n2 = read('supabase/migrations/20260923120000_n2_atomic_financial_operation.sql');
  expect(n2).toMatch(/financial_operation_idempotency enable row level security/iu);
  expect(n2).toMatch(/create or replace function public\.create_atomic_financial_operation/iu);
  expect(n2).toMatch(/grant execute on function public\.create_atomic_financial_operation[\s\S]*to authenticated/iu);
  expect(n2).not.toMatch(/grant .* on table public\.financial_operation_idempotency/iu);
  expect(n2).not.toMatch(/force row level security/iu);
});

test('RC3 security matrix keeps forced internal tables and behavioral gates intact', () => {
  const sources = tableContracts.map(({ file }) => read(file)).join('\n');
  expect(sources).toMatch(/portal_private\.is_active_internal_staff\(auth\.uid\(\)\)/iu);
  expect(sources).toMatch(/security definer/iu);
  expect(sources).toMatch(/set search_path =/iu);
  expect(sources).toMatch(/revoke all on table/iu);
  expect(sources).not.toMatch(/grant .* to anon/iu);
  expect(sources).not.toMatch(/relrowsecurity\s+and\s+relforcerowsecurity/iu);
});
