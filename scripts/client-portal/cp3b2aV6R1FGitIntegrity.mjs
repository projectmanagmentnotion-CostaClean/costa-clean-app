import { createHash } from 'node:crypto'
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'

function fail(code, detail = {}) {
  const error = new Error(code)
  error.code = code
  error.detail = detail
  throw error
}

function normalizePath(value) {
  const relative = String(value).replaceAll('\\', '/')
  if (!relative || relative.startsWith('/') || /^[a-z]:/iu.test(relative)
    || /[\0\r\n]/u.test(relative)
    || relative.split('/').some((part) => !part || part === '.' || part === '..')) {
    fail('V6R1F_PATH_REJECTED')
  }
  return relative
}

function runGit(git, args, input = null) {
  const result = git(args, input)
  if (result?.status !== 0 || result?.error) fail('V6R1F_GIT_PROBE_FAILED', { command: args[0] })
  return Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.from(String(result.stdout ?? ''), 'utf8')
}

function parseNulRecords(buffer) {
  return buffer.toString('utf8').split('\0').filter(Boolean)
}

function readContainedRegularFile(repoRoot, relativePath) {
  const absolutePath = path.resolve(repoRoot, ...relativePath.split('/'))
  const rootReal = realpathSync(repoRoot)
  let componentPath = path.resolve(repoRoot)
  for (const component of relativePath.split('/')) {
    componentPath = path.join(componentPath, component)
    const componentStat = lstatSync(componentPath, { bigint: true })
    if (componentStat.isSymbolicLink()) fail('V6R1F_REPARSE_OR_NONFILE_REJECTED', { path: relativePath })
  }
  const before = lstatSync(absolutePath, { bigint: true })
  if (!before.isFile() || before.isSymbolicLink()) fail('V6R1F_REPARSE_OR_NONFILE_REJECTED', { path: relativePath })
  const real = realpathSync(absolutePath)
  const rel = path.relative(rootReal, real)
  if (!rel || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    fail('V6R1F_PATH_ESCAPES_REPOSITORY', { path: relativePath })
  }

  let fd
  try {
    fd = openSync(absolutePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
    const opened = fstatSync(fd, { bigint: true })
    const bytes = readFileSync(fd)
    const after = lstatSync(absolutePath, { bigint: true })
    const finalReal = realpathSync(absolutePath)
    const sameIdentity = (a, b) => a.dev === b.dev && a.ino === b.ino && a.size === b.size
      && a.mtimeNs === b.mtimeNs && a.ctimeNs === b.ctimeNs
    if (!opened.isFile() || !sameIdentity(before, opened) || !sameIdentity(opened, after)
      || finalReal !== real) fail('V6R1F_FILE_CHANGED_DURING_READ', { path: relativePath })
    return bytes
  } finally {
    if (fd !== undefined) closeSync(fd)
  }
}

function gitBlobId(bytes, objectFormat) {
  const header = Buffer.from(`blob ${bytes.length}\0`, 'utf8')
  return createHash(objectFormat === 'sha256' ? 'sha256' : 'sha1').update(header).update(bytes).digest('hex')
}

/**
 * Batch-verifies an immutable package snapshot in four Git processes, then reads
 * bytes through lstat/realpath/fstat checks. Use verifyStageV6R1F again directly
 * before each file-backed stage; a snapshot alone is deliberately not a lease.
 */
export function verifyPackageSnapshotV6R1F({ repoRoot, authorizedCommit, paths, git }) {
  if (!/^[a-f0-9]{40,64}$/iu.test(authorizedCommit ?? '')) fail('V6R1F_AUTHORIZED_COMMIT_INVALID')
  const normalizedPaths = [...new Set(paths.map(normalizePath))].sort()
  if (!normalizedPaths.length) fail('V6R1F_EMPTY_PACKAGE')

  const head = runGit(git, ['rev-parse', '--verify', 'HEAD']).toString('utf8').trim()
  if (head !== authorizedCommit) fail('V6R1F_AUTHORIZED_HEAD_MOVED')
  const objectFormat = runGit(git, ['rev-parse', '--show-object-format']).toString('utf8').trim()
  if (!['sha1', 'sha256'].includes(objectFormat)) fail('V6R1F_OBJECT_FORMAT_UNSUPPORTED')

  const staged = new Set(parseNulRecords(runGit(git, [
    '--literal-pathspecs', 'diff', '--cached', '--name-only', '-z', '--', ...normalizedPaths,
  ])))
  if (staged.size) fail('V6R1F_INDEX_DIVERGENCE', { paths: [...staged] })

  const indexRecords = parseNulRecords(runGit(git, ['ls-files', '-v', '-z', '--', ...normalizedPaths]))
  const indexByPath = new Map(indexRecords.map((record) => [record.slice(2), record[0]]))
  const indexBad = normalizedPaths.filter((file) => {
    const tag = indexByPath.get(file)
    return !tag || tag !== tag.toUpperCase()
  })
  if (indexBad.length) fail('V6R1F_INDEX_METADATA_REJECTED', { paths: indexBad })

  const objectSpecs = normalizedPaths.map((file) => `${authorizedCommit}:${file}`).join('\n') + '\n'
  const objectOutput = runGit(git, ['cat-file', '--batch-check=%(objectname) %(objecttype)'], Buffer.from(objectSpecs))
    .toString('utf8').trim().split(/\r?\n/u)
  if (objectOutput.length !== normalizedPaths.length) fail('V6R1F_COMMIT_OBJECT_MISSING')
  const commitBlobs = new Map()
  for (let i = 0; i < normalizedPaths.length; i += 1) {
    const [oid, type] = objectOutput[i].split(' ')
    if (type !== 'blob' || !new RegExp(`^[a-f0-9]{${objectFormat === 'sha256' ? 64 : 40}}$`, 'u').test(oid ?? '')) {
      fail('V6R1F_COMMIT_OBJECT_NOT_BLOB', { path: normalizedPaths[i] })
    }
    commitBlobs.set(normalizedPaths[i], oid)
  }

  const checked = normalizedPaths.map((file) => {
    const bytes = readContainedRegularFile(repoRoot, file)
    const actualBlob = gitBlobId(bytes, objectFormat)
    const expectedBlob = commitBlobs.get(file)
    if (actualBlob !== expectedBlob) fail('V6R1F_WORKTREE_DIVERGENCE', { path: file })
    return { path: file, blobId: actualBlob, sha256: createHash('sha256').update(bytes).digest('hex') }
  })
  return { authorizedCommit, objectFormat, checked, gitProcesses: 5 }
}

export function verifyStageV6R1F(options, relativePath) {
  const normalized = normalizePath(relativePath)
  const result = verifyPackageSnapshotV6R1F({ ...options, paths: [normalized] })
  return result.checked[0]
}
