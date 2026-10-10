import { describe, expect, it } from 'vitest'
import { verifyBaselineFailures } from './verify-test-baseline.mjs'

const sha = '4dd3530a126dba31d401e64176cdd59f20dc7372'
const name = 'CP-3B.2A.6R.1E final real PostgreSQL adapter revalidates the capability map immediately before consuming it'
const entry = {
  fullName: name,
  testPath: 'test.mjs', testGitBlob: 'a',
  runnerPath: 'runner.mjs', runnerGitBlob: 'b',
}
const allowlisted = { baseSha: sha, allowedFailures: [entry] }
const result = (fullName) => ({
  success: false,
  numTotalTests: 1,
  numPassedTests: 0,
  numFailedTests: 1,
  numFailedTestSuites: 1,
  unhandledErrors: [],
  testResults: [{ status: 'failed', assertionResults: [{ fullName, status: 'failed' }] }],
})
const blobs = (pathName) => pathName === entry.testPath ? 'a' : 'b'

describe('SHA-bound baseline failure policy', () => {
  it('allows only the exact recorded base failure when neither protected artifact changed', () => {
    expect(verifyBaselineFailures({
      base: sha, changedPaths: ['src/features/foo.ts'], results: result(name),
      baselineData: allowlisted, gitBlob: blobs, workingBlob: blobs,
    })).toMatchObject({ pass: true, exempted: [name] })
  })

  it('rejects new failures, touching CP3B files, or a different base SHA', () => {
    const common = { base: sha, changedPaths: [], results: result(name), baselineData: allowlisted, gitBlob: blobs, workingBlob: blobs }
    expect(verifyBaselineFailures({ ...common, results: result('a new failure') }).pass).toBe(false)
    expect(verifyBaselineFailures({ ...common, changedPaths: ['scripts/client-portal/run-cp3b2a-qa-v6.mjs'] }).reason)
      .toBe('RELATED_CP3B_FILES_CHANGED')
    expect(verifyBaselineFailures({ ...common, base: 'a'.repeat(40) }).reason).toBe('BASE_SHA_NOT_ALLOWLISTED')
  })

  it('does not excuse an allowlisted assertion when Vitest reports unhandled or suite-level errors', () => {
    const common = { base: sha, changedPaths: [], results: result(name), baselineData: allowlisted, gitBlob: blobs, workingBlob: blobs }
    expect(verifyBaselineFailures({
      ...common,
      results: { ...result(name), unhandledErrors: [{ message: 'runner crashed' }] },
    }).reason).toBe('UNHANDLED_TEST_RUN_ERRORS')
    expect(verifyBaselineFailures({
      ...common,
      results: {
        ...result(name),
        numFailedTestSuites: 1,
        testResults: [{ status: 'failed', errors: [{ message: 'collection error' }], assertionResults: [{ fullName: name, status: 'failed' }] }],
      },
    }).reason).toBe('UNEXPECTED_SUITE_LEVEL_FAILURE')
    expect(verifyBaselineFailures({
      ...common,
      results: { ...result(name), unhandledErrors: undefined },
    }).reason).toBe('VITEST_REPORT_INCOMPLETE')
    expect(verifyBaselineFailures({
      ...common,
      results: { ...result(name), success: true },
    }).reason).toBe('VITEST_REPORT_INCONSISTENT')
    expect(verifyBaselineFailures({
      ...common,
      results: { ...result(name), numTotalTests: 0, numFailedTests: 0, numFailedTestSuites: 0, success: true, testResults: [] },
    }).reason).toBe('VITEST_ASSERTION_TOTALS_INCONSISTENT')
    expect(verifyBaselineFailures({
      ...common,
      results: { ...result(name), testResults: [{ status: 'passed', assertionResults: [{ fullName: name, status: 'failed' }] }] },
    }).reason).toBe('VITEST_SUITE_ASSERTION_STATUS_INCONSISTENT')
  })
})
