import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const baseUrl = process.env.QA_APP_URL?.trim() || 'http://127.0.0.1:4174'
const headless = process.env.CP3C3_HEADLESS !== '0'
const viewports = [
  { id: '390x844', width: 390, height: 844 },
  { id: '1440x900', width: 1440, height: 900 },
]
const scenarios = [
  ['login', '/portal/login?portalPreview=login'],
  ['home', '/portal?portalPreview=active_admin'],
  ['properties', '/portal/properties?portalPreview=active_admin'],
  ['documents', '/portal/documents?portalPreview=active_admin'],
  ['account', '/portal/account?portalPreview=active_admin'],
  ['members', '/portal/members?portalPreview=active_member'],
  ['onboarding', '/portal?portalPreview=pending_review'],
]

const browser = await chromium.launch({ headless })
const results = []
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    const consoleErrors = []
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 160))
    })
    for (const [id, route] of scenarios) {
      await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 15000 })
      await page.waitForTimeout(750)
      const axe = await new AxeBuilder({ page }).analyze()
      const layout = await page.evaluate(() => ({
        width: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }))
      results.push({
        viewport: viewport.id,
        scenario: id,
        url: new URL(page.url()).pathname,
        overflow: layout.scrollWidth > layout.width,
        consoleErrors: consoleErrors.length,
        violations: axe.violations.map(({ id: rule, impact, nodes }) => ({
          id: rule,
          impact,
          nodes: nodes.length,
        })),
      })
      consoleErrors.length = 0
    }
    await context.close()
  }
} finally {
  await browser.close()
}

const violations = results.flatMap((result) => result.violations)
const failed = results.filter((result) => result.overflow || result.consoleErrors > 0 || result.violations.length > 0)
console.log(JSON.stringify({
  browser: 'playwright-chromium',
  scenarios: results.length,
  failed: failed.length,
  violations: violations.length,
  results,
  pass: failed.length === 0,
}))
