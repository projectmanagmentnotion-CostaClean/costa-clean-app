import { describe, expect, it } from 'vitest'
import { buildHygienePlan, classifyHygieneRecord, runHygienePlan, type HygieneRecord } from './dataHygiene'

describe('N1 deterministic data hygiene', () => {
  it('plans a relink only with one canonical candidate', () => {
    const record: HygieneRecord = { entityType: 'quote', entityId: 'q-1', relationName: 'property_id', currentRelationId: 'p-old', deterministicExpectedRelationId: 'p-canonical', relationEvidenceCount: 1 }
    const plan = buildHygienePlan([record])
    expect(plan.actions).toHaveLength(1)
    expect(plan.actions[0]).toMatchObject({ kind: 'relink', oldValue: 'p-old', newValue: 'p-canonical', source: 'data_hygiene_n1' })
    expect(classifyHygieneRecord({ ...record, relationEvidenceCount: 2 })).toBe('AMBIGUOUS_RELATION')
    expect(buildHygienePlan([{ ...record, relationEvidenceCount: 2 }]).actions).toHaveLength(0)
  })

  it('archives only clearly stale non-fiscal drafts with no references', () => {
    const safe = { entityType: 'quote' as const, entityId: 'q-draft', clearlyStale: true, supportsArchive: true, fiscal: false, settled: false, requiredForHistory: false, hasActiveReferences: false }
    expect(buildHygienePlan([safe]).actions[0]?.kind).toBe('archive')
    for (const unsafe of [
      { ...safe, entityType: 'invoice' as const },
      { ...safe, fiscal: true },
      { ...safe, hasActiveReferences: true },
      { ...safe, requiredForHistory: true },
      { ...safe, settled: true },
    ]) {
      expect(buildHygienePlan([unsafe]).actions).toHaveLength(0)
      expect(buildHygienePlan([unsafe]).manualReview).toHaveLength(1)
    }
    const unknownSafetyFacts: HygieneRecord = { entityType: 'quote', entityId: 'q-unknown', clearlyStale: true, supportsArchive: true }
    expect(buildHygienePlan([unknownSafetyFacts]).actions).toHaveLength(0)
    expect(buildHygienePlan([unknownSafetyFacts]).manualReview).toHaveLength(1)
  })

  it('keeps already corrected and archived records idempotent', () => {
    const corrected: HygieneRecord = { entityType: 'property', entityId: 'p-1', relationName: 'client_id', currentRelationId: 'c-1', deterministicExpectedRelationId: 'c-1', relationEvidenceCount: 1 }
    const archived: HygieneRecord = { entityType: 'quote', entityId: 'q-archived', alreadyArchived: true, clearlyStale: true }
    expect(buildHygienePlan([corrected, archived]).actions).toEqual([])
  })

  it('keeps fiscal unresolved records for manual review and dry-run never writes', async () => {
    const plan = buildHygienePlan([{ entityType: 'payment', entityId: 'pay-orphan', clearlyStale: true }])
    expect(plan.manualReview).toHaveLength(1)
    await expect(runHygienePlan(plan, 'DRY_RUN')).resolves.toMatchObject({ appliedRelinks: 0, appliedArchives: 0 })
  })

  it('keeps fiscal and historical relationships out of automatic relinking', () => {
    for (const entityType of ['invoice', 'payment', 'expense', 'closing', 'audit_event'] as const) {
      const plan = buildHygienePlan([{ entityType, entityId: `${entityType}-1`, relationName: 'client_id', currentRelationId: 'wrong', deterministicExpectedRelationId: 'canonical', relationEvidenceCount: 1 }])
      expect(plan.actions).toHaveLength(0)
      expect(plan.manualReview).toHaveLength(1)
    }
  })

  it('blocks non-empty QA apply until a concrete transactional adapter exists', async () => {
    const plan = buildHygienePlan([{ entityType: 'quote', entityId: 'q-1', relationName: 'property_id', currentRelationId: null, deterministicExpectedRelationId: 'p-1', relationEvidenceCount: 1 }])
    await expect(runHygienePlan(plan, 'APPLY_QA')).rejects.toThrow('adaptador transaccional concreto')
  })

  it('runs an empty QA apply without issuing writes when the audit finds no candidates', async () => {
    const plan = buildHygienePlan([])
    await expect(runHygienePlan(plan, 'APPLY_QA')).resolves.toMatchObject({ plannedRelinks: 0, plannedArchives: 0, appliedRelinks: 0, appliedArchives: 0 })
  })
})
