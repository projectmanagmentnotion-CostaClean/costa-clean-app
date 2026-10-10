import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { classifyChangeSet, collectChanges } from './classify-change-risk.mjs'
import { fastDeliveryPlan } from './fast-delivery-plan.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const baseIndex = process.argv.indexOf('--base')
const base = baseIndex < 0 ? '' : process.argv[baseIndex + 1]
if (!base) throw new Error('FAST_DELIVERY_REQUIRES_EXPLICIT_BASE_SHA')
const changes = collectChanges(base)
const classification = classifyChangeSet(changes)
if (classification.level === 'L3') throw new Error('L3_CHANGE_BLOCKED_FROM_FAST_DELIVERY')
if (classification.level === 'NO_CHANGES') throw new Error('NO_CHANGES_TO_VALIDATE')

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', windowsHide: true })
  if (result.error || result.status !== 0) throw new Error(`FAST_GATE_FAILED:${command}:${args[0]}`)
}

function runFullSuiteWithBasePolicy() {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'costa-clean-fast-suite-'))
  const report = path.join(tempDir, 'vitest-results.json')
  try {
    const vitest = path.join(root, 'node_modules', 'vitest', 'vitest.mjs')
    const suite = spawnSync(process.execPath, [vitest, 'run', '--config', 'vitest.config.mjs', '--reporter=json', `--outputFile=${report}`], {
      cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024,
    })
    if (!report || !readFileSync(report, 'utf8')) throw new Error('VITEST_REPORT_MISSING')
    const result = spawnSync(process.execPath, [
      path.join(root, 'scripts/release/verify-test-baseline.mjs'),
      '--base', base, '--report', report,
      ...changedFiles.flatMap((file) => ['--changed', file]),
    ], { cwd: root, encoding: 'utf8', windowsHide: true })
    if (result.stdout) process.stdout.write(result.stdout)
    if (result.status !== 0) throw new Error(`FULL_SUITE_REJECTED:${result.stderr.trim()}`)
    if (suite.error) throw suite.error
    if (suite.signal || ![0, 1].includes(suite.status)) throw new Error('VITEST_PROCESS_DID_NOT_COMPLETE_NORMALLY')
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

const changedFiles = changes.map(({ path: file }) => file)
const relatedTests = new Set()
for (const changedFile of changedFiles) {
  if (/^scripts\/client-portal\/(?:run-cp3b2a-qa-v6\.mjs|cp3b2a_qa_.*v6|cp3b2aV6RealAdapter\.test\.mjs|cp3b2aQaApplicationV6\.test\.mjs)/iu.test(changedFile)) {
    relatedTests.add('scripts/client-portal/cp3b2aV6RealAdapter.test.mjs')
    relatedTests.add('scripts/client-portal/cp3b2aQaApplicationV6.test.mjs')
  }
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(changedFile)) relatedTests.add(changedFile)
  const extension = path.extname(changedFile)
  const stem = changedFile.slice(0, -extension.length)
  for (const testExtension of ['.test.ts', '.test.tsx', '.test.js', '.test.jsx', '.spec.ts', '.spec.tsx', '.spec.js', '.spec.jsx']) {
    const candidate = `${stem}${testExtension}`
    if (changes.some(({ path: file }) => file === candidate) || spawnSync('git', ['cat-file', '-e', `${base}:${candidate}`], { cwd: root, windowsHide: true }).status === 0) {
      relatedTests.add(candidate)
    }
  }
}

const plan = fastDeliveryPlan(classification.level, [...relatedTests])
run('npm', ['run', 'lint'])
run('npm', ['run', 'build'])
if (plan.testMode === 'RELATED') {
  run('npx', ['vitest', 'run', '--config', 'vitest.config.mjs', ...plan.tests])
  process.stdout.write(`FAST_TEST_SCOPE=RELATED (${plan.tests.length} files)\n`)
} else if (plan.testMode === 'NONE') {
  process.stdout.write('FAST_TEST_SCOPE=NO_RELATED_TESTS\n')
} else {
  runFullSuiteWithBasePolicy()
  process.stdout.write('FAST_TEST_SCOPE=FULL_SUITE\n')
}
process.stdout.write(`DELIVERY_CLASS=${classification.level}\n`)
