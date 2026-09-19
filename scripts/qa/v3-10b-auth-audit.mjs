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
  { id: '820x1180', width: 820, height: 1180 }, { id: '834x1194', width: 834, height: 1194 },
  { id: '1280x800', width: 1280, height: 800 }, { id: '1920x1080', width: 1920, height: 1080 },
]
const fullViewportCount = viewports.length
const fullSurfaceCount = surfaces.length
const searchRowSelectors = {
  clients: '[aria-label^="Abrir cliente"]', leads: '[aria-label^="Abrir lead"]', properties: '[aria-label^="Abrir inmueble"]',
  quotes: '[aria-label^="Abrir presupuesto"]', jobs: '[aria-label^="Abrir servicio"]', invoices: '[aria-label^="Abrir "]',
  payments: '[aria-label^="Abrir "]', expenses: '[aria-label^="Abrir "]',
}
const searchMissToken = '__V3_10B2_NO_MATCH_7F4C2A__'
const auditSettleMs = Number(process.env.V3_10B_SETTLE_MS ?? 1500)
const auditRowTimeoutMs = Number(process.env.V3_10B_ROW_TIMEOUT_MS ?? 5000)

function buildUrl(view) {
  const url = new URL(qaAppUrl)
  url.searchParams.set('v3', '1')
  url.searchParams.set('view', view)
  return url.toString()
}

function sanitizeUrl(rawUrl) {
  const url = new URL(rawUrl)
  for (const key of [...url.searchParams.keys()]) {
    if (!['v3', 'view'].includes(key)) url.searchParams.set(key, '[redacted]')
  }
  return url.toString()
}

async function visibleCount(page, selector) {
  return page.locator(selector).evaluateAll((nodes) => nodes.filter((node) => {
    const rect = node.getBoundingClientRect(); const style = getComputedStyle(node)
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
  }).length)
}

async function waitForVisibleRows(page, selector, timeout = auditRowTimeoutMs) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await visibleCount(page, selector) > 0) return true
    await page.waitForTimeout(250)
  }
  return false
}

async function navigateWithEvidence(page, requestedUrl, statusRef, timeout = 10000) {
  const navigationResponses = []
  const onResponse = (response) => {
    const request = response.request()
    if (request.isNavigationRequest() && request.resourceType() === 'document' && request.frame() === page.mainFrame()) navigationResponses.push(response)
  }
  page.on('response', onResponse)
  let gotoResponse = null
  try {
    gotoResponse = await page.goto(requestedUrl, { waitUntil: 'domcontentloaded', timeout })
  } finally {
    page.off('response', onResponse)
  }
  const documentResponse = navigationResponses.at(-1) ?? (gotoResponse?.request().resourceType() === 'document' ? gotoResponse : null)
  const observedStatus = documentResponse?.status() ?? null
  const originalStatus = statusRef.originalDocumentStatus ?? observedStatus
  if (statusRef.originalDocumentStatus == null && observedStatus != null) statusRef.originalDocumentStatus = observedStatus
  return {
    requestedUrl: sanitizeUrl(requestedUrl),
    finalUrl: sanitizeUrl(page.url()),
    mainDocumentHttpStatus: observedStatus ?? originalStatus,
    statusSource: observedStatus != null ? 'NAVIGATION_DOCUMENT' : originalStatus != null ? 'ORIGINAL_DOCUMENT' : 'NOT_OBSERVED',
    navigationClassification: observedStatus != null ? 'DOCUMENT_RESPONSE' : 'CLIENT_SIDE_NAVIGATION_NO_DOCUMENT_RESPONSE',
  }
}

