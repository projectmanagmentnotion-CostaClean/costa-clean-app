import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../../../supabase/migrations/20260929140000_n52_runtime_r22_idempotency_scope.sql', import.meta.url), 'utf8').toLowerCase()

describe('N5.2 QA idempotency scope', () => {
  it('derives the key from the capture document, not only its content hash', () => {
    expect(migration).toContain('v_document.id::text ||')
    expect(migration).toContain('v_document.sha256 ||')
    expect(migration).toContain('p_schema_version::text ||')
    expect(migration).toContain('p_provider ||')
    expect(migration).toContain('v_attempt::text')
  })

  it('keeps reuse and retry lookup scoped to the document', () => {
    expect(migration).toContain('where e.capture_document_id = v_document.id')
    expect(migration).toContain('document-scoped unique constraint')
    expect(migration).toContain('n5.2 r2.2 idempotency scope')
  })
})
