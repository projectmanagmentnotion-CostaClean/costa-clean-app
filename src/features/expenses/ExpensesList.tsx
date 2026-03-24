import { useMemo, useState } from 'react'
import { SearchBar } from '../../components/SearchBar'
import { matchesSearchQuery } from '../documents/search'
import type { ExpenseListItem } from './types'

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

function getExpenseCategoryLabel(value: string | null | undefined): string {
  switch (value) {
    case 'products': return 'Productos'
    case 'transport': return 'Transporte'
    case 'fuel': return 'Combustible'
    case 'materials': return 'Materiales'
    case 'maintenance': return 'Mantenimiento'
    case 'software': return 'Software'
    case 'supplies': return 'Suministros'
    case 'rent': return 'Alquiler'
    case 'utilities': return 'Servicios'
    case 'marketing': return 'Marketing'
    case 'professional_services': return 'Servicios profesionales'
    case 'other': return 'Otros'
    default: return value ?? 'Sin categoría'
  }
}

function getReceiptStatusLabel(value: string | null | undefined): string {
  switch (value) {
    case 'pending': return 'Pendiente'
    case 'uploaded': return 'Subido'
    case 'validated': return 'Validado'
    default: return value ?? 'Sin estado'
  }
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
        expense.category,
        getExpenseCategoryLabel(expense.category),
        expense.supplier,
        expense.concept,
        expense.amount,
        expense.tax_amount,
        expense.total,
        expense.is_deductible ? 'deducible' : 'no deducible',
        expense.receipt_status,
        getReceiptStatusLabel(expense.receipt_status),
        expense.notes,
      ]),
    )
  }, [expenses, searchQuery])

  return (
    <section className="data-section">
      <div className="section-header">
        <h2>Gastos</h2>
        <p>Listado operativo de gastos deducibles y justificantes.</p>
      </div>

      <SearchBar
        label="Buscar gasto"
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Código, proveedor, concepto, categoría, fecha o importe"
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

                <p>Concepto: {expense.concept}</p>
                <p>Proveedor: {expense.supplier ?? 'Sin proveedor'}</p>
                <p>Fecha: {formatDateEs(expense.expense_date)}</p>
                <p>Total: {formatCurrency(expense.total ?? expense.amount)}</p>
                <p>Categoría: {getExpenseCategoryLabel(expense.category)}</p>
                <p>Ticket: {getReceiptStatusLabel(expense.receipt_status)}</p>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}