import { Suspense, useEffect, useMemo, useState } from 'react'
import { ActionFlowOverlay } from '../components/ActionFlowOverlay'
import { ActionChecklist, type ActionChecklistItem } from '../components/ActionChecklist'
import { CollapsibleDetailSection } from '../components/CollapsibleDetailSection'
import { DeferredContentFallback } from '../components/DeferredContentFallback'
import { ExecutiveHeader } from '../components/ExecutiveHeader'
import { InsightPanel } from '../components/InsightPanel'
import { ProgressMetric } from '../components/ProgressMetric'
import { SeverityBadge, type SeverityTone } from '../components/SeverityBadge'
import { VisualKpiCard } from '../components/VisualKpiCard'
import { formatCurrency, formatDateEs } from '../app/displayFormat'
import { ClosingAiSummarySection } from '../features/closing/ClosingAiSummarySection'
import { FiscalPeriodSelector } from '../features/closing/FiscalPeriodSelector'
import {
  buildClosingSummary,
  type ClosingIncidenceScope,
  type ClosingIncidenceView,
} from '../features/closing/closingSummaryEngine'
import type { ClosingDeterministicWarning } from '../features/closing/closingDeterministicSummary'
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

function getReadinessTone(readiness: string): SeverityTone {
  if (readiness === 'ready') return 'success'
  if (readiness === 'ready_with_review') return 'warning'
  return 'critical'
}

function getConfidenceLabel(value: 'high' | 'medium' | 'low'): string {
  if (value === 'high') return 'Alta'
  if (value === 'medium') return 'Media'
  return 'Baja'
}

function getConfidenceTone(value: 'high' | 'medium' | 'low'): SeverityTone {
  if (value === 'high') return 'success'
  if (value === 'medium') return 'warning'
  return 'critical'
}

function getWarningSeverityLabel(value: 'critical' | 'warning' | 'info'): string {
  if (value === 'critical') return 'Critico'
  if (value === 'warning') return 'Requiere revision'
  return 'Informativo'
}

function getMissingDataFlagLabel(flag: string): string {
  if (flag === 'no_hours_module') return 'No existe modulo fiable de horas reales'
  if (flag === 'no_payroll_module') return 'No existe modulo fiable de payroll real'
  if (flag === 'missing_expense_support') return 'Faltan soportes documentales en gastos'
  if (flag === 'pending_expense_review') return 'Hay gastos pendientes de revision fiscal'
  if (flag === 'missing_snapshot') return 'Todavia no hay snapshot persistido para este preset'
  if (flag === 'insufficient_period_data') return 'El periodo no tiene base suficiente para una lectura solida'
  if (flag === 'unverified_vat_deductibility') return 'La deducibilidad del IVA sigue sin validacion definitiva'
  return flag
}

