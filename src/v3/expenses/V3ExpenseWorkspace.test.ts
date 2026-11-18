import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ExpenseListItem } from '../../features/expenses/types'
import { V3ExpenseReceiptPreview, V3ExpenseWorkspace, type ReceiptPreviewState } from './V3ExpenseWorkspace'

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
    expect(html).not.toContain('Vista previa del justificante')
  })

  it('keeps the programmatic file picker out of the keyboard path', () => {
    const html = renderWorkspace()
    expect(html).toContain('type="file"')
    expect(html).toContain('tabindex="-1"')
    expect(html).toContain('aria-hidden="true"')
  })
})

describe('V3ExpenseReceiptPreview', () => {
  const actions = { onClose: () => undefined, onRenew: () => undefined, onDocumentError: () => undefined }

  function renderPreview(preview: ReceiptPreviewState) {
    return renderToStaticMarkup(createElement(V3ExpenseReceiptPreview, { preview, ...actions }))
  }

  it('renders private PDF and image documents inside an accessible in-app dialog', () => {
    const pdf = renderPreview({ expenseId: 'expense-test-id', filePath: 'receipt.pdf', kind: 'pdf', url: 'https://storage.test/signed', expired: false, loading: false, error: null })
    expect(pdf).toContain('role="dialog"')
    expect(pdf).toContain('aria-modal="true"')
    expect(pdf).toContain('title="Vista previa del justificante PDF"')
    expect(pdf).toContain('src="https://storage.test/signed"')
    expect(pdf).not.toContain('target="_blank"')

    const image = renderPreview({ expenseId: 'expense-test-id', filePath: 'receipt.png', kind: 'image', url: 'https://storage.test/signed-image', expired: false, loading: false, error: null })
    expect(image).toContain('alt="Vista previa del justificante"')
    expect(image).toContain('src="https://storage.test/signed-image"')
  })

  it('keeps an expired or failed private link out of the viewer and exposes renewal', () => {
    const expired = renderPreview({ expenseId: 'expense-test-id', filePath: 'receipt.pdf', kind: 'pdf', url: null, expired: true, loading: false, error: null })
    expect(expired).toContain('El enlace privado ha caducado.')
    expect(expired).toContain('Renovar acceso')
    expect(expired).not.toContain('<iframe')

    const failed = renderPreview({ expenseId: 'expense-test-id', filePath: 'receipt.pdf', kind: 'pdf', url: null, expired: false, loading: false, error: 'No se pudo acceder al documento.' })
    expect(failed).toContain('role="alert"')
    expect(failed).toContain('Renovar acceso')
    expect(failed).not.toContain('<iframe')
  })
})
