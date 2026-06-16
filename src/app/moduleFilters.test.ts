import { describe, expect, it } from 'vitest'
import { applyExpenseFilter, applyInvoiceFilter, applyPaymentFilter } from './moduleFilters'
import type { ExpenseListItem } from '../features/expenses/types'
import type { InvoiceListItem } from '../features/invoices/types'
import type { PaymentListItem } from '../features/payments/types'

function createInvoice(overrides: Partial<InvoiceListItem> = {}): InvoiceListItem {
  return {
    id: 'inv-1',
    display_code: 'INV-1',
    invoice_number: '2026-001',
    job_id: null,
    client_id: 'client-1',
    issue_date: '2026-02-10',
    status: 'issued',
    subtotal: 100,
    tax_amount: 21,
    total: 121,
    outstanding_amount: 30,
    ...overrides,
  }
}

function createPayment(overrides: Partial<PaymentListItem> = {}): PaymentListItem {
  return {
    id: 'pay-1',
    display_code: 'PAY-1',
    invoice_id: 'inv-1',
    payment_date: '2026-02-11',
    amount: 50,
    payment_method: 'transfer',
    ...overrides,
  }
}

function createExpense(overrides: Partial<ExpenseListItem> = {}): ExpenseListItem {
  return {
    id: 'exp-1',
    display_code: 'EXP-1',
    expense_date: '2026-02-12',
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
    receipt_file_path: null,
    attachment_count: 0,
    document_support_status: 'missing',
    fiscal_review_status: 'pending',
    fiscal_risk_level: 'high',
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

describe('module period filters', () => {
  const period = {
    mode: 'custom' as const,
    year: 2026,
    startDate: '2026-02-01',
    endDate: '2026-02-28',
    label: 'Febrero 2026',
    folderLabel: '2026_M02',
  }

  it('filtra facturas y cobros por periodo resuelto', () => {
    const invoices = applyInvoiceFilter([
      createInvoice(),
      createInvoice({ id: 'inv-2', issue_date: '2026-03-01' }),
    ], {
      type: 'period',
      period,
      scope: 'all',
    })
    const payments = applyPaymentFilter([
      createPayment(),
      createPayment({ id: 'pay-2', payment_date: '2026-03-01' }),
    ], {
      type: 'period',
      period,
      scope: 'all',
    })

    expect(invoices).toHaveLength(1)
    expect(payments).toHaveLength(1)
  })

  it('filtra incidencias de gastos por periodo resuelto', () => {
    const expenses = applyExpenseFilter([
      createExpense(),
      createExpense({ id: 'exp-2', expense_date: '2026-03-04' }),
    ], {
      type: 'period',
      period,
      scope: 'missing_support',
    })

    expect(expenses).toHaveLength(1)
    expect(expenses[0]?.id).toBe('exp-1')
  })
})
