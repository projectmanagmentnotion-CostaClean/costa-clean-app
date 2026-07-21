import { describe, expect, it } from 'vitest'
import {
  MARKER,
  assertSafeSnapshot,
  buildAuthenticatedWriteHeaders,
  reconcileAuthenticatedApplyResults,
  resolveAuthenticatedRlsMode,
} from './verify-authenticated-rls-writes.mjs'

function safeSnapshot(overrides = {}) {
  return {
    targetValidated: true,
    demoMarkerCounts: {
      leads: 2,
      clients: 2,
      properties: 2,
      quotes: 2,
      quoteLines: 2,
      jobs: 2,
      jobLines: 2,
      expenses: 1,
    },
    markerTotal: 0,
    markerCollisionCount: 0,
    invoices: 0,
    payments: 0,
    quarterlyClosings: 0,
    ...overrides,
  }
}

describe('authenticated RLS write verification', () => {
  it('requires exactly one explicit mode', () => {
    expect(resolveAuthenticatedRlsMode(['--dry-run'])).toBe('dry-run')
    expect(resolveAuthenticatedRlsMode(['--apply'])).toBe('apply')
    expect(() => resolveAuthenticatedRlsMode([])).toThrow('Choose exactly one mode')
    expect(() => resolveAuthenticatedRlsMode(['--apply', '--cleanup'])).toThrow('Choose exactly one mode')
  })

  it('keeps anon only as apikey and uses the authenticated token as bearer', () => {
    expect(buildAuthenticatedWriteHeaders('anon-key', 'session-token')).toMatchObject({
      apikey: 'anon-key',
      Authorization: 'Bearer session-token',
    })
    expect(() => buildAuthenticatedWriteHeaders('anon-key', 'anon-key')).toThrow('anon key cannot be used as bearer')
  })

  it('accepts only a clean QA baseline with the deterministic demo seed intact', () => {
    expect(assertSafeSnapshot(safeSnapshot(), { requireCleanMarker: true })).toBe(true)
    expect(() => assertSafeSnapshot(safeSnapshot({ markerTotal: 1 }), { requireCleanMarker: true }))
      .toThrow('cleanup is incomplete')
    expect(() => assertSafeSnapshot(safeSnapshot({ invoices: 1 }), { requireCleanMarker: true }))
      .toThrow('0/0/0')
  })

  it('uses the approved marker contract', () => {
    expect(MARKER).toBe('QA_AUTH_RLS_WRITE_20260721')
  })

  it('rejects HTTP success when the expected persisted state is absent', () => {
    const browser = {
      operations: [
        { label: 'property-edit', ok: true, httpOk: true, status: 200 },
        { label: 'property-reassign', ok: true, httpOk: true, status: 200 },
        { label: 'job-create-rpc', ok: true, httpOk: true, status: 204 },
        { label: 'job-status-update', ok: true, httpOk: true, status: 200 },
      ],
    }
    reconcileAuthenticatedApplyResults(browser, {
      propertyFixtureState: {
        name: `${MARKER} Property operator fixture`,
        city: 'Ciudad Sandbox',
        clientId: 'qa-demo-20260721-client-company',
      },
      jobState: {
        id: 'qa-auth-rls-write-20260721-job',
        status: 'scheduled',
      },
      jobLineCount: 1,
    })

    expect(browser.operations.find((operation) => operation.label === 'property-edit')?.ok).toBe(false)
    expect(browser.operations.find((operation) => operation.label === 'property-reassign')?.ok).toBe(true)
    expect(browser.operations.find((operation) => operation.label === 'job-create-rpc')?.ok).toBe(true)
    expect(browser.operations.find((operation) => operation.label === 'job-status-update')?.ok).toBe(false)
  })
})
