import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'

const appUrl = process.env.QA_APP_URL?.trim() || 'http://127.0.0.1:4176/?v3=1'
const cdpEndpoint = process.env.QA_CDP_ENDPOINT?.trim() || 'http://127.0.0.1:9333'
const reportPath = path.resolve('qa-reports/private/financial-cdp-cert.json')
const productionRef = 'wfxnwfcdjainpojhbdri'
const qaRef = 'kpvvydthlxupjjqqdpxy'

function isLoginVisible(text) {
  return /entrar al crm|iniciar sesión|iniciar sesion|login/i.test(text)
}

function assertQaUrl(url) {
  const parsed = new URL(url)
  if (parsed.hostname !== '127.0.0.1' || parsed.port !== '4176' || parsed.searchParams.get('v3') !== '1') {
    throw new Error(`UNSAFE_APP_URL ${url}`)
  }
}

async function writeReport(report) {
  await fs.mkdir(path.dirname(reportPath), { recursive: true })
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
}

const report = {
  appUrl,
  cdpEndpoint,
  qaProject: qaRef,
  productionProject: 'PROHIBITED',
  checks: {},
  sensitiveDataStored: false,
}

assertQaUrl(appUrl)
const browser = await chromium.connectOverCDP(cdpEndpoint)
try {
  const context = browser.contexts()[0]
  if (!context) throw new Error('CDP_CONTEXT_MISSING')
  const page = context.pages().find((candidate) => candidate.url().startsWith('http://127.0.0.1:4176/')) || await context.newPage()

  await page.goto(appUrl, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Inicio', exact: true }).waitFor({ state: 'visible', timeout: 15000 }).catch(() => {})
  const initialText = await page.locator('body').innerText()
  if (isLoginVisible(initialText)) {
    report.checks.authenticated = false
    await writeReport(report)
    console.error('CDP LOGIN REQUIRED')
    process.exitCode = 2
  } else {
    report.checks.authenticated = true
    report.checks.v3Url = page.url().includes('v3=1')
    report.checks.productionTargetAbsent = !page.url().includes(productionRef)

    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Inicio', exact: true }).waitFor({ state: 'visible', timeout: 15000 }).catch(() => {})
    const reloadText = await page.locator('body').innerText()
    report.checks.sessionPersists = !isLoginVisible(reloadText)
    report.checks.shellVisible = ['Inicio', 'Facturas', 'Clientes', 'Servicios'].every((label) => reloadText.includes(label))

    await page.goto(`${new URL(appUrl).origin}/?v3=1&view=quotes`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Presupuestos', exact: true }).waitFor({ state: 'visible', timeout: 15000 })
    const quotesAction = page.getByRole('button', { name: '+ Nuevo presupuesto', exact: true })
    await quotesAction.waitFor({ state: 'visible', timeout: 15000 })
    await quotesAction.click()
    await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 15000 })
    report.checks.quoteCreateSheet = true
    await page.keyboard.press('Escape')
    report.checks.quoteEscape = await page.getByRole('dialog').count() === 0
    report.checks.cdpHarnessReady = Object.values(report.checks).every(Boolean)
    await writeReport(report)
    console.log(JSON.stringify({ cdpHarnessReady: report.checks.cdpHarnessReady, reportPath }))
  }
} catch (error) {
  report.error = error instanceof Error ? error.message : 'CDP_HARNESS_FAILED'
  await writeReport(report)
  throw error
} finally {
  await browser.close()
}
