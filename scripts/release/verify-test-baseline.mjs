import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const baselineBytes = readFileSync(path.join(root, 'docs/release/known-test-baseline.json'))
const baseline = JSON.parse(baselineBytes.toString('utf8'))
const TRUSTED_BASELINE_SHA256 = '43067b3bea667c1a957f20eec6788cdc5422c4b94acbb44b3ba70083abb0c4af'
if (createHash('sha256').update(baselineBytes).digest('hex') !== TRUSTED_BASELINE_SHA256) {
  throw new Error('TEST_BASELINE_POLICY_FILE_TAMPERED')
}

function git(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true })
  return result.status === 0 ? result.stdout.trim() : ''
}

export function verifyBaselineFailures({ base, changedPaths, results, baselineData = baseline, gitBlob = (pathName) => git(['rev-parse', `${base}:${pathName}`]), workingBlob = (pathName) => git(['hash-object', '--no-filters', '--', pathName]) }) {
  if (base !== baselineData.baseSha) return { pass: false, reason: 'BASE_SHA_NOT_ALLOWLISTED' }
  if (!Array.isArray(results.testResults) || !Array.isArray(results.unhandledErrors)
    || !Number.isInteger(results.numFailedTests) || !Number.isInteger(results.numFailedTestSuites)
    || !Number.isInteger(results.numTotalTests) || !Number.isInteger(results.numPassedTests)
    || typeof results.success !== 'boolean'
    || results.testResults.some((suite) => !Array.isArray(suite.assertionResults)
      || !['passed', 'failed', 'skipped'].includes(suite.status)
      || suite.assertionResults.some((test) => !['passed', 'failed', 'skipped', 'todo'].includes(test.status)))) {
    return { pass: false, reason: 'VITEST_REPORT_INCOMPLETE' }
  }
  if (Array.isArray(results.unhandledErrors) && results.unhandledErrors.length > 0) {
    return { pass: false, reason: 'UNHANDLED_TEST_RUN_ERRORS' }
  }
  const failures = (results.testResults ?? []).flatMap((suite) => suite.assertionResults ?? [])
    .filter((test) => test.status === 'failed').map((test) => test.fullName)
  const assertions = results.testResults.flatMap((suite) => suite.assertionResults)
  const passedAssertions = assertions.filter((test) => test.status === 'passed').length
  const failedAssertions = assertions.filter((test) => test.status === 'failed').length
  const failedAssertionSuites = results.testResults.filter((suite) => suite.assertionResults.some((test) => test.status === 'failed'))
  if (assertions.length === 0 || results.numTotalTests !== assertions.length
    || results.numPassedTests !== passedAssertions || results.numFailedTests !== failedAssertions
    || results.numFailedTestSuites !== failedAssertionSuites.length) {
    return { pass: false, reason: 'VITEST_ASSERTION_TOTALS_INCONSISTENT' }
  }
  if (results.testResults.some((suite) => (suite.status === 'failed') !== suite.assertionResults.some((test) => test.status === 'failed'))) {
    return { pass: false, reason: 'VITEST_SUITE_ASSERTION_STATUS_INCONSISTENT' }
  }
  const failedSuites = (results.testResults ?? []).filter((suite) => suite.status === 'failed')
  if (results.numFailedTestSuites !== undefined && results.numFailedTestSuites !== failedSuites.length) {
    return { pass: false, reason: 'VITEST_SUITE_REPORT_INCONSISTENT' }
  }
  if (failedSuites.some((suite) => suite.errors?.length || suite.tasks?.some((task) => task.result?.state === 'fail' && task.type !== 'test'))) {
    return { pass: false, reason: 'UNEXPECTED_SUITE_LEVEL_FAILURE' }
  }
  if (results.numFailedTests !== failures.length || results.success !== (failures.length === 0)) {
    return { pass: false, reason: 'VITEST_REPORT_INCONSISTENT' }
  }
  if (results.numFailedTests !== undefined && results.numFailedTests !== failures.length) {
    return { pass: false, reason: 'VITEST_REPORT_INCONSISTENT' }
  }
  if (results.success === false && failures.length === 0) {
    return { pass: false, reason: 'VITEST_RUN_FAILED_WITHOUT_TEST_EVIDENCE' }
  }
  if (failures.length === 0) return { pass: true, exempted: [] }
  const criticalTestsTouched = changedPaths.some((file) =>
    /(?:^|\/)cp3b2a(?:QaApplicationV6|V6RealAdapter|CanonicalJsonV6|_qa_.*v6)|run-cp3b2a-qa-v6\.mjs$/iu.test(file))
  if (criticalTestsTouched) return { pass: false, reason: 'RELATED_CP3B_FILES_CHANGED' }
  const allowed = new Map(baselineData.allowedFailures.map((entry) => [entry.fullName, entry]))
  const unmatched = failures.filter((fullName) => !allowed.has(fullName))
  if (unmatched.length) return { pass: false, reason: 'NEW_OR_UNEXPECTED_FAILURES', failures: unmatched }
  for (const entry of allowed.values()) {
    if (!failures.includes(entry.fullName)) continue
    if (gitBlob(entry.testPath) !== entry.testGitBlob
      || gitBlob(entry.runnerPath) !== entry.runnerGitBlob
      || workingBlob(entry.testPath) !== entry.testGitBlob
      || workingBlob(entry.runnerPath) !== entry.runnerGitBlob) {
      return { pass: false, reason: 'BASELINE_ARTIFACT_CHANGED', failure: entry.fullName }
    }
  }
  return { pass: true, exempted: failures }
}

function parseArgs(args) {
  const parsed = { base: '', report: '', changed: [] }
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--base') parsed.base = args[++i] ?? ''
    else if (args[i] === '--report') parsed.report = args[++i] ?? ''
    else if (args[i] === '--changed') parsed.changed.push(args[++i] ?? '')
    else throw new Error(`UNKNOWN_ARGUMENT:${args[i]}`)
  }
  if (!parsed.base || !parsed.report) throw new Error('BASE_AND_REPORT_REQUIRED')
  return parsed
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { base, report, changed } = parseArgs(process.argv.slice(2))
  const result = verifyBaselineFailures({
    base,
    changedPaths: changed,
    results: JSON.parse(readFileSync(path.resolve(report), 'utf8')),
  })
  if (!result.pass) {
    process.stderr.write(`TEST_BASELINE_REJECTED=${result.reason}${result.failures ? `:${result.failures.join('|')}` : ''}\n`)
    process.exitCode = 1
  } else {
    process.stdout.write(`TEST_BASELINE_VERIFIED=${result.exempted.length ? result.exempted.join('|') : 'NO_FAILURES'}\n`)
  }
}
