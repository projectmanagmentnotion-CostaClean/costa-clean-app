import { describe, expect, it } from 'vitest'
import { IDS, MARKER, assertRlsFixSnapshot, reconcileResults, resolveMode } from './verify-rls-write-fix.mjs'

const cleanSnapshot = {
  targetValidated: true,
  demoMarkerCounts: { leads: 2, clients: 2, properties: 2, quotes: 2, quoteLines: 2, jobs: 2, jobLines: 2, expenses: 1 },
  markerTotal: 0,
  oldMarkerTotal: 0,
  markerCollisionCount: 0,
  invoices: 0,
  payments: 0,
  quarterlyClosings: 0,
}

describe('RLS write fix QA runner', () => {
  it('requires exactly one mode', () => {
    expect(resolveMode(['--apply'])).toBe('apply')
    expect(() => resolveMode([])).toThrow('exactly one')
    expect(() => resolveMode(['--apply', '--cleanup'])).toThrow('exactly one')
  })

  it('uses the exact marker and deterministic ids', () => {
    expect(MARKER).toBe('QA_RLS_FIX_20260721')
    expect(Object.values(IDS).every((id) => id.startsWith('qa-rls-fix-20260721-'))).toBe(true)
  })

  it('rejects financial drift, old residue and incomplete cleanup', () => {
    expect(() => assertRlsFixSnapshot({ ...cleanSnapshot, invoices: 1 }, { requireClean: true })).toThrow('0/0/0')
    expect(() => assertRlsFixSnapshot({ ...cleanSnapshot, oldMarkerTotal: 1 }, { requireClean: true })).toThrow('Previous')
    expect(() => assertRlsFixSnapshot({ ...cleanSnapshot, markerTotal: 1 }, { requireClean: true })).toThrow('cleanup incomplete')
  })

  it('requires persisted state in addition to HTTP success', () => {
    const result = { operations: [{ label: 'job-status-update', httpOk: true, ok: true }] }
    reconcileResults(result, { ...cleanSnapshot, jobState: { id: IDS.job, status: 'scheduled' } })
    expect(result.operations[0].ok).toBe(false)
  })
})
