function normalizeEnvValue(value: string | undefined): string {
  return (value ?? '').replace(/\\r|\\n/g, '').trim()
}

export function getSupabasePublicEnv() {
  const viteEnv = typeof import.meta !== 'undefined' && typeof import.meta.env === 'object' && import.meta.env
    ? import.meta.env
    : undefined
  const processEnv =
    typeof globalThis === 'object' && 'process' in globalThis
      ? (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
      : undefined

  return {
    supabaseUrl: normalizeEnvValue(viteEnv?.VITE_SUPABASE_URL ?? processEnv?.VITE_SUPABASE_URL),
    supabaseAnonKey: normalizeEnvValue(viteEnv?.VITE_SUPABASE_ANON_KEY ?? processEnv?.VITE_SUPABASE_ANON_KEY),
  }
}
