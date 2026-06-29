import type { ExpenseListItem } from './types'
import { ExpenseSupportFieldset } from './ExpenseSupportFieldset'

interface ExpenseSupportPanelProps {
  expense: ExpenseListItem
  onExpenseUpdated: () => Promise<void>
}

export function ExpenseSupportPanel({
  expense,
  onExpenseUpdated,
}: ExpenseSupportPanelProps) {
  return (
    <section className="data-section cc-expense-surface">
      <div className="section-header page-header-actions">
        <div>
          <h2>Soporte documental</h2>
          <p>Esta superficie gestiona ticket, factura y trazabilidad documental sin mezclar edicion fiscal.</p>
        </div>
      </div>

      <ExpenseSupportFieldset
        expense={expense}
        documentType={expense.document_type}
        documentSupportStatus={expense.document_support_status}
        onExpenseUpdated={onExpenseUpdated}
      />
    </section>
  )
}
