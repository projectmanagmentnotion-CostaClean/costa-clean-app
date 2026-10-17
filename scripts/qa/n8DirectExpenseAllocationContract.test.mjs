import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

const migration = readFileSync('supabase/migrations/20260923200000_n8_direct_expense_allocations.sql', 'utf8')
const allocation = readFileSync('src/features/jobs/expenseAllocation.ts', 'utf8')
const allocationApi = readFileSync('src/features/jobs/expenseAllocationApi.ts', 'utf8')
const jobPanel = readFileSync('src/features/jobs/JobExpenseAllocationPanel.tsx', 'utf8')
const expensePanel = readFileSync('src/features/expenses/ExpenseAllocationSummaryPanel.tsx', 'utf8')
const profitability = readFileSync('src/features/jobs/JobProfitabilityPanel.tsx', 'utf8')

test('N8 allocation contract is bounded and source-preserving', () => {
  expect(migration).toContain('create table if not exists public.job_expense_allocations')
  expect(migration).toContain('unique (expense_id, job_id)')
  expect(migration).toContain('idempotency_key text unique')
  expect(migration).toContain('expense_subtotal_snapshot')
  expect(migration).toContain('EXPENSE_ALLOCATION_EXCEEDS_BASE')
  expect(migration).toContain('EXPENSE_ALREADY_LINKED_TO_INVENTORY')
  expect(migration).toContain('material_movements mm where mm.expense_id = v_expense.id')
  expect(migration).toContain('v_expense.category not in')
  expect(migration).toContain('portal_private.require_active_internal_staff()')
  expect(migration).toContain('revoke all on table public.job_expense_allocations from public, anon, authenticated')
  expect(migration).not.toMatch(/update\s+public\.expenses/i)
  expect(migration).not.toMatch(/delete\s+from\s+public\.expenses/i)
})

test('N8 read model adds final direct profitability without fiscal or net-profit claims', () => {
  expect(migration).toContain('get_job_final_profitability')
  expect(migration).toContain('list_job_final_profitability')
  expect(migration).toContain('actual_other_direct_cost')
  expect(migration).toContain('actual_total_direct_cost')
  expect(migration).toContain('actual_direct_contribution_final')
  expect(migration).toContain('direct_margin_final_percent')
  expect(profitability).toContain('Otros costes directos')
  expect(profitability).toContain('Margen directo final')
  expect(profitability).toContain('Margen % final')
})

test('N8 UI and API remain internal allocation surfaces', () => {
  expect(allocation).toContain('allocatableExpenseCategories')
  expect(allocationApi).toContain('save_job_expense_allocation')
  expect(allocationApi).toContain('remove_job_expense_allocation')
  expect(jobPanel).toContain('job-expense-allocations')
  expect(jobPanel).toContain('idempotency_key')
  expect(expensePanel).toContain('expense-allocation-summary')
})
