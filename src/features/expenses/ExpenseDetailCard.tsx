import { useEffect, useMemo, useState } from 'react'
import { ActionGroup, type ActionGroupItem } from '../../components/ActionGroup'
import { ActionFlowOverlay } from '../../components/ActionFlowOverlay'
import { MajorEditFlowOverlay } from '../../components/MajorEditFlowOverlay'
import type { InvoiceListItem } from '../invoices/types'
import type { QuoteListItem } from '../quotes/types'
import { ExpenseEditFlow } from './ExpenseEditFlow'
import { ExpenseFiscalReviewPanel } from './ExpenseFiscalReviewPanel'
import { ExpenseSupportPanel } from './ExpenseSupportPanel'
import {
  getExpenseCategoryLabel,
  getExpenseAiFiscalClassificationLabel,
  getExpenseDocumentSupportStatusLabel,
  getExpenseDocumentTypeLabel,
  getExpenseFiscalReviewStatusLabel,
  getExpenseFiscalRiskLevelLabel,
  getExpensePaymentStatusLabel,
  type ExpenseListItem,
} from './types'
import './expense-surfaces.css'

interface ExpenseDetailCardProps {
  expense: ExpenseListItem | null
  expenses: ExpenseListItem[]
  quotes: QuoteListItem[]
  invoices: InvoiceListItem[]
  onExpenseUpdated: () => Promise<void>
  onUnsavedChange?: (hasUnsavedChanges: boolean) => void
  onOpenExistingExpense?: (expenseId: string) => void
}

function formatCurrency(value: number | null | undefined): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(value ?? 0))
}

