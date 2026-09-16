import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import {
  buildExecutorPrompt,
  buildReviewerInstruction,
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

function terminateProcessTree(child) {
  if (!child?.pid) return
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'ignore',
      windowsHide: true,
    })
    return
  }
  child.kill('SIGTERM')
}

function compactProcessOutput(value) {
  const text = String(value || '').trim()
  if (text.length <= 4_000) return text
  return `${text.slice(0, 4_000)}\n...[truncated]`
}

async function runCodex({ prompt, stdin = '', sandbox, outputPath, model, timeoutMs }) {
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
      env: process.env,
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

    const executionOutputPath = path.join(runDir, `iteration-${iteration}-execution-output.md`)
    await runCodex({
      prompt: buildExecutorPrompt(review.next_prompt, iteration, options.maxIterations),
      sandbox: 'workspace-write',
      outputPath: executionOutputPath,
      model: options.model,
      timeoutMs: options.executionTimeoutMs,
    })

    const executionOutput = fs.readFileSync(executionOutputPath, 'utf8')
    if (detectSensitiveContent(executionOutput)) {
      throw new Error('Execution output contains a suspected secret; continuation aborted before the next review.')
    }

    iterationRecord.executionOutput = path.relative(repoRoot, executionOutputPath)
    writeJson(path.join(runDir, 'manifest.json'), manifest)
    currentOutputPath = executionOutputPath
  }

  manifest.finishedAt = new Date().toISOString()
  manifest.finalVerdict = 'stop'
  manifest.stopReason = `maximum iterations reached (${options.maxIterations})`
  writeJson(path.join(runDir, 'manifest.json'), manifest)
  process.stdout.write(`STOP: maximum iterations reached (${options.maxIterations}).\nArtifacts: ${runDir}\n`)
}

try {
  await main()
} catch (error) {
  process.stderr.write(`PROJECT CONTINUATION STOPPED: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
