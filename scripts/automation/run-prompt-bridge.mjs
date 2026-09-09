import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { buildExecutionPrompt, createJob, hashPrompt, isAllowedSource, PROJECTS, projectForSource } from './bridge-core.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const privateRoot = path.join(repoRoot, '.project-agent', 'private', 'prompt-bridge')
const port = Number(process.env.PROMPT_BRIDGE_PORT || 4319)
const jobs = new Map()
let running = false

fs.mkdirSync(privateRoot, { recursive: true })

for (const filename of fs.readdirSync(privateRoot).filter((name) => name.endsWith('.json'))) {
  try {
    const job = JSON.parse(fs.readFileSync(path.join(privateRoot, filename), 'utf8'))
    if (job?.id && job?.status) jobs.set(job.id, job)
  } catch {
    // Ignore an incomplete private artifact; a later job can still run safely.
  }
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 200_000) reject(new Error('Request too large.'))
    })
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')) } catch { reject(new Error('Invalid JSON.')) }
    })
    req.on('error', reject)
  })
}

function resolveCodex() {
  const configured = process.env.CODEX_CLI_PATH
  const bundled = process.env.USERPROFILE ? path.join(process.env.USERPROFILE, '.codex', 'plugins', '.plugin-appserver', 'codex.exe') : ''
  const target = configured ? path.resolve(configured) : bundled
  if (target && fs.existsSync(target)) return { command: target, prefix: [] }
  return { command: 'codex', prefix: [] }
}

function startJob(job) {
  if (running) return
  running = true
  const project = PROJECTS[Object.keys(PROJECTS).find((key) => PROJECTS[key].key === job.projectKey)]
  if (!project || !fs.existsSync(project.root) || !workspaceMatches(project)) {
    job.status = 'failed'
    job.error = 'Configured project worktree or branch identity does not match.'
    job.finishedAt = new Date().toISOString()
    running = false
    persist(job)
    return
  }
  job.status = 'running'
  const jobDir = path.join(privateRoot, project.key, job.id)
  fs.mkdirSync(jobDir, { recursive: true })
  const outputPath = path.join(jobDir, 'output.md')
  const invocation = resolveCodex()
  const child = spawn(invocation.command, [
    ...invocation.prefix,
    'exec',
    buildExecutionPrompt(job.prompt),
    '--ephemeral',
    '--sandbox', 'workspace-write',
    '--cd', project.root,
    '--output-last-message', outputPath,
    '--color', 'never',
  ], { cwd: repoRoot, windowsHide: false, stdio: ['ignore', 'pipe', 'pipe'] })
  let stderr = ''
  child.stderr.on('data', (chunk) => { stderr += chunk.toString().slice(-10_000) })
  child.on('close', (code) => {
    job.status = code === 0 ? 'complete' : 'failed'
    job.finishedAt = new Date().toISOString()
    job.output = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8').slice(0, 100_000) : ''
    job.error = code === 0 ? '' : `Codex exited with code ${code}. ${stderr}`
    running = false
    persist(job)
    const next = [...jobs.values()].find((candidate) => candidate.status === 'queued')
    if (next) startJob(next)
  })
  child.on('error', (error) => {
    job.status = 'failed'
    job.error = error.message
    job.finishedAt = new Date().toISOString()
    running = false
    persist(job)
  })
  persist(job)
}

function workspaceMatches(project) {
  const branch = spawnSync('git', ['-C', project.root, 'branch', '--show-current'], { encoding: 'utf8' })
  const remote = spawnSync('git', ['-C', project.root, 'remote', 'get-url', 'origin'], { encoding: 'utf8' })
  return branch.status === 0
    && remote.status === 0
    && branch.stdout.trim() === project.branch
    && remote.stdout.trim().replace(/\.git$/iu, '') === 'https://github.com/projectmanagmentnotion-CostaClean/costa-clean-app'
}

function persist(job) {
  fs.writeFileSync(path.join(privateRoot, `${job.id}.json`), `${JSON.stringify({ ...job, prompt: undefined }, null, 2)}\n`, 'utf8')
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || ''
  if (origin === 'https://chatgpt.com') {
    res.setHeader('access-control-allow-origin', origin)
    res.setHeader('access-control-allow-headers', 'content-type')
    res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS')
  }
  if (req.method === 'OPTIONS') return json(res, 204, {})
  try {
    if (req.method === 'GET' && req.url === '/health') return json(res, 200, { ok: true, conversationOnly: true, running })
    if (req.method === 'GET' && req.url === '/api/projects') {
      return json(res, 200, Object.values(PROJECTS).map(({ key, conversationUrl, root, branch }) => ({ key, conversationUrl, root, branch })))
    }
    if (req.method === 'GET' && req.url === '/api/jobs') {
      return json(res, 200, [...jobs.values()].map(({ prompt, ...safe }) => safe))
    }
    if (req.method === 'GET' && req.url.startsWith('/api/jobs/')) {
      const id = req.url.split('/').pop()
      const job = jobs.get(id)
      if (!job) return json(res, 404, { error: 'Unknown job.' })
      return json(res, 200, job)
    }
    if (req.method === 'POST' && req.url === '/api/prompts') {
      const body = await readBody(req)
      if (!isAllowedSource(body.sourceUrl)) return json(res, 403, { error: 'Only the configured conversation is accepted.' })
      const project = projectForSource(body.sourceUrl)
      if (!project) return json(res, 403, { error: 'No project is mapped to this conversation.' })
      const promptHash = hashPrompt(String(body.prompt || ''))
      const existing = [...jobs.values()].find((job) => job.projectKey === project.key && job.promptHash === promptHash)
      if (existing) return json(res, 200, { accepted: false, duplicate: true, jobId: existing.id })
      const job = createJob(String(body.prompt || ''), body.sourceUrl)
      job.projectKey = project.key
      job.promptHash = promptHash
      jobs.set(job.id, job)
      persist(job)
      startJob(job)
      return json(res, 202, { accepted: true, jobId: job.id })
    }
    return json(res, 404, { error: 'Not found.' })
  } catch (error) {
    return json(res, 400, { error: error instanceof Error ? error.message : String(error) })
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Prompt bridge listening on http://127.0.0.1:${port}`)
  console.log('Scope: exact configured ChatGPT conversation only; git publish is disabled.')
})
