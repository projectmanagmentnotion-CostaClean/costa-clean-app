import { Suspense, useEffect, useMemo, useState } from 'react'
import { ActionFlowOverlay } from '../components/ActionFlowOverlay'
import { DeferredContentFallback } from '../components/DeferredContentFallback'
import { formatCurrency, formatDateEs } from '../app/displayFormat'
import { ClosingAiSummarySection } from '../features/closing/ClosingAiSummarySection'
import { FiscalPeriodSelector } from '../features/closing/FiscalPeriodSelector'
import {
  buildClosingSummary,
  type ClosingIncidenceScope,
  type ClosingIncidenceView,
} from '../features/closing/closingSummaryEngine'
import { generateClosingIntelligenceSummary } from '../features/closingIntelligence/closingIntelligenceApi'
import type { ClosingIntelligenceResponse } from '../features/closingIntelligence/types'
import type { FiscalPeriodSelection } from '../features/closing/fiscalPeriods'
import { LazyFiscalPeriodExportSection } from '../features/closingExports/lazyFiscalPeriodExportSection'
import type { AnnualClosingRecord, AnnualClosingSummary } from '../features/annualClosing/types'
import {
  getExpenseDocumentSupportStatusLabel,
  getExpenseFiscalRiskLevelLabel,
  getExpenseFiscalReviewStatusLabel,
  type ExpenseListItem,
} from '../features/expenses/types'
import type { InvoiceListItem } from '../features/invoices/types'
import type { JobListItem } from '../features/jobs/types'
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
  jobs: JobListItem[]
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

