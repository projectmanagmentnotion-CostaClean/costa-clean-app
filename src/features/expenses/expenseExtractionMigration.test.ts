import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../../../supabase/migrations/20260928150000_n52_document_extraction_foundation.sql', import.meta.url), 'utf8').toLowerCase()

describe('N5.2 extraction migration contract', () => {
  it('is local-only, auditable and owner-scoped', () => {
    expect(migration).toContain('do not apply to qa')
    expect(migration).toContain('create table if not exists public.expense_capture_extractions')
    expect(migration).toContain('attempt integer not null')
    expect(migration).toContain('unique (idempotency_key)')
    expect(migration).toContain('alter table public.expense_capture_extractions enable row level security')
    expect(migration).toContain('alter table public.expense_capture_extractions force row level security')
    expect(migration).toContain('created_by = (select auth.uid())')
    expect(migration).toContain('unique (id, capture_session_id)')
    expect(migration).toContain('foreign key (capture_document_id, capture_session_id)')
    expect(migration).toContain('app_private.is_active_internal_staff((select auth.uid()))')
    expect(migration).toContain('grant select on public.expense_capture_extractions to authenticated')
  })

  it('does not grant direct authenticated writes or public access', () => {
    expect(migration).toContain('revoke all on public.expense_capture_extractions from public, anon, authenticated, service_role')
    expect(migration).not.toMatch(/grant\s+(?:insert|update|delete)[^;]*to\s+authenticated/u)
    expect(migration).not.toContain('create policy n52_extractions_owner_write')
    expect(migration).not.toMatch(/grant\s+(?:insert|update|delete)[^;]*to\s+authenticated/u)
  })
})
