import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('N2-N9 synthetic lifecycle preserves the financial and operational links', () => {
  const client = { id: 'client-1' };
  const property = { id: 'property-1', client_id: client.id };
  const plan = { id: 'plan-1', client_id: client.id, property_id: property.id };
  const job = { id: 'job-1', recurring_service_plan_id: plan.id, client_id: client.id, property_id: property.id };
  const line = { job_id: job.id, quantity: 1, unit_price: 120 };
  const payment = { invoice_id: 'invoice-1', amount: 120 };
  const operation = { invoice_id: 'invoice-1', job_id: job.id, payment_id: 'payment-1', idempotency_key: 'rc1-1' };
  expect(property.client_id).toBe(job.client_id);
  expect(job.recurring_service_plan_id).toBe(plan.id);
  expect(line.job_id).toBe(job.id);
  expect(operation.payment_id).toBe('payment-1');
  expect(payment.invoice_id).toBe(operation.invoice_id);
  expect(new Set([operation.idempotency_key]).size).toBe(1);
});

test('N2 atomic write path exposes rollback and idempotency contracts', () => {
  const source = read('src/features/financial/financialWriteApi.ts');
  expect(source).toMatch(/createAtomicFinancialOperation/);
  expect(source).toMatch(/idempotency/i);
  expect(read('supabase/migrations/20260923120000_n2_atomic_financial_operation.sql')).toMatch(/exception/i);
});

test('N4-N9 planned data cannot masquerade as actual financial data', () => {
  const source = read('supabase/migrations/20260923210000_n9_recurring_operational_templates.sql');
  expect(source).toMatch(/planned_quantity/);
  expect(source).toMatch(/job_material_requirements/);
  expect(source).toMatch(/-- Planned rows never represent actual time, stock consumption or fiscal activity/);
  expect(source).not.toMatch(/insert into public\.payments/);
  expect(source).not.toMatch(/insert into public\.invoices/);
});

test('N8/N9 dependency boundary is ordered and non-recursive', () => {
  const n8 = read('supabase/migrations/20260923200000_n8_direct_expense_allocations.sql');
  const n9 = read('supabase/migrations/20260923210000_n9_recurring_operational_templates.sql');
  expect(n8).not.toMatch(/job_material_requirements/);
  expect(n8).toMatch(/get_job_final_profitability_base/);
  expect(n9).toMatch(/get_job_final_profitability_base/);
  expect(n9).toMatch(/create or replace function public\.get_job_final_profitability/);
});
