import { spawn, spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import {
  assertCleanInitialWorktree,
  assertCleanPublicationSecretScan,
  assertPublicationIndependentReview,
  assertPublicationTreeIntegrity,
  assertPublicationValidationResults,
  buildSafePublicationRefspec,
  buildExecutorPrompt,
  PUBLICATION_LIFECYCLE,
  buildReviewerInstruction,
  detectSensitiveCategories,
  findSensitiveCandidateContents,
  detectSensitiveContent,
  validatePromptShape,
  validateReview,
} from './projectContinuationAgentCore.mjs'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const schemaPath = path.join(scriptDir, 'project-continuation-review.schema.json')
const privateRoot = path.join(repoRoot, '.project-agent', 'private')
const DEFAULT_MODEL = 'gpt-5.6-sol'
const DEFAULT_REVIEW_TIMEOUT_MS = 600_000
const DEFAULT_EXECUTION_TIMEOUT_MS = 1_800_000
const DEFAULT_CONTINUOUS_ITERATIONS = 10
const VALIDATION_TERMINATION_GRACE_MS = 5_000
// Git's environment namespace can alter repository discovery, refs, config, and
// transport. Controlled publication deliberately inherits none of it.
const GIT_IDENTITY_OVERRIDE_ENV = /^GIT_/
const GIT_CONFIG_OVERRIDE_ENV = /^GIT_CONFIG(?:_(?:COUNT|KEY_\d+|VALUE_\d+))?$/

function sanitizedGitEnvironment() {
  const env = { ...process.env }
  for (const name of Object.keys(env)) {
    if (GIT_IDENTITY_OVERRIDE_ENV.test(name)) delete env[name]
  }
  return env
}

function repositoryGitEnvironment(overrides = {}) {
  const environment = { ...sanitizedGitEnvironment(), ...overrides }
  for (const name of Object.keys(environment)) {
    if (GIT_CONFIG_OVERRIDE_ENV.test(name)) delete environment[name]
  }
  environment.GIT_CONFIG_COUNT = '1'
  environment.GIT_CONFIG_KEY_0 = 'safe.directory'
  environment.GIT_CONFIG_VALUE_0 = repoRoot.replace(/\\/g, '/')
  return environment
}

const PUBLICATION_VALIDATIONS = Object.freeze([
  { name: 'tests', command: process.platform === 'win32' ? 'npm.cmd' : 'npm', args: ['test'], timeoutMs: 900_000 },
  { name: 'agents', command: process.platform === 'win32' ? 'npm.cmd' : 'npm', args: ['run', 'qa:agents'], timeoutMs: 300_000 },
  { name: 'lint', command: process.platform === 'win32' ? 'npm.cmd' : 'npm', args: ['run', 'lint'], timeoutMs: 600_000 },
  { name: 'build', command: process.platform === 'win32' ? 'npm.cmd' : 'npm', args: ['run', 'build'], timeoutMs: 900_000 },
  { name: 'diffCheck', command: 'git', args: ['diff', '--check'], timeoutMs: 120_000 },
])

function parseIntegerOption(label, raw, { min, max }) {
  const value = Number(raw)
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be an integer from ${min} to ${max}.`)
  }
  return value
}

function parseArgs(argv) {
  const options = {
    execute: false,
    continuous: false,
    bootstrap: false,
    maxIterations: 1,
    maxIterationsExplicit: false,
    input: '',
    model: process.env.PROJECT_CONTINUATION_MODEL || DEFAULT_MODEL,
    reviewTimeoutMs: Number(process.env.PROJECT_CONTINUATION_REVIEW_TIMEOUT_MS || DEFAULT_REVIEW_TIMEOUT_MS),
    executionTimeoutMs: Number(process.env.PROJECT_CONTINUATION_EXECUTION_TIMEOUT_MS || DEFAULT_EXECUTION_TIMEOUT_MS),
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--execute') options.execute = true
    else if (arg === '--continuous') {
      options.continuous = true
      options.execute = true
    } else if (arg === '--bootstrap') options.bootstrap = true
    else if (arg === '--input') options.input = argv[++index] ?? ''
    else if (arg === '--max-iterations') {
      options.maxIterations = Number(argv[++index])
      options.maxIterationsExplicit = true
    } else if (arg === '--model') options.model = argv[++index] ?? ''
    else if (arg === '--review-timeout-ms') options.reviewTimeoutMs = Number(argv[++index])
    else if (arg === '--execution-timeout-ms') options.executionTimeoutMs = Number(argv[++index])
    else throw new Error(`Unsupported argument: ${arg}`)
  }

  if (options.continuous && !options.maxIterationsExplicit) {
    options.maxIterations = DEFAULT_CONTINUOUS_ITERATIONS
  }
  options.maxIterations = parseIntegerOption('--max-iterations', options.maxIterations, { min: 1, max: 10 })
  options.reviewTimeoutMs = parseIntegerOption('--review-timeout-ms', options.reviewTimeoutMs, { min: 30_000, max: 900_000 })
  options.executionTimeoutMs = parseIntegerOption('--execution-timeout-ms', options.executionTimeoutMs, { min: 60_000, max: 7_200_000 })

  if (!options.input && !options.bootstrap) {
    throw new Error('Use --input <sprint-output-file> or --bootstrap.')
  }
  if (options.input && options.bootstrap) {
    throw new Error('Use either --input or --bootstrap, not both.')
  }
  if (options.execute && process.env.PROJECT_CONTINUATION_ALLOW_EXEC !== '1') {
    throw new Error('Automatic execution requires PROJECT_CONTINUATION_ALLOW_EXEC=1 at launch.')
  }
  return options
}

function resolveInsideRepo(candidate) {
  const resolved = path.resolve(repoRoot, candidate)
  const relative = path.relative(repoRoot, resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Input must stay inside the repository.')
  return resolved
}

function resolveCodexInvocation() {
  const configured = process.env.CODEX_CLI_PATH
  const bundledExe = process.env.USERPROFILE
    ? path.join(process.env.USERPROFILE, '.codex', 'plugins', '.plugin-appserver', 'codex.exe')
    : ''
  const defaultJs = process.env.APPDATA
    ? path.join(process.env.APPDATA, 'npm', 'node_modules', '@openai', 'codex', 'bin', 'codex.js')
    : ''
  const target = configured ? path.resolve(configured) : bundledExe
  if (target && fs.existsSync(target)) {
    return target.endsWith('.js')
      ? { command: process.execPath, prefixArgs: [target] }
      : { command: target, prefixArgs: [] }
  }
  if (defaultJs && fs.existsSync(defaultJs)) return { command: process.execPath, prefixArgs: [defaultJs] }
  return { command: 'codex', prefixArgs: [] }
}

export function terminateProcessTree(child, dependencies = {}) {
  if (!child?.pid) return Promise.resolve({ attempted: false, terminated: false })
  const platform = dependencies.platform ?? process.platform
  const spawnProcess = dependencies.spawn ?? spawn
  const cwd = dependencies.cwd ?? repoRoot
  const graceMs = dependencies.graceMs ?? VALIDATION_TERMINATION_GRACE_MS
  if (platform !== 'win32') {
    try {
      process.kill(-child.pid, 'SIGKILL')
    } catch {
      child.kill('SIGKILL')
    }
    return Promise.resolve({ attempted: true, terminated: true })
  }

  return new Promise((resolve) => {
    let settled = false
    let killerTimer
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(killerTimer)
      resolve({ attempted: true, terminated: true })
    }
    try {
      const killer = spawnProcess('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        cwd,
        stdio: 'ignore',
        windowsHide: true,
      })
      killer.on('error', () => {
        try { child.kill?.('SIGKILL') } catch {}
        finish()
      })
      killer.on('close', finish)
      killerTimer = setTimeout(() => {
        killer.kill('SIGKILL')
        finish()
      }, graceMs)
    } catch {
      try { child.kill?.('SIGKILL') } catch {}
      finish()
    }
  })
}

function resolveSafePublicationRefspec() {
  const symbolicRef = spawnSync('git', ['symbolic-ref', '--quiet', '--short', 'HEAD'], {
    cwd: repoRoot, encoding: 'utf8', windowsHide: true, env: repositoryGitEnvironment(),
  })
  return buildSafePublicationRefspec(symbolicRef)
}

function gitOutput(args) {
  const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8', windowsHide: true, env: repositoryGitEnvironment() })
  if (result.status !== 0) throw new Error(`Controlled Git command failed: git ${args.join(' ')}`)
  return String(result.stdout ?? '')
}

function gitResult(args) {
  return spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8', windowsHide: true, env: repositoryGitEnvironment() })
}

function nullDelimitedPaths(output) {
  return String(output ?? '').split('\0').filter(Boolean)
}

function candidatePath(relativePath) {
  const absolutePath = path.resolve(repoRoot, relativePath)
  const relative = path.relative(repoRoot, absolutePath)
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Automatic publication blocked: Git returned an unsafe candidate path.')
  return absolutePath
}

function hashContent(content) {
  return crypto.createHash('sha256').update(content).digest('hex')
}

function collectPublicationCandidates() {
  const tracked = nullDelimitedPaths(gitOutput(['diff', '--name-only', '-z', 'HEAD']))
  const untracked = nullDelimitedPaths(gitOutput(['ls-files', '--others', '--exclude-standard', '-z']))
  const names = [...new Set([...tracked, ...untracked])].sort((left, right) => left.localeCompare(right))
  return names.map((relativePath) => {
    const absolutePath = candidatePath(relativePath)
    if (!fs.existsSync(absolutePath)) return { path: relativePath, kind: 'deleted', digest: '' }
    const content = fs.readFileSync(absolutePath)
    return { path: relativePath, kind: 'present', digest: hashContent(content), content }
  })
}

function scanPublicationCandidates(candidates) {
  return findSensitiveCandidateContents(candidates.map((candidate) => ({
    ...candidate,
    content: candidate.kind === 'present' ? candidate.content.toString('utf8') : '',
  })))
}

function publicationCandidateFingerprint(candidates) {
  return JSON.stringify(candidates.map(({ path: candidatePath, kind, digest }) => ({ path: candidatePath, kind, digest })))
}

function assertReviewedCandidatesUnchanged(reviewedCandidates) {
  const currentCandidates = collectPublicationCandidates()
  if (publicationCandidateFingerprint(reviewedCandidates) !== publicationCandidateFingerprint(currentCandidates)) {
    throw new Error('Automatic publication blocked: reviewed candidate file set changed before staging.')
  }
}

function assertStagedCandidatesMatch(reviewedCandidates) {
  const stagedPaths = nullDelimitedPaths(gitOutput(['diff', '--cached', '--name-only', '-z'])).sort((left, right) => left.localeCompare(right))
  const reviewedPaths = reviewedCandidates.map(({ path: candidatePath }) => candidatePath)
  if (JSON.stringify(stagedPaths) !== JSON.stringify(reviewedPaths)) {
    throw new Error('Automatic publication blocked: staged file set differs from the independently reviewed candidate set.')
  }

  const findings = []
  for (const candidate of reviewedCandidates) {
    if (candidate.kind === 'deleted') continue
    const result = spawnSync('git', ['show', `:${candidate.path}`], {
      cwd: repoRoot,
      windowsHide: true,
      env: repositoryGitEnvironment(),
    })
    if (result.status !== 0 || !Buffer.isBuffer(result.stdout) || hashContent(result.stdout) !== candidate.digest) {
      throw new Error('Automatic publication blocked: staged content differs from the independently reviewed candidate set.')
    }
    for (const category of detectSensitiveCategories(result.stdout.toString('utf8'))) {
      findings.push({ path: candidate.path, category })
    }
  }
  assertCleanPublicationSecretScan(findings)
}

export async function runManagedValidation({
  command,
  args,
  timeoutMs,
  env = sanitizedGitEnvironment(),
  spawnProcess = spawn,
  terminate = terminateProcessTree,
}) {
  const managedEnvironment = path.basename(command).toLowerCase() === 'git'
    ? repositoryGitEnvironment(env)
    : env
  return new Promise((resolve) => {
    const startedAt = Date.now()
    let child
    try {
      child = spawnProcess(command, args, {
        cwd: repoRoot,
        env: managedEnvironment,
        windowsHide: true,
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (error) {
      resolve({ status: null, timedOut: false, spawnError: String(error), durationMs: Date.now() - startedAt, stdout: '', stderr: '' })
      return
    }

    let stdout = ''
    let stderr = ''
    let timedOut = false
    let spawnError = ''
    let settled = false
    let timer
    let terminationTimer
    const finish = (status) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      clearTimeout(terminationTimer)
      resolve({ status, timedOut, spawnError, durationMs: Date.now() - startedAt, stdout, stderr })
    }
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', (error) => {
      spawnError = String(error)
      finish(null)
    })
    child.on('close', (code) => finish(code))
    timer = setTimeout(() => {
      timedOut = true
      void Promise.resolve(terminate(child)).finally(() => finish(null))
      terminationTimer = setTimeout(() => finish(null), VALIDATION_TERMINATION_GRACE_MS)
    }, timeoutMs)
  })
}

function writeValidationLog(runDir, iteration, name, result) {
  const logPath = path.join(runDir, `iteration-${iteration}-validation-${name}.log`)
  fs.writeFileSync(logPath, `${result.stdout}${result.stderr}`, 'utf8')
  return path.relative(repoRoot, logPath)
}

export async function runCandidateDiffCheck(candidates) {
  const tempDirectory = fs.mkdtempSync(path.join(privateRoot, 'candidate-diff-check-'))
  const temporaryIndex = path.join(tempDirectory, 'index')
  const temporaryObjects = path.join(tempDirectory, 'objects')
  const commonDirectory = gitOutput(['rev-parse', '--path-format=absolute', '--git-common-dir']).trim()
  if (!commonDirectory) throw new Error('Automatic publication blocked: Git common directory could not be resolved.')
  fs.mkdirSync(temporaryObjects, { recursive: true })
  const env = repositoryGitEnvironment({
    GIT_INDEX_FILE: temporaryIndex,
    GIT_OBJECT_DIRECTORY: temporaryObjects,
    GIT_ALTERNATE_OBJECT_DIRECTORIES: path.join(commonDirectory, 'objects'),
  })
  const steps = [
    ['read-tree', 'HEAD'],
    ['add', '--all', '--', ...candidates.map(({ path: candidatePath }) => candidatePath)],
    ['diff', '--cached', '--check'],
  ]
  let stdout = ''
  let stderr = ''
  let durationMs = 0
  try {
    for (const args of steps) {
      const result = await runManagedValidation({ command: 'git', args, timeoutMs: 120_000, env })
      stdout += result.stdout
      stderr += result.stderr
      durationMs += result.durationMs
      if (result.timedOut || result.spawnError || result.status !== 0) {
        return {
          status: result.status,
          timedOut: result.timedOut,
          spawnError: result.spawnError,
          durationMs,
          stdout,
          stderr,
        }
      }
    }
    return { status: 0, timedOut: false, spawnError: '', durationMs, stdout, stderr }
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true })
  }
}

export async function runPublicationValidations({ runDir, iteration, candidates }) {
  const results = {}
  for (const validation of PUBLICATION_VALIDATIONS) {
    const result = await runManagedValidation(validation)
    results[validation.name] = {
      status: result.status,
      timedOut: result.timedOut,
      spawnError: result.spawnError || undefined,
      durationMs: result.durationMs,
      log: writeValidationLog(runDir, iteration, validation.name, result),
    }
  }
  const candidateDiffCheck = await runCandidateDiffCheck(candidates)
  results.candidateDiffCheck = {
    status: candidateDiffCheck.status,
    timedOut: candidateDiffCheck.timedOut,
    spawnError: candidateDiffCheck.spawnError || undefined,
    durationMs: candidateDiffCheck.durationMs,
    log: writeValidationLog(runDir, iteration, 'candidate-diff-check', candidateDiffCheck),
  }
  return results
}

function buildPostExecutionReviewerInstruction() {
  return [
    'Act only as the independent post-execution quality gate for the actual current working-tree diff supplied on stdin.',
    'Inspect the repository read-only, changed files, validation evidence, secret-scan summary, branch/publication safety, protected contracts, and scope.',
    'Do not run or suggest publication, deployment, Supabase, production, or business writes.',
    'The isolated workspace-write sandbox exists only for tool caches. Do not alter host Git configuration. Set HOME and USERPROFILE to an ignored review home inside .project-agent/private for non-Git tool caches. Do not weaken Git trust with a wildcard; a frozen child test which strips its environment is a capability blocker unless the sandbox can inject a single exact repository trust setting into that child process. Do not trust any other repository.',
    'Run Supabase CLI checks only with that isolated review home so its telemetry cannot write to the host profile. Do not modify tracked or untracked repository content.',
    'Return verdict "complete" only if the reviewed diff is safe to publish and has no missing evidence or risks; include a concise stop_reason such as "independent publication review passed" to satisfy the structured schema. Otherwise return "stop" or "blocked" with exact findings.',
    'Do not accept prior summaries as evidence; verify the repository state independently.',
  ].join(' ')
}

function buildPostExecutionReviewInput({ iteration, candidates, secretFindings, validationResults }) {
  return [
    '# POST-EXECUTION PUBLICATION GATE',
    '',
    `Iteration: ${iteration}`,
    `Lifecycle: ${PUBLICATION_LIFECYCLE.join(' -> ')}`,
    '',
    'Candidate files:',
    ...candidates.map(({ path: candidatePath }) => `- ${candidatePath}`),
    '',
    'Secret scan findings (paths/categories only):',
    ...(secretFindings.length ? secretFindings.map(({ path: candidatePath, category }) => `- ${candidatePath}: ${category}`) : ['- none']),
    '',
    'Validation status:',
    ...Object.entries(validationResults).map(([name, result]) => `- ${name}: ${result.status === 0 ? 'PASS' : 'FAIL'}`),
    '',
    'The reviewer must inspect the actual current diff rather than trusting this input.',
  ].join('\n')
}

async function runPostExecutionPublicationGate({ runDir, iteration, candidates, model, reviewTimeoutMs }) {
  const secretFindings = scanPublicationCandidates(candidates)
  assertCleanPublicationSecretScan(secretFindings)

  const validationResults = await runPublicationValidations({ runDir, iteration, candidates })
  assertPublicationValidationResults(validationResults)

  const reviewInputPath = path.join(runDir, `iteration-${iteration}-post-execution-review-input.md`)
  fs.writeFileSync(reviewInputPath, `${buildPostExecutionReviewInput({ iteration, candidates, secretFindings, validationResults })}\n`, 'utf8')
  const reviewPath = path.join(runDir, `iteration-${iteration}-post-execution-review.json`)
  await runCodex({
    prompt: buildPostExecutionReviewerInstruction(),
    stdin: fs.readFileSync(reviewInputPath, 'utf8'),
    // Vitest/Vite require workspace-local temporary files while the reviewer is
    // still instructed to remain read-only with respect to repository content.
    sandbox: 'workspace-write',
    outputPath: reviewPath,
    model,
    timeoutMs: reviewTimeoutMs,
  })
  const review = validateReview(JSON.parse(fs.readFileSync(reviewPath, 'utf8')))
  assertPublicationIndependentReview(review)
  return { secretFindings, validationResults, reviewPath }
}

function publishExecutorResult({ iteration, reviewedCandidates }) {
  assertReviewedCandidatesUnchanged(reviewedCandidates)
  const refspecBeforeStage = resolveSafePublicationRefspec()
  gitOutput(['add', '--all'])
  assertStagedCandidatesMatch(reviewedCandidates)
  gitOutput(['diff', '--cached', '--check'])
  const expectedTree = gitOutput(['write-tree']).trim()
  if (!expectedTree) throw new Error('Automatic publication blocked: Git did not produce an expected staged tree.')
  const refspecBeforeCommit = resolveSafePublicationRefspec()
  if (refspecBeforeStage !== refspecBeforeCommit) throw new Error('Automatic publication blocked: branch changed during controlled publication.')
  gitOutput(['commit', '-m', `chore(agents): publish continuation iteration ${iteration}`])
  const committedTree = gitOutput(['rev-parse', 'HEAD^{tree}']).trim()
  assertPublicationTreeIntegrity(expectedTree, committedTree)
  const refspecBeforePush = resolveSafePublicationRefspec()
  if (refspecBeforeStage !== refspecBeforePush) throw new Error('Automatic publication blocked: branch changed during controlled publication.')
  gitOutput(['push', 'origin', refspecBeforePush])
  return { expectedTree, committedTree }
}

function compactProcessOutput(value) {
  const text = String(value || '').trim()
  if (text.length <= 4_000) return text
  return `${text.slice(0, 4_000)}\n...[truncated]`
}

async function runCodex({ prompt, stdin = '', sandbox, outputPath, model, timeoutMs, env = sanitizedGitEnvironment() }) {
  const invocation = resolveCodexInvocation()
  const args = [
    ...invocation.prefixArgs,
    'exec',
    prompt,
    '--ephemeral',
    '--sandbox', sandbox,
    '--model', model,
    '--cd', repoRoot,
    '--output-last-message', outputPath,
    '--color', 'never',
  ]
  if (sandbox === 'read-only') args.push('--output-schema', schemaPath)

  await new Promise((resolve, reject) => {
    const child = spawn(invocation.command, args, {
      cwd: repoRoot,
      env,
      windowsHide: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    let timedOut = false
    let settled = false

    const finish = (callback) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      callback()
    }

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })

    const timer = setTimeout(() => {
      timedOut = true
      terminateProcessTree(child)
    }, timeoutMs)

    child.on('error', (error) => finish(() => reject(error)))
    child.on('close', (code, signal) => finish(() => {
      if (timedOut) {
        reject(new Error(`codex exec timed out after ${timeoutMs}ms (${sandbox}).`))
        return
      }
      if (code !== 0) {
        const detail = compactProcessOutput(stderr || stdout)
        reject(new Error(`codex exec failed (${code ?? signal ?? 'unknown'}): ${detail}`))
        return
      }
      if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
        reject(new Error(`codex exec returned success without a review/output artifact: ${outputPath}`))
        return
      }
      resolve()
    }))

    child.stdin.end(stdin)
  })
}

function createRunDirectory() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const runDir = path.join(privateRoot, stamp)
  fs.mkdirSync(runDir, { recursive: true })
  return runDir
}

function createBootstrapInput(runDir) {
  const bootstrapPath = path.join(runDir, 'bootstrap-input.md')
  const content = [
    '# AUTOPILOT BOOTSTRAP',
    '',
    'No sprint output was supplied. Reconstruct the current project state from the repository itself.',
    'Inspect HEAD, branch, worktree, roadmap, recent certified phases, open findings and validation evidence.',
    'Choose only the next bounded, unlocked, non-production work block that AGENTS.md permits.',
    'If external human input, authentication, production authorization, destructive data work, or an unsafe financial write is required, return a blocked verdict instead of inventing progress.',
    '',
  ].join('\n')
  fs.writeFileSync(bootstrapPath, content, 'utf8')
  return bootstrapPath
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const runDir = createRunDirectory()
  let currentOutputPath = options.bootstrap ? createBootstrapInput(runDir) : resolveInsideRepo(options.input)
  if (!fs.existsSync(currentOutputPath)) throw new Error(`Input not found: ${currentOutputPath}`)

  const manifest = {
    startedAt: new Date().toISOString(),
    execute: options.execute,
    continuous: options.continuous,
    bootstrap: options.bootstrap,
    model: options.model,
    reviewTimeoutMs: options.reviewTimeoutMs,
    executionTimeoutMs: options.executionTimeoutMs,
    maxIterations: options.maxIterations,
    iterations: [],
  }

  for (let iteration = 1; iteration <= options.maxIterations; iteration += 1) {
    const sprintOutput = fs.readFileSync(currentOutputPath, 'utf8')
    if (detectSensitiveContent(sprintOutput)) throw new Error('Input contains a suspected secret; review aborted.')

    const reviewPath = path.join(runDir, `iteration-${iteration}-review.json`)
    await runCodex({
      prompt: buildReviewerInstruction(),
      stdin: sprintOutput,
      sandbox: 'read-only',
      outputPath: reviewPath,
      model: options.model,
      timeoutMs: options.reviewTimeoutMs,
    })

    const review = validateReview(JSON.parse(fs.readFileSync(reviewPath, 'utf8')))
    const iterationRecord = {
      iteration,
      input: path.relative(repoRoot, currentOutputPath),
      verdict: review.verdict,
      qualityScore: review.quality_score,
      review: path.relative(repoRoot, reviewPath),
    }
    manifest.iterations.push(iterationRecord)
    writeJson(path.join(runDir, 'manifest.json'), manifest)

    if (review.verdict !== 'continue') {
      manifest.finishedAt = new Date().toISOString()
      manifest.finalVerdict = review.verdict
      manifest.stopReason = review.stop_reason
      writeJson(path.join(runDir, 'manifest.json'), manifest)
      process.stdout.write(`${review.verdict.toUpperCase()}: ${review.stop_reason}\nReview: ${reviewPath}\nArtifacts: ${runDir}\n`)
      return
    }

    validatePromptShape(review.next_prompt)
    const nextPromptPath = path.join(runDir, `iteration-${iteration}-next-prompt.md`)
    fs.writeFileSync(nextPromptPath, `${review.next_prompt.trim()}\n`, 'utf8')
    iterationRecord.nextPrompt = path.relative(repoRoot, nextPromptPath)

    if (!options.execute) {
      writeJson(path.join(runDir, 'manifest.json'), manifest)
      process.stdout.write(`NEXT PROMPT READY: ${nextPromptPath}\n`)
      return
    }

    const publicationEnabled = process.env.PROJECT_CONTINUATION_ALLOW_GIT_PUBLICATION === '1'
    if (options.execute) {
      assertCleanInitialWorktree(gitResult(['status', '--porcelain']))
    }
    if (publicationEnabled) resolveSafePublicationRefspec()

    const executionOutputPath = path.join(runDir, `iteration-${iteration}-execution-output.md`)
    await runCodex({
      prompt: buildExecutorPrompt(review.next_prompt, iteration, options.maxIterations),
      sandbox: 'workspace-write',
      outputPath: executionOutputPath,
      model: options.model,
      timeoutMs: options.executionTimeoutMs,
      env: publicationEnabled
        ? { ...sanitizedGitEnvironment(), PROJECT_CONTINUATION_ALLOW_GIT_PUBLICATION: '0', PROJECT_CONTINUATION_RUNNER_MANAGED_PUBLICATION: '1' }
        : process.env,
    })

    const executionOutput = fs.readFileSync(executionOutputPath, 'utf8')
    if (detectSensitiveContent(executionOutput)) {
      throw new Error('Execution output contains a suspected secret; continuation aborted before the next review.')
    }

    iterationRecord.executionOutput = path.relative(repoRoot, executionOutputPath)
    if (publicationEnabled) {
      const candidates = collectPublicationCandidates()
      if (candidates.length === 0) {
        iterationRecord.publicationGate = { lifecycle: PUBLICATION_LIFECYCLE, candidates: [], publication: 'not-required-no-changes' }
        writeJson(path.join(runDir, 'manifest.json'), manifest)
        currentOutputPath = executionOutputPath
        continue
      }
      const publicationGate = await runPostExecutionPublicationGate({
        runDir,
        iteration,
        candidates,
        model: options.model,
        reviewTimeoutMs: options.reviewTimeoutMs,
      })
      iterationRecord.publicationGate = {
        lifecycle: PUBLICATION_LIFECYCLE,
        candidates: candidates.map(({ path: candidatePath }) => candidatePath),
        secretFindings: publicationGate.secretFindings,
        validationResults: publicationGate.validationResults,
        review: path.relative(repoRoot, publicationGate.reviewPath),
      }
      const publication = publishExecutorResult({ iteration, reviewedCandidates: candidates })
      iterationRecord.publicationGate.expectedTree = publication.expectedTree
      iterationRecord.publicationGate.committedTree = publication.committedTree
    }
    writeJson(path.join(runDir, 'manifest.json'), manifest)
    currentOutputPath = executionOutputPath
  }

  manifest.finishedAt = new Date().toISOString()
  manifest.finalVerdict = 'stop'
  manifest.stopReason = `maximum iterations reached (${options.maxIterations})`
  writeJson(path.join(runDir, 'manifest.json'), manifest)
  process.stdout.write(`STOP: maximum iterations reached (${options.maxIterations}).\nArtifacts: ${runDir}\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main()
  } catch (error) {
    process.stderr.write(`PROJECT CONTINUATION STOPPED: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
