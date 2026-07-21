import { assertSandboxPublicConfig } from './qaEnvironmentGuardrails.mjs'

const RESET_STRATEGIES = new Set(['snapshot-restore', 'branch-discard'])
const FORBIDDEN_FILE_KEY = /(SERVICE_ROLE|SUPABASE_SECRET|DATABASE_URL|DB_PASSWORD|ACCESS_TOKEN)/iu

export function parseSandboxEnv(raw) {
  const parsed = {}
  for (const line of String(raw ?? '').split(/\r?\n/u)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator < 0) continue
    const key = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/gu, '')
    if (key) parsed[key] = value
  }
  return parsed
}

export function readSupabaseProjectFingerprint(supabaseUrl) {
  try {
    const [projectRef, ...rest] = new URL(supabaseUrl).hostname.toLowerCase().split('.')
    return rest.join('.') === 'supabase.co' ? projectRef : null
  } catch {
    return null
  }
}

export function validateSandboxReadiness({ sandboxEnv, referenceEnv = {} }) {
  const forbiddenNames = Object.keys(sandboxEnv).filter((key) => FORBIDDEN_FILE_KEY.test(key))
  if (forbiddenNames.length > 0) {
    throw new Error('Sandbox env contains a forbidden private credential name. Keep privileged credentials outside .env.qa.local.')
  }

  assertSandboxPublicConfig(sandboxEnv)

  const resetStrategy = String(sandboxEnv.QA_SANDBOX_RESET_STRATEGY ?? '').trim().toLowerCase()
  if (!RESET_STRATEGIES.has(resetStrategy)) {
    throw new Error('Sandbox readiness requires QA_SANDBOX_RESET_STRATEGY=snapshot-restore or branch-discard.')
  }

  const sandboxFingerprint = readSupabaseProjectFingerprint(sandboxEnv.VITE_SUPABASE_URL)
  const referenceFingerprint = readSupabaseProjectFingerprint(referenceEnv.VITE_SUPABASE_URL)
  if (referenceFingerprint && sandboxFingerprint === referenceFingerprint) {
    throw new Error('Sandbox project fingerprint matches the local reference project; isolation is not proven.')
  }

  return {
    sandboxFingerprint,
    resetStrategy,
    distinctFromLocalReference: referenceFingerprint ? true : null,
  }
}
