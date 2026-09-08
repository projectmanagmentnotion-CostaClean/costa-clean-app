import { describe, expect, it } from 'vitest'
import { assertQaTarget, normalizeManifest, PRODUCTION_PROJECT_REF, QA_PROJECT_REF } from './cleanup-v3-3b-fixtures.mjs'

describe('V3-3B exact QA cleanup harness', () => {
  it('accepts only the QA project and refuses production', () => {
    expect(() => assertQaTarget({ projectRef: QA_PROJECT_REF, supabaseUrl: `https://${QA_PROJECT_REF}.supabase.co` })).not.toThrow()
    expect(() => assertQaTarget({ projectRef: PRODUCTION_PROJECT_REF, supabaseUrl: `https://${PRODUCTION_PROJECT_REF}.supabase.co` })).toThrow(/production|QA project/i)
    expect(() => assertQaTarget({ projectRef: QA_PROJECT_REF, supabaseUrl: `https://${PRODUCTION_PROJECT_REF}.supabase.co` })).toThrow(/production|QA cleanup/i)
  })

  it('requires exact IDs and rejects wildcard cleanup inputs', () => {
    expect(() => normalizeManifest({ projectRef: QA_PROJECT_REF, expenseIds: ['QA%'] })).toThrow(/exact identifier/i)
    expect(() => normalizeManifest({ projectRef: QA_PROJECT_REF, storagePaths: ['other/fixture.pdf'] })).toThrow(/expenses/i)
    expect(normalizeManifest({ projectRef: QA_PROJECT_REF, expenseIds: ['expense-1'], storagePaths: ['expenses/expense-1/file.pdf'] })).toMatchObject({ expenseIds: ['expense-1'] })
  })
})
