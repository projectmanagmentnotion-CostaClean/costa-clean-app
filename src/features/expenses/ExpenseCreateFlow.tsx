import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { DSConceptAutocomplete } from '../../design-system/components'
import { FullscreenStepFlow } from '../../components/FullscreenStepFlow'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { buildConceptMemoryIndex, getConceptSuggestions } from '../concepts/conceptMemory'
import { findExpenseDuplicateGroups } from '../duplicates/duplicateEngine'
import { DuplicateReviewOverlay } from '../duplicates/DuplicateReviewOverlay'
import type { InvoiceListItem } from '../invoices/types'
import type { QuoteListItem } from '../quotes/types'
import type { FullViewActionFlowProps } from '../shared/actionFlowLifecycle'
import { createExpense, updateExpenseAttachment } from './expenseApi'
import type { ExpenseCreatePrefill } from './expenseCreatePrefill'
import { uploadExpenseReceipt } from './expenseAttachmentsApi'
import { ExpenseSupportFieldset } from './ExpenseSupportFieldset'
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

interface ExpenseCreateFlowProps extends FullViewActionFlowProps {
  title?: string
  description?: string
  submitLabel?: string
  expenses?: ExpenseListItem[]
  quotes?: QuoteListItem[]
  invoices?: InvoiceListItem[]
  prefill?: ExpenseCreatePrefill | null
  onOpenExistingExpense?: (expenseId: string) => void
  onCreatedExpense?: (expense: Pick<ExpenseListItem, 'id'>) => void | Promise<void>
}

