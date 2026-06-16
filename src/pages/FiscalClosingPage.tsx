import { useEffect, useMemo, useState } from 'react'
import { formatCurrency, formatDateEs } from '../app/displayFormat'
import { FiscalPeriodSelector } from '../features/closing/FiscalPeriodSelector'
import {
  buildClosingSummary,
  type ClosingIncidenceScope,
  type ClosingIncidenceView,
  type ClosingReadinessLevel,
} from '../features/closing/closingSummaryEngine'
import type { FiscalPeriodSelection } from '../features/closing/fiscalPeriods'
import { FiscalPeriodExportSection } from '../features/closingExports/FiscalPeriodExportSection'
import type { AnnualClosingRecord, AnnualClosingSummary } from '../features/annualClosing/types'
import {
  getExpenseDocumentSupportStatusLabel,
  getExpenseFiscalRiskLevelLabel,
  getExpenseFiscalReviewStatusLabel,
  type ExpenseListItem,
} from '../features/expenses/types'
import type { InvoiceListItem } from '../features/invoices/types'
import type { PaymentListItem } from '../features/payments/types'
import type { ClientListItem } from '../features/clients/types'
import type { PropertyListItem } from '../features/properties/types'
import type { QuarterlyClosingRecord, QuarterlyClosingSummary } from '../features/quarterlyClosing/types'
import type { QuoteListItem } from '../features/quotes/types'

