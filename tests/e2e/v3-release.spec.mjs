import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { chromium, expect, test } from '@playwright/test'

const rootDir = process.cwd()
const qaProjectRef = 'kpvvydthlxupjjqqdpxy'
const productionProjectRef = 'wfxnwfcdjainpojhbdri'
const releaseReportDir = path.join(rootDir, 'qa-reports', 'private', 'v3-8-release')
const authMetadataPath = path.resolve(process.env.QA_AUTH_METADATA ?? '.auth/costaclean-v3/costa-clean-storage-state.json')
const appUrl = process.env.QA_APP_URL?.trim() || 'http://127.0.0.1:4176/?v3=1'

const viewports = [
  { id: '390x844', width: 390, height: 844 },
  { id: '768x1024', width: 768, height: 1024 },
  { id: '1280x800', width: 1280, height: 800 },
  { id: '1920x1080', width: 1920, height: 1080 },
]

const surfaces = [
  { id: 'dashboard', label: 'Inicio', heading: 'Negocio hoy' },
  { id: 'alerts', label: 'Alertas', heading: 'Alertas' },
  { id: 'fiscal_closing', label: 'Cierres', heading: 'Cierres' },
  { id: 'quarterly_closing', label: 'Cierres', heading: 'Cierres' },
  { id: 'annual_closing', label: 'Cierres', heading: 'Cierres' },
  { id: 'leads', label: 'Leads', heading: 'Leads' },
  { id: 'clients', label: 'Clientes', heading: 'Clientes' },
  { id: 'properties', label: 'Inmuebles', heading: 'Inmuebles' },
  { id: 'quotes', label: 'Presupuestos', heading: 'Presupuestos' },
  { id: 'jobs', label: 'Servicios', heading: 'Servicios' },
  { id: 'invoices', label: 'Facturas', heading: 'Facturas' },
  { id: 'expenses', label: 'Gastos', heading: 'Gastos' },
  { id: 'payments', label: 'Cobros', heading: 'Cobros' },
]

const deepLinkSurfaces = [
  { view: 'clients', param: 'client', row: '[aria-label^="Abrir cliente"]', workspace: '.v3-client-workspace' },
  { view: 'leads', param: 'lead', row: '[aria-label^="Abrir lead"]', workspace: '.v3-lead-workspace' },
  { view: 'properties', param: 'property', row: '[aria-label^="Abrir inmueble"]', workspace: '.v3-property-workspace' },
  { view: 'quotes', param: 'quote', row: '[aria-label^="Abrir presupuesto"]', workspace: '.v3-quote-workspace' },
  { view: 'jobs', param: 'job', row: '[aria-label^="Abrir servicio"]', workspace: '.v3-job-workspace' },
  { view: 'invoices', param: 'invoice', row: '[aria-label^="Abrir factura"]', workspace: '.v3-invoice-workspace' },
  { view: 'payments', param: 'payment', row: '[aria-label^="Abrir "]', workspace: '.v3-payment-workspace' },
  { view: 'expenses', param: 'expense', row: '[aria-label^="Abrir "]', workspace: '.v3-expense-workspace' },
]

function readAuthMetadata() {
  if (!fs.existsSync(authMetadataPath)) {
    throw new Error(`V3-8_AUTH_SETUP_REQUIRED: missing local QA auth metadata at ${path.relative(rootDir, authMetadataPath)}`)
  }
  const metadata = JSON.parse(fs.readFileSync(authMetadataPath, 'utf8'))
  if (!metadata.profileDir || !fs.existsSync(metadata.profileDir)) {
    throw new Error('V3-8_AUTH_SETUP_REQUIRED: the local QA browser profile is unavailable')
  }
  return metadata
}

function buildViewUrl(viewId) {
  const url = new URL(appUrl)
  url.searchParams.set('v3', '1')
  url.searchParams.set('view', viewId)
  for (const param of ['client', 'lead', 'property', 'quote', 'job', 'invoice', 'payment', 'expense']) url.searchParams.delete(param)
  return url.toString()
}

function registerGuards(page, state) {
  page.on('request', (request) => {
    const url = request.url()
    if (url.includes(productionProjectRef)) state.violations.push('production_request')
    if (url.includes('.supabase.co') && !url.includes(qaProjectRef)) state.violations.push('non_qa_supabase_request')
  })
  page.on('requestfailed', (request) => {
    const url = request.url()
    if (url.includes('.supabase.co') || url.includes('/assets/')) state.failedRequests += 1
  })
  page.on('pageerror', () => { state.pageErrors += 1 })
  page.on('console', (message) => { if (message.type() === 'error') state.consoleErrors += 1 })
}

