const QA_REF = 'kpvvydthlxupjjqqdpxy'
const QA_URL = `https://${QA_REF}.supabase.co`
const EXPECTED_PROJECT_ID = 'prj_SjR3KtjAoBMhP5foigsyCEmxHojh'
const EXPECTED_BRANCH = 'codex/v3-n55-p0-compat-2026-11-09'
const ADMIN_USERS_URL = `${QA_URL}/auth/v1/admin/users?page=1&per_page=1`
const REQUEST_TIMEOUT_MS = 5_000

function hasExpectedRuntime(env) {
  const optionalServerUrl = env.SUPABASE_URL
  return env.VERCEL_ENV === 'preview'
    && env.VERCEL_PROJECT_ID === EXPECTED_PROJECT_ID
    && env.VERCEL_GIT_COMMIT_REF === EXPECTED_BRANCH
    && env.VITE_APP_ENV === 'qa'
    && env.QA_SANDBOX_PROJECT_REF === QA_REF
    && env.VITE_SUPABASE_URL === QA_URL
    && (!optionalServerUrl || optionalServerUrl === QA_URL)
    && typeof env.SUPABASE_SERVICE_ROLE_KEY === 'string'
    && env.SUPABASE_SERVICE_ROLE_KEY.trim().length > 0
}

/**
 * Makes at most one fixed, read-only request to the QA Auth admin API.
 * Response bodies and caught errors are deliberately never inspected or logged.
 */
export async function verifyQaSecretIdentity({ method, env, fetchImpl }) {
  if (method !== 'GET' || !hasExpectedRuntime(env) || typeof fetchImpl !== 'function') {
    return false
  }

  const key = env.SUPABASE_SERVICE_ROLE_KEY
  const headers = {
    apikey: key,
    accept: 'application/json',
  }

  // Supabase secret API keys authenticate through `apikey`; legacy service_role
  // JWTs additionally use Bearer auth. Never send a new sb_secret key as Bearer.
  if (!key.startsWith('sb_secret_')) {
    headers.Authorization = `Bearer ${key}`
  }

  try {
    const response = await fetchImpl(ADMIN_USERS_URL, {
      method: 'GET',
      headers,
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    return response?.status === 200
  } catch {
    return false
  }
}
