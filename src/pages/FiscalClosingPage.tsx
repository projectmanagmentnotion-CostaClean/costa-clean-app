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
  if (flag === 'missing_expense_support') return 'Documentacion pendiente'
  if (flag === 'pending_expense_review') return 'Gastos pendientes de revision fiscal'
  if (flag === 'missing_snapshot') return 'Snapshot todavia no guardado'
  if (flag === 'insufficient_period_data') return 'El periodo no tiene base suficiente para una lectura solida'
  if (flag === 'unverified_vat_deductibility') return 'Validacion IVA pendiente'
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
        detail: 'Mes y rango personalizado usan el mismo motor de cierre, pero no generan snapshot persistido.',
      }
    }

    if (!persistedClosing) {
      return {
        label: 'Sin snapshot guardado',
        detail: 'El resumen ya es operativo, pero todavia no se ha persistido el cierre de este preset.',
      }
    }

    if (summary.readiness === 'issues' || persistedClosing.status === 'issues') {
      return {
        label: 'Guardado con incidencias',
        detail: 'Existe snapshot persistido, pero todavia hay puntos abiertos antes de cerrar con tranquilidad.',
      }
    }

    return {
      label: 'Preparado y guardado',
      detail: 'El preset tiene snapshot persistido y no se detectan incidencias abiertas en el resumen actual.',
    }
  }, [persistedClosing, summary.readiness, summary.snapshotMode])

  const topIncidences = summary.incidences.slice(0, 4)
  const fiscalSummary = summary.deterministicSummary
  const topWarnings = fiscalSummary.warnings.slice(0, 4)
  const closureExpenseCount = fiscalSummary.sourceCounts.closureExpenses
  const supportedExpenseCount = Math.max(closureExpenseCount - fiscalSummary.expensesWithoutSupportCount, 0)
  const supportCoveragePercent = closureExpenseCount > 0 ? Math.round((supportedExpenseCount / closureExpenseCount) * 100) : 100
  const readinessCriteria = [
    summary.snapshotMode ? Number(Boolean(persistedClosing)) : 1,
    Number(fiscalSummary.expensesWithoutSupportCount === 0),
    Number(summary.missingValidVatInvoiceCount === 0),
    Number(fiscalSummary.expensesPendingReviewCount + fiscalSummary.expensesMediumHighRiskCount === 0),
    Number(fiscalSummary.pendingInvoicesCount === 0),
    Number(fiscalSummary.completedJobsWithoutInvoiceCount === 0),
  ]
  const readinessPercent = Math.round((readinessCriteria.reduce((sum, value) => sum + value, 0) / readinessCriteria.length) * 100)
  const dominantReviewTone: SeverityTone = summary.criticalIncidenceCount > 0 ? 'critical' : summary.unresolvedIncidenceCount > 0 ? 'warning' : 'success'
  const mainCta = summary.unresolvedIncidenceCount > 0
    ? {
        label: 'Revisar pendientes',
        onClick: () => {
          const primaryIncidence = topIncidences[0]
          if (!primaryIncidence) {
            setIsDocumentReviewOpen(true)
            return
          }
          onNavigateToIncidence(primaryIncidence.view, primaryIncidence.scope, selection)
        },
      }
    : {
        label: 'Preparar paquete fiscal',
        onClick: () => setIsExportOpen(true),
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
      id: 'invoices',
      state: fiscalSummary.sourceCounts.invoices > 0 ? 'done' : 'info',
      label: 'Facturas incluidas',
      description: `${fiscalSummary.sourceCounts.invoices} factura(s) entran en el periodo activo.`,
      action: fiscalSummary.sourceCounts.invoices > 0 ? {
        label: 'Abrir facturas',
        onClick: () => onNavigateToIncidence('invoices', 'all', selection),
      } : undefined,
    },
    {
      id: 'payments',
      state: fiscalSummary.sourceCounts.payments > 0 ? 'done' : 'info',
      label: 'Cobros incluidos',
      description: `${fiscalSummary.sourceCounts.payments} cobro(s) registrados en el periodo.`,
      action: fiscalSummary.sourceCounts.payments > 0 ? {
        label: 'Abrir cobros',
        onClick: () => onNavigateToIncidence('payments', 'all', selection),
      } : undefined,
    },
    {
      id: 'expenses',
      state: closureExpenseCount > 0 ? 'done' : 'info',
      label: 'Gastos incluidos',
      description: `${closureExpenseCount} gasto(s) afectan al cierre de este periodo.`,
      action: closureExpenseCount > 0 ? {
        label: 'Abrir gastos',
        onClick: () => onNavigateToIncidence('expenses', 'closure', selection),
      } : undefined,
    },
    {
      id: 'downloadable-support',
      state: fiscalSummary.expensesWithoutSupportCount > 0 ? 'pending' : 'done',
      label: 'Soportes descargables',
      description: `${supportedExpenseCount} de ${closureExpenseCount} gastos de cierre tienen soporte utilizable.`,
      action: closureExpenseCount > 0 ? {
        label: 'Abrir revision documental',
        onClick: () => setIsDocumentReviewOpen(true),
      } : undefined,
    },
    {
      id: 'support',
      state: fiscalSummary.expensesWithoutSupportCount > 0 ? 'critical' : 'done',
      label: fiscalSummary.expensesWithoutSupportCount > 0 ? 'Soportes pendientes' : 'Sin soportes pendientes',
      description: fiscalSummary.expensesWithoutSupportCount > 0
        ? `${fiscalSummary.expensesWithoutSupportCount} gasto(s) siguen sin soporte descargable.`
        : 'No se detectan huecos documentales en el periodo.',
      action: fiscalSummary.expensesWithoutSupportCount > 0 ? {
        label: 'Abrir revision documental',
        onClick: () => setIsDocumentReviewOpen(true),
      } : undefined,
    },
    {
      id: 'vat-support',
      state: summary.missingValidVatInvoiceCount > 0 ? 'warning' : 'done',
      label: summary.missingValidVatInvoiceCount > 0 ? 'Validacion IVA pendiente' : 'Soporte IVA suficiente',
      description: summary.missingValidVatInvoiceCount > 0
        ? `${summary.missingValidVatInvoiceCount} gasto(s) siguen sin soporte IVA valido.`
        : 'No hay gastos pendientes de validar para el IVA estimado.',
      action: summary.missingValidVatInvoiceCount > 0 ? {
        label: 'Abrir gastos',
        onClick: () => onNavigateToIncidence('expenses', 'missing_support', selection),
      } : undefined,
    },
    {
      id: 'snapshot',
      state: persistedClosing ? 'done' : summary.snapshotMode ? 'warning' : 'info',
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
  ]

  return (
    <section className="dashboard-page cc-fiscal-closing-page">
      <ExecutiveHeader
        eyebrow="Cierre fiscal"
        title="Centro de cierre del periodo"
        summary="Estado del periodo, preparacion interna, IVA a ingresar estimado y siguientes pasos en una sola lectura. Requiere validacion profesional antes de tratarlo como cierre definitivo."
        statusLabel={fiscalSummary.readinessLabel}
        statusTone={getReadinessTone(fiscalSummary.readiness)}
        primaryAction={mainCta}
        secondaryAction={{
          label: 'Abrir exportacion fiscal',
          onClick: () => setIsExportOpen(true),
        }}
        metricLabel="IVA a ingresar estimado"
        metricValue={formatCurrency(fiscalSummary.estimatedNetVatPayable)}
        metricHint="IVA repercutido menos IVA deducible estimado. Requiere validacion profesional."
      >
        <div className="cc-fiscal-closing-header-progress">
          <ProgressMetric
            label="Preparacion interna"
            value={`${readinessPercent}%`}
            percent={readinessPercent}
            tone={getReadinessTone(fiscalSummary.readiness)}
            hint="Indicador interno basado en snapshot, soporte, validacion IVA y pendientes reales."
          />
          <InsightPanel
            title="Lectura rapida"
            tone={getReadinessTone(fiscalSummary.readiness)}
            insight={`${fiscalSummary.period.label} · ${fiscalSummary.readinessLabel}`}
            implication={fiscalSummary.confidenceNotes[0] ?? statusCard.detail}
            action={topWarnings[0]?.recommendedAction ?? 'Revisar checklist, resolver bloqueos y validar antes de exportar.'}
          />
        </div>
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
            <h2>Lectura principal del cierre</h2>
            <p>Tres tarjetas dominan la pantalla: estado del paquete, IVA a ingresar estimado y elementos por revisar.</p>
          </div>
        </div>

        <div className="cc-fiscal-closing-primary-grid">
          <VisualKpiCard
            label="Estado del paquete"
            value={fiscalSummary.readinessLabel}
            hint={statusCard.detail}
            tone={getReadinessTone(fiscalSummary.readiness)}
            priority="primary"
            badgeLabel="Preparacion interna"
            className="cc-fiscal-closing-card--state"
            action={{ label: mainCta.label, onClick: mainCta.onClick }}
            progress={{
              label: 'Preparacion',
              value: `${readinessPercent}%`,
              percent: readinessPercent,
              hint: 'Indicador interno basado en snapshot, soporte, revision y pendientes.',
            }}
          >
            <p className="cc-fiscal-closing-card__note">
              Confianza {getConfidenceLabel(fiscalSummary.confidenceLevel).toLowerCase()} y snapshot {persistedClosing ? 'guardado' : 'pendiente'}.
            </p>
          </VisualKpiCard>

          <VisualKpiCard
            label="IVA a ingresar estimado"
            value={formatCurrency(fiscalSummary.estimatedNetVatPayable)}
            hint="IVA repercutido menos IVA deducible estimado."
            tone={summary.missingValidVatInvoiceCount > 0 ? 'warning' : 'success'}
            priority="primary"
            badgeLabel="Estimado"
            className="cc-fiscal-closing-card--vat"
          >
            <p className="cc-fiscal-closing-card__note">No es un importe definitivo. Requiere validacion profesional.</p>
          </VisualKpiCard>

          <VisualKpiCard
            label="Elementos por revisar"
            value={String(summary.unresolvedIncidenceCount)}
            hint={`${topWarnings.length} warning(s) principales y ${fiscalSummary.missingDataFlags.length} limite(s) visibles.`}
            tone={dominantReviewTone}
            priority="primary"
            badgeLabel={dominantReviewTone === 'critical' ? 'Dominan bloqueos' : summary.unresolvedIncidenceCount > 0 ? 'Revision abierta' : 'Controlado'}
            className="cc-fiscal-closing-card--review"
            action={{ label: 'Revisar pendientes', onClick: mainCta.onClick }}
          >
            <div className="cc-fiscal-closing-card__split">
              <strong>{fiscalSummary.expensesWithoutSupportCount} sin soporte · {summary.missingValidVatInvoiceCount} sin soporte IVA.</strong>
              <strong>{fiscalSummary.pendingInvoicesCount} factura(s) pendientes · {fiscalSummary.completedJobsWithoutInvoiceCount} servicio(s) sin factura.</strong>
            </div>
          </VisualKpiCard>
        </div>
      </section>

      <section className="cc-dashboard-block">
        <div className="cc-dashboard-block__header">
          <div>
            <h2>Metricas secundarias</h2>
            <p>Contexto financiero y documental de apoyo con menos peso visual que el estado, el IVA estimado y los pendientes.</p>
          </div>
        </div>

        <div className="cc-fiscal-closing-secondary-grid">
          <VisualKpiCard
            label="IVA repercutido"
            value={formatCurrency(fiscalSummary.outputVatTotal)}
            hint="IVA salido de facturas del periodo."
            tone="info"
            priority="compact"
          />
          <VisualKpiCard
            label="IVA deducible estimado"
            value={formatCurrency(fiscalSummary.estimatedDeductibleVat)}
            hint="Estimado solo con soporte disponible y revision interna."
            tone="success"
            priority="compact"
          />
          <VisualKpiCard
            label="Cobertura documental"
            value={`${Math.round(summary.closureDocumentCoverageRate)}%`}
            hint="Soportes descargables sobre gastos que afectan al cierre."
            tone={supportCoveragePercent >= 100 ? 'success' : supportCoveragePercent >= 70 ? 'warning' : 'critical'}
            priority="compact"
            className="cc-fiscal-closing-support-card"
            progress={{
              label: 'Cobertura',
              value: String(supportedExpenseCount),
              max: String(closureExpenseCount),
              percent: summary.closureDocumentCoverageRate,
              hint: closureExpenseCount > 0 ? 'Progreso real sobre gastos de cierre.' : 'No hay gastos de cierre en este periodo.',
            }}
          />
          <VisualKpiCard
            label="Facturas incluidas"
            value={String(fiscalSummary.sourceCounts.invoices)}
            hint="Base de facturacion incluida en el calculo."
            tone="info"
            priority="compact"
          />
          <VisualKpiCard
            label="Cobros incluidos"
            value={String(fiscalSummary.sourceCounts.payments)}
            hint="Cobros con fecha dentro del periodo activo."
            tone="success"
            priority="compact"
          />
          <VisualKpiCard
            label="Gastos incluidos"
            value={String(closureExpenseCount)}
            hint="Gastos marcados como relevantes para este cierre."
            tone="neutral"
            priority="compact"
          />
          <VisualKpiCard
            label="Gastos sin soporte IVA"
            value={String(summary.missingValidVatInvoiceCount)}
            hint="Registros que todavia no sostienen la deducibilidad estimada."
            tone={summary.missingValidVatInvoiceCount > 0 ? 'warning' : 'success'}
            priority="compact"
            badgeLabel={summary.missingValidVatInvoiceCount > 0 ? 'Pendiente' : 'Cubierto'}
          />
        </div>
      </section>

      <section className="cc-fiscal-closing-two-column">
        <article className="cc-dashboard-block">
          <div className="cc-dashboard-block__header">
            <div>
              <h2>Checklist de cierre</h2>
              <p>Facturas, cobros, gastos, soportes, validacion IVA y estado del snapshot en una sola columna accionable.</p>
            </div>
          </div>
          <div className="cc-quarterly-persistence__card">
            <ActionChecklist items={checklistItems} compact />
          </div>
        </article>

        <article className="cc-dashboard-block">
          <div className="cc-dashboard-block__header">
            <div>
              <h2>Warnings que dominan</h2>
              <p>Lo critico se resume arriba. El detalle completo queda colapsado para no competir con el primer nivel.</p>
            </div>
          </div>
          <div className="cc-quarterly-persistence__card cc-bounded-list">
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

            {fiscalSummary.missingDataFlags.length > 0 ? (
              <div className="cc-fiscal-closing-inline-list">
                {fiscalSummary.missingDataFlags.map((flag) => (
                  <div key={flag} className="cc-fiscal-closing-inline-item">
                    <span className="cc-dashboard-panel__text">{getMissingDataFlagLabel(flag)}</span>
                    <SeverityBadge
                      label={flag === 'no_hours_module' || flag === 'no_payroll_module' ? 'Limite real' : 'Afecta analisis'}
                      tone={flag === 'missing_expense_support' || flag === 'insufficient_period_data' ? 'critical' : 'warning'}
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </article>
      </section>

      <section className="cc-quarterly-pack-grid">
        <article className="cc-quarterly-persistence__card">
          <span className="cc-dashboard-panel__label">Preparacion y contexto</span>
          <div className="cc-action-group" style={{ alignItems: 'center' }}>
            <strong className="cc-dashboard-panel__value">{fiscalSummary.period.label}</strong>
            <SeverityBadge label={`Confianza ${getConfidenceLabel(fiscalSummary.confidenceLevel)}`} tone={getConfidenceTone(fiscalSummary.confidenceLevel)} />
          </div>
          <p className="cc-dashboard-panel__text">Preparacion interna {readinessPercent}% · cobertura documental {Math.round(summary.closureDocumentCoverageRate)}%.</p>
          <div className="cc-quarterly-checklist">
            <ProgressMetric
              label="Preparacion interna"
              value={`${readinessPercent}%`}
              percent={readinessPercent}
              tone={getReadinessTone(fiscalSummary.readiness)}
              hint="Indicador interno basado solo en datos ya disponibles."
            />
            <ProgressMetric
              label="Cobertura documental"
              value={`${Math.round(summary.closureDocumentCoverageRate)}%`}
              percent={summary.closureDocumentCoverageRate}
              tone={supportCoveragePercent >= 100 ? 'success' : supportCoveragePercent >= 70 ? 'warning' : 'critical'}
              hint="Mide soportes disponibles sobre gastos que afectan al cierre."
            />
          </div>
        </article>

        <article className="cc-quarterly-persistence__card">
          <span className="cc-dashboard-panel__label">Paquete y snapshot</span>
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
            <button type="button" className="secondary-button" onClick={() => setIsExportOpen(true)}>
              Preparar paquete fiscal
            </button>
          </div>
          {saveMessage ? <p className="cc-dashboard-panel__text">{saveMessage}</p> : null}
          {saveError ? <p className="cc-dashboard-panel__text">{saveError}</p> : null}
        </article>
      </section>

      {fiscalSummary.insufficientDataNotes.length > 0 ? (
        <CollapsibleDetailSection title="Datos insuficientes" count={fiscalSummary.insufficientDataNotes.length} tone="critical">
          <div className="cc-quarterly-checklist">
            {fiscalSummary.insufficientDataNotes.map((note, index) => (
              <p key={`note-${index}`} className="cc-dashboard-panel__text">{note}</p>
            ))}
          </div>
        </CollapsibleDetailSection>
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
