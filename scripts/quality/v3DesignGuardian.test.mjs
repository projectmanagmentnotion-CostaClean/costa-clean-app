import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const v3TreeFiles = [
  'src/v3/components/V3Primitives.tsx',
  'src/v3/invoices/V3InvoicesPage.tsx',
  'src/v3/shell/V3ShellChrome.tsx',
  'src/v3/clients/V3ClientsPage.tsx',
  'src/v3/clients/V3ContactActions.tsx',
  'src/v3/clients/contactActions.ts',
  'src/v3/quotes/V3QuotesPage.tsx',
  'src/v3/documents/shareDocument.ts',
  'src/v3/leads/V3LeadsPage.tsx',
  'src/v3/leads/V3LeadRow.tsx',
  'src/v3/leads/V3LeadWorkspace.tsx',
]

function readV3Tree() {
  return v3TreeFiles.map((file) => readFileSync(join(process.cwd(), file), 'utf8')).join('\n')
}

describe('V3 Design Guardian structural checks', () => {
  it('keeps the dedicated V3 tree free of legacy visual composition names', () => {
    const source = readV3Tree()
    for (const forbiddenName of ['hero-card', 'cc-master-layout', 'OperationalListItem', 'cc-record-card', 'cc-list-toolbar']) {
      expect(source).not.toContain(forbiddenName)
    }
  })

  it('keeps hardcoded colors inside the token file only', () => {
    expect(readV3Tree()).not.toMatch(/#[0-9a-f]{3,8}\b/i)
  })

  it('keeps quote presentation free of private geometry and legacy composition', () => {
    const source = readV3Tree()
    expect(source).not.toMatch(/border-radius\s*:/i)
    expect(source).not.toMatch(/height\s*:\s*\d+px/i)
    expect(source).not.toContain('QuotesList')
    expect(source).not.toContain('QuoteDetailCard')
  })

  it('keeps lead presentation free of legacy composition and fake review state', () => {
    const source = readV3Tree()
    expect(source).not.toMatch(/border-radius\s*:/i)
    expect(source).not.toMatch(/height\s*:\s*\d+px/i)
    expect(source).not.toContain('LeadsList')
    expect(source).not.toContain('LeadDetailCard')
    expect(source).not.toContain('reviewed_at')
    expect(source).not.toContain('reviewed_by')
  })
})
