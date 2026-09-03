import crypto from 'node:crypto'
import { expect, test } from '@playwright/test'
import { createQaFinancialFixtures } from './qaFinancialFixtures.mjs'

const qaUrl = process.env.VITE_SUPABASE_URL
const authStorageKey = `sb-${new URL(qaUrl).hostname.split('.')[0]}-auth-token`

async function openAuthenticated(page, fixtures, view, { expectFixture = true } = {}) {
  await page.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), {
    key: authStorageKey,
    session: fixtures.session,
  })
  await page.goto(`/?view=${view}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByText(view === 'invoices' ? 'Facturas' : 'Presupuestos', { exact: true }).first()).toBeVisible({ timeout: 30000 })
  if (expectFixture) await expect.poll(() => page.locator('body').innerText()).toContain(fixtures.created.prefix)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy()
}

async function seedBase(fixtures, label) {
  const owner = await fixtures.clientFixture(`${label}-client`)
  const property = await fixtures.propertyFixture(owner, `${label}-property`)
  return { owner, property }
}

test.describe('financial QA with isolated authenticated fixtures', () => {
  let fixtures

  test.beforeEach(async () => {
    fixtures = await createQaFinancialFixtures()
  })

  test.afterEach(async () => {
    if (fixtures) await fixtures.cleanup()
  })

  test('manual invoice without job persists and is visible', async ({ page }) => {
    const { owner } = await seedBase(fixtures, 'manual')
    const invoice = await fixtures.invoiceFixture(owner, null, null, 'manual-invoice')
    expect(invoice.job_id).toBeNull()
    expect(Number(invoice.total)).toBe(121)
    await openAuthenticated(page, fixtures, 'invoices', { expectFixture: false })
  })

  test('invoice with job preserves current relationship', async ({ page }) => {
    const { owner, property } = await seedBase(fixtures, 'job')
    const job = await fixtures.jobFixture(owner, property, 'job-invoice')
    const invoice = await fixtures.invoiceFixture(owner, property, job, 'job-invoice')
    expect(invoice.job_id).toBe(job.id)
    expect(invoice.client_id).toBe(owner.id)
    expect(invoice.property_id).toBe(property.id)
    await openAuthenticated(page, fixtures, 'invoices')
  })

  test('quote persists with readback', async ({ page }) => {
    const { owner, property } = await seedBase(fixtures, 'quote')
    const quote = await fixtures.quoteFixture(owner, property, 'quote')
    expect(Number(quote.total)).toBe(121)
    await openAuthenticated(page, fixtures, 'quotes')
  })

  test('quote to invoice workflow persists both sides', async ({ page }) => {
    const { owner, property } = await seedBase(fixtures, 'conversion')
    const quote = await fixtures.quoteFixture(owner, property, 'conversion')
    const conversion = await fixtures.acceptQuote(quote.id, `INVOICE-${fixtures.created.runId}-conversion-${crypto.randomUUID()}`)
    expect(conversion.quote.status).toBe('accepted')
    expect(conversion.invoice.quote_id).toBe(quote.id)
    await openAuthenticated(page, fixtures, 'invoices')
  })

  test('duplicate candidates are isolated and readable', async ({ page }) => {
    const { owner, property } = await seedBase(fixtures, 'duplicate')
    const first = await fixtures.quoteFixture(owner, property, 'duplicate-a')
    const second = await fixtures.quoteFixture(owner, property, 'duplicate-b')
    expect(first.id).not.toBe(second.id)
    await openAuthenticated(page, fixtures, 'quotes')
  })

  test('bulk invoice candidates are independently readable', async ({ page }) => {
    const { owner } = await seedBase(fixtures, 'bulk-invoice')
    const first = await fixtures.invoiceFixture(owner, null, null, 'bulk-a')
    const second = await fixtures.invoiceFixture(owner, null, null, 'bulk-b')
    expect(first.id).not.toBe(second.id)
    await openAuthenticated(page, fixtures, 'invoices')
  })

  test('bulk quote candidates are independently readable', async ({ page }) => {
    const { owner } = await seedBase(fixtures, 'bulk-quote')
    const first = await fixtures.quoteFixture(owner, null, 'bulk-a')
    const second = await fixtures.quoteFixture(owner, null, 'bulk-b')
    expect(first.id).not.toBe(second.id)
    await openAuthenticated(page, fixtures, 'quotes')
  })

  test('recurring invoice plan emits an invoice', async ({ page }) => {
    const { owner, property } = await seedBase(fixtures, 'recurring')
    const plan = await fixtures.recurringPlanFixture(owner, property, 'recurring')
    const issued = await fixtures.issueRecurringPlan(plan.id, `INVOICE-${fixtures.created.runId}-recurring-${crypto.randomUUID()}`)
    expect(issued.invoice.pricing_metadata.recurring_plan_id).toBe(plan.id)
    await openAuthenticated(page, fixtures, 'invoices')
  })

  test('payment settlement refreshes invoice readback', async ({ page }) => {
    const { owner } = await seedBase(fixtures, 'payment')
    const invoice = await fixtures.invoiceFixture(owner, null, null, 'payment')
    const settled = await fixtures.settleInvoice(invoice.id)
    expect(Number(settled.payment.amount)).toBe(121)
    expect(settled.invoice.status).toBe('paid')
    await openAuthenticated(page, fixtures, 'invoices', { expectFixture: false })
  })

  test('relationship fixture remains coherent for historical readback', async ({ page }) => {
    const { owner, property } = await seedBase(fixtures, 'historical')
    const job = await fixtures.jobFixture(owner, property, 'historical')
    const invoice = await fixtures.invoiceFixture(owner, property, job, 'historical')
    const reread = await fixtures.read('invoices', invoice.id)
    expect({ client: reread.client_id, job: reread.job_id, property: reread.property_id }).toEqual({ client: owner.id, job: job.id, property: property.id })
    await openAuthenticated(page, fixtures, 'invoices')
  })
})
