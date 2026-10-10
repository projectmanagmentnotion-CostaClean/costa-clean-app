import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { classifyChangeSet } from './classify-change-risk.mjs'
import { fastDeliveryPlan } from './fast-delivery-plan.mjs'
import { resolveLocalToolInvocation } from './local-tool-invocation.mjs'

describe('fast delivery gate selection', () => {
  it('invokes npm through node on Windows instead of relying on npm.cmd shell resolution', () => {
    expect(resolveLocalToolInvocation('npm', ['run', 'lint'], {
      platform: 'win32',
      execPath: process.execPath,
      npmExecPath: '',
    })).toEqual({
      command: process.execPath,
      args: [path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'), 'run', 'lint'],
    })
  })

  it('keeps a reversible CSS-only visual change in L1 and runs only L1 gates', () => {
    const change = { path: 'src/styles/release-smoke.css', diff: '+.release-smoke {\n+  color: #123456;\n+}' }
    const classification = classifyChangeSet([change])
    expect(classification.level).toBe('L1')
    expect(fastDeliveryPlan(classification.level)).toEqual({
      commands: ['npm run lint', 'npm run build'],
      testMode: 'NONE',
      tests: [],
    })
  })

  it('runs the full suite for L2 even when a related test exists', () => {
    const classification = classifyChangeSet([{
      path: 'src/features/quotes/calculate.ts',
      diff: '+export const calculate = () => 1',
    }])
    expect(classification.level).toBe('L2')
    expect(fastDeliveryPlan('L2', ['src/features/quotes/calculate.test.ts'])).toEqual({
      commands: ['npm run lint', 'npm run build'],
      testMode: 'FULL_SUITE',
      tests: ['vitest run + verify-test-baseline.mjs'],
    })
  })

  it.each([
    'supabase/migrations/20261011000000_test.sql',
    '.github/workflows/fast-delivery.yml',
    'src/auth/session.ts',
    'src/features/billing/invoice.ts',
  ])('never admits critical path %s to Fast Delivery', (path) => {
    const classification = classifyChangeSet([{ path, diff: '+const change = true' }])
    expect(classification.level).toBe('L3')
    expect(() => fastDeliveryPlan(classification.level)).toThrow('L3_CHANGE_BLOCKED_FROM_FAST_DELIVERY')
  })
})