function getToneClass(tone: 'neutral' | 'warning' | 'danger'): string {
  if (tone === 'danger') return 'cc-quarterly-checklist__item--danger'
  if (tone === 'warning') return 'cc-quarterly-checklist__item--warning'
  return ''
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
  jobs,
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
  const [isDocumentReviewOpen, setIsDocumentReviewOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isGeneratingAiSummary, setIsGeneratingAiSummary] = useState(false)
  const [aiSummaryResult, setAiSummaryResult] = useState<ClosingIntelligenceResponse | null>(null)
  const [aiSummaryError, setAiSummaryError] = useState<string | null>(null)

  useEffect(() => {
    setSelection(initialSelection)
  }, [initialSelection])

  const summary = useMemo(() => buildClosingSummary({
    selection,
    invoices,
    payments,
    expenses,
    quotes,
    jobs,
    quarterlySummaryByPeriod,
    annualSummaryByYear,
  }), [annualSummaryByYear, expenses, invoices, jobs, payments, quarterlySummaryByPeriod, quotes, selection])

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
    setAiSummaryResult(null)
    setAiSummaryError(null)
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
        detail: 'El resumen ya es operativo, pero todavia no se ha persistido el cierre de este preset.',
      }
    }

    if (summary.readiness === 'issues' || persistedClosing.status === 'issues') {
      return {
        label: 'Guardado con incidencias',
        tone: 'warning' as const,
        detail: 'Existe snapshot persistido, pero todavia hay puntos abiertos antes de cerrar con tranquilidad.',
      }
    }

    return {
      label: 'Preparado y guardado',
      tone: 'success' as const,
      detail: 'El preset tiene snapshot persistido y no se detectan incidencias abiertas en el resumen actual.',
    }
  }, [persistedClosing, summary.readiness, summary.snapshotMode])

  const documentReviewCount = summary.missingSupportExpenses.length + summary.pendingReviewExpenses.length + summary.riskExpenses.length
  const topIncidences = summary.incidences.slice(0, 4)
  const fiscalSummary = summary.deterministicSummary
  const topWarnings = fiscalSummary.warnings.slice(0, 4)

  function formatDateTime(value: string | null | undefined): string {
    if (!value) return 'Sin guardar'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Sin guardar'
    return new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date)
  }

  function getConfidenceLabel(value: 'high' | 'medium' | 'low'): string {
    if (value === 'high') return 'Alta'
    if (value === 'medium') return 'Media'
    return 'Baja'
  }

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

  async function handleGenerateAiSummary() {
    if (!summary.snapshotMode) return

    setIsGeneratingAiSummary(true)
    setAiSummaryResult(null)
    setAiSummaryError(null)

    try {
      const result = await generateClosingIntelligenceSummary({
        scope: summary.snapshotMode === 'annual' ? 'annual' : 'quarterly',
        payload: {
          period: fiscalSummary.period,
          deterministicSummary: fiscalSummary,
          warnings: fiscalSummary.warnings,
          readiness: {
            status: fiscalSummary.readiness,
            label: fiscalSummary.readinessLabel,
          },
          confidence: {
            level: fiscalSummary.confidenceLevel,
            notes: fiscalSummary.confidenceNotes,
          },
          missingDataFlags: fiscalSummary.missingDataFlags,
          breakdowns: summary.quarterBreakdown.length > 0 ? { quarters: summary.quarterBreakdown } : null,
          snapshot: persistedClosing
            ? {
                status: persistedClosing.status,
                closed_at: persistedClosing.closed_at,
                updated_at: persistedClosing.updated_at ?? null,
                notes: persistedClosing.notes,
              }
            : null,
        },
      })
      setAiSummaryResult(result)
    } catch (generationError) {
      setAiSummaryError(generationError instanceof Error ? generationError.message : 'No se pudo generar el resumen asistivo.')
    } finally {
      setIsGeneratingAiSummary(false)
    }
  }

  return (
    <section className="dashboard-page">
      <header className="page-header">
        <div>
          <span className="page-header__eyebrow">Cierre fiscal</span>
          <h1>Una sola vista para revisar, validar y exportar el periodo</h1>
          <p>El periodo activo gobierna resumen fiscal, incidencias y decisiones. Revision documental y export viven fuera del lienzo principal.</p>
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

      <section className="cc-dashboard-block">
        <div className="cc-dashboard-block__header">
          <div>
            <h2>Informe del periodo</h2>
            <p>La lectura fiscal y financiera sale de un resumen determinista unico. La IA solo interpreta este bloque, no calcula cifras nuevas.</p>
          </div>
        </div>

        <div className="cc-kpi-grid cc-kpi-grid--compact">
          <article className="cc-kpi-card cc-kpi-card--finance">
            <span className="cc-kpi-label">Facturado</span>
            <strong className="cc-kpi-value">{formatCurrency(fiscalSummary.totalInvoiced)}</strong>
            <p className="cc-kpi-footnote">{fiscalSummary.sourceCounts.invoices} factura(s) en el periodo</p>
          </article>
          <article className="cc-kpi-card">
            <span className="cc-kpi-label">Cobrado</span>
            <strong className="cc-kpi-value">{formatCurrency(fiscalSummary.totalCollected)}</strong>
            <p className="cc-kpi-footnote">{fiscalSummary.sourceCounts.payments} cobro(s) registrados</p>
          </article>
          <article className="cc-kpi-card cc-kpi-card--warning">
            <span className="cc-kpi-label">Pendiente</span>
            <strong className="cc-kpi-value">{formatCurrency(fiscalSummary.totalOutstanding)}</strong>
            <p className="cc-kpi-footnote">{fiscalSummary.pendingInvoicesCount} factura(s) abiertas</p>
          </article>
          <article className="cc-kpi-card">
            <span className="cc-kpi-label">Gastos</span>
            <strong className="cc-kpi-value">{formatCurrency(fiscalSummary.totalExpenses)}</strong>
            <p className="cc-kpi-footnote">{fiscalSummary.sourceCounts.expenses} gasto(s) en el periodo</p>
          </article>
          <article className="cc-kpi-card cc-kpi-card--warning">
            <span className="cc-kpi-label">IVA neto estimado</span>
            <strong className="cc-kpi-value">{formatCurrency(fiscalSummary.estimatedNetVatPayable)}</strong>
            <p className="cc-kpi-footnote">Basado solo en facturas y soporte validado</p>
          </article>
          <article className="cc-kpi-card">
            <span className="cc-kpi-label">Incidencias abiertas</span>
            <strong className="cc-kpi-value">{fiscalSummary.openIncidencesCount}</strong>
            <p className="cc-kpi-footnote">{fiscalSummary.warnings.length} warning(s) estructurados</p>
          </article>
        </div>
      </section>

      <section className="cc-quarterly-pack-grid">
        <article className="cc-quarterly-persistence__card">
          <span className="cc-dashboard-panel__label">Readiness y confianza</span>
          <strong className="cc-kpi-value">{fiscalSummary.readinessLabel}</strong>
          <p className="cc-dashboard-panel__text">Confianza {getConfidenceLabel(fiscalSummary.confidenceLevel).toLowerCase()} · {statusCard.label.toLowerCase()}</p>
          <p className="cc-dashboard-panel__text">
            {fiscalSummary.confidenceNotes[0] ?? statusCard.detail}
          </p>
        </article>

        <article className="cc-quarterly-persistence__card">
          <span className="cc-dashboard-panel__label">Checklist accionable</span>
          <strong className="cc-kpi-value">{fiscalSummary.period.label}</strong>
          <p className="cc-dashboard-panel__text">
            {fiscalSummary.expensesWithoutSupportCount} sin soporte · {fiscalSummary.expensesPendingReviewCount + fiscalSummary.expensesMediumHighRiskCount} en revision o riesgo.
          </p>
          <p className="cc-dashboard-panel__text">
            {fiscalSummary.pendingInvoicesCount} factura(s) pendientes · {fiscalSummary.completedJobsWithoutInvoiceCount} servicio(s) sin factura · {fiscalSummary.acceptedQuotesWithoutJobCount} presupuesto(s) sin convertir.
          </p>
          <p className="cc-dashboard-panel__text">
            Snapshot {persistedClosing ? 'guardado' : 'no guardado'} · Actualizado {formatDateTime(persistedClosing?.updated_at ?? persistedClosing?.closed_at ?? null)}.
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

      {topWarnings.length > 0 || fiscalSummary.missingDataFlags.length > 0 ? (
        <section className="cc-dashboard-block">
          <div className="cc-dashboard-block__header">
            <div>
              <h2>Alertas de cierre</h2>
              <p>Warnings estructurados, datos faltantes y limites reales antes de exportar o pedir interpretacion asistiva.</p>
            </div>
          </div>

          <div className="cc-quarterly-pack-grid">
            <article className="cc-quarterly-persistence__card cc-bounded-list">
              <span className="cc-dashboard-panel__label">Warnings principales</span>
              {topWarnings.length > 0 ? topWarnings.map((warning) => (
                <p key={warning.id} className="cc-dashboard-panel__text">
                  <strong>{warning.title}.</strong> {warning.description}
                </p>
              )) : (
                <p className="cc-dashboard-panel__text">Sin warnings estructurados en el periodo.</p>
              )}
            </article>
            <article className="cc-quarterly-persistence__card cc-bounded-list">
              <span className="cc-dashboard-panel__label">Datos faltantes y limites</span>
              {fiscalSummary.missingDataFlags.length > 0 ? fiscalSummary.missingDataFlags.map((flag) => (
                <p key={flag} className="cc-dashboard-panel__text">{flag}</p>
              )) : (
                <p className="cc-dashboard-panel__text">Sin flags de datos faltantes.</p>
              )}
              {fiscalSummary.insufficientDataNotes.map((note, index) => (
                <p key={`note-${index}`} className="cc-dashboard-panel__text">{note}</p>
              ))}
            </article>
          </div>
        </section>
      ) : null}

      {summary.snapshotMode ? (
        <ClosingAiSummarySection
          title="Interpretacion asistiva del cierre"
          description="La IA recibe el resumen determinista, warnings, readiness, confianza y datos faltantes del periodo activo."
          periodLabel="Periodo"
          periodValueLabel={fiscalSummary.period.label}
          closingStatusLabel={fiscalSummary.readinessLabel}
          isGenerating={isGeneratingAiSummary}
          result={aiSummaryResult}
          error={aiSummaryError}
          onGenerate={handleGenerateAiSummary}
          formatDateTime={formatDateTime}
        />
      ) : null}

      <section className="cc-dashboard-block">
        <div className="cc-dashboard-block__header">
          <div>
            <h2>Acciones del periodo</h2>
            <p>La lectura principal queda en revisar incidencias, resolver soporte y exportar sin repetir el mismo contexto arriba y abajo.</p>
          </div>
        </div>

        <div className="cc-quarterly-pack-grid">
          <article className="cc-quarterly-persistence__card">
            <span className="cc-dashboard-panel__label">Revisar incidencias</span>
            <strong className="cc-dashboard-panel__value">{summary.unresolvedIncidenceCount}</strong>
            <p className="cc-dashboard-panel__text">Abre solo lo que hoy bloquea el cierre o la entrega.</p>
            <div className="cc-action-group">
              {topIncidences.map((incidence) => (
                <button
                  key={incidence.id}
                  type="button"
                  className="secondary-button"
                  onClick={() => onNavigateToIncidence(incidence.view, incidence.scope, selection)}
                >
                  {incidence.label}
                </button>
              ))}
            </div>
          </article>
          <article className="cc-quarterly-persistence__card">
            <span className="cc-dashboard-panel__label">Revision documental</span>
            <strong className="cc-dashboard-panel__value">{documentReviewCount}</strong>
            <p className="cc-dashboard-panel__text">{summary.missingSupportCount} sin soporte · {summary.pendingReviewCount + summary.riskCount} en revision o riesgo fiscal.</p>
            <div className="cc-action-group">
              <button type="button" className="secondary-button" onClick={() => setIsDocumentReviewOpen(true)}>
                Abrir revision documental
              </button>
            </div>
          </article>
          <article className="cc-quarterly-persistence__card">
            <span className="cc-dashboard-panel__label">Exportar</span>
            <strong className="cc-dashboard-panel__value">{summary.period.label}</strong>
            <p className="cc-dashboard-panel__text">El paquete gestor se abre en una surface dedicada y sale del lienzo principal.</p>
            <div className="cc-action-group">
              <button type="button" className="primary-button" onClick={() => setIsExportOpen(true)}>
                Abrir exportacion fiscal
              </button>
            </div>
          </article>
        </div>
      </section>

      {summary.quarterBreakdown.length > 0 ? (
        <section className="cc-dashboard-block">
          <div className="cc-dashboard-block__header">
            <div>
              <h2>Desglose trimestral del ejercicio</h2>
              <p>El cierre anual sigue apoyandose en los cuatro trimestres, pero ya no ocupa una lista larga abierta por defecto.</p>
            </div>
          </div>

          <details className="cc-quarterly-persistence__card">
            <summary className="cc-dashboard-panel__text" style={{ cursor: 'pointer' }}>
              Ver desglose trimestral del ejercicio
            </summary>
            <div className="cc-export-folder-list cc-bounded-list" style={{ marginTop: '0.75rem' }}>
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
          </details>
        </section>
      ) : null}

      <details className="cc-quarterly-persistence__card">
        <summary className="cc-dashboard-panel__text" style={{ cursor: 'pointer' }}>
          Ver incidencias completas del cierre
        </summary>
        <div className="cc-quarterly-checklist" style={{ marginTop: '0.75rem' }}>
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
                  Abrir modulo
                </button>
              </div>
            </article>
          ))}
        </div>
      </details>

      <ActionFlowOverlay
        isOpen={isDocumentReviewOpen}
        title="Revision documental del cierre"
        description="Soportes faltantes y gastos a revisar en una superficie separada del resumen fiscal y de la exportacion."
        onClose={() => setIsDocumentReviewOpen(false)}
      >
        <section className="cc-quarterly-summary-grid">
          <article className="cc-dashboard-block">
            <div className="cc-dashboard-block__header">
              <div>
                <h2>Sin soporte</h2>
                <p>Huecos documentales que siguen bloqueando la entrega limpia del periodo.</p>
              </div>
            </div>

            <div className="cc-export-folder-list cc-bounded-list">
              {summary.missingSupportExpenses.length > 0 ? summary.missingSupportExpenses.map((expense) => (
                <article key={`missing-${expense.id}`} className="cc-export-folder-item">
                  <strong>{expense.display_code ?? expense.supplier_name}</strong>
                  <p>
                    {expense.supplier_name} · {formatDateEs(expense.expense_date)} · {getExpenseDocumentSupportStatusLabel(expense.document_support_status)}
                  </p>
                </article>
              )) : (
                <article className="cc-export-folder-item">
                  <strong>Sin huecos documentales</strong>
                  <p>No se detectan gastos del periodo sin soporte descargable.</p>
                </article>
              )}
            </div>
          </article>

          <article className="cc-dashboard-block">
            <div className="cc-dashboard-block__header">
              <div>
                <h2>Revision y riesgo fiscal</h2>
                <p>Casos que conviene validar antes de compartir el paquete con terceros.</p>
              </div>
            </div>

            <div className="cc-export-folder-list cc-bounded-list">
              {summary.pendingReviewExpenses.length === 0 && summary.riskExpenses.length === 0 ? (
                <article className="cc-export-folder-item">
                  <strong>Sin revision prioritaria</strong>
                  <p>No hay gastos con revision pendiente ni riesgo medio o alto en el periodo activo.</p>
                </article>
              ) : null}

              {summary.pendingReviewExpenses.map((expense) => (
                <article key={`review-${expense.id}`} className="cc-export-folder-item">
                  <strong>{expense.display_code ?? expense.supplier_name}</strong>
                  <p>
                    Revision {getExpenseFiscalReviewStatusLabel(expense.fiscal_review_status)} · riesgo {getExpenseFiscalRiskLevelLabel(expense.ai_fiscal_risk_level ?? expense.fiscal_risk_level).toLowerCase()}
                  </p>
                </article>
              ))}

              {summary.riskExpenses
                .filter((expense) => !summary.pendingReviewExpenses.some((item) => item.id === expense.id))
                .map((expense) => (
                  <article key={`risk-${expense.id}`} className="cc-export-folder-item">
                    <strong>{expense.display_code ?? expense.supplier_name}</strong>
                    <p>
                      Riesgo {getExpenseFiscalRiskLevelLabel(expense.ai_fiscal_risk_level ?? expense.fiscal_risk_level).toLowerCase()} · {formatDateEs(expense.expense_date)}
                    </p>
                  </article>
                ))}
            </div>
          </article>
        </section>
      </ActionFlowOverlay>

      <ActionFlowOverlay
        isOpen={isExportOpen}
        title="Exportar cierre fiscal"
        description="El paquete gestor se prepara fuera de la vista base para no competir con incidencias ni revision documental."
        onClose={() => setIsExportOpen(false)}
      >
        <Suspense
          fallback={(
            <DeferredContentFallback
              title="Cargando runtime de exportacion fiscal"
              description="Preparando el bloque documental externo del periodo."
            />
          )}
        >
          <LazyFiscalPeriodExportSection
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
        </Suspense>
      </ActionFlowOverlay>
    </section>
  )
}
