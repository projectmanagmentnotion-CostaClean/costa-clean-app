import { formatCurrency, formatDateEs } from '../../app/displayFormat'
import { getExpenseCategoryLabel, getExpenseDocumentSupportStatusLabel, getExpenseFiscalReviewStatusLabel, type ExpenseListItem } from '../../features/expenses/types'
import { V3EntityListItem, V3Status } from '../components/V3Primitives'

export function V3ExpenseRow({ expense, onOpen }: { expense: ExpenseListItem; onOpen: () => void }) {
  const supportTone = expense.document_support_status === 'missing' ? 'warning' : 'neutral'
  const supportLabel = expense.document_support_status === 'invoice_valid' ? 'Soporte marcado como factura válida' : getExpenseDocumentSupportStatusLabel(expense.document_support_status)
  return <V3EntityListItem onClick={onOpen} ariaLabel={`Abrir gasto ${expense.display_code ?? expense.id}`}><div className="v3-expense-row__main"><strong>{expense.supplier_name}</strong><span>{expense.description || getExpenseCategoryLabel(expense.category)}</span><small>{expense.display_code ?? expense.id} · {formatDateEs(expense.expense_date)}</small></div><div className="v3-expense-row__side"><strong>{formatCurrency(expense.total)}</strong><V3Status label={supportLabel} tone={supportTone} /><small>{getExpenseFiscalReviewStatusLabel(expense.fiscal_review_status)}</small></div></V3EntityListItem>
}
