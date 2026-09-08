import { useState, type ChangeEvent } from 'react'
import { formatCurrency, formatDateEs } from '../../app/displayFormat'
import { analyzeExpenseFiscalIntelligence, saveExpenseFiscalIntelligenceResult } from '../../features/expenses/fiscalIntelligenceApi'
import { createExpenseReceiptSignedUrl, deleteExpenseReceipt, uploadExpenseReceipt } from '../../features/expenses/expenseAttachmentsApi'
import { updateExpense, updateExpenseAttachment } from '../../features/expenses/expenseApi'
import { getExpenseAiFiscalClassificationLabel, getExpenseCategoryLabel, getExpenseDocumentSupportStatusLabel, getExpenseDocumentTypeLabel, getExpenseFiscalReviewStatusLabel, getExpenseFiscalRiskLevelLabel, getExpensePaymentMethodLabel, getExpensePaymentStatusLabel, type ExpenseListItem } from '../../features/expenses/types'
import { V3DetailSection, V3EntityStatus, V3Page, V3PageTitle, V3PrimaryAction, V3SecondaryAction, V3StickyActionBar } from '../components/V3Primitives'

interface V3ExpenseWorkspaceProps {
  expense: ExpenseListItem
  onBack: () => void
  onRefresh: () => Promise<void>
  onEdit: () => void
  onCreateSimilar: () => void
}

function supportLabel(expense: ExpenseListItem): string {
  if (!expense.receipt_file_path) return 'Sin documento'
  if (expense.document_support_status === 'invoice_valid') return 'Soporte marcado como factura válida'
  return getExpenseDocumentSupportStatusLabel(expense.document_support_status)
}

function expenseInput(expense: ExpenseListItem) {
  return { expense_date: expense.expense_date, accounting_date: expense.accounting_date, due_date: expense.due_date, supplier_name: expense.supplier_name, supplier_tax_id: expense.supplier_tax_id, category: expense.category, subcategory: expense.subcategory, description: expense.description, document_type: expense.document_type, reference_number: expense.reference_number, payment_method: expense.payment_method, payment_status: expense.payment_status, currency: expense.currency, subtotal: expense.subtotal, tax_rate: expense.tax_rate, tax_amount: expense.tax_amount, total: expense.total, is_deductible: expense.is_deductible, deductible_percentage: expense.deductible_percentage, affects_quarterly_closure: expense.affects_quarterly_closure, affects_annual_closure: expense.affects_annual_closure, receipt_file_url: expense.receipt_file_url, receipt_file_path: expense.receipt_file_path, attachment_count: expense.attachment_count, document_support_status: expense.document_support_status, fiscal_review_status: expense.fiscal_review_status, fiscal_risk_level: expense.fiscal_risk_level, manager_note: expense.manager_note, notes: expense.notes }
}

