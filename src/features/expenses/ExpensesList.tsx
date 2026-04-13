import { useMemo, useState } from 'react'
import { ListToolbar, type ListPreferences } from '../../components/ListToolbar'
import { matchesSearchQuery } from '../documents/search'
import {
  expenseCategories,
  expenseDocumentSupportStatuses,
  expenseFiscalReviewStatuses,
  expenseFiscalRiskLevels,
  expenseAiFiscalClassifications,
  getExpenseCategoryLabel,
  getExpenseAiFiscalClassificationLabel,
  getExpenseDocumentSupportStatusLabel,
  getExpenseFiscalReviewStatusLabel,
  getExpenseFiscalRiskLevelLabel,
  type ExpenseListItem,
} from './types'
import { applySortDirection, compareDate, compareNumber, compareText, createDefaultPreferences } from '../lists/listPreferences'
import {
  hasMediumHighFiscalRisk,
  hasValidVatInvoiceSupport,
  hasZeroEstimatedDeductibleVat,
  needsFiscalReview,
} from './fiscalIntelligenceSummary'

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
  const defaultPreferences = useMemo(() => createDefaultPreferences('expense_date', 'desc', {
    category: 'all',
    support: 'all',
    review: 'all',
    risk: 'all',
    fiscalFocus: 'all',
    classification: 'all',
  }), [])
  const [preferences, setPreferences] = useState<ListPreferences>(defaultPreferences)

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) =>
      (preferences.filters.category === 'all' || expense.category === preferences.filters.category) &&
      (preferences.filters.support === 'all' || expense.document_support_status === preferences.filters.support) &&
      (preferences.filters.review === 'all' || expense.fiscal_review_status === preferences.filters.review) &&
      (preferences.filters.risk === 'all' || expense.fiscal_risk_level === preferences.filters.risk) &&
      (preferences.filters.fiscalFocus === 'all' ||
        (preferences.filters.fiscalFocus === 'requires_review' && needsFiscalReview(expense)) ||
        (preferences.filters.fiscalFocus === 'medium_high_risk' && hasMediumHighFiscalRisk(expense)) ||
        (preferences.filters.fiscalFocus === 'vat_zero_estimate' && hasZeroEstimatedDeductibleVat(expense)) ||
        (preferences.filters.fiscalFocus === 'missing_valid_vat_invoice' && !hasValidVatInvoiceSupport(expense))) &&
      (preferences.filters.classification === 'all' || expense.ai_fiscal_classification === preferences.filters.classification) &&
      matchesSearchQuery(preferences.searchQuery, [
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
        expense.ai_fiscal_classification,
        getExpenseAiFiscalClassificationLabel(expense.ai_fiscal_classification),
        expense.total,
        expense.notes,
      ]),
    ).sort((left, right) => {
      const comparison = preferences.sortField === 'code'
        ? compareText(left.display_code ?? left.id, right.display_code ?? right.id)
        : preferences.sortField === 'supplier'
          ? compareText(left.supplier_name, right.supplier_name)
          : preferences.sortField === 'category'
            ? compareText(getExpenseCategoryLabel(left.category), getExpenseCategoryLabel(right.category))
            : preferences.sortField === 'total'
              ? compareNumber(left.total, right.total)
              : preferences.sortField === 'risk'
                ? compareText(getExpenseFiscalRiskLevelLabel(left.fiscal_risk_level), getExpenseFiscalRiskLevelLabel(right.fiscal_risk_level))
                : compareDate(left.expense_date, right.expense_date)
      return applySortDirection(comparison, preferences.sortDirection)
    })
  }, [expenses, preferences])

  return (
    <section className="data-section cc-module-list-section cc-expenses-list-section">
      <div className="section-header cc-list-section__header">
        <div>
          <h2>Explorar gastos</h2>
          <p>Proveedor, soporte fiscal y control documental en una sola lista.</p>
        </div>
      </div>

      <ListToolbar
        storageKey="costaclean-list-preferences-expenses"
        searchLabel="Buscar gasto"
        searchPlaceholder="Código, proveedor, descripción, categoría o riesgo"
        resultCount={filteredExpenses.length}
        totalCount={expenses.length}
        sortOptions={[
          { value: 'expense_date', label: 'Fecha del gasto' },
          { value: 'code', label: 'Código' },
          { value: 'supplier', label: 'Proveedor' },
          { value: 'category', label: 'Categoría' },
          { value: 'total', label: 'Importe total' },
          { value: 'risk', label: 'Riesgo fiscal' },
        ]}
        defaultPreferences={defaultPreferences}
        filters={[
          {
            key: 'category',
            label: 'Categoría',
            value: preferences.filters.category ?? 'all',
            options: [{ value: 'all', label: 'Todas' }, ...expenseCategories.map((category) => ({
              value: category,
              label: getExpenseCategoryLabel(category),
            }))],
          },
          {
            key: 'support',
            label: 'Soporte',
            value: preferences.filters.support ?? 'all',
            options: [{ value: 'all', label: 'Todos' }, ...expenseDocumentSupportStatuses.map((status) => ({
              value: status,
              label: getExpenseDocumentSupportStatusLabel(status),
            }))],
          },
          {
            key: 'review',
            label: 'Revisión',
            value: preferences.filters.review ?? 'all',
            options: [{ value: 'all', label: 'Todas' }, ...expenseFiscalReviewStatuses.map((status) => ({
              value: status,
              label: getExpenseFiscalReviewStatusLabel(status),
            }))],
          },
          {
            key: 'risk',
            label: 'Riesgo',
            value: preferences.filters.risk ?? 'all',
            options: [{ value: 'all', label: 'Todos' }, ...expenseFiscalRiskLevels.map((risk) => ({
              value: risk,
              label: getExpenseFiscalRiskLevelLabel(risk),
            }))],
          },
          {
            key: 'fiscalFocus',
            label: 'Estimacion fiscal',
            value: preferences.filters.fiscalFocus ?? 'all',
            options: [
              { value: 'all', label: 'Todas' },
              { value: 'requires_review', label: 'Requiere revision' },
              { value: 'medium_high_risk', label: 'Riesgo medio/alto' },
              { value: 'vat_zero_estimate', label: 'IVA estimado 0' },
              { value: 'missing_valid_vat_invoice', label: 'Sin factura valida IVA' },
            ],
          },
          {
            key: 'classification',
            label: 'Clasificacion',
            value: preferences.filters.classification ?? 'all',
            options: [{ value: 'all', label: 'Todas' }, ...expenseAiFiscalClassifications.map((classification) => ({
              value: classification,
              label: getExpenseAiFiscalClassificationLabel(classification),
            }))],
          },
        ]}
        onChange={setPreferences}
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
                  {expense.ai_fiscal_classification ? (
                    <span className="cc-expense-chip">
                      {getExpenseAiFiscalClassificationLabel(expense.ai_fiscal_classification)}
                    </span>
                  ) : null}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
