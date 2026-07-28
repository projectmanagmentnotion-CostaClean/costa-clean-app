import { describe, expect, it } from 'vitest'
import {
  createPortalAuthStorageKey,
  createPortalRecoveryRedirect,
} from './portalSupabaseClient'

describe('portal Supabase client isolation', () => {
  it('derives an environment-specific portal-only auth storage key', () => {
    const qaKey = createPortalAuthStorageKey('https://qa-project.supabase.co')
    const productionKey = createPortalAuthStorageKey(
      'https://production-project.supabase.co',
    )

    expect(qaKey).toBe('costa-clean-portal-qa-project.supabase.co-auth')
    expect(productionKey).not.toBe(qaKey)
    expect(qaKey).toContain('portal')
  })

  it('rejects invalid or non-HTTPS Supabase endpoints', () => {
    expect(createPortalAuthStorageKey('')).toBeNull()
    expect(createPortalAuthStorageKey('http://remote.example.com')).toBeNull()
    expect(createPortalAuthStorageKey('not-a-url')).toBeNull()
  })

  it('isolates loopback projects by port for local Auth testing', () => {
    expect(createPortalAuthStorageKey('http://127.0.0.1:54321')).toBe(
      'costa-clean-portal-127.0.0.1-54321-auth',
    )
    expect(createPortalAuthStorageKey('http://127.0.0.1:54322')).not.toBe(
      createPortalAuthStorageKey('http://127.0.0.1:54321'),
    )
  })

  it('builds only the exact reset route on an allowed origin', () => {
    expect(createPortalRecoveryRedirect('https://app.example.com')).toBe(
      'https://app.example.com/portal/reset-password',
    )
    expect(createPortalRecoveryRedirect('http://127.0.0.1:4173')).toBe(
      'http://127.0.0.1:4173/portal/reset-password',
    )
  })

  it('rejects redirect inputs with paths, credentials or unsafe remote HTTP', () => {
    expect(
      createPortalRecoveryRedirect('https://app.example.com/portal'),
    ).toBeNull()
    expect(
      createPortalRecoveryRedirect('https://user:pass@app.example.com'),
    ).toBeNull()
    expect(
      createPortalRecoveryRedirect('http://app.example.com'),
    ).toBeNull()
  })
})
