import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('../../../supabase/migrations/20261120120000_role_scoped_expense_receipt_access.sql', import.meta.url), 'utf8').toLowerCase()

describe('role-scoped expense receipt access migration', () => {
  it('creates an explicit expense-to-operator relation with no client table access', () => {
    expect(migration).toContain('create table public.expense_receipt_assignments')
    expect(migration).toContain('expense_id uuid not null references public.expenses(id) on delete cascade')
    expect(migration).toContain('user_id uuid not null references auth.users(id) on delete cascade')
    expect(migration).toContain('alter table public.expense_receipt_assignments enable row level security')
    expect(migration).toContain('alter table public.expense_receipt_assignments force row level security')
    expect(migration).toContain('revoke all on public.expense_receipt_assignments from public, anon, authenticated, service_role')
    expect(migration).not.toContain('grant select on public.expense_receipt_assignments')
  })

  it('uses current membership roles and explicit relations, never path-derived ownership', () => {
    expect(migration).toContain("v_role_authorized := v_role in ('owner', 'admin', 'finance')")
    expect(migration).toContain("if v_role <> 'operator' then\n    return false")
    expect(migration).toContain('expense.receipt_file_path = p_object_name')
    expect(migration).toContain('from public.expense_receipt_assignments as assignment')
    expect(migration).toContain("confirmation.duplicate_decision = 'create_new'")
    expect(migration).toContain("membership.status = 'active'")
    expect(migration).toContain('membership.revoked_at is null')
    expect(migration).toMatch(/a folder segment is only a\s+-- lookup key; it never establishes ownership or authorization on its own/u)
  })

  it('makes assignment administration fail closed and Owner/Admin-only', () => {
    expect(migration).toContain('create or replace function public.assign_operator_expense_receipt_access')
    expect(migration).toContain('grant execute on function public.assign_operator_expense_receipt_access(uuid, uuid) to authenticated')
    expect(migration).toContain('create or replace function public.revoke_operator_expense_receipt_access')
    expect(migration).toContain('grant execute on function public.revoke_operator_expense_receipt_access(uuid, uuid) to authenticated')
    expect(migration).toContain('create or replace function public.list_operator_expense_receipt_access')
    expect(migration).toContain('grant execute on function public.list_operator_expense_receipt_access(uuid) to authenticated')
    expect(migration).toContain("membership.role in ('owner', 'admin')")
    expect(migration).toContain("membership.role = 'operator'")
    expect(migration).toContain('raise exception \'expense receipt assignment is not permitted.\' using errcode = \'42501\'')
  })

  it('replaces bucket-wide policies for read, upload, update, and delete', () => {
    for (const operation of ['read', 'upload', 'update', 'delete']) {
      expect(migration).toContain(`create policy "role-scoped ${operation} expense receipts"`)
    }
    expect(migration).toContain('app_private.can_access_expense_receipt_object(name, false)')
    expect(migration).toContain('app_private.can_access_expense_receipt_object(name, true)')
    expect(migration).toContain('unexpected expense-receipts storage policy requires review.')
    expect(migration).toContain('name !~ \'(^|/)[.][.]($|/)\'')
    expect(migration).toContain("drop policy if exists n51_capture_select on storage.objects")
    expect(migration).toContain('and app_private.is_current_internal_staff_writer()')
  })
})
