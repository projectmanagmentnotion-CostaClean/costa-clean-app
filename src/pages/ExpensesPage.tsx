import { useEffect, useMemo, useState } from 'react'
import { ModuleFilterBar } from '../components/ModuleFilterBar'
import { ActionFlowOverlay } from '../components/ActionFlowOverlay'
import { ExpenseCreateFlow } from '../features/expenses/ExpenseCreateFlow'
import { ExpenseDetailCard } from '../features/expenses/ExpenseDetailCard'
import { ExpensesList } from '../features/expenses/ExpensesList'
import { buildExpenseFiscalSummary } from '../features/expenses/fiscalIntelligenceSummary'
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
  const [hasCreateFormDirty, setHasCreateFormDirty] = useState(false)
  const [hasUnsavedDetailChanges, setHasUnsavedDetailChanges] = useState(false)

  const selectedExpense =
    expenses.find((expense) => expense.id === selectedExpenseId) ?? expenses[0] ?? null
  const selectedExpenseKey = selectedExpense?.id ?? null
  const hasPendingWork = hasCreateFormDirty || hasUnsavedDetailChanges

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
      description: 'Hay cambios sin guardar en gastos. Si continuas, perderas esos cambios.',
      confirmLabel: 'Continuar',
    })
  }

  const summary = useMemo(() => {
    const totalAmount = expenses.reduce(
      (sum, expense) => sum + Number(expense.total ?? 0),
      0,
    )
    const fiscalSummary = buildExpenseFiscalSummary(expenses)

    return {
      totalItems: expenses.length,
      totalAmount,
      fiscalSummary,
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
          <p>Control operativo, fiscal y documental con lectura rapida en movil.</p>
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
          <p className="cc-kpi-footnote">Gastos disponibles en el modulo</p>
        </article>

        <article className="cc-kpi-card">
          <span className="cc-kpi-label">Importe total</span>
          <strong className="cc-kpi-value">{formatCurrency(summary.totalAmount)}</strong>
          <p className="cc-kpi-footnote">Suma total de los gastos cargados</p>
        </article>

        <article className="cc-kpi-card">
          <span className="cc-kpi-label">IVA soportado total</span>
          <strong className="cc-kpi-value">{formatCurrency(summary.fiscalSummary.totalVatSupported)}</strong>
          <p className="cc-kpi-footnote">IVA registrado en gastos</p>
        </article>

        <article className="cc-kpi-card cc-kpi-card--finance">
          <span className="cc-kpi-label">IVA deducible estimado</span>
          <strong className="cc-kpi-value">{formatCurrency(summary.fiscalSummary.estimatedDeductibleVat)}</strong>
          <p className="cc-kpi-footnote">Estimacion asistida, no definitiva</p>
        </article>

        <article className="cc-kpi-card cc-kpi-card--finance">
          <span className="cc-kpi-label">Base deducible estimada</span>
          <strong className="cc-kpi-value">{formatCurrency(summary.fiscalSummary.estimatedDeductibleBase)}</strong>
          <p className="cc-kpi-footnote">Usa IA si existe y fallback manual</p>
        </article>

        <article className="cc-kpi-card cc-kpi-card--warning">
          <span className="cc-kpi-label">Requiere revision</span>
          <strong className="cc-kpi-value">{summary.fiscalSummary.needsReviewCount}</strong>
          <p className="cc-kpi-footnote">Pendientes o marcados por estimacion</p>
        </article>

        <article className="cc-kpi-card cc-kpi-card--warning">
          <span className="cc-kpi-label">Riesgo fiscal</span>
          <strong className="cc-kpi-value">{summary.fiscalSummary.mediumHighRiskCount}</strong>
          <p className="cc-kpi-footnote">Gastos con riesgo medio/alto</p>
        </article>

        <article className="cc-kpi-card">
          <span className="cc-kpi-label">Sin factura valida IVA</span>
          <strong className="cc-kpi-value">{summary.fiscalSummary.missingValidVatInvoiceCount}</strong>
          <p className="cc-kpi-footnote">Revisar antes de deducir IVA</p>
        </article>
      </section>

      {showCreateForm ? (
        <ActionFlowOverlay
          isOpen={showCreateForm}
          title="Nuevo gasto"
          description="El alta se resuelve en una superficie dedicada y al cerrar vuelves al mismo punto del modulo."
          onClose={() => {
            runGuarded(() => {
              setHasCreateFormDirty(false)
              setShowCreateForm(false)
            })
          }}
        >
          <ExpenseCreateFlow
            onRefreshData={onExpenseCreated}
            onCompleted={handleExpenseCreated}
            onCancel={() => {
              setHasCreateFormDirty(false)
              setShowCreateForm(false)
            }}
            onDirtyChange={setHasCreateFormDirty}
          />
        </ActionFlowOverlay>
      ) : null}

      {activeFilterLabel ? (
        <ModuleFilterBar label={activeFilterLabel} onClear={onClearFilter} />
      ) : null}

      <div className="cc-master-layout cc-master-layout--list-first">
        <div className="cc-master-layout__list">
          <ExpensesList
            expenses={expenses}
            error={error}
            selectedExpenseId={selectedExpenseKey}
            onSelectExpense={(expense) => {
              if (expense.id === selectedExpenseKey) return
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
