export type SupabaseServiceApiKey = {
  value: string
  kind: 'secret' | 'legacy-jwt'
}

type EnvReader = (name: string) => string | undefined

const SECRET_PREFIX = 'sb_secret_'
const LEGACY_JWT_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u

/**
 * Resolve a server-only Supabase key without ever logging its value.
 * Prefer an explicitly configured secret key, then Supabase's injected key
 * map, and retain the legacy service-role JWT as a migration fallback.
 */
export function resolveSupabaseServiceApiKey(env: EnvReader): SupabaseServiceApiKey | null {
  const explicitSecret = env('SUPABASE_SECRET_KEY')?.trim()
  if (explicitSecret) return explicitSecret.startsWith(SECRET_PREFIX)
    ? { value: explicitSecret, kind: 'secret' }
    : null

  const secretKeysJson = env('SUPABASE_SECRET_KEYS')?.trim()
  if (secretKeysJson) {
    let secretKeys: Record<string, unknown>
    try {
      const parsed: unknown = JSON.parse(secretKeysJson)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
      secretKeys = parsed as Record<string, unknown>
    } catch {
      return null
    }

    const configuredName = env('SUPABASE_SECRET_KEY_NAME')?.trim()
    const selectedName = configuredName
      || (typeof secretKeys.default === 'string' ? 'default' : '')
      || (Object.keys(secretKeys).length === 1 ? Object.keys(secretKeys)[0] : '')
    if (!selectedName) return null
    const selectedKey = secretKeys[selectedName]
    return typeof selectedKey === 'string' && selectedKey.startsWith(SECRET_PREFIX)
      ? { value: selectedKey, kind: 'secret' }
      : null
  }

  const legacyKey = env('SUPABASE_SERVICE_ROLE_KEY')?.trim()
  return legacyKey && LEGACY_JWT_PATTERN.test(legacyKey)
    ? { value: legacyKey, kind: 'legacy-jwt' }
    : null
}

export function supabaseServiceApiHeaders(
  credential: SupabaseServiceApiKey,
  contentType?: string,
): Record<string, string> {
  return {
    apikey: credential.value,
    ...(credential.kind === 'legacy-jwt' ? { Authorization: `Bearer ${credential.value}` } : {}),
    ...(contentType ? { 'Content-Type': contentType } : {}),
  }
}
