import { useMemo, useState } from 'react'
import { SearchBar } from '../../components/SearchBar'
import { matchesSearchQuery } from '../documents/search'
import {
  getExpenseCategoryLabel,
  getExpenseDocumentSupportStatusLabel,
  getExpenseDocumentTypeLabel,
  getExpenseFiscalReviewStatusLabel,
  getExpenseFiscalRiskLevelLabel,
  getExpensePaymentStatusLabel,
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
        expense.document_type,
        getExpenseDocumentTypeLabel(expense.document_type),
        expense.payment_status,
        getExpensePaymentStatusLabel(expense.payment_status),
        expense.document_support_status,
        getExpenseDocumentSupportStatusLabel(expense.document_support_status),
        expense.fiscal_review_status,
        getExpenseFiscalReviewStatusLabel(expense.fiscal_review_status),
        expense.fiscal_risk_level,
        getExpenseFiscalRiskLevelLabel(expense.fiscal_risk_level),
        expense.manager_note,
        expense.subtotal,
        expense.tax_amount,
        expense.total,
        expense.is_deductible ? 'deducible' : 'no deducible',
        expense.notes,
      ]),
    )
  }, [expenses, searchQuery])

  return (
    <section className="data-section">
      <div className="section-header">
        <h2>Gastos</h2>
        <p>Listado operativo de gastos con control fiscal y documental base.</p>
      </div>

      <SearchBar
        label="Buscar gasto"
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Código, proveedor, descripción, categoría, revisión o riesgo"
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
        <div className="lead-list">
          {filteredExpenses.map((expense) => {
            const isSelected = expense.id === selectedExpenseId

            return (
              <button
                key={expense.id}
                type="button"
                className={
                  isSelected
                    ? 'lead-item lead-item-button selected'
                    : 'lead-item lead-item-button'
                }
                onClick={() => onSelectExpense(expense)}
              >
                <div className="lead-item-top">
                  <strong>{expense.display_code ?? expense.id}</strong>
                </div>

                <p>Descripción: {expense.description}</p>
                <p>Proveedor: {expense.supplier_name}</p>
                <p>Fecha: {formatDateEs(expense.expense_date)}</p>
                <p>Total: {formatCurrency(expense.total)}</p>
                <p>Documento: {getExpenseDocumentSupportStatusLabel(expense.document_support_status)}</p>
                <p>Revisión: {getExpenseFiscalReviewStatusLabel(expense.fiscal_review_status)}</p>
                <p>Riesgo: {getExpenseFiscalRiskLevelLabel(expense.fiscal_risk_level)}</p>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
