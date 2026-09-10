import fs from 'node:fs/promises'
import { chromium } from '@playwright/test'

const baseUrl = process.env.QA_APP_URL?.trim() || 'http://127.0.0.1:4174'
const credentialPath = process.env.CP3C3_CREDENTIALS_PATH || '.auth/cp3c3/credentials.json'
const viewports = [
  ['390x844', 390, 844],
  ['768x1024', 768, 1024],
  ['1440x900', 1440, 900],
]
const routes = [
  ['home', '/portal'],
  ['properties', '/portal/properties'],
  ['property-detail', '/portal/properties/property-preview-north'],
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
    for (const [viewport, width, height] of viewports) {
      const context = await browser.newContext({ viewport: { width, height } })
      const page = await context.newPage()
      const consoleErrors = []
      const productionRequests = []
      page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 160)) })
      page.on('request', (request) => { if (request.url().includes('wfxnwfcdjainpojhbdri')) productionRequests.push(request.url().split('/').pop()) })
      try {
        await page.goto(`${baseUrl}/portal/login`, { waitUntil: 'domcontentloaded', timeout: 20000 })
        await page.getByLabel('Email', { exact: true }).fill(identity.email)
        await page.getByLabel('Contraseña', { exact: true }).fill(identity.password)
        await page.getByRole('button', { name: 'Entrar', exact: true }).click()
        await page.waitForTimeout(1200)
        const body = await page.locator('body').innerText()
        for (const [route, path] of routes) {
          await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 })
          await page.waitForTimeout(250)
          const layout = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, html: document.documentElement.scrollWidth, body: document.body.scrollWidth }))
          results.push({ identity: alias, viewport, route, reached: !page.url().includes('/portal/login'), overflow: layout.html > layout.width || layout.body > layout.width, consoleErrors: consoleErrors.length, productionRequests: productionRequests.length, roleVisible: body.includes('Administrador') || body.includes('Miembro') })
          consoleErrors.length = 0
          productionRequests.length = 0
        }
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

const failures = results.filter((result) => result.status === 'FAIL' || result.reached === false || result.overflow || result.consoleErrors > 0 || result.productionRequests > 0)
console.log(JSON.stringify({ status: failures.length === 0 ? 'PASS' : 'FAIL', results, failures: failures.length }))
