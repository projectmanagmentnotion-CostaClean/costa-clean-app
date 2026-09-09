import { describe, expect, it } from 'vitest'
import { V3_SELECTION_ADOPTED_MODULES, V3_SELECTION_ADOPTION_AUDIT } from './selectionAdoptionAudit'

describe('V3 selection adoption audit', () => {
  it('keeps the adopted-module allowlist exact', () => {
    expect(V3_SELECTION_ADOPTED_MODULES).toEqual(['Invoices', 'Quotes'])
    expect(V3_SELECTION_ADOPTION_AUDIT.filter((row) => row.adopted).map((row) => row.module)).toEqual(['Invoices', 'Quotes'])
  })
  it('does not adopt backlog or rejected modules', () => {
    expect(V3_SELECTION_ADOPTION_AUDIT.filter((row) => !row.adopted).every((row) => row.decision !== 'A')).toBe(true)
    expect(V3_SELECTION_ADOPTION_AUDIT.find((row) => row.module === 'Alerts')?.decision).toBe('D')
  })
  it('keeps every audited module classified exactly once', () => {
    expect(V3_SELECTION_ADOPTION_AUDIT).toHaveLength(10)
    expect(new Set(V3_SELECTION_ADOPTION_AUDIT.map((row) => row.module)).size).toBe(10)
  })
})
