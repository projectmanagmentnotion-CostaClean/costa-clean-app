import { describe, expect, it } from 'vitest'
import {
  CP3C1_FIXTURE_ALIASES,
  CREATED_ROW_IDS,
  PRODUCTION_REF,
  QA_REF,
  REUSED_IDS,
  SYNTHETIC_EMAILS,
  assertQaTarget,
  buildCleanupPlan,
  createFixturePlan,
  sanitizeEvidence,
} from './cp3c1_qa_fixture_plan.mjs'

describe('CP-3C.1 controlled fixture package', () => {
  it('accepts only the verified QA target and rejects production', () => {
    expect(assertQaTarget({ projectRef: QA_REF, supabaseUrl: `https://${QA_REF}.supabase.co` })).toBe(true)
    expect(() => assertQaTarget({ projectRef: PRODUCTION_REF, supabaseUrl: `https://${PRODUCTION_REF}.supabase.co` })).toThrow()
    expect(() => assertQaTarget({ projectRef: 'other-project', supabaseUrl: 'https://other-project.supabase.co' })).toThrow()
  })

  it('defines unique synthetic identities and no real email domains', () => {
    expect(new Set(CP3C1_FIXTURE_ALIASES).size).toBe(CP3C1_FIXTURE_ALIASES.length)
    expect(SYNTHETIC_EMAILS.every((email) => email.endsWith('@qa.invalid'))).toBe(true)
  })

  it('keeps applicants tenancy-free and financial fixtures out of the plan', () => {
    const plan = createFixturePlan()
    expect(plan.identities.filter(({ tenancy }) => tenancy === 'none')).toHaveLength(2)
    expect(plan.invariants.applicantsHaveNoMembership).toBe(true)
    expect(plan.invariants.noFinancialFixtureCreation).toBe(true)
    expect(JSON.stringify(plan)).not.toMatch(/invoice|fiscal|payment/iu)
  })

  it('cleans only created rows and protects reused and invoice rows', () => {
    const cleanup = buildCleanupPlan()
    expect(cleanup.deleteOnly.clients).toEqual([CREATED_ROW_IDS.client])
    expect(cleanup.deleteOnly.properties).toEqual([CREATED_ROW_IDS.property])
    expect(cleanup.deleteOnly.memberships).toEqual([...CREATED_ROW_IDS.memberships])
    expect(cleanup.deleteOnly.invitations).toEqual([...CREATED_ROW_IDS.invitations])
    expect(cleanup.protected.clients).toContain(REUSED_IDS.client)
    expect(cleanup.protected.invoices).toContain('INV-QA-CP3B4-20260909-001')
  })

  it('removes secret-like evidence fields recursively', () => {
    expect(sanitizeEvidence({ password: 'redacted', nested: { accessToken: 'redacted', count: 1 } })).toEqual({ nested: { count: 1 } })
  })
})
