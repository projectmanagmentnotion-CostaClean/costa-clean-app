import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const fast = readFileSync(new URL('../../.github/workflows/fast-delivery.yml', import.meta.url), 'utf8')
const critical = readFileSync(new URL('../../.github/workflows/critical-release.yml', import.meta.url), 'utf8')
const v3 = readFileSync(new URL('../../.github/workflows/costa-clean-v3-validation.yml', import.meta.url), 'utf8')

describe('pull request CI check contract', () => {
  it('emits stable fast and critical job checks on every pull request', () => {
    expect(fast).toContain('name: Fast delivery (L1/L2)')
    expect(fast).toContain('  pull_request:')
    expect(fast).toContain('  validate:')
    expect(fast).toContain("steps.risk.outputs.level != 'L3'")
    expect(fast).toContain("steps.risk.outputs.level == 'L3'")

    expect(critical).toContain('name: Critical release verification (L3, no deployment)')
    expect(critical).toContain('  pull_request:')
    expect(critical).toContain('  verify:')
    expect(critical).toContain("steps.risk.outputs.level == 'L3'")
    expect(critical).toContain('scripts/release/check-critical-evidence.mjs')
  })

  it('keeps classification and build stable while running app suites only at L2/L3', () => {
    expect(v3).toContain('  pull_request:')
    expect(v3).toContain('  change-risk:')
    expect(v3).toContain('  lint-and-build:')
    expect(v3).toContain('name: Linux — Lint / TypeScript / Build')
    expect(v3).toContain('  linux-app-tests:')
    expect(v3).toContain('name: Linux — App and API tests')
    expect(v3).toContain('  full-windows-suite:')
    expect(v3).toContain('name: Windows — Full suite including CP2B frozen QA proofs')
    expect(v3.match(/needs\.change-risk\.outputs\.level != 'L1'/gu)).toHaveLength(2)
  })

  it('has no workflow_run/status dependency cycle and keeps conditional job names addressable', () => {
    for (const workflow of [fast, critical, v3]) {
      expect(workflow).not.toContain('workflow_run:')
      expect(workflow).not.toContain('check_suite:')
    }
    expect(v3).toContain('  change-risk:')
  })
})