export function V3ExpenseWorkspace({ expense, onBack, onRefresh, onEdit, onCreateSimilar }: V3ExpenseWorkspaceProps) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true); setMessage(null); setError(null)
    try { await action(); await onRefresh(); setMessage(success) } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo completar la operación.') } finally { setBusy(false) }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Solo se admiten PDF, JPG, PNG o WEBP.'); return }
    if (file.size > 10 * 1024 * 1024) { setError('El documento supera el límite actual de 10 MB.'); return }
    await run(async () => { const { filePath } = await uploadExpenseReceipt(expense.id, file); await updateExpenseAttachment(expense.id, filePath) }, 'Documento añadido correctamente.')
  }

  async function openDocument() {
    if (!expense.receipt_file_path) return
    await run(async () => { const url = await createExpenseReceiptSignedUrl(expense.receipt_file_path!); window.open(url, '_blank', 'noopener,noreferrer') }, 'Documento abierto.')
  }

  async function removeDocument() {
    if (!expense.receipt_file_path || !window.confirm('¿Eliminar el documento de este gasto?')) return
    await run(async () => { await deleteExpenseReceipt(expense.receipt_file_path!); await updateExpenseAttachment(expense.id, null) }, 'Documento eliminado.')
  }

  async function analyze() {
    await run(async () => { const response = await analyzeExpenseFiscalIntelligence(expense); await saveExpenseFiscalIntelligenceResult(expense.id, response) }, 'Estimación fiscal asistida actualizada.')
  }

  async function markReviewed() {
    await run(async () => { await updateExpense(expense.id, { ...expenseInput(expense), fiscal_review_status: 'reviewed' }) }, 'Revisión interna marcada como revisada.')
  }

  const needsSupport = !expense.receipt_file_path || expense.document_support_status === 'missing'
  const needsReview = expense.fiscal_review_status === 'pending' || expense.fiscal_review_status === 'observed' || expense.fiscal_risk_level === 'high'
  const primaryLabel = needsSupport ? 'Completar soporte' : needsReview ? 'Resolver revisión' : 'Editar gasto'

  return <V3Page className="v3-expense-workspace"><button type="button" className="v3-workspace-back" onClick={onBack}>← Gastos</button><V3PageTitle eyebrow="Gastos" title={expense.supplier_name} description={expense.description || getExpenseCategoryLabel(expense.category)} /><div className="v3-workspace-total"><strong>{formatCurrency(expense.total)}</strong><span>{expense.display_code ?? expense.id} · {formatDateEs(expense.expense_date)}</span></div><div className="v3-workspace-actions">{needsSupport ? <V3PrimaryAction onClick={() => document.getElementById(`v3-expense-file-${expense.id}`)?.click()} disabled={busy}>{primaryLabel}</V3PrimaryAction> : needsReview ? <V3PrimaryAction onClick={() => void markReviewed()} disabled={busy}>{primaryLabel}</V3PrimaryAction> : <V3PrimaryAction onClick={onEdit}>{primaryLabel}</V3PrimaryAction>}<V3SecondaryAction onClick={onEdit}>Editar gasto</V3SecondaryAction><V3SecondaryAction onClick={onCreateSimilar}>Más</V3SecondaryAction></div>{message ? <p className="v3-inline-message" role="status">{message}</p> : null}{error ? <p className="v3-inline-message v3-inline-message--error" role="alert">{error}</p> : null}<input id={`v3-expense-file-${expense.id}`} className="v3-visually-hidden" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => void upload(event)} aria-label="Añadir documento" /><V3DetailSection title="Resumen"><dl className="v3-facts"><div><dt>Proveedor</dt><dd>{expense.supplier_name}</dd></div><div><dt>Categoría</dt><dd>{getExpenseCategoryLabel(expense.category)}</dd></div><div><dt>Pago</dt><dd>{getExpensePaymentStatusLabel(expense.payment_status)} · {getExpensePaymentMethodLabel(expense.payment_method)}</dd></div></dl></V3DetailSection><V3DetailSection title="Documento"><dl className="v3-facts"><div><dt>Estado</dt><dd><V3EntityStatus label={supportLabel(expense)} tone={needsSupport ? 'warning' : 'success'} /></dd></div><div><dt>Tipo</dt><dd>{getExpenseDocumentTypeLabel(expense.document_type)}</dd></div></dl><div className="v3-workspace-actions">{expense.receipt_file_path ? <><V3SecondaryAction onClick={() => void openDocument()} disabled={busy}>Abrir/ver</V3SecondaryAction><V3SecondaryAction onClick={() => document.getElementById(`v3-expense-file-${expense.id}`)?.click()} disabled={busy}>Reemplazar</V3SecondaryAction><V3SecondaryAction onClick={() => void removeDocument()} disabled={busy}>Eliminar</V3SecondaryAction></> : <V3SecondaryAction onClick={() => document.getElementById(`v3-expense-file-${expense.id}`)?.click()} disabled={busy}>Añadir documento</V3SecondaryAction>}</div></V3DetailSection><V3DetailSection title="Fiscal"><dl className="v3-facts"><div><dt>Revisión interna</dt><dd>{getExpenseFiscalReviewStatusLabel(expense.fiscal_review_status)}</dd></div><div><dt>Riesgo</dt><dd>{getExpenseFiscalRiskLevelLabel(expense.fiscal_risk_level)}</dd></div><div><dt>Soporte</dt><dd>{supportLabel(expense)}</dd></div></dl><V3SecondaryAction onClick={() => void analyze()} disabled={busy}>{expense.ai_fiscal_classification ? 'Actualizar estimación asistida' : 'Analizar estimación asistida'}</V3SecondaryAction>{expense.ai_fiscal_classification ? <div className="v3-assistive-note"><strong>Estimación fiscal asistida</strong><p>{getExpenseAiFiscalClassificationLabel(expense.ai_fiscal_classification)} · {expense.ai_fiscal_reasoning ?? 'Sin razonamiento registrado.'}</p><small>No es una certificación fiscal ni sustituye revisión profesional.</small></div> : null}</V3DetailSection><V3DetailSection title="Pago"><p className="v3-section-copy">{getExpensePaymentStatusLabel(expense.payment_status)} · {getExpensePaymentMethodLabel(expense.payment_method)}</p></V3DetailSection><V3DetailSection title="Datos"><dl className="v3-facts"><div><dt>Subtotal</dt><dd>{formatCurrency(expense.subtotal)}</dd></div><div><dt>IVA</dt><dd>{formatCurrency(expense.tax_amount)} ({expense.tax_rate}%)</dd></div><div><dt>Referencia</dt><dd>{expense.reference_number ?? 'Sin referencia'}</dd></div></dl></V3DetailSection><V3DetailSection title="Notas"><p className="v3-section-copy">{expense.notes ?? expense.manager_note ?? 'Sin notas registradas.'}</p></V3DetailSection><V3StickyActionBar><V3PrimaryAction onClick={needsSupport ? () => document.getElementById(`v3-expense-file-${expense.id}`)?.click() : needsReview ? () => void markReviewed() : onEdit} disabled={busy}>{primaryLabel}</V3PrimaryAction></V3StickyActionBar></V3Page>
}
