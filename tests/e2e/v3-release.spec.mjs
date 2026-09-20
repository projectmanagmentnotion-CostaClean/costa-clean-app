import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { chromium, expect, test } from '@playwright/test'
import {
  createNetworkLedger,
  getExactViewportMetrics,
  recordConsoleError,
  recordPageError,
  recordRequest,
  recordRequestFailed,
  recordResponse,
  summarizeNetworkLedger,
} from '../../scripts/qa/auth/networkLedger.mjs'
import { getQaPaths } from '../../scripts/qa/auth/cdpHarness.mjs'

const rootDir = process.cwd()
const releaseReportDir = path.join(rootDir, 'qa-reports', 'private', 'v3-8-release')
const authMetadataPath = path.resolve(process.env.QA_AUTH_METADATA ?? getQaPaths(rootDir).stateFile)
const appUrl = process.env.QA_APP_URL?.trim() || 'http://127.0.0.1:4178/?v3=1'

const viewports = [
  { id: '320x568', width: 320, height: 568 },
  { id: '390x844', width: 390, height: 844 },
  { id: '430x932', width: 430, height: 932 },
  { id: '768x1024', width: 768, height: 1024 },
  { id: '820x1180', width: 820, height: 1180 },
  { id: '834x1194', width: 834, height: 1194 },
  { id: '1024x1366', width: 1024, height: 1366 },
  { id: '1280x800', width: 1280, height: 800 },
  { id: '1440x900', width: 1440, height: 900 },
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
  { view: 'clients', heading: 'Clientes', param: 'client', row: '[aria-label^="Abrir cliente"]', emptyText: 'Sin clientes visibles', workspace: '.v3-client-workspace' },
  { view: 'leads', heading: 'Leads', param: 'lead', row: '[aria-label^="Abrir lead"]', emptyText: 'Sin leads visibles', workspace: '.v3-lead-workspace' },
  { view: 'properties', heading: 'Inmuebles', param: 'property', row: '[aria-label^="Abrir inmueble"]', emptyText: 'Sin inmuebles visibles', workspace: '.v3-property-workspace' },
  { view: 'quotes', heading: 'Presupuestos', param: 'quote', row: '[aria-label^="Abrir presupuesto"]', emptyText: 'Sin presupuestos visibles', workspace: '.v3-quote-workspace' },
  { view: 'jobs', heading: 'Servicios', param: 'job', row: '[aria-label^="Abrir servicio"]', emptyText: 'Sin servicios visibles', workspace: '.v3-job-workspace' },
  { view: 'invoices', heading: 'Facturas', param: 'invoice', row: '[aria-label^="Abrir "]', emptyText: 'Sin facturas visibles', workspace: '.v3-invoice-workspace', showAll: true },
  { view: 'payments', heading: 'Cobros', param: 'payment', row: '[aria-label^="Abrir "]', emptyText: 'Sin cobros visibles', workspace: '.v3-payment-workspace' },
  { view: 'expenses', heading: 'Gastos', param: 'expense', row: '[aria-label^="Abrir "]', emptyText: 'Sin gastos visibles', workspace: '.v3-expense-workspace' },
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
    const entry = recordRequest(state.ledger, request)
    if (entry.environment === 'PRODUCTION_SUPABASE') state.violations.push('production_request')
    if (entry.environment === 'UNKNOWN_SUPABASE') state.violations.push('unknown_supabase_request')
  })
  page.on('response', (response) => recordResponse(state.ledger, response))
  page.on('requestfailed', (request) => {
    recordRequestFailed(state.ledger, request)
  })
  page.on('pageerror', (error) => recordPageError(state.ledger, error))
  page.on('console', (message) => { if (message.type() === 'error') recordConsoleError(state.ledger, message.text()) })
}

