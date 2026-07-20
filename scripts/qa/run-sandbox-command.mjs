import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { assertSandboxPublicConfig } from './qaEnvironmentGuardrails.mjs'

const rootDir = process.cwd()
const envFilePath = path.join(rootDir, '.env.qa.local')
const commandName = process.argv[2]
const supportedCommands = new Set(['preview', 'auth', 'visual', 'dry', 'write-clean'])

if (!supportedCommands.has(commandName)) {
  throw new Error(`Unsupported sandbox command "${commandName}".`)
}

const sandboxFileEnv = parseDotEnv(await fs.readFile(envFilePath, 'utf8').catch(() => {
  throw new Error('Missing .env.qa.local. Create it manually from .env.qa.example.')
}))
const sandboxEnv = {
  ...process.env,
  ...sandboxFileEnv,
  QA_ENV: 'sandbox',
  QA_AUTH_NAMESPACE: 'sandbox',
  QA_APP_URL: process.env.QA_APP_URL?.trim() || 'http://127.0.0.1:4174/',
}

assertSandboxPublicConfig(sandboxEnv)

const nodeExecutable = process.execPath
const npmCliPath = process.env.npm_execpath

if (!npmCliPath) {
  throw new Error('npm_execpath is unavailable. Launch sandbox commands through npm run.')
}

switch (commandName) {
  case 'preview':
    await run(nodeExecutable, [npmCliPath, 'run', 'build', '--', '--mode', 'qa'], sandboxEnv)
    await run(nodeExecutable, [npmCliPath, 'run', 'preview', '--', '--host', '127.0.0.1', '--port', '4174'], sandboxEnv)
    break
  case 'auth':
    await run(nodeExecutable, ['scripts/qa/setup-auth-state.mjs'], sandboxEnv)
    break
  case 'visual':
    await run(nodeExecutable, ['scripts/qa/run-authenticated-visual-qa.mjs'], sandboxEnv)
    break
  case 'dry':
    await run(nodeExecutable, ['scripts/qa/run-end-user-flow-agent.mjs', '--mode=dry-run'], sandboxEnv)
    break
  case 'write-clean':
    await run(
      nodeExecutable,
      ['scripts/qa/run-end-user-flow-agent.mjs', '--mode=write-and-clean'],
      { ...sandboxEnv, QA_ALLOW_WRITE_CLEAN: '1' },
    )
    break
  default:
    throw new Error(`Unsupported sandbox command "${commandName}".`)
}

function parseDotEnv(raw) {
  const parsed = {}
  for (const line of raw.split(/\r?\n/u)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator < 0) continue
    const key = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/gu, '')
    if (key) parsed[key] = value
  }
  return parsed
}

function run(executable, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: rootDir,
      env,
      stdio: 'inherit',
      shell: false,
    })
    child.once('error', reject)
    child.once('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Sandbox command failed with exit code ${code}.`))
    })
  })
}
