import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const agentsDirectory = path.join(repositoryRoot, '.github', 'agents')
const manifestPath = path.join(repositoryRoot, 'config', 'project-agents.json')
const expectedSourceCommit = '01101e79240867c50cd7d9df1dd84cff5cbebd7d'
const expectedAgents = [
  'bug-root-cause-investigator',
  'business-rules-test-engineer',
  'documentation-roadmap',
  'enterprise-agent-architect',
  'frontend-ux-accessibility',
  'implementation-planner',
  'performance-gsap-motion',
  'project-continuation',
  'pr-quality-gate',
  'qa-e2e-specialist',
  'release-deployment-guardian',
  'security-privacy-auditor',
  'senior-figma-mobile-first-auditor',
  'senior-fullstack-builder',
  'seo-local-structured-data',
  'supabase-guardian',
]
const allowedWildcardTools = new Map(
  expectedAgents.map((name) => [
    name,
    new Set([
      'github/*',
      ...(
        [
          'frontend-ux-accessibility',
          'performance-gsap-motion',
          'qa-e2e-specialist',
          'senior-figma-mobile-first-auditor',
        ].includes(name)
          ? ['playwright/*']
          : []
      ),
    ]),
  ]),
)

const results = []
const record = (check, status, detail) => {
  results.push({ check, status, detail })
}

const normalize = (value) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

