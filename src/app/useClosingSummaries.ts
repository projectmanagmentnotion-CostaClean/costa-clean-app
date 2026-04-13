import { useMemo } from 'react'
import type { AnnualClosingRecord } from '../features/annualClosing/types'
import { buildAnnualClosingSummary } from '../features/annualClosing/annualClosingSummary'
import type { ExpenseListItem } from '../features/expenses/types'
import type { InvoiceListItem } from '../features/invoices/types'
import type { PaymentListItem } from '../features/payments/types'
import type { QuarterlyClosingRecord } from '../features/quarterlyClosing/types'
import { buildQuarterlyClosingSummary } from '../features/quarterlyClosing/quarterlyClosingSummary'

interface UseClosingSummariesInput {
  invoices: InvoiceListItem[]
  payments: PaymentListItem[]
  expenses: ExpenseListItem[]
  quarterlyClosings: QuarterlyClosingRecord[]
  annualClosings: AnnualClosingRecord[]
}

export function useClosingSummaries({
  invoices,
  payments,
  expenses,
  quarterlyClosings,
  annualClosings,
}: UseClosingSummariesInput) {
  const quarterlyClosingSummaryByPeriod = useMemo(() => {
    const periodKeys = new Set<string>()

    for (const invoice of invoices) {
      const date = new Date(`${invoice.issue_date}T00:00:00`)
      if (!Number.isNaN(date.getTime())) {
        periodKeys.add(`${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`)
      }
    }

    for (const payment of payments) {
      const date = new Date(`${payment.payment_date}T00:00:00`)
      if (!Number.isNaN(date.getTime())) {
        periodKeys.add(`${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`)
      }
    }

    for (const expense of expenses) {
      const fiscalYear = expense.fiscal_year
      const fiscalQuarter = expense.fiscal_quarter

      if (fiscalYear && fiscalQuarter) {
        periodKeys.add(`${fiscalYear}-Q${fiscalQuarter}`)
        continue
      }

      const date = new Date(`${expense.expense_date}T00:00:00`)
      if (!Number.isNaN(date.getTime())) {
        periodKeys.add(`${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`)
      }
    }

    for (const closing of quarterlyClosings) {
      periodKeys.add(`${closing.fiscal_year}-Q${closing.fiscal_quarter}`)
    }

    const now = new Date()
    periodKeys.add(`${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`)

    const summaryEntries = [...periodKeys]
      .sort((left, right) => right.localeCompare(left))
      .map((periodKey) => {
        const [yearPart, quarterPart] = periodKey.split('-Q')
        const fiscalYear = Number(yearPart)
        const fiscalQuarter = Number(quarterPart)

        return [
          periodKey,
          buildQuarterlyClosingSummary(
            invoices,
            payments,
            expenses,
            fiscalYear,
            fiscalQuarter,
          ),
        ] as const
      })

    return new Map(summaryEntries)
  }, [expenses, invoices, payments, quarterlyClosings])

  const availableClosingYears = useMemo(() => {
    const years = new Set<number>()

    for (const periodKey of quarterlyClosingSummaryByPeriod.keys()) {
      years.add(Number(periodKey.split('-Q')[0]))
    }

    years.add(new Date().getFullYear())
    return [...years].sort((left, right) => right - left)
  }, [quarterlyClosingSummaryByPeriod])

  const annualClosingSummaryByYear = useMemo(() => {
    const years = new Set<number>()

    for (const periodKey of quarterlyClosingSummaryByPeriod.keys()) {
      years.add(Number(periodKey.split('-Q')[0]))
    }

    for (const annualClosing of annualClosings) {
      years.add(annualClosing.fiscal_year)
    }

    years.add(new Date().getFullYear())

    return new Map(
      [...years]
        .sort((left, right) => right - left)
        .map((fiscalYear) => [fiscalYear, buildAnnualClosingSummary(quarterlyClosingSummaryByPeriod, fiscalYear)] as const),
    )
  }, [annualClosings, quarterlyClosingSummaryByPeriod])

  const availableAnnualClosingYears = useMemo(
    () => [...annualClosingSummaryByYear.keys()].sort((left, right) => right - left),
    [annualClosingSummaryByYear],
  )

  const now = new Date()

  return {
    quarterlyClosingSummaryByPeriod,
    availableClosingYears,
    annualClosingSummaryByYear,
    availableAnnualClosingYears,
    currentFiscalYear: now.getFullYear(),
    currentFiscalQuarter: Math.floor(now.getMonth() / 3) + 1,
  }
}
