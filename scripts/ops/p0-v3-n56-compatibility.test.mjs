import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
const guardPath = 'supabase/migrations/20261002165959_p0_expense_financial_guard_before_n56.sql'
const n56Path = 'supabase/migrations/20261002170000_n56_preproduction_security_hardening.sql'
const grantPath = 'supabase/migrations/20261002173000_expense_product_grant_hardening.sql'
const reconcilePath = 'supabase/migrations/20261002173001_p0_expense_financial_guard_reconcile.sql'
const p0Path = 'supabase/migrations/20261102120000_p0_expense_access_and_rpc_hardening.sql'
const guardSql = read(guardPath)
const n56Sql = read(n56Path)
const grantSql = read(grantPath)
const reconcileSql = read(reconcilePath)

const normalizeSql = (value) => value.replace(/\s+/g, ' ').trim().toLowerCase()
const functionBody = (sql) => {
  const match = sql.match(/create or replace function public\.expense_staff_access\(p_financial_write boolean\)[\s\S]*?as \$function\$([\s\S]*?)\$function\$;/i)
  assert.ok(match, 'expected the certified expense_staff_access function')
  return normalizeSql(match[1])
}

describe('P0/N56 SQL compatibility', () => {
  it('keeps financial guards through a P0-first N56 replacement', () => {
    expect(guardPath < n56Path).toBe(true)
    expect(guardSql).toMatch(/as restrictive for insert to authenticated/i)
    expect(guardSql).toMatch(/as restrictive for update to authenticated/i)
    expect(guardSql).toMatch(/revoke all on table public\.expenses from public, anon/i)
    expect(guardSql).toMatch(/revoke delete, truncate, references, trigger on table public\.expenses from authenticated/i)
    expect(guardSql).toMatch(/grant select, insert, update, delete on table public\.expenses to service_role/i)
    expect(guardSql).toMatch(/has_function_privilege\('anon', target_function::oid, 'EXECUTE'\)/i)
    expect(guardSql).toMatch(/financial_role_contract is null[\s\S]*?array\['owner','admin','finance'\]/i)
    expect(guardSql).toContain("regexp_replace(lower(financial_role_contract), '\\s+', '', 'g')")
    expect(n56Sql).not.toMatch(/drop policy[^;]*P0 financial guard/i)
    expect(guardSql).not.toMatch(/storage\./i)
  })

  it('fails closed and narrows N56 before removing guards in V3-first order', () => {
    expect(guardPath < n56Path).toBe(true)
    expect(n56Path < grantPath).toBe(true)
    expect(grantPath < reconcilePath).toBe(true)
    expect(reconcilePath < p0Path).toBe(true)
    const insertAlter = reconcileSql.indexOf('alter policy "Internal staff insert"')
    const updateAlter = reconcileSql.indexOf('alter policy "Internal staff update"')
    const firstGuardDrop = reconcileSql.indexOf('drop policy "P0 financial guard')
    expect(insertAlter).toBeGreaterThanOrEqual(0)
    expect(updateAlter).toBeGreaterThan(insertAlter)
    expect(firstGuardDrop).toBeGreaterThan(updateAlter)
    expect(reconcileSql).toMatch(/policy_count <> 5/i)
    expect(reconcileSql).toMatch(/policy_count <> 3/i)
    expect(reconcileSql).toMatch(/with_check like '%expense_staff_access%'/i)
    expect(reconcileSql).toMatch(/qual like '%expense_staff_access%'/i)
    expect(reconcileSql).toMatch(/has_function_privilege\('anon', target_function::oid, 'EXECUTE'\)/i)
    expect(guardSql).toMatch(/^begin;/i)
    expect(guardSql).toMatch(/commit;\s*$/i)
    expect(reconcileSql).toMatch(/^begin;/i)
    expect(reconcileSql).toMatch(/commit;\s*$/i)
  })

  it('matches the certified P0 helper and preserves the owner/admin/finance contract', () => {
    const certifiedP0HelperBody = `
      declare
        v_user_id uuid := auth.uid();
        v_role text;
      begin
        if v_user_id is null then
          return false;
        end if;
        if p_financial_write is null then
          return false;
        end if;
        select membership.role into v_role
          from public.internal_staff_memberships as membership
         where membership.user_id = v_user_id
           and membership.status = 'active'
           and membership.revoked_at is null;
        if v_role is null then return false; end if;
        if not p_financial_write then return true; end if;
        return app_private.internal_staff_role_can_write_financially(v_role);
      end;
    `
    expect(functionBody(guardSql)).toBe(normalizeSql(certifiedP0HelperBody))
    const n11cSql = read('supabase/migrations/20260922115842_n11c_testable_internal_staff_role_predicates.sql')
    expect(n11cSql).toMatch(/internal_staff_role_can_write_financially\(p_role text\)[\s\S]*?array\['owner', 'admin', 'finance'\]/i)
    expect(n11cSql.match(/internal_staff_role_can_write_financially\(p_role text\)[\s\S]*?\$function\$;/i)?.[0] ?? '').not.toMatch(/operator|readonly/i)
    expect(guardSql).toMatch(/membership\.status = 'active'[\s\S]*?membership\.revoked_at is null/i)
    expect(guardSql).toMatch(/revoke all on function public\.expense_staff_access\(boolean\)[\s\S]*?from public, anon, authenticated, service_role/i)
    expect(guardSql).toMatch(/grant execute on function public\.expense_staff_access\(boolean\) to authenticated/i)
  })

  it('leaves Storage policies and broad default grants untouched', () => {
    expect(guardSql).not.toMatch(/\bstorage\./i)
    expect(reconcileSql).not.toMatch(/\bstorage\./i)
    expect(guardSql).not.toMatch(/alter default privileges|grant .* on all tables/i)
    expect(reconcileSql).not.toMatch(/alter default privileges|grant .* on all tables/i)
  })
})
