import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { chromium } from '@playwright/test'

const rootDir = process.cwd()
const baseUrl = process.env.QA_APP_URL?.trim() || 'http://127.0.0.1:4177/?v3=1'
const outputDir = path.join(rootDir, 'qa-reports', 'private', 'v3-10b')
const viewIds = [
  'dashboard', 'clients', 'leads', 'properties', 'quotes', 'jobs', 'invoices',
  'payments', 'expenses', 'alerts', 'fiscal_closing', 'recurring', 'more', 'selection',
]
const viewports = [
  { id: '320x568', width: 320, height: 568 },
  { id: '390x844', width: 390, height: 844 },
  { id: '430x932', width: 430, height: 932 },
  { id: '768x1024', width: 768, height: 1024 },
  { id: '1024x1366', width: 1024, height: 1366 },
  { id: '1280x800', width: 1280, height: 800 },
  { id: '1440x900', width: 1440, height: 900 },
  { id: '1920x1080', width: 1920, height: 1080 },
]

function urlForView(viewId) {
  const url = new URL(baseUrl)
  url.searchParams.set('v3', '1')
  url.searchParams.set('view', viewId)
  return url.toString()
}

async function inspectPage(page, viewport, viewId) {
  const state = {
    viewport,
    viewId,
    url: urlForView(viewId),
    status: null,
    finalUrl: null,
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    productionRequests: [],
    supabaseMutations: [],
    geometry: null,
    screenshot: null,
  }

  page.on('console', (message) => {
    if (message.type() === 'error') state.consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => state.pageErrors.push(error.message))
  page.on('requestfailed', (request) => state.failedRequests.push({ url: request.url(), error: request.failure()?.errorText ?? 'unknown' }))
  page.on('request', (request) => {
    const url = request.url()
    if (url.includes('wfxnwfcdjainpojhbdri')) state.productionRequests.push({ method: request.method(), url })
    if (url.includes('.supabase.co') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) state.supabaseMutations.push({ method: request.method(), url })
  })

  try {
    const response = await page.goto(state.url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    state.status = response?.status() ?? null
    state.finalUrl = page.url()
    await page.waitForTimeout(1500)
    state.geometry = await page.evaluate(() => {
      const root = document.documentElement
      const body = document.body
      const visible = (selector) => Array.from(document.querySelectorAll(selector)).filter((node) => {
        const rect = node.getBoundingClientRect()
        const style = getComputedStyle(node)
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
      }).length
      const bodyText = body?.innerText ?? ''
      return {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        clientWidth: root.clientWidth,
        clientHeight: root.clientHeight,
        scrollWidth: root.scrollWidth,
        scrollHeight: root.scrollHeight,
        horizontalOverflow: root.scrollWidth > root.clientWidth,
        loginVisible: Boolean(document.querySelector('input[type="password"], input[type="email"]')) || /Entrar al CRM|Acceso seguro/u.test(bodyText),
        shellMarkers: ['Inicio', 'Clientes', 'Facturas', 'Servicios'].filter((label) => bodyText.includes(label)),
        bottomNavVisible: visible('.v3-bottom-nav'),
        railVisible: visible('.v3-navigation-rail'),
        dialogs: visible('[role="dialog"]'),
        touchTargetsUnder44: Array.from(document.querySelectorAll('button, a, input, select, textarea, [role="button"]')).filter((node) => {
          const rect = node.getBoundingClientRect()
          const style = getComputedStyle(node)
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && (rect.width < 44 || rect.height < 44)
        }).length,
        manifestLinks: Array.from(document.querySelectorAll('link[rel="manifest"]')).map((node) => node.getAttribute('href')),
        faviconLinks: Array.from(document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]')).map((node) => node.getAttribute('href')),
      }
    })
    if (['dashboard', 'clients', 'properties', 'invoices', 'expenses', 'alerts'].includes(viewId) && ['390x844', '768x1024', '1440x900'].includes(viewport.id)) {
      const screenshotName = `${viewId}-${viewport.id}.png`
      await page.screenshot({ path: path.join(outputDir, screenshotName), fullPage: false })
      state.screenshot = path.join('qa-reports', 'private', 'v3-10b', screenshotName)
    }
  } catch (error) {
    state.navigationError = error instanceof Error ? error.message : String(error)
  }
  return state
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const results = []
  try {
    for (const viewport of viewports) {
      for (const viewId of viewIds) {
        const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, serviceWorkers: 'allow' })
        const page = await context.newPage()
        results.push(await inspectPage(page, viewport, viewId))
        await context.close()
      }
    }
  } finally {
    await browser.close()
  }

  const report = {
    gate: 'V3-10B',
    mode: 'local-read-only-unauthenticated',
    baseUrl,
    auth: { status: 'BLOCKED', reason: 'No authenticated local QA session was available; no credentials were requested or manipulated.' },
    productionRequests: results.flatMap((result) => result.productionRequests),
    supabaseMutations: results.flatMap((result) => result.supabaseMutations),
    results,
    summary: {
      pages: results.length,
      navigationErrors: results.filter((result) => result.navigationError).length,
      consoleErrorPages: results.filter((result) => result.consoleErrors.length > 0).length,
      pageErrorPages: results.filter((result) => result.pageErrors.length > 0).length,
      failedRequestPages: results.filter((result) => result.failedRequests.length > 0).length,
      horizontalOverflowPages: results.filter((result) => result.geometry?.horizontalOverflow).length,
      productionRequests: results.flatMap((result) => result.productionRequests).length,
      supabaseMutations: results.flatMap((result) => result.supabaseMutations).length,
    },
  }
  await fs.writeFile(path.join(outputDir, 'v3-10b-local-audit.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  process.stdout.write(`${JSON.stringify(report.summary)}\n`)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
})
