import fs from 'node:fs/promises'
import { chromium } from '@playwright/test'

const baseUrl = process.env.QA_APP_URL?.trim() || 'http://127.0.0.1:4174'
const credentialPath = process.env.CP3C3_CREDENTIALS_PATH || '.auth/cp3c3/credentials.json'
const viewports = {
  ADMIN_A: [['390x844', 390, 844], ['768x1024', 768, 1024], ['1440x900', 1440, 900]],
  MEMBER_A_V2: [['390x844', 390, 844], ['1440x900', 1440, 900]],
  ADMIN_B_V2: [['390x844', 390, 844], ['1440x900', 1440, 900]],
  SUSPENDED_OR_INACTIVE_A: [['390x844', 390, 844]],
  REVOKED_A: [['390x844', 390, 844]],
}
const coreRoutes = [
  ['home', '/portal'],
  ['properties', '/portal/properties'],
  ['services', '/portal/services'],
  ['invoices', '/portal/invoices'],
  ['account', '/portal/account'],
  ['members', '/portal/members'],
]

async function readCredentials() {
  try {
    const raw = await fs.readFile(credentialPath, 'utf8')
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') throw new Error('invalid_credentials_file')
    return parsed
  } catch {
    return null
  }
}

const credentials = await readCredentials()
if (!credentials) {
  console.log(JSON.stringify({
    status: 'NOT_EXECUTED_PRIVATE_CREDENTIAL_INPUT_MISSING',
    credentialPath,
    privateFileTracked: false,
    results: [],
  }))
  process.exit(2)
}

const identities = ['ADMIN_A', 'MEMBER_A_V2', 'ADMIN_B_V2', 'SUSPENDED_OR_INACTIVE_A', 'REVOKED_A']
const browser = await chromium.launch({ headless: process.env.CP3C3_HEADLESS !== '0' })
const results = []
try {
  for (const alias of identities) {
    const identity = credentials[alias]
    if (!identity || typeof identity.email !== 'string' || typeof identity.password !== 'string') {
      results.push({ identity: alias, status: 'MISSING_PRIVATE_CREDENTIAL' })
      continue
    }
    for (const [viewport, width, height] of viewports[alias]) {
      const context = await browser.newContext({ viewport: { width, height } })
      const page = await context.newPage()
      const consoleErrors = []
      const productionRequests = []
      const unexpectedSupabaseHosts = []
      page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 160)) })
      page.on('request', (request) => {
        const url = new URL(request.url())
        if (url.hostname === 'wfxnwfcdjainpojhbdri.supabase.co') productionRequests.push(url.pathname)
        if (url.hostname.endsWith('.supabase.co') && url.hostname !== 'kpvvydthlxupjjqqdpxy.supabase.co') {
          unexpectedSupabaseHosts.push(url.hostname)
        }
      })
      try {
        await page.goto(`${baseUrl}/portal/login`, { waitUntil: 'domcontentloaded', timeout: 20000 })
        await page.getByLabel('Email', { exact: true }).fill(identity.email)
        await page.getByLabel('Contraseña', { exact: true }).fill(identity.password)
        await page.getByRole('button', { name: 'Entrar', exact: true }).click()
        await page.waitForTimeout(4000)
        const loginBody = await page.locator('body').innerText()
        const expectedBlockedText = alias === 'SUSPENDED_OR_INACTIVE_A'
          ? 'Tu cuenta está suspendida'
          : 'Tu acceso ha sido revocado'
        if (alias === 'SUSPENDED_OR_INACTIVE_A' || alias === 'REVOKED_A') {
          results.push({ identity: alias, viewport, route: 'access-state', reached: loginBody.includes(expectedBlockedText), overflow: false, consoleErrors: consoleErrors.length, productionRequests: productionRequests.length, unexpectedSupabaseHosts: [...new Set(unexpectedSupabaseHosts)], protectedContent: /Facturas|Propiedades|Servicios|Miembros/u.test(loginBody) })
          continue
        }
        if (!loginBody.includes('Hola, Acceso seguro')) throw new Error('active_authenticated_state_not_detected')
        let propertyDetailPath = null
        for (const [route, path] of coreRoutes) {
          await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 })
          await page.waitForTimeout(400)
          const layout = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, html: document.documentElement.scrollWidth, body: document.body.scrollWidth }))
          const body = await page.locator('body').innerText()
          if (route === 'properties') propertyDetailPath = await page.locator('a[href^="/portal/properties/"]').first().getAttribute('href').catch(() => null)
          const memberAdminDenied = alias === 'MEMBER_A_V2' && route === 'members'
            ? !/Invitar|Revocar|Administrar miembros/u.test(body)
            : undefined
          results.push({ identity: alias, viewport, route, reached: !page.url().includes('/portal/login'), overflow: layout.html > layout.width || layout.body > layout.width, consoleErrors: consoleErrors.length, productionRequests: productionRequests.length, unexpectedSupabaseHosts: [...new Set(unexpectedSupabaseHosts)], ...(memberAdminDenied === undefined ? {} : { memberAdminDenied }) })
          consoleErrors.length = 0
          productionRequests.length = 0
          unexpectedSupabaseHosts.length = 0
        }
        if (!propertyDetailPath) throw new Error('authenticated_property_detail_not_discovered')
        await page.goto(`${baseUrl}${propertyDetailPath}`, { waitUntil: 'domcontentloaded', timeout: 20000 })
        await page.waitForTimeout(400)
        const detailLayout = await page.evaluate(() => ({ width: innerWidth, html: document.documentElement.scrollWidth, body: document.body.scrollWidth }))
        results.push({ identity: alias, viewport, route: 'property-detail', reached: !page.url().includes('/portal/login'), overflow: detailLayout.html > detailLayout.width || detailLayout.body > detailLayout.width, consoleErrors: consoleErrors.length, productionRequests: productionRequests.length, unexpectedSupabaseHosts: [...new Set(unexpectedSupabaseHosts)] })
      } catch (error) {
        results.push({ identity: alias, viewport, status: 'FAIL', error: String(error.message).slice(0, 160) })
      } finally {
        await context.close()
      }
    }
  }
} finally {
  await browser.close()
}

const failures = results.filter((result) => result.status === 'FAIL' || result.reached === false || result.overflow || result.consoleErrors > 0 || result.productionRequests > 0 || result.unexpectedSupabaseHosts?.length || result.protectedContent || result.memberAdminDenied === false)
console.log(JSON.stringify({ status: failures.length === 0 ? 'PASS' : 'FAIL', results, failures: failures.length }))