async function launchQaContext(metadata, viewport, reducedMotion = false) {
  const state = { violations: [], failedRequests: 0, pageErrors: 0, consoleErrors: 0 }
  const context = await chromium.launchPersistentContext(metadata.profileDir, {
    headless: true,
    viewport: { width: viewport.width, height: viewport.height },
    reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
    serviceWorkers: 'allow',
  })
  const page = await context.newPage()
  await page.addInitScript(() => {
    window.__v3ConfirmCalls = 0
    const originalConfirm = window.confirm
    window.confirm = (...args) => {
      window.__v3ConfirmCalls += 1
      return originalConfirm(...args)
    }
  })
  registerGuards(page, state)
  return { context, page, state }
}

async function waitForAuthenticatedShell(page) {
  await page.waitForTimeout(1500)
  const state = await page.evaluate(() => {
    const text = document.body?.innerText ?? ''
    return {
      hasLogin: Boolean(document.querySelector('input[type="password"]')) || /Entrar al CRM|Acceso seguro/u.test(text),
      hasShell: ['Inicio', 'Clientes', 'Facturas', 'Servicios'].filter((label) => text.includes(label)).length >= 2,
    }
  })
  if (!state.hasShell || state.hasLogin) {
    throw new Error('V3-8_AUTH_REQUIRED: manual authenticated QA login is required in the ignored QA profile')
  }
}

async function navigateToSurface(page, surface) {
  await page.goto(buildViewUrl(surface.id), { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(({ expectedHeading }) => {
    const body = document.body?.innerText ?? ''
    return !document.querySelector('input[type="password"]') && body.includes(expectedHeading)
  }, { expectedHeading: surface.heading }, { timeout: 30000 })
  await expect(page.getByRole('heading', { name: surface.heading, exact: true }).first()).toBeVisible()
}

async function collectGeometry(page, viewport, surfaceId) {
  return await page.evaluate(({ viewport, surfaceId }) => {
    const visible = (node) => {
      if (!(node instanceof HTMLElement)) return false
      const rect = node.getBoundingClientRect()
      const style = getComputedStyle(node)
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
    }
    const root = document.documentElement
    const bottomNav = document.querySelector('.v3-bottom-nav')
    const rail = document.querySelector('.v3-navigation-rail')
    const bodyText = document.body?.innerText ?? ''
    const visibleUuid = (bodyText.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/giu) ?? []).length
    const accessibleUuid = Array.from(document.querySelectorAll('[aria-label], [aria-describedby], [title]')).filter((node) => /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/iu.test(node.getAttribute('aria-label') ?? node.getAttribute('aria-describedby') ?? node.getAttribute('title') ?? '')).length
    const legacySelectors = '.cc-action-flow__panel, .cc-step-flow, [data-qa="fullscreen-step-flow"], .cc-create-flow__hero-card, .cc-confirm-dialog, .cc-confirm-dialog__panel'
    return {
      viewport,
      surfaceId,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      clientWidth: root.clientWidth,
      clientHeight: root.clientHeight,
      scrollWidth: root.scrollWidth,
      scrollHeight: root.scrollHeight,
      rootOverflow: root.scrollWidth > root.clientWidth,
      bottomNavVisible: visible(bottomNav),
      railVisible: visible(rail),
      duplicateShell: visible(bottomNav) && visible(rail),
      legacyRuntimeMarkers: document.querySelectorAll(legacySelectors).length,
      visibleUuid,
      accessibleUuid,
      unicodeAsIcon: (bodyText.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) ?? []).length,
      confirmCalls: window.__v3ConfirmCalls ?? 0,
    }
  }, { viewport, surfaceId })
}

async function inspectWorkspace(page, selector, workspaceSelector) {
  const row = page.locator(selector).first()
  if (await row.count() === 0) return { available: false }
  await row.click()
  await expect(page.locator(workspaceSelector).first()).toBeVisible({ timeout: 15000 })
  const relationCount = await page.locator('.v3-relation-row, .v3-related-links button').count()
  const back = page.locator('.v3-workspace-back').first().or(page.getByRole('button', { name: 'Volver', exact: true }).first())
  await back.click()
  return { available: true, relationCount }
}

async function inspectMore(page) {
  const more = page.getByRole('button', { name: 'Más', exact: true }).last()
  if (await more.count() === 0) return false
  await more.click()
  await expect(page.getByRole('dialog', { name: 'Más módulos' })).toBeVisible()
  for (const label of ['Presupuestos', 'Leads', 'Inmuebles', 'Cobros', 'Gastos', 'Alertas', 'Cierres', 'Cerrar sesión']) {
    await expect(page.getByRole('dialog', { name: 'Más módulos' }).getByText(label, { exact: true })).toBeVisible()
  }
  await page.keyboard.press('Escape')
  return true
}

