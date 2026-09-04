import { useEffect, useState } from 'react'
import { ActionChecklist, type ActionChecklistItem } from '../components/ActionChecklist'
import { ExecutiveHeader } from '../components/ExecutiveHeader'
import { ModuleFilterBar } from '../components/ModuleFilterBar'
import { ActionFlowOverlay } from '../components/ActionFlowOverlay'
import { ProgressMetric } from '../components/ProgressMetric'
import { VisualKpiCard } from '../components/VisualKpiCard'
import { DuplicateNotice } from '../features/duplicates/DuplicateNotice'
import { useDuplicateResolution } from '../features/duplicates/duplicateResolution'
import { DuplicateReviewOverlay } from '../features/duplicates/DuplicateReviewOverlay'
import { buildExpenseDuplicateGroups } from '../features/duplicates/duplicateEngine'
import { buildExpenseCreatePrefillFromExpense, type ExpenseCreatePrefill } from '../features/expenses/expenseCreatePrefill'
import { ExpenseCreateFlow } from '../features/expenses/ExpenseCreateFlow'
import { ExpenseDetailCard } from '../features/expenses/ExpenseDetailCard'
import { ExpensesList } from '../features/expenses/ExpensesList'
import { buildExpenseFiscalSummary } from '../features/expenses/fiscalIntelligenceSummary'
import type { ExpenseListItem } from '../features/expenses/types'
import { formatCurrency } from '../app/displayFormat'
import type { InvoiceListItem } from '../features/invoices/types'
import type { QuoteListItem } from '../features/quotes/types'
import type { NavigationGuard } from '../app/navigationGuard'
import { compactVisibleItems, hasMeaningfulAmount, hasMeaningfulCount } from '../shared/ui/visibilityRules'

interface ExpensesPageProps {
  expenses: ExpenseListItem[]
  allExpenses: ExpenseListItem[]
  quotes: QuoteListItem[]
  invoices: InvoiceListItem[]
  error: string | null
  onExpenseCreated: () => Promise<void>
  activeFilterLabel: string | null
  onClearFilter: () => void
  onUnsavedChange?: (hasUnsavedChanges: boolean, contextLabel?: string) => void
  confirmNavigation?: NavigationGuard
}

