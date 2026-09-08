import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { V3ExpenseRow } from './V3ExpenseRow'

describe('V3ExpenseRow', () => {
  it('keeps supplier, total, support and review state visible', () => {
    const html = renderToStaticMarkup(createElement(V3ExpenseRow, { expense: { id: 'exp-1', display_code: 'GAS-001', expense_date: '2026-09-08', accounting_date: null, due_date: null, supplier_name: 'Proveedor Uno', supplier_tax_id: null, category: 'materiales', subcategory: null, description: 'Productos', document_type: 'factura', reference_number: 'F-1', payment_method: 'card', payment_status: 'paid', currency: 'EUR', subtotal: 100, tax_rate: 21, tax_amount: 21, total: 121, is_deductible: true, deductible_percentage: 100, affects_quarterly_closure: true, affects_annual_closure: true, receipt_file_url: null, receipt_file_path: null, attachment_count: 0, document_support_status: 'missing', fiscal_review_status: 'pending', fiscal_risk_level: 'medium', manager_note: null, ai_fiscal_classification: null, ai_deductibility_percentage: null, ai_vat_deductibility_percentage: null, ai_estimated_deductible_base: null, ai_estimated_deductible_vat: null, ai_fiscal_confidence: null, ai_fiscal_risk_level: null, ai_fiscal_reasoning: null, ai_fiscal_flags: null, ai_fiscal_model: null, ai_fiscal_analyzed_at: null, ai_fiscal_source_version: null, notes: null }, onOpen: () => undefined }))
    expect(html).toContain('Proveedor Uno')
    expect(html).toContain('121,00')
    expect(html).toContain('Sin documento')
    expect(html).toContain('Pendiente')
  })
})
