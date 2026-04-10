import { useEffect, useMemo, useState } from 'react'
import { formatCurrency, formatDateEs, getDisplayStatusLabel, getPaymentMethodLabel } from '../app/displayFormat'
import type { AppView } from '../app/navigation'
import { createExpenseReceiptSignedUrl } from '../features/expenses/expenseAttachmentsApi'
import {
  getExpenseDocumentSupportStatusLabel,
  getExpenseFiscalRiskLevelLabel,
  getExpenseFiscalReviewStatusLabel,
  type ExpenseListItem,
} from '../features/expenses/types'
import { openInvoicePrintWindow } from '../features/invoices/openInvoicePrintWindow'
import type { InvoiceListItem } from '../features/invoices/types'
import type { PaymentListItem } from '../features/payments/types'
import type { AnnualClosingIncidence, AnnualClosingRecord, AnnualClosingSummary } from '../features/annualClosing/types'

type AnnualClosingWorkspace = 'operations' | 'manager_pack' | 'dossier' | 'export_folder' | 'internal_study'

interface AnnualClosingPageProps {
  availableYears: number[]
  defaultFiscalYear: number
  summaryByYear: Map<number, AnnualClosingSummary>
  closings: AnnualClosingRecord[]
  invoices: InvoiceListItem[]
  payments: PaymentListItem[]
  expenses: ExpenseListItem[]
  error: string | null
  onNavigateToIncidence: (view: AppView, scope: AnnualClosingIncidence['scope'], fiscalYear: number) => void
  onOpenQuarter: (fiscalYear: number, fiscalQuarter: number) => void
  onSaveClosing: (input: { fiscalYear: number; notes: string | null }) => Promise<void>
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Sin guardar'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin guardar'
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function getUiStatus(summary: AnnualClosingSummary, closing: AnnualClosingRecord | null) {
  if (!closing) {
    return {
      label: 'No preparado',
      tone: 'neutral' as const,
      detail: 'No existe snapshot persistido para este ejercicio.',
    }
  }

  if (summary.readiness === 'issues' || closing.status === 'issues') {
    return {
      label: 'Guardado con incidencias',
      tone: 'warning' as const,
      detail: 'Existe snapshot anual guardado, pero todavía hay puntos abiertos en el ejercicio.',
    }
  }

  return {
    label: 'Preparado y guardado',
    tone: 'success' as const,
    detail: 'El ejercicio tiene snapshot persistido sin incidencias abiertas detectadas.',
  }
}

function getIncidenceToneClass(tone: AnnualClosingIncidence['tone']): string {
  if (tone === 'danger') return 'cc-quarterly-checklist__item--danger'
  if (tone === 'warning') return 'cc-quarterly-checklist__item--warning'
  return ''
}

function getMonthKey(dateValue: string): string | null {
  if (!dateValue) return null
  const normalized = dateValue.length > 10 ? dateValue : `${dateValue}T00:00:00`
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return null
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function getMonthLabelFromKey(key: string): string {
  const [yearPart, monthPart] = key.split('-')
  const date = new Date(Number(yearPart), Number(monthPart) - 1, 1)
  return new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(date)
}

function matchesDateYear(dateValue: string, fiscalYear: number): boolean {
  if (!dateValue) return false
  const normalized = dateValue.length > 10 ? dateValue : `${dateValue}T00:00:00`
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return false
  return date.getFullYear() === fiscalYear
}

function matchesExpenseYear(expense: ExpenseListItem, fiscalYear: number): boolean {
  if (expense.fiscal_year) {
    return expense.fiscal_year === fiscalYear
  }

  return matchesDateYear(expense.expense_date, fiscalYear)
}

export function AnnualClosingPage({
  availableYears,
  defaultFiscalYear,
  summaryByYear,
  closings,
  invoices,
  payments,
  expenses,
  error,
  onNavigateToIncidence,
  onOpenQuarter,
  onSaveClosing,
}: AnnualClosingPageProps) {
  const [selectedYear, setSelectedYear] = useState(defaultFiscalYear)
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [workspace, setWorkspace] = useState<AnnualClosingWorkspace>('operations')
  const [documentActionError, setDocumentActionError] = useState<string | null>(null)
  const [openingExpenseId, setOpeningExpenseId] = useState<string | null>(null)

  useEffect(() => {
    setSelectedYear(defaultFiscalYear)
  }, [defaultFiscalYear])

  const summary = summaryByYear.get(selectedYear)
  const closing = useMemo(
    () => closings.find((item) => item.fiscal_year === selectedYear) ?? null,
    [closings, selectedYear],
  )
  const yearInvoices = useMemo(
    () => invoices.filter((invoice) => matchesDateYear(invoice.issue_date, selectedYear)),
    [invoices, selectedYear],
  )
  const yearPayments = useMemo(
    () => payments.filter((payment) => matchesDateYear(payment.payment_date, selectedYear)),
    [payments, selectedYear],
  )
  const yearExpenses = useMemo(
    () => expenses.filter((expense) => matchesExpenseYear(expense, selectedYear)),
    [expenses, selectedYear],
  )

  useEffect(() => {
    setNotes(closing?.notes ?? '')
    setSaveMessage(null)
    setSaveError(null)
    setDocumentActionError(null)

    if (!closing && workspace !== 'operations' && workspace !== 'internal_study') {
      setWorkspace('operations')
    }
  }, [closing, selectedYear, workspace])

  const yearPaymentsTotal = useMemo(
    () => yearPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [yearPayments],
  )
  const yearExpenseDocumentsPresentCount = useMemo(
    () => yearExpenses.filter((expense) => Boolean(expense.receipt_file_path)).length,
    [yearExpenses],
  )
  const yearExpenseMissingDocuments = useMemo(
    () =>
      yearExpenses.filter(
        (expense) =>
          expense.affects_annual_closure &&
          (expense.document_support_status === 'missing' ||
            (!expense.receipt_file_path && expense.document_support_status !== 'invoice_valid')),
      ),
    [yearExpenses],
  )
  const paymentsByInvoiceId = useMemo(() => {
    const map = new Map<string, number>()

    for (const payment of payments) {
      map.set(payment.invoice_id, (map.get(payment.invoice_id) ?? 0) + Number(payment.amount || 0))
    }

    return map
  }, [payments])
  const topYearClientsByInvoiced = useMemo(() => {
    const totals = new Map<string, { label: string; amount: number; invoiceCount: number }>()

    for (const invoice of yearInvoices) {
      const label = invoice.client_name ?? invoice.client_display_code ?? invoice.client_id
      const current = totals.get(invoice.client_id) ?? { label, amount: 0, invoiceCount: 0 }
      current.amount += Number(invoice.total || 0)
      current.invoiceCount += 1
      totals.set(invoice.client_id, current)
    }

    return [...totals.values()].sort((left, right) => right.amount - left.amount).slice(0, 8)
  }, [yearInvoices])
  const topYearClientsByCollected = useMemo(() => {
    const totals = new Map<string, { label: string; amount: number; paymentCount: number }>()
    const invoicesById = new Map(yearInvoices.map((invoice) => [invoice.id, invoice] as const))

    for (const payment of yearPayments) {
      const invoice = invoicesById.get(payment.invoice_id)
      const clientId = invoice?.client_id ?? payment.invoice_id
      const label = invoice?.client_name ?? invoice?.client_display_code ?? clientId
      const current = totals.get(clientId) ?? { label, amount: 0, paymentCount: 0 }
      current.amount += Number(payment.amount || 0)
      current.paymentCount += 1
      totals.set(clientId, current)
    }

    return [...totals.values()].sort((left, right) => right.amount - left.amount).slice(0, 8)
  }, [yearInvoices, yearPayments])
  const yearOutstandingClients = useMemo(() => {
    const totals = new Map<string, { label: string; amount: number; invoiceCount: number }>()

    for (const invoice of yearInvoices) {
      const outstandingAmount = Math.max(Number(invoice.total || 0) - (paymentsByInvoiceId.get(invoice.id) ?? 0), 0)
      if (outstandingAmount <= 0) continue
      const label = invoice.client_name ?? invoice.client_display_code ?? invoice.client_id
      const current = totals.get(invoice.client_id) ?? { label, amount: 0, invoiceCount: 0 }
      current.amount += outstandingAmount
      current.invoiceCount += 1
      totals.set(invoice.client_id, current)
    }

    return [...totals.values()].sort((left, right) => right.amount - left.amount).slice(0, 8)
  }, [paymentsByInvoiceId, yearInvoices])
  const yearExpenseBreakdown = useMemo(() => {
    const totals = new Map<string, { category: string; amount: number; count: number }>()

    for (const expense of yearExpenses) {
      const category = expense.category || 'otros'
      const current = totals.get(category) ?? { category, amount: 0, count: 0 }
      current.amount += Number(expense.total || 0)
      current.count += 1
      totals.set(category, current)
    }

    return [...totals.values()].sort((left, right) => right.amount - left.amount)
  }, [yearExpenses])
  const yearMonthComparison = useMemo(() => {
    const monthKeys = Array.from({ length: 12 }, (_, index) => `${selectedYear}-${String(index + 1).padStart(2, '0')}`)
    const invoicesTotals = new Map<string, number>()
    const paymentsTotals = new Map<string, number>()
    const expensesTotals = new Map<string, number>()

    for (const invoice of yearInvoices) {
      const key = getMonthKey(invoice.issue_date)
      if (key) invoicesTotals.set(key, (invoicesTotals.get(key) ?? 0) + Number(invoice.total || 0))
    }

    for (const payment of yearPayments) {
      const key = getMonthKey(payment.payment_date)
      if (key) paymentsTotals.set(key, (paymentsTotals.get(key) ?? 0) + Number(payment.amount || 0))
    }

    for (const expense of yearExpenses) {
      const key = getMonthKey(expense.expense_date)
      if (key) expensesTotals.set(key, (expensesTotals.get(key) ?? 0) + Number(expense.total || 0))
    }

    return monthKeys.map((key) => {
      const invoiced = invoicesTotals.get(key) ?? 0
      const collected = paymentsTotals.get(key) ?? 0
      const spent = expensesTotals.get(key) ?? 0
      return {
        key,
        label: getMonthLabelFromKey(key),
        invoiced,
        collected,
        spent,
        margin: invoiced - spent,
      }
    })
  }, [selectedYear, yearExpenses, yearInvoices, yearPayments])

  if (!summary) {
    return (
      <section className="page-section cc-master-page">
        <div className="section-header page-header-actions cc-master-page__hero">
          <div>
            <h1>Cierre anual</h1>
            <p>Vista anual consolidada construida sobre los cierres trimestrales existentes.</p>
          </div>
        </div>

        <div className="cc-alert cc-alert--warning">
          <strong>No hay datos suficientes</strong>
          <p>No se pudo construir el resumen del ejercicio seleccionado.</p>
        </div>
      </section>
    )
  }

  const uiStatus = getUiStatus(summary, closing)
  const savedSnapshot = closing?.snapshot_json?.metrics ?? null

  async function handleSave() {
    setIsSaving(true)
    setSaveMessage(null)
    setSaveError(null)

    try {
      await onSaveClosing({
        fiscalYear: selectedYear,
        notes: notes.trim() || null,
      })
      setSaveMessage(`Snapshot anual guardado para ${selectedYear}.`)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudo guardar el cierre anual.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleOpenExpenseDocument(expense: ExpenseListItem) {
    if (!expense.receipt_file_path) return

    setDocumentActionError(null)
    setOpeningExpenseId(expense.id)

    try {
      const signedUrl = await createExpenseReceiptSignedUrl(expense.receipt_file_path)
      window.open(signedUrl, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setDocumentActionError(err instanceof Error ? err.message : 'No se pudo abrir el documento del gasto.')
    } finally {
      setOpeningExpenseId(null)
    }
  }

  return (
    <section className="page-section cc-master-page cc-annual-closing-page">
      <div className="section-header page-header-actions cc-master-page__hero">
        <div>
          <h1>Cierre anual</h1>
          <p>Panel operativo, pack gestor y dossier documental alineados con el cierre anual guardado.</p>
        </div>
      </div>

      <section className="cc-dashboard-block cc-quarterly-closing-shell" aria-label="Configuración de cierre anual">
        <div className="cc-dashboard-block__header">
          <div>
            <h2>Ejercicio de cierre</h2>
            <p>Selecciona el año fiscal para revisar el estado anual consolidado y abrir su pack documental.</p>
          </div>

          <div className={`cc-quarterly-status-pill cc-quarterly-status-pill--${uiStatus.tone}`}>
            <span>{uiStatus.label}</span>
          </div>
        </div>

        <div className="filters-grid cc-quarterly-closing-filters cc-annual-closing-filters">
          <label className="form-field">
            <span>Ejercicio fiscal</span>
            <select value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))}>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="cc-quarterly-status-detail">{uiStatus.detail}</p>

        <div className="cc-quarterly-workspace-switcher">
          <button
            type="button"
            className={workspace === 'operations' ? 'secondary-button is-active' : 'secondary-button'}
            onClick={() => setWorkspace('operations')}
          >
            Resumen operativo
          </button>
          <button
            type="button"
            className={workspace === 'manager_pack' ? 'secondary-button is-active' : 'secondary-button'}
            onClick={() => setWorkspace('manager_pack')}
            disabled={!closing}
          >
            Abrir pack gestor
          </button>
          <button
            type="button"
            className={workspace === 'dossier' ? 'secondary-button is-active' : 'secondary-button'}
            onClick={() => setWorkspace('dossier')}
            disabled={!closing}
          >
            Abrir dossier documental
          </button>
          <button
            type="button"
            className={workspace === 'export_folder' ? 'secondary-button is-active' : 'secondary-button'}
            onClick={() => setWorkspace('export_folder')}
            disabled={!closing}
          >
            Carpeta gestor
          </button>
          <button
            type="button"
            className={workspace === 'internal_study' ? 'secondary-button is-active' : 'secondary-button'}
            onClick={() => setWorkspace('internal_study')}
          >
            Estudio interno
          </button>
        </div>

        {!closing ? (
          <div className="cc-alert cc-alert--warning">
            <strong>Pack y dossier pendientes</strong>
            <p>Guarda primero el cierre anual para habilitar la vista gestor y el dossier documental del ejercicio.</p>
          </div>
        ) : null}

        {error ? (
          <div className="cc-alert cc-alert--warning">
            <strong>Persistencia no disponible</strong>
            <p>{error}</p>
          </div>
        ) : null}

        {saveError ? (
          <div className="cc-alert cc-alert--error">
            <strong>Error guardando el cierre anual</strong>
            <p>{saveError}</p>
          </div>
        ) : null}

        {saveMessage ? (
          <div className="cc-alert cc-alert--success">
            <strong>Snapshot anual actualizado</strong>
            <p>{saveMessage}</p>
          </div>
        ) : null}

        {documentActionError ? (
          <div className="cc-alert cc-alert--error">
            <strong>No se pudo abrir el documento</strong>
            <p>{documentActionError}</p>
          </div>
        ) : null}
      </section>

      {workspace === 'operations' ? (
        <>
      <section className="cc-kpi-grid cc-quarterly-metrics" aria-label="Resumen anual">
        <article className="cc-kpi-card cc-kpi-card--finance">
          <span className="cc-kpi-label">Facturado del año</span>
          <strong className="cc-kpi-value">{formatCurrency(summary.invoicedTotal)}</strong>
          <p className="cc-kpi-footnote">{summary.invoiceCount} factura(s) emitidas en {selectedYear}</p>
        </article>

        <article className="cc-kpi-card cc-kpi-card--success">
          <span className="cc-kpi-label">Cobrado del año</span>
          <strong className="cc-kpi-value">{formatCurrency(summary.collectedTotal)}</strong>
          <p className="cc-kpi-footnote">{summary.paymentCount} cobro(s) registrados en el ejercicio</p>
        </article>

        <article className="cc-kpi-card cc-kpi-card--warning">
          <span className="cc-kpi-label">Pendiente de cobro</span>
          <strong className="cc-kpi-value">{formatCurrency(summary.outstandingTotal)}</strong>
          <p className="cc-kpi-footnote">{summary.pendingInvoiceCount} factura(s) del año siguen abiertas</p>
        </article>

        <article className="cc-kpi-card">
          <span className="cc-kpi-label">Gastos del año</span>
          <strong className="cc-kpi-value">{formatCurrency(summary.expensesTotal)}</strong>
          <p className="cc-kpi-footnote">{summary.expenseCount} gasto(s) registrados en el ejercicio</p>
        </article>

        <article className="cc-kpi-card">
          <span className="cc-kpi-label">Gastos sin justificante</span>
          <strong className="cc-kpi-value">{summary.missingSupportCount}</strong>
          <p className="cc-kpi-footnote">Solo se cuentan los que afectan al cierre anual</p>
        </article>

        <article className="cc-kpi-card">
          <span className="cc-kpi-label">Pendientes de revisión</span>
          <strong className="cc-kpi-value">{summary.pendingReviewCount}</strong>
          <p className="cc-kpi-footnote">Registros con revisión fiscal aún abierta</p>
        </article>

        <article className="cc-kpi-card">
          <span className="cc-kpi-label">Riesgo medio/alto</span>
          <strong className="cc-kpi-value">{summary.riskCount}</strong>
          <p className="cc-kpi-footnote">Incidencias fiscales del ejercicio</p>
        </article>

        <article className="cc-kpi-card">
          <span className="cc-kpi-label">Incidencias abiertas</span>
          <strong className="cc-kpi-value">{summary.unresolvedIncidenceCount}</strong>
          <p className="cc-kpi-footnote">Suma anual de cobro pendiente e incidencias fiscales</p>
        </article>
      </section>

      <section className="cc-dashboard-block">
        <div className="cc-dashboard-block__header">
          <div>
            <h2>Desglose trimestral</h2>
            <p>Consolidado del ejercicio apoyado en la base de cierres trimestrales ya implementada.</p>
          </div>
        </div>

        <div className="cc-annual-breakdown-grid">
          {summary.quarterlyBreakdown.map((quarter) => (
            <button
              key={quarter.fiscal_quarter}
              type="button"
              className="cc-quarterly-persistence__card cc-annual-breakdown-card"
              onClick={() => onOpenQuarter(selectedYear, quarter.fiscal_quarter)}
            >
              <span className="cc-dashboard-panel__label">T{quarter.fiscal_quarter}</span>
              <strong className="cc-dashboard-panel__value">{formatCurrency(quarter.invoiced_total)}</strong>
              <p className="cc-dashboard-panel__text">Cobrado: {formatCurrency(quarter.collected_total)}</p>
              <p className="cc-dashboard-panel__text">Gastos: {formatCurrency(quarter.expenses_total)}</p>
              <p className="cc-dashboard-panel__text">Incidencias: {quarter.unresolved_incidence_count}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="cc-dashboard-block">
        <div className="cc-dashboard-block__header">
          <div>
            <h2>Checklist anual</h2>
            <p>Cada bloque abre el módulo correspondiente con el filtro ya aplicado al ejercicio seleccionado.</p>
          </div>
        </div>

        <div className="cc-quarterly-checklist">
          {summary.incidences.map((incidence) => (
            <button
              key={incidence.id}
              type="button"
              className={`cc-quarterly-checklist__item ${getIncidenceToneClass(incidence.tone)}`.trim()}
              onClick={() => onNavigateToIncidence(incidence.view, incidence.scope, selectedYear)}
            >
              <div className="cc-quarterly-checklist__copy">
                <strong>{incidence.label}</strong>
                <p>{incidence.detail}</p>
              </div>
              <div className="cc-quarterly-checklist__meta">
                <span>{incidence.count}</span>
                <small>Ir al módulo</small>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="cc-dashboard-block">
        <div className="cc-dashboard-block__header">
          <div>
            <h2>Snapshot anual persistido</h2>
            <p>Guarda una foto del cierre anual actual con totales, conteos y desglose trimestral.</p>
          </div>
        </div>

        <div className="cc-quarterly-persistence">
          <article className="cc-quarterly-persistence__card">
            <span className="cc-dashboard-panel__label">Estado guardado</span>
            <strong className="cc-dashboard-panel__value">{uiStatus.label}</strong>
            <p className="cc-dashboard-panel__text">Última actualización: {formatDateTime(closing?.closed_at)}</p>
            <p className="cc-dashboard-panel__text">Ejercicio: {selectedYear}</p>
          </article>

          <article className="cc-quarterly-persistence__card">
            <label className="form-field">
              <span>Notas de cierre anual</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Observaciones breves del cierre anual, incidencias o contexto operativo."
              />
            </label>

            <button
              type="button"
              className="primary-button"
              onClick={handleSave}
              disabled={isSaving || Boolean(error)}
            >
              {isSaving ? 'Guardando snapshot...' : 'Guardar cierre anual'}
            </button>
          </article>

          <article className="cc-quarterly-persistence__card">
            <span className="cc-dashboard-panel__label">Último snapshot</span>
            <strong className="cc-dashboard-panel__value">
              {savedSnapshot ? formatCurrency(savedSnapshot.invoiced_total) : 'Sin snapshot'}
            </strong>
            <p className="cc-dashboard-panel__text">
              {savedSnapshot
                ? `${savedSnapshot.invoice_count} factura(s), ${savedSnapshot.payment_count} cobro(s), ${savedSnapshot.expense_count} gasto(s).`
                : 'Todavía no se ha guardado un resumen persistido para este ejercicio.'}
            </p>
            {savedSnapshot ? (
              <p className="cc-dashboard-panel__text">
                Trimestres incluidos: {savedSnapshot.quarterly_breakdown.length} · Incidencias: {savedSnapshot.unresolved_incidence_count}
              </p>
            ) : null}
          </article>
        </div>
      </section>
        </>
      ) : null}

      {workspace === 'manager_pack' && closing ? (
        <>
          <section className="cc-dashboard-block cc-quarterly-pack-hero">
            <div className="cc-dashboard-block__header">
              <div>
                <h2>Pack gestor anual</h2>
                <p>Resumen ejecutivo y documental del ejercicio guardado para revisión de gestoría o dirección.</p>
              </div>
            </div>

            <div className="cc-quarterly-pack-header">
              <article className="cc-quarterly-persistence__card">
                <span className="cc-dashboard-panel__label">Ejercicio fiscal</span>
                <strong className="cc-dashboard-panel__value">{selectedYear}</strong>
                <p className="cc-dashboard-panel__text">Estado: {uiStatus.label}</p>
              </article>
              <article className="cc-quarterly-persistence__card">
                <span className="cc-dashboard-panel__label">Snapshot guardado</span>
                <strong className="cc-dashboard-panel__value">{formatDateTime(closing.closed_at)}</strong>
                <p className="cc-dashboard-panel__text">Registro persistido vinculado al cierre anual.</p>
              </article>
              <article className="cc-quarterly-persistence__card">
                <span className="cc-dashboard-panel__label">Notas de cierre</span>
                <strong className="cc-dashboard-panel__value">{closing.notes?.trim() ? 'Con notas' : 'Sin notas'}</strong>
                <p className="cc-dashboard-panel__text">{closing.notes?.trim() || 'No hay observaciones adicionales en el snapshot guardado.'}</p>
              </article>
            </div>
          </section>

          <section className="cc-kpi-grid cc-quarterly-metrics">
            <article className="cc-kpi-card cc-kpi-card--finance">
              <span className="cc-kpi-label">Facturado snapshot</span>
              <strong className="cc-kpi-value">{formatCurrency(savedSnapshot?.invoiced_total ?? 0)}</strong>
              <p className="cc-kpi-footnote">{savedSnapshot?.invoice_count ?? 0} facturas registradas al guardar</p>
            </article>
            <article className="cc-kpi-card cc-kpi-card--success">
              <span className="cc-kpi-label">Cobrado snapshot</span>
              <strong className="cc-kpi-value">{formatCurrency(savedSnapshot?.collected_total ?? 0)}</strong>
              <p className="cc-kpi-footnote">{savedSnapshot?.payment_count ?? 0} cobros registrados al guardar</p>
            </article>
            <article className="cc-kpi-card cc-kpi-card--warning">
              <span className="cc-kpi-label">Pendiente snapshot</span>
              <strong className="cc-kpi-value">{formatCurrency(savedSnapshot?.outstanding_total ?? 0)}</strong>
              <p className="cc-kpi-footnote">{savedSnapshot?.pending_invoice_count ?? 0} facturas con saldo pendiente</p>
            </article>
            <article className="cc-kpi-card">
              <span className="cc-kpi-label">Gastos snapshot</span>
              <strong className="cc-kpi-value">{formatCurrency(savedSnapshot?.expenses_total ?? 0)}</strong>
              <p className="cc-kpi-footnote">{savedSnapshot?.expense_count ?? 0} gastos considerados en el cierre</p>
            </article>
          </section>

          <section className="cc-quarterly-pack-grid">
            <article className="cc-quarterly-persistence__card">
              <span className="cc-dashboard-panel__label">Resumen de facturas</span>
              <strong className="cc-dashboard-panel__value">{yearInvoices.length}</strong>
              <p className="cc-dashboard-panel__text">Total emitido del ejercicio: {formatCurrency(summary.invoicedTotal)}</p>
              <p className="cc-dashboard-panel__text">Pendientes hoy: {summary.pendingInvoiceCount} · {formatCurrency(summary.outstandingTotal)}</p>
            </article>
            <article className="cc-quarterly-persistence__card">
              <span className="cc-dashboard-panel__label">Resumen de cobros</span>
              <strong className="cc-dashboard-panel__value">{yearPayments.length}</strong>
              <p className="cc-dashboard-panel__text">Importe cobrado del ejercicio: {formatCurrency(yearPaymentsTotal)}</p>
              <p className="cc-dashboard-panel__text">Cobros registrados con fecha dentro del ejercicio.</p>
            </article>
            <article className="cc-quarterly-persistence__card">
              <span className="cc-dashboard-panel__label">Resumen de gastos</span>
              <strong className="cc-dashboard-panel__value">{yearExpenses.length}</strong>
              <p className="cc-dashboard-panel__text">Total de gastos: {formatCurrency(summary.expensesTotal)}</p>
              <p className="cc-dashboard-panel__text">Documentos presentes: {yearExpenseDocumentsPresentCount} · sin soporte: {summary.missingSupportCount}</p>
            </article>
          </section>

          <section className="cc-dashboard-block">
            <div className="cc-dashboard-block__header">
              <div>
                <h2>Desglose trimestral del ejercicio</h2>
                <p>Acceso rápido a cada trimestre consolidado desde el pack anual.</p>
              </div>
            </div>

            <div className="cc-annual-breakdown-grid">
              {summary.quarterlyBreakdown.map((quarter) => (
                <button
                  key={quarter.fiscal_quarter}
                  type="button"
                  className="cc-quarterly-persistence__card cc-annual-breakdown-card"
                  onClick={() => onOpenQuarter(selectedYear, quarter.fiscal_quarter)}
                >
                  <span className="cc-dashboard-panel__label">T{quarter.fiscal_quarter}</span>
                  <strong className="cc-dashboard-panel__value">{formatCurrency(quarter.invoiced_total)}</strong>
                  <p className="cc-dashboard-panel__text">Cobrado: {formatCurrency(quarter.collected_total)}</p>
                  <p className="cc-dashboard-panel__text">Pendiente: {formatCurrency(quarter.outstanding_total)}</p>
                  <p className="cc-dashboard-panel__text">Incidencias: {quarter.unresolved_incidence_count}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="cc-dashboard-block">
            <div className="cc-dashboard-block__header">
              <div>
                <h2>Incidencias abiertas y riesgos</h2>
                <p>Lectura resumida del estado actual del ejercicio para revisión de gestión.</p>
              </div>
            </div>

            <div className="cc-quarterly-checklist">
              {summary.incidences
                .filter((incidence) => incidence.count > 0 || incidence.id === 'invoice_year_all' || incidence.id === 'payment_year_all')
                .map((incidence) => (
                  <button
                    key={incidence.id}
                    type="button"
                    className={`cc-quarterly-checklist__item ${getIncidenceToneClass(incidence.tone)}`.trim()}
                    onClick={() => onNavigateToIncidence(incidence.view, incidence.scope, selectedYear)}
                  >
                    <div className="cc-quarterly-checklist__copy">
                      <strong>{incidence.label}</strong>
                      <p>{incidence.detail}</p>
                    </div>
                    <div className="cc-quarterly-checklist__meta">
                      <span>{incidence.count}</span>
                      <small>Revisar detalle</small>
                    </div>
                  </button>
                ))}
            </div>
          </section>
        </>
      ) : null}

      {workspace === 'dossier' && closing ? (
        <>
          <section className="cc-dashboard-block">
            <div className="cc-dashboard-block__header">
              <div>
                <h2>Dossier documental anual</h2>
                <p>Ordena documentos y evidencias del ejercicio guardado para revisión operativa y futura exportación.</p>
              </div>
            </div>

            <div className="cc-quarterly-persistence">
              <article className="cc-quarterly-persistence__card">
                <span className="cc-dashboard-panel__label">Dossier vinculado</span>
                <strong className="cc-dashboard-panel__value">{selectedYear}</strong>
                <p className="cc-dashboard-panel__text">Basado en el cierre guardado del {formatDateTime(closing.closed_at)}.</p>
              </article>
              <article className="cc-quarterly-persistence__card">
                <span className="cc-dashboard-panel__label">Completitud documental</span>
                <strong className="cc-dashboard-panel__value">{yearExpenseDocumentsPresentCount}/{yearExpenses.length}</strong>
                <p className="cc-dashboard-panel__text">Gastos con soporte documental accesible en la app.</p>
              </article>
              <article className="cc-quarterly-persistence__card">
                <span className="cc-dashboard-panel__label">Incidencias documentales</span>
                <strong className="cc-dashboard-panel__value">{yearExpenseMissingDocuments.length}</strong>
                <p className="cc-dashboard-panel__text">Gastos del año con soporte ausente o insuficiente.</p>
              </article>
            </div>
          </section>

          <section className="cc-dashboard-block">
            <div className="cc-dashboard-block__header">
              <div>
                <h2>Facturas emitidas</h2>
                <p>Listado anual con acceso directo al flujo documental ya existente de factura.</p>
              </div>
            </div>

            <div className="cc-quarterly-dossier-table">
              <div className="cc-quarterly-dossier-table__head">
                <span>Factura</span>
                <span>Fecha</span>
                <span>Cliente</span>
                <span>Total</span>
                <span>Estado</span>
                <span>Acciones</span>
              </div>

              {yearInvoices.length === 0 ? (
                <div className="empty-state">
                  <strong>Sin facturas en el ejercicio</strong>
                  <p>No hay facturas emitidas en este año.</p>
                </div>
              ) : (
                yearInvoices.map((invoice) => (
                  <div key={invoice.id} className="cc-quarterly-dossier-table__row">
                    <span>{invoice.invoice_number ?? invoice.display_code ?? invoice.id}</span>
                    <span>{formatDateEs(invoice.issue_date)}</span>
                    <span>{invoice.client_name ?? invoice.client_display_code ?? invoice.client_id}</span>
                    <span>{formatCurrency(invoice.total)}</span>
                    <span>{getDisplayStatusLabel(invoice.status)}</span>
                    <div className="cc-quarterly-dossier-table__actions">
                      <button type="button" className="secondary-button" onClick={() => openInvoicePrintWindow(invoice, 'pdf')}>
                        PDF
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => onNavigateToIncidence('invoices', 'invoice_year_all', selectedYear)}
                      >
                        Abrir módulo
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="cc-dashboard-block">
            <div className="cc-dashboard-block__header">
              <div>
                <h2>Cobros del ejercicio</h2>
                <p>Resumen documental anual de cobros para contraste rápido con la facturación.</p>
              </div>
            </div>

            <div className="cc-quarterly-dossier-table">
              <div className="cc-quarterly-dossier-table__head">
                <span>Cobro</span>
                <span>Fecha</span>
                <span>Factura</span>
                <span>Importe</span>
                <span>Método</span>
                <span>Observación</span>
              </div>

              {yearPayments.length === 0 ? (
                <div className="empty-state">
                  <strong>Sin cobros en el ejercicio</strong>
                  <p>No hay movimientos de cobro registrados para este año.</p>
                </div>
              ) : (
                yearPayments.map((payment) => (
                  <div key={payment.id} className="cc-quarterly-dossier-table__row">
                    <span>{payment.display_code ?? payment.id}</span>
                    <span>{formatDateEs(payment.payment_date)}</span>
                    <span>{payment.invoice_number ?? payment.invoice_display_code ?? payment.invoice_id}</span>
                    <span>{formatCurrency(payment.amount)}</span>
                    <span>{getPaymentMethodLabel(payment.payment_method)}</span>
                    <span>{payment.notes?.trim() || 'Sin notas'}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="cc-dashboard-block">
            <div className="cc-dashboard-block__header">
              <div>
                <h2>Gastos y soporte documental</h2>
                <p>Estado anual de adjuntos, soporte fiscal y acceso al documento del gasto cuando existe.</p>
              </div>
            </div>

            <div className="cc-quarterly-dossier-table">
              <div className="cc-quarterly-dossier-table__head">
                <span>Gasto</span>
                <span>Proveedor</span>
                <span>Total</span>
                <span>Soporte</span>
                <span>Revisión</span>
                <span>Acciones</span>
              </div>

              {yearExpenses.length === 0 ? (
                <div className="empty-state">
                  <strong>Sin gastos en el ejercicio</strong>
                  <p>No hay gastos registrados para este año.</p>
                </div>
              ) : (
                yearExpenses.map((expense) => (
                  <div key={expense.id} className="cc-quarterly-dossier-table__row">
                    <span>{expense.display_code ?? expense.id}</span>
                    <span>{expense.supplier_name}</span>
                    <span>{formatCurrency(expense.total)}</span>
                    <span>
                      {getExpenseDocumentSupportStatusLabel(expense.document_support_status)}
                      {expense.receipt_file_path ? ' · adjunto disponible' : ' · sin adjunto'}
                    </span>
                    <span>
                      {getExpenseFiscalReviewStatusLabel(expense.fiscal_review_status)}
                      {' · '}
                      riesgo {getExpenseFiscalRiskLevelLabel(expense.fiscal_risk_level).toLowerCase()}
                    </span>
                    <div className="cc-quarterly-dossier-table__actions">
                      {expense.receipt_file_path ? (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => handleOpenExpenseDocument(expense)}
                          disabled={openingExpenseId === expense.id}
                        >
                          {openingExpenseId === expense.id ? 'Abriendo...' : 'Ver soporte'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => onNavigateToIncidence('expenses', 'expense_year_missing_support', selectedYear)}
                        >
                          Revisar incidencia
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="cc-dashboard-block">
            <div className="cc-dashboard-block__header">
              <div>
                <h2>Incidencias y documentación pendiente</h2>
                <p>Bloque final para detectar huecos documentales antes de una futura exportación/ZIP.</p>
              </div>
            </div>

            <div className="cc-quarterly-checklist">
              {summary.incidences
                .filter((incidence) =>
                  incidence.id === 'expense_year_missing_support' ||
                  incidence.id === 'expense_year_pending_review' ||
                  incidence.id === 'expense_year_risk' ||
                  incidence.id === 'invoice_year_pending',
                )
                .map((incidence) => (
                  <button
                    key={incidence.id}
                    type="button"
                    className={`cc-quarterly-checklist__item ${getIncidenceToneClass(incidence.tone)}`.trim()}
                    onClick={() => onNavigateToIncidence(incidence.view, incidence.scope, selectedYear)}
                  >
                    <div className="cc-quarterly-checklist__copy">
                      <strong>{incidence.label}</strong>
                      <p>{incidence.detail}</p>
                    </div>
                    <div className="cc-quarterly-checklist__meta">
                      <span>{incidence.count}</span>
                      <small>Resolver</small>
                    </div>
                  </button>
                ))}
            </div>
          </section>
        </>
      ) : null}

      {workspace === 'export_folder' && closing ? (
        <>
          <section className="cc-dashboard-block">
            <div className="cc-dashboard-block__header">
              <div>
                <h2>Carpeta gestor anual</h2>
                <p>Estructura anual preparada para envío a gestoría y diseñada como base segura para una futura exportación ZIP.</p>
              </div>
            </div>

            <div className="cc-export-folder-grid">
              <article className="cc-quarterly-persistence__card">
                <span className="cc-dashboard-panel__label">01 · Resumen anual</span>
                <strong className="cc-dashboard-panel__value">{selectedYear}</strong>
                <p className="cc-dashboard-panel__text">Snapshot guardado: {formatDateTime(closing.closed_at)}</p>
                <p className="cc-dashboard-panel__text">Notas: {closing.notes?.trim() || 'Sin notas de cierre.'}</p>
              </article>
              <article className="cc-quarterly-persistence__card">
                <span className="cc-dashboard-panel__label">02 · Facturas</span>
                <strong className="cc-dashboard-panel__value">{yearInvoices.length}</strong>
                <p className="cc-dashboard-panel__text">Facturado anual: {formatCurrency(summary.invoicedTotal)}</p>
                <p className="cc-dashboard-panel__text">Acceso al flujo PDF/documental ya existente.</p>
              </article>
              <article className="cc-quarterly-persistence__card">
                <span className="cc-dashboard-panel__label">03 · Cobros</span>
                <strong className="cc-dashboard-panel__value">{yearPayments.length}</strong>
                <p className="cc-dashboard-panel__text">Cobrado anual: {formatCurrency(yearPaymentsTotal)}</p>
                <p className="cc-dashboard-panel__text">Listado listo para revisión y futura descarga.</p>
              </article>
              <article className="cc-quarterly-persistence__card">
                <span className="cc-dashboard-panel__label">04 · Gastos y soportes</span>
                <strong className="cc-dashboard-panel__value">{yearExpenseDocumentsPresentCount}/{yearExpenses.length}</strong>
                <p className="cc-dashboard-panel__text">Adjuntos accesibles: {yearExpenseDocumentsPresentCount}</p>
                <p className="cc-dashboard-panel__text">Sin soporte: {yearExpenseMissingDocuments.length}</p>
              </article>
              <article className="cc-quarterly-persistence__card">
                <span className="cc-dashboard-panel__label">05 · Incidencias</span>
                <strong className="cc-dashboard-panel__value">{summary.unresolvedIncidenceCount}</strong>
                <p className="cc-dashboard-panel__text">Pendiente de cobro e incidencias fiscales/documentales del año.</p>
              </article>
            </div>
          </section>

          <section className="cc-dashboard-block">
            <div className="cc-dashboard-block__header">
              <div>
                <h2>Estructura preparada para exportación</h2>
                <p>Patrón anual alineado con la carpeta trimestral y escalable a export binario posterior.</p>
              </div>
            </div>

            <div className="cc-export-folder-list">
              <article className="cc-export-folder-item">
                <strong>01_resumen_anual</strong>
                <p>{`resumen_${selectedYear}.json / pack gestor anual / snapshot persistido del cierre`}</p>
              </article>
              <article className="cc-export-folder-item">
                <strong>02_facturas_emitidas</strong>
                <p>{`${yearInvoices.length} factura(s) del ejercicio con acceso al PDF/documento actual`}</p>
              </article>
              <article className="cc-export-folder-item">
                <strong>03_cobros</strong>
                <p>{`${yearPayments.length} cobro(s) con factura vinculada, importe y método`}</p>
              </article>
              <article className="cc-export-folder-item">
                <strong>04_gastos_y_soportes</strong>
                <p>{`${yearExpenses.length} gasto(s) con soporte documental y estado de revisión`}</p>
              </article>
              <article className="cc-export-folder-item">
                <strong>05_incidencias_pendientes</strong>
                <p>{`${summary.unresolvedIncidenceCount} incidencia(s) abiertas antes del envío final`}</p>
              </article>
            </div>
          </section>

          <section className="cc-dashboard-block">
            <div className="cc-dashboard-block__header">
              <div>
                <h2>Facturas anuales para gestor</h2>
                <p>Listado orientado a exportación con naming claro y acceso al PDF de factura.</p>
              </div>
            </div>

            <div className="cc-quarterly-dossier-table">
              <div className="cc-quarterly-dossier-table__head">
                <span>Nombre carpeta</span>
                <span>Fecha</span>
                <span>Cliente</span>
                <span>Total</span>
                <span>Estado</span>
                <span>Acciones</span>
              </div>

              {yearInvoices.length === 0 ? (
                <div className="empty-state">
                  <strong>Sin facturas para exportar</strong>
                  <p>No hay facturas emitidas en este ejercicio.</p>
                </div>
              ) : (
                yearInvoices.map((invoice) => (
                  <div key={invoice.id} className="cc-quarterly-dossier-table__row">
                    <span>{`factura_${invoice.invoice_number ?? invoice.display_code ?? invoice.id}`}</span>
                    <span>{formatDateEs(invoice.issue_date)}</span>
                    <span>{invoice.client_name ?? invoice.client_display_code ?? invoice.client_id}</span>
                    <span>{formatCurrency(invoice.total)}</span>
                    <span>{getDisplayStatusLabel(invoice.status)}</span>
                    <div className="cc-quarterly-dossier-table__actions">
                      <button type="button" className="secondary-button" onClick={() => openInvoicePrintWindow(invoice, 'pdf')}>
                        PDF
                      </button>
                      <button type="button" className="secondary-button" onClick={() => onNavigateToIncidence('invoices', 'invoice_year_all', selectedYear)}>
                        Abrir módulo
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="cc-dashboard-block">
            <div className="cc-dashboard-block__header">
              <div>
                <h2>Cobros anuales para gestor</h2>
                <p>Base compacta de revisión para la carpeta anual de cierre.</p>
              </div>
            </div>

            <div className="cc-quarterly-dossier-table">
              <div className="cc-quarterly-dossier-table__head">
                <span>Nombre carpeta</span>
                <span>Fecha</span>
                <span>Factura</span>
                <span>Importe</span>
                <span>Método</span>
                <span>Observación</span>
              </div>

              {yearPayments.length === 0 ? (
                <div className="empty-state">
                  <strong>Sin cobros para exportar</strong>
                  <p>No hay cobros registrados en este ejercicio.</p>
                </div>
              ) : (
                yearPayments.map((payment) => (
                  <div key={payment.id} className="cc-quarterly-dossier-table__row">
                    <span>{`cobro_${payment.display_code ?? payment.id}`}</span>
                    <span>{formatDateEs(payment.payment_date)}</span>
                    <span>{payment.invoice_number ?? payment.invoice_display_code ?? payment.invoice_id}</span>
                    <span>{formatCurrency(payment.amount)}</span>
                    <span>{getPaymentMethodLabel(payment.payment_method)}</span>
                    <span>{payment.notes?.trim() || 'Sin notas'}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="cc-dashboard-block">
            <div className="cc-dashboard-block__header">
              <div>
                <h2>Gastos y soportes anuales para gestor</h2>
                <p>Tabla export-ready con naming, soporte documental y apertura de adjuntos reales.</p>
              </div>
            </div>

            <div className="cc-quarterly-dossier-table">
              <div className="cc-quarterly-dossier-table__head">
                <span>Nombre carpeta</span>
                <span>Proveedor</span>
                <span>Total</span>
                <span>Soporte</span>
                <span>Revisión</span>
                <span>Acciones</span>
              </div>

              {yearExpenses.length === 0 ? (
                <div className="empty-state">
                  <strong>Sin gastos para exportar</strong>
                  <p>No hay gastos registrados en este ejercicio.</p>
                </div>
              ) : (
                yearExpenses.map((expense) => (
                  <div key={expense.id} className="cc-quarterly-dossier-table__row">
                    <span>{`gasto_${expense.display_code ?? expense.id}`}</span>
                    <span>{expense.supplier_name}</span>
                    <span>{formatCurrency(expense.total)}</span>
                    <span>
                      {getExpenseDocumentSupportStatusLabel(expense.document_support_status)}
                      {expense.receipt_file_path ? ' · adjunto disponible' : ' · sin adjunto'}
                    </span>
                    <span>
                      {getExpenseFiscalReviewStatusLabel(expense.fiscal_review_status)}
                      {' · '}
                      riesgo {getExpenseFiscalRiskLevelLabel(expense.fiscal_risk_level).toLowerCase()}
                    </span>
                    <div className="cc-quarterly-dossier-table__actions">
                      {expense.receipt_file_path ? (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => handleOpenExpenseDocument(expense)}
                          disabled={openingExpenseId === expense.id}
                        >
                          {openingExpenseId === expense.id ? 'Abriendo...' : 'Ver soporte'}
                        </button>
                      ) : (
                        <button type="button" className="secondary-button" onClick={() => onNavigateToIncidence('expenses', 'expense_year_missing_support', selectedYear)}>
                          Revisar incidencia
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="cc-dashboard-block">
            <div className="cc-dashboard-block__header">
              <div>
                <h2>Incidencias y faltas de documentación</h2>
                <p>Bloque final para completar el ejercicio antes de una futura exportación binaria.</p>
              </div>
            </div>

            <div className="cc-quarterly-checklist">
              {summary.incidences
                .filter((incidence) => incidence.count > 0)
                .map((incidence) => (
                  <button
                    key={incidence.id}
                    type="button"
                    className={`cc-quarterly-checklist__item ${getIncidenceToneClass(incidence.tone)}`.trim()}
                    onClick={() => onNavigateToIncidence(incidence.view, incidence.scope, selectedYear)}
                  >
                    <div className="cc-quarterly-checklist__copy">
                      <strong>{incidence.label}</strong>
                      <p>{incidence.detail}</p>
                    </div>
                    <div className="cc-quarterly-checklist__meta">
                      <span>{incidence.count}</span>
                      <small>Resolver</small>
                    </div>
                  </button>
                ))}
            </div>
          </section>
        </>
      ) : null}

      {workspace === 'internal_study' ? (
        <>
          <section className="cc-kpi-grid cc-quarterly-metrics" aria-label="Estudio interno anual">
            <article className="cc-kpi-card cc-kpi-card--finance">
              <span className="cc-kpi-label">Visión global anual</span>
              <strong className="cc-kpi-value">{formatCurrency(summary.invoicedTotal)}</strong>
              <p className="cc-kpi-footnote">Cobrado: {formatCurrency(summary.collectedTotal)} · pendiente: {formatCurrency(summary.outstandingTotal)}</p>
            </article>
            <article className="cc-kpi-card">
              <span className="cc-kpi-label">Gastos del año</span>
              <strong className="cc-kpi-value">{formatCurrency(summary.expensesTotal)}</strong>
              <p className="cc-kpi-footnote">{summary.expenseCount} gasto(s) registrados</p>
            </article>
            <article className="cc-kpi-card">
              <span className="cc-kpi-label">Margen simple facturado</span>
              <strong className="cc-kpi-value">{formatCurrency(summary.invoicedTotal - summary.expensesTotal)}</strong>
              <p className="cc-kpi-footnote">Facturado anual menos gastos anuales</p>
            </article>
            <article className="cc-kpi-card">
              <span className="cc-kpi-label">Margen simple cobrado</span>
              <strong className="cc-kpi-value">{formatCurrency(summary.collectedTotal - summary.expensesTotal)}</strong>
              <p className="cc-kpi-footnote">Cobrado anual menos gastos anuales</p>
            </article>
          </section>

          <section className="cc-dashboard-block">
            <div className="cc-dashboard-block__header">
              <div>
                <h2>Comparativa por trimestre</h2>
                <p>Lectura directa del comportamiento trimestral dentro del ejercicio.</p>
              </div>
            </div>

            <div className="cc-annual-breakdown-grid">
              {summary.quarterlyBreakdown.map((quarter) => (
                <article key={quarter.fiscal_quarter} className="cc-quarterly-persistence__card cc-annual-breakdown-card">
                  <span className="cc-dashboard-panel__label">T{quarter.fiscal_quarter}</span>
                  <strong className="cc-dashboard-panel__value">{formatCurrency(quarter.invoiced_total)}</strong>
                  <p className="cc-dashboard-panel__text">Cobrado: {formatCurrency(quarter.collected_total)}</p>
                  <p className="cc-dashboard-panel__text">Gastos: {formatCurrency(quarter.expenses_total)}</p>
                  <p className="cc-dashboard-panel__text">Margen simple: {formatCurrency(quarter.invoiced_total - quarter.expenses_total)}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="cc-quarterly-pack-grid">
            <article className="cc-quarterly-persistence__card">
              <span className="cc-dashboard-panel__label">Top clientes facturados</span>
              <strong className="cc-dashboard-panel__value">{topYearClientsByInvoiced.length}</strong>
              {topYearClientsByInvoiced.length === 0 ? (
                <p className="cc-dashboard-panel__text">Sin clientes facturados este año.</p>
              ) : (
                topYearClientsByInvoiced.map((client, index) => (
                  <p key={`${client.label}-${index}`} className="cc-dashboard-panel__text">
                    {index + 1}. {client.label}: {formatCurrency(client.amount)} · {client.invoiceCount} factura(s)
                  </p>
                ))
              )}
            </article>
            <article className="cc-quarterly-persistence__card">
              <span className="cc-dashboard-panel__label">Top clientes cobrados</span>
              <strong className="cc-dashboard-panel__value">{topYearClientsByCollected.length}</strong>
              {topYearClientsByCollected.length === 0 ? (
                <p className="cc-dashboard-panel__text">Sin cobros registrados este año.</p>
              ) : (
                topYearClientsByCollected.map((client, index) => (
                  <p key={`${client.label}-${index}`} className="cc-dashboard-panel__text">
                    {index + 1}. {client.label}: {formatCurrency(client.amount)} · {client.paymentCount} cobro(s)
                  </p>
                ))
              )}
            </article>
            <article className="cc-quarterly-persistence__card">
              <span className="cc-dashboard-panel__label">Clientes con saldo pendiente</span>
              <strong className="cc-dashboard-panel__value">{yearOutstandingClients.length}</strong>
              {yearOutstandingClients.length === 0 ? (
                <p className="cc-dashboard-panel__text">No hay saldos pendientes en facturas del ejercicio.</p>
              ) : (
                yearOutstandingClients.map((client, index) => (
                  <p key={`${client.label}-${index}`} className="cc-dashboard-panel__text">
                    {index + 1}. {client.label}: {formatCurrency(client.amount)} · {client.invoiceCount} factura(s)
                  </p>
                ))
              )}
            </article>
          </section>

          <section className="cc-dashboard-block">
            <div className="cc-dashboard-block__header">
              <div>
                <h2>Desglose de gastos por categoría</h2>
                <p>Mix anual de gasto según las categorías actuales registradas en el CRM.</p>
              </div>
            </div>

            <div className="cc-quarterly-pack-grid">
              {yearExpenseBreakdown.length === 0 ? (
                <div className="empty-state">
                  <strong>Sin gastos para analizar</strong>
                  <p>No hay gastos registrados en este ejercicio.</p>
                </div>
              ) : (
                yearExpenseBreakdown.slice(0, 6).map((item) => (
                  <article key={item.category} className="cc-quarterly-persistence__card">
                    <span className="cc-dashboard-panel__label">{item.category}</span>
                    <strong className="cc-dashboard-panel__value">{formatCurrency(item.amount)}</strong>
                    <p className="cc-dashboard-panel__text">{item.count} gasto(s) en la categoría</p>
                    <p className="cc-dashboard-panel__text">
                      {summary.expensesTotal > 0 ? `${((item.amount / summary.expensesTotal) * 100).toFixed(1)}% del gasto anual` : 'Sin peso relativo'}
                    </p>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="cc-dashboard-block">
            <div className="cc-dashboard-block__header">
              <div>
                <h2>Comparativa mes a mes</h2>
                <p>Serie compacta de facturación, cobro, gasto y margen simple a lo largo del año.</p>
              </div>
            </div>

            <div className="cc-quarterly-dossier-table">
              <div className="cc-quarterly-dossier-table__head">
                <span>Mes</span>
                <span>Facturado</span>
                <span>Cobrado</span>
                <span>Gastos</span>
                <span>Margen simple</span>
                <span>Lectura</span>
              </div>

              {yearMonthComparison.map((month) => (
                <div key={month.key} className="cc-quarterly-dossier-table__row">
                  <span>{month.label}</span>
                  <span>{formatCurrency(month.invoiced)}</span>
                  <span>{formatCurrency(month.collected)}</span>
                  <span>{formatCurrency(month.spent)}</span>
                  <span>{formatCurrency(month.margin)}</span>
                  <span>{month.collected >= month.invoiced ? 'Caja acompasada' : 'Cobro por detrás'}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </section>
  )
}
