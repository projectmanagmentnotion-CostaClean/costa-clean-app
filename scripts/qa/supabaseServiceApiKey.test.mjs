import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { resolveSupabaseServiceApiKey, supabaseServiceApiHeaders } from '../../supabase/functions/_shared/supabaseServiceApiKey.ts'

const LEGACY_JWT = 'eyJhbGci.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.c3ludGhldGlj'
const SECRET_KEY = 'sb_secret_synthetic_only'

function env(values) {
  return (name) => values[name]
}

describe('server-side Supabase API key migration', () => {
  it('prefers an explicitly configured secret key', () => {
    expect(resolveSupabaseServiceApiKey(env({
      SUPABASE_SECRET_KEY: SECRET_KEY,
      SUPABASE_SERVICE_ROLE_KEY: LEGACY_JWT,
    }))).toEqual({ value: SECRET_KEY, kind: 'secret' })
  })

  it('selects a named key from Supabase runtime key metadata', () => {
    expect(resolveSupabaseServiceApiKey(env({
      SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'sb_secret_default_synthetic', qa: SECRET_KEY }),
      SUPABASE_SECRET_KEY_NAME: 'qa',
      SUPABASE_SERVICE_ROLE_KEY: LEGACY_JWT,
    }))).toEqual({ value: SECRET_KEY, kind: 'secret' })
  })

  it('uses the default key when no selector is configured', () => {
    expect(resolveSupabaseServiceApiKey(env({
      SUPABASE_SECRET_KEYS: JSON.stringify({ default: SECRET_KEY, other: 'sb_secret_other_synthetic' }),
    }))).toEqual({ value: SECRET_KEY, kind: 'secret' })
  })

  it('uses a sole named key but rejects an ambiguous key map', () => {
    expect(resolveSupabaseServiceApiKey(env({
      SUPABASE_SECRET_KEYS: JSON.stringify({ qa: SECRET_KEY }),
    }))).toEqual({ value: SECRET_KEY, kind: 'secret' })
    expect(resolveSupabaseServiceApiKey(env({
      SUPABASE_SECRET_KEYS: JSON.stringify({ qa: SECRET_KEY, other: 'sb_secret_other_synthetic' }),
    }))).toBeNull()
  })

  it('fails closed for malformed or mismatched configured secret keys', () => {
    expect(resolveSupabaseServiceApiKey(env({ SUPABASE_SECRET_KEY: 'not-a-secret-key', SUPABASE_SERVICE_ROLE_KEY: LEGACY_JWT }))).toBeNull()
    expect(resolveSupabaseServiceApiKey(env({ SUPABASE_SECRET_KEYS: '{invalid', SUPABASE_SERVICE_ROLE_KEY: LEGACY_JWT }))).toBeNull()
    expect(resolveSupabaseServiceApiKey(env({
      SUPABASE_SECRET_KEYS: JSON.stringify({ qa: 'not-a-secret-key' }),
      SUPABASE_SECRET_KEY_NAME: 'qa',
    }))).toBeNull()
  })

  it('retains only a JWT-shaped legacy service-role fallback', () => {
    expect(resolveSupabaseServiceApiKey(env({ SUPABASE_SERVICE_ROLE_KEY: LEGACY_JWT })))
      .toEqual({ value: LEGACY_JWT, kind: 'legacy-jwt' })
    expect(resolveSupabaseServiceApiKey(env({ SUPABASE_SERVICE_ROLE_KEY: 'server-placeholder' }))).toBeNull()
  })

  it('sends opaque secret keys only as apikey and keeps legacy Bearer compatibility', () => {
    const modern = supabaseServiceApiHeaders({ value: SECRET_KEY, kind: 'secret' }, 'application/json')
    expect(modern).toEqual({ apikey: SECRET_KEY, 'Content-Type': 'application/json' })
    const legacy = supabaseServiceApiHeaders({ value: LEGACY_JWT, kind: 'legacy-jwt' })
    expect(legacy).toEqual({ apikey: LEGACY_JWT, Authorization: `Bearer ${LEGACY_JWT}` })
  })

  it('routes migratable server-side Edge Functions through the shared resolver', () => {
    const sources = [
      'supabase/functions/_shared/publicQuizHandler.ts',
      'supabase/functions/expense-document-openai-extraction/index.ts',
      'supabase/functions/expense-document-normalization/index.ts',
      'supabase/functions/costa-clean-notification-dispatcher/index.ts',
      'supabase/functions/costa-clean-notification-producer/index.ts',
    ].map((path) => readFileSync(path, 'utf8'))
    expect(sources.every((source) => source.includes('resolveSupabaseServiceApiKey'))).toBe(true)
    expect(sources.slice(1).every((source) => !/createClient\([^\n]*SUPABASE_SERVICE_ROLE_KEY/u.test(source))).toBe(true)
  })
})
