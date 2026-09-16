import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const files = {
  invoices: readFileSync(resolve(process.cwd(), 'src/v3/invoices/V3InvoicesPage.tsx'), 'utf8'),
  quotes: readFileSync(resolve(process.cwd(), 'src/v3/quotes/V3QuotesPage.tsx'), 'utf8'),
  payments: readFileSync(resolve(process.cwd(), 'src/v3/payments/V3PaymentsPage.tsx'), 'utf8'),
  paymentWorkspace: readFileSync(resolve(process.cwd(), 'src/v3/payments/V3PaymentWorkspace.tsx'), 'utf8'),
  expenses: readFileSync(resolve(process.cwd(), 'src/v3/expenses/V3ExpensesPage.tsx'), 'utf8'),
  expenseWorkspace: readFileSync(resolve(process.cwd(), 'src/v3/expenses/V3ExpenseWorkspace.tsx'), 'utf8'),
  primitives: readFileSync(resolve(process.cwd(), 'src/v3/components/V3Primitives.tsx'), 'utf8'),
  css: readFileSync(resolve(process.cwd(), 'src/v3/design/v3.css'), 'utf8'),
}

describe('V3-10C4.1 shared finance hierarchy', () => {
  it('uses the shared action group and supporting KPI variant across every finance list', () => {
    for (const page of [files.invoices, files.quotes, files.payments, files.expenses]) {
      expect(page).toContain('v3-finance-page')
      expect(page).toContain('<V3ActionGroup>')
      expect(page).toContain('<V3KpiGroup variant="supporting">')
    }
    expect(files.primitives).toContain('export function V3ActionGroup')
    expect(files.primitives).toContain("variant = 'default'")
  })

  it('places the find controls before secondary finance summaries', () => {
    expect(files.invoices.indexOf('v3-invoice-controls')).toBeLessThan(files.invoices.indexOf('<V3KpiGroup variant="supporting">'))
    expect(files.quotes.indexOf('v3-invoice-controls')).toBeLessThan(files.quotes.indexOf('<V3KpiGroup variant="supporting">'))
    expect(files.payments.indexOf('v3-module-controls')).toBeLessThan(files.payments.indexOf('<V3KpiGroup variant="supporting">'))
    expect(files.expenses.indexOf('v3-module-controls')).toBeLessThan(files.expenses.indexOf('<V3KpiGroup variant="supporting">'))
  })

  it('preserves compact mobile KPI composition and full-width primary header actions', () => {
    expect(files.css).toContain('.v3-finance-page .v3-kpi-group--supporting { grid-template-columns: repeat(2, minmax(0, 1fr)); }')
    expect(files.css).toContain('.v3-page-title__action .v3-action-group { display: grid; grid-template-columns: minmax(0, 1fr); }')
  })

  it('uses the same non-semantic action grouping for each finance workspace', () => {
    for (const workspace of [files.invoices, files.quotes, files.paymentWorkspace, files.expenseWorkspace]) {
      expect(workspace).toContain('<V3ActionGroup className="v3-finance-action-group">')
    }
    expect(files.css).toContain('.v3-finance-action-group .v3-action--primary { grid-column: 1 / -1; }')
  })

  it('uses shared empty and error primitives rather than finance-specific state markup', () => {
    for (const page of [files.invoices, files.quotes, files.payments, files.expenses]) {
      expect(page).toContain('<V3EmptyState')
      expect(page).toContain('<V3ErrorState')
    }
  })
})
