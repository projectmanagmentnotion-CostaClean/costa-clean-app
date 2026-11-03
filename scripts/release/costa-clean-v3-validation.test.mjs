import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync(new URL('../../.github/workflows/costa-clean-v3-validation.yml', import.meta.url), 'utf8')

describe('Costa Clean V3 validation workflow risk partition', () => {
  it('classifies the PR diff and keeps unrelated full suites off L1', () => {
    expect(workflow).toContain('node scripts/release/classify-change-risk.mjs')
    expect(workflow).toContain('git merge-base origin/main HEAD')
    expect(workflow.match(/needs\.change-risk\.outputs\.level != 'L1'/gu)).toHaveLength(2)
    expect(workflow).toContain('full-windows-suite:')
    expect(workflow).toContain('linux-app-tests:')
  })

  it('retains unconditional lint and build verification for L1 changes', () => {
    expect(workflow).toContain('lint-and-build:')
    expect(workflow).toContain('npm run lint')
    expect(workflow).toContain('npm run build')
  })
})
