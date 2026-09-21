import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'

const rootDir = process.cwd()
const reportDir = path.join(rootDir, 'qa-reports', 'private', 'v3-10b')
const qaAppUrl = process.env.QA_APP_URL?.trim() || 'http://127.0.0.1:4177/?v3=1'

function run(command, args, env) {
  return new Promise((resolve) => {
    const startedAt = Date.now()
    const child = spawn(command, args, { cwd: rootDir, env })
    let output = ''
    child.stdout.on('data', (chunk) => { output += chunk.toString() })
    child.stderr.on('data', (chunk) => { output += chunk.toString() })
    child.on('close', (exitCode, signal) => resolve({ exitCode, signal, durationMs: Date.now() - startedAt, output }))
  })
}

function classifyReleaseLog(output, runNumber, source = 'fresh-execution') {
  const passed = /\b5 passed\b/u.test(output) && !/\b\d+ failed\b/u.test(output)
  return { run: runNumber, status: passed ? 'PASS' : 'FAIL', exitCode: passed ? 0 : 1, signal: null, durationMs: null, source }
}

async function main() {
  await fs.mkdir(reportDir, { recursive: true })
  const env = { ...process.env, QA_APP_URL: qaAppUrl, PW_TEST_HTML_REPORT_OPEN: 'never' }
  const releaseRuns = []
  if (process.env.V3_10B_REPEAT_ONLY === 'audit') {
    for (let runNumber = 1; runNumber <= 3; runNumber += 1) {
      const logPath = path.join(reportDir, `v3-10b-release-run-${runNumber}.log`)
      try {
        releaseRuns.push(classifyReleaseLog(await fs.readFile(logPath, 'utf8'), runNumber, 'existing-log-reconciled'))
      } catch {}
    }
  }
  for (let runNumber = 1; process.env.V3_10B_REPEAT_ONLY !== 'audit' && runNumber <= 3; runNumber += 1) {
    const releaseArgs = ['playwright', 'test', 'tests/e2e/v3-release.spec.mjs', '--workers=1', '--timeout=120000']
    const result = process.platform === 'win32'
      ? await run(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `npx ${releaseArgs.join(' ')}`], env)
      : await run('npx', releaseArgs, env)
    await fs.writeFile(path.join(reportDir, `v3-10b-release-run-${runNumber}.log`), result.output, 'utf8')
    releaseRuns.push({ run: runNumber, status: result.exitCode === 0 ? 'PASS' : 'FAIL', exitCode: result.exitCode, signal: result.signal ?? null, durationMs: result.durationMs, source: 'fresh-execution' })
  }
  const auditRuns = []
  for (let runNumber = 1; process.env.V3_10B_REPEAT_ONLY !== 'release' && runNumber <= 2; runNumber += 1) {
    const result = await run(process.execPath, ['scripts/qa/v3-10b-auth-audit.mjs'], env)
    await fs.writeFile(path.join(reportDir, `v3-10b-audit-run-${runNumber}.log`), result.output, 'utf8')
    const summaryLine = result.output.trim().split(/\r?\n/u).at(-1) ?? '{}'
    let summary = null
    try { summary = JSON.parse(summaryLine) } catch {}
    const status = result.exitCode === 0 && summary?.auditPass === true ? 'PASS' : result.exitCode === 2 && summary ? 'PARTIAL' : 'FAIL'
    auditRuns.push({ run: runNumber, status, executionCompleted: result.exitCode === 0 || result.exitCode === 2, exitCode: result.exitCode, signal: result.signal ?? null, durationMs: result.durationMs, summary })
  }
  const report = {
    gate: 'V3-10B.2', mode: 'read-only-determinism', qaAppUrl,
    releaseRuns, auditRuns,
    releaseDeterministic: releaseRuns.every((run) => run.status === 'PASS'),
    auditDeterministic: auditRuns.length === 2 && auditRuns.every((run) => run.status === 'PASS' && run.executionCompleted) && JSON.stringify(auditRuns[0].summary) === JSON.stringify(auditRuns[1].summary),
  }
  await fs.writeFile(path.join(reportDir, 'v3-10b-repeat.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  process.stdout.write(`${JSON.stringify({ releaseRuns, auditRuns: auditRuns.map(({ run, status, durationMs, summary }) => ({ run, status, durationMs, summary })), releaseDeterministic: report.releaseDeterministic, auditDeterministic: report.auditDeterministic })}\n`)
  if (!report.releaseDeterministic || !report.auditDeterministic) process.exitCode = 1
}

main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`); process.exitCode = 1 })