interface FiscalClosingPageProps {
  availableYears: number[]
  initialSelection: FiscalPeriodSelection
  quarterlySummaryByPeriod: Map<string, QuarterlyClosingSummary>
  annualSummaryByYear: Map<number, AnnualClosingSummary>
  quarterlyClosings: QuarterlyClosingRecord[]
  annualClosings: AnnualClosingRecord[]
  invoices: InvoiceListItem[]
  payments: PaymentListItem[]
  expenses: ExpenseListItem[]
  quotes: QuoteListItem[]
  clients: ClientListItem[]
  properties: PropertyListItem[]
  error: string | null
  onNavigateToIncidence: (
    view: ClosingIncidenceView,
    scope: ClosingIncidenceScope,
    selection: FiscalPeriodSelection,
  ) => void
  onSaveQuarterlyClosing: (input: { fiscalYear: number; fiscalQuarter: number; notes: string | null }) => Promise<void>
  onSaveAnnualClosing: (input: { fiscalYear: number; notes: string | null }) => Promise<void>
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

function getToneClass(tone: 'neutral' | 'warning' | 'danger'): string {
  if (tone === 'danger') return 'cc-quarterly-checklist__item--danger'
  if (tone === 'warning') return 'cc-quarterly-checklist__item--warning'
  return ''
}

function getReadinessCopy(level: ClosingReadinessLevel) {
  if (level === 'ready') {
    return {
      label: 'Listo para exportar con confianza',
      detail: 'La lectura fiscal operativa no detecta huecos documentales ni bloqueos prioritarios en este periodo.',
      toneClass: 'cc-kpi-card--success',
    }
  }

  if (level === 'blocked') {
    return {
      label: 'Cierre con bloqueos documentales',
      detail: 'Hay huecos de soporte o de factura válida para IVA que conviene resolver antes de generar el pack gestor.',
      toneClass: 'cc-kpi-card--warning',
    }
  }

  return {
    label: 'Cierre revisable antes de exportar',
    detail: 'La base está construida, pero todavía hay puntos de revisión fiscal o saldos pendientes antes de entregar.',
    toneClass: 'cc-kpi-card--warning',
  }
}

export function FiscalClosingPage({
  availableYears,
  initialSelection,
  quarterlySummaryByPeriod,
  annualSummaryByYear,
  quarterlyClosings,
  annualClosings,
  invoices,
  payments,
  expenses,
  quotes,
  clients,
  properties,
  error,
  onNavigateToIncidence,
  onSaveQuarterlyClosing,
  onSaveAnnualClosing,
}: FiscalClosingPageProps) {
  const [selection, setSelection] = useState<FiscalPeriodSelection>(initialSelection)
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    setSelection(initialSelection)
  }, [initialSelection])

  const summary = useMemo(() => buildClosingSummary({
    selection,
    invoices,
    payments,
    expenses,
    quotes,
    quarterlySummaryByPeriod,
    annualSummaryByYear,
  }), [annualSummaryByYear, expenses, invoices, payments, quarterlySummaryByPeriod, quotes, selection])

  const quarterlyClosing = useMemo(
    () => (
      summary.snapshotMode === 'quarterly' && summary.fiscalQuarter
        ? quarterlyClosings.find((item) => item.fiscal_year === summary.fiscalYear && item.fiscal_quarter === summary.fiscalQuarter) ?? null
        : null
    ),
    [quarterlyClosings, summary.fiscalQuarter, summary.fiscalYear, summary.snapshotMode],
  )
  const annualClosing = useMemo(
    () => (
      summary.snapshotMode === 'annual'
        ? annualClosings.find((item) => item.fiscal_year === summary.fiscalYear) ?? null
        : null
    ),
    [annualClosings, summary.fiscalYear, summary.snapshotMode],
  )
  const persistedClosing = quarterlyClosing ?? annualClosing

  useEffect(() => {
    setNotes(persistedClosing?.notes ?? '')
    setSaveMessage(null)
    setSaveError(null)
  }, [persistedClosing, selection])

  const statusCard = useMemo(() => {
    if (!summary.snapshotMode) {
      return {
        label: 'Vista exploratoria',
        tone: 'neutral' as const,
        detail: 'Mes y rango personalizado usan el mismo motor de cierre, pero no generan snapshot persistido.',
      }
    }

    if (!persistedClosing) {
      return {
        label: 'Sin snapshot guardado',
        tone: 'neutral' as const,
        detail: 'El resumen ya es operativo, pero todavía no se ha persistido el cierre de este preset.',
      }
    }

    if (summary.readiness === 'issues' || persistedClosing.status === 'issues') {
      return {
        label: 'Guardado con incidencias',
        tone: 'warning' as const,
        detail: 'Existe snapshot persistido, pero todavía hay puntos abiertos antes de cerrar con tranquilidad.',
      }
    }

    return {
      label: 'Preparado y guardado',
      tone: 'success' as const,
      detail: 'El preset tiene snapshot persistido y no se detectan incidencias abiertas en el resumen actual.',
    }
  }, [persistedClosing, summary.readiness, summary.snapshotMode])

  const readinessCopy = useMemo(
    () => getReadinessCopy(summary.readinessLevel),
    [summary.readinessLevel],
  )

  async function handleSaveSnapshot() {
    if (summary.snapshotMode === 'quarterly' && summary.fiscalQuarter) {
      setIsSaving(true)
      setSaveMessage(null)
      setSaveError(null)

      try {
        await onSaveQuarterlyClosing({
          fiscalYear: summary.fiscalYear,
          fiscalQuarter: summary.fiscalQuarter,
          notes: notes.trim() || null,
        })
        setSaveMessage(`Snapshot trimestral guardado para ${summary.period.label}.`)
      } catch (saveIssue) {
        setSaveError(saveIssue instanceof Error ? saveIssue.message : 'No se pudo guardar el snapshot trimestral.')
      } finally {
        setIsSaving(false)
      }
      return
    }

    if (summary.snapshotMode === 'annual') {
      setIsSaving(true)
      setSaveMessage(null)
      setSaveError(null)

      try {
        await onSaveAnnualClosing({
          fiscalYear: summary.fiscalYear,
          notes: notes.trim() || null,
        })
        setSaveMessage(`Snapshot anual guardado para ${summary.period.label}.`)
      } catch (saveIssue) {
        setSaveError(saveIssue instanceof Error ? saveIssue.message : 'No se pudo guardar el snapshot anual.')
      } finally {
        setIsSaving(false)
      }
    }
  }

  return (
    <section className="dashboard-page">
      <header className="page-header">
        <div>
          <span className="page-header__eyebrow">Cierre fiscal</span>
          <h1>Una sola vista para revisar, validar y exportar el periodo</h1>
          <p>El periodo activo gobierna resumen fiscal, KPIs, incidencias, soportes y paquete gestor.</p>
        </div>
      </header>

      {error ? (
        <div className="cc-alert cc-alert--error">
          <strong>No se pudo cargar la base del cierre</strong>
          <p>{error}</p>
        </div>
      ) : null}

      <FiscalPeriodSelector
        availableYears={availableYears}
        selection={selection}
        onChange={setSelection}
      />

      <section className="cc-quarterly-pack-grid">
        <article className="cc-quarterly-persistence__card">
          <span className="cc-dashboard-panel__label">Estado del cierre</span>
          <strong className="cc-kpi-value">{statusCard.label}</strong>
          <p className="cc-dashboard-panel__text">{statusCard.detail}</p>
          <p className="cc-dashboard-panel__text">
            Último guardado: {formatDateTime(persistedClosing?.closed_at ?? persistedClosing?.updated_at ?? null)}
          </p>
        </article>

        <article className="cc-quarterly-persistence__card">
          <span className="cc-dashboard-panel__label">Lectura fiscal rápida</span>
          <strong className="cc-kpi-value">{formatCurrency(summary.estimatedNetVatPayable)}</strong>
          <p className="cc-dashboard-panel__text">
            IVA repercutido {formatCurrency(summary.outputVatTotal)} · IVA deducible estimado {formatCurrency(summary.estimatedDeductibleVat)}
          </p>
          <p className="cc-dashboard-panel__text">
            {summary.readiness === 'issues'
              ? `${summary.unresolvedIncidenceCount} incidencia(s) abierta(s) antes de exportar.`
              : 'Sin incidencias prioritarias detectadas para este periodo.'}
          </p>
        </article>

        <article className="cc-quarterly-persistence__card">
          <span className="cc-dashboard-panel__label">Snapshot y notas</span>
          <textarea
            className="cc-notes-textarea"
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={summary.snapshotMode ? 'Notas del snapshot fiscal...' : 'Notas internas del cierre...'}
          />
          <div className="cc-action-group">
            {summary.snapshotMode ? (
              <button type="button" className="primary-button" onClick={handleSaveSnapshot} disabled={isSaving}>
                {isSaving ? 'Guardando...' : summary.snapshotMode === 'quarterly' ? 'Guardar snapshot trimestral' : 'Guardar snapshot anual'}
              </button>
            ) : (
              <button type="button" className="secondary-button" disabled>
                Snapshot no disponible para este rango
              </button>
            )}
          </div>
          {saveMessage ? <p className="cc-dashboard-panel__text">{saveMessage}</p> : null}
          {saveError ? <p className="cc-dashboard-panel__text">{saveError}</p> : null}
        </article>
      </section>

      <section className="cc-dashboard-block">
        <div className="cc-dashboard-block__header">
          <div>
            <h2>Lectura fiscal central del periodo</h2>
            <p>Lectura operativa para revisar el cierre. Los importes estimados orientan la validación interna, pero no sustituyen la liquidación fiscal definitiva.</p>
          </div>
        </div>

        <div className="cc-kpi-grid cc-quarterly-metrics">
          <article className="cc-kpi-card cc-kpi-card--finance cc-fiscal-closing__hero-card">
            <span className="cc-kpi-label">Facturado fiscalmente</span>
            <strong className="cc-kpi-value">{formatCurrency(summary.invoicedTotal)}</strong>
            <p className="cc-kpi-footnote">{summary.invoiceCount} factura(s) emitida(s) dentro del periodo activo.</p>
          </article>
          <article className="cc-kpi-card cc-kpi-card--finance cc-fiscal-closing__hero-card">
            <span className="cc-kpi-label">IVA repercutido</span>
            <strong className="cc-kpi-value">{formatCurrency(summary.outputVatTotal)}</strong>
            <p className="cc-kpi-footnote">Base de IVA emitido según facturas del periodo.</p>
          </article>
          <article className="cc-kpi-card cc-fiscal-closing__hero-card">
            <span className="cc-kpi-label">IVA deducible estimado</span>
            <strong className="cc-kpi-value">{formatCurrency(summary.estimatedDeductibleVat)}</strong>
            <p className="cc-kpi-footnote">Estimado según gastos con soporte y reglas fiscales ya modeladas.</p>
          </article>
          <article className={`cc-kpi-card cc-fiscal-closing__hero-card ${readinessCopy.toneClass}`}>
            <span className="cc-kpi-label">IVA neto estimado</span>
            <strong className="cc-kpi-value">{formatCurrency(summary.estimatedNetVatPayable)}</strong>
            <p className="cc-kpi-footnote">IVA repercutido menos IVA deducible estimado para orientar la revisión.</p>
          </article>
        </div>

        <div className="cc-kpi-grid cc-fiscal-closing__support-grid">
          <article className={`cc-kpi-card ${readinessCopy.toneClass}`}>
            <span className="cc-kpi-label">Estado del cierre</span>
            <strong className="cc-kpi-value">{readinessCopy.label}</strong>
            <p className="cc-kpi-footnote">{readinessCopy.detail}</p>
          </article>
          <article className="cc-kpi-card">
            <span className="cc-kpi-label">Cobertura documental</span>
            <strong className="cc-kpi-value">{summary.closureDocumentCoverageRate}%</strong>
            <p className="cc-kpi-footnote">{summary.supportedClosureExpenseCount} de {summary.closureExpenseCount} gasto(s) de cierre tienen soporte descargable.</p>
          </article>
          <article className="cc-kpi-card">
            <span className="cc-kpi-label">Soporte válido para IVA</span>
            <strong className="cc-kpi-value">{summary.supportedVatCoverageRate}%</strong>
            <p className="cc-kpi-footnote">{summary.validVatInvoiceSupportCount} gasto(s) con factura válida sobre la base soportada del periodo.</p>
          </article>
          <article className="cc-kpi-card">
            <span className="cc-kpi-label">Bloqueos críticos</span>
            <strong className="cc-kpi-value">{summary.criticalIncidenceCount}</strong>
            <p className="cc-kpi-footnote">Huecos documentales o fiscales que conviene cerrar antes de exportar.</p>
          </article>
        </div>
      </section>

      <section className="cc-kpi-grid cc-quarterly-metrics">
        <article className="cc-kpi-card cc-kpi-card--finance">
          <span className="cc-kpi-label">Periodo</span>
          <strong className="cc-kpi-value">{summary.period.label}</strong>
          <p className="cc-kpi-footnote">{summary.period.startDate} → {summary.period.endDate}</p>
        </article>
        <article className="cc-kpi-card cc-kpi-card--finance">
          <span className="cc-kpi-label">IVA repercutido</span>
          <strong className="cc-kpi-value">{formatCurrency(summary.outputVatTotal)}</strong>
          <p className="cc-kpi-footnote">Facturas emitidas del periodo</p>
        </article>
        <article className="cc-kpi-card">
          <span className="cc-kpi-label">IVA deducible estimado</span>
          <strong className="cc-kpi-value">{formatCurrency(summary.estimatedDeductibleVat)}</strong>
          <p className="cc-kpi-footnote">Basado en gastos y soporte útil</p>
        </article>
        <article className="cc-kpi-card cc-kpi-card--warning">
          <span className="cc-kpi-label">IVA neto estimado</span>
          <strong className="cc-kpi-value">{formatCurrency(summary.estimatedNetVatPayable)}</strong>
          <p className="cc-kpi-footnote">Lectura orientativa, no liquidación fiscal definitiva</p>
        </article>
        <article className="cc-kpi-card">
          <span className="cc-kpi-label">Facturas</span>
          <strong className="cc-kpi-value">{summary.invoiceCount}</strong>
          <p className="cc-kpi-footnote">Facturado: {formatCurrency(summary.invoicedTotal)}</p>
        </article>
        <article className="cc-kpi-card">
          <span className="cc-kpi-label">Cobros</span>
          <strong className="cc-kpi-value">{summary.paymentCount}</strong>
          <p className="cc-kpi-footnote">Cobrado: {formatCurrency(summary.collectedTotal)}</p>
        </article>
        <article className="cc-kpi-card">
          <span className="cc-kpi-label">Gastos</span>
          <strong className="cc-kpi-value">{summary.expenseCount}</strong>
          <p className="cc-kpi-footnote">Gasto: {formatCurrency(summary.expensesTotal)}</p>
        </article>
        <article className="cc-kpi-card">
          <span className="cc-kpi-label">Incidencias</span>
          <strong className="cc-kpi-value">{summary.unresolvedIncidenceCount}</strong>
          <p className="cc-kpi-footnote">Pendientes de resolver antes de exportar</p>
        </article>
        <article className="cc-kpi-card">
          <span className="cc-kpi-label">Sin soporte</span>
          <strong className="cc-kpi-value">{summary.missingSupportCount}</strong>
          <p className="cc-kpi-footnote">Gastos de cierre con huecos documentales descargables</p>
        </article>
        <article className="cc-kpi-card">
          <span className="cc-kpi-label">A revisar</span>
          <strong className="cc-kpi-value">{summary.pendingReviewCount + summary.riskCount}</strong>
          <p className="cc-kpi-footnote">Revisión fiscal pendiente o riesgo medio/alto antes del pack</p>
        </article>
      </section>

      {summary.quarterBreakdown.length > 0 ? (
        <section className="cc-dashboard-block">
          <div className="cc-dashboard-block__header">
            <div>
              <h2>Desglose trimestral del ejercicio</h2>
              <p>El cierre anual sigue apoyándose en los cuatro trimestres, pero ya vive dentro de la misma sección.</p>
            </div>
          </div>

          <div className="cc-export-folder-list cc-bounded-list">
            {summary.quarterBreakdown.map((quarter) => (
              <article key={quarter.fiscalQuarter} className="cc-export-folder-item">
                <strong>{`T${quarter.fiscalQuarter}`}</strong>
                <p>
                  Facturado {formatCurrency(quarter.invoicedTotal)} · IVA neto estimado {formatCurrency(quarter.estimatedNetVatPayable)} ·
                  Incidencias {quarter.unresolvedIncidenceCount}
                </p>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setSelection((current) => ({
                    ...current,
                    mode: 'quarter',
                    year: summary.fiscalYear,
                    quarter: quarter.fiscalQuarter,
                  }))}
                >
                  Abrir trimestre
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="cc-quarterly-summary-grid">
        <article className="cc-dashboard-block">
          <div className="cc-dashboard-block__header">
            <div>
              <h2>Incidencias del cierre</h2>
              <p>Lo que falta revisar antes de exportar o guardar el preset.</p>
            </div>
          </div>

          <div className="cc-quarterly-checklist">
            {summary.incidences.map((incidence) => (
              <article key={incidence.id} className={`cc-quarterly-checklist__item ${getToneClass(incidence.tone)}`}>
                <div>
                  <strong>{incidence.label}</strong>
                  <p>{incidence.detail}</p>
                </div>
                <div className="cc-action-group">
                  <span className="lead-badge">{incidence.count}</span>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => onNavigateToIncidence(incidence.view, incidence.scope, selection)}
                  >
                    Abrir módulo
                  </button>
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className="cc-dashboard-block">
          <div className="cc-dashboard-block__header">
            <div>
              <h2>Soportes y revisión documental</h2>
              <p>Documentos faltantes y gastos prioritarios dentro del mismo periodo.</p>
            </div>
          </div>

          <div className="cc-export-folder-list cc-bounded-list">
            {summary.missingSupportExpenses.length === 0 && summary.pendingReviewExpenses.length === 0 && summary.riskExpenses.length === 0 ? (
              <article className="cc-export-folder-item">
                <strong>Sin bloqueos documentales</strong>
                <p>No se detectan gastos sin soporte ni revisiones fiscales prioritarias en el periodo activo.</p>
              </article>
            ) : null}

            {summary.missingSupportExpenses.slice(0, 6).map((expense) => (
              <article key={`missing-${expense.id}`} className="cc-export-folder-item">
                <strong>{expense.display_code ?? expense.supplier_name}</strong>
                <p>
                  {expense.supplier_name} · {formatDateEs(expense.expense_date)} · {getExpenseDocumentSupportStatusLabel(expense.document_support_status)}
                </p>
              </article>
            ))}

            {summary.pendingReviewExpenses.slice(0, 6).map((expense) => (
              <article key={`review-${expense.id}`} className="cc-export-folder-item">
                <strong>{expense.display_code ?? expense.supplier_name}</strong>
                <p>
                  Revisión {getExpenseFiscalReviewStatusLabel(expense.fiscal_review_status)} · riesgo {getExpenseFiscalRiskLevelLabel(expense.ai_fiscal_risk_level ?? expense.fiscal_risk_level).toLowerCase()}
                </p>
              </article>
            ))}
          </div>
        </article>
      </section>

      <FiscalPeriodExportSection
        availableYears={availableYears}
        selection={selection}
        onSelectionChange={setSelection}
        title="Exportar cierre fiscal"
        description="Mismo periodo, mismo resumen y mismo contexto documental."
        invoices={invoices}
        payments={payments}
        expenses={expenses}
        quotes={quotes}
        clients={clients}
        properties={properties}
        closingSavedAt={persistedClosing?.closed_at ?? persistedClosing?.updated_at ?? null}
        closingNotes={notes.trim() || null}
        showSelector={false}
      />
    </section>
  )
}
