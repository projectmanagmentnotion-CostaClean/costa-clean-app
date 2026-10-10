import { describe, expect, it } from 'vitest'
import { classifyChangeSet } from './classify-change-risk.mjs'

describe('delivery change-risk classifier', () => {
  it('classifies styles, assets, and documentation as L1', () => {
    const result = classifyChangeSet([
      { path: 'src/styles/dashboard.css', diff: '+  color: navy;' },
      { path: 'public/brand/logo.png', diff: '' },
      { path: 'docs/USAGE.md', diff: '+Update the visual guide.' },
    ])
    expect(result.level).toBe('L1')
    expect(result.fastDeliveryEligible).toBe(true)
  })

  it('escalates every JSX change because markup may have runtime dependencies', () => {
    const markup = classifyChangeSet([{
      path: 'src/components/ui/Badge.tsx',
      diff: '+<span className="badge badge--quiet" />',
    }])
    const behavior = classifyChangeSet([{
      path: 'src/components/ui/Badge.tsx',
      diff: '+onClick={() => saveRecord()}',
    }])
    expect(markup.level).toBe('L2')
    expect(behavior.level).toBe('L2')
    expect(classifyChangeSet([{
      path: 'src/components/ui/Badge.tsx',
      diff: '+<input type="password" required className="field" />',
    }]).level).toBe('L2')
    expect(classifyChangeSet([{
      path: 'src/components/ui/Badge.tsx',
      diff: '+<InteractiveBadge className="quiet" />',
    }]).level).toBe('L2')
  })

  it('admits only visual CSS declarations to L1', () => {
    expect(classifyChangeSet([{
      path: 'src/styles/theme.css',
      diff: '+.card {\n+  color: #123456;\n+}',
    }]).level).toBe('L1')
    for (const diff of [
      '+.secret { background-image: url(https://example.invalid/pixel); }',
      '+.field { display: none; }',
      '+@import "./remote.css";',
    ]) {
      expect(classifyChangeSet([{ path: 'src/styles/theme.css', diff }]).level).toBe('L2')
    }
  })

  it('classifies business logic and unknown source files as L2', () => {
    expect(classifyChangeSet([{ path: 'src/features/quotes/compute.ts', diff: '+return total' }]).level)
      .toBe('L2')
    expect(classifyChangeSet([{ path: 'new-widget.xyz', diff: '' }]).level).toBe('L2')
  })

  it('elevates infrastructure, data/security paths, and critical diff content to L3', () => {
    for (const filePath of [
      'supabase/migrations/20261010000000_change.sql',
      'supabase/functions/normalize/index.ts',
      '.github/workflows/release.yml',
      'package-lock.json',
      'src/data/client.ts',
    ]) {
      expect(classifyChangeSet([{ path: filePath, diff: '' }]).level).toBe('L3')
    }
    expect(classifyChangeSet([{ path: 'public/brand/icon.svg', diff: '' }]).level).toBe('L2')
    expect(classifyChangeSet([{
      path: 'src/unknown.ts',
      diff: '+GRANT SELECT ON private.documents TO authenticated;',
    }]).level).toBe('L3')
  })

  it('uses the highest-risk file in a mixed diff and fails closed on invalid input', () => {
    expect(classifyChangeSet([
      { path: 'src/styles/a.css', diff: '+.a {}' },
      { path: 'src/features/a.ts', diff: '+const next = 1' },
      { path: 'supabase/migrations/a.sql', diff: '+select 1' },
    ]).level).toBe('L3')
    expect(classifyChangeSet([]).level).toBe('NO_CHANGES')
    expect(() => classifyChangeSet([{ diff: '' }])).toThrow('CHANGE_PATH_REQUIRED')
  })
})
