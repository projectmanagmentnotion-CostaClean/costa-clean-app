import { expect, test } from '@playwright/test'
import { createQaFinancialFixtures } from '../financial/qaFinancialFixtures.mjs'

const qaUrl = process.env.VITE_SUPABASE_URL
const authStorageKey = `sb-${new URL(qaUrl).hostname.split('.')[0]}-auth-token`
const invoiceRuleId = 'unpaid-invoices-older-threshold'

function issueDateOutsideThreshold() {
  const date = new Date()
  date.setDate(date.getDate() - 30)
  return date.toISOString().slice(0, 10)
}

async function openAuthenticated(page, fixtures, view = 'home') {
  await page.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), {
    key: authStorageKey,
    session: fixtures.session,
  })
  await page.goto(`/?view=${view}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: /Alertas:/u }).first()).toBeVisible({ timeout: 30000 })
}

async function readDecision(fixtures) {
  const { data, error } = await fixtures.client
    .from('operational_alert_decisions')
    .select('scope,status,read_at,resolved_at,dismissed_at')
    .eq('alert_key', invoiceRuleId)
    .eq('scope', 'user')
    .order('updated_at', { ascending: false })
    .limit(1)
  if (error) throw new Error(`decision readback failed: ${error.message}`)
  return data?.[0] ?? null
}

test.describe('alert system QA with isolated authenticated fixtures', () => {
  let fixtures
  let invoice

  test.beforeEach(async () => {
    fixtures = await createQaFinancialFixtures()
    const owner = await fixtures.clientFixture('alert-client')
    invoice = await fixtures.invoiceFixture(owner, null, null, 'alert-overdue', { issueDate: issueDateOutsideThreshold() })
  })

  test.afterEach(async () => {
    if (fixtures) await fixtures.cleanup()
  })

  test('bell badge, read state, keyboard focus and exact invoice navigation', async ({ page }) => {
    await openAuthenticated(page, fixtures)
    const trigger = page.getByRole('button', { name: /Alertas:/u }).first()
    await expect(trigger).toHaveAttribute('aria-label', /Alertas: [1-9]\d* nuevas, \d+ pendientes/u)
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'Alertas recientes' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Facturas pendientes fuera de plazo interno', { exact: true })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()

    await trigger.click()
    await dialog.getByRole('button', { name: /Facturas pendientes fuera de plazo interno/u }).click()
    await expect(page).toHaveURL(/view=invoices/u)
    await expect.poll(() => readDecision(fixtures)).toMatchObject({ scope: 'user', read_at: expect.any(String) })
    await page.goto('/?view=alerts', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: /Alertas: \d+ nuevas, \d+ pendientes/u }).first()).toBeVisible()
    await expect(page.locator('body')).toContainText('Facturas pendientes fuera de plazo interno')
  })

  test('payment resolves the overdue condition across surfaces and refresh', async ({ page }) => {
    await openAuthenticated(page, fixtures)
    await expect(page.locator('body')).toContainText('Facturas pendientes fuera de plazo interno')
    await fixtures.settleInvoice(invoice.id)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('body')).not.toContainText('Facturas pendientes fuera de plazo interno')
    await page.getByRole('button', { name: /Alertas:/u }).first().click()
    await expect(page.getByRole('dialog', { name: 'Alertas recientes' })).not.toContainText('Facturas pendientes fuera de plazo interno')
  })

  test('alert surfaces stay within responsive viewport and alert center is keyboard reachable', async ({ page }) => {
    for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1366, height: 900 }]) {
      await page.setViewportSize(viewport)
      await openAuthenticated(page, fixtures, 'alerts')
      await expect(page.locator('body')).toContainText('Alertas')
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy()
      const trigger = page.getByRole('button', { name: /Alertas:/u }).first()
      await trigger.focus()
      await page.keyboard.press('Enter')
      await expect(page.getByRole('dialog', { name: 'Alertas recientes' })).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(trigger).toBeFocused()
    }
  })
})
