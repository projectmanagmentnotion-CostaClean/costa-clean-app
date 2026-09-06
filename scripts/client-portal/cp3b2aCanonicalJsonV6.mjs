import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

export const CANONICAL_JSON_STANDARD_V6 = 'CP3B2A_CANONICAL_JSON_V1'

function fail(code, detail = {}) {
  const error = new Error(code)
  error.code = code
  error.detail = detail
  throw error
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]'
}

function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function sha256Text(text) {
  return sha256Bytes(Buffer.from(text, 'utf8'))
}

function readUtf8Text(filePath) {
  return readFileSync(filePath, 'utf8').replace(/^\uFEFF/u, '')
}

function runGitLine(repoRoot, args, input = null) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    input,
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  })
  if (result.error || result.status !== 0) {
    fail('git_command_failed', {
      args,
      exitCode: result.status ?? null,
      stderr: String(result.stderr ?? '').trim(),
    })
  }
  return String(result.stdout ?? '').trim()
}

function runGitBlob(repoRoot, args) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: null,
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  })
  if (result.error || result.status !== 0) {
    fail('git_command_failed', {
      args,
      exitCode: result.status ?? null,
      stderr: Buffer.from(result.stderr ?? '').toString('utf8').trim(),
    })
  }
  return Buffer.from(result.stdout ?? Buffer.alloc(0))
}

function runGitOnWorkingTree(repoRoot, filePath) {
  const result = spawnSync('git', ['hash-object', '--', filePath], {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
  })
  if (result.error || result.status !== 0) {
    fail('git_command_failed', {
      args: ['hash-object', '--', filePath],
      exitCode: result.status ?? null,
      stderr: String(result.stderr ?? '').trim(),
    })
  }
  return String(result.stdout ?? '').trim()
}

function normalizeRelativePath(relativePath) {
  const normalized = relativePath.replaceAll('\\', '/')
  if (path.posix.isAbsolute(normalized) || normalized.includes('..')) {
    fail('artifact_path_rejected')
  }
  return normalized
}

export function canonicalizeJsonV1(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalizeJsonV1(entry))
  }
  if (isPlainObject(value)) {
    const ordered = {}
    for (const key of Object.keys(value).sort()) {
      ordered[key] = canonicalizeJsonV1(value[key])
    }
    return ordered
  }
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return value
  }
  fail('canonical_json_unsupported_type')
}

export function canonicalJsonTextV1(value) {
  return JSON.stringify(canonicalizeJsonV1(value))
}

export function canonicalJsonSha256V1(value) {
  return sha256Text(canonicalJsonTextV1(value))
}

export function parseJsonFileV1(filePath) {
  return JSON.parse(readUtf8Text(filePath))
}

export function gitBlobIdAtPath(repoRoot, relativePath) {
  const normalized = normalizeRelativePath(relativePath)
  return runGitLine(repoRoot, ['rev-parse', `HEAD:${normalized}`])
}

export function gitBlobBytesAtPath(repoRoot, relativePath) {
  const oid = gitBlobIdAtPath(repoRoot, relativePath)
  return runGitBlob(repoRoot, ['cat-file', 'blob', oid])
}

export function gitBlobTextAtPath(repoRoot, relativePath) {
  return gitBlobBytesAtPath(repoRoot, relativePath).toString('utf8')
}

export function gitBlobSha256AtPath(repoRoot, relativePath) {
  return sha256Bytes(gitBlobBytesAtPath(repoRoot, relativePath))
}

export function headBlobIdV1(relativePath) {
  return gitBlobIdAtPath(process.cwd(), relativePath)
}

export function gitBlobSha256V1(relativePath) {
  return gitBlobSha256AtPath(process.cwd(), relativePath)
}

export function workingTreeSha256V1(filePath) {
  return sha256Text(readFileSync(filePath))
}

export function workingTreeBlobIdV1(filePath) {
  return runGitOnWorkingTree(process.cwd(), filePath)
}

export function jsonContractIdentityAtPath(repoRoot, relativePath) {
  const gitBlobId = gitBlobIdAtPath(repoRoot, relativePath)
  const text = gitBlobTextAtPath(repoRoot, relativePath)
  const value = JSON.parse(text)
  return {
    gitBlobId,
    blobSha256: sha256Text(text),
    canonicalJsonSha256: canonicalJsonSha256V1(value),
    value,
  }
}

export function readJsonFromWorkingTree(filePath) {
  return JSON.parse(readUtf8Text(filePath))
}

export function workingTreeJsonContractIdentityV1(filePath) {
  const text = readUtf8Text(filePath)
  const value = JSON.parse(text)
  return {
    gitBlobId: workingTreeBlobIdV1(filePath),
    blobSha256: sha256Text(text),
    canonicalJsonSha256: canonicalJsonSha256V1(value),
    value,
  }
}
