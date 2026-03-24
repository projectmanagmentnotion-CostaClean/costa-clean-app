import { useEffect, useState } from 'react'
import { ExpenseCreateForm } from '../features/expenses/ExpenseCreateForm'
import { ExpenseDetailCard } from '../features/expenses/ExpenseDetailCard'
import { ExpensesList } from '../features/expenses/ExpensesList'
import type { ExpenseListItem } from '../features/expenses/types'

interface ExpensesPageProps {
  expenses: ExpenseListItem[]
  error: string | null
  onExpenseCreated: () => Promise<void>
}

export function ExpensesPage({
  expenses,
  error,
  onExpenseCreated,
}: ExpensesPageProps) {
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)

  useEffect(() => {
    if (expenses.length === 0) {
      setSelectedExpenseId(null)
      return
    }

    const selectedStillExists = expenses.some(
      (expense) => expense.id === selectedExpenseId,
    )

    if (!selectedStillExists) {
      setSelectedExpenseId(expenses[0].id)
    }
  }, [expenses, selectedExpenseId])

  const selectedExpense =
    expenses.find((expense) => expense.id === selectedExpenseId) ?? null

  return (
    <section className="page-section">
      <div className="section-header page-header-actions">
        <div>
          <h1>Gastos</h1>
          <p>Control de gastos deducibles, tickets y base fiscal operativa.</p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={() => setShowCreateForm((current) => !current)}
        >
          {showCreateForm ? 'Cerrar formulario' : 'Nuevo gasto'}
        </button>
      </div>

      {showCreateForm ? (
        <ExpenseCreateForm onCreated={onExpenseCreated} />
      ) : null}

      <ExpenseDetailCard
        expense={selectedExpense}
        onExpenseUpdated={onExpenseCreated}
      />

      <ExpensesList
        expenses={expenses}
        error={error}
        selectedExpenseId={selectedExpenseId}
        onSelectExpense={(expense) => setSelectedExpenseId(expense.id)}
      />
    </section>
  )
}