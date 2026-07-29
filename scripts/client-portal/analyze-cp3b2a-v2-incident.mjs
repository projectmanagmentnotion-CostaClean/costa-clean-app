import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const privateRoot = path.join(repoRoot, '.git', 'cp3b2a-private')

function fail(code) {
  throw new Error(code)
}

function isBlockedV2Report(value) {
  return value
    && value.version === 2
    && value.status === 'BLOCKED'
    && value.detail
    && Array.isArray(value.detail.stages)
    && value.detail.applyAttempts === 1
    && value.detail.recoveryAttempts === 1
}

function loadLatestBlockedReport() {
  if (!existsSync(privateRoot)) fail('private_incident_report_unavailable')

  const candidates = []
  for (const name of readdirSync(privateRoot)) {
    if (!name.endsWith('.json')) continue
    const resolved = path.resolve(privateRoot, name)
    if (path.dirname(resolved) !== path.resolve(privateRoot)) continue
    try {
      const parsed = JSON.parse(readFileSync(resolved, 'utf8'))
      if (isBlockedV2Report(parsed)) {
        candidates.push({
          parsed,
          createdAt: Date.parse(parsed.createdAt ?? '') || 0,
        })
      }
    } catch {
      // Ignore unrelated or incomplete private JSON files.
    }
  }

  candidates.sort((left, right) => right.createdAt - left.createdAt)
  if (candidates.length !== 1) fail('unique_private_incident_report_not_found')
  return candidates[0].parsed
}

export function summarizeIncident(report) {
  if (!isBlockedV2Report(report)) fail('private_incident_report_rejected')

  const stages = report.detail.stages
  const lastCompletedStage = stages.at(-1) ?? 'none'
  const applyCommitted = lastCompletedStage === 'apply'
  const recoveryResult = report.detail.recovery
    === 'CONTRACT_ABSENT_PRESTATE_RESTORED'
    ? 'PRESTATE_RESTORED'
    : 'MANUAL_VERIFICATION_REQUIRED'

  return {
    runStage: 'application_recovered',
    sanitizedErrorCode: 'V2_POST_APPLY_FAILURE_DETAIL_NOT_RETAINED',
    lastCompletedStage,
    firstFailedStage: applyCommitted ? 'postcheck' : 'unknown',
    applyCommitted,
    postcheckStarted: applyCommitted,
    postcheckReturnedJson: 'NOT_RECORDED_BY_V2_RUNNER',
    matrixStarted: false,
    recoveryStarted: report.detail.recoveryAttempts === 1,
    recoveryResult,
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.stdout.write(`${JSON.stringify(
      summarizeIncident(loadLatestBlockedReport()),
      null,
      2,
    )}\n`)
  } catch (error) {
    process.stderr.write(`BLOCKED: ${error instanceof Error ? error.message : 'incident_analysis_failed'}\n`)
    process.exitCode = 1
  }
}