async function launchQaContext(metadata, viewport, reducedMotion = false, state = { violations: [], ledger: createNetworkLedger() }) {
  const context = await chromium.launchPersistentContext(metadata.profileDir, {
    executablePath: metadata.executablePath,
    headless: process.env.QA_HEADED !== '1',
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

async function waitForRowsOrEmpty(page, { rowSelector, emptyText }) {
  await page.waitForFunction(({ rowSelector, emptyText }) => {
    const hasRow = Boolean(document.querySelector(rowSelector))
    const body = document.body?.innerText ?? ''
    return hasRow || body.includes(emptyText)
  }, { rowSelector, emptyText }, { timeout: 30000 })
}

async function inspectWorkspace(page, selector, workspaceSelector, { emptyText, heading, inspect } = {}) {
  if (emptyText) await waitForRowsOrEmpty(page, { rowSelector: selector, emptyText })
  const row = page.locator(selector).first()
  if (await row.count() === 0) return { available: false, emptyState: true }
  await row.click()
  await expect(page.locator(workspaceSelector).first()).toBeVisible({ timeout: 15000 })
  const relationCount = await page.locator('.v3-relation-row, .v3-related-links button').count()
  const extra = inspect ? await inspect() : {}
  const back = page.locator('.v3-workspace-back').first().or(page.getByRole('button', { name: 'Volver', exact: true }).first())
  await back.click()
  if (heading) await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible()
  return { available: true, relationCount, ...extra }
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

async function inspectAccessibilityKeyboard(page) {
  const more = page.getByRole('button', { name: 'Más', exact: true }).last()
  await more.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Más módulos' })
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Tab')
  const focusIsInsideDialog = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"][aria-label="Más módulos"]')
    return Boolean(dialog && dialog.contains(document.activeElement))
  })
  expect(focusIsInsideDialog, 'keyboard focus must remain inside the open More dialog').toBe(true)
  await page.keyboard.press('Escape')
  return true
}

async function reopenFirstClientWorkspace(page) {
  await navigateToSurface(page, { id: 'clients', heading: 'Clientes' })
  await waitForRowsOrEmpty(page, { rowSelector: '[aria-label^="Abrir cliente"]', emptyText: 'Sin clientes visibles' })
  const row = page.locator('[aria-label^="Abrir cliente"]').first()
  await expect(row).toHaveCount(1)
  await row.click()
  await expect(page.locator('.v3-client-workspace').first()).toBeVisible({ timeout: 15000 })
}

async function inspectClientRelationNavigation(page, sectionLabel, workspaceSelector) {
  const section = page.locator('.v3-client-workspace .v3-section').filter({ has: page.getByRole('heading', { name: sectionLabel, exact: true }) }).first()
  const relation = section.locator('.v3-relation-row').first()
  if (await relation.count() === 0) return false
  await relation.click()
  await expect(page.locator(workspaceSelector).first()).toBeVisible({ timeout: 15000 })
  return true
}

async function inspectReadOnlyDeepLink(page, definition) {
  await navigateToSurface(page, { id: definition.view, heading: definition.heading })
  if (definition.showAll) await showAllInvoices(page)
  await waitForRowsOrEmpty(page, { rowSelector: definition.row, emptyText: definition.emptyText })
  const row = page.locator(definition.row).first()
  if (await row.count() === 0) return { available: false, emptyState: true }
  await row.click()
  await expect(page.locator(definition.workspace).first()).toBeVisible({ timeout: 15000 })
  const url = new URL(page.url())
  const id = url.searchParams.get(definition.param)
  if (!id) throw new Error(`V3-8_DEEP_LINK_MISSING: ${definition.view}`)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator(definition.workspace).first()).toBeVisible({ timeout: 15000 })
  const back = page.locator('.v3-workspace-back').first().or(page.getByRole('button', { name: 'Volver', exact: true }).first())
  await back.click()
  await expect(page.getByRole('heading', { name: definition.heading, exact: true }).first()).toBeVisible()
  return { available: true, persisted: page.url().includes(`view=${definition.view}`), back: true }
}

async function showAllInvoices(page) {
  const all = page.getByRole('tab', { name: 'Todas', exact: true })
  if (await all.count() === 0) return
  if (await all.getAttribute('aria-selected') !== 'true') await all.click()
}

function assertGeometry(geometry, viewport) {
  expect(geometry.innerWidth).toBe(viewport.width)
  expect(geometry.innerHeight).toBe(viewport.height)
  expect(geometry.clientWidth).toBe(viewport.width)
  expect(geometry.clientHeight).toBe(viewport.height)
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth)
  expect(geometry.rootOverflow).toBe(false)
  expect(geometry.duplicateShell).toBe(false)
  expect(geometry.legacyRuntimeMarkers).toBe(0)
  expect(geometry.visibleUuid).toBe(0)
  expect(geometry.accessibleUuid).toBe(0)
  expect(geometry.unicodeAsIcon).toBe(0)
  expect(geometry.confirmCalls).toBe(0)
  const compact = viewport.width < 1024
  expect(geometry.bottomNavVisible).toBe(compact)
  expect(geometry.railVisible).toBe(!compact)
}

