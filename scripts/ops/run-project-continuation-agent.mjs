import { spawnSync } from 'node:child_process'
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

function parseArgs(argv) {
  const options = { execute: false, maxIterations: 1, input: '', model: process.env.PROJECT_CONTINUATION_MODEL || DEFAULT_MODEL }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--execute') options.execute = true
    else if (arg === '--input') options.input = argv[++index] ?? ''
    else if (arg === '--max-iterations') options.maxIterations = Number(argv[++index])
    else if (arg === '--model') options.model = argv[++index] ?? ''
    else throw new Error(`Unsupported argument: ${arg}`)
  }
  if (!options.input) throw new Error('Use --input <sprint-output-file>.')
  if (!Number.isInteger(options.maxIterations) || options.maxIterations < 1 || options.maxIterations > 10) {
    throw new Error('--max-iterations must be an integer from 1 to 10.')
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

function runCodex({ prompt, stdin = '', sandbox, outputPath, model }) {
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

  const result = spawnSync(invocation.command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    input: stdin,
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: false,
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`codex exec failed (${result.status}): ${(result.stderr || result.stdout || '').trim()}`)
  }
}

function createRunDirectory() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const runDir = path.join(privateRoot, stamp)
  fs.mkdirSync(runDir, { recursive: true })
  return runDir
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  let currentOutputPath = resolveInsideRepo(options.input)
  if (!fs.existsSync(currentOutputPath)) throw new Error(`Input not found: ${currentOutputPath}`)

  const runDir = createRunDirectory()
  const manifest = { startedAt: new Date().toISOString(), execute: options.execute, model: options.model, iterations: [] }

  for (let iteration = 1; iteration <= options.maxIterations; iteration += 1) {
    const sprintOutput = fs.readFileSync(currentOutputPath, 'utf8')
    if (detectSensitiveContent(sprintOutput)) throw new Error('Input contains a suspected secret; review aborted.')

    const reviewPath = path.join(runDir, `iteration-${iteration}-review.json`)
    runCodex({
      prompt: buildReviewerInstruction(),
      stdin: sprintOutput,
      sandbox: 'read-only',
      outputPath: reviewPath,
      model: options.model,
    })

    const review = validateReview(JSON.parse(fs.readFileSync(reviewPath, 'utf8')))
    const iterationRecord = { iteration, input: path.relative(repoRoot, currentOutputPath), verdict: review.verdict, review: path.relative(repoRoot, reviewPath) }
    manifest.iterations.push(iterationRecord)
    writeJson(path.join(runDir, 'manifest.json'), manifest)

    if (review.verdict !== 'continue') {
      process.stdout.write(`${review.verdict.toUpperCase()}: ${review.stop_reason}\nReview: ${reviewPath}\n`)
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
    runCodex({
      prompt: buildExecutorPrompt(review.next_prompt, iteration, options.maxIterations),
      sandbox: 'workspace-write',
      outputPath: executionOutputPath,
      model: options.model,
    })
    iterationRecord.executionOutput = path.relative(repoRoot, executionOutputPath)
    writeJson(path.join(runDir, 'manifest.json'), manifest)
    currentOutputPath = executionOutputPath
  }

  process.stdout.write(`STOP: maximum iterations reached (${options.maxIterations}).\nArtifacts: ${runDir}\n`)
}

try {
  main()
} catch (error) {
  process.stderr.write(`PROJECT CONTINUATION STOPPED: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
