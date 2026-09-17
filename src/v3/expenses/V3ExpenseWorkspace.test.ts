import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ExpenseListItem } from '../../features/expenses/types'
import { V3ExpenseWorkspace } from './V3ExpenseWorkspace'

const expense: ExpenseListItem = {
  id: 'expense-test-id',
  display_code: 'GAS-001',
  expense_date: '2026-09-08',
  accounting_date: null,
  due_date: null,
  supplier_name: 'Proveedor Uno',
  supplier_tax_id: null,
  category: 'materiales',
  subcategory: null,
  description: 'Productos de limpieza',
  document_type: 'factura',
  reference_number: 'F-1',
  payment_method: 'card',
  payment_status: 'paid',
  currency: 'EUR',
  subtotal: 100,
  tax_rate: 21,
  tax_amount: 21,
  total: 121,
  is_deductible: true,
  deductible_percentage: 100,
  affects_quarterly_closure: true,
  affects_annual_closure: true,
  receipt_file_url: null,
  receipt_file_path: 'expenses/expense-test-id/receipt.pdf',
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
}

function renderWorkspace() {
  return renderToStaticMarkup(createElement(V3ExpenseWorkspace, {
    expense,
    onBack: () => undefined,
    onRefresh: async () => undefined,
    onEdit: () => undefined,
    onCreateSimilar: () => undefined,
  }))
}

describe('V3ExpenseWorkspace', () => {
  it('keeps the total, base and IVA in one labelled financial reading order', () => {
    const html = renderWorkspace()
    expect(html).toContain('Resumen financiero del gasto')
    expect(html).toContain('Base imponible')
    expect(html).toContain('IVA (21%)')
    expect(html).toContain('Total')
    expect(html.indexOf('Base imponible')).toBeLessThan(html.indexOf('IVA (21%)'))
    expect(html.indexOf('IVA (21%)')).toBeLessThan(html.indexOf('Total'))
    expect((html.match(/<dt>Total<\/dt>/g) ?? [])).toHaveLength(1)
    expect((html.match(/121,00\s*€/g) ?? [])).toHaveLength(1)
  })

  it('uses one primary next action and explicit private-document actions', () => {
    const html = renderWorkspace()
    expect((html.match(/v3-action--primary/g) ?? [])).toHaveLength(1)
    expect(html).not.toContain('v3-sticky-action-bar')
    expect(html).toContain('Abrir documento')
    expect(html).toContain('Sustituir documento')
    expect(html).toContain('Eliminar documento')
    expect(html).toContain('Documento y revisión')
  })
})
