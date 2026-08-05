import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildChanges,
  buildStorageKey,
  classifyReviewedChangeError,
  readStoredIntent,
} from './PortalReviewedChangeHelpers'

const memoryStorage = createMemoryStorage()

beforeEach(() => {
  memoryStorage.clear()
  vi.stubGlobal('window', { sessionStorage: memoryStorage })
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001')
})

afterEach(() => {
  memoryStorage.clear()
  vi.restoreAllMocks()
})

describe('PortalReviewedChangeForms helpers', () => {
  it('builds a stable storage key per scope and resource', () => {
    expect(buildStorageKey('client-1', 'profile', 'profile')).toBe('portal:reviewed-change:client-1:profile:profile')
    expect(buildStorageKey('client-1', 'property', 'ref-espacio-norte')).toBe(
      'portal:reviewed-change:client-1:property:ref-espacio-norte',
    )
  })

  it('keeps the same stored intent and idempotency key across retries', () => {
    const storageKey = buildStorageKey('client-1', 'profile', 'profile')
    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        selectedFields: ['fullName'],
        draftValues: { fullName: 'Cliente QA' },
        idempotencyKey: '00000000-0000-4000-8000-000000000001',
        receipt: {
          reference: 'CC-PR-0142',
          status: 'Enviado',
          requestedAt: '2026-08-04T09:00:00Z',
          changedFields: ['fullName'],
          requestType: 'profile',
        },
      }),
    )

    const intent = readStoredIntent(storageKey, [
      {
        key: 'fullName',
        label: 'Nombre',
        autoComplete: 'name',
        currentValue: 'Cliente QA',
      },
    ])

    expect(intent.idempotencyKey).toBe('00000000-0000-4000-8000-000000000001')
    expect(intent.selectedFields).toEqual(['fullName'])
    expect(intent.receipt?.reference).toBe('CC-PR-0142')
  })

  it('builds change payloads only for real value changes', () => {
    const changes = buildChanges(
      [
        { key: 'fullName', label: 'Nombre', autoComplete: 'name', currentValue: 'Cliente QA' },
        { key: 'email', label: 'Email', autoComplete: 'email', currentValue: 'cliente.qa@example.invalid' },
      ],
      {
        fullName: 'Cliente QA',
        email: '  nuevo@example.invalid  ',
      },
    )

    expect(changes).toEqual({
      email: 'nuevo@example.invalid',
    })
  })

  it('classifies reviewed-change errors with specific human messages', () => {
    expect(classifyReviewedChangeError(new Error('timeout while posting'))).toMatchObject({
      kind: 'timeout',
    })
    expect(classifyReviewedChangeError(new Error('idempotency conflict detected'))).toMatchObject({
      kind: 'idempotency',
    })
    expect(classifyReviewedChangeError(new Error('portal_auth_configuration_unavailable'))).toMatchObject({
      kind: 'unavailable',
    })
    expect(classifyReviewedChangeError(new Error('session expired'))).toMatchObject({
      kind: 'session_expired',
    })
  })
})

function createMemoryStorage() {
  const store = new Map<string, string>()
  return {
    getItem(key: string) {
      return store.get(key) ?? null
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
    removeItem(key: string) {
      store.delete(key)
    },
    clear() {
      store.clear()
    },
  }
}
