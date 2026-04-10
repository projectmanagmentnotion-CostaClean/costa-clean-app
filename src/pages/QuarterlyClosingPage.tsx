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
import type { QuarterlyClosingIncidence, QuarterlyClosingRecord, QuarterlyClosingSummary } from '../features/quarterlyClosing/types'

type QuarterlyClosingWorkspace = 'operations' | 'manager_pack' | 'dossier'

interface QuarterlyClosingPageProps {
  availableYears: number[]
  defaultFiscalYear: number
  defaultFiscalQuarter: number
  summaryByPeriod: Map<string, QuarterlyClosingSummary>
  closings: QuarterlyClosingRecord[]
  invoices: InvoiceListItem[]
  payments: PaymentListItem[]
  expenses: ExpenseListItem[]
  error: string | null
  onNavigateToIncidence: (view: AppView, scope: QuarterlyClosingIncidence['scope'], fiscalYear: number, fiscalQuarter: number) => void
  onSaveClosing: (input: { fiscalYear: number; fiscalQuarter: number; notes: string | null }) => Promise<void>
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Sin guardar'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin guardar'

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function getQuarterLabel(fiscalYear: number, fiscalQuarter: number): string {
  return `T${fiscalQuarter} ${fiscalYear}`
}

function getPeriodKey(fiscalYear: number, fiscalQuarter: number): string {
  return `${fiscalYear}-Q${fiscalQuarter}`
}

function matchesDateQuarter(dateValue: string, fiscalYear: number, fiscalQuarter: number): boolean {
  if (!dateValue) return false
  const normalized = dateValue.length > 10 ? dateValue : `${dateValue}T00:00:00`
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return false
  return date.getFullYear() === fiscalYear && Math.floor(date.getMonth() / 3) + 1 === fiscalQuarter
}

function matchesExpenseQuarter(expense: ExpenseListItem, fiscalYear: number, fiscalQuarter: number): boolean {
  if (expense.fiscal_year && expense.fiscal_quarter) {
    return expense.fiscal_year === fiscalYear && expense.fiscal_quarter === fiscalQuarter
  }

  return matchesDateQuarter(expense.expense_date, fiscalYear, fiscalQuarter)
}

function getUiStatus(summary: QuarterlyClosingSummary, closing: QuarterlyClosingRecord | null): {
  label: string
  tone: 'neutral' | 'success' | 'warning'
  detail: string
} {
  if (!closing) {
    return {
      label: 'No preparado',
      tone: 'neutral',
      detail: 'No existe snapshot persistido para este trimestre.',
    }
  }

  if (summary.readiness === 'issues' || closing.status === 'issues') {
    return {
      label: 'Guardado con incidencias',
      tone: 'warning',
      detail: 'Existe snapshot guardado, pero aún hay puntos abiertos en el trimestre.',
    }
  }

  return {
    label: 'Preparado y guardado',
    tone: 'success',
    detail: 'El trimestre tiene snapshot persistido sin incidencias abiertas detectadas.',
  }
}

function getIncidenceToneClass(tone: QuarterlyClosingIncidence['tone']): string {
  if (tone === 'danger') return 'cc-quarterly-checklist__item--danger'
  if (tone === 'warning') return 'cc-quarterly-checklist__item--warning'
  return ''
}

export function QuarterlyClosingPage({
  availableYears,
  defaultFiscalYear,
  defaultFiscalQuarter,
  summaryByPeriod,
  closings,
  invoices,
  payments,
  expenses,
  error,
  onNavigateToIncidence,
  onSaveClosing,
}: QuarterlyClosingPageProps) {
  const [selectedYear, setSelectedYear] = useState(defaultFiscalYear)
  const [selectedQuarter, setSelectedQuarter] = useState(defaultFiscalQuarter)
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [workspace, setWorkspace] = useState<QuarterlyClosingWorkspace>('operations')
  const [documentActionError, setDocumentActionError] = useState<string | null>(null)
  const [openingExpenseId, setOpeningExpenseId] = useState<string | null>(null)

  useEffect(() => {
    setSelectedYear(defaultFiscalYear)
    setSelectedQuarter(defaultFiscalQuarter)
  }, [defaultFiscalYear, defaultFiscalQuarter])

  const selectedKey = getPeriodKey(selectedYear, selectedQuarter)
  const summary = summaryByPeriod.get(selectedKey)
  const closing = useMemo(
    () =>
      closings.find(
        (item) =>
          item.fiscal_year === selectedYear && item.fiscal_quarter === selectedQuarter,
      ) ?? null,
    [closings, selectedYear, selectedQuarter],
  )

  const quarterInvoices = useMemo(
    () => invoices.filter((invoice) => matchesDateQuarter(invoice.issue_date, selectedYear, selectedQuarter)),
    [invoices, selectedQuarter, selectedYear],
  )
  const quarterPayments = useMemo(
    () => payments.filter((payment) => matchesDateQuarter(payment.payment_date, selectedYear, selectedQuarter)),
    [payments, selectedQuarter, selectedYear],
  )
  const quarterExpenses = useMemo(
    () => expenses.filter((expense) => matchesExpenseQuarter(expense, selectedYear, selectedQuarter)),
    [expenses, selectedQuarter, selectedYear],
  )

  useEffect(() => {
    setNotes(closing?.notes ?? '')
    setSaveMessage(null)
    setSaveError(null)
    setDocumentActionError(null)

    if (!closing && workspace !== 'operations') {
      setWorkspace('operations')
    }
  }, [closing, selectedYear, selectedQuarter, workspace])

  const quarterPaymentsTotal = useMemo(
    () => quarterPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [quarterPayments],
  )
  const quarterExpenseDocumentsPresentCount = useMemo(
    () => quarterExpenses.filter((expense) => Boolean(expense.receipt_file_path)).length,
    [quarterExpenses],
  )
  const quarterExpenseMissingDocuments = useMemo(
    () =>
      quarterExpenses.filter(
        (expense) =>
          expense.affects_quarterly_closure &&
          (expense.document_support_status === 'missing' ||
            (!expense.receipt_file_path && expense.document_support_status !== 'invoice_valid')),
      ),
    [quarterExpenses],
  )

  if (!summary) {
    return (
      <section className="page-section cc-master-page">
        <div className="section-header page-header-actions cc-master-page__hero">
          <div>
            <h1>Cierre trimestral</h1>
            <p>Vista operativa para preparar el cierre fiscal trimestral sin salir del CRM.</p>
          </div>
        </div>

        <div className="cc-alert cc-alert--warning">
          <strong>No hay datos suficientes</strong>
          <p>No se pudo construir el resumen del trimestre seleccionado.</p>
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
        fiscalQuarter: selectedQuarter,
        notes: notes.trim() || null,
      })
      setSaveMessage(`Snapshot guardado para ${getQuarterLabel(selectedYear, selectedQuarter)}.`)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudo guardar el cierre trimestral.')
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
    <section className="page-section cc-master-page cc-quarterly-closing-page">
      <div className="section-header page-header-actions cc-master-page__hero">
        <div>
          <h1>Cierre trimestral</h1>
          <p>Panel operativo, pack gestor y dossier documental alineados con el cierre guardado del trimestre.</p>
        </div>
      </div>

      <section className="cc-dashboard-block cc-quarterly-closing-shell" aria-label="Configuración de cierre trimestral">
        <div className="cc-dashboard-block__header">
          <div>
            <h2>Periodo de cierre</h2>
            <p>Selecciona ejercicio y trimestre para revisar el estado operativo y abrir el pack documental del cierre guardado.</p>
          </div>

          <div className={`cc-quarterly-status-pill cc-quarterly-status-pill--${uiStatus.tone}`}>
            <span>{uiStatus.label}</span>
          </div>
        </div>

        <div className="filters-grid cc-quarterly-closing-filters">
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

          <label className="form-field">
            <span>Trimestre fiscal</span>
            <select value={selectedQuarter} onChange={(event) => setSelectedQuarter(Number(event.target.value))}>
              {[1, 2, 3, 4].map((quarter) => (
                <option key={quarter} value={quarter}>
                  T{quarter}
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
        </div>

        {!closing ? (
          <div className="cc-alert cc-alert--warning">
            <strong>Pack y dossier pendientes</strong>
            <p>Guarda primero el cierre trimestral para habilitar la vista gestor y el dossier documental del trimestre.</p>
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
            <strong>Error guardando el cierre</strong>
            <p>{saveError}</p>
          </div>
        ) : null}

        {saveMessage ? (
          <div className="cc-alert cc-alert--success">
            <strong>Snapshot actualizado</strong>
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
          <section className="cc-kpi-grid cc-quarterly-metrics" aria-label="Resumen trimestral">
            <article className="cc-kpi-card cc-kpi-card--finance">
              <span className="cc-kpi-label">Facturado del trimestre</span>
              <strong className="cc-kpi-value">{formatCurrency(summary.invoicedTotal)}</strong>
              <p className="cc-kpi-footnote">{summary.invoiceCount} factura(s) emitidas en {getQuarterLabel(selectedYear, selectedQuarter)}</p>
            </article>

            <article className="cc-kpi-card cc-kpi-card--success">
              <span className="cc-kpi-label">Cobrado del trimestre</span>
              <strong className="cc-kpi-value">{formatCurrency(summary.collectedTotal)}</strong>
              <p className="cc-kpi-footnote">{summary.paymentCount} cobro(s) registrados en el periodo</p>
            </article>

            <article className="cc-kpi-card cc-kpi-card--warning">
              <span className="cc-kpi-label">Pendiente de cobro</span>
              <strong className="cc-kpi-value">{formatCurrency(summary.outstandingTotal)}</strong>
              <p className="cc-kpi-footnote">{summary.pendingInvoiceCount} factura(s) del trimestre siguen abiertas</p>
            </article>

            <article className="cc-kpi-card">
              <span className="cc-kpi-label">Gastos del trimestre</span>
              <strong className="cc-kpi-value">{formatCurrency(summary.expensesTotal)}</strong>
              <p className="cc-kpi-footnote">{summary.expenseCount} gasto(s) registrados en el periodo</p>
            </article>

            <article className="cc-kpi-card">
              <span className="cc-kpi-label">Gastos sin justificante</span>
              <strong className="cc-kpi-value">{summary.missingSupportCount}</strong>
              <p className="cc-kpi-footnote">Solo se cuentan los que afectan al cierre trimestral</p>
            </article>

            <article className="cc-kpi-card">
              <span className="cc-kpi-label">Pendientes de revisión</span>
              <strong className="cc-kpi-value">{summary.pendingReviewCount}</strong>
              <p className="cc-kpi-footnote">Registros con revisión fiscal aún abierta</p>
            </article>

            <article className="cc-kpi-card">
              <span className="cc-kpi-label">Riesgo medio/alto</span>
              <strong className="cc-kpi-value">{summary.riskCount}</strong>
              <p className="cc-kpi-footnote">Incidencias fiscales a revisar antes del cierre</p>
            </article>

            <article className="cc-kpi-card">
              <span className="cc-kpi-label">Incidencias abiertas</span>
              <strong className="cc-kpi-value">{summary.unresolvedIncidenceCount}</strong>
              <p className="cc-kpi-footnote">Suma operativa de cobro pendiente e incidencias fiscales</p>
            </article>
          </section>

          <section className="cc-dashboard-block">
            <div className="cc-dashboard-block__header">
              <div>
                <h2>Checklist de cierre</h2>
                <p>Cada bloque abre el módulo correspondiente con el filtro ya aplicado al trimestre seleccionado.</p>
              </div>
            </div>

            <div className="cc-quarterly-checklist">
              {summary.incidences.map((incidence) => (
                <button
                  key={incidence.id}
                  type="button"
                  className={`cc-quarterly-checklist__item ${getIncidenceToneClass(incidence.tone)}`.trim()}
                  onClick={() =>
                    onNavigateToIncidence(
                      incidence.view,
                      incidence.scope,
                      selectedYear,
                      selectedQuarter,
                    )
                  }
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
                <h2>Snapshot persistido</h2>
                <p>Guarda una foto del cierre actual con los totales y conteos clave del trimestre.</p>
              </div>
            </div>

            <div className="cc-quarterly-persistence">
              <article className="cc-quarterly-persistence__card">
                <span className="cc-dashboard-panel__label">Estado guardado</span>
                <strong className="cc-dashboard-panel__value">{uiStatus.label}</strong>
                <p className="cc-dashboard-panel__text">Última actualización: {formatDateTime(closing?.closed_at)}</p>
                <p className="cc-dashboard-panel__text">Periodo: {getQuarterLabel(selectedYear, selectedQuarter)}</p>
              </article>

              <article className="cc-quarterly-persistence__card">
                <label className="form-field">
                  <span>Notas de cierre</span>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Observaciones breves del cierre, incidencias o contexto operativo."
                  />
                </label>

                <button
                  type="button"
                  className="primary-button"
                  onClick={handleSave}
                  disabled={isSaving || Boolean(error)}
                >
                  {isSaving ? 'Guardando snapshot...' : 'Guardar cierre trimestral'}
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
                    : 'Todavía no se ha guardado un resumen persistido para este trimestre.'}
                </p>
                {savedSnapshot ? (
                  <p className="cc-dashboard-panel__text">
                    Pendiente: {formatCurrency(savedSnapshot.outstanding_total)} · Incidencias: {savedSnapshot.unresolved_incidence_count}
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
                <h2>Pack gestor trimestral</h2>
                <p>Resumen ejecutivo y documental del cierre guardado para revisión de gestoría o dirección.</p>
              </div>
            </div>

            <div className="cc-quarterly-pack-header">
              <article className="cc-quarterly-persistence__card">
                <span className="cc-dashboard-panel__label">Trimestre</span>
                <strong className="cc-dashboard-panel__value">{getQuarterLabel(selectedYear, selectedQuarter)}</strong>
                <p className="cc-dashboard-panel__text">Estado: {uiStatus.label}</p>
              </article>
              <article className="cc-quarterly-persistence__card">
                <span className="cc-dashboard-panel__label">Snapshot guardado</span>
                <strong className="cc-dashboard-panel__value">{formatDateTime(closing.closed_at)}</strong>
                <p className="cc-dashboard-panel__text">Registro persistido vinculado al cierre trimestral.</p>
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
              <strong className="cc-dashboard-panel__value">{quarterInvoices.length}</strong>
              <p className="cc-dashboard-panel__text">Total emitido del trimestre: {formatCurrency(summary.invoicedTotal)}</p>
              <p className="cc-dashboard-panel__text">Pendientes hoy: {summary.pendingInvoiceCount} · {formatCurrency(summary.outstandingTotal)}</p>
            </article>

            <article className="cc-quarterly-persistence__card">
              <span className="cc-dashboard-panel__label">Resumen de cobros</span>
              <strong className="cc-dashboard-panel__value">{quarterPayments.length}</strong>
              <p className="cc-dashboard-panel__text">Importe cobrado del trimestre: {formatCurrency(quarterPaymentsTotal)}</p>
              <p className="cc-dashboard-panel__text">Cobros registrados con fecha del trimestre.</p>
            </article>

            <article className="cc-quarterly-persistence__card">
              <span className="cc-dashboard-panel__label">Resumen de gastos</span>
              <strong className="cc-dashboard-panel__value">{quarterExpenses.length}</strong>
              <p className="cc-dashboard-panel__text">Total de gastos: {formatCurrency(summary.expensesTotal)}</p>
              <p className="cc-dashboard-panel__text">Documentos presentes: {quarterExpenseDocumentsPresentCount} · sin soporte: {summary.missingSupportCount}</p>
            </article>
          </section>

          <section className="cc-dashboard-block">
            <div className="cc-dashboard-block__header">
              <div>
                <h2>Incidencias abiertas y riesgos</h2>
                <p>Lectura resumida del estado actual del trimestre para revisión de gestión.</p>
              </div>
            </div>

            <div className="cc-quarterly-checklist">
              {summary.incidences
                .filter((incidence) => incidence.count > 0 || incidence.id === 'invoice_quarter_all' || incidence.id === 'payment_quarter_all')
                .map((incidence) => (
                  <button
                    key={incidence.id}
                    type="button"
                    className={`cc-quarterly-checklist__item ${getIncidenceToneClass(incidence.tone)}`.trim()}
                    onClick={() =>
                      onNavigateToIncidence(
                        incidence.view,
                        incidence.scope,
                        selectedYear,
                        selectedQuarter,
                      )
                    }
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
                <h2>Dossier documental trimestral</h2>
                <p>Ordena documentos y evidencias del cierre guardado para revisión operativa y futura exportación.</p>
              </div>
            </div>

            <div className="cc-quarterly-persistence">
              <article className="cc-quarterly-persistence__card">
                <span className="cc-dashboard-panel__label">Dossier vinculado</span>
                <strong className="cc-dashboard-panel__value">{getQuarterLabel(selectedYear, selectedQuarter)}</strong>
                <p className="cc-dashboard-panel__text">Basado en el cierre guardado del {formatDateTime(closing.closed_at)}.</p>
              </article>
              <article className="cc-quarterly-persistence__card">
                <span className="cc-dashboard-panel__label">Completitud documental</span>
                <strong className="cc-dashboard-panel__value">{quarterExpenseDocumentsPresentCount}/{quarterExpenses.length}</strong>
                <p className="cc-dashboard-panel__text">Gastos con soporte documental accesible en la app.</p>
              </article>
              <article className="cc-quarterly-persistence__card">
                <span className="cc-dashboard-panel__label">Incidencias documentales</span>
                <strong className="cc-dashboard-panel__value">{quarterExpenseMissingDocuments.length}</strong>
                <p className="cc-dashboard-panel__text">Gastos del trimestre con soporte ausente o insuficiente.</p>
              </article>
            </div>
          </section>

          <section className="cc-dashboard-block">
            <div className="cc-dashboard-block__header">
              <div>
                <h2>Facturas emitidas</h2>
                <p>Listado del trimestre con acceso directo al flujo documental ya existente de factura.</p>
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

              {quarterInvoices.length === 0 ? (
                <div className="empty-state">
                  <strong>Sin facturas en el trimestre</strong>
                  <p>No hay facturas emitidas en este periodo.</p>
                </div>
              ) : (
                quarterInvoices.map((invoice) => (
                  <div key={invoice.id} className="cc-quarterly-dossier-table__row">
                    <span>{invoice.invoice_number ?? invoice.display_code ?? invoice.id}</span>
                    <span>{formatDateEs(invoice.issue_date)}</span>
                    <span>{invoice.client_name ?? invoice.client_display_code ?? invoice.client_id}</span>
                    <span>{formatCurrency(invoice.total)}</span>
                    <span>{getDisplayStatusLabel(invoice.status)}</span>
                    <div className="cc-quarterly-dossier-table__actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => openInvoicePrintWindow(invoice, 'pdf')}
                      >
                        PDF
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() =>
                          onNavigateToIncidence('invoices', 'invoice_quarter_all', selectedYear, selectedQuarter)
                        }
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
                <h2>Cobros del trimestre</h2>
                <p>Resumen documental de cobros asociados al periodo para contraste rápido con facturación.</p>
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

              {quarterPayments.length === 0 ? (
                <div className="empty-state">
                  <strong>Sin cobros en el trimestre</strong>
                  <p>No hay movimientos de cobro registrados para este periodo.</p>
                </div>
              ) : (
                quarterPayments.map((payment) => (
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
                <p>Estado de adjuntos, soporte fiscal y acceso al documento del gasto cuando existe.</p>
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

              {quarterExpenses.length === 0 ? (
                <div className="empty-state">
                  <strong>Sin gastos en el trimestre</strong>
                  <p>No hay gastos registrados para este periodo.</p>
                </div>
              ) : (
                quarterExpenses.map((expense) => (
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
                          onClick={() =>
                            onNavigateToIncidence('expenses', 'expense_quarter_missing_support', selectedYear, selectedQuarter)
                          }
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
                  incidence.id === 'expense_quarter_missing_support' ||
                  incidence.id === 'expense_quarter_pending_review' ||
                  incidence.id === 'expense_quarter_risk' ||
                  incidence.id === 'invoice_quarter_pending',
                )
                .map((incidence) => (
                  <button
                    key={incidence.id}
                    type="button"
                    className={`cc-quarterly-checklist__item ${getIncidenceToneClass(incidence.tone)}`.trim()}
                    onClick={() =>
                      onNavigateToIncidence(
                        incidence.view,
                        incidence.scope,
                        selectedYear,
                        selectedQuarter,
                      )
                    }
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
    </section>
  )
}
