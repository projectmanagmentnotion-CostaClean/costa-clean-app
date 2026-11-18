import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  ExpenseSupportFieldset,
} from './ExpenseSupportFieldset'
import { ExpenseReceiptPreviewDocument } from './ExpenseReceiptPreviewDocument'
import {
  EXPENSE_RECEIPT_PREVIEW_URL_TTL_SECONDS,
  getExpenseReceiptPreviewKind,
} from './expenseReceiptPreview'

describe('expense receipt preview', () => {
  it('classifies persisted file paths without interpreting their contents', () => {
    expect(getExpenseReceiptPreviewKind('expenses/id/receipt.PDF')).toBe('pdf')
    expect(getExpenseReceiptPreviewKind('expenses/id/receipt.jpg')).toBe('image')
    expect(getExpenseReceiptPreviewKind('expenses/id/receipt.jpeg')).toBe('image')
    expect(getExpenseReceiptPreviewKind('expenses/id/receipt.png')).toBe('image')
    expect(getExpenseReceiptPreviewKind('expenses/id/receipt.webp')).toBe('image')
    expect(getExpenseReceiptPreviewKind('expenses/id/receipt.csv')).toBeNull()
    expect(getExpenseReceiptPreviewKind(null)).toBeNull()
  })

  it('uses a short-lived signed URL for an on-demand private Storage preview', () => {
    expect(EXPENSE_RECEIPT_PREVIEW_URL_TTL_SECONDS).toBe(300)
    const html = renderToStaticMarkup(createElement(ExpenseSupportFieldset, {
      expense: {
        id: 'synthetic-expense',
        receipt_file_path: 'expenses/synthetic/receipt.pdf',
      } as never,
      documentType: 'factura',
      documentSupportStatus: 'invoice_valid',
    }))

    expect(html).toContain('Ver documento')
    expect(html).not.toContain('iframe')
    expect(html).not.toContain('signed-url')
  })

  it('renders PDF inline without download behavior or referrer forwarding', () => {
    const html = renderToStaticMarkup(createElement(ExpenseReceiptPreviewDocument, {
      kind: 'pdf',
      url: 'https://storage.example.test/signed/opaque',
      onError: () => undefined,
    }))

    expect(html).toContain('<iframe')
    expect(html).toContain('title="Vista previa del justificante PDF"')
    expect(html).toContain('referrerPolicy="no-referrer"')
    expect(html).toContain('Abrir PDF en una pestaña nueva')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noreferrer"')
    expect(html).not.toContain('download=')
  })

  it('keeps image previews available in the same viewer', () => {
    const html = renderToStaticMarkup(createElement(ExpenseReceiptPreviewDocument, {
      kind: 'image',
      url: 'https://storage.example.test/signed/opaque',
      onError: () => undefined,
    }))

    expect(html).toContain('<img')
    expect(html).toContain('alt="Vista previa del justificante"')
    expect(html).toContain('referrerPolicy="no-referrer"')
  })
})
