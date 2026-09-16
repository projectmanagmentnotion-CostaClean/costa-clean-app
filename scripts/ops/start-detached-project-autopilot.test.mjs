import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const launcher = readFileSync('scripts/ops/start-detached-project-autopilot.ps1', 'utf8')

describe('detached project autopilot launcher', () => {
  it('guards protected branches and dirty worktrees', () => {
    expect(launcher).toContain("$branch -in @('main', 'master')")
    expect(launcher).toContain('status --porcelain')
  })

  it('uses the standalone CLI and strips only interactive session markers', () => {
    expect(launcher).toContain('CODEX_CLI_PATH')
    expect(launcher).toContain('CODEX_SESSION_ID')
    expect(launcher).toContain('CODEX_THREAD_ID')
    expect(launcher).not.toContain('Remove-Item Env:PATH')
  })

  it('requires a detached smoke artifact before the continuous loop', () => {
    expect(launcher).toContain('Start-Process')
    expect(launcher).toContain('--bootstrap --review-timeout-ms 600000')
    expect(launcher).toContain('Detached reviewer smoke produced no structured artifact.')
    expect(launcher).toContain('--continuous --bootstrap --max-iterations 10')
  })
})
