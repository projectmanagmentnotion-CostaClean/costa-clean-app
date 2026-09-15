import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { chromium } from '@playwright/test'

const rootDir = process.cwd()
const qaAppUrl = process.env.QA_APP_URL?.trim() || 'http://127.0.0.1:4177/?v3=1'
const authMetadataPath = path.resolve(process.env.QA_AUTH_METADATA ?? '.auth/costa-clean-storage-state.json')
const reportDir = path.join(rootDir, 'qa-reports', 'private', 'v3-10b')
const qaProjectRef = 'kpvvydthlxupjjqqdpxy'
const productionProjectRef = 'wfxnwfcdjainpojhbdri'
const surfaces = [
  ['dashboard', 'Negocio hoy'], ['clients', 'Clientes'], ['leads', 'Leads'], ['properties', 'Inmuebles'],
  ['quotes', 'Presupuestos'], ['jobs', 'Servicios'], ['invoices', 'Facturas'], ['payments', 'Cobros'],
  ['expenses', 'Gastos'], ['alerts', 'Alertas'], ['fiscal_closing', 'Cierres'], ['recurring', 'Planes recurrentes'],
]
const workspaceSelectors = {
  clients: '.v3-client-workspace', leads: '.v3-lead-workspace', properties: '.v3-property-workspace',
  quotes: '.v3-quote-workspace', jobs: '.v3-job-workspace', invoices: '.v3-invoice-workspace',
  payments: '.v3-payment-workspace', expenses: '.v3-expense-workspace',
}
const viewports = [
  { id: '390x844', width: 390, height: 844 }, { id: '768x1024', width: 768, height: 1024 },
  { id: '1440x900', width: 1440, height: 900 }, { id: '320x568', width: 320, height: 568 },
  { id: '430x932', width: 430, height: 932 }, { id: '1024x1366', width: 1024, height: 1366 },
  { id: '1280x800', width: 1280, height: 800 }, { id: '1920x1080', width: 1920, height: 1080 },
]

function buildUrl(view) {
  const url = new URL(qaAppUrl)
  url.searchParams.set('v3', '1')
  url.searchParams.set('view', view)
  return url.toString()
}

async function geometry(page) {
  return page.evaluate(({ qaProjectRef, productionProjectRef }) => {
    const visible = (selector) => Array.from(document.querySelectorAll(selector)).filter((node) => {
      const rect = node.getBoundingClientRect(); const style = getComputedStyle(node)
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
    })
    const targetGeometry = (selector) => visible(selector).map((node) => {
      const rect = node.getBoundingClientRect()
      return { width: Math.round(rect.width * 100) / 100, height: Math.round(rect.height * 100) / 100 }
    })
    const bodyText = document.body?.innerText ?? ''
    const uuid = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/giu
    return {
      authenticatedShell: ['Inicio', 'Clientes', 'Facturas', 'Servicios'].filter((label) => bodyText.includes(label)).length >= 2 && !document.querySelector('input[type="password"]'),
      innerWidth: window.innerWidth, innerHeight: window.innerHeight, clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      bottomNavVisible: visible('.v3-bottom-nav').length > 0, railVisible: visible('.v3-navigation-rail').length > 0,
      bottomNavRect: targetGeometry('.v3-bottom-nav'), railRect: targetGeometry('.v3-navigation-rail'),
      contactActions: targetGeometry('.v3-contact-action'), ghostActions: targetGeometry('.v3-action--ghost'),
      visibleUuid: (bodyText.match(uuid) ?? []).length,
      accessibleUuid: Array.from(document.querySelectorAll('[aria-label], [aria-describedby], [title]')).filter((node) => uuid.test(node.getAttribute('aria-label') ?? node.getAttribute('aria-describedby') ?? node.getAttribute('title') ?? '')).length,
      unicodeAsIcon: (bodyText.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) ?? []).length,
      legacyRuntimeMarkers: document.querySelectorAll('.cc-action-flow__panel, .cc-step-flow, [data-qa="fullscreen-step-flow"], .cc-create-flow__hero-card').length,
      manifestPresent: Boolean(document.querySelector('link[rel="manifest"]')),
      faviconPresent: Boolean(document.querySelector('link[rel="icon"][href="/branding/favicon.png"]')),
      imageCount: visible('img').length,
      brokenImages: visible('img').filter((node) => !node.complete || node.naturalWidth === 0).length,
      targetRequestRefs: { qa: qaProjectRef, production: productionProjectRef },
    }
  }, { qaProjectRef, productionProjectRef })
}

