import { appendFileSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CRITICAL_PATH = /(?:^|\/)(?:supabase\/|\.github\/workflows\/|docs\/release\/|scripts\/release\/|data\/|api\/)|(?:^|\/)(?:\.env(?:\.|$)|package\.json$|package-lock\.json$|pnpm-lock\.yaml$|yarn\.lock$|vercel\.json$)|(?:auth|security|rls|acl|secret|billing|invoice|payment|stripe|database|storage|edge|migration|schema)/iu
const CRITICAL_DIFF = /\b(?:grant|revoke)\s+|\b(?:create|alter|drop)\s+(?:policy|role|table|function|schema|trigger|type|extension|publication|subscription)|\b(?:row\s+level\s+security|security\s+definer|service_role|auth\.users|auth\.uid|supabase\.functions|supabase\.storage|payment|billing|invoice|stripe|secret|migration|schema)\b/iu
const VISUAL_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico',
  '.woff', '.woff2', '.ttf', '.otf', '.mp4', '.webm',
])
const PRESENTATION_LINE = /^\s*<\/?(?:span|strong|em|b|i|small|mark|div|section|p|h[1-6]|li|ul|ol)\s+className=(?:"[^"<>]*"|'[^'<>]*')\s*\/?>\s*$/u
const SAFE_CSS_PROPERTIES = new Set([
  'color', 'background-color', 'border-color', 'border-radius', 'border-style', 'border-width',
  'font-family', 'font-size', 'font-style', 'font-weight', 'letter-spacing', 'line-height',
  'outline-color', 'outline-style', 'outline-width', 'text-decoration-color', 'text-decoration-line',
  'text-decoration-style', 'text-shadow', 'box-shadow',
])

