import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { FullscreenStepFlow } from '../../components/FullscreenStepFlow'
import { ConceptSuggestions } from '../concepts/ConceptSuggestions'
import { buildConceptMemoryIndex, getConceptSuggestions } from '../concepts/conceptMemory'
import { findExpenseDuplicateGroups } from '../duplicates/duplicateEngine'
import { DuplicateReviewOverlay } from '../duplicates/DuplicateReviewOverlay'
import type { InvoiceListItem } from '../invoices/types'
import type { QuoteListItem } from '../quotes/types'
import type { FullViewActionFlowProps } from '../shared/actionFlowLifecycle'
import { completeFullViewActionFlow } from '../shared/actionFlowLifecycle'
import { updateExpense } from './expenseApi'
import {
  expenseCategories,
  expenseDocumentSupportStatuses,
  expenseDocumentTypes,
  expenseFiscalReviewStatuses,
  expenseFiscalRiskLevels,
  expensePaymentStatuses,
  getExpenseCategoryLabel,
  getExpenseDocumentSupportStatusLabel,
  getExpenseDocumentTypeLabel,
  getExpenseFiscalReviewStatusLabel,
  getExpenseFiscalRiskLevelLabel,
  getExpensePaymentStatusLabel,
  type ExpenseListItem,
} from './types'

interface ExpenseEditFlowProps extends FullViewActionFlowProps {
  expense: ExpenseListItem
  title?: string
  description?: string
  submitLabel?: string
  allExpenses?: ExpenseListItem[]
  quotes?: QuoteListItem[]
  invoices?: InvoiceListItem[]
  onOpenExistingExpense?: (expenseId: string) => void
}

interface EditFormState {
  expense_date: string
  supplier_name: string
  category: string
  description: string
  document_type: string
  payment_status: string
  subtotal: string
  tax_rate: string
  tax_amount: string
  total: string
  is_deductible: boolean
  document_support_status: string
  fiscal_review_status: string
  fiscal_risk_level: string
  manager_note: string
  notes: string
}

function formatMoneyInput(value: number | null | undefined): string {
  return Number(value ?? 0).toFixed(2)
}

function formatCurrency(value: number | null | undefined): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(value ?? 0))
}

