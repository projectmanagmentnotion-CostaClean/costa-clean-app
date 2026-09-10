import { chromium } from '@playwright/test'

const baseUrl = process.env.QA_APP_URL?.trim() || 'http://127.0.0.1:4174'
const cases = [
  ['active_admin', '/portal/members?portalPreview=active_admin'],
  ['active_member', '/portal/members?portalPreview=active_member'],
  ['marketing', '/portal/preferences/marketing?portalPreview=active_admin'],
]

const browser = await chromium.launch({ headless: process.env.CP3C3_HEADLESS !== '0' })
const results = []
try {
  for (const [id, route] of cases) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await context.newPage()
    const remoteRequests = []
    const consoleErrors = []
    page.on('request', (request) => {
      if (request.url().includes('portal-member-actions') || request.url().includes('portal-account-actions')) {
        remoteRequests.push(request.url().split('/').pop())
      }
    })
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 160))
    })
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.waitForTimeout(900)
    results.push({
      scenario: id,
      route: new URL(page.url()).pathname,
      portalActionRequests: remoteRequests.length,
      consoleErrors: consoleErrors.length,
      pass: remoteRequests.length === 0 && consoleErrors.length === 0,
    })
    await context.close()
  }
} finally {
  await browser.close()
}

console.log(JSON.stringify({ results, pass: results.every((result) => result.pass) }))
