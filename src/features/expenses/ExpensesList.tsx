import { useMemo, useState } from 'react'
import { SearchBar } from '../../components/SearchBar'
import { matchesSearchQuery } from '../documents/search'
import {
  getExpenseCategoryLabel,
  getExpenseDocumentSupportStatusLabel,
  getExpenseFiscalReviewStatusLabel,
  getExpenseFiscalRiskLevelLabel,
  type ExpenseListItem,
} from './types'

interface ExpensesListProps {
  expenses: ExpenseListItem[]
  error: string | null
  selectedExpenseId: string | null
  onSelectExpense: (expense: ExpenseListItem) => void
}

function formatCurrency(value: number | null | undefined): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(value ?? 0))
}

function formatDateEs(value: string | null | undefined): string {
  if (!value) return 'Sin fecha'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function ExpensesList({
  expenses,
  error,
  selectedExpenseId,
  onSelectExpense,
}: ExpensesListProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) =>
      matchesSearchQuery(searchQuery, [
        expense.display_code,
        expense.id,
        expense.expense_date,
        expense.supplier_name,
        expense.category,
        getExpenseCategoryLabel(expense.category),
        expense.description,
        expense.document_support_status,
        getExpenseDocumentSupportStatusLabel(expense.document_support_status),
        expense.fiscal_review_status,
        getExpenseFiscalReviewStatusLabel(expense.fiscal_review_status),
        expense.fiscal_risk_level,
        getExpenseFiscalRiskLevelLabel(expense.fiscal_risk_level),
        expense.total,
        expense.notes,
      ]),
    )
  }, [expenses, searchQuery])

  return (
    <section className="data-section cc-module-list-section cc-expenses-list-section">
      <div className="section-header cc-list-section__header">
        <div>
          <h2>Explorar gastos</h2>
          <p>Proveedor, soporte fiscal y control documental en una sola lista.</p>
        </div>
      </div>

      <SearchBar
        label="Buscar gasto"
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Código, proveedor, descripción, categoría o riesgo"
        resultCount={filteredExpenses.length}
        totalCount={expenses.length}
      />

      {error ? (
        <div className="empty-state">
          <strong>Error cargando gastos</strong>
          <p>{error}</p>
        </div>
      ) : expenses.length === 0 ? (
        <div className="empty-state">
          <strong>No hay gastos</strong>
          <p>Todavía no existen registros en la tabla expenses.</p>
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="empty-state">
          <strong>Sin resultados</strong>
          <p>No encontramos gastos que coincidan con tu búsqueda.</p>
        </div>
      ) : (
        <div className="cc-expenses-list cc-record-list cc-bounded-list">
          {filteredExpenses.map((expense) => {
            const isSelected = expense.id === selectedExpenseId

            return (
              <button
                key={expense.id}
                type="button"
                className={
                  isSelected
                    ? 'cc-expense-item cc-record-card cc-record-card--expense is-selected'
                    : 'cc-expense-item cc-record-card cc-record-card--expense'
                }
                onClick={() => onSelectExpense(expense)}
              >
                <div className="cc-record-card__head">
                  <div className="cc-record-card__identity">
                    <strong className="cc-record-card__title">{expense.supplier_name}</strong>
                    <span className="cc-record-card__subref">{expense.display_code ?? expense.id}</span>
                  </div>

                  <div className="cc-record-card__aside">
                    <span className="lead-badge">{getExpenseCategoryLabel(expense.category)}</span>
                    <strong className="cc-record-card__amount">{formatCurrency(expense.total)}</strong>
                  </div>
                </div>

                <p className="cc-record-card__summary">{expense.description}</p>

                <div className="cc-list-meta cc-record-card__meta">
                  <span>{formatDateEs(expense.expense_date)}</span>
                  <span>{getExpenseDocumentSupportStatusLabel(expense.document_support_status)}</span>
                  <span>{getExpenseFiscalReviewStatusLabel(expense.fiscal_review_status)}</span>
                </div>

                <div className="cc-expense-item__chips">
                  <span className="cc-expense-chip">
                    Riesgo {getExpenseFiscalRiskLevelLabel(expense.fiscal_risk_level)}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
