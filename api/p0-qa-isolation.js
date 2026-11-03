import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const qaRef = 'kpvvydthlxupjjqqdpxy'
const qaUrl = 'https://kpvvydthlxupjjqqdpxy.supabase.co'
const branch = 'codex/p0-expenses-rls'
const projectId = 'prj_SjR3KtjAoBMhP5foigsyCEmxHojh'
const bundleReportPath = fileURLToPath(new URL('../.p0-client-bundle-check.json', import.meta.url))

function respond(res, passed) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  res.end(passed ? 'true' : 'false')
}

function readJwtClaims(value) {
  const parts = value.split('.')
  if (parts.length !== 3) return null

  return {
    header: JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')),
    payload: JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')),
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return respond(res, false)

  const env = process.env
  const runtimeConfigIsQa =
    env.VERCEL_ENV === 'preview' &&
    env.VERCEL_PROJECT_ID === projectId &&
    env.VERCEL_GIT_COMMIT_REF === branch &&
    env.VITE_APP_ENV === 'qa' &&
    env.QA_SANDBOX_PROJECT_REF === qaRef &&
    env.VITE_SUPABASE_URL === qaUrl &&
    (!env.SUPABASE_URL || env.SUPABASE_URL === qaUrl)

  if (!runtimeConfigIsQa) return respond(res, false)

  let bundleCheckPassed = false
  try {
    bundleCheckPassed = JSON.parse(readFileSync(bundleReportPath, 'utf8')).pass === true
  } catch {
    return respond(res, false)
  }
  if (!bundleCheckPassed) return respond(res, false)

  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) return respond(res, false)

  let claims
  try {
    claims = readJwtClaims(serviceRoleKey)
  } catch {
    return respond(res, false)
  }

  if (
    claims?.header?.alg !== 'HS256' ||
    claims?.payload?.role !== 'service_role' ||
    claims?.payload?.ref !== qaRef
  ) return respond(res, false)

  let response
  try {
    response = await fetch(`${qaUrl}/auth/v1/admin/users?page=1&per_page=1`, {
      method: 'GET',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    })
  } catch {
    return respond(res, false)
  }

  const passed = response.status === 200
  try {
    await response.body?.cancel()
  } catch {}
  return respond(res, passed)
}
