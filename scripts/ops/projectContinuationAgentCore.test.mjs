import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  assertCleanInitialWorktree,
  assertCleanPublicationSecretScan,
  assertPublicationIndependentReview,
  assertPublicationTreeIntegrity,
  assertPublicationValidationResults,
  assertSafePublicationBranchResolution,
  buildSafePublicationRefspec,
  buildExecutorPrompt,
  detectSensitiveCategories,
  findSensitiveCandidateContents,
  PUBLICATION_LIFECYCLE,
  detectSensitiveContent,
  findAutomaticStopReason,
  isSafePublicationBranch,
  normalizeBranchIdentity,
  validatePromptShape,
  validateReview,
} from './projectContinuationAgentCore.mjs'

const safePrompt = `
# Objective
Fix the isolated UI regression.
# Evidence
The current output reports a reproducible viewport failure.
# Scope
Inspect and adjust the shared overlay.
# Non-goals
Do not alter persistence or routes.
# Acceptance criteria
The CTA remains visible in all required viewports.
# Validation
Run lint, build, tests, and visible QA.
# Stop conditions
Stop if authenticated QA is unavailable.
# Delivery
Report files, evidence, and blockers.
`

const authorizedQaPrompt = `
# Objective
Deploy the reviewed quiz protection to QA and publish the validated repository changes.
# Evidence
The versioned Gate 4B authorization limits work to the approved QA project.
# Scope
Request runner-managed publication after the QA-only deployment passes validation.
# Non-goals
Do not deploy to production or touch financial flows.
# Acceptance criteria
QA is verified and production remains unchanged.
# Validation
Run lint, build, tests, QA probes, and secret scanning.
# Stop conditions
Stop on any production deployment target or missing private provider access.
# Delivery
Report QA evidence, commit, push, and blockers.
`

function withAuthorizedQaCapabilities(callback) {
  const names = [
    'PROJECT_CONTINUATION_ALLOW_GIT_PUBLICATION',
    'PROJECT_CONTINUATION_ALLOW_QA_DEPLOY',
    'PROJECT_CONTINUATION_ALLOW_PRIVATE_PROVIDER_AUTH',
    'PROJECT_CONTINUATION_AUTHORIZED_QA_REF',
    'PROJECT_CONTINUATION_FORBIDDEN_PROD_REF',
  ]
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]))
  process.env.PROJECT_CONTINUATION_ALLOW_GIT_PUBLICATION = '1'
  process.env.PROJECT_CONTINUATION_ALLOW_QA_DEPLOY = '1'
  process.env.PROJECT_CONTINUATION_ALLOW_PRIVATE_PROVIDER_AUTH = '1'
  process.env.PROJECT_CONTINUATION_AUTHORIZED_QA_REF = 'qa-ref'
  process.env.PROJECT_CONTINUATION_FORBIDDEN_PROD_REF = 'prod-ref'
  try {
    return callback()
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name]
      else process.env[name] = previous[name]
    }
  }
}

