import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { verifyInternalStaffAuthorization } from './qaInternalStaffAuth.mjs'
import { parseQaPrivateEnv, requireQaAuthCredentials } from './qaPrivateEnv.mjs'

const rootDir = process.cwd()
const appUrl = process.env.QA_APP_URL?.trim() || 'http://127.0.0.1:5173/'
const qaEnv = parseQaPrivateEnv(fs.readFileSync('.env.qa.local', 'utf8'))
const { email, password } = requireQaAuthCredentials({
  processEnv: process.env,
  qaEnv,
  preferPrivateFile: process.env.QA_AUTH_PREFER_PRIVATE_FILE === '1',
})
if (!qaEnv.VITE_SUPABASE_URL || !qaEnv.VITE_SUPABASE_ANON_KEY) throw new Error('QA_PUBLIC_CONFIG_MISSING')

const viewports = [
  { id: '390x844', width: 390, height: 844 },
  { id: '768x1024', width: 768, height: 1024 },
  { id: 'desktop', width: 1366, height: 900 },
]
const views = [
  { id: 'invoices', label: 'Facturas', create: 'Nueva factura', title: 'Nueva factura' },
  { id: 'quotes', label: 'Presupuestos', create: 'Nuevo presupuesto', title: 'Nuevo presupuesto' },
]

function reportPath(name) {
  return path.join(rootDir, 'qa-reports', 'private', name)
}

async function authenticateQa() {
  const client = createClient(qaEnv.VITE_SUPABASE_URL, qaEnv.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: authData, error: authError } = await client.auth.signInWithPassword({ email, password })
  if (authError || !authData.session || !authData.user) throw new Error(`QA_AUTH_FAILED ${authError?.message || 'missing_session'}`)
  const authorization = await verifyInternalStaffAuthorization(client)
  if (!authorization.authorized) throw new Error('QA_MEMBERSHIP_FAILED')
  return { session: authData.session, userId: authData.user.id }
}

async function login(page) {
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => {
    const body = document.body?.innerText || ''
    return body.includes('Facturas') && !body.includes('Entrar al CRM')
  }, undefined, { timeout: 30000 })
}

async function auditView(page, viewport, view) {
  await page.goto(`${appUrl}?view=${view.id}`, { waitUntil: 'domcontentloaded' })
  await page.getByText(view.label, { exact: true }).first().waitFor({ state: 'visible', timeout: 30000 })
  await page.getByRole('button', { name: view.create, exact: true }).first().waitFor({ state: 'visible', timeout: 30000 })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  if (overflow) throw new Error(`${viewport.id}/${view.id}: horizontal_overflow`)
  const action = page.getByRole('button', { name: view.create, exact: true }).first()
  await action.click()
  await page.getByText(view.title, { exact: true }).first().waitFor({ state: 'visible', timeout: 30000 })
  await page.keyboard.press('Escape')
  return { viewport: viewport.id, view: view.id, overflow, createFlow: true }
}

const browser = await chromium.launch({ headless: true })
const results = []
let qaUserId
try {
  const { session, userId } = await authenticateQa()
  qaUserId = userId
  const storageState = { cookies: [], origins: [{ origin: new URL(appUrl).origin, localStorage: [{ name: `sb-${new URL(qaEnv.VITE_SUPABASE_URL).hostname.split('.')[0]}-auth-token`, value: JSON.stringify(session) }] }] }

  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, storageState })
    const page = await context.newPage()
    try {
      await login(page)
      for (const view of views) results.push(await auditView(page, viewport, view))
    } catch (error) {
      await fsp.mkdir(path.dirname(reportPath('')), { recursive: true })
      await page.screenshot({ path: reportPath(`playwright-${viewport.id}-failure.png`), fullPage: true })
      throw error
    } finally {
      await context.close()
    }
  }
} finally {
  await browser.close()
}

await fsp.mkdir(path.dirname(reportPath('')), { recursive: true })
await fsp.writeFile(reportPath('playwright-financial-cert-latest.json'), `${JSON.stringify({ appUrl, qaUserId, results }, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ browser: 'playwright-chromium', qaAuth: 'pass', results: results.length, pass: true }))