async function inspectSearchMiss(page, view) {
  const selector = searchRowSelectors[view]
  const searchInput = page.locator('input[type="search"]').first()
  if (!selector || await searchInput.count() === 0) return { status: 'N/A', reason: 'NO_SEARCH_CONTROL' }
  await waitForVisibleRows(page, selector)
  const initialVisibleCount = await visibleCount(page, selector)
  if (initialVisibleCount === 0) return { status: 'N/A', reason: 'NO_EXISTING_RECORDS', initialVisibleCount }
  await searchInput.fill(searchMissToken); await page.waitForTimeout(300)
  const inputValue = await searchInput.inputValue()
  const filteredVisibleCount = await visibleCount(page, selector)
  const bodyText = await page.locator('body').innerText()
  const explicitNoResults = /sin\s+(?:clientes|leads|inmuebles|presupuestos|servicios|facturas|cobros|gastos)\s+visibles|sin\s+resultados|no\s+hay\s+resultados|ning[uú]n\s+resultado/iu.test(bodyText)
  const accessibleZeroState = await page.locator('[role="status"], [aria-live="polite"], [aria-live="assertive"]').evaluateAll((nodes) => nodes.some((node) => {
    const rect = node.getBoundingClientRect(); const style = getComputedStyle(node)
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && (node.textContent ?? '').trim().length > 0
  }))
  await searchInput.fill(''); await page.waitForTimeout(300)
  const restoredVisibleCount = await visibleCount(page, selector)
  const assertions = {
    inputContainsToken: inputValue === searchMissToken,
    noMatchingRows: filteredVisibleCount === 0,
    explicitNoResults,
    accessibleZeroState,
    validZeroState: explicitNoResults || accessibleZeroState,
    restoredOriginalState: restoredVisibleCount === initialVisibleCount,
  }
  return {
    status: assertions.inputContainsToken && assertions.noMatchingRows && assertions.validZeroState && assertions.restoredOriginalState ? 'PASS' : 'FAIL',
    initialVisibleCount, filteredVisibleCount, restoredVisibleCount, assertions,
  }
}