async function inspectReadOnlyDeepLink(page, definition) {
  await page.goto(buildViewUrl(definition.view), { waitUntil: 'domcontentloaded' })
  const row = page.locator(definition.row).first()
  if (await row.count() === 0) return { available: false }
  await row.click()
  await expect(page.locator(definition.workspace).first()).toBeVisible({ timeout: 15000 })
  const url = new URL(page.url())
  const id = url.searchParams.get(definition.param)
  if (!id) throw new Error(`V3-8_DEEP_LINK_MISSING: ${definition.view}`)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator(definition.workspace).first()).toBeVisible({ timeout: 15000 })
  const back = page.locator('.v3-workspace-back').first().or(page.getByRole('button', { name: 'Volver', exact: true }).first())
  await back.click()
  return { available: true, persisted: page.url().includes(`view=${definition.view}`) }
}

async function runViewport(metadata, viewport) {
  const { context, page, state } = await launchQaContext(metadata, viewport, viewport.id === '390x844')
  const result = { viewport, surfaces: [], workspaces: {}, deepLinks: {}, screenshots: [], more: false, serviceWorker: false, manifest: false, geometry: [] }
  try {
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' })
    await waitForAuthenticatedShell(page)
    result.serviceWorker = await page.evaluate(() => Boolean(navigator.serviceWorker?.controller || navigator.serviceWorker?.getRegistrations))
    result.manifest = await page.locator('link[rel="manifest"]').count() > 0
    for (const surface of surfaces) {
      await navigateToSurface(page, surface)
      result.surfaces.push(surface.id)
      result.geometry.push(await collectGeometry(page, viewport, surface.id))
      if (['dashboard', 'clients', 'invoices'].includes(surface.id)) {
        const file = path.join(releaseReportDir, `${surface.id}-${viewport.id}.png`)
        await page.screenshot({ path: file, fullPage: true })
        result.screenshots.push(path.relative(rootDir, file))
      }
    }
    await navigateToSurface(page, { id: 'clients', heading: 'Clientes' })
    result.workspaces.client = await inspectWorkspace(page, '[aria-label^="Abrir cliente"]', '.v3-client-workspace')
    if (result.workspaces.client.available) {
      result.workspaces.client.recurringPlanSection = await page.getByText('Planes recurrentes', { exact: true }).count() > 0
      result.workspaces.client.mediaPresentation = await page.locator('[aria-label*="foto de"], .v3-client-avatar').count() > 0
    }
    await navigateToSurface(page, { id: 'invoices', heading: 'Facturas' })
    result.workspaces.invoice = await inspectWorkspace(page, '[aria-label^="Abrir factura"]', '.v3-invoice-workspace')
    await navigateToSurface(page, { id: 'jobs', heading: 'Servicios' })
    result.workspaces.service = await inspectWorkspace(page, '[aria-label^="Abrir servicio"]', '.v3-job-workspace')
    await navigateToSurface(page, { id: 'dashboard', heading: 'Negocio hoy' })
    result.more = await inspectMore(page)
    for (const definition of deepLinkSurfaces) result.deepLinks[definition.view] = await inspectReadOnlyDeepLink(page, definition)
    result.finalGeometry = await collectGeometry(page, viewport, 'release-final')
    if (state.violations.length > 0) throw new Error(`V3-8_PRODUCTION_GUARD: ${state.violations.join(',')}`)
    if (state.pageErrors > 0 || state.consoleErrors > 0) throw new Error(`V3-8_RUNTIME_ERRORS: pageerror=${state.pageErrors}, console_error=${state.consoleErrors}`)
    return { ...result, state }
  } finally {
    await context.close()
  }
}

let authMetadata
let authBlocker = null

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  try {
    authMetadata = readAuthMetadata()
    const probe = await launchQaContext(authMetadata, viewports[0])
    try {
      await probe.page.goto(appUrl, { waitUntil: 'domcontentloaded' })
      await waitForAuthenticatedShell(probe.page)
    } finally {
      await probe.context.close()
    }
  } catch (error) {
    authBlocker = error instanceof Error ? error : new Error('V3-8_AUTH_SETUP_REQUIRED')
    await fsp.mkdir(releaseReportDir, { recursive: true })
    await fsp.writeFile(path.join(releaseReportDir, 'v3-8-auth-gate-latest.json'), `${JSON.stringify({ status: 'OPEN', blocker: authBlocker.message, qaProject: qaProjectRef, productionGuard: productionProjectRef, qaWrites: 'NONE' }, null, 2)}\n`, 'utf8')
  }
})

test('V3-8 authentication and environment gate', async () => {
  if (authBlocker) throw authBlocker
  expect(authMetadata).toBeTruthy()
})

for (const viewport of viewports) {
  test(`V3-8 read-only release matrix ${viewport.id}`, async () => {
    test.skip(Boolean(authBlocker), authBlocker?.message ?? 'authentication gate required')
    const result = await runViewport(authMetadata, viewport)
    await fsp.mkdir(releaseReportDir, { recursive: true })
    await fsp.writeFile(path.join(releaseReportDir, `v3-8-${viewport.id}.json`), `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  })
}
