import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyPackageSnapshotV6R1F } from './cp3b2aV6R1FGitIntegrity.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const manifestPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'cp3b2a_qa_package_v6r1f.manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const args = process.argv.slice(2)
const commitAt = args.indexOf('--commit')
const commit = commitAt < 0 ? '' : args[commitAt + 1]
if (args.length !== 2 || commitAt !== 0 || !/^[a-f0-9]{40,64}$/iu.test(commit)) {
  throw new Error('USAGE: node run-cp3b2a-qa-v6r1f-integrity.mjs --commit <sha>')
}

function git(gitArgs, input = null) {
  const result = spawnSync('git', gitArgs, {
    cwd: root, input, encoding: null, windowsHide: true, maxBuffer: 16 * 1024 * 1024,
  })
  return { status: result.status, error: result.error, stdout: result.stdout, stderr: result.stderr }
}

const result = verifyPackageSnapshotV6R1F({
  repoRoot: root,
  authorizedCommit: commit,
  paths: [manifestPath, ...manifest.frozenPackagePaths, ...manifest.artifacts.map(({ path: artifact }) => artifact)],
  git,
})
for (const artifact of manifest.artifacts) {
  const checked = result.checked.find(({ path: checkedPath }) => checkedPath === artifact.path)
  if (!checked || checked.sha256 !== artifact.sha256) {
    throw new Error(`V6R1F_MANIFEST_SHA256_MISMATCH:${artifact.path}`)
  }
}
process.stdout.write(`${JSON.stringify({
  revision: manifest.revision,
  gate: manifest.gate,
  ...result,
}, null, 2)}\n`)
