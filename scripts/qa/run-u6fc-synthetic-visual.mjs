import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'

const rootDir = process.cwd()
const baseUrl = process.env.QA_APP_URL?.trim() || 'http://127.0.0.1:5173'
const outputDir = path.join(rootDir, 'qa-reports', 'private', 'u6fc-synthetic-visual')
const viewports = [
  { id: '320x568', width: 320, height: 568 },
  { id: '390x844', width: 390, height: 844 },
  { id: '768x1024', width: 768, height: 1024 },
  { id: '1440x900', width: 1440, height: 900 },
]
const authStates = [
  ['login', '/portal/login'],
  ['recovery', '/portal/recover'],
  ['reset', '/portal/reset-password'],
  ['session_expired', '/portal'],
  ['without_access', '/portal'],
  ['pending_review', '/portal'],
  ['suspended', '/portal'],
  ['revoked', '/portal'],
  ['offline', '/portal'],
]
const activeViews = [
  ['home', '/portal'],
  ['properties', '/portal/properties'],
  ['property_detail', '/portal/properties/ref-espacio-norte'],
  ['services', '/portal/services'],
  ['service_detail', '/portal/services/CC-SV-PREV-001'],
  ['service_history', '/portal/services'],
  ['requests', '/portal/service-requests'],
  ['request_detail', '/portal/service-requests/CC-SR-PREV-001'],
  ['request_new', '/portal/service-requests/new/property'],
  ['request_review', '/portal/service-requests/new/review'],
  ['request_success', '/portal/service-requests/new/success'],
  ['invoices', '/portal/documents'],
  ['invoice_detail', '/portal/documents'],
  ['profile', '/portal/profile'],
  ['security', '/portal/security'],
  ['empty', '/portal'],
]

await fs.mkdir(outputDir, { recursive: true })
const browser = await chromium.launch({ headless: false })
const results = []

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    const consoleErrors = []
    const pageErrors = []
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    page.on('pageerror', (error) => pageErrors.push(error.message))

    for (const [scenario, pathname] of [...authStates, ...activeViews.map(([id, route]) => [id === 'empty' ? 'empty' : 'active_admin', route])]) {
      const viewId = authStates.some(([id]) => id === scenario)
        ? scenario
        : `${scenario}:${pathname}`
      const url = new URL(pathname, baseUrl)
      url.searchParams.set('portalPreview', scenario)
      await page.goto(url.toString(), { waitUntil: 'networkidle' })
      await page.locator('main, [role="main"], #root').first().waitFor()
      const audit = await page.evaluate(() => ({
        title: document.title,
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        controlsBelow44: [...document.querySelectorAll('button, a, input, select, textarea')]
          .filter((element) => {
            const rect = element.getBoundingClientRect()
            const label = element.closest('label')
            const labelRect = label?.getBoundingClientRect()
            const hasTouchLabel = labelRect && labelRect.width >= 44 && labelRect.height >= 44
            return rect.width > 0 && rect.height > 0 && !hasTouchLabel
              && (rect.width < 44 || rect.height < 44)
          }).length,
        headingCount: document.querySelectorAll('h1').length,
        portalRoot: Boolean(document.querySelector('.portal-root')),
      }))
      const fileName = `${viewport.id}-${viewId.replaceAll(/[^a-z0-9]+/gi, '-')}.png`
      await page.screenshot({ path: path.join(outputDir, fileName), fullPage: true })
      results.push({ viewport: viewport.id, scenario, route: pathname, viewId, audit, consoleErrors: [...consoleErrors], pageErrors: [...pageErrors] })
      consoleErrors.length = 0
      pageErrors.length = 0
    }
    await context.close()
  }
} finally {
  await browser.close()
}

const summary = {
  baseUrl,
  generatedAt: new Date().toISOString(),
  total: results.length,
  passed: results.filter((result) => result.audit.title.includes('Área de clientes | Costa Clean')
    && result.audit.portalRoot
    && !result.audit.horizontalOverflow
    && result.audit.controlsBelow44 === 0
    && result.consoleErrors.length === 0
    && result.pageErrors.length === 0).length,
  results,
}
await fs.writeFile(path.join(outputDir, 'latest.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
console.log(`U6F-C synthetic visual: ${summary.passed}/${summary.total} passed`)
console.log(`Evidence: ${path.relative(rootDir, outputDir)}`)
if (summary.passed !== summary.total) process.exitCode = 1
