import { describe, expect, it } from 'vitest'
import { isRecoverableAuthBootstrapError, shouldClearStoredSupabaseSession } from './authBootstrap'

describe('auth bootstrap recovery', () => {
  it('classifies transient network and lock failures as recoverable', () => {
    expect(isRecoverableAuthBootstrapError('Failed to fetch')).toBe(true)
    expect(isRecoverableAuthBootstrapError('lock broken by another request')).toBe(true)
    expect(isRecoverableAuthBootstrapError('Invalid login credentials')).toBe(false)
  })

  it('clears persisted auth only for an explicit signed-out event', () => {
    expect(shouldClearStoredSupabaseSession('SIGNED_OUT')).toBe(true)
    expect(shouldClearStoredSupabaseSession('TOKEN_REFRESHED')).toBe(false)
    expect(shouldClearStoredSupabaseSession('network error')).toBe(false)
  })
})