function formatMoneyInput(value: number | null | undefined): string {
  return Number(value ?? 0).toFixed(2)
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

function resolvePrimaryAction(expense: ExpenseListItem) {
  if (!expense.receipt_file_path || expense.document_support_status === 'missing') {
    return {
      action: 'support',
      label: 'Completar soporte',
      detail: 'Falta el documento o no esta marcado como soporte valido.',
    } as const
  }

  if (expense.fiscal_review_status === 'pending' || expense.fiscal_risk_level === 'high') {
    return {
      action: 'fiscal',
      label: 'Resolver revision fiscal',
      detail: 'La lectura fiscal sigue abierta o con riesgo alto.',
    } as const
  }

  if (!expense.ai_fiscal_classification) {
    return {
      action: 'fiscal',
      label: 'Generar estimacion fiscal',
      detail: 'Todavia no existe lectura asistida para este gasto.',
    } as const
  }

  return {
    action: 'edit',
    label: 'Editar datos principales',
    detail: 'Usa la superficie de edicion para ajustar importes o clasificacion.',
  } as const
}

export function ExpenseDetailCard({
  expense,
  expenses,
  quotes,
  invoices,
  onExpenseUpdated,
  onUnsavedChange,
  onOpenExistingExpense,
}: ExpenseDetailCardProps) {
  const [showEditFlow, setShowEditFlow] = useState(false)
  const [showSupportSurface, setShowSupportSurface] = useState(false)
  const [showFiscalSurface, setShowFiscalSurface] = useState(false)
  const [hasEditDirty, setHasEditDirty] = useState(false)

  useEffect(() => {
    onUnsavedChange?.(hasEditDirty)
    return () => onUnsavedChange?.(false)
  }, [hasEditDirty, onUnsavedChange])

  const primaryAction = useMemo(
    () => (expense ? resolvePrimaryAction(expense) : null),
    [expense],
  )

  const headerActions: ActionGroupItem[] = expense ? [
    {
      key: 'edit-expense',
      label: 'Editar gasto',
      tone: 'primary',
      onClick: () => setShowEditFlow(true),
    },
    {
      key: 'support-expense',
      label: 'Gestionar soporte',
      onClick: () => setShowSupportSurface(true),
    },
    {
      key: 'fiscal-expense',
      label: 'Revision fiscal',
      onClick: () => setShowFiscalSurface(true),
    },
  ] : []

  return (
    <section className="data-section cc-expense-detail">
      <div className="section-header page-header-actions">
        <div>
          <h2>Detalle del gasto</h2>
        </div>

        {expense ? (
          <ActionGroup actions={headerActions} moreLabel="Mas acciones" />
        ) : null}
      </div>

      {expense ? (
        <div className="cc-expense-detail-card">
          <header className="cc-expense-detail__hero">
            <div className="cc-expense-detail__hero-copy">
              <span className="cc-expense-detail__eyebrow">
                {expense.display_code ?? expense.id}
              </span>
              <h3 className="cc-expense-detail__title">{expense.description}</h3>
              <p className="cc-expense-detail__subtitle">
                {expense.supplier_name} / {formatDateEs(expense.expense_date)}
              </p>
            </div>

            <div className="cc-expense-detail__total-card">
              <span className="cc-expense-detail__total-label">Total</span>
              <strong className="cc-expense-detail__total-value">
                {formatCurrency(expense.total)}
              </strong>
            </div>
          </header>

          <div className="cc-expense-detail__status-row">
            <span className="cc-expense-chip">
              {getExpenseCategoryLabel(expense.category)}
            </span>
            <span className="cc-expense-chip">
              {getExpensePaymentStatusLabel(expense.payment_status)}
            </span>
            <span className="cc-expense-chip">
              {getExpenseDocumentSupportStatusLabel(expense.document_support_status)}
            </span>
            <span className="cc-expense-chip">
              {getExpenseFiscalReviewStatusLabel(expense.fiscal_review_status)}
            </span>
            <span className="cc-expense-chip cc-expense-chip--risk">
              Riesgo {getExpenseFiscalRiskLevelLabel(expense.fiscal_risk_level)}
            </span>
          </div>

          {primaryAction ? (
            <div className="cc-detail-panel__next-step cc-expense-review-surface__next-step">
              <span>Siguiente paso recomendado</span>
              <strong>{primaryAction.label}</strong>
              <p>{primaryAction.detail}</p>
              <div className="form-actions cc-expense-review-surface__section-action">
                {primaryAction.action === 'support' ? (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => setShowSupportSurface(true)}
                  >
                    Abrir soporte
                  </button>
                ) : primaryAction.action === 'fiscal' ? (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => setShowFiscalSurface(true)}
                  >
                    Abrir revision fiscal
                  </button>
                ) : (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => setShowEditFlow(true)}
                  >
                    Abrir edicion principal
                  </button>
                )}
              </div>
            </div>
          ) : null}

          <section className="cc-expense-detail__section">
            <div className="cc-expense-detail__section-head">
              <h3>Resumen financiero</h3>
              <p>La ficha base queda para revisar rapido, no para editarlo todo.</p>
            </div>

            <div className="cc-expense-detail__metrics">
              <article className="cc-expense-metric">
                <span className="cc-expense-metric__label">Base imponible</span>
                <strong className="cc-expense-metric__value">
                  {formatCurrency(expense.subtotal)}
                </strong>
              </article>
              <article className="cc-expense-metric">
                <span className="cc-expense-metric__label">IVA</span>
                <strong className="cc-expense-metric__value">
                  {formatCurrency(expense.tax_amount)}
                </strong>
              </article>
              <article className="cc-expense-metric">
                <span className="cc-expense-metric__label">IVA %</span>
                <strong className="cc-expense-metric__value">
                  {formatMoneyInput(expense.tax_rate)}%
                </strong>
              </article>
              <article className="cc-expense-metric">
                <span className="cc-expense-metric__label">Tipo documento</span>
                <strong className="cc-expense-metric__value">
                  {getExpenseDocumentTypeLabel(expense.document_type)}
                </strong>
              </article>
            </div>
          </section>

          <section className="cc-expense-detail__section">
            <div className="cc-expense-detail__section-head">
              <h3>Soporte documental</h3>
              <p>Vista breve del documento, con gestion dedicada fuera del card.</p>
            </div>

            <div className="cc-expense-detail__doc-grid">
              <div className="cc-expense-detail__info-card">
                <span className="cc-expense-detail__info-label">Estado</span>
                <strong className="cc-expense-detail__info-value">
                  {expense.receipt_file_path ? 'Documento cargado' : 'Sin documento'}
                </strong>
              </div>
              <div className="cc-expense-detail__info-card">
                <span className="cc-expense-detail__info-label">Soporte</span>
                <strong className="cc-expense-detail__info-value">
                  {getExpenseDocumentSupportStatusLabel(expense.document_support_status)}
                </strong>
              </div>
              <div className="cc-expense-detail__info-card">
                <span className="cc-expense-detail__info-label">Adjuntos</span>
                <strong className="cc-expense-detail__info-value">
                  {expense.attachment_count ?? 0}
                </strong>
              </div>
            </div>

            <div className="form-actions cc-expense-review-surface__section-action">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowSupportSurface(true)}
              >
                Gestionar soporte
              </button>
            </div>
          </section>

          <section className="cc-expense-detail__section">
            <div className="cc-expense-detail__section-head">
              <h3>Revision fiscal</h3>
              <p>Jerarquia clara entre estado manual y lectura asistida.</p>
            </div>

            <div className="cc-expense-detail__info-grid">
              <div className="cc-expense-detail__info-card">
                <span className="cc-expense-detail__info-label">Revision</span>
                <strong className="cc-expense-detail__info-value">
                  {getExpenseFiscalReviewStatusLabel(expense.fiscal_review_status)}
                </strong>
              </div>
              <div className="cc-expense-detail__info-card">
                <span className="cc-expense-detail__info-label">Riesgo manual</span>
                <strong className="cc-expense-detail__info-value">
                  {getExpenseFiscalRiskLevelLabel(expense.fiscal_risk_level)}
                </strong>
              </div>
              <div className="cc-expense-detail__info-card">
                <span className="cc-expense-detail__info-label">Lectura asistida</span>
                <strong className="cc-expense-detail__info-value">
                  {expense.ai_fiscal_classification
                    ? getExpenseAiFiscalClassificationLabel(expense.ai_fiscal_classification)
                    : 'Sin estimacion'}
                </strong>
              </div>
              <div className="cc-expense-detail__info-card">
                <span className="cc-expense-detail__info-label">Deducible</span>
                <strong className="cc-expense-detail__info-value">
                  {expense.is_deductible ? 'Si' : 'No'}
                </strong>
              </div>
            </div>

            <div className="form-actions cc-expense-review-surface__section-action">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowFiscalSurface(true)}
              >
                Abrir revision fiscal
              </button>
            </div>
          </section>

          {(expense.manager_note || expense.notes) ? (
            <section className="cc-expense-detail__section">
              <div className="cc-expense-detail__section-head">
                <h3>Notas</h3>
                <p>Observaciones visibles sin obligar a entrar en la edicion.</p>
              </div>

              <div className="cc-expense-detail__notes">
                <article className="cc-expense-detail__note-card">
                  <span className="cc-expense-detail__info-label">Nota gestoria</span>
                  <p>{expense.manager_note ?? 'Sin nota'}</p>
                </article>
                <article className="cc-expense-detail__note-card">
                  <span className="cc-expense-detail__info-label">Notas internas</span>
                  <p>{expense.notes ?? 'Sin notas'}</p>
                </article>
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <div className="empty-state">
          <strong>Ningún gasto seleccionado</strong>
          <p>Haz clic en una tarjeta del listado para ver su detalle.</p>
        </div>
      )}

      {expense ? (
        <MajorEditFlowOverlay
          isOpen={showEditFlow}
          title="Editar gasto"
          description="La edicion principal se resuelve fuera de la ficha para evitar scroll y mezcla de responsabilidades."
          onClose={() => {
            setHasEditDirty(false)
            setShowEditFlow(false)
          }}
        >
          <ExpenseEditFlow
            expense={expense}
            allExpenses={expenses}
            quotes={quotes}
            invoices={invoices}
            onOpenExistingExpense={onOpenExistingExpense}
            onRefreshData={onExpenseUpdated}
            onCompleted={async () => {
              setHasEditDirty(false)
              setShowEditFlow(false)
            }}
            onCancel={() => {
              setHasEditDirty(false)
              setShowEditFlow(false)
            }}
            onDirtyChange={setHasEditDirty}
          />
        </MajorEditFlowOverlay>
      ) : null}

      {expense ? (
        <ActionFlowOverlay
          isOpen={showSupportSurface}
          title="Soporte documental"
          description="Gestiona ticket, factura y archivo adjunto en una superficie separada del detalle y de la edicion."
          onClose={() => setShowSupportSurface(false)}
        >
          <ExpenseSupportPanel expense={expense} onExpenseUpdated={onExpenseUpdated} />
        </ActionFlowOverlay>
      ) : null}

      {expense ? (
        <ActionFlowOverlay
          isOpen={showFiscalSurface}
          title="Revision fiscal"
          description="Revisa estado fiscal y lectura asistida sin ensuciar la ficha base del gasto."
          onClose={() => setShowFiscalSurface(false)}
        >
          <ExpenseFiscalReviewPanel expense={expense} onExpenseUpdated={onExpenseUpdated} />
        </ActionFlowOverlay>
      ) : null}
    </section>
  )
}
