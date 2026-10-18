import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('../../supabase/migrations/20260922111338_n11_transactional_data_hygiene_adapter.sql', import.meta.url), 'utf8')
const normalized = migration.toLowerCase().replace(/\s+/g, ' ')

describe('N1.1B transactional QA hygiene adapter migration', () => {
  it('binds apply to the observed QA issuer and the canonical APP membership guard', () => {
    expect(normalized).toContain("v_issuer is distinct from 'https://kpvvydthlxupjjqqdpxy.supabase.co/auth/v1'")
    expect(normalized).toContain('auth.jwt()')
    expect(normalized).toContain('perform app_private.require_active_internal_staff()')
    expect(normalized).toContain('v_actor := app_private.require_internal_staff_write()')
    expect(normalized).not.toContain('portal_private')
    expect(normalized).not.toContain('service_role bypass')
    expect(normalized).toContain('grant execute on function public.data_hygiene_n11_apply_qa(jsonb, text) to authenticated')
    expect(normalized).toContain('revoke all on function public.data_hygiene_n11_apply_qa(jsonb, text) from public, anon, authenticated, service_role')
  })

  it('limits all mutations to prefixed synthetic quote records and the two approved actions', () => {
    expect(normalized).toContain('app_private.is_n11_hygiene_fixture_id(entity_id)')
    expect(normalized).toContain('not app_private.is_n11_hygiene_fixture_id(v_entity_id)')
    expect(normalized).toContain("pg_catalog.left(q.id, pg_catalog.length('qa_hygiene_n11_relink_')) = 'qa_hygiene_n11_relink_'")
    expect(normalized).not.toContain("like 'qa_hygiene_n11_%'")
    expect(normalized).toContain("v_action_type not in ('relink_relation','archive_stale_record','manual_review_required')")
    expect(normalized).toContain('update public.quotes')
    expect(normalized).not.toMatch(/\bdelete\s+from\s+public\./)
    expect(normalized).not.toMatch(/execute\s+format\s*\(/)
    expect(normalized).not.toContain('public.payments')
    expect(normalized).not.toContain('public.invoices set')
    expect(normalized).not.toContain('public.expenses set')
  })

  it('hashes canonical jsonb with SHA-256 and rejects hash tampering before creating a run', () => {
    const apply = normalized.slice(normalized.indexOf('create or replace function public.data_hygiene_n11_apply_qa'))
    expect(apply).toContain("extensions.digest(p_plan::text, 'sha256')")
    expect(apply).toContain('if p_plan_hash is distinct from v_hash then')
    expect(apply.indexOf('if p_plan_hash is distinct from v_hash then')).toBeLessThan(apply.indexOf('insert into app_private.data_hygiene_runs'))
    expect(apply).toContain("using errcode = '22023'")
  })

  it('locks targets, checks expected state, and writes mutations with private audit evidence in the same function transaction', () => {
    const apply = normalized.slice(normalized.indexOf('create or replace function public.data_hygiene_n11_apply_qa'))
    expect(apply).toContain('for update')
    expect(apply).toContain('v_current is distinct from v_expected')
    expect(apply).toContain("using errcode = '40001'")
    expect(apply).toContain('insert into app_private.data_hygiene_actions')
    expect(apply).toContain('update app_private.data_hygiene_runs')
    expect(normalized).toContain('alter table app_private.data_hygiene_actions force row level security')
    expect(normalized).toContain('alter table app_private.data_hygiene_runs force row level security')
  })

  it('archives only non-fiscal draft quotes with no job or invoice dependency and routes ambiguity to manual review', () => {
    const apply = normalized.slice(normalized.indexOf('create or replace function public.data_hygiene_n11_apply_qa'))
    expect(apply).toContain("v_current ->> 'status' <> 'draft'")
    expect(apply).toContain('exists (select 1 from public.jobs as j where j.quote_id = v_entity_id)')
    expect(apply).toContain('exists (select 1 from public.invoices as i where i.quote_id = v_entity_id)')
    expect(apply).toContain("'insufficient_canonical_relation_evidence'")
    expect(apply).toContain('v_target is distinct from v_expected')
  })

  it('makes repeat apply idempotent without duplicating business-action audit rows', () => {
    const apply = normalized.slice(normalized.indexOf('create or replace function public.data_hygiene_n11_apply_qa'))
    expect(apply).toContain("'status', 'already_applied'")
    expect(apply).toContain('where run.plan_id = v_plan_id')
    expect(apply).toContain('on conflict (plan_id) do nothing')
    expect(normalized).toContain('primary key (plan_id, action_id)')
  })
})