function parseDecimalInput(value: string): number {
  const normalized = value.trim().replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function buildFormState(expense: ExpenseListItem): EditFormState {
  return {
    expense_date: expense.expense_date,
    supplier_name: expense.supplier_name ?? '',
    category: expense.category ?? 'otros',
    description: expense.description ?? '',
    document_type: expense.document_type ?? 'ticket',
    payment_status: expense.payment_status ?? 'paid',
    subtotal: formatMoneyInput(expense.subtotal),
    tax_rate: formatMoneyInput(expense.tax_rate),
    tax_amount: formatMoneyInput(expense.tax_amount),
    total: formatMoneyInput(expense.total),
    is_deductible: expense.is_deductible ?? true,
    document_support_status: expense.document_support_status ?? 'missing',
    fiscal_review_status: expense.fiscal_review_status ?? 'pending',
    fiscal_risk_level: expense.fiscal_risk_level ?? 'medium',
    manager_note: expense.manager_note ?? '',
    notes: expense.notes ?? '',
  }
}

export function ExpenseEditFlow({
  expense,
  onRefreshData,
  onCompleted,
  onCancel,
  onDirtyChange,
  title = 'Editar gasto',
  description = 'La edicion principal vive en un flujo dedicado para evitar scroll largo dentro del detalle.',
  submitLabel = 'Guardar cambios',
  allExpenses = [],
  quotes = [],
  invoices = [],
  onOpenExistingExpense,
}: ExpenseEditFlowProps) {
  const [form, setForm] = useState<EditFormState>(() => buildFormState(expense))
  const [currentStep, setCurrentStep] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [pendingDuplicateGroups, setPendingDuplicateGroups] = useState<ReturnType<typeof findExpenseDuplicateGroups>>([])

  useEffect(() => {
    setForm(buildFormState(expense))
    setCurrentStep(0)
    setError(null)
    setIsDirty(false)
  }, [expense])

  useEffect(() => {
    onDirtyChange?.(isDirty)
    return () => onDirtyChange?.(false)
  }, [isDirty, onDirtyChange])

  const subtotalValue = useMemo(() => parseDecimalInput(form.subtotal || '0'), [form.subtotal])
  const taxRateValue = useMemo(() => parseDecimalInput(form.tax_rate || '0'), [form.tax_rate])
  const taxAmountValue = useMemo(() => parseDecimalInput(form.tax_amount || '0'), [form.tax_amount])
  const totalValue = useMemo(() => parseDecimalInput(form.total || '0'), [form.total])
  const conceptMemoryIndex = useMemo(
    () => buildConceptMemoryIndex({ quotes, invoices, expenses: allExpenses }),
    [quotes, invoices, allExpenses],
  )
  const descriptionSuggestions = useMemo(
    () => getConceptSuggestions(conceptMemoryIndex, {
      query: form.description,
      domain: 'expense',
      limit: 6,
    }),
    [conceptMemoryIndex, form.description],
  )

  const resolvedTaxAmount = Number.isNaN(subtotalValue) || Number.isNaN(taxRateValue)
    ? Number.NaN
    : Number(formatMoneyInput(subtotalValue * taxRateValue / 100))
  const resolvedTotal = Number.isNaN(subtotalValue)
    ? Number.NaN
    : Number(formatMoneyInput(subtotalValue + (Number.isNaN(taxAmountValue) ? resolvedTaxAmount || 0 : taxAmountValue)))

  function updateField<K extends keyof EditFormState>(field: K, value: EditFormState[K]) {
    setIsDirty(true)
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function recalculateAmounts() {
    if (Number.isNaN(subtotalValue) || Number.isNaN(taxRateValue)) {
      setError('Para recalcular importes debes indicar una base y un IVA validos.')
      return
    }

    updateField('tax_amount', formatMoneyInput(resolvedTaxAmount))
    updateField('total', formatMoneyInput(subtotalValue + resolvedTaxAmount))
    setError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>, skipDuplicateCheck = false) {
    event.preventDefault()
    setError(null)
    setIsSaving(true)

    try {
      if (!form.expense_date) {
        setError('Debes indicar la fecha del gasto.')
        return
      }

      if (!form.supplier_name.trim()) {
        setError('Debes indicar el proveedor.')
        return
      }

      if (!form.description.trim()) {
        setError('Debes indicar la descripcion del gasto.')
        return
      }

      if (Number.isNaN(subtotalValue) || Number.isNaN(taxRateValue)) {
        setError('Base imponible e IVA % deben ser numeros validos.')
        return
      }

      const finalTaxAmount = Number.isNaN(taxAmountValue) ? resolvedTaxAmount : Number(formatMoneyInput(taxAmountValue))
      const finalTotal = Number.isNaN(totalValue)
        ? Number(formatMoneyInput(subtotalValue + finalTaxAmount))
        : Number(formatMoneyInput(totalValue))

      if (!skipDuplicateCheck) {
        const duplicateGroups = findExpenseDuplicateGroups({
          ...expense,
          expense_date: form.expense_date,
          supplier_name: form.supplier_name,
          category: form.category,
          description: form.description,
          document_type: form.document_type,
          payment_status: form.payment_status,
          subtotal: Number(formatMoneyInput(subtotalValue)),
          tax_rate: Number(formatMoneyInput(taxRateValue)),
          tax_amount: finalTaxAmount,
          total: finalTotal,
          is_deductible: form.is_deductible,
          document_support_status: form.document_support_status,
          fiscal_review_status: form.fiscal_review_status,
          fiscal_risk_level: form.fiscal_risk_level,
          manager_note: form.manager_note.trim() || null,
          notes: form.notes.trim() || null,
        }, allExpenses)

        if (duplicateGroups.length > 0) {
          setPendingDuplicateGroups(duplicateGroups)
          return
        }
      }

      await updateExpense(expense.id, {
        expense_date: form.expense_date,
        supplier_name: form.supplier_name,
        category: form.category,
        description: form.description,
        document_type: form.document_type,
        payment_status: form.payment_status,
        subtotal: Number(formatMoneyInput(subtotalValue)),
        tax_rate: Number(formatMoneyInput(taxRateValue)),
        tax_amount: finalTaxAmount,
        total: finalTotal,
        is_deductible: form.is_deductible,
        document_support_status: form.document_support_status,
        fiscal_review_status: form.fiscal_review_status,
        fiscal_risk_level: form.fiscal_risk_level,
        manager_note: form.manager_note.trim() || null,
        notes: form.notes.trim() || null,
      })

      setIsDirty(false)
      await completeFullViewActionFlow({ onRefreshData, onCompleted })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido actualizando el gasto.'
      setError(message)
    } finally {
      setIsSaving(false)
    }
  }

  function requestCancel() {
    if (!onCancel) return
    if (!isDirty) {
      onCancel()
      return
    }

    setShowCancelConfirm(true)
  }

  return (
    <FullscreenStepFlow
      eyebrow="Gasto"
      title={title}
      description={description}
      steps={[
        { id: 'base', label: 'Origen y soporte', description: 'Proveedor, fecha y documento' },
        { id: 'amounts', label: 'Importes y pago', description: 'Base, IVA, total y estado' },
        { id: 'review', label: 'Revision fiscal', description: 'Clasificacion, riesgo y notas' },
      ]}
      currentStep={currentStep}
      onStepSelect={setCurrentStep}
      contextItems={[
        {
          label: 'Codigo',
          value: expense.display_code ?? expense.id,
          hint: 'Referencia principal del gasto',
        },
        {
          label: 'Proveedor',
          value: form.supplier_name.trim() || 'Pendiente',
          hint: 'Se mantiene visible durante la edicion',
        },
        {
          label: 'Total',
          value: Number.isNaN(resolvedTotal) ? 'Pendiente' : formatCurrency(resolvedTotal),
          hint: 'Lectura inmediata del impacto economico',
        },
      ]}
      sideContent={(
        <div className="cc-form-shell__summary-card cc-form-shell__summary-card--stack">
          <span>Lectura rapida</span>
          <strong>{getExpenseCategoryLabel(form.category)}</strong>
          <small>{form.description.trim() || 'Sin descripcion todavia'}</small>
        </div>
      )}
    >
      <form className="lead-form cc-detail-panel__editor" onSubmit={handleSubmit}>
        {currentStep === 0 ? (
          <section className="cc-form-shell__section">
            <div className="cc-form-shell__section-head">
              <strong>Origen y soporte</strong>
              <span>Deja resuelto el contexto base del gasto antes de tocar importes.</span>
            </div>

            <label className="form-field">
              <span>Fecha *</span>
              <input
                type="date"
                value={form.expense_date}
                onChange={(event) => updateField('expense_date', event.target.value)}
                required
              />
            </label>

            <label className="form-field">
              <span>Proveedor *</span>
              <input
                value={form.supplier_name}
                onChange={(event) => updateField('supplier_name', event.target.value)}
                placeholder="Ej. Repsol, Makro, Amazon"
                required
              />
            </label>

            <label className="form-field">
              <span>Categoria</span>
              <select
                value={form.category}
                onChange={(event) => updateField('category', event.target.value)}
              >
                {expenseCategories.map((category) => (
                  <option key={category} value={category}>
                    {getExpenseCategoryLabel(category)}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Tipo documento</span>
              <select
                value={form.document_type}
                onChange={(event) => updateField('document_type', event.target.value)}
              >
                {expenseDocumentTypes.map((documentType) => (
                  <option key={documentType} value={documentType}>
                    {getExpenseDocumentTypeLabel(documentType)}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Estado documental</span>
              <select
                value={form.document_support_status}
                onChange={(event) => updateField('document_support_status', event.target.value)}
              >
                {expenseDocumentSupportStatuses.map((status) => (
                  <option key={status} value={status}>
                    {getExpenseDocumentSupportStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field form-field-full">
              <span>Descripcion *</span>
              <input
                value={form.description}
                onChange={(event) => updateField('description', event.target.value)}
                placeholder="Ej. Compra de productos de limpieza"
                required
              />
            </label>
            <ConceptSuggestions
              suggestions={descriptionSuggestions}
              onUseConcept={(suggestion) => updateField('description', suggestion.label)}
            />
          </section>
        ) : null}

        {currentStep === 1 ? (
          <section className="cc-form-shell__section">
            <div className="cc-form-shell__section-head">
              <strong>Importes y pago</strong>
              <span>La lectura financiera vive en un paso propio y sin competir con notas o soporte.</span>
            </div>

            <label className="form-field">
              <span>Base imponible *</span>
              <input
                value={form.subtotal}
                onChange={(event) => updateField('subtotal', event.target.value)}
                placeholder="0.00"
                required
              />
            </label>

            <label className="form-field">
              <span>IVA %</span>
              <input
                value={form.tax_rate}
                onChange={(event) => updateField('tax_rate', event.target.value)}
                placeholder="21.00"
              />
            </label>

            <label className="form-field">
              <span>IVA EUR</span>
              <input
                value={form.tax_amount}
                onChange={(event) => updateField('tax_amount', event.target.value)}
                placeholder="0.00"
              />
            </label>

            <label className="form-field">
              <span>Total</span>
              <input
                value={form.total}
                onChange={(event) => updateField('total', event.target.value)}
                placeholder="0.00"
              />
            </label>

            <label className="form-field">
              <span>Estado de pago</span>
              <select
                value={form.payment_status}
                onChange={(event) => updateField('payment_status', event.target.value)}
              >
                {expensePaymentStatuses.map((status) => (
                  <option key={status} value={status}>
                    {getExpensePaymentStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>

            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={recalculateAmounts}>
                Recalcular importes
              </button>
            </div>
          </section>
        ) : null}

        {currentStep === 2 ? (
          <section className="cc-form-shell__section">
            <div className="cc-form-shell__section-head">
              <strong>Revision fiscal</strong>
              <span>Solo lo necesario para clasificar, dejar trazabilidad y cerrar la edicion principal.</span>
            </div>

            <label className="form-field">
              <span>Revision fiscal</span>
              <select
                value={form.fiscal_review_status}
                onChange={(event) => updateField('fiscal_review_status', event.target.value)}
              >
                {expenseFiscalReviewStatuses.map((status) => (
                  <option key={status} value={status}>
                    {getExpenseFiscalReviewStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Riesgo fiscal</span>
              <select
                value={form.fiscal_risk_level}
                onChange={(event) => updateField('fiscal_risk_level', event.target.value)}
              >
                {expenseFiscalRiskLevels.map((risk) => (
                  <option key={risk} value={risk}>
                    {getExpenseFiscalRiskLevelLabel(risk)}
                  </option>
                ))}
              </select>
            </label>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.is_deductible}
                onChange={(event) => updateField('is_deductible', event.target.checked)}
              />
              <span>Marcar como gasto deducible</span>
            </label>

            <label className="form-field form-field-full">
              <span>Nota para gestoria</span>
              <textarea
                rows={3}
                value={form.manager_note}
                onChange={(event) => updateField('manager_note', event.target.value)}
                placeholder="Observacion clave para revision o cierre"
              />
            </label>

            <label className="form-field form-field-full">
              <span>Notas internas</span>
              <textarea
                rows={4}
                value={form.notes}
                onChange={(event) => updateField('notes', event.target.value)}
                placeholder="Contexto interno que no debe perderse"
              />
            </label>
          </section>
        ) : null}

        {error ? (
          <div className="cc-alert cc-alert--error">
            <strong>No se pudo actualizar el gasto</strong>
            <p>{error}</p>
          </div>
        ) : null}

        <div className="form-actions">
          {currentStep > 0 ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => setCurrentStep((step) => step - 1)}
            >
              Volver
            </button>
          ) : onCancel ? (
            <button type="button" className="secondary-button" onClick={requestCancel}>
              Cancelar
            </button>
          ) : null}

          {currentStep < 2 ? (
            <button
              type="button"
              className="primary-button"
              onClick={() => setCurrentStep((step) => step + 1)}
            >
              Siguiente
            </button>
          ) : (
            <button type="submit" className="primary-button" disabled={isSaving}>
              {isSaving ? 'Guardando cambios...' : submitLabel}
            </button>
          )}
        </div>
      </form>

      <DuplicateReviewOverlay
        isOpen={pendingDuplicateGroups.length > 0}
        title="Posible gasto duplicado"
        description="La version editada coincide con otro gasto existente por proveedor, fecha, concepto o importe. Revisa antes de guardar."
        groups={pendingDuplicateGroups}
        onClose={() => setPendingDuplicateGroups([])}
        onOpenRecord={(expenseId) => {
          setPendingDuplicateGroups([])
          onOpenExistingExpense?.(expenseId)
        }}
        onUseRecord={(expenseId) => {
          setPendingDuplicateGroups([])
          onOpenExistingExpense?.(expenseId)
        }}
        onContinueAnyway={() => {
          setPendingDuplicateGroups([])
          void handleSubmit({ preventDefault() {} } as FormEvent<HTMLFormElement>, true)
        }}
      />

      <ConfirmDialog
        isOpen={showCancelConfirm}
        title="Descartar cambios del gasto"
        description="Has empezado a editar este gasto. Si cierras ahora, perderas los cambios no guardados."
        confirmLabel="Descartar cambios"
        tone="warning"
        onCancel={() => setShowCancelConfirm(false)}
        onConfirm={() => {
          setShowCancelConfirm(false)
          onCancel?.()
        }}
      />
    </FullscreenStepFlow>
  )
}
