import { useEffect, useMemo, useState } from 'react'
import { ModuleFilterBar } from '../components/ModuleFilterBar'
import { ExpenseCreateForm } from '../features/expenses/ExpenseCreateForm'
import { ExpenseDetailCard } from '../features/expenses/ExpenseDetailCard'
import { ExpensesList } from '../features/expenses/ExpensesList'
import type { ExpenseListItem } from '../features/expenses/types'
import type { NavigationGuard } from '../app/navigationGuard'

interface ExpensesPageProps {
  expenses: ExpenseListItem[]
  error: string | null
  onExpenseCreated: () => Promise<void>
  activeFilterLabel: string | null
  onClearFilter: () => void
  onUnsavedChange?: (hasUnsavedChanges: boolean, contextLabel?: string) => void
  confirmNavigation?: NavigationGuard
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
  activeFilterLabel,
  onClearFilter,
  onUnsavedChange,
  confirmNavigation,
}: ExpensesPageProps) {
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [hasUnsavedDetailChanges, setHasUnsavedDetailChanges] = useState(false)

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
  const hasPendingWork = showCreateForm || hasUnsavedDetailChanges

  useEffect(() => {
    onUnsavedChange?.(hasPendingWork, 'cambios sin guardar en gastos')
    return () => onUnsavedChange?.(false)
  }, [hasPendingWork, onUnsavedChange])

  function runGuarded(action: () => void) {
    if (!hasPendingWork) {
      action()
      return
    }

    if (!confirmNavigation) {
      action()
      return
    }

    confirmNavigation(action, {
      description: 'Hay cambios sin guardar en gastos. Si continúas, perderás esos cambios.',
      confirmLabel: 'Continuar',
    })
  }

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

  async function handleExpenseCreated() {
    await onExpenseCreated()
    setShowCreateForm(false)
  }

  return (
    <section className="page-section cc-master-page cc-expenses-page">
      <div className="section-header page-header-actions cc-master-page__hero cc-expenses-hero">
        <div>
          <h1>Gastos</h1>
          <p>Control operativo, fiscal y documental con lectura rápida en móvil.</p>
        </div>

        <button
          type="button"
          className={showCreateForm ? 'secondary-button' : 'primary-button'}
          onClick={() => {
            if (showCreateForm) {
              runGuarded(() => setShowCreateForm(false))
              return
            }

            setShowCreateForm(true)
          }}
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

          <ExpenseCreateForm onCreated={handleExpenseCreated} />
        </section>
      ) : null}

      {activeFilterLabel ? (
        <ModuleFilterBar label={activeFilterLabel} onClear={onClearFilter} />
      ) : null}

      <div className="cc-master-layout cc-master-layout--list-first">
        <div className="cc-master-layout__list">
          <ExpensesList
            expenses={expenses}
            error={error}
            selectedExpenseId={selectedExpenseId}
            onSelectExpense={(expense) => {
              if (expense.id === selectedExpenseId) return
              runGuarded(() => setSelectedExpenseId(expense.id))
            }}
          />
        </div>

        <div className="cc-master-layout__detail">
          <ExpenseDetailCard
            expense={selectedExpense}
            onExpenseUpdated={onExpenseCreated}
            onUnsavedChange={setHasUnsavedDetailChanges}
          />
        </div>
      </div>
    </section>
  )
}
