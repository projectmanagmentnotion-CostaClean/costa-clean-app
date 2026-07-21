import fs from 'node:fs/promises'
import path from 'node:path'
import { parseSandboxEnv, validateSandboxReadiness } from './sandboxReadiness.mjs'

const rootDir = process.cwd()

async function readRequiredEnv(fileName) {
  const filePath = path.join(rootDir, fileName)
  const raw = await fs.readFile(filePath, 'utf8').catch(() => {
    throw new Error(`Missing ${fileName}. Create it manually from .env.qa.example.`)
  })
  return parseSandboxEnv(raw)
}

async function readOptionalEnv(fileName) {
  const filePath = path.join(rootDir, fileName)
  return await fs.readFile(filePath, 'utf8')
    .then(parseSandboxEnv)
    .catch(() => ({}))
}

try {
  const sandboxEnv = await readRequiredEnv('.env.qa.local')
  const referenceEnv = await readOptionalEnv('.env.local')
  const result = validateSandboxReadiness({ sandboxEnv, referenceEnv })

  process.stdout.write([
    'Sandbox configuration gate: passed',
    `Sandbox project fingerprint: ${result.sandboxFingerprint}`,
    `Reset strategy declared: ${result.resetStrategy}`,
    `Distinct from local reference project: ${result.distinctFromLocalReference === null ? 'not-verifiable' : 'yes'}`,
    'Full-submit gate: blocked until schema, seed, baseline, reset execution, and post-reset proof are verified.',
    '',
  ].join('\n'))
} catch (error) {
  process.stderr.write(`Sandbox configuration gate: blocked - ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
