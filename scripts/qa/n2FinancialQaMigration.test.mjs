import fs from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const migrationUrl = new URL('../../supabase/migrations/20260922131455_n2_zero_cost_qa_readiness.sql', import.meta.url)
const sql = await fs.readFile(migrationUrl, 'utf8')

describe('N2 zero-cost QA migration contract', () => {
  it('pins all three helpers to the exact QA auth issuer and internal owner/admin authorization', () => {
    expect(sql.match(/coalesce\(auth\.jwt\(\)\s*->>\s*'iss',\s*''\)\s*<>\s*'https:\/\/kpvvydthlxupjjqqdpxy\.supabase\.co\/auth\/v1'/giu)).toHaveLength(3)
    expect(sql.match(/m\.role\s+in\s*\('owner',\s*'admin'\)/gu)).toHaveLength(3)
    expect(sql.match(/v_user_id\s*:=\s*app_private\.require_active_internal_staff\(\)/giu)).toHaveLength(3)
  })

  it('uses an empty search path and explicit public/anon revokes for every SECURITY DEFINER helper', () => {
    expect(sql.match(/security\s+definer\s+set\s+search_path\s*=\s*''/giu)).toHaveLength(3)
    expect(sql.match(/revoke\s+all\s+on\s+function\s+public\./giu)).toHaveLength(3)
    expect(sql.match(/grant\s+execute\s+on\s+function\s+public\..*\s+to\s+authenticated/giu)).toHaveLength(3)
    expect(sql).not.toMatch(/grant\s+execute\s+on\s+function\s+public\..*\s+to\s+anon/iu)
  })

  it('keeps QA_CERT compatibility and requires two exact QA_N2 root markers', () => {
    expect(sql).toContain("'QA_CERT_' || v_run_id || '_' ")
    expect(sql).toContain("'QA_N2_CLIENT_' || v_run_id || '_'")
    expect(sql).toContain("'qa_n2+' || v_run_id || '@qa.invalid'")
    expect(sql).toContain("c.email like 'qa_n2+%@qa.invalid'")
  })

  it('deletes only fixture-linked rows in foreign-key dependency order', () => {
    const cleanupStart = sql.indexOf('create or replace function public.qa_cleanup_financial_fixtures')
    const harnessStart = sql.indexOf('create or replace function public.qa_n2_financial_rollback_harness')
    const cleanupSql = sql.slice(cleanupStart, harnessStart)
    const deletedTables = [...cleanupSql.matchAll(/delete\s+from\s+public\.(\w+)/giu)].map((match) => match[1])
    expect(deletedTables).toEqual([
      'payments', 'invoice_lines', 'invoices', 'recurring_invoice_plans', 'job_lines',
      'jobs', 'quote_lines', 'quotes', 'properties', 'clients',
    ])
    expect(cleanupSql).not.toMatch(/delete\s+from\s+public\.\w+\s*;/iu)
  })

  it('uses only fixed rollback stages and calls canonical job, invoice, and settlement RPCs', () => {
    const harnessStart = sql.indexOf('create or replace function public.qa_n2_financial_rollback_harness')
    const harnessEnd = sql.indexOf('alter function public.qa_financial_fixture_plan')
    const harnessSql = sql.slice(harnessStart, harnessEnd)
    expect(harnessSql).toContain("array['after_job', 'after_invoice', 'after_payment', 'duplicate_settlement']")
    expect(harnessSql).toContain('public.save_job_with_lines(')
    expect(harnessSql).toContain('public.save_invoice_with_lines_v2(')
    expect(harnessSql).toContain('public.settle_invoice_by_transfer(')
    expect(harnessSql).toContain('public.find_first_missing_invoice_sequence(v_year, null)')
    expect(harnessSql).toContain('v_fiscal_state_after <> v_fiscal_state_before')
    expect(harnessSql).toContain("'fiscal_number_mapping_unchanged', true")
    expect(harnessSql).toContain("'duplicate_settlement_idempotent', v_duplicate_settlement_rejected")
    expect(harnessSql).toContain('N2_ROLLBACK_SENTINEL')
    expect(harnessSql).toContain('fiscal_numbering_rows_unchanged')
    expect(harnessSql).toContain('payment_rows_unchanged')
    expect(harnessSql).not.toMatch(/p_sql\s+text|execute\s+p_/iu)
  })

  it('has no destructive migration-level DDL', () => {
    expect(sql).not.toMatch(/^\s*(drop|truncate)\s+/imu)
  })
})

describe('N2 QA runner target boundary', () => {
  it('validates the exact QA project before reading an authenticated browser session or creating a client', async () => {
    const runner = await fs.readFile(new URL('./n2FinancialQaReadiness.mjs', import.meta.url), 'utf8')
    const session = await fs.readFile(new URL('./auth/recoveredQaSession.mjs', import.meta.url), 'utf8')
    const guard = session.indexOf('assertN2QaProjectUrl(supabaseUrl)')
    const metadata = session.indexOf('readAuthStateMetadata(')
    const recovery = runner.indexOf('recoverAuthenticatedQaSession()')
    const client = runner.indexOf('createClient(supabaseUrl')
    expect(guard).toBeGreaterThan(-1)
    expect(guard).toBeLessThan(metadata)
    expect(recovery).toBeGreaterThan(-1)
    expect(recovery).toBeLessThan(client)
    expect(runner).not.toMatch(/signInWithPassword|COSTACLEAN_QA_AUTH_PASSWORD/iu)
  })
})
