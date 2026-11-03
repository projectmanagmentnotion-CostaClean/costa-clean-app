import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const qaRef = 'kpvvydthlxupjjqqdpxy'
const qaUrl = 'https://kpvvydthlxupjjqqdpxy.supabase.co'
const branch = 'codex/p0-expenses-rls'
const projectId = 'prj_SjR3KtjAoBMhP5foigsyCEmxHojh'
const root = process.cwd()

function emit(passed) {
  process.stdout.write(`P0_CLIENT_BUNDLE_CHECK=${passed ? 'PASS' : 'FAIL'}\n`)
}

function readJwtClaims(value) {
  const parts = value.split('.')
  if (parts.length !== 3) return null
  return {
    header: JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')),
    payload: JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')),
  }
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await listFiles(file))
    else if (entry.isFile()) files.push(file)
  }
  return files
}

try {
  const env = process.env
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  const claims = key ? readJwtClaims(key) : null
  const configIsQa =
    env.VERCEL_ENV === 'preview' &&
    env.VERCEL_PROJECT_ID === projectId &&
    env.VERCEL_GIT_COMMIT_REF === branch &&
    env.VITE_APP_ENV === 'qa' &&
    env.QA_SANDBOX_PROJECT_REF === qaRef &&
    env.VITE_SUPABASE_URL === qaUrl &&
    (!env.SUPABASE_URL || env.SUPABASE_URL === qaUrl) &&
    claims?.header?.alg === 'HS256' &&
    claims?.payload?.role === 'service_role' &&
    claims?.payload?.ref === qaRef &&
    !Object.keys(env).some((name) => /^VITE_.*(SERVICE_ROLE|SECRET|PRIVILEGED)/i.test(name))

  if (!configIsQa) {
    emit(false)
    process.exit(1)
  }

  const files = await listFiles(path.join(root, 'dist'))
  if (!files.length) throw new Error()

  const keyBytes = Buffer.from(key, 'utf8')
  for (const file of files) {
    const content = await readFile(file)
    if (
      content.indexOf(keyBytes) !== -1 ||
      content.includes(Buffer.from('SUPABASE_SERVICE_ROLE_KEY', 'utf8'))
    ) {
      emit(false)
      process.exit(1)
    }
  }

  await writeFile(path.join(root, '.p0-client-bundle-check.json'), '{"pass":true}', { mode: 0o600 })
  emit(true)
} catch {
  emit(false)
  process.exit(1)
}