interface CreateFormState {
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

const defaultFormState: CreateFormState = {
  expense_date: '',
  supplier_name: '',
  category: 'otros',
  description: '',
  document_type: 'ticket',
  payment_status: 'paid',
  subtotal: '',
  tax_rate: '21.00',
  tax_amount: '0.00',
  total: '',
  is_deductible: true,
  document_support_status: 'missing',
  fiscal_review_status: 'pending',
  fiscal_risk_level: 'medium',
  manager_note: '',
  notes: '',
}

function parseDecimalInput(value: string): number {
  const normalized = value.trim().replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function formatMoneyInput(value: number): string {
  return value.toFixed(2)
}

function todayLocalDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function ExpenseCreateFlow({
  onRefreshData,
  onCompleted,
  onCancel,
  onDirtyChange,
  title = 'Nuevo gasto',
  description = 'Alta fiscal y operativa en una superficie dedicada, sin formulario inline largo.',
  submitLabel = 'Guardar gasto',
  expenses = [],
  quotes = [],
  invoices = [],
  prefill = null,
  onOpenExistingExpense,
  onCreatedExpense,
}: ExpenseCreateFlowProps) {
  const [form, setForm] = useState<CreateFormState>(() => ({
    ...defaultFormState,
    expense_date: todayLocalDate(),
    supplier_name: prefill?.supplier_name ?? defaultFormState.supplier_name,
    category: prefill?.category ?? defaultFormState.category,
    description: prefill?.description ?? defaultFormState.description,
    document_type: prefill?.document_type ?? defaultFormState.document_type,
    payment_status: prefill?.payment_status ?? defaultFormState.payment_status,
    subtotal: prefill?.subtotal ?? defaultFormState.subtotal,
    tax_rate: prefill?.tax_rate ?? defaultFormState.tax_rate,
    tax_amount: prefill?.tax_amount ?? defaultFormState.tax_amount,
    total: prefill?.total ?? defaultFormState.total,
    document_support_status: 'missing',
    fiscal_review_status: 'pending',
    fiscal_risk_level: 'medium',
    notes: prefill?.notes ?? defaultFormState.notes,
  }))
  const [currentStep, setCurrentStep] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [pendingDuplicateGroups, setPendingDuplicateGroups] = useState<ReturnType<typeof findExpenseDuplicateGroups>>([])
  const [createdExpenseId, setCreatedExpenseId] = useState<string | null>(null)
  const [pendingReceiptFile, setPendingReceiptFile] = useState<File | null>(null)
  const [lastAppliedPrefillId, setLastAppliedPrefillId] = useState<string | null>(prefill?.request_id ?? null)
  const formRef = useRef<HTMLFormElement | null>(null)

  useEffect(() => {
    onDirtyChange?.(isDirty)
    return () => onDirtyChange?.(false)
  }, [isDirty, onDirtyChange])

  useEffect(() => {
    if (!prefill || prefill.request_id === lastAppliedPrefillId) return

    setForm({
      ...defaultFormState,
      expense_date: todayLocalDate(),
      supplier_name: prefill.supplier_name,
      category: prefill.category,
      description: prefill.description,
      document_type: prefill.document_type,
      payment_status: prefill.payment_status,
      subtotal: prefill.subtotal,
      tax_rate: prefill.tax_rate,
      tax_amount: prefill.tax_amount,
      total: prefill.total,
      document_support_status: 'missing',
      fiscal_review_status: 'pending',
      fiscal_risk_level: 'medium',
      notes: prefill.notes,
    })
    setCurrentStep(0)
    setPendingReceiptFile(null)
    setError(null)
    setIsDirty(false)
    setLastAppliedPrefillId(prefill.request_id)
  }, [lastAppliedPrefillId, prefill])

  useEffect(() => {
    if (currentStep !== 0) return

    const frameId = window.requestAnimationFrame(() => {
      const firstField = formRef.current?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])',
      )
      const scrollContainer = formRef.current?.closest('.cc-step-flow__content') as HTMLDivElement | null

      if (firstField && scrollContainer) {
        const fieldTop = firstField.getBoundingClientRect().top
        const containerTop = scrollContainer.getBoundingClientRect().top
        const nextScrollTop = scrollContainer.scrollTop + Math.max(fieldTop - containerTop - 16, 0)
        scrollContainer.scrollTo({
          top: nextScrollTop,
          behavior: 'auto',
        })
      }

      firstField?.scrollIntoView({
        block: 'start',
        inline: 'nearest',
      })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [currentStep])

  const subtotalValue = useMemo(() => parseDecimalInput(form.subtotal || '0'), [form.subtotal])
  const taxRateValue = useMemo(() => parseDecimalInput(form.tax_rate || '0'), [form.tax_rate])
  const taxAmountValue = useMemo(() => parseDecimalInput(form.tax_amount || '0'), [form.tax_amount])
  const totalValue = useMemo(() => parseDecimalInput(form.total || '0'), [form.total])
  const conceptMemoryIndex = useMemo(
    () => buildConceptMemoryIndex({ quotes, invoices, expenses }),
    [quotes, invoices, expenses],
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
  const flowContextItems = currentStep === 0 ? [] : [
    {
      label: 'Proveedor',
      value: form.supplier_name.trim() || 'Pendiente',
      hint: 'Referencia principal del gasto',
    },
    {
      label: 'Total previsto',
      value: Number.isNaN(resolvedTotal) ? 'Pendiente' : `${formatMoneyInput(resolvedTotal)} EUR`,
      hint: 'Se recalcula desde base e IVA',
    },
    {
      label: 'Soporte',
      value: pendingReceiptFile ? 'Preparado' : getExpenseDocumentSupportStatusLabel(form.document_support_status),
      hint: pendingReceiptFile ? 'Se subira con el alta final' : 'Estado documental visible',
    },
  ]
  const flowSideContent = currentStep === 0 ? null : (
    <div className="cc-form-shell__summary-card cc-form-shell__summary-card--stack">
      <span>Lectura rapida</span>
      <strong>{getExpenseCategoryLabel(form.category)}</strong>
      <small>{form.description.trim() || 'Sin descripcion todavia'}</small>
    </div>
  )

  function updateField<K extends keyof CreateFormState>(field: K, value: CreateFormState[K]) {
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

      if (Number.isNaN(subtotalValue)) {
        setError('La base imponible debe ser un numero valido.')
        return
      }

      if (Number.isNaN(taxRateValue)) {
        setError('El tipo de IVA debe ser un numero valido.')
        return
      }

      const finalTaxAmount = Number.isNaN(taxAmountValue) ? resolvedTaxAmount : Number(formatMoneyInput(taxAmountValue))
      const finalTotal = Number.isNaN(totalValue) ? Number(formatMoneyInput(subtotalValue + finalTaxAmount)) : Number(formatMoneyInput(totalValue))

      if (!skipDuplicateCheck) {
        const duplicateGroups = findExpenseDuplicateGroups({
          id: `EXPENSE-DRAFT-${Date.now()}`,
          display_code: null,
          expense_number: null,
          expense_date: form.expense_date,
          accounting_date: null,
          due_date: null,
          supplier_name: form.supplier_name,
          supplier_tax_id: null,
          category: form.category,
          subcategory: null,
          description: form.description,
          document_type: form.document_type,
          reference_number: null,
          payment_method: null,
          payment_status: form.payment_status,
          currency: 'EUR',
          subtotal: Number(formatMoneyInput(subtotalValue)),
          tax_rate: Number(formatMoneyInput(taxRateValue)),
          tax_amount: finalTaxAmount,
          total: finalTotal,
          is_deductible: form.is_deductible,
          deductible_percentage: 100,
          affects_quarterly_closure: true,
          affects_annual_closure: true,
          receipt_file_url: null,
          receipt_file_path: null,
          attachment_count: 0,
          document_support_status: form.document_support_status,
          fiscal_review_status: form.fiscal_review_status,
          fiscal_risk_level: form.fiscal_risk_level,
          manager_note: form.manager_note.trim() || null,
          ai_fiscal_classification: null,
          ai_deductibility_percentage: null,
          ai_vat_deductibility_percentage: null,
          ai_estimated_deductible_base: null,
          ai_estimated_deductible_vat: null,
          ai_fiscal_confidence: null,
          ai_fiscal_risk_level: null,
          ai_fiscal_reasoning: null,
          ai_fiscal_flags: null,
          ai_fiscal_model: null,
          ai_fiscal_analyzed_at: null,
          ai_fiscal_source_version: null,
          notes: form.notes.trim() || null,
        }, expenses)

        if (duplicateGroups.length > 0) {
          setPendingDuplicateGroups(duplicateGroups)
          return
        }
      }

      const createdExpenseId = await createExpense({
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

      if (pendingReceiptFile) {
        const { filePath } = await uploadExpenseReceipt(createdExpenseId, pendingReceiptFile)
        await updateExpenseAttachment(createdExpenseId, filePath)
      }

      setIsDirty(false)
      setPendingReceiptFile(null)
      await onCreatedExpense?.({ id: createdExpenseId })
      await onRefreshData()
      setCreatedExpenseId(createdExpenseId)
      setCurrentStep(3)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido creando el gasto.'
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
        { id: 'base', label: 'Origen y documento', description: 'Proveedor, fecha y soporte' },
        { id: 'amounts', label: 'Importes y pago', description: 'Base, IVA y estado' },
        { id: 'review', label: 'Revision fiscal', description: 'Riesgo, deducibilidad y notas' },
        { id: 'success', label: 'Confirmacion', description: 'Gasto guardado y listo para revisar' },
      ]}
      currentStep={createdExpenseId ? 3 : currentStep}
      onStepSelect={createdExpenseId ? undefined : setCurrentStep}
      hideCurrentStepSummary={!createdExpenseId && currentStep === 0}
      hideHeroMeta={!createdExpenseId && currentStep === 0}
      contextItems={flowContextItems}
      sideContent={flowSideContent}
    >
      {createdExpenseId ? (
        <section
          className="cc-create-flow__section"
          data-qa="expense-create-success"
          data-entity-id={createdExpenseId}
        >
          <article className="cc-create-flow__status-card cc-create-flow__status-card--ready">
            <span className="cc-create-flow__status-icon" aria-hidden="true">OK</span>
            <div className="cc-create-flow__status-copy">
              <span>Registro completado</span>
              <strong>Gasto creado</strong>
              <small>{createdExpenseId}</small>
            </div>
          </article>
          <div className="form-actions">
            <button type="button" className="primary-button" onClick={() => void onCompleted()}>
              Volver a gastos
            </button>
          </div>
        </section>
      ) : (
      <form ref={formRef} className="lead-form cc-detail-panel__editor" onSubmit={handleSubmit}>
        {currentStep === 0 ? (
          <section className="cc-form-shell__section">
            <div className="cc-form-shell__section-head">
              <strong>Origen y soporte</strong>
              <span>Fecha real, proveedor y documento que respalda el gasto.</span>
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
                placeholder="Ej. Makro, Repsol, Amazon"
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

            <div className="form-field form-field-full">
              <ExpenseSupportFieldset
                pendingFile={pendingReceiptFile}
                documentType={form.document_type}
                documentSupportStatus={form.document_support_status}
                onPendingFileChange={(file) => {
                  setIsDirty(true)
                  setPendingReceiptFile(file)
                }}
                onDocumentSupportStatusChange={(status) => updateField('document_support_status', status)}
              />
            </div>

            <DSConceptAutocomplete
              label="Descripcion"
              value={form.description}
              onChange={(value) => updateField('description', value)}
              suggestions={descriptionSuggestions}
              onUseConcept={(suggestion) => updateField('description', suggestion.label)}
              hint="Sugerencias compactas segun gastos ya registrados."
              placeholder="Ej. Compra de productos de limpieza"
              required
            />
          </section>
        ) : null}

        {currentStep === 1 ? (
          <section className="cc-form-shell__section">
            <div className="cc-form-shell__section-head">
              <strong>Importes y pago</strong>
              <span>Lectura financiera del gasto y su estado actual.</span>
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
              <span>Solo lo necesario para clasificar el gasto y dejar trazabilidad interna.</span>
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
              <span>Marcar como deducible</span>
            </label>

            <label className="form-field form-field-full">
              <span>Nota para gestoria</span>
              <textarea
                rows={3}
                value={form.manager_note}
                onChange={(event) => updateField('manager_note', event.target.value)}
                placeholder="Observacion especifica para revision o cierre"
              />
            </label>

            <label className="form-field form-field-full">
              <span>Notas internas</span>
              <textarea
                rows={4}
                value={form.notes}
                onChange={(event) => updateField('notes', event.target.value)}
                placeholder="Observaciones internas o contexto del gasto"
              />
            </label>
          </section>
        ) : null}

        {error ? (
          <div className="cc-alert cc-alert--error">
            <strong>No se pudo crear el gasto</strong>
            <p>{error}</p>
          </div>
        ) : null}

        <div className="form-actions">
          {currentStep > 0 ? (
            <button type="button" className="secondary-button" onClick={() => setCurrentStep((step) => step - 1)}>
              Volver
            </button>
          ) : onCancel ? (
            <button type="button" className="secondary-button" onClick={requestCancel}>
              Cancelar
            </button>
          ) : null}

          {currentStep < 2 ? (
            <button type="button" className="primary-button" onClick={() => setCurrentStep((step) => step + 1)}>
              Siguiente
            </button>
          ) : (
            <button type="submit" className="primary-button" disabled={isSaving}>
              {isSaving ? 'Guardando gasto...' : submitLabel}
            </button>
          )}
        </div>
      </form>
      )}

      <DuplicateReviewOverlay
        isOpen={pendingDuplicateGroups.length > 0}
        title="Posible gasto duplicado"
        description="Este gasto coincide con otro por proveedor, fecha, concepto o importe. Revisa antes de guardarlo."
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
        title="Descartar gasto en curso"
        description="Has empezado a completar este gasto. Si cierras ahora, perderas los cambios no guardados."
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
