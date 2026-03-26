import { useEffect, useMemo, useState } from 'react'
import { ExpenseCreateForm } from '../features/expenses/ExpenseCreateForm'
import { ExpenseDetailCard } from '../features/expenses/ExpenseDetailCard'
import { ExpensesList } from '../features/expenses/ExpensesList'
import type { ExpenseListItem } from '../features/expenses/types'

interface ExpensesPageProps {
  expenses: ExpenseListItem[]
  error: string | null
  onExpenseCreated: () => Promise<void>
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
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

  const summary = useMemo(() => {
    const totalAmount = expenses.reduce(
      (sum, expense) => sum + Number(expense.total ?? 0),
      0,
    )

    const pendingReview = expenses.filter(
      (expense) => expense.fiscal_review_status === 'pending',
    ).length

    const missingDocument = expenses.filter(
      (expense) => expense.document_support_status === 'missing',
    ).length

    return {
      totalItems: expenses.length,
      totalAmount,
      pendingReview,
      missingDocument,
    }
  }, [expenses])

  return (
    <section className="page-section cc-expenses-page">
      <div className="section-header page-header-actions cc-expenses-hero">
        <div>
          <h1>Gastos</h1>
          <p>Control operativo, fiscal y documental con lectura rápida en móvil.</p>
        </div>

        <button
          type="button"
          className={showCreateForm ? 'secondary-button' : 'primary-button'}
          onClick={() => setShowCreateForm((current) => !current)}
        >
          {showCreateForm ? 'Cerrar formulario' : 'Nuevo gasto'}
        </button>
      </div>

      <section className="cc-kpi-grid cc-expenses-summary" aria-label="Resumen de gastos">
        <article className="cc-kpi-card">
          <span className="cc-kpi-label">Registros</span>
          <strong className="cc-kpi-value">{summary.totalItems}</strong>
          <p className="cc-kpi-footnote">Gastos disponibles en el módulo</p>
        </article>

        <article className="cc-kpi-card">
          <span className="cc-kpi-label">Importe total</span>
          <strong className="cc-kpi-value">{formatCurrency(summary.totalAmount)}</strong>
          <p className="cc-kpi-footnote">Suma total de los gastos cargados</p>
        </article>

        <article className="cc-kpi-card">
          <span className="cc-kpi-label">Pendiente revisión</span>
          <strong className="cc-kpi-value">{summary.pendingReview}</strong>
          <p className="cc-kpi-footnote">Requieren validación fiscal</p>
        </article>

        <article className="cc-kpi-card">
          <span className="cc-kpi-label">Sin documento</span>
          <strong className="cc-kpi-value">{summary.missingDocument}</strong>
          <p className="cc-kpi-footnote">Falta ticket o factura adjunta</p>
        </article>
      </section>

      {showCreateForm ? (
        <section className="data-section cc-expenses-create-panel">
          <div className="section-header">
            <h2>Alta de gasto</h2>
            <p>Crea un nuevo registro sin salir del flujo operativo.</p>
          </div>

          <ExpenseCreateForm onCreated={onExpenseCreated} />
        </section>
      ) : null}

      <div className="cc-expenses-layout">
        <div className="cc-expenses-layout__detail">
          <ExpenseDetailCard
            expense={selectedExpense}
            onExpenseUpdated={onExpenseCreated}
          />
        </div>

        <div className="cc-expenses-layout__list">
          <ExpensesList
            expenses={expenses}
            error={error}
            selectedExpenseId={selectedExpenseId}
            onSelectExpense={(expense) => setSelectedExpenseId(expense.id)}
          />
        </div>
      </div>
    </section>
  )
}