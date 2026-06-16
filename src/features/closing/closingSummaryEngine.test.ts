import { describe, expect, it } from 'vitest'
import type { ExpenseListItem } from '../expenses/types'
import type { InvoiceListItem } from '../invoices/types'
import type { PaymentListItem } from '../payments/types'
import { buildClosingSummary } from './closingSummaryEngine'
import type { FiscalPeriodSelection } from './fiscalPeriods'

function createInvoice(overrides: Partial<InvoiceListItem> = {}): InvoiceListItem {
  return {
    id: 'inv-1',
    display_code: 'INV-1',
    invoice_number: '2026-001',
    job_id: null,
    client_id: 'client-1',
    issue_date: '2026-01-15',
    status: 'issued',
    subtotal: 100,
    tax_amount: 21,
    total: 121,
    ...overrides,
  }
}

function createPayment(overrides: Partial<PaymentListItem> = {}): PaymentListItem {
  return {
    id: 'pay-1',
    display_code: 'PAY-1',
    invoice_id: 'inv-1',
    payment_date: '2026-01-20',
    amount: 50,
    payment_method: 'transfer',
    ...overrides,
  }
}

function createExpense(overrides: Partial<ExpenseListItem> = {}): ExpenseListItem {
  return {
    id: 'exp-1',
    display_code: 'EXP-1',
    expense_date: '2026-04-15',
    accounting_date: null,
    due_date: null,
    supplier_name: 'Proveedor',
    supplier_tax_id: null,
    category: 'gestoria',
    subcategory: null,
    description: 'Gasto',
    document_type: 'factura',
    reference_number: null,
    payment_method: 'transfer',
    payment_status: 'paid',
    currency: 'EUR',
    subtotal: 50,
    tax_rate: 21,
    tax_amount: 10.5,
    total: 60.5,
    is_deductible: true,
    deductible_percentage: 100,
    affects_quarterly_closure: true,
    affects_annual_closure: true,
    receipt_file_url: null,
    receipt_file_path: 'receipt.pdf',
    attachment_count: 1,
    document_support_status: 'invoice_valid',
    fiscal_review_status: 'reviewed',
    fiscal_risk_level: 'low',
    manager_note: null,
    ai_fiscal_classification: null,
    ai_deductibility_percentage: null,
    ai_vat_deductibility_percentage: null,
    ai_estimated_deductible_base: null,
    ai_estimated_deductible_vat: null,
    ai_fiscal_confidence: null,
    ai_fiscal_risk_level: null,
    ai_fiscal_reasoning: null,
    ai_fiscal_flags: null,
    ai_fiscal_model: null,
    ai_fiscal_analyzed_at: null,
    ai_fiscal_source_version: null,
    notes: null,
    ...overrides,
  }
}

describe('buildClosingSummary', () => {
  it('mantiene la lógica trimestral basada en fiscal year / fiscal quarter para gastos', () => {
    const selection: FiscalPeriodSelection = {
      mode: 'quarter',
      year: 2026,
      month: 1,
      quarter: 1,
      startDate: '',
      endDate: '',
    }

    const summary = buildClosingSummary({
      selection,
      invoices: [createInvoice()],
      payments: [createPayment()],
      expenses: [
        createExpense({
          expense_date: '2026-04-15',
          fiscal_year: 2026,
          fiscal_quarter: 1,
        }),
      ],
      quotes: [],
      quarterlySummaryByPeriod: new Map(),
      annualSummaryByYear: new Map(),
    })

    expect(summary.snapshotMode).toBe('quarterly')
    expect(summary.expenseCount).toBe(1)
    expect(summary.closureExpenseCount).toBe(1)
    expect(summary.period.label).toBe('T1 2026')
  })

  it('soporta rangos personalizados con el mismo engine común', () => {
    const selection: FiscalPeriodSelection = {
      mode: 'custom',
      year: 2026,
      month: 1,
      quarter: 1,
      startDate: '2026-02-01',
      endDate: '2026-02-28',
    }

    const summary = buildClosingSummary({
      selection,
      invoices: [
        createInvoice({ issue_date: '2026-02-10' }),
        createInvoice({ id: 'inv-2', issue_date: '2026-03-05' }),
      ],
      payments: [createPayment({ payment_date: '2026-02-12' })],
      expenses: [createExpense({ expense_date: '2026-02-14' })],
      quotes: [],
      quarterlySummaryByPeriod: new Map(),
      annualSummaryByYear: new Map(),
    })

    expect(summary.snapshotMode).toBeNull()
    expect(summary.invoiceCount).toBe(1)
    expect(summary.paymentCount).toBe(1)
    expect(summary.expenseCount).toBe(1)
    expect(summary.period.startDate).toBe('2026-02-01')
    expect(summary.period.endDate).toBe('2026-02-28')
  })
})