function getWarningNavigationTarget(
  warning: ClosingDeterministicWarning,
): { view: ClosingIncidenceView; scope: ClosingIncidenceScope } | null {
  if (warning.targetView === 'expenses') {
    if (warning.id === 'missing-expense-support' || warning.id === 'missing-valid-vat-invoice') {
      return { view: 'expenses', scope: 'missing_support' }
    }

    if (warning.id === 'pending-expense-review' || warning.id === 'expense-risk') {
      return { view: 'expenses', scope: 'pending_review' }
    }

    return { view: 'expenses', scope: 'all' }
  }

  if (warning.targetView === 'invoices') {
    return { view: 'invoices', scope: 'pending' }
  }

  return null
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
  const closureExpenseCount = fiscalSummary.sourceCounts.closureExpenses
  const supportedExpenseCount = Math.max(closureExpenseCount - fiscalSummary.expensesWithoutSupportCount, 0)
  const supportCoveragePercent = closureExpenseCount > 0 ? Math.round((supportedExpenseCount / closureExpenseCount) * 100) : 100
  const warningTone = topWarnings.some((warning) => warning.severity === 'critical')
    ? 'critical'
    : topWarnings.some((warning) => warning.severity === 'warning')
      ? 'warning'
      : 'info'

  function formatDateTime(value: string | null | undefined): string {
    if (!value) return 'Sin guardar'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Sin guardar'
    return new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date)
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

  const checklistItems: ActionChecklistItem[] = [
    {
      id: 'snapshot',
      state: persistedClosing ? 'done' as const : summary.snapshotMode ? 'warning' as const : 'info' as const,
      label: persistedClosing ? 'Snapshot guardado' : summary.snapshotMode ? 'Guardar snapshot del periodo' : 'Rango exploratorio',
      description: persistedClosing
        ? `Actualizado ${formatDateTime(persistedClosing.updated_at ?? persistedClosing.closed_at ?? null)}.`
        : summary.snapshotMode
          ? 'El resumen ya existe, pero todavia no se ha persistido este preset.'
          : 'Mes y rango personalizado usan el resumen determinista sin snapshot persistido.',
      action: summary.snapshotMode && !persistedClosing ? {
        label: summary.snapshotMode === 'quarterly' ? 'Guardar snapshot' : 'Guardar snapshot anual',
        onClick: handleSaveSnapshot,
      } : undefined,
    },
    {
      id: 'support',
      state: fiscalSummary.expensesWithoutSupportCount > 0 ? 'critical' as const : 'done' as const,
      label: fiscalSummary.expensesWithoutSupportCount > 0 ? 'Completar soportes de gasto' : 'Soporte documental cubierto',
      description: fiscalSummary.expensesWithoutSupportCount > 0
        ? `${fiscalSummary.expensesWithoutSupportCount} gasto(s) siguen sin soporte descargable.`
        : 'No se detectan huecos documentales en el periodo.',
      action: fiscalSummary.expensesWithoutSupportCount > 0 ? {
        label: 'Abrir revision documental',
        onClick: () => setIsDocumentReviewOpen(true),
      } : undefined,
    },
    {
      id: 'fiscal-review',
      state: fiscalSummary.expensesPendingReviewCount + fiscalSummary.expensesMediumHighRiskCount > 0 ? 'warning' as const : 'done' as const,
      label: fiscalSummary.expensesPendingReviewCount + fiscalSummary.expensesMediumHighRiskCount > 0
        ? 'Cerrar revision fiscal pendiente'
        : 'Revision fiscal sin alertas principales',
      description: `${fiscalSummary.expensesPendingReviewCount} pendiente(s) de revision y ${fiscalSummary.expensesMediumHighRiskCount} con riesgo medio o alto.`,
      action: fiscalSummary.expensesPendingReviewCount + fiscalSummary.expensesMediumHighRiskCount > 0 ? {
        label: 'Abrir gastos',
        onClick: () => onNavigateToIncidence('expenses', 'pending_review', selection),
      } : undefined,
    },
    {
      id: 'collections',
      state: fiscalSummary.pendingInvoicesCount + fiscalSummary.completedJobsWithoutInvoiceCount > 0 ? 'warning' as const : 'done' as const,
      label: fiscalSummary.pendingInvoicesCount + fiscalSummary.completedJobsWithoutInvoiceCount > 0
        ? 'Resolver cobro o facturacion pendiente'
        : 'Cobro y facturacion sin bloqueos principales',
      description: `${fiscalSummary.pendingInvoicesCount} factura(s) abiertas y ${fiscalSummary.completedJobsWithoutInvoiceCount} servicio(s) sin factura.`,
      action: fiscalSummary.pendingInvoicesCount + fiscalSummary.completedJobsWithoutInvoiceCount > 0 ? {
        label: 'Abrir incidencias',
        onClick: () => onNavigateToIncidence('invoices', 'pending', selection),
      } : undefined,
    },
  ].slice(0, 5)

  return (
    <section className="dashboard-page">
      <ExecutiveHeader
        eyebrow="Cierre fiscal"
        title="Centro de cierre del periodo"
        summary="Estado, IVA neto estimado, cobertura documental y siguientes pasos en una sola lectura. La revision documental y la exportacion viven fuera del lienzo principal."
        statusLabel={fiscalSummary.readinessLabel}
        statusTone={getReadinessTone(fiscalSummary.readiness)}
        primaryAction={{
          label: 'Abrir revision documental',
          onClick: () => setIsDocumentReviewOpen(true),
        }}
        secondaryAction={{
          label: 'Abrir exportacion fiscal',
          onClick: () => setIsExportOpen(true),
        }}
        metricLabel="Periodo activo"
        metricValue={fiscalSummary.period.label}
        metricHint={`Confianza ${getConfidenceLabel(fiscalSummary.confidenceLevel).toLowerCase()} y snapshot ${persistedClosing ? 'guardado' : 'pendiente'}.`}
      >
        <InsightPanel
          title="Lectura rapida"
          tone={getReadinessTone(fiscalSummary.readiness)}
          insight={fiscalSummary.readinessLabel}
          implication={fiscalSummary.confidenceNotes[0] ?? statusCard.detail}
          action={topWarnings[0]?.recommendedAction ?? 'Revisar checklist, resolver bloqueos y validar antes de exportar.'}
        />
      </ExecutiveHeader>

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
          <VisualKpiCard
            label="Facturado"
            value={formatCurrency(fiscalSummary.totalInvoiced)}
            hint={`${fiscalSummary.sourceCounts.invoices} factura(s) en el periodo`}
            tone="info"
            priority="compact"
          />
          <VisualKpiCard
            label="Cobrado"
            value={formatCurrency(fiscalSummary.totalCollected)}
            hint={`${fiscalSummary.sourceCounts.payments} cobro(s) registrados`}
            tone="success"
            priority="compact"
          />
          <VisualKpiCard
            label="Pendiente"
            value={formatCurrency(fiscalSummary.totalOutstanding)}
            hint={`${fiscalSummary.pendingInvoicesCount} factura(s) abiertas`}
            tone={fiscalSummary.pendingInvoicesCount > 0 ? 'warning' : 'neutral'}
            priority="compact"
            badgeLabel={fiscalSummary.pendingInvoicesCount > 0 ? 'Seguimiento' : 'Controlado'}
          />
          <VisualKpiCard
            label="Gastos"
            value={formatCurrency(fiscalSummary.totalExpenses)}
            hint={`${fiscalSummary.sourceCounts.expenses} gasto(s) en el periodo`}
            tone="neutral"
            priority="compact"
          />
          <VisualKpiCard
            label="IVA neto estimado"
            value={formatCurrency(fiscalSummary.estimatedNetVatPayable)}
            hint="Basado solo en facturas y soporte validado"
            tone={fiscalSummary.readiness === 'ready' ? 'success' : 'warning'}
            priority="compact"
          />
          <VisualKpiCard
            label="Incidencias abiertas"
            value={String(fiscalSummary.openIncidencesCount)}
            hint={`${fiscalSummary.warnings.length} warning(s) estructurados`}
            tone={fiscalSummary.openIncidencesCount > 0 ? warningTone : 'neutral'}
            priority="compact"
            badgeLabel={fiscalSummary.openIncidencesCount > 0 ? 'Activas' : 'Limpio'}
          />
        </div>
      </section>

      <section className="cc-quarterly-pack-grid">
        <article className="cc-quarterly-persistence__card">
          <span className="cc-dashboard-panel__label">Readiness y confianza</span>
          <div className="cc-action-group" style={{ alignItems: 'center' }}>
            <strong className="cc-kpi-value">{fiscalSummary.readinessLabel}</strong>
            <SeverityBadge label={`Confianza ${getConfidenceLabel(fiscalSummary.confidenceLevel)}`} tone={getConfidenceTone(fiscalSummary.confidenceLevel)} />
          </div>
          <p className="cc-dashboard-panel__text">{statusCard.detail}</p>
          <div className="cc-quarterly-checklist">
            <ProgressMetric
              label="Cobertura documental"
              value={String(supportedExpenseCount)}
              max={String(closureExpenseCount)}
              percent={supportCoveragePercent}
              tone={supportCoveragePercent >= 100 ? 'success' : supportCoveragePercent >= 70 ? 'warning' : 'critical'}
              hint={closureExpenseCount > 0 ? 'Basada en gastos que afectan al cierre del periodo.' : 'No hay gastos de cierre en este periodo.'}
            />
            <ProgressMetric
              label="Cierre listo para revision"
              value={`${Math.max(0, 100 - Math.min(fiscalSummary.openIncidencesCount * 12, 100))}%`}
              percent={Math.max(0, 100 - Math.min(fiscalSummary.openIncidencesCount * 12, 100))}
              tone={getReadinessTone(fiscalSummary.readiness)}
              hint="Indicador visual interno basado en incidencias abiertas y soporte del periodo."
            />
          </div>
        </article>

        <article className="cc-quarterly-persistence__card">
          <span className="cc-dashboard-panel__label">Checklist accionable</span>
          <ActionChecklist items={checklistItems} compact />
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
              {topWarnings.length > 0 ? (
                <ActionChecklist
                  compact
                  items={topWarnings.map((warning) => ({
                    id: warning.id,
                    state: warning.severity === 'critical' ? 'critical' : warning.severity === 'warning' ? 'warning' : 'info',
                    label: `${getWarningSeverityLabel(warning.severity)} · ${warning.title}`,
                    description: `${warning.description} ${warning.recommendedAction}`,
                    action: getWarningNavigationTarget(warning) ? {
                      label: 'Abrir modulo',
                      onClick: () => {
                        const target = getWarningNavigationTarget(warning)
                        if (!target) return
                        onNavigateToIncidence(target.view, target.scope, selection)
                      },
                    } : undefined,
                  }))}
                />
              ) : <p className="cc-dashboard-panel__text">Sin warnings estructurados en el periodo.</p>}
            </article>
            <article className="cc-quarterly-persistence__card cc-bounded-list">
              <span className="cc-dashboard-panel__label">Datos faltantes y limites</span>
              {fiscalSummary.missingDataFlags.length > 0 ? (
                <div className="cc-quarterly-checklist">
                  {fiscalSummary.missingDataFlags.map((flag) => (
                    <div key={flag} className="cc-action-group" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="cc-dashboard-panel__text">{getMissingDataFlagLabel(flag)}</span>
                      <SeverityBadge
                        label={flag === 'no_hours_module' || flag === 'no_payroll_module' ? 'Limite real' : 'Afecta analisis'}
                        tone={flag === 'missing_expense_support' || flag === 'insufficient_period_data' ? 'critical' : 'warning'}
                      />
                    </div>
                  ))}
                </div>
              ) : <p className="cc-dashboard-panel__text">Sin flags de datos faltantes.</p>}
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

          <CollapsibleDetailSection title="Ver desglose trimestral del ejercicio" count={summary.quarterBreakdown.length} tone="info">
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
          </CollapsibleDetailSection>
        </section>
      ) : null}

      <CollapsibleDetailSection title="Ver incidencias completas del cierre" count={summary.incidences.length} tone={summary.unresolvedIncidenceCount > 0 ? 'warning' : 'neutral'}>
        <div className="cc-quarterly-checklist" style={{ marginTop: '0.25rem' }}>
          {summary.incidences.map((incidence) => (
            <article key={incidence.id} className="cc-quarterly-checklist__item">
              <div style={{ display: 'grid', gap: '0.45rem' }}>
                <div className="cc-action-group" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{incidence.label}</strong>
                  <SeverityBadge
                    label={incidence.count > 0 ? `${incidence.count}` : '0'}
                    tone={incidence.tone === 'danger' ? 'critical' : incidence.tone === 'warning' ? 'warning' : 'info'}
                  />
                </div>
                <p>{incidence.detail}</p>
              </div>
              <div className="cc-action-group">
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
      </CollapsibleDetailSection>

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
