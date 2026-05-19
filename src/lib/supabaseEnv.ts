function normalizeEnvValue(value: string | undefined): string {
  return (value ?? '').replace(/\\r|\\n/g, '').trim()
}

export function getSupabasePublicEnv() {
  return {
    supabaseUrl: normalizeEnvValue(import.meta.env.VITE_SUPABASE_URL),
    supabaseAnonKey: normalizeEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY),
  }
}
