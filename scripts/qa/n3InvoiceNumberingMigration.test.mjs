import fs from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const migration = await fs.readFile(new URL('../../supabase/migrations/20260922160000_n3_single_authority_invoice_numbering.sql', import.meta.url), 'utf8')
const compact = migration.toLowerCase().replace(/\s+/gu, ' ')

describe('N3 canonical invoice numbering migration', () => {
  it('retires only the legacy trigger and keeps the compatibility function and sequence', () => {
    expect(compact).toContain('drop trigger if exists trg_set_invoices_codes on public.invoices')
    expect(compact).not.toMatch(/drop\s+(function|sequence).*?(set_invoices_codes|invoices_invoice_number_seq)/u)
    expect(compact).not.toMatch(/nextval\s*\(|setval\s*\(/u)
    expect(compact).toContain('create trigger trg_sync_invoice_numbering')
  })

  it('preserves non-fiscal draft/cancel behavior while assigning numbers to issued and paid transitions', () => {
    expect(compact).toContain("new.status = 'cancelled'")
    expect(compact).toContain('tg_op = \'insert\' or not v_old_consumes')
    expect(compact).toContain('new.invoice_number := null')
    expect(compact).toContain('public.find_first_missing_invoice_sequence(v_year, new.id)')
    expect(compact).toContain('public.invoice_status_consumes_fiscal_number(new.status)')
  })

  it('serializes fiscal allocation transactionally and preserves issued numbering through cancellation', () => {
    expect(compact).toContain("pg_advisory_xact_lock(hashtext('invoice-numbering-' || v_year::text))")
    expect(compact).toContain('if tg_op = \'update\' and v_old_consumes then')
    expect(compact).toContain('new.invoice_number := old.invoice_number')
    expect(compact).toContain('new.display_code := old.display_code')
    expect(compact).toContain('using errcode = \'55000\'')
  })

  it('keeps legacy display parsing compatible and prevents new-year global display collisions', () => {
    expect(compact).toContain("'^inv-(?:[0-9]{4}-)?([0-9]+)$'")
    expect(compact).toContain("'inv-' || p_year::text || '-' || lpad(p_sequence::text, 3, '0')")
    expect(compact).toContain('public.extract_invoice_display_sequence(i.display_code)')
  })

  it('asserts missing/malformed/parity/draft/duplicate invariants without mutating data', () => {
    expect(compact).toContain('una factura fiscal sin numeracion completa')
    expect(compact).toContain('display_code is null')
    expect(compact).toContain('having count(*) > 1')
    expect(compact).not.toMatch(/\b(insert|update|delete|setval|nextval)\s+(into\s+)?public\.invoices\b/u)
  })

  it('blocks ordinary hard deletion of numbered or fiscal invoices', () => {
    expect(compact).toContain('trg_prevent_fiscal_invoice_hard_delete')
    expect(compact).toContain('before delete on public.invoices')
    expect(compact).toContain('old.invoice_number is not null')
    expect(compact).toContain('old.display_code is not null')
  })
})

describe('N2 QA-only migration location and ledger', () => {
  it('keeps QA helper migrations outside the product migration directory', async () => {
    await expect(fs.access(new URL('../../supabase/migrations/20260922131455_n2_zero_cost_qa_readiness.sql', import.meta.url))).rejects.toThrow()
    await expect(fs.access(new URL('../../supabase/migrations/20260922143036_n2_concurrent_settlement_qa_support.sql', import.meta.url))).rejects.toThrow()
    await expect(fs.access(new URL('../../supabase/qa-migrations/20260922131455_n2_zero_cost_qa_readiness.sql', import.meta.url))).resolves.toBeUndefined()
    await expect(fs.access(new URL('../../supabase/qa-migrations/20260922143036_n2_concurrent_settlement_qa_support.sql', import.meta.url))).resolves.toBeUndefined()
  })

  it('keeps the QA fixture teardown exception outside product migrations and exact-provenance guarded', async () => {
    const fixtureSql = await fs.readFile(new URL('../../supabase/qa-migrations/20260922163000_n3_invoice_numbering_qa_fixtures.sql', import.meta.url), 'utf8')
    const qaSql = fixtureSql.toLowerCase().replace(/\s+/gu, ' ')
    expect(qaSql).toContain("current_setting('app.qa_n3_fixture_teardown', true) = 'true'")
    expect(qaSql).toContain("coalesce(auth.jwt() ->> 'iss', '') = 'https://kpvvydthlxupjjqqdpxy.supabase.co/auth/v1'")
    expect(qaSql).toContain("old.id like 'qa_n3_invoice_%'")
    expect(qaSql).toContain("old.notes, '') ~ '^qa_n3_[0-9a-f]{32}\\|source=n3_numbering_certification$'")
    expect(qaSql).toContain('n3 cleanup rejected a fixture with mismatched provenance')
    expect(qaSql).toContain('n3 cleanup refuses fixtures with payment rows')
    expect(qaSql).not.toMatch(/grant\s+execute\s+on\s+function\s+public\.qa_n3_[^(]+\([^;]+to\s+anon/u)
  })

  it('hardens cancelled-draft reissue, global year/parity assertions, and numbered-invoice immutability', async () => {
    const followup = (await fs.readFile(new URL('../../supabase/migrations/20260922161000_n3_cancelled_draft_and_numbering_audit.sql', import.meta.url), 'utf8')).toLowerCase().replace(/\s+/gu, ' ')
    expect(followup).toContain("old.status = 'cancelled' and old.invoice_number is not null and old.display_code is not null")
    expect(followup).toContain("i.status = 'cancelled' and (i.invoice_number is not null or i.display_code is not null)")
    expect(followup).toContain("substring(i.display_code from '^inv-([0-9]{4})-')::integer <> y.issue_year")
    expect(followup).toContain("old.status in ('issued', 'paid') or old.invoice_number is not null or old.display_code is not null")
    expect(followup).not.toMatch(/setval\s*\(|nextval\s*\(/u)
  })

  it('retains the baseline no-gaps-before-issuance invariant for each fiscal year', async () => {
    for (const filename of [
      '20260922160000_n3_single_authority_invoice_numbering.sql',
      '20260922161000_n3_cancelled_draft_and_numbering_audit.sql',
      '20260922180000_n3_restore_invoice_numbering_gap_guard.sql',
    ]) {
      const migration = (await fs.readFile(new URL(`../../supabase/migrations/${filename}`, import.meta.url), 'utf8')).toLowerCase().replace(/\s+/gu, ' ')
      expect(migration).toContain('lag(seq) over (order by seq) as prev_seq')
      expect(migration).toContain('where prev_seq is not null and seq - prev_seq > 1')
      expect(migration).toContain("'no se puede emitir factura. hay huecos en la numeracion fiscal: %.'")
      expect(migration).toContain('public.extract_invoice_fiscal_sequence(i.invoice_number, p_year)')
    }
  })

  it('reports emergency fixture-cleanup failure even when the QA assertion already failed', async () => {
    const runner = (await fs.readFile(new URL('./n3InvoiceNumberingQa.mjs', import.meta.url), 'utf8')).replace(/\s+/gu, ' ')
    expect(runner).toContain('if (cleanupFailures.length > 0)')
    expect(runner).toContain('if (primaryFailure)')
    expect(runner).toContain('[primaryFailure, cleanupError]')
    expect(runner).toContain('cleanupError.message')
    expect(runner).toContain('Number(result?.qa_n3_residue) !== 0')
    expect(runner).toContain('N3_EMERGENCY_FIXTURE_CLEANUP_FAILED')
  })

  it('keeps QA-only protection probes and teardown guards outside the product migration path', async () => {
    const qaOnly = (await fs.readFile(new URL('../../supabase/qa-migrations/20260922172000_n3_fiscal_immutability_probe.sql', import.meta.url), 'utf8')).toLowerCase()
    const cleanupGuard = (await fs.readFile(new URL('../../supabase/qa-migrations/20260922173500_n3_qa_cleanup_guard_after_product_hardening.sql', import.meta.url), 'utf8')).toLowerCase()
    expect(qaOnly).toContain("coalesce(auth.jwt() ->> 'iss', '') <> 'https://kpvvydthlxupjjqqdpxy.supabase.co/auth/v1'")
    expect(qaOnly).toContain('qa_n3_assert_fiscal_protections')
    expect(cleanupGuard).toContain("current_setting('app.qa_n3_fixture_teardown', true) = 'true'")
    expect(cleanupGuard).toContain("old.id like 'qa_n3_invoice_%'")
    expect(cleanupGuard).not.toMatch(/setval\s*\(|nextval\s*\(/u)
  })
})