export function ExpensesPage({
  expenses,
  allExpenses,
  quotes,
  invoices,
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
  const [showDuplicateReview, setShowDuplicateReview] = useState(false)
  const [createPrefill, setCreatePrefill] = useState<ExpenseCreatePrefill | null>(null)
  const [createdExpenseConfirmation, setCreatedExpenseConfirmation] = useState<string | null>(null)

  const selectedExpense =
    expenses.find((expense) => expense.id === selectedExpenseId) ?? expenses[0] ?? null
  const selectedExpenseKey = selectedExpense?.id ?? null
  const hasPendingWork = hasCreateFormDirty || hasUnsavedDetailChanges
  const rawDuplicateGroups = buildExpenseDuplicateGroups(expenses)
  const {
    visibleGroups: duplicateGroups,
    unresolvedGroups: unresolvedDuplicateGroups,
    reviewStateByGroupId,
    markReviewed,
    ignoreGroup,
    reopenGroup,
  } = useDuplicateResolution(rawDuplicateGroups)

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

  const fiscalSummary = buildExpenseFiscalSummary(expenses)
  const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.total ?? 0), 0)
  const missingSupportCount = fiscalSummary.missingValidVatInvoiceCount
  const supportedExpensesCount = Math.max(expenses.length - missingSupportCount, 0)
  const supportCoveragePercent = expenses.length > 0
    ? Math.round((supportedExpensesCount / expenses.length) * 100)
    : 100
  const checklistItems: ActionChecklistItem[] = compactVisibleItems<ActionChecklistItem>([
    missingSupportCount > 0 ? {
      id: 'support',
      state: 'warning',
      label: `${supportedExpensesCount} con soporte suficiente`,
      description: `${missingSupportCount} gasto(s) siguen sin cobertura valida para cierre y revision.`,
      action: expenses[0] ? {
        label: 'Revisar gastos',
        onClick: () => setSelectedExpenseId(selectedExpense?.id ?? expenses[0].id),
      } : undefined,
    } : null,
    fiscalSummary.needsReviewCount > 0 ? {
      id: 'review',
      state: 'warning',
      label: `${fiscalSummary.needsReviewCount} por revisar`,
      description: 'Siguen pendientes de revision fiscal interna antes de tratarlos como listos para cierre.',
    } : null,
    fiscalSummary.mediumHighRiskCount > 0 ? {
      id: 'risk',
      state: 'critical',
      label: `${fiscalSummary.mediumHighRiskCount} con riesgo medio/alto`,
      description: 'Necesitan foco antes de exportar o cerrar el periodo.',
    } : null,
    fiscalSummary.unanalyzedCount > 0 ? {
      id: 'analysis',
      state: 'info',
      label: `${fiscalSummary.analyzedCount} con analisis asistivo`,
      description: `${fiscalSummary.unanalyzedCount} siguen sin analisis asistivo, pero la lectura base sigue siendo determinista.`,
    } : null,
  ])
  const summaryKpis = compactVisibleItems([
    hasMeaningfulAmount(totalExpenses) ? (
      <VisualKpiCard
        key="expenses-total"
        label="Gasto total"
        value={formatCurrency(totalExpenses)}
        hint="Suma visible del modulo. No representa contabilidad final ni cierre validado."
        tone="info"
        priority="compact"
      />
    ) : null,
    expenses.length > 0 ? (
      <VisualKpiCard
        key="expenses-coverage"
        label="Cobertura documental"
        value={`${supportCoveragePercent}%`}
        hint="Soporte suficiente frente al total visible del modulo."
        tone={supportCoveragePercent >= 85 ? 'success' : supportCoveragePercent >= 60 ? 'warning' : 'critical'}
        priority="compact"
      />
    ) : null,
    hasMeaningfulCount(fiscalSummary.needsReviewCount) ? (
      <VisualKpiCard
        key="expenses-review"
        label="Gastos por revisar"
        value={String(fiscalSummary.needsReviewCount)}
        hint="Pendientes de revision fiscal interna o clasificados para revisar."
        tone="warning"
        priority="compact"
      />
    ) : null,
    hasMeaningfulCount(fiscalSummary.mediumHighRiskCount) ? (
      <VisualKpiCard
        key="expenses-risk"
        label="Riesgo medio/alto"
        value={String(fiscalSummary.mediumHighRiskCount)}
        hint="Casos con riesgo fiscal interno visible."
        tone="critical"
        priority="compact"
      />
    ) : null,
  ])

  async function handleExpenseCreated() {
    setShowCreateForm(false)
    setHasCreateFormDirty(false)
    setCreatePrefill(null)
  }

  return (
    <section className="page-section cc-master-page cc-expenses-page">
      <ExecutiveHeader
        eyebrow="Soporte y revision fiscal"
        title="Gastos"
        summary="Cobertura documental, revision pendiente y riesgo fiscal interno en una sola lectura. La prioridad es cerrar soporte y revision antes del cierre, sin afirmar criterio fiscal definitivo."
        statusLabel={fiscalSummary.mediumHighRiskCount > 0 ? `${fiscalSummary.mediumHighRiskCount} con riesgo` : 'Control documental estable'}
        statusTone={fiscalSummary.mediumHighRiskCount > 0 ? 'critical' : fiscalSummary.needsReviewCount > 0 ? 'warning' : 'success'}
        primaryAction={{
          label: showCreateForm ? 'Cerrar formulario' : 'Nuevo gasto',
          onClick: () => {
            if (showCreateForm) {
              runGuarded(() => {
                setShowCreateForm(false)
                setCreatePrefill(null)
              })
              return
            }

            setShowCreateForm(true)
          },
        }}
        secondaryAction={selectedExpense ? {
          label: 'Revisar gasto activo',
          onClick: () => setSelectedExpenseId(selectedExpense.id),
        } : undefined}
        metricLabel={expenses.length > 0 ? 'Cobertura documental' : undefined}
        metricValue={expenses.length > 0 ? `${supportCoveragePercent}%` : undefined}
        metricHint={expenses.length > 0
          ? `${supportedExpensesCount} de ${expenses.length} gasto(s) tienen soporte util para revision.`
          : undefined}
      >
        {expenses.length > 0 || checklistItems.length > 0 ? (
          <div className="cc-fiscal-closing-header-progress">
            {expenses.length > 0 ? (
              <ProgressMetric
                label="Soporte util"
                value={`${supportCoveragePercent}%`}
                percent={supportCoveragePercent}
                tone={supportCoveragePercent >= 85 ? 'success' : supportCoveragePercent >= 60 ? 'warning' : 'critical'}
                hint="Indicador interno basado en soporte documental visible y valido."
              />
            ) : null}
            {checklistItems.length > 0 ? <ActionChecklist items={checklistItems} compact /> : null}
          </div>
        ) : null}
      </ExecutiveHeader>

      {summaryKpis.length > 0 ? (
        <div className="cc-kpi-grid cc-kpi-grid--compact">
          {summaryKpis}
        </div>
      ) : null}

      {showCreateForm ? (
        <ActionFlowOverlay
          isOpen={showCreateForm}
          hasInternalFooter
          title="Nuevo gasto"
          description="El alta se resuelve en una superficie dedicada y al cerrar vuelves al mismo punto del modulo."
          onClose={() => {
            runGuarded(() => {
              setHasCreateFormDirty(false)
              setShowCreateForm(false)
              setCreatePrefill(null)
            })
          }}
        >
          <ExpenseCreateFlow
            expenses={allExpenses}
            quotes={quotes}
            invoices={invoices}
            prefill={createPrefill}
            onOpenExistingExpense={(expenseId) => {
              setHasCreateFormDirty(false)
              setShowCreateForm(false)
              setCreatePrefill(null)
              setSelectedExpenseId(expenseId)
            }}
            onRefreshData={onExpenseCreated}
            onCompleted={handleExpenseCreated}
            onCreatedExpense={({ id }) => {
              setSelectedExpenseId(id)
              setCreatedExpenseConfirmation(id)
            }}
            onCancel={() => {
              setHasCreateFormDirty(false)
              setShowCreateForm(false)
              setCreatePrefill(null)
            }}
            onDirtyChange={setHasCreateFormDirty}
          />
        </ActionFlowOverlay>
      ) : null}

      {createdExpenseConfirmation ? (
        <div
          className="cc-alert cc-alert--success"
          data-qa="expense-list-create-success"
          data-entity-id={createdExpenseConfirmation}
        >
          <strong>Gasto creado</strong>
          <p>El gasto {createdExpenseConfirmation} ya esta disponible para revision.</p>
        </div>
      ) : null}

      {unresolvedDuplicateGroups.length > 0 ? (
        <DuplicateNotice
          title={`${unresolvedDuplicateGroups.length} posibles gastos duplicados`}
          description="Se han detectado coincidencias por proveedor, referencia, fecha o importe. Revísalas desde una surface específica antes de seguir cargando gastos parecidos."
          actionLabel="Revisar duplicados"
          onAction={() => setShowDuplicateReview(true)}
        />
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
            expenses={allExpenses}
            quotes={quotes}
            invoices={invoices}
            onExpenseUpdated={onExpenseCreated}
            onCreateSimilarExpense={(expense) => {
              setCreatePrefill(buildExpenseCreatePrefillFromExpense(expense))
              setShowCreateForm(true)
            }}
            onUnsavedChange={setHasUnsavedDetailChanges}
            onOpenExistingExpense={(expenseId) => setSelectedExpenseId(expenseId)}
          />
        </div>
      </div>

      <DuplicateReviewOverlay
        isOpen={showDuplicateReview}
        title="Revisión de gastos duplicados"
        description="Estas coincidencias ya existen en el módulo y conviene revisarlas antes de seguir guardando soportes o importes parecidos."
        groups={duplicateGroups}
        reviewStateByGroupId={reviewStateByGroupId}
        onMarkReviewed={markReviewed}
        onIgnoreGroup={ignoreGroup}
        onReopenGroup={reopenGroup}
        onClose={() => setShowDuplicateReview(false)}
        onOpenRecord={(expenseId) => {
          setShowDuplicateReview(false)
          setSelectedExpenseId(expenseId)
        }}
      />
    </section>
  )
}