async function inspectSearchRoundtrip(page) {
  const searchInput = page.locator('input[type="search"]').first()
  const rows = page.locator(searchRowSelectors.clients)
  if (await searchInput.count() === 0 || await rows.count() === 0) return 'N/A'
  const seedText = (await rows.first().innerText()).trim().split(/\s+/u).find((token) => token.length >= 3)
  if (!seedText) return 'N/A'
  await searchInput.fill(seedText); await page.waitForTimeout(300)
  const filteredRows = page.locator(searchRowSelectors.clients)
  if (await filteredRows.count() === 0) return 'FAIL'
  await filteredRows.first().click(); await page.waitForTimeout(500)
  if (await page.locator(workspaceSelectors.clients).count() === 0) return 'FAIL'
  const back = page.locator('.v3-workspace-back').first().or(page.getByRole('button', { name: 'Volver', exact: true }).first())
  if (await back.count() === 0) return 'FAIL'
  await back.click(); await page.waitForTimeout(500)
  const returnedInput = page.locator('input[type="search"]').first()
  const returnedValue = await returnedInput.count() > 0 ? await returnedInput.inputValue() : ''
  return returnedValue === seedText && await visibleCount(page, searchRowSelectors.clients) > 0 ? 'PASS' : 'FAIL'
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
      authenticatedShell: !document.querySelector('input[type="password"]') && (bodyText.includes('Negocio hoy') || ['Inicio', 'Clientes', 'Facturas', 'Servicios'].filter((label) => bodyText.includes(label)).length >= 2),
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

async function inspectSurface(page, view, expectedHeading, statusRef) {
  const result = { view, expectedHeading, navigation: 'NOT_EXECUTED', navigationEvidence: null, authenticatedShell: false, viewReady: false, heading: false, workspace: 'NOT_EXECUTED', search: 'NOT_EXECUTED', deepLinkBack: 'NOT_EXECUTED', geometry: null, error: null }
  try {
    const targetView = view === 'recurring' ? 'clients' : view
    result.navigationEvidence = await navigateWithEvidence(page, buildUrl(targetView), statusRef)
    await page.waitForTimeout(auditSettleMs)
    result.navigation = 'PASS'
    const headingLocator = page.getByRole('heading', { name: expectedHeading, exact: true }).first()
    try { await headingLocator.waitFor({ state: 'visible', timeout: 5000 }) } catch {}
    result.heading = await headingLocator.count() > 0
    result.viewReady = result.heading
    result.geometry = await geometry(page)
    result.authenticatedShell = result.geometry.authenticatedShell
    if (view === 'recurring') {
      const clientRow = page.locator('[aria-label^="Abrir cliente"]').first()
      if (await clientRow.count() > 0) {
        await clientRow.click(); await page.waitForTimeout(750)
        const section = page.locator('.v3-client-workspace .v3-section').filter({ hasText: 'Planes recurrentes' }).first()
        result.workspace = await section.count() > 0 ? 'PASS_VIA_CLIENT_WORKSPACE' : 'NOT_FOUND'
        result.heading = await section.count() > 0
        result.viewReady = result.heading
      } else result.workspace = 'EMPTY_OR_NOT_AVAILABLE'
      result.search = 'N/A'
      return result
    }
    const rowSelector = searchRowSelectors[view]
    if (rowSelector) {
      await waitForVisibleRows(page, rowSelector)
      const row = page.locator(rowSelector).first()
      if (await row.count() > 0) {
        await row.click()
        await page.waitForTimeout(500)
        result.workspace = await page.locator(workspaceSelectors[view]).count() > 0 ? 'PASS' : 'NOT_FOUND'
        const workspaceUrl = page.url()
        await page.reload({ waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(auditSettleMs)
        const back = page.locator('.v3-workspace-back').first().or(page.getByRole('button', { name: 'Volver', exact: true }).first())
        if (await back.count() > 0) { await back.click(); await page.waitForTimeout(750) }
        result.deepLinkBack = { deepLinkPresent: /(?:client|lead|property|quote|job|invoice|payment|expense)=/u.test(workspaceUrl), backVisible: await page.getByRole('heading', { name: expectedHeading, exact: true }).first().count() > 0 }
      } else result.workspace = 'EMPTY_OR_NOT_AVAILABLE'
    } else result.workspace = 'N/A'
    result.search = await inspectSearchMiss(page, view)
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
  }
  return result
}

async function runViewport(metadata, viewport, sharedContext = null) {
  const state = { productionRequests: [], nonQaSupabaseRequests: [], qaMutations: [], failedRequests: [], consoleErrors: [], pageErrors: [] }
  const context = sharedContext ?? await chromium.launchPersistentContext(metadata.profileDir, {
    ...(metadata.executablePath ? { executablePath: metadata.executablePath } : {}),
    headless: true,
    viewport: { width: viewport.width, height: viewport.height },
    serviceWorkers: 'allow',
    reducedMotion: viewport.id === '390x844' ? 'reduce' : 'no-preference',
  })
  const page = await context.newPage()
  await context.emulateMedia({ reducedMotion: viewport.id === '390x844' ? 'reduce' : 'no-preference' })
  if (sharedContext) await page.setViewportSize({ width: viewport.width, height: viewport.height })
  page.on('request', (request) => {
    const url = request.url(); const method = request.method()
    if (url.includes(productionProjectRef)) state.productionRequests.push({ method })
    if (url.includes('.supabase.co') && !url.includes(qaProjectRef)) state.nonQaSupabaseRequests.push({ method })
    const isDataMutation = url.includes('.supabase.co') && !['GET', 'HEAD', 'OPTIONS'].includes(method) && !url.includes('/auth/v1/') && !url.includes('/storage/v1/object/sign')
    if (isDataMutation) state.qaMutations.push({ method })
  })
  page.on('requestfailed', (request) => state.failedRequests.push({ resource: request.resourceType() }))
  page.on('console', (message) => { if (message.type() === 'error') state.consoleErrors.push(message.text().slice(0, 160)) })
  page.on('pageerror', (error) => state.pageErrors.push(error.message.slice(0, 160)))
  const statusRef = { originalDocumentStatus: null }
  const result = { viewport, state, surfaces: [], more: 'NOT_EXECUTED', keyboard: 'NOT_EXECUTED', escapeOpenAssertion: 'NOT_EXECUTED', escapeCloseAssertion: 'NOT_EXECUTED', focusRestoration: 'NOT_EXECUTED', searchRoundtrip: 'NOT_EXECUTED', finalGeometry: null }
  try {
    result.initialNavigationEvidence = await navigateWithEvidence(page, buildUrl('dashboard'), statusRef); await page.waitForTimeout(auditSettleMs)
    result.authenticated = (await geometry(page)).authenticatedShell
    for (const [view, heading] of surfaces) result.surfaces.push(await inspectSurface(page, view, heading, statusRef))
    result.searchRoundtripNavigationEvidence = await navigateWithEvidence(page, buildUrl('clients'), statusRef); await page.waitForTimeout(auditSettleMs)
    result.searchRoundtrip = await inspectSearchRoundtrip(page)
    result.finalNavigationEvidence = await navigateWithEvidence(page, buildUrl('dashboard'), statusRef); await page.waitForTimeout(auditSettleMs)
    const more = page.getByRole('button', { name: 'Más', exact: true }).last()
    if (await more.count() > 0) {
      await more.focus(); await more.click(); await page.waitForTimeout(250)
      const dialog = page.getByRole('dialog', { name: 'Más módulos' })
      const dialogCountBefore = await page.locator('[role="dialog"][aria-label="Más módulos"]').evaluateAll((nodes) => nodes.filter((node) => {
        const rect = node.getBoundingClientRect(); const style = getComputedStyle(node)
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
      }).length)
      result.more = dialogCountBefore > 0 ? 'PASS' : 'NOT_FOUND'
      result.escapeOpenAssertion = dialogCountBefore > 0 && await dialog.count() > 0 ? 'PASS' : 'FAIL'
      await page.keyboard.press('Escape'); await page.waitForTimeout(100)
      const dialogCountAfter = await page.locator('[role="dialog"][aria-label="Más módulos"]').evaluateAll((nodes) => nodes.filter((node) => {
        const rect = node.getBoundingClientRect(); const style = getComputedStyle(node)
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
      }).length)
      result.escapeCloseAssertion = dialogCountAfter === 0 ? 'PASS' : 'FAIL'
      result.focusRestoration = await page.evaluate(() => {
        const active = document.activeElement
        const button = active?.closest('button')
        return button?.getAttribute('aria-label') === 'Más' || button?.textContent?.trim() === 'Más'
      }) ? 'PASS' : 'N/A'
      result.keyboard = result.escapeCloseAssertion
    } else {
      result.more = 'N/A'; result.keyboard = 'N/A'; result.escapeOpenAssertion = 'N/A'; result.escapeCloseAssertion = 'N/A'; result.focusRestoration = 'N/A'
    }
    result.finalGeometry = await geometry(page)
  } catch (error) { result.error = error instanceof Error ? error.message : String(error) }
  await page.close()
  if (!sharedContext) await context.close()
  return result
}

async function main() {
  const metadata = JSON.parse(await fs.readFile(authMetadataPath, 'utf8'))
  const report = { gate: 'V3-10B.2', mode: 'authenticated-read-only', qaProject: qaProjectRef, productionProject: productionProjectRef, results: [], auth: 'NOT_EXECUTED' }
  const selectedViewportIds = new Set(process.env.V3_10B_VIEWPORTS ? process.env.V3_10B_VIEWPORTS.split(',').map((value) => value.trim()).filter(Boolean) : viewports.map((viewport) => viewport.id))
  const selectedSurfaceIds = new Set(process.env.V3_10B_SURFACES ? process.env.V3_10B_SURFACES.split(',').map((value) => value.trim()).filter(Boolean) : surfaces.map(([view]) => view))
  const originalSurfaces = surfaces.slice()
  surfaces.splice(0, surfaces.length, ...originalSurfaces.filter(([view]) => selectedSurfaceIds.has(view)))
  const selectedViewports = viewports.filter((candidate) => selectedViewportIds.has(candidate.id))
  const sharedContext = await chromium.launchPersistentContext(metadata.profileDir, {
    ...(metadata.executablePath ? { executablePath: metadata.executablePath } : {}),
    headless: true,
    viewport: null,
    serviceWorkers: 'allow',
  })
  try {
    for (const viewport of selectedViewports) report.results.push(await runViewport(metadata, viewport, sharedContext))
  } finally {
    await sharedContext.close()
  }
  report.auth = report.results.every((result) => result.authenticated) ? 'PASS' : 'FAIL'
  const navigationEvidence = report.results.flatMap((result) => [result.initialNavigationEvidence, ...result.surfaces.map((surface) => surface.navigationEvidence), result.searchRoundtripNavigationEvidence, result.finalNavigationEvidence].filter(Boolean))
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
    documentNavigations: navigationEvidence.length,
    mainDocumentHttp200: navigationEvidence.filter((navigation) => navigation.mainDocumentHttpStatus === 200).length,
    clientSideNavigationNoDocumentResponse: navigationEvidence.filter((navigation) => navigation.navigationClassification === 'CLIENT_SIDE_NAVIGATION_NO_DOCUMENT_RESPONSE').length,
    mainDocumentStatusNotObserved: navigationEvidence.filter((navigation) => navigation.mainDocumentHttpStatus == null).length,
    searchMissPass: report.results.flatMap((result) => result.surfaces).filter((surface) => surface.search?.status === 'PASS').length,
    searchMissNA: report.results.flatMap((result) => result.surfaces).filter((surface) => surface.search?.status === 'N/A').length,
    searchMissFail: report.results.flatMap((result) => result.surfaces).filter((surface) => surface.search?.status === 'FAIL').length,
    searchRoundtripPass: report.results.filter((result) => result.searchRoundtrip === 'PASS').length,
    escapeOpenAssertionPass: report.results.filter((result) => result.escapeOpenAssertion === 'PASS').length,
    escapeCloseAssertionPass: report.results.filter((result) => result.escapeCloseAssertion === 'PASS').length,
    focusRestorationPass: report.results.filter((result) => result.focusRestoration === 'PASS').length,
    focusRestorationNA: report.results.filter((result) => result.focusRestoration === 'N/A').length,
    touchTargetMeasurements: report.results.flatMap((result) => [result.finalGeometry?.contactActions ?? [], ...result.surfaces.map((surface) => surface.geometry?.contactActions ?? [])]).flat(),
  }
  const surfaceResults = report.results.flatMap((result) => result.surfaces)
  report.summary.expectedViewportCount = fullViewportCount
  report.summary.expectedSurfaceCount = fullViewportCount * fullSurfaceCount
  report.summary.fullMatrixSelectionPass = report.results.length === fullViewportCount && surfaces.length === fullSurfaceCount
  report.summary.surfaceCountPass = surfaceResults.length === report.summary.expectedSurfaceCount
  report.summary.authenticatedPass = report.auth === 'PASS' && report.results.every((result) => result.authenticated)
  report.summary.surfaceNavigationPass = surfaceResults.every((surface) => surface.navigation === 'PASS')
  report.summary.surfaceReadinessPass = surfaceResults.every((surface) => surface.heading && surface.authenticatedShell && !surface.error)
  report.summary.httpStatusPass = report.summary.documentNavigations > 0 && report.summary.mainDocumentHttp200 === report.summary.documentNavigations && report.summary.clientSideNavigationNoDocumentResponse === 0 && report.summary.mainDocumentStatusNotObserved === 0
  report.summary.safetyPass = report.summary.productionRequests === 0 && report.summary.nonQaSupabaseRequests === 0 && report.summary.qaMutations === 0
  report.summary.errorPass = report.summary.consoleErrors === 0 && report.summary.pageErrors === 0 && report.summary.failedRequests === 0 && report.summary.surfaceErrors === 0
  report.summary.overflowPass = report.summary.overflowViewports === 0
  report.summary.escapeAssertionsPass = report.summary.escapeOpenAssertionPass === report.results.length && report.summary.escapeCloseAssertionPass === report.results.length
  report.summary.forcedFailure = process.env.V3_10B_FORCE_FAIL === '1'
  report.summary.auditPass = !report.summary.forcedFailure && report.summary.fullMatrixSelectionPass && report.summary.surfaceCountPass && report.summary.authenticatedPass && report.summary.surfaceNavigationPass && report.summary.surfaceReadinessPass && report.summary.httpStatusPass && report.summary.safetyPass && report.summary.errorPass && report.summary.overflowPass && report.summary.searchMissFail === 0 && report.summary.escapeAssertionsPass
  await fs.mkdir(reportDir, { recursive: true }); await fs.writeFile(path.join(reportDir, 'v3-10b-auth-audit.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  process.stdout.write(`${JSON.stringify({ ...report.summary, searchAssertionStatus: report.summary.searchMissFail === 0 ? 'PASS' : 'PARTIAL' })}\n`)
  process.exit(report.summary.auditPass ? 0 : 2)
}

main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`); process.exit(1) })