async function runViewport(metadata, viewport) {
  const state = { violations: [], ledger: createNetworkLedger() }
  const { context, page } = await launchQaContext(metadata, viewport, viewport.id === '390x844', state)
  const result = { viewport, surfaces: [], workspaces: {}, deepLinks: {}, screenshots: [], more: false, accessibilityKeyboard: false, reducedMotion: false, serviceWorker: false, manifest: false, geometry: [] }
  try {
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' })
    await waitForAuthenticatedShell(page)
    const actualViewport = await getExactViewportMetrics(page)
    expect(actualViewport).toMatchObject({
      innerWidth: viewport.width,
      innerHeight: viewport.height,
      clientWidth: viewport.width,
      clientHeight: viewport.height,
    })
    const serviceWorkerResponse = await page.request.get(new URL('/notification-sw.js', page.url()).toString())
    result.serviceWorker = serviceWorkerResponse.ok()
    expect(result.serviceWorker).toBe(true)
    result.manifest = await page.locator('link[rel="manifest"]').count() > 0
    expect(result.manifest).toBe(true)
    for (const surface of surfaces) {
      await navigateToSurface(page, surface)
      result.surfaces.push(surface.id)
      const geometry = await collectGeometry(page, viewport, surface.id)
      assertGeometry(geometry, viewport)
      result.geometry.push(geometry)
      if (['dashboard', 'clients', 'invoices'].includes(surface.id)) {
        const file = path.join(releaseReportDir, `${surface.id}-${viewport.id}.png`)
        await page.screenshot({ path: file, fullPage: true })
        result.screenshots.push(path.relative(rootDir, file))
      }
    }
    await navigateToSurface(page, { id: 'clients', heading: 'Clientes' })
    result.workspaces.client = await inspectWorkspace(page, '[aria-label^="Abrir cliente"]', '.v3-client-workspace', {
      emptyText: 'Sin clientes visibles',
      heading: 'Clientes',
      inspect: async () => {
        const clientSection = page.locator('.v3-client-workspace').first()
        const propertySection = clientSection.locator('.v3-section').filter({ has: page.getByRole('heading', { name: 'Inmuebles', exact: true }) }).first()
        const invoiceSection = clientSection.locator('.v3-section').filter({ has: page.getByRole('heading', { name: 'Facturas', exact: true }) }).first()
        const recurringSection = clientSection.locator('.v3-section').filter({ has: page.getByRole('heading', { name: 'Planes recurrentes', exact: true }) }).first()
        const recurringEmptyState = await recurringSection.getByText('Sin planes recurrentes', { exact: true }).count() > 0
        const recurringCreateEntry = await recurringSection.getByRole('button', { name: '+ Nuevo plan', exact: true }).count() > 0
        if (recurringCreateEntry) {
          await recurringSection.getByRole('button', { name: '+ Nuevo plan', exact: true }).click()
          await expect(page.getByRole('dialog', { name: 'Nuevo plan recurrente' })).toBeVisible()
          await page.keyboard.press('Escape')
        }
        const propertyNavigation = await inspectClientRelationNavigation(page, 'Inmuebles', '.v3-property-workspace')
        if (propertyNavigation) await reopenFirstClientWorkspace(page)
        const invoiceNavigation = await inspectClientRelationNavigation(page, 'Facturas', '.v3-invoice-workspace')
        if (invoiceNavigation) await reopenFirstClientWorkspace(page)
        return {
          recurringPlanSection: await recurringSection.count() > 0,
          recurringEmptyState,
          recurringCreateEntry,
          mediaPresentation: await clientSection.locator('[aria-label*="foto de"], .v3-client-avatar').count() > 0,
          propertyRelation: await propertySection.locator('.v3-relation-row').count() > 0,
          invoiceRelation: await invoiceSection.locator('.v3-relation-row').count() > 0,
          propertyNavigation,
          invoiceNavigation,
        }
      },
    })
    if (result.workspaces.client.available) {
      expect(result.workspaces.client.mediaPresentation).toBe(true)
      expect(result.workspaces.client.recurringPlanSection).toBe(true)
      expect(result.workspaces.client.recurringEmptyState).toBe(true)
      expect(result.workspaces.client.recurringCreateEntry).toBe(true)
      expect(result.workspaces.client.propertyRelation).toBe(true)
      expect(result.workspaces.client.invoiceRelation).toBe(true)
      expect(result.workspaces.client.propertyNavigation).toBe(true)
      expect(result.workspaces.client.invoiceNavigation).toBe(true)
    }
    await navigateToSurface(page, { id: 'invoices', heading: 'Facturas' })
    await showAllInvoices(page)
    result.workspaces.invoice = await inspectWorkspace(page, '[aria-label^="Abrir "]', '.v3-invoice-workspace', { emptyText: 'Sin facturas visibles', heading: 'Facturas' })
    await navigateToSurface(page, { id: 'jobs', heading: 'Servicios' })
    result.workspaces.service = await inspectWorkspace(page, '[aria-label^="Abrir servicio"]', '.v3-job-workspace', { emptyText: 'Sin servicios visibles', heading: 'Servicios' })
    await navigateToSurface(page, { id: 'dashboard', heading: 'Negocio hoy' })
    result.more = await inspectMore(page)
    result.accessibilityKeyboard = await inspectAccessibilityKeyboard(page)
    expect(result.accessibilityKeyboard).toBe(true)
    result.reducedMotion = await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    expect(result.reducedMotion).toBe(viewport.id === '390x844')
    for (const definition of deepLinkSurfaces) result.deepLinks[definition.view] = await inspectReadOnlyDeepLink(page, definition)
    result.finalGeometry = await collectGeometry(page, viewport, 'release-final')
    const network = summarizeNetworkLedger(state.ledger)
    if (state.violations.length > 0) throw new Error(`V3-8_NETWORK_GUARD: ${state.violations.join(',')}`)
    expect(network.productionSupabaseRequests).toBe(0)
    expect(network.unknownSupabaseRequests).toBe(0)
    expect(network.qaBusinessWrites).toBe(0)
    expect(network.productionBusinessWrites).toBe(0)
    expect(network.unknownMutations).toBe(0)
    expect(network.pageErrors).toBe(0)
    expect(network.consoleErrors).toBe(0)
    expect(network.failedRequests).toBe(0)
    return { ...result, state: { network, entries: state.ledger.entries, failedRequests: state.ledger.failedRequests } }
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
