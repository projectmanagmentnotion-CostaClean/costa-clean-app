import { afterEach, describe, expect, it, vi } from 'vitest'
import handler from './qa-secret-identity-check.js'
import { verifyQaSecretIdentity } from './_lib/qaSecretIdentityCheck.js'

const secretSentinel = 'sb_secret_synthetic_test_key'
const legacyJwtSentinel = 'synthetic.legacy.jwt'
const qaAdminUrl = 'https://kpvvydthlxupjjqqdpxy.supabase.co/auth/v1/admin/users?page=1&per_page=1'

function validEnv(overrides = {}) {
  return {
    VERCEL_ENV: 'preview',
    VERCEL_PROJECT_ID: 'prj_SjR3KtjAoBMhP5foigsyCEmxHojh',
    VERCEL_GIT_COMMIT_REF: 'codex/v3-n55-p0-compat-2026-11-09',
    VITE_APP_ENV: 'qa',
    QA_SANDBOX_PROJECT_REF: 'kpvvydthlxupjjqqdpxy',
    VITE_SUPABASE_URL: 'https://kpvvydthlxupjjqqdpxy.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: secretSentinel,
    ...overrides,
  }
}

function createResponse() {
  return {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('QA secret identity diagnostic', () => {
  it('performs one fixed QA GET with a secret API key and returns only true on HTTP 200', async () => {
    const json = vi.fn()
    const text = vi.fn()
    const fetchImpl = vi.fn().mockResolvedValue({ status: 200, json, text })

    await expect(verifyQaSecretIdentity({
      method: 'GET',
      env: validEnv(),
      fetchImpl,
    })).resolves.toBe(true)

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl).toHaveBeenCalledWith(qaAdminUrl, expect.objectContaining({
      method: 'GET',
      redirect: 'error',
      cache: 'no-store',
      headers: expect.objectContaining({ apikey: secretSentinel }),
    }))
    expect(fetchImpl.mock.calls[0][1].headers).not.toHaveProperty('Authorization')
    expect(json).not.toHaveBeenCalled()
    expect(text).not.toHaveBeenCalled()
  })

  it('supports legacy service_role JWT auth without reading the response body', async () => {
    const json = vi.fn()
    const fetchImpl = vi.fn().mockResolvedValue({ status: 200, json })

    await expect(verifyQaSecretIdentity({
      method: 'GET',
      env: validEnv({ SUPABASE_SERVICE_ROLE_KEY: legacyJwtSentinel }),
      fetchImpl,
    })).resolves.toBe(true)

    expect(fetchImpl.mock.calls[0][1].headers).toMatchObject({
      apikey: legacyJwtSentinel,
      Authorization: `Bearer ${legacyJwtSentinel}`,
    })
    expect(json).not.toHaveBeenCalled()
  })

  it.each([
    ['wrong deployment environment', { VERCEL_ENV: 'production' }],
    ['wrong project', { VERCEL_PROJECT_ID: 'another-project' }],
    ['wrong branch', { VERCEL_GIT_COMMIT_REF: 'main' }],
    ['wrong app mode', { VITE_APP_ENV: 'production' }],
    ['wrong QA reference', { QA_SANDBOX_PROJECT_REF: 'wfxnwfcdjainpojhbdri' }],
    ['wrong public URL', { VITE_SUPABASE_URL: 'https://wfxnwfcdjainpojhbdri.supabase.co' }],
    ['wrong server URL', { SUPABASE_URL: 'https://wfxnwfcdjainpojhbdri.supabase.co' }],
    ['missing service key', { SUPABASE_SERVICE_ROLE_KEY: '' }],
  ])('denies before network access when %s', async (_label, overrides) => {
    const fetchImpl = vi.fn()

    await expect(verifyQaSecretIdentity({
      method: 'GET',
      env: validEnv(overrides),
      fetchImpl,
    })).resolves.toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('denies non-GET requests before network access', async () => {
    const fetchImpl = vi.fn()

    await expect(verifyQaSecretIdentity({
      method: 'POST',
      env: validEnv(),
      fetchImpl,
    })).resolves.toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns false for an invalid key response and does not inspect or expose its body', async () => {
    const json = vi.fn(() => ({ error: 'synthetic auth detail' }))
    const fetchImpl = vi.fn().mockResolvedValue({ status: 401, json })

    await expect(verifyQaSecretIdentity({
      method: 'GET',
      env: validEnv({ SUPABASE_SERVICE_ROLE_KEY: 'invalid-synthetic-key' }),
      fetchImpl,
    })).resolves.toBe(false)

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(json).not.toHaveBeenCalled()
  })

  it('maps the runtime proof to a boolean-only response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200 }))
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('VERCEL_PROJECT_ID', 'prj_SjR3KtjAoBMhP5foigsyCEmxHojh')
    vi.stubEnv('VERCEL_GIT_COMMIT_REF', 'codex/v3-n55-p0-compat-2026-11-09')
    vi.stubEnv('VITE_APP_ENV', 'qa')
    vi.stubEnv('QA_SANDBOX_PROJECT_REF', 'kpvvydthlxupjjqqdpxy')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://kpvvydthlxupjjqqdpxy.supabase.co')
    vi.stubEnv('SUPABASE_URL', '')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', secretSentinel)

    const response = createResponse()
    await handler({ method: 'GET' }, response)

    expect(response.status).toHaveBeenCalledWith(200)
    expect(response.json).toHaveBeenCalledWith(true)
    expect(response.json).toHaveBeenCalledTimes(1)
  })
})
