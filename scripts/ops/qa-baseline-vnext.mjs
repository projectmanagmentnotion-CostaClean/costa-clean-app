import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const manifestRelativePath = 'supabase/qa/bootstrap/qa-baseline-vnext.manifest.json'

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex').toUpperCase()
}

function git(root, args, encoding = 'utf8') {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding,
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  })
  if (result.status !== 0) return null
  return result.stdout
}

function readGitBytes(root, commit, relativePath) {
  return git(root, ['show', `${commit}:${relativePath}`], null)
}

export function certifyQaBaselineVNext({ repoRoot = defaultRoot } = {}) {
  const root = path.resolve(repoRoot)
  const manifestPath = path.join(root, manifestRelativePath)
  const errors = []
  const pass = (name) => ({ name, status: 'PASS' })
  const checks = []
  const fail = (name, message) => {
    checks.push({ name, status: 'FAIL', message })
    errors.push(message)
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

  if (manifest.format !== 1 || manifest.id !== 'COSTACLEAN-QA-BASELINE-VNEXT-20261103') {
    fail('manifest_identity', 'Unexpected QA baseline vNext manifest identity.')
  } else checks.push(pass('manifest_identity'))

  const baselinePath = path.join(root, manifest.baseline.path)
  const relocated = existsSync(baselinePath) ? readFileSync(baselinePath) : null
  const original = readGitBytes(
    root,
    manifest.baseline.referenceCommit,
    manifest.baseline.originalPathAtReferenceCommit,
  )
  if (!relocated || sha256(relocated) !== manifest.baseline.sha256) {
    fail('baseline_sha256', 'Relocated baseline does not match its certified SHA-256.')
  } else if (!original || sha256(original) !== manifest.baseline.sha256
    || !relocated.equals(original)) {
    fail('baseline_original_identity', 'Relocated baseline differs from the original Git artifact.')
  } else checks.push(pass('baseline_original_identity'))

  const migrationDirectory = path.join(root, 'supabase', 'migrations')
  const sqlFiles = readdirSync(migrationDirectory).filter((file) => file.endsWith('.sql'))
  const versionedFiles = sqlFiles.map((file) => ({
    file,
    version: file.match(/^(\d+)_/)?.[1] ?? null,
  }))
  const versions = versionedFiles.map(({ version }) => version)
  const baselineDiscoverable = versionedFiles.some(({ file }) => /qa[_-]baseline/i.test(file))
  if (versionedFiles.some(({ version }) => !version)
    || new Set(versions).size !== versions.length
    || baselineDiscoverable
    || manifest.baseline.incremental !== false) {
    fail('incremental_exclusion', 'Baseline or duplicate/malformed migration versions detected.')
  } else checks.push(pass('incremental_exclusion'))

  const matrixPath = path.join(root, manifest.releaseMatrix.sourceManifest)
  const matrix = JSON.parse(readFileSync(matrixPath, 'utf8'))
  const v3Entries = matrix.migrations
  const equivalent = v3Entries.filter((entry) => entry.production?.status === 'exact_statement_match')
  const pending = v3Entries.filter((entry) => entry.production?.status === 'not_recorded')
  const suffix = manifest.releaseMatrix.requiredSuffix
  const suffixStart = matrix.productionOrder.length - suffix.length
  const actualSuffix = matrix.productionOrder.slice(suffixStart)
  const matrixConsistent = v3Entries.length === manifest.releaseMatrix.v3Count
    && equivalent.length === manifest.releaseMatrix.productionEquivalentCount
    && pending.length === manifest.releaseMatrix.productionPendingCount
    && JSON.stringify(actualSuffix) === JSON.stringify(suffix)
    && JSON.stringify(v3Entries.map(({ file }) => file).concat(path.basename(matrix.p0.file)))
      === JSON.stringify(matrix.productionOrder)
  if (!matrixConsistent) {
    fail('release_matrix', 'V3 migration counts, Production statuses, or release order differ from the vNext contract.')
  } else checks.push(pass('release_matrix'))

  const protectedFiles = git(root, [
    'ls-tree', '-r', '--name-only', manifest.historicalV6.referenceCommit,
    '--', 'scripts/client-portal',
  ])?.split(/\r?\n/u).filter((file) => file && /(?:v6|V6)/u.test(file)) ?? []
  const v6Untouched = manifest.historicalV6.preserveWorkingTreeBlobs === true
    && manifest.historicalV6.legacyGateStatus === 'NOT_CERTIFIED_BY_VNEXT'
    && protectedFiles.length > 0
    && protectedFiles.every((file) => {
      const expected = readGitBytes(root, manifest.historicalV6.referenceCommit, file)
      const actualPath = path.join(root, file)
      return expected && existsSync(actualPath) && readFileSync(actualPath).equals(expected)
    })
  if (!v6Untouched) fail('historical_v6_preservation', 'A V6-named artifact differs from the authorized reference commit.')
  else checks.push(pass('historical_v6_preservation'))

  if (manifest.effects.network !== false
    || manifest.effects.databaseReadsOrWrites !== false
    || manifest.effects.migrationExecution !== false
    || manifest.effects.deployment !== false) {
    fail('read_only_contract', 'The vNext harness must remain local and read-only.')
  } else checks.push(pass('read_only_contract'))

  return {
    id: manifest.id,
    status: errors.length ? 'FAIL' : 'PASS',
    checks,
    errors,
    legacyV6Gate: 'NOT_CERTIFIED_BY_VNEXT',
    effects: manifest.effects,
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = certifyQaBaselineVNext()
  for (const check of result.checks) {
    console.log(`${check.status} ${check.name}${check.message ? `: ${check.message}` : ''}`)
  }
  console.log(`VNEXT_CERTIFICATION=${result.status}`)
  if (result.status !== 'PASS') process.exitCode = 1
}