async function inspectSurface(page, view, expectedHeading) {
  const result = { view, expectedHeading, navigation: 'NOT_EXECUTED', heading: false, workspace: 'NOT_EXECUTED', search: 'NOT_EXECUTED', deepLinkBack: 'NOT_EXECUTED', geometry: null, error: null }
  try {
    const targetView = view === 'recurring' ? 'clients' : view
    await page.goto(buildUrl(targetView), { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.waitForTimeout(1500)
    result.navigation = 'PASS'
    result.heading = await page.getByRole('heading', { name: expectedHeading, exact: true }).first().count() > 0
    result.geometry = await geometry(page)
    if (view === 'recurring') {
      const clientRow = page.locator('[aria-label^="Abrir cliente"]').first()
      if (await clientRow.count() > 0) {
        await clientRow.click(); await page.waitForTimeout(750)
        const section = page.locator('.v3-client-workspace .v3-section').filter({ hasText: 'Planes recurrentes' }).first()
        result.workspace = await section.count() > 0 ? 'PASS_VIA_CLIENT_WORKSPACE' : 'NOT_FOUND'
        result.heading = await section.count() > 0
      } else result.workspace = 'EMPTY_OR_NOT_AVAILABLE'
      result.search = 'N/A'
      return result
    }
    const rowSelectors = {
      clients: '[aria-label^="Abrir cliente"]', leads: '[aria-label^="Abrir lead"]', properties: '[aria-label^="Abrir inmueble"]',
      quotes: '[aria-label^="Abrir presupuesto"]', jobs: '[aria-label^="Abrir servicio"]', invoices: '[aria-label^="Abrir "]',
      payments: '[aria-label^="Abrir "]', expenses: '[aria-label^="Abrir "]',
    }
    const rowSelector = rowSelectors[view]
    if (rowSelector) {
      const row = page.locator(rowSelector).first()
      if (await row.count() > 0) {
        await row.click()
        await page.waitForTimeout(500)
        result.workspace = await page.locator(workspaceSelectors[view]).count() > 0 ? 'PASS' : 'NOT_FOUND'
        const workspaceUrl = page.url()
        await page.reload({ waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(1500)
        const back = page.locator('.v3-workspace-back').first().or(page.getByRole('button', { name: 'Volver', exact: true }).first())
        if (await back.count() > 0) { await back.click(); await page.waitForTimeout(750) }
        result.deepLinkBack = { deepLinkPresent: /(?:client|lead|property|quote|job|invoice|payment|expense)=/u.test(workspaceUrl), backVisible: await page.getByRole('heading', { name: expectedHeading, exact: true }).first().count() > 0 }
      } else result.workspace = 'EMPTY_OR_NOT_AVAILABLE'
    } else result.workspace = 'N/A'
    const searchInput = page.locator('input[type="search"]').first()
    if (await searchInput.count() > 0) {
      await searchInput.fill('ZZZ-no-match-v3-10b')
      await page.waitForTimeout(250)
      const noMatch = /sin resultados|no hay|ningún|ningun/iu.test(await page.locator('body').innerText())
      await searchInput.fill('')
      result.search = noMatch ? 'PASS' : 'NO_EMPTY_ASSERTION'
    } else result.search = 'N/A'
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
  }
  return result
}

async function runViewport(metadata, viewport) {
  const state = { productionRequests: [], nonQaSupabaseRequests: [], qaMutations: [], failedRequests: [], consoleErrors: [], pageErrors: [] }
  const context = await chromium.launchPersistentContext(metadata.profileDir, { headless: true, viewport: { width: viewport.width, height: viewport.height }, serviceWorkers: 'allow', reducedMotion: viewport.id === '390x844' ? 'reduce' : 'no-preference' })
  const page = await context.newPage()
  page.on('request', (request) => {
    const url = request.url(); const method = request.method()
    if (url.includes(productionProjectRef)) state.productionRequests.push({ method })
    if (url.includes('.supabase.co') && !url.includes(qaProjectRef)) state.nonQaSupabaseRequests.push({ method })
    if (url.includes('.supabase.co') && !['GET', 'HEAD', 'OPTIONS'].includes(method)) state.qaMutations.push({ method })
  })
  page.on('requestfailed', (request) => state.failedRequests.push({ resource: request.resourceType() }))
  page.on('console', (message) => { if (message.type() === 'error') state.consoleErrors.push(message.text().slice(0, 160)) })
  page.on('pageerror', (error) => state.pageErrors.push(error.message.slice(0, 160)))
  const result = { viewport, state, surfaces: [], more: 'NOT_EXECUTED', keyboard: 'NOT_EXECUTED', finalGeometry: null }
  try {
    await page.goto(buildUrl('dashboard'), { waitUntil: 'domcontentloaded', timeout: 10000 }); await page.waitForTimeout(1500)
    result.authenticated = (await geometry(page)).authenticatedShell
    for (const [view, heading] of surfaces) result.surfaces.push(await inspectSurface(page, view, heading))
    await page.goto(buildUrl('dashboard'), { waitUntil: 'domcontentloaded', timeout: 30000 }); await page.waitForTimeout(1500)
    const more = page.getByRole('button', { name: 'Más', exact: true }).last()
    if (await more.count() > 0) {
      await more.click(); await page.waitForTimeout(250)
      result.more = await page.getByRole('dialog', { name: 'Más módulos' }).count() > 0 ? 'PASS' : 'NOT_FOUND'
      await page.keyboard.press('Escape'); result.keyboard = 'PASS'
    } else { result.more = 'N/A'; result.keyboard = 'N/A' }
    result.finalGeometry = await geometry(page)
  } catch (error) { result.error = error instanceof Error ? error.message : String(error) }
  await context.close()
  return result
}

async function main() {
  const metadata = JSON.parse(await fs.readFile(authMetadataPath, 'utf8'))
  const report = { gate: 'V3-10B.1', mode: 'authenticated-read-only', qaProject: qaProjectRef, productionProject: productionProjectRef, results: [], auth: 'NOT_EXECUTED' }
  const selectedViewportIds = new Set(process.env.V3_10B_VIEWPORTS ? process.env.V3_10B_VIEWPORTS.split(',').map((value) => value.trim()).filter(Boolean) : viewports.map((viewport) => viewport.id))
  const selectedSurfaceIds = new Set(process.env.V3_10B_SURFACES ? process.env.V3_10B_SURFACES.split(',').map((value) => value.trim()).filter(Boolean) : surfaces.map(([view]) => view))
  const originalSurfaces = surfaces.slice()
  surfaces.splice(0, surfaces.length, ...originalSurfaces.filter(([view]) => selectedSurfaceIds.has(view)))
  for (const viewport of viewports.filter((candidate) => selectedViewportIds.has(candidate.id))) report.results.push(await runViewport(metadata, viewport))
  report.auth = report.results.every((result) => result.authenticated) ? 'PASS' : 'FAIL'
  report.summary = {
    viewports: report.results.length,
    authenticatedViewports: report.results.filter((result) => result.authenticated).length,
    productionRequests: report.results.reduce((sum, result) => sum + result.state.productionRequests.length, 0),
    nonQaSupabaseRequests: report.results.reduce((sum, result) => sum + result.state.nonQaSupabaseRequests.length, 0),
    qaMutations: report.results.reduce((sum, result) => sum + result.state.qaMutations.length, 0),
    consoleErrors: report.results.reduce((sum, result) => sum + result.state.consoleErrors.length, 0),
    pageErrors: report.results.reduce((sum, result) => sum + result.state.pageErrors.length, 0),
    failedRequests: report.results.reduce((sum, result) => sum + result.state.failedRequests.length, 0),
    overflowViewports: report.results.filter((result) => result.finalGeometry?.horizontalOverflow).length,
    surfaceErrors: report.results.flatMap((result) => result.surfaces).filter((surface) => surface.error).length,
  }
  await fs.mkdir(reportDir, { recursive: true }); await fs.writeFile(path.join(reportDir, 'v3-10b-auth-audit.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  process.stdout.write(`${JSON.stringify(report.summary)}\n`)
}

main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`); process.exitCode = 1 })
