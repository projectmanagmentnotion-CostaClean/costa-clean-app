import { useEffect, useMemo, useState } from 'react'
import { formatCurrency } from '../app/displayFormat'
import type { AppView } from '../app/navigation'
import type { AnnualClosingIncidence, AnnualClosingRecord, AnnualClosingSummary } from '../features/annualClosing/types'

interface AnnualClosingPageProps {
  availableYears: number[]
  defaultFiscalYear: number
  summaryByYear: Map<number, AnnualClosingSummary>
  closings: AnnualClosingRecord[]
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

export function AnnualClosingPage({
  availableYears,
  defaultFiscalYear,
  summaryByYear,
  closings,
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

  useEffect(() => {
    setSelectedYear(defaultFiscalYear)
  }, [defaultFiscalYear])

  const summary = summaryByYear.get(selectedYear)
  const closing = useMemo(
    () => closings.find((item) => item.fiscal_year === selectedYear) ?? null,
    [closings, selectedYear],
  )

  useEffect(() => {
    setNotes(closing?.notes ?? '')
    setSaveMessage(null)
    setSaveError(null)
  }, [closing, selectedYear])

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

  return (
    <section className="page-section cc-master-page cc-annual-closing-page">
      <div className="section-header page-header-actions cc-master-page__hero">
        <div>
          <h1>Cierre anual</h1>
          <p>Consolidado operativo anual con desglose trimestral y snapshot persistido del ejercicio.</p>
        </div>
      </div>

      <section className="cc-dashboard-block cc-quarterly-closing-shell" aria-label="Configuración de cierre anual">
        <div className="cc-dashboard-block__header">
          <div>
            <h2>Ejercicio de cierre</h2>
            <p>Selecciona el año fiscal para revisar el estado anual consolidado.</p>
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
      </section>

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
    </section>
  )
}
