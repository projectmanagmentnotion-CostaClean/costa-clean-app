import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const manifestPath = path.join(
  repoRoot,
  'supabase',
  'qa',
  'bootstrap',
  'v3-p0-release-manifest.json',
)
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const errors = []

function fail(message) {
  errors.push(message)
}

function gitText(args) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  })
  if (result.status !== 0) return null
  return result.stdout.trim()
}

function gitFile(ref, file) {
  const result = spawnSync('git', ['show', `${ref}:${file}`], {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  })
  return result.status === 0 ? result.stdout : null
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex').toUpperCase()
}

if (manifest.format !== 1) fail('Unsupported manifest format.')
if (manifest.applyAllowed !== false) fail('Manifest must keep applyAllowed=false.')

const v3Head = gitText(['rev-parse', manifest.sourceRefs.v3])
const p0Head = gitText(['rev-parse', manifest.sourceRefs.p0])
if (v3Head !== manifest.sourceRefs.v3Head) fail('Pinned V3 source ref does not match its expected SHA.')
if (p0Head !== manifest.sourceRefs.p0Head) fail('Pinned P0 source ref does not match its expected SHA.')

const migrationsDir = path.join(repoRoot, 'supabase', 'migrations')
const migrationFiles = readdirSync(migrationsDir).filter((file) => file.endsWith('.sql'))
const versions = migrationFiles.map((file) => file.match(/^(\d+)_/)?.[1]).filter(Boolean)
if (versions.length !== migrationFiles.length) fail('A migration filename has no numeric version prefix.')
if (new Set(versions).size !== versions.length) fail('Duplicate version prefixes remain in supabase/migrations.')
if (migrationFiles.some((file) => /qa[_-]baseline/i.test(file))) {
  fail('QA-only baseline is still discoverable as a CLI migration.')
}

const baseline = path.join(repoRoot, manifest.qaBootstrap.path.replaceAll('/', path.sep))
if (!existsSync(baseline)) fail('QA bootstrap baseline is missing from its non-migrations path.')
else if (sha256(readFileSync(baseline)) !== manifest.qaBootstrap.sha256) {
  fail('QA bootstrap baseline bytes changed.')
}

const baselineHarnesses = [
  'scripts/client-portal/run-cp2a-local-proof.mjs',
  'scripts/client-portal/run-cp2a1-local-proof.mjs',
  'scripts/client-portal/run-cp2a3-bootstrap-proof.mjs',
  'scripts/client-portal/run-cp3b0-local-proof.mjs',
  'scripts/client-portal/run-cp3b0a-local-proof.mjs',
  'scripts/client-portal/run-cp3b2a-local-proof.mjs',
  'scripts/client-portal/run-cp3b2a1-local-proof.mjs',
  'scripts/client-portal/run-cp3b2a3-local-proof.mjs',
  'scripts/client-portal/run-cp3b2a4-local-proof.mjs',
  'scripts/client-portal/run-cp3b2a5-local-proof.mjs',
]
for (const file of baselineHarnesses) {
  const source = readFileSync(path.join(repoRoot, file), 'utf8')
  if (!source.includes('../qa/bootstrap/20260721_qa_baseline_schema.sql')) {
    fail(`Local QA harness does not resolve the relocated bootstrap baseline: ${file}.`)
  }
}
const repairProof = readFileSync(
  path.join(repoRoot, 'scripts', 'ops', 'run-local-migration-repair-proof.mjs'),
  'utf8',
)
if (!repairProof.includes("'qa', 'bootstrap', artifact.file")
  || !repairProof.includes("'qa', 'bootstrap', baseline.file")) {
  fail('Local migration repair proof does not resolve its bootstrap baseline outside migrations.')
}

if (manifest.migrations.length !== 18) fail('Manifest must contain exactly the 18 PR #28 migrations.')
const matrixFiles = manifest.migrations.map(({ file }) => file)
if (new Set(matrixFiles).size !== matrixFiles.length) fail('Manifest contains duplicate migration files.')
if (JSON.stringify(matrixFiles.concat(path.basename(manifest.p0.file)))
  !== JSON.stringify(manifest.productionOrder)) {
  fail('Production execution order differs from the 18 V3 files followed by P0.')
}

const localVersionOrder = []
for (const migration of manifest.migrations) {
  const source = gitFile(manifest.sourceRefs.v3, `supabase/migrations/${migration.file}`)
  if (source === null) {
    fail(`Pinned V3 source is missing ${migration.file}.`)
    continue
  }
  const version = migration.file.match(/^(\d+)_/)?.[1]
  if (!version) fail(`V3 migration has no numeric version: ${migration.file}.`)
  else localVersionOrder.push(version)
}
if (localVersionOrder.some((version, index) => index > 0 && version < localVersionOrder[index - 1])) {
  fail('V3 migration filenames are not in chronological order.')
}

const n56 = manifest.productionOrder.indexOf('20261002170000_n56_preproduction_security_hardening.sql')
const grants = manifest.productionOrder.indexOf('20261002173000_expense_product_grant_hardening.sql')
const p0 = manifest.productionOrder.indexOf('20261102120000_p0_expense_access_and_rpc_hardening.sql')
if (!(n56 >= 0 && grants === n56 + 1 && p0 === grants + 1)) {
  fail('Required N56 → grant hardening → P0 suffix is not consecutive.')
}

const p0Source = gitFile(manifest.sourceRefs.p0, manifest.p0.file)
if (p0Source === null) fail('Pinned P0 migration source is missing.')
else {
  if (sha256(p0Source) !== manifest.p0.sha256) fail('Pinned P0 migration SHA-256 differs from certification.')
  for (const token of ['expense_staff_access', 'service_role', 'TRUNCATE', 'DELETE']) {
    if (!p0Source.toLowerCase().includes(token.toLowerCase())) {
      fail(`P0 source does not contain the expected security contract token: ${token}.`)
    }
  }
}

if (errors.length) {
  for (const error of errors) console.error(`FAIL ${error}`)
  process.exitCode = 1
} else {
  console.log('PASS pinned source refs and heads')
  console.log('PASS 18 V3 migrations present and ordered')
  console.log('PASS unique incremental version prefixes')
  console.log('PASS QA-only baseline excluded from CLI migration directory; bytes preserved')
  console.log('PASS local reconstruction harnesses resolve the QA baseline outside migrations')
  console.log('PASS N56 → grant hardening → P0 ordering')
  console.log('PASS P0 certified source hash and required security markers')
  console.log('PASS static only; no network, SQL, migration, or deployment executed')
}
