import { describe, expect, it } from 'vitest'
import { certifyQaBaselineVNext } from './qa-baseline-vnext.mjs'

describe('QA baseline certification vNext', () => {
  it('certifies the relocated baseline byte-for-byte and excludes it from migrations', () => {
    const result = certifyQaBaselineVNext()
    expect(result.checks).toContainEqual({ name: 'baseline_original_identity', status: 'PASS' })
    expect(result.checks).toContainEqual({ name: 'incremental_exclusion', status: 'PASS' })
  })

  it('certifies 18 V3 migrations, five exact Production equivalents, thirteen pending, and N56 → grants → P0', () => {
    const result = certifyQaBaselineVNext()
    expect(result.checks).toContainEqual({ name: 'release_matrix', status: 'PASS' })
  })

  it('preserves V6 reference blobs while explicitly leaving the legacy gate uncertified', () => {
    const result = certifyQaBaselineVNext()
    expect(result.checks).toContainEqual({ name: 'historical_v6_preservation', status: 'PASS' })
    expect(result.legacyV6Gate).toBe('NOT_CERTIFIED_BY_VNEXT')
  })

  it('runs without network, database, migration, or deployment effects', () => {
    const result = certifyQaBaselineVNext()
    expect(result.status).toBe('PASS')
    expect(result.checks).toContainEqual({ name: 'read_only_contract', status: 'PASS' })
    expect(result.effects).toEqual({
      network: false,
      databaseReadsOrWrites: false,
      migrationExecution: false,
      deployment: false,
    })
  })
})
