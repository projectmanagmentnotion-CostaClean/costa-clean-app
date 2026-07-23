import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const QA_REF = 'kpvvydthlxupjjqqdpxy'
const PRODUCTION_REF = 'wfxnwfcdjainpojhbdri'
const migrationPath = 'supabase/migrations/20260723160000_client_portal_security_boundary.sql'

if (process.argv.includes('--execute')) {
  throw new Error('CP-2B is not authorized by CP-2A. Use a later exact-hash authorization.')
}
if (!process.argv.includes('--plan')) {
  throw new Error('Plan-only runner. Pass --plan; remote execution is intentionally unavailable.')
}

const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
const plan = {
  gate: 'CP-2B',
  status: 'NOT_AUTHORIZED',
  qaProjectRef: QA_REF,
  productionProjectRef: PRODUCTION_REF,
  productionAllowed: false,
  remoteWritesPerformed: 0,
  migration: { path: migrationPath, sha256: sha256(migrationPath) },
  requiredSecretsByName: [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'PORTAL_INVITATION_PEPPER',
    'PORTAL_RATE_LIMIT_PEPPER',
    'PORTAL_ALLOWED_ORIGIN',
  ],
  stopConditions: [
    'package hash mismatch',
    'target project ref mismatch',
    'production ref observed',
    'missing exact internal staff Auth UUIDs',
    'catalog drift',
    'backup or snapshot failure',
    'cleanup cannot prove zero synthetic residue',
  ],
}
process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`)