describe('projectContinuationAgentCore', () => {
  it('accepts a bounded continuation review', () => {
    const review = validateReview({
      verdict: 'continue',
      summary: 'A bounded UI follow-up remains.',
      quality_score: 88,
      verified_evidence: ['lint passed'],
      missing_evidence: ['deployed QA'],
      risks: ['production serves an old build'],
      stop_reason: '',
      next_prompt: safePrompt,
    })
    expect(review.verdict).toBe('continue')
    expect(validatePromptShape(review.next_prompt)).toContain('Acceptance criteria')
  })

  it('requires a reason for non-continuation verdicts', () => {
    expect(() => validateReview({
      verdict: 'blocked',
      summary: 'Blocked.',
      quality_score: 50,
      verified_evidence: [],
      missing_evidence: [],
      risks: [],
      stop_reason: '',
      next_prompt: '',
    })).toThrow('requires stop_reason')
  })

  it('blocks secrets and automatic publication actions by default', () => {
    expect(detectSensitiveContent(['OPENAI', '_API_KEY', '=', 'secret', '-value'].join(''))).toBe(true)
    expect(findAutomaticStopReason('Run git push origin feature/test')).toBe('git-publication-not-automatic')
    expect(findAutomaticStopReason('Deploy the QA build')).toBe('deployment-not-automatic')
    expect(findAutomaticStopReason('Emitir una factura real')).toBe('invoice-emission-not-safe')
  })

  it('permits explicitly authorized QA deployment and feature-branch publication while protecting main', () => {
    withAuthorizedQaCapabilities(() => {
      expect(findAutomaticStopReason('Deploy the QA build and request runner-managed publication.')).toBeNull()
      expect(findAutomaticStopReason('git push origin codex/app-v3-mobile-first-redesign')).toBe('git-publication-not-automatic')
      expect(findAutomaticStopReason('git push origin main')).toBe('protected-branch-publication-not-allowed')
      expect(findAutomaticStopReason('git push origin master')).toBe('protected-branch-publication-not-allowed')
      expect(findAutomaticStopReason('Deploy to production prod-ref')).toBe('production-deployment-not-authorized')
      expect(findAutomaticStopReason('Production deployment to prod-ref is required now')).toBe('production-deployment-not-authorized')
      const prompt = buildExecutorPrompt(authorizedQaPrompt, 1, 3)
      expect(prompt).toContain('QA-only deployment is permitted')
      expect(prompt).toContain('Never run git commit, git push, git switch, git checkout')
      expect(prompt).toContain('outer runner was explicitly launched with publication capability')
      expect(prompt).toContain('Never deploy to production')
      expect(prompt).toContain('qa-ref')
      expect(prompt).toContain('prod-ref')
    })
  })

  it('blocks Git publication commands even when prose says not to use them', () => {
    withAuthorizedQaCapabilities(() => {
      expect(findAutomaticStopReason('Do not git push origin main.')).toBe('git-publication-not-automatic')
      expect(findAutomaticStopReason('Never git push origin master.')).toBe('git-publication-not-automatic')
    })
  })

  it('does not misclassify explicit production prohibitions as deployment requests', () => {
    withAuthorizedQaCapabilities(() => {
      expect(findAutomaticStopReason('Do not deploy to production prod-ref.')).toBeNull()
      expect(findAutomaticStopReason('Never deploy to production.')).toBeNull()
      expect(findAutomaticStopReason('Production deployment is prohibited.')).toBeNull()
      expect(findAutomaticStopReason('Deploy only to QA; production remains unchanged.')).toBeNull()
      expect(findAutomaticStopReason(authorizedQaPrompt)).toBeNull()
    })
  })

  it('allows publication only when Git resolves an explicit Codex feature branch', () => {
    expect(isSafePublicationBranch('codex/app-v3-mobile-first-redesign')).toBe(true)
    expect(assertSafePublicationBranchResolution({ status: 0, stdout: 'codex/app-v3-mobile-first-redesign\n' }))
      .toBe('codex/app-v3-mobile-first-redesign')
    expect(buildSafePublicationRefspec({ status: 0, stdout: 'codex/app-v3-mobile-first-redesign\n' }))
      .toBe('HEAD:refs/heads/codex/app-v3-mobile-first-redesign')
  })

  it.each(['codex/feature', 'codex/app-v3-mobile-first-redesign', 'fix/safe-topic', 'feature/example'])('accepts valid local feature branch %s using Git ref-format', (branch) => {
    expect(isSafePublicationBranch(branch)).toBe(true)
  })

  it.each([
    'main', 'master', 'MAIN', 'Master', 'refs/heads/main', 'refs/heads/master',
    'origin/main', 'origin/master', 'refs/remotes/origin/main', 'refs/remotes/origin/master',
    'codex/.hidden', 'codex/topic.lock', 'codex/@', 'codex/foo..', 'codex/foo.', 'codex/foo/',
    'codex//foo', 'codex/foo@{bar', 'codex/foo\\bar', 'codex/foo bar', 'codex/foo:bar',
    'codex/foo?bar', 'codex/foo*bar', 'codex/foo[bar', '', '   ', 'HEAD',
  ])('rejects protected, remote-qualified, or malformed identity %j', (branch) => {
    expect(isSafePublicationBranch(branch)).toBe(false)
  })

  it.each([
    ['main', { status: 0, stdout: 'main\n' }],
    ['master', { status: 0, stdout: 'master\n' }],
    ['case and whitespace normalized main', { status: 0, stdout: ' MAIN \n' }],
    ['remote-qualified protected branch', { status: 0, stdout: 'refs/remotes/origin/Master\n' }],
    ['empty branch', { status: 0, stdout: '' }],
    ['malformed feature-looking identity', { status: 0, stdout: 'codex/../main\n' }],
    ['feature identity with whitespace', { status: 0, stdout: 'codex/unsafe branch\n' }],
    ['detached HEAD', { status: 1, stdout: '' }],
    ['Git branch detection failure', { status: null, stdout: '' }],
    ['unexpected stdout', { status: 0, stdout: 'codex/feature\nunexpected' }],
  ])('fails closed for %s', (_label, resolution) => {
    expect(() => assertSafePublicationBranchResolution(resolution)).toThrow('Automatic publication blocked')
  })

  it('cannot be overridden by publication environment or generated prompt content', () => {
    const previous = process.env.PROJECT_CONTINUATION_ALLOW_GIT_PUBLICATION
    process.env.PROJECT_CONTINUATION_ALLOW_GIT_PUBLICATION = '1'
    try {
      expect(findAutomaticStopReason('git push origin codex/feature')).toBe('git-publication-not-automatic')
      expect(findAutomaticStopReason('Never git push origin main.\ngit push origin codex/feature')).toBe('git-publication-not-automatic')
      expect(findAutomaticStopReason('git switch main; git push')).toMatch(/protected-branch-publication-not-allowed|git-branch-mutation-not-automatic/)
      expect(() => assertSafePublicationBranchResolution({ status: 0, stdout: 'main\n' }))
        .toThrow('Automatic publication blocked')
    } finally {
      if (previous === undefined) delete process.env.PROJECT_CONTINUATION_ALLOW_GIT_PUBLICATION
      else process.env.PROJECT_CONTINUATION_ALLOW_GIT_PUBLICATION = previous
    }
  })

  it.each([
    ['No tests; git push origin codex/feature', 'git-publication-not-automatic'],
    ['Never deploy; git switch main', 'git-branch-mutation-not-automatic'],
    ['Do not touch prod; git checkout master', 'git-branch-mutation-not-automatic'],
    ['Everything is safe; git commit -am "x"', 'git-publication-not-automatic'],
    ['No production changes; git push', 'git-publication-not-automatic'],
    ['Never deploy to production; git switch codex/feature', 'git-branch-mutation-not-automatic'],
  ])('detects mixed-content executable Git command %j', (text, reason) => {
    expect(findAutomaticStopReason(text)).toBe(reason)
  })

  it.each(['Do not push users into another flow.', 'Commitment remains unchanged.', 'Checkout UX should remain simple.'])('does not false-positive ordinary prose %j', (text) => {
    expect(findAutomaticStopReason(text)).toBeNull()
  })

  it('rejects remote-qualified refs instead of normalizing them into local branches', () => {
    expect(isSafePublicationBranch(' MAIN ')).toBe(false)
    expect(isSafePublicationBranch('refs/heads/Master')).toBe(false)
    expect(isSafePublicationBranch('origin/main')).toBe(false)
    expect(isSafePublicationBranch('')).toBe(false)
    expect(isSafePublicationBranch(null)).toBe(false)
    expect(normalizeBranchIdentity('refs/remotes/origin/CODEX/feature')).toBe('refs/remotes/origin/codex/feature')
  })

  it.each([
    ['tracked modification', { status: 0, stdout: ' M scripts/ops/runner.mjs\0' }],
    ['staged change', { status: 0, stdout: 'M  scripts/ops/runner.mjs\0' }],
    ['untracked file', { status: 0, stdout: '?? artifact.txt\0' }],
    ['merge conflict', { status: 0, stdout: 'UU scripts/ops/runner.mjs\0' }],
    ['Git status failure', { status: 1, stdout: '' }],
  ])('blocks automatic execution from %s', (_label, result) => {
    expect(() => assertCleanInitialWorktree(result)).toThrow('initial worktree must be clean')
  })

  it('allows automatic execution only from an explicitly clean initial worktree', () => {
    expect(() => assertCleanInitialWorktree({ status: 0, stdout: '' })).not.toThrow()
  })

  it('requires every post-execution validation before publication', () => {
    const passing = Object.fromEntries(['tests', 'agents', 'lint', 'build', 'diffCheck', 'candidateDiffCheck'].map((name) => [name, { status: 0 }]))
    expect(() => assertPublicationValidationResults(passing)).not.toThrow()
    for (const name of Object.keys(passing)) {
      const failed = { ...passing, [name]: { status: 1 } }
      expect(() => assertPublicationValidationResults(failed)).toThrow(`required ${name} validation did not pass`)
    }
    expect(() => assertPublicationValidationResults({})).toThrow('required tests validation did not pass')
  })

  it.each(['tests', 'agents', 'lint', 'build', 'diffCheck', 'candidateDiffCheck'])('fails closed with VALIDATION_TIMEOUT for %s', (name) => {
    const results = Object.fromEntries(['tests', 'agents', 'lint', 'build', 'diffCheck', 'candidateDiffCheck'].map((item) => [item, { status: 0, timedOut: item === name }]))
    expect(() => assertPublicationValidationResults(results)).toThrow(`VALIDATION_TIMEOUT (${name})`)
  })

  it('blocks publication on tracked or untracked secret indicators without echoing values', () => {
    const providerToken = ['github', '_pat_', 'abcdefghijklmnopqrstuvwxyz', '_1234567890'].join('')
    const credentialUrl = ['https://', 'user', ':', 'password', '@example.test/repo'].join('')
    expect(detectSensitiveCategories(providerToken)).toContain('provider-access-token')
    expect(detectSensitiveCategories(credentialUrl)).toContain('credential-bearing-url')
    expect(() => assertCleanPublicationSecretScan([{ path: 'tracked.mjs', category: 'provider-access-token' }]))
      .toThrow('candidate changes contain a secret indicator')
    expect(() => assertCleanPublicationSecretScan([{ path: 'untracked.txt', category: 'credential-bearing-url' }]))
      .toThrow('candidate changes contain a secret indicator')
    expect(() => assertCleanPublicationSecretScan([])).not.toThrow()
  })

  it('keeps fake secret material out of the committed test source while detecting it at runtime', () => {
    const source = readFileSync('scripts/ops/projectContinuationAgentCore.test.mjs', 'utf8')
    expect(detectSensitiveCategories(source)).toEqual([])
    expect(detectSensitiveContent(['sk', '-', 'fake', 'token', 'abcdefghijklmnop'].join(''))).toBe(true)
  })

  it('scans dynamically created tracked and untracked candidate content without staging private fixtures', () => {
    const fixtureRoot = mkdtempSync(path.join('.project-agent', 'private', 'publication-secret-'))
    try {
      const trackedPath = path.join(fixtureRoot, 'tracked.txt')
      const untrackedPath = path.join(fixtureRoot, 'untracked.txt')
      writeFileSync(trackedPath, ['OPENAI', '_API_KEY', '=', 'fake', '-value'].join(''), 'utf8')
      writeFileSync(untrackedPath, ['https://', 'user', ':', 'password', '@example.test/private'].join(''), 'utf8')
      const findings = findSensitiveCandidateContents([
        { path: 'tracked.txt', kind: 'present', content: readFileSync(trackedPath, 'utf8') },
        { path: 'untracked.txt', kind: 'present', content: readFileSync(untrackedPath, 'utf8') },
      ])
      expect(findings).toEqual([
        { path: 'tracked.txt', category: 'secret-environment-assignment' },
        { path: 'untracked.txt', category: 'credential-bearing-url' },
      ])
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true })
    }
  })

  it.each([
    ['missing review', undefined],
    ['wrong verdict', { verdict: 'stop', missing_evidence: [], risks: [] }],
    ['missing evidence', { verdict: 'complete', missing_evidence: ['build'], risks: [] }],
    ['review risk', { verdict: 'complete', missing_evidence: [], risks: ['P1'] }],
  ])('blocks publication when the post-execution independent review is %s', (_label, review) => {
    expect(() => assertPublicationIndependentReview(review)).toThrow('post-execution independent review did not pass')
  })

  it('requires a complete independent review with no missing evidence or risks', () => {
    expect(() => assertPublicationIndependentReview({ verdict: 'complete', missing_evidence: [], risks: [] })).not.toThrow()
  })

  it('permits push eligibility only when the committed Git tree equals the reviewed staged tree', () => {
    expect(() => assertPublicationTreeIntegrity('abc123', 'abc123')).not.toThrow()
    expect(() => assertPublicationTreeIntegrity('abc123', 'def456')).toThrow('committed HEAD tree differs')
    expect(() => assertPublicationTreeIntegrity('', 'abc123')).toThrow('committed HEAD tree differs')
  })

  it('documents one non-circular publication lifecycle after execution', () => {
    expect(PUBLICATION_LIFECYCLE).toEqual([
      'planning-review',
      'executor',
      'post-execution-diff-and-secret-scan',
      'post-execution-validation',
      'post-execution-independent-review',
      'publication-boundary-revalidation',
      'stage-commit-push',
    ])
  })

  it('wraps a safe prompt with default automatic execution boundaries', () => {
    const prompt = buildExecutorPrompt(safePrompt, 1, 3)
    expect(prompt).toContain('Never commit or push')
    expect(prompt).toContain('Never deploy')
    expect(prompt).toContain('AUTOMATED PROJECT CONTINUATION 1/3')
  })
})
