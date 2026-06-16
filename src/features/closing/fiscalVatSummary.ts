import { buildExpenseFiscalSummary, type ExpenseFiscalSummary } from '../expenses/fiscalIntelligenceSummary'
import type { ExpenseListItem } from '../expenses/types'
import type { InvoiceListItem } from '../invoices/types'

export interface FiscalVatSummary {
  outputVatTotal: number
  supportedVatTotal: number
  estimatedDeductibleVat: number
  estimatedDeductibleBase: number
  estimatedNetVatPayable: number
  expenseFiscalSummary: ExpenseFiscalSummary
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2))
}

export function buildFiscalVatSummary(
  invoices: InvoiceListItem[],
  expenses: ExpenseListItem[],
): FiscalVatSummary {
  const expenseFiscalSummary = buildExpenseFiscalSummary(expenses)
  const outputVatTotal = roundMoney(
    invoices.reduce((sum, invoice) => sum + Number(invoice.tax_amount || 0), 0),
  )
  const estimatedDeductibleVat = roundMoney(expenseFiscalSummary.estimatedDeductibleVat)

  return {
    outputVatTotal,
    supportedVatTotal: roundMoney(expenseFiscalSummary.totalVatSupported),
    estimatedDeductibleVat,
    estimatedDeductibleBase: roundMoney(expenseFiscalSummary.estimatedDeductibleBase),
    estimatedNetVatPayable: roundMoney(outputVatTotal - estimatedDeductibleVat),
    expenseFiscalSummary,
  }
}