function isVisualOnlyCssPatch(diff) {
  const changed = getChangedLines(diff)
  const declarations = changed
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('/*') && !line.startsWith('*') && line !== '}' && !line.endsWith('{'))
  return declarations.length > 0 && declarations.every((line) => {
    const match = line.match(/^([a-z-]+)\s*:\s*([^;{}]+);?$/iu)
    return match && SAFE_CSS_PROPERTIES.has(match[1].toLowerCase())
      && !/(?:url\s*\(|expression\s*\(|var\s*\(|attr\s*\(|javascript:|@import)/iu.test(match[2])
  })
}

function normalizePath(filePath) {
  return String(filePath).replaceAll('\\', '/').replace(/^\.\//u, '')
}

function getChangedLines(diff) {
  return String(diff ?? '').split(/\r?\n/u)
    .filter((line) => (line.startsWith('+') && !line.startsWith('+++'))
      || (line.startsWith('-') && !line.startsWith('---')))
    .map((line) => line.slice(1))
}

function isVisualComponentPatch(changedLines) {
  return changedLines.length > 0 && changedLines.every((line) => PRESENTATION_LINE.test(line))
}

function classifyFile(filePath, diff) {
  const file = normalizePath(filePath)
  const ext = path.posix.extname(file).toLowerCase()
  if (CRITICAL_PATH.test(file)) {
    return { level: 'L3', reason: `critical-path:${file}` }
  }
  if (ext === '.css' || ext === '.scss' || ext === '.sass' || ext === '.less') {
    if (isVisualOnlyCssPatch(diff)) return { level: 'L1', reason: `presentation-only-css:${file}` }
    return { level: 'L2', reason: `css-needs-functional-review:${file}` }
  }
  if (VISUAL_EXTENSIONS.has(ext) || /^docs\//iu.test(file) && ext === '.md') {
    return { level: 'L1', reason: `presentation-or-documentation:${file}` }
  }
  if (/\.(?:tsx|jsx)$/iu.test(file) && /^src\/(?:components|ui)\//iu.test(file)) {
    const lines = getChangedLines(diff)
    if (lines.every((line) => !/(?:\bonClick\b|\bonSubmit\b|\bonChange\b|\btype\s*=|\brequired\b|\bdisabled\b|\btabIndex\b)/iu.test(line))
      && isVisualComponentPatch(lines) && !CRITICAL_DIFF.test(lines.join('\n'))) {
      return { level: 'L1', reason: `presentation-only-component-diff:${file}` }
    }
  }
  if (CRITICAL_DIFF.test(diff)) return { level: 'L3', reason: `critical-diff-content:${file}` }
  return { level: 'L2', reason: `functional-or-unclassified-code:${file}` }
}

export function classifyChangeSet(changes) {
  if (!Array.isArray(changes)) throw new TypeError('CHANGES_MUST_BE_ARRAY')
  if (changes.length === 0) return { level: 'NO_CHANGES', reasons: [], files: [] }

  const files = changes.map(({ path: filePath, diff = '' }) => {
    if (!filePath || typeof filePath !== 'string') throw new TypeError('CHANGE_PATH_REQUIRED')
    return { path: normalizePath(filePath), ...classifyFile(filePath, diff) }
  })
  const level = files.some((file) => file.level === 'L3')
    ? 'L3'
    : files.some((file) => file.level === 'L2') ? 'L2' : 'L1'
  return {
    level,
    reasons: [...new Set(files.map(({ reason }) => reason))],
    files,
    fastDeliveryEligible: level === 'L1' || level === 'L2',
    criticalReleaseRequired: level === 'L3',
  }
}

function runGit(args, { allowFailure = false } = {}) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  })
  if (result.error || result.status !== 0) {
    if (allowFailure) return ''
    throw new Error(`GIT_CHANGE_DISCOVERY_FAILED:${args[0]}`)
  }
  return result.stdout ?? ''
}

export function collectChanges(base) {
  if (!base) throw new Error('VALID_BASE_COMMIT_REQUIRED')
  try { runGit(['cat-file', '-e', `${base}^{commit}`]) } catch { throw new Error('VALID_BASE_COMMIT_REQUIRED') }
  const tracked = runGit(['--literal-pathspecs', 'diff', '--no-ext-diff', '--no-color', '--name-only', '-z', base])
    .split('\0').filter(Boolean)
  const untracked = runGit(['ls-files', '--others', '--exclude-standard', '-z'])
    .split('\0').filter(Boolean)
  const changedPaths = [...new Set([...tracked, ...untracked])]
  return changedPaths.map((filePath) => {
    const diff = tracked.includes(filePath)
      ? runGit(['--literal-pathspecs', 'diff', '--no-ext-diff', '--no-color', '--unified=0', base, '--', filePath])
      : untrackedDiff(filePath)
    return { path: filePath, diff }
  })
}

function untrackedDiff(filePath) {
  try {
    const content = readFileSync(path.join(repoRoot, filePath))
    if (content.includes(0)) return '[binary file: classified by path only]'
    return content.toString('utf8').split(/\r?\n/u).map((line) => `+${line}`).join('\n')
  } catch {
    return '[unreadable or missing file: conservative classification]'
  }
}

function parseArgs(args) {
  const parsed = { base: '', githubOutput: '' }
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--base') parsed.base = args[++i] ?? ''
    else if (args[i] === '--github-output') parsed.githubOutput = args[++i] ?? ''
    else throw new Error(`UNKNOWN_ARGUMENT:${args[i]}`)
  }
  return parsed
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { base, githubOutput } = parseArgs(process.argv.slice(2))
    const result = classifyChangeSet(collectChanges(base))
    const json = JSON.stringify({ base, ...result }, null, 2)
    process.stdout.write(`${json}\n`)
    if (githubOutput) {
      const safeReasons = result.reasons.map((reason) => reason.replaceAll('%', '%25').replaceAll('\n', '%0A'))
      const output = [
        `level=${result.level}`,
        `fast_delivery_eligible=${result.fastDeliveryEligible}`,
        `critical_release_required=${result.criticalReleaseRequired}`,
        `reasons=${safeReasons.join(';')}`,
      ].join('\n') + '\n'
      appendFileSync(githubOutput, output)
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  }
}
