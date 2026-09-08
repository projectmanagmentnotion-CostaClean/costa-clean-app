import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const v3TreeFiles = [
  'src/v3/components/V3Primitives.tsx',
  'src/v3/invoices/V3InvoicesPage.tsx',
  'src/v3/shell/V3ShellChrome.tsx',
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
})
