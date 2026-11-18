export const EXPENSE_RECEIPT_PREVIEW_URL_TTL_SECONDS = 5 * 60

export type ExpenseReceiptPreviewKind = 'pdf' | 'image'

export function getExpenseReceiptPreviewKind(filePath: string | null | undefined): ExpenseReceiptPreviewKind | null {
  if (!filePath) return null
  const lower = filePath.toLowerCase()
  if (lower.endsWith('.pdf')) return 'pdf'
  if (/\.(jpg|jpeg|png|webp)$/.test(lower)) return 'image'
  return null
}
