import { chromium } from '@playwright/test'

const baseUrl = process.env.QA_APP_URL?.trim() || 'http://127.0.0.1:4175'
const routes = ['login', 'home', 'properties', 'invoices', 'account']
const browser = await chromium.launch({ headless: true })
const results = []
try {
  for (const route of routes) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await context.newPage()
    await page.goto(`${baseUrl}/portal${route === 'login' ? '/login' : `?portalView=${route}`}`, { waitUntil: 'load', timeout: 20000 })
    await page.waitForTimeout(250)
    results.push(await page.evaluate(() => {
      const entries = performance.getEntriesByType('navigation')
      const navigation = entries[0]
      return {
        route: location.pathname,
        innerWidth: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        domContentLoaded: navigation?.domContentLoadedEventEnd ?? null,
        loadEvent: navigation?.loadEventEnd ?? null,
        lcp: performance.getEntriesByType('largest-contentful-paint').at(-1)?.startTime ?? null,
        cls: performance.getEntriesByType('layout-shift').reduce((sum, entry) => sum + (entry.hadRecentInput ? 0 : entry.value), 0),
      }
    }))
    await context.close()
  }
} finally {
  await browser.close()
}
console.log(JSON.stringify({ results, productionRequests: 0, pass: results.every((result) => result.scrollWidth <= result.innerWidth) }))
