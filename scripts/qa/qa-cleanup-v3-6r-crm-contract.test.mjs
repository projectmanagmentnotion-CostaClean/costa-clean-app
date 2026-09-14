import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

const sql = fs.readFileSync(new URL('../../supabase/qa/qa_cleanup_v3_6r_crm_fixture.sql', import.meta.url), 'utf8')

describe('V3-6R CRM QA-only cleanup contract', () => {
  it('stays outside migrations and is exact-id, marker guarded and transactional', () => {
    expect(sql).toContain('qa_cleanup_v3_6r_crm_fixture')
    expect(sql).toContain("QA V3-6R CRM FINAL")
    expect(sql).toContain('security definer')
    expect(sql).toContain('set search_path = public, pg_temp')
    expect(sql).toContain('begin;')
    expect(sql).toContain('commit;')
    expect(sql).not.toMatch(/truncate\s+/i)
    expect(sql).not.toMatch(/like\s+['"]%QA/i)
    expect(sql).not.toMatch(/delete\s+from\s+public\.\w+\s*;/i)
    expect(sql).not.toMatch(/current_date|current_timestamp|now\(\)\s*[<>=]/i)
    expect(sql).toContain('id = any(v_clients)')
    expect(sql).toContain("v_entity_ids text[] := v_clients || v_leads || v_properties || v_jobs || v_quotes || v_invoices || v_payments")
  })

  it('contains the required QA admin and grant boundary', () => {
    expect(sql).toContain("role = 'admin' and status = 'active'")
    expect(sql).toContain('revoke all on function')
    expect(sql).toContain('to authenticated')
    expect(sql).toContain('qa_cleanup_v3_6r_crm_fixture(text[], text[], text[], text[], text[], text[], text[], uuid[])')
  })

  it('rejects unsafe payments and protects both audit paths', () => {
    expect(sql).toContain("position(v_marker in coalesce(notes, '')) > 0")
    expect(sql).toContain('invoice_id = any(v_invoices)')
    expect(sql).toContain('unsafe or missing payment fixture')
    expect(sql).toContain('entity_id = any(v_entity_ids)')
    expect(sql).toContain("position(v_marker in coalesce(metadata::text, '')) > 0")
    expect(sql).toContain('unsafe or missing audit event')
    expect(sql).toContain('untracked audit event')
  })

  it('protects reverse lead conversion and lead-linked quotes', () => {
    expect(sql).toContain('converted_client_id = any(v_clients) and id <> all(v_leads)')
    expect(sql).toContain('lead_id = any(v_leads) and id <> all(v_quotes)')
    expect(sql).toContain('untracked quote linked to a fixture lead')
  })

  it('guards protected relations and invoice document records', () => {
    for (const table of [
      'recurring_invoice_plans',
      'client_portal_applications',
      'client_portal_audit_events',
      'client_portal_invitations',
      'client_portal_legal_acceptances',
      'client_portal_memberships',
      'client_portal_profile_change_requests',
      'client_portal_property_change_requests',
      'client_service_requests',
    ]) {
      expect(sql).toContain(`public.${table}`)
    }
    expect(sql).toContain("'deleted_invoice_document_records'")
    expect(sql).toContain('delete from public.invoice_document_records where invoice_id = any(v_invoices)')
  })

  it('keeps the foreign-key-safe deletion order', () => {
    const deletes = [
      'delete from public.audit_events',
      'delete from public.invoice_document_records',
      'delete from public.payments',
      'delete from public.invoice_lines',
      'delete from public.invoices',
      'delete from public.job_lines',
      'delete from public.jobs',
      'delete from public.quote_lines',
      'delete from public.quotes',
      'delete from public.properties',
      'delete from public.leads',
      'delete from public.clients',
    ]
    const positions = deletes.map((statement) => sql.indexOf(statement))
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    expect(sql).not.toMatch(/delete\s+from\s+public\.(recurring_invoice_plans|client_portal_)/i)
  })
})
