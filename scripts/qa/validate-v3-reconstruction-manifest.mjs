import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const manifest = JSON.parse(readFileSync(path.join(root, 'supabase/qa/bootstrap/v3-reconstruction-manifest.json'), 'utf8'))
const base = 'supabase/migrations/'
const baseline = readFileSync(path.join(root, manifest.baseline.path))
const digest = createHash('sha256').update(baseline).digest('hex').toUpperCase()
const equivalents = manifest.equivalentMigrations.map(({ prFile }) => prFile)
const pending = manifest.pendingMigrations
const allV3 = [...equivalents, ...pending]
const version = (file) => file.slice(0, 14)

assert.equal(manifest.applyAllowed, false, 'manifest must remain non-executable until prestate blockers close')
assert.equal(digest, manifest.baseline.sha256, 'baseline fingerprint drift')
assert.equal(equivalents.length, 5)
assert.equal(pending.length, 13)
assert.equal(new Set(allV3).size, 18, 'duplicate migration source')
assert.deepEqual(allV3.map(version), [...allV3.map(version)].sort(), 'V3 files are not ordered by version')
assert.ok(!allV3.includes(path.basename(manifest.baseline.path)), 'QA baseline must never enter incremental sequence')
assert.equal(manifest.postN56P0, 'supabase/migrations/20261102120000_p0_expense_access_and_rpc_hardening.sql')
const p0Sql = readFileSync(path.join(root, manifest.postN56P0), 'utf8')
const p0Matrix = readFileSync(path.join(root, manifest.p0Test), 'utf8')
assert.ok(p0Sql.includes('public.expense_staff_access(boolean)'))
assert.ok(p0Sql.includes('app_private.internal_staff_role_can_write_financially(v_role)'))
assert.ok(p0Sql.includes('revoke all on function %s from public, anon, authenticated, service_role'))
assert.ok(p0Sql.includes('grant execute on function public.expense_staff_access(boolean)\n  to authenticated'))
assert.ok(p0Matrix.includes("('suspended_finance'), ('revoked_finance'), ('nonmember')"))
assert.ok(p0Matrix.includes('service_role_can_delete'))
assert.ok(p0Matrix.trimEnd().endsWith('rollback;'))

for (const file of allV3) {
  execFileSync('git', ['cat-file', '-e', `${manifest.pr28Commit}:${base}${file}`], { cwd: root, stdio: 'ignore' })
}

const dbPushGuard = readFileSync(path.join(root, 'scripts/ops/assert-db-push-locked.mjs'), 'utf8')
assert.ok(dbPushGuard.length > 0, 'the repository db:push lock must remain present')

console.log('V3 reconstruction manifest static checks: PASS (not a SQL replay proof)')
