import { describe, expect, it } from 'vitest'
import { buildCp3c2CleanupPlan, assertCleanupTarget } from './cp3c2_qa_cleanup_plan.mjs'

const ledger = {
  gate: 'CP-3C.2',
  transient: {
    applications: ['application-a'],
    legalAcceptances: ['legal-a'],
    consents: ['consent-a'],
    serviceRequests: ['request-a'],
  },
}

describe('CP-3C.2 ledger-bound cleanup', () => {
  it('rejects production and non-QA targets', () => {
    expect(() => assertCleanupTarget('wfxnwfcdjainpojhbdri')).toThrow()
    expect(() => assertCleanupTarget('other-project')).toThrow()
  })

  it('includes every transient category and protects permanent fixtures', () => {
    const plan = buildCp3c2CleanupPlan(ledger)
    expect(plan.deleteOnly.applications).toEqual(['application-a'])
    expect(plan.deleteOnly.legalAcceptances).toEqual(['legal-a'])
    expect(plan.deleteOnly.consents).toEqual(['consent-a'])
    expect(plan.deleteOnly.serviceRequests).toEqual(['request-a'])
    expect(plan.protected.cp3c1Fixtures).toBe(true)
    expect(plan.protected.existingInvoice).toBe('INV-QA-CP3B4-20260909-001')
  })
})
