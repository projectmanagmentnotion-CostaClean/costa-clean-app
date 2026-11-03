const QA_PROJECT_REF = 'kpvvydthlxupjjqqdpxy'
const QA_URL = `https://${QA_PROJECT_REF}.supabase.co`
const VERCEL_PROJECT_ID = 'prj_SjR3KtjAoBMhP5foigsyCEmxHojh'
const P0_BRANCH = 'codex/p0-expenses-rls'

function readJwtClaims(token) {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

function respond(res, passed) {
  res.statusCode = 200
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.end(passed ? 'true' : 'false')
}

export default async function p0QaIsolation(req, res) {
  if (req.method !== 'GET') return respond(res, false)

  const environment = process.env
  const anonymousKey = environment.VITE_SUPABASE_ANON_KEY
  const serviceRoleKey = environment.SUPABASE_SERVICE_ROLE_KEY

  const runtimeIsP0Preview = environment.VERCEL_ENV === 'preview'
    && environment.VERCEL_PROJECT_ID === VERCEL_PROJECT_ID
    && environment.VERCEL_GIT_COMMIT_REF === P0_BRANCH
  const qaConfigIsExact = environment.VITE_SUPABASE_URL === QA_URL
    && environment.QA_SANDBOX_PROJECT_REF === QA_PROJECT_REF
    && environment.VITE_APP_ENV === 'qa'
    && (!environment.SUPABASE_URL || environment.SUPABASE_URL === QA_URL)

  if (!runtimeIsP0Preview || !qaConfigIsExact || !anonymousKey || !serviceRoleKey) {
    return respond(res, false)
  }

  const anonymousClaims = readJwtClaims(anonymousKey)
  const serviceRoleClaims = readJwtClaims(serviceRoleKey)
  if (anonymousClaims?.role !== 'anon'
    || (anonymousClaims.ref && anonymousClaims.ref !== QA_PROJECT_REF)
    || serviceRoleClaims?.role !== 'service_role'
    || (serviceRoleClaims.ref && serviceRoleClaims.ref !== QA_PROJECT_REF)) {
    return respond(res, false)
  }

  try {
    const timeout = AbortSignal.timeout(8_000)
    const anonymousResponse = await fetch(`${QA_URL}/auth/v1/settings`, {
      method: 'GET',
      headers: { apikey: anonymousKey },
      redirect: 'manual',
      signal: timeout,
    })
    if (anonymousResponse.body) await anonymousResponse.body.cancel()
    if (anonymousResponse.status !== 200) return respond(res, false)

    const adminResponse = await fetch(`${QA_URL}/auth/v1/admin/users?page=1&per_page=1`, {
      method: 'GET',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      redirect: 'manual',
      signal: timeout,
    })
    if (adminResponse.body) await adminResponse.body.cancel()

    return respond(res, adminResponse.status === 200)
  } catch {
    return respond(res, false)
  }
}