function parseScalar(frontmatter, key) {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'))
  return match?.[1]?.replace(/^["']|["']$/g, '')
}

function parseMetadataScalar(frontmatter, key) {
  const match = frontmatter.match(new RegExp(`^\\s{2}${key}:\\s*(.+?)\\s*$`, 'm'))
  return match?.[1]?.replace(/^["']|["']$/g, '')
}

function parseProfile(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) return null

  let tools
  const rawTools = parseScalar(match[1], 'tools')
  try {
    tools = JSON.parse(rawTools)
  } catch {
    tools = null
  }

  return {
    frontmatter: match[1],
    body: match[2],
    name: parseScalar(match[1], 'name'),
    target: parseScalar(match[1], 'target'),
    disableModelInvocation: parseScalar(match[1], 'disable-model-invocation'),
    userInvocable: parseScalar(match[1], 'user-invocable'),
    version: parseMetadataScalar(match[1], 'version'),
    riskLevel: parseMetadataScalar(match[1], 'risk-level'),
    tools,
  }
}

function findSecretIndicators(content) {
  const indicators = [
    ['private key material', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i],
    ['credential-bearing URL', /\b(?:https?|postgres(?:ql)?):\/\/[^/\s:@]+:[^@\s/]+@/i],
    ['known access-token prefix', /\b(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|sbp_[A-Za-z0-9_-]{30,}|sk-[A-Za-z0-9_-]{20,})\b/],
    ['private-network URL', /\bhttps?:\/\/(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})(?::\d+)?/i],
    [
      'literal sensitive assignment',
      /\b(?:api[_-]?key|access[_-]?token|service[_-]?role[_-]?key|password|secret)\s*[:=]\s*["'][A-Za-z0-9+/_=-]{16,}["']/i,
    ],
  ]
  return indicators.filter(([, pattern]) => pattern.test(content)).map(([label]) => label)
}

async function main() {
  let filenames
  try {
    filenames = (await readdir(agentsDirectory))
      .filter((filename) => filename.endsWith('.agent.md'))
      .sort()
  } catch (error) {
    record('agent-directory', 'NOT_AVAILABLE', error.message)
    filenames = []
  }

  const actualNames = filenames.map((filename) => filename.replace(/\.agent\.md$/, ''))
  const missing = expectedAgents.filter((name) => !actualNames.includes(name))
  const unexpected = actualNames.filter((name) => !expectedAgents.includes(name))
  record(
    'exact-profile-set',
    filenames.length === 16 && missing.length === 0 && unexpected.length === 0 ? 'PASS' : 'FAIL',
    `found=${filenames.length}; missing=${missing.join(',') || 'none'}; unexpected=${unexpected.join(',') || 'none'}`,
  )

  const parsedProfiles = new Map()
  for (const filename of filenames) {
    const filePath = path.join(agentsDirectory, filename)
    const content = await readFile(filePath, 'utf8')
    const profile = parseProfile(content)
    const filenameName = filename.replace(/\.agent\.md$/, '')
    const label = `profile:${filenameName}`

    record(`${label}:frontmatter`, profile ? 'PASS' : 'FAIL', profile ? 'present' : 'missing or malformed')
    if (!profile) continue

    parsedProfiles.set(filenameName, { ...profile, content, filePath })
    record(`${label}:filename-name`, profile.name === filenameName ? 'PASS' : 'FAIL', `declared=${profile.name ?? 'missing'}`)
    record(`${label}:target`, profile.target === 'github-copilot' ? 'PASS' : 'FAIL', `value=${profile.target ?? 'missing'}`)
    record(
      `${label}:manual-invocation`,
      profile.disableModelInvocation === 'true' && profile.userInvocable === 'true' ? 'PASS' : 'FAIL',
      `disable-model-invocation=${profile.disableModelInvocation}; user-invocable=${profile.userInvocable}`,
    )
    record(`${label}:version`, profile.version ? 'PASS' : 'FAIL', `value=${profile.version ?? 'missing'}`)
    record(
      `${label}:risk-level`,
      ['R1', 'R2', 'R3', 'R4'].includes(profile.riskLevel) ? 'PASS' : 'FAIL',
      `value=${profile.riskLevel ?? 'missing'}`,
    )

    const toolsAreExplicit = Array.isArray(profile.tools) && profile.tools.length > 0
      && profile.tools.every((tool) => typeof tool === 'string' && tool.length > 0)
    record(`${label}:tools-explicit`, toolsAreExplicit ? 'PASS' : 'FAIL', toolsAreExplicit ? `count=${profile.tools.length}` : 'not an explicit non-empty list')

    const wildcardTools = toolsAreExplicit ? profile.tools.filter((tool) => tool.includes('*')) : []
    const disallowedWildcards = wildcardTools.filter((tool) => !allowedWildcardTools.get(filenameName)?.has(tool))
    record(
      `${label}:wildcards`,
      disallowedWildcards.length === 0 ? 'PASS' : 'FAIL',
      `declared=${wildcardTools.join(',') || 'none'}; disallowed=${disallowedWildcards.join(',') || 'none'}`,
    )

    const headings = [...profile.body.matchAll(/^#\s+(.+?)\s*$/gm)].map((match) => normalize(match[1]))
    const essentialSections = [
      ['identidad', (heading) => heading === 'identidad'],
      ['objetivo', (heading) => heading === 'objetivo'],
      ['acciones-permitidas', (heading) => heading === 'acciones permitidas'],
      ['acciones-prohibidas', (heading) => heading === 'acciones prohibidas'],
      ['formato-de-salida', (heading) => heading === 'formato de salida'],
      ['criterio-finalizacion', (heading) => /^criterios? de finalizacion$/.test(heading)],
    ]
    const absentSections = essentialSections
      .filter(([, predicate]) => !headings.some(predicate))
      .map(([name]) => name)
    record(
      `${label}:essential-sections`,
      absentSections.length === 0 ? 'PASS' : 'FAIL',
      `missing=${absentSections.join(',') || 'none'}`,
    )

    const secretIndicators = findSecretIndicators(content)
    record(
      `${label}:secret-scan`,
      secretIndicators.length === 0 ? 'PASS' : 'FAIL',
      `indicators=${secretIndicators.join(',') || 'none'}`,
    )
  }

  const declaredNames = [...parsedProfiles.values()].map((profile) => profile.name)
  const duplicateNames = declaredNames.filter((name, index) => declaredNames.indexOf(name) !== index)
  record('unique-declared-names', duplicateNames.length === 0 ? 'PASS' : 'FAIL', `duplicates=${[...new Set(duplicateNames)].join(',') || 'none'}`)

  let manifest
  let manifestRaw
  try {
    manifestRaw = await readFile(manifestPath, 'utf8')
    manifest = JSON.parse(manifestRaw)
    record('manifest:readable', 'PASS', 'valid JSON')
  } catch (error) {
    record('manifest:readable', 'NOT_AVAILABLE', error.message)
  }

  if (manifest) {
    record(
      'manifest:identity',
      manifest.schemaVersion === 1
        && manifest.project === 'Costa Clean Client Portal'
        && manifest.sourceRepository === 'projectmanagmentnotion-CostaClean/production-agents'
        && /^\d{4}-\d{2}-\d{2}$/.test(manifest.installedAt)
        ? 'PASS'
        : 'FAIL',
      `schemaVersion=${manifest.schemaVersion}; project=${manifest.project ?? 'missing'}; sourceRepository=${manifest.sourceRepository ?? 'missing'}; installedAt=${manifest.installedAt ?? 'missing'}`,
    )
    record(
      'manifest:source-commit',
      manifest.sourceCommit === expectedSourceCommit ? 'PASS' : 'FAIL',
      `value=${manifest.sourceCommit ?? 'missing'}`,
    )
    record(
      'manifest:manual-invocation',
      manifest.manualInvocation === true ? 'PASS' : 'FAIL',
      `value=${String(manifest.manualInvocation)}`,
    )
    record(
      'manifest:count',
      manifest.totalAgents === 16 && Array.isArray(manifest.agents) && manifest.agents.length === 16 ? 'PASS' : 'FAIL',
      `declared=${manifest.totalAgents}; entries=${manifest.agents?.length ?? 'missing'}`,
    )

    const manifestNames = Array.isArray(manifest.agents) ? manifest.agents.map((agent) => agent.name).sort() : []
    record(
      'manifest:names',
      JSON.stringify(manifestNames) === JSON.stringify([...expectedAgents].sort()) ? 'PASS' : 'FAIL',
      `entries=${manifestNames.length}`,
    )

    const mismatches = []
    for (const entry of manifest.agents ?? []) {
      const profile = parsedProfiles.get(entry.name)
      if (!profile) {
        mismatches.push(`${entry.name}:missing-profile`)
        continue
      }
      const expectedPath = `.github/agents/${entry.name}.agent.md`
      const digest = createHash('sha256').update(profile.content).digest('hex')
      if (entry.path !== expectedPath) mismatches.push(`${entry.name}:path`)
      if (entry.version !== profile.version) mismatches.push(`${entry.name}:version`)
      if (entry.riskLevel !== profile.riskLevel) mismatches.push(`${entry.name}:risk`)
      if (entry.sha256 !== digest) mismatches.push(`${entry.name}:sha256`)
      if (!entry.category || !entry.primaryUse || !Array.isArray(entry.roadmapPhases) || !entry.independentReviewer) {
        mismatches.push(`${entry.name}:metadata`)
      }
    }
    record(
      'manifest:file-alignment',
      mismatches.length === 0 ? 'PASS' : 'FAIL',
      `mismatches=${mismatches.join(',') || 'none'}`,
    )
    const manifestSecretIndicators = findSecretIndicators(manifestRaw)
    record(
      'manifest:secret-scan',
      manifestSecretIndicators.length === 0 ? 'PASS' : 'FAIL',
      `indicators=${manifestSecretIndicators.join(',') || 'none'}`,
    )
  } else {
    for (const check of ['identity', 'source-commit', 'manual-invocation', 'count', 'names', 'file-alignment', 'secret-scan']) {
      record(`manifest:${check}`, 'NOT_EXECUTED', 'manifest unavailable')
    }
  }

  const failed = results.filter((result) => ['FAIL', 'NOT_AVAILABLE', 'NOT_EXECUTED'].includes(result.status))
  console.log(JSON.stringify({
    validator: 'Costa Clean project agent pack',
    status: failed.length === 0 ? 'PASS' : 'FAIL',
    vocabulary: ['PASS', 'FAIL', 'NOT_AVAILABLE', 'NOT_EXECUTED'],
    summary: {
      checks: results.length,
      passed: results.filter((result) => result.status === 'PASS').length,
      failed: results.filter((result) => result.status === 'FAIL').length,
      notAvailable: results.filter((result) => result.status === 'NOT_AVAILABLE').length,
      notExecuted: results.filter((result) => result.status === 'NOT_EXECUTED').length,
    },
    results,
  }, null, 2))

  if (failed.length > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(JSON.stringify({
    validator: 'Costa Clean project agent pack',
    status: 'FAIL',
    vocabulary: ['PASS', 'FAIL', 'NOT_AVAILABLE', 'NOT_EXECUTED'],
    error: error.message,
  }, null, 2))
  process.exitCode = 1
})
