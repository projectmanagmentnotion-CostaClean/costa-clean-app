import fs from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const migration = await fs.readFile(new URL('../../supabase/migrations/20260922143036_n2_concurrent_settlement_qa_support.sql', import.meta.url), 'utf8')

describe('N2 QA concurrent settlement support migration', () => {
  it('restricts both helpers to QA issuer and active internal owner/admin sessions', () => {
    expect(migration.match(/coalesce\(auth\.jwt\(\)\s*->>\s*'iss',\s*''\)\s*<>\s*'https:\/\/kpvvydthlxupjjqqdpxy\.supabase\.co\/auth\/v1'/giu)).toHaveLength(2)
    expect(migration.match(/app_private\.require_active_internal_staff\(\)/giu)).toHaveLength(2)
    expect(migration.match(/m\.role\s+in\s*\('owner',\s*'admin'\)/giu)).toHaveLength(2)
    expect(migration.match(/security\s+definer\s+set\s+search_path\s*=\s*''/giu)).toHaveLength(2)
    expect(migration.match(/revoke\s+all\s+on\s+function\s+public\./giu)).toHaveLength(2)
    expect(migration.match(/grant\s+execute\s+on\s+function\s+public\..*\s+to\s+authenticated/giu)).toHaveLength(2)
    expect(migration).not.toMatch(/grant\s+execute\s+on\s+function\s+public\..*\s+to\s+anon/iu)
  })

  it('uses fixed QA_N2 identifiers and non-empty placeholders before invoice INSERT triggers run', () => {
    expect(migration).toContain("p_run_id !~ '^[0-9a-f]{32}$'")
    expect(migration).toContain("v_client_id := 'QA_N2_CLIENT_' || p_run_id || '_CONC'")
    expect(migration).toContain("v_property_id := 'QA_N2_PROPERTY_' || p_run_id || '_CONC'")
    expect(migration).toContain("v_job_id := 'QA_N2_JOB_' || p_run_id || '_CONC'")
    expect(migration).toContain("v_invoice_id := 'QA_N2_INVOICE_' || p_run_id || '_CONC'")
    expect(migration).toContain('v_placeholder, v_placeholder,')
    expect(migration).toContain("current_date, 'draft', 100.00, 0.00, 100.00")
    expect(migration).not.toMatch(/disable\s+trigger|setval\s*\(|nextval\s*\(|drop\s+trigger/iu)
  })

  it('captures complete numbering/sequence and real-row digests and proves the lock primitive', () => {
    expect(migration).toContain('public.invoices_invoice_number_seq')
    expect(migration).toContain('pg_catalog.pg_get_functiondef')
    expect(migration).toContain("'settlement_serialization_primitive', 'SELECT FOR UPDATE'")
    expect(migration).toContain("'fiscal_mapping_hash', v_mapping_hash")
    expect(migration).toContain("'real_qa_business_rows_hash', v_real_rows_hash")
    expect(migration).toContain("'sequence_last_value', v_sequence_last_value")
    expect(migration).toContain("'sequence_is_called', v_sequence_is_called")
  })

  it('contains no broad delete or changes to canonical business/numbering functions', () => {
    expect(migration).not.toMatch(/^\s*(drop|truncate|alter\s+function\s+public\.(settle_invoice_by_transfer|sync_invoice_numbering|set_invoices_codes))/imu)
    expect(migration).not.toMatch(/delete\s+from\s+public\./iu)
    expect(migration).toContain("'QA_N2_CONC_' || p_run_id || '|source=n2_concurrency_certification'")
  })
})
