const QA_ENVIRONMENTS = new Set([
  'production',
  'local-production-config',
  'sandbox',
  'unknown',
])

const SANDBOX_RESET_STRATEGIES = new Set(['snapshot-restore', 'branch-discard'])
const SANDBOX_CLEANUP_STRATEGIES = new Set(['registry-and-reset'])

function normalize(value) {
  return String(value ?? '').trim().toLowerCase()
}

function isLocalUrl(appUrl) {
  try {
    const host = new URL(appUrl).hostname.toLowerCase()
    return host === '127.0.0.1' || host === 'localhost'
  } catch {
    return false
  }
}

function readSupabaseProjectRef(supabaseUrl) {
  try {
    const [projectRef, ...rest] = new URL(supabaseUrl).hostname.toLowerCase().split('.')
    return rest.join('.') === 'supabase.co' ? projectRef : null
  } catch {
    return null
  }
}

export function resolveQaEnvironment({ qaEnv, appUrl }) {
  const explicitEnvironment = normalize(qaEnv)
  if (explicitEnvironment) {
    return QA_ENVIRONMENTS.has(explicitEnvironment) ? explicitEnvironment : 'unknown'
  }

  if (isLocalUrl(appUrl)) return 'local-production-config'

  try {
    return new URL(appUrl).hostname.toLowerCase() === 'app.costacleanbcn.com'
      ? 'production'
      : 'unknown'
  } catch {
    return 'unknown'
  }
}

export function assertNoPrivilegedFrontendConfig(env = process.env) {
  const forbiddenKeys = Object.keys(env).filter((key) => (
    /SERVICE_ROLE/u.test(key.toUpperCase())
    || /SUPABASE_SECRET/u.test(key.toUpperCase())
  ) && String(env[key] ?? '').trim())

  if (forbiddenKeys.length > 0) {
    throw new Error(`Privileged Supabase configuration is forbidden in QA frontend/runtime env: ${forbiddenKeys.join(', ')}.`)
  }
}

export function assertSandboxPublicConfig(env = process.env) {
  assertNoPrivilegedFrontendConfig(env)

  if (normalize(env.VITE_APP_ENV) !== 'qa') {
    throw new Error('Sandbox requires VITE_APP_ENV=qa.')
  }
  if (!String(env.VITE_SUPABASE_URL ?? '').trim() || !String(env.VITE_SUPABASE_ANON_KEY ?? '').trim()) {
    throw new Error('Sandbox requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }

  const expectedProjectRef = normalize(env.QA_SANDBOX_PROJECT_REF)
  const actualProjectRef = readSupabaseProjectRef(env.VITE_SUPABASE_URL)
  if (!expectedProjectRef || !actualProjectRef || expectedProjectRef !== actualProjectRef) {
    throw new Error('Sandbox Supabase project fingerprint is missing or does not match QA_SANDBOX_PROJECT_REF.')
  }
}

export function assertQaAgentEnvironmentAllowed({
  mode,
  appUrl,
  qaEnv = process.env.QA_ENV,
  allowWriteClean = process.env.QA_ALLOW_WRITE_CLEAN,
  env = process.env,
}) {
  const environment = resolveQaEnvironment({ qaEnv, appUrl })
  assertNoPrivilegedFrontendConfig(env)

  if (mode === 'dry-run') return environment
  if (mode !== 'write-and-clean') {
    throw new Error(`Unsupported QA operation mode "${mode}".`)
  }
  if (environment === 'unknown') {
    throw new Error('write-and-clean is blocked for an unknown QA environment.')
  }
  if (String(allowWriteClean ?? '').trim() !== '1') {
    throw new Error('write-and-clean requires QA_ALLOW_WRITE_CLEAN=1 for every environment.')
  }
  if (environment === 'sandbox') assertSandboxPublicConfig(env)
  return environment
}

export function assertFullSubmitAllowed({
  environment,
  flowId,
  allowFullSubmit,
  allowWriteClean,
  qaRunId,
  cleanupStrategy,
  resetStrategy,
  env = {},
}) {
  assertNoPrivilegedFrontendConfig(env)

  if (environment !== 'sandbox') {
    throw new Error('full-flow submit is allowed only in sandbox.')
  }
  if (normalize(env.QA_ENV) !== 'sandbox') {
    throw new Error('full-flow submit requires QA_ENV=sandbox.')
  }
  assertSandboxPublicConfig(env)
  if (String(allowFullSubmit ?? '').trim() !== '1') {
    throw new Error('full-flow submit requires QA_ALLOW_FULL_SUBMIT=1.')
  }
  if (String(allowWriteClean ?? '').trim() !== '1') {
    throw new Error('full-flow submit requires QA_ALLOW_WRITE_CLEAN=1.')
  }
  if (!/^QA-AUTO-[A-Z0-9-]+$/u.test(String(qaRunId ?? '').trim())) {
    throw new Error('full-flow submit requires a QA-AUTO qaRunId.')
  }
  if (!SANDBOX_CLEANUP_STRATEGIES.has(normalize(cleanupStrategy))) {
    throw new Error('full-flow submit requires registry-and-reset cleanup strategy.')
  }
  if (!SANDBOX_RESET_STRATEGIES.has(normalize(resetStrategy))) {
    throw new Error('full-flow submit requires snapshot-restore or branch-discard reset strategy.')
  }
  if (!String(flowId ?? '').trim()) {
    throw new Error('full-flow submit requires an explicit flow id.')
  }

  return true
}
