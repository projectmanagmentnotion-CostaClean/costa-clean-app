import { useEffect, useMemo, useState } from 'react'
import type { AppView } from '../app/navigation'
import type { QuarterlyClosingIncidence, QuarterlyClosingRecord, QuarterlyClosingSummary } from '../features/quarterlyClosing/types'

interface QuarterlyClosingPageProps {
  availableYears: number[]
  defaultFiscalYear: number
  defaultFiscalQuarter: number
  summaryByPeriod: Map<string, QuarterlyClosingSummary>
  closings: QuarterlyClosingRecord[]
  error: string | null
  onNavigateToIncidence: (view: AppView, scope: QuarterlyClosingIncidence['scope'], fiscalYear: number, fiscalQuarter: number) => void
  onSaveClosing: (input: { fiscalYear: number; fiscalQuarter: number; notes: string | null }) => Promise<void>
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
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

export function QuarterlyClosingPage({
  availableYears,
  defaultFiscalYear,
  defaultFiscalQuarter,
  summaryByPeriod,
  closings,
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

  useEffect(() => {
    setNotes(closing?.notes ?? '')
    setSaveMessage(null)
    setSaveError(null)
  }, [closing, selectedYear, selectedQuarter])

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

  return (
    <section className="page-section cc-master-page cc-quarterly-closing-page">
      <div className="section-header page-header-actions cc-master-page__hero">
        <div>
          <h1>Cierre trimestral</h1>
          <p>Panel operativo de cierre para revisar facturación, cobros, incidencias fiscales y snapshot persistido.</p>
        </div>
      </div>

      <section className="cc-dashboard-block cc-quarterly-closing-shell" aria-label="Configuración de cierre trimestral">
        <div className="cc-dashboard-block__header">
          <div>
            <h2>Periodo de cierre</h2>
            <p>Selecciona ejercicio y trimestre para revisar el estado operativo antes de guardar el snapshot.</p>
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
      </section>

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
              className={`cc-quarterly-checklist__item cc-quarterly-checklist__item--${incidence.tone}`}
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
    </section>
  )
}
