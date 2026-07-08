import { Suspense, useEffect, useMemo, useState } from 'react'
import { ActionFlowOverlay } from '../components/ActionFlowOverlay'
import { ActionChecklist, type ActionChecklistItem } from '../components/ActionChecklist'
import { CollapsibleDetailSection } from '../components/CollapsibleDetailSection'
import { DeferredContentFallback } from '../components/DeferredContentFallback'
import { ExecutiveHeader } from '../components/ExecutiveHeader'
import { ProgressMetric } from '../components/ProgressMetric'
import { SeverityBadge, type SeverityTone } from '../components/SeverityBadge'
import { VisualKpiCard } from '../components/VisualKpiCard'
import { formatCurrency, formatDateEs } from '../app/displayFormat'
import { DSErrorState } from '../design-system/components/DSErrorState'
import { ClosingAiSummarySection } from '../features/closing/ClosingAiSummarySection'
import { FiscalPeriodSelector } from '../features/closing/FiscalPeriodSelector'
import {
  buildClosingSummary,
  type ClosingIncidenceScope,
  type ClosingIncidenceView,
} from '../features/closing/closingSummaryEngine'
import type { ClosingDeterministicWarning } from '../features/closing/closingDeterministicSummary'
import {
  buildFiscalSemesterAuditSummary,
  buildSecondSemesterSelection,
} from '../features/closing/fiscalSemesterAudit'
import { generateClosingIntelligenceSummary } from '../features/closingIntelligence/closingIntelligenceApi'
import type { ClosingIntelligenceResponse } from '../features/closingIntelligence/types'
import type { FiscalPeriodSelection } from '../features/closing/fiscalPeriods'
import { buildFiscalPeriodExportData } from '../features/closingExports/fiscalPeriodExport'
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

function getAuditTone(input: { invoiceCount: number; reviewCount: number }): SeverityTone {
  if (input.reviewCount > 0) return 'warning'
  if (input.invoiceCount === 0) return 'info'
  return 'success'
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
  const integralReportData = useMemo(
    () => buildFiscalPeriodExportData({
      selection,
      invoices,
      payments,
      expenses,
      quotes,
    }),
    [expenses, invoices, payments, quotes, selection],
  )
  const semesterAudit = useMemo(
    () => buildFiscalSemesterAuditSummary({
      year: selection.year,
      invoices,
      payments,
      clients,
    }),
    [clients, invoices, payments, selection.year],
  )
  const semesterAuditSelection = useMemo(
    () => buildSecondSemesterSelection(selection.year),
    [selection.year],
  )
  const semesterAuditTone = useMemo(
    () => getAuditTone({
      invoiceCount: semesterAudit.totals.invoiceCount,
      reviewCount: semesterAudit.reviewItems.length,
    }),
    [semesterAudit.reviewItems.length, semesterAudit.totals.invoiceCount],
  )
  const semesterAuditHeadline = semesterAudit.totals.invoiceCount > 0
    ? `${semesterAudit.totals.invoiceCount} factura(s) emitidas incluidas`
    : `Sin facturas emitidas del ${semesterAudit.period.startDate} al ${semesterAudit.period.endDate}`
  const semesterAuditAlert = semesterAudit.reviewItems[0]?.message
    ?? (semesterAudit.excludedInvoices[0] ? `${semesterAudit.excludedInvoices[0].reference}: ${semesterAudit.excludedInvoices[0].reason}` : null)
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
        title="Importe real del segundo semestre"
        summary="Primero muestra la cifra real emitida del periodo. El resto queda plegado o fuera del flujo principal."
        statusLabel={semesterAudit.period.label}
        statusTone={semesterAuditTone}
        primaryAction={{
          label: 'Ver facturas incluidas',
          onClick: () => onNavigateToIncidence('invoices', 'all', semesterAuditSelection),
        }}
        secondaryAction={{
          label: mainCta.label,
          onClick: mainCta.onClick,
        }}
        metricLabel="Total facturado real"
        metricValue={formatCurrency(semesterAudit.totals.totalAmount)}
        metricHint={semesterAuditHeadline}
        metricDataQa="fiscal-real-amount"
      />

      {error ? (
        <DSErrorState title="No se pudo cargar la base del cierre" description={error} />
      ) : null}

      <section className="cc-dashboard-block">
        <div className="cc-dashboard-block__header">
          <div>
            <h2>Lectura fiscal real</h2>
            <p>{semesterAuditHeadline}</p>
          </div>
        </div>

        <div className="cc-fiscal-closing-primary-grid">
          <VisualKpiCard
            label="Total facturado"
            value={formatCurrency(semesterAudit.totals.totalAmount)}
            hint={`${semesterAudit.period.startDate} a ${semesterAudit.period.endDate}`}
            tone={semesterAuditTone}
            priority="primary"
            badgeLabel="Real"
            className="cc-fiscal-closing-card--state"
          />
        </div>

        <div className="cc-fiscal-closing-secondary-grid">
          <article className="cc-quarterly-persistence__card">
            <span className="cc-dashboard-panel__label">Periodo auditado</span>
            <strong className="cc-dashboard-panel__value">{semesterAudit.period.label}</strong>
            <p className="cc-dashboard-panel__text">{semesterAudit.period.startDate} -&gt; {semesterAudit.period.endDate}</p>
          </article>

          <article className="cc-quarterly-persistence__card">
            <label className="cc-inline-field">
              <span>Año</span>
              <select
                value={selection.year}
                onChange={(event) => setSelection((current) => ({ ...current, year: Number(event.target.value) }))}
              >
                {[...new Set<number>([...availableYears, selection.year])].sort((left, right) => right - left).map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </label>
          </article>
        </div>

        {semesterAuditAlert || semesterAudit.totals.invoiceCount === 0 ? (
          <article className="cc-quarterly-persistence__card" style={{ marginTop: '0.75rem' }}>
            <div className="cc-action-group" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="cc-dashboard-panel__label">Revision compacta</span>
              <SeverityBadge
                label={semesterAudit.reviewItems.length > 0 ? `${semesterAudit.reviewItems.length} aviso(s)` : 'Sin actividad'}
                tone={semesterAudit.reviewItems.length > 0 ? 'warning' : 'info'}
              />
            </div>
            <p className="cc-dashboard-panel__text">
              {semesterAuditAlert ?? `No hay facturas emitidas en ${semesterAudit.period.label}. El importe real del periodo es ${formatCurrency(semesterAudit.totals.totalAmount)}.`}
            </p>
          </article>
        ) : null}
      </section>

      <CollapsibleDetailSection
        title="Desglose real"
        count={
          3
          + ((semesterAudit.totals.paidAmount > 0 || semesterAudit.totals.pendingAmount > 0) ? 2 : 0)
        }
        tone="info"
      >
        <section className="cc-dashboard-block">
          <div className="cc-fiscal-closing-secondary-grid">
            <VisualKpiCard
              label="Base imponible"
              value={formatCurrency(semesterAudit.totals.baseAmount)}
              hint="Suma exacta de bases de las facturas emitidas incluidas."
              tone={semesterAudit.totals.invoiceCount > 0 ? 'info' : 'neutral'}
              priority="compact"
              badgeLabel="Base"
            />
            <VisualKpiCard
              label="IVA"
              value={formatCurrency(semesterAudit.totals.vatAmount)}
              hint="IVA exacto de las facturas emitidas incluidas."
              tone={semesterAudit.totals.invoiceCount > 0 ? 'info' : 'neutral'}
              priority="compact"
              badgeLabel="IVA"
            />
            <VisualKpiCard
              label="Facturas emitidas"
              value={String(semesterAudit.totals.invoiceCount)}
              hint={`Estados contados: ${semesterAudit.emittedStatuses.join(', ')}`}
              tone={semesterAuditTone}
              priority="compact"
              badgeLabel={semesterAudit.reviewItems.length > 0 ? 'Revisar' : 'Emitidas'}
            />

            {semesterAudit.totals.paidAmount > 0 || semesterAudit.totals.pendingAmount > 0 ? (
              <>
                <VisualKpiCard
                  label="Cobrado"
                  value={formatCurrency(semesterAudit.totals.paidAmount)}
                  hint="Calculado desde pagos reales vinculados a las facturas incluidas."
                  tone="success"
                  priority="compact"
                />
                <VisualKpiCard
                  label="Pendiente"
                  value={formatCurrency(semesterAudit.totals.pendingAmount)}
                  hint="Saldo pendiente de las facturas emitidas del semestre."
                  tone={semesterAudit.totals.pendingAmount > 0.009 ? 'warning' : 'success'}
                  priority="compact"
                />
              </>
            ) : null}
          </div>
        </section>
      </CollapsibleDetailSection>

      <CollapsibleDetailSection title="Motor fiscal completo" count={1} tone="neutral">
        <FiscalPeriodSelector
          availableYears={availableYears}
          selection={selection}
          onChange={setSelection}
          title="Otras vistas del motor"
          description="Mes, trimestre, año y rango personalizado quedan fuera del flujo principal del segundo semestre."
        />
      </CollapsibleDetailSection>

      <CollapsibleDetailSection title="Facturas incluidas" count={semesterAudit.includedInvoices.length} tone="info">
        <section className="cc-dashboard-block">
          <div className="cc-export-folder-list cc-bounded-list">
            {semesterAudit.includedInvoices.length > 0 ? semesterAudit.includedInvoices.map((invoice) => (
              <article key={invoice.id} className="cc-export-folder-item">
                <strong>{invoice.reference}</strong>
                <p>
                  {invoice.clientLabel} · {formatDateEs(invoice.issueDate)} · Base {formatCurrency(invoice.baseAmount)} · IVA {formatCurrency(invoice.vatAmount)} · Total {formatCurrency(invoice.totalAmount)}
                </p>
              </article>
            )) : (
              <article className="cc-export-folder-item">
                <strong>Sin facturas emitidas</strong>
                <p>No hay registros emitidos dentro del segundo semestre auditado.</p>
              </article>
            )}
          </div>
        </section>
      </CollapsibleDetailSection>

      {semesterAudit.reviewItems.length > 0 || semesterAudit.excludedInvoices.length > 0 ? (
        <CollapsibleDetailSection title="Revisiones necesarias" count={semesterAudit.reviewItems.length + semesterAudit.excludedInvoices.length} tone="warning">
          <section className="cc-dashboard-block">
            <div className="cc-export-folder-list cc-bounded-list">
              {semesterAudit.reviewItems.map((item) => (
                <article key={item.id} className="cc-export-folder-item">
                  <strong>{item.reference}</strong>
                  <p>{item.message}</p>
                </article>
              ))}
              {semesterAudit.excludedInvoices.map((invoice) => (
                <article key={`excluded-${invoice.id}`} className="cc-export-folder-item">
                  <strong>{invoice.reference}</strong>
                  <p>{invoice.reason}</p>
                </article>
              ))}
            </div>
          </section>
        </CollapsibleDetailSection>
      ) : null}

      <CollapsibleDetailSection title="Base del periodo" count={7} tone="info">
      <section className="cc-dashboard-block">
        <div className="cc-dashboard-block__header">
          <div>
            <h2>Base del periodo</h2>
            <p>Contexto financiero y documental de apoyo con menos peso visual que el estado, el snapshot y los pendientes.</p>
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
      </CollapsibleDetailSection>

      <CollapsibleDetailSection title="Checklist y fuentes" count={checklistItems.length} tone="info">
      <section className="cc-fiscal-closing-two-column">
        <article className="cc-dashboard-block">
          <div className="cc-dashboard-block__header">
            <div>
              <h2>Checklist prioritario</h2>
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
              <p>Lo critico se resume aqui. El detalle completo queda colapsado para no competir con la decision principal del periodo.</p>
            </div>
          </div>
          <div className="cc-quarterly-persistence__card cc-bounded-list">
            {topWarnings.length > 0 ? (
              <ActionChecklist
                compact
                items={topWarnings.map((warning) => ({
                  id: warning.id,
                  state: warning.severity === 'critical' ? 'critical' : warning.severity === 'warning' ? 'warning' : 'info',
                  label: `${getWarningSeverityLabel(warning.severity)} Â· ${warning.title}`,
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
      </CollapsibleDetailSection>

      <CollapsibleDetailSection title="Configuracion y snapshot" count={summary.snapshotMode ? 2 : 1} tone="neutral">
      <section className="cc-quarterly-pack-grid">
        <article className="cc-quarterly-persistence__card">
          <span className="cc-dashboard-panel__label">Siguiente decision</span>
          <div className="cc-action-group" style={{ alignItems: 'center' }}>
            <strong className="cc-dashboard-panel__value">
              {summary.unresolvedIncidenceCount > 0
                ? 'Resolver pendientes antes de exportar'
                : persistedClosing
                  ? 'Paquete listo para preparar'
                  : 'Guardar snapshot del periodo'}
            </strong>
            <SeverityBadge label={`Confianza ${getConfidenceLabel(fiscalSummary.confidenceLevel)}`} tone={getConfidenceTone(fiscalSummary.confidenceLevel)} />
          </div>
          <p className="cc-dashboard-panel__text">{topWarnings[0]?.recommendedAction ?? statusCard.detail}</p>
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
      </CollapsibleDetailSection>

      {fiscalSummary.insufficientDataNotes.length > 0 ? (
        <CollapsibleDetailSection title="Datos insuficientes" count={fiscalSummary.insufficientDataNotes.length} tone="critical">
          <div className="cc-quarterly-checklist">
            {fiscalSummary.insufficientDataNotes.map((note, index) => (
              <p key={`note-${index}`} className="cc-dashboard-panel__text">{note}</p>
            ))}
          </div>
        </CollapsibleDetailSection>
      ) : null}

      <CollapsibleDetailSection title="Informe integral del periodo" count={3} tone="warning">
      <section className="cc-dashboard-block">
        <div className="cc-dashboard-block__header">
          <div>
            <h2>Informe integral del periodo</h2>
            <p>Vista interna de preparacion fiscal y financiera basada en datos deterministas, warnings visibles y notas asistivas separadas de cualquier validacion profesional definitiva.</p>
          </div>
        </div>

        <div className="cc-fiscal-closing-primary-grid">
          <VisualKpiCard
            label="Estado del periodo"
            value={fiscalSummary.readinessLabel}
            hint="Lectura interna del paquete antes de exportar o compartir."
            tone={getReadinessTone(fiscalSummary.readiness)}
            priority="primary"
            badgeLabel="Readiness"
          >
            <p className="cc-fiscal-closing-card__note">Preparacion interna {readinessPercent}% y confianza {getConfidenceLabel(fiscalSummary.confidenceLevel).toLowerCase()}.</p>
          </VisualKpiCard>

          <VisualKpiCard
            label="Resumen financiero"
            value={formatCurrency(integralReportData.metrics.invoiced_total)}
            hint={`Cobrado ${formatCurrency(integralReportData.metrics.collected_total)} Â· pendiente ${formatCurrency(integralReportData.metrics.outstanding_total)}.`}
            tone={integralReportData.metrics.outstanding_total > 0.009 ? 'warning' : 'success'}
            priority="primary"
            badgeLabel="Determinista"
          >
            <p className="cc-fiscal-closing-card__note">No recalcula caja futura ni margen neto definitivo.</p>
          </VisualKpiCard>

          <VisualKpiCard
            label="Resumen IVA"
            value={formatCurrency(integralReportData.metrics.estimated_net_vat_payable)}
            hint={`IVA repercutido ${formatCurrency(integralReportData.metrics.output_vat_total)} Â· IVA deducible estimado ${formatCurrency(integralReportData.metrics.estimated_deductible_vat)}.`}
            tone={integralReportData.metrics.missing_valid_vat_invoice_count > 0 ? 'warning' : 'success'}
            priority="primary"
            badgeLabel="Estimado"
          >
            <p className="cc-fiscal-closing-card__note">Cifra orientativa. Requiere validacion profesional.</p>
          </VisualKpiCard>
        </div>

        <div className="cc-fiscal-closing-two-column" style={{ marginTop: '1rem' }}>
          <article className="cc-dashboard-block">
            <div className="cc-dashboard-block__header">
              <div>
                <h2>Checklist y fuentes</h2>
                <p>Facturas, cobros, gastos, presupuestos de apoyo y limites del paquete en un solo bloque corto.</p>
              </div>
            </div>
            <div className="cc-quarterly-persistence__card">
              <ActionChecklist
                compact
                items={[
                  {
                    id: 'integral-invoices',
                    state: integralReportData.metrics.invoice_count > 0 ? 'done' : 'info',
                    label: `${integralReportData.metrics.invoice_count} factura(s) incluidas`,
                    description: 'Base determinista de facturacion del periodo.',
                  },
                  {
                    id: 'integral-payments',
                    state: integralReportData.metrics.payment_count > 0 ? 'done' : 'info',
                    label: `${integralReportData.metrics.payment_count} cobro(s) incluidos`,
                    description: 'Trazabilidad real de cobros registrados dentro del periodo.',
                  },
                  {
                    id: 'integral-expenses',
                    state: integralReportData.metrics.expense_count > 0 ? 'done' : 'info',
                    label: `${integralReportData.metrics.expense_count} gasto(s) incluidos`,
                    description: `${integralReportData.metrics.supported_expense_count} con soporte visible y ${integralReportData.metrics.missing_support_count} pendientes.`,
                  },
                  {
                    id: 'integral-quotes',
                    state: integralReportData.metrics.quote_count > 0 ? 'info' : 'done',
                    label: `${integralReportData.metrics.quote_count} presupuesto(s) de apoyo`,
                    description: 'Se usan como contexto comercial del periodo, no como cifra fiscal dura.',
                  },
                ]}
              />
            </div>
          </article>

          <article className="cc-dashboard-block">
            <div className="cc-dashboard-block__header">
              <div>
                <h2>Warnings y limites</h2>
                <p>La lectura interna distingue revision pendiente, datos insuficientes y validacion profesional.</p>
              </div>
            </div>
            <div className="cc-quarterly-persistence__card cc-bounded-list">
              <ActionChecklist
                compact
                items={[
                  {
                    id: 'integral-warnings',
                    state: integralReportData.warnings.length > 0 ? 'warning' : 'done',
                    label: `${integralReportData.warnings.length} warning(s) del periodo`,
                    description: integralReportData.warnings[0] ?? 'No hay warnings principales abiertos en la exportacion del periodo.',
                  },
                  {
                    id: 'integral-missing-data',
                    state: fiscalSummary.missingDataFlags.length > 0 ? 'critical' : 'done',
                    label: `${fiscalSummary.missingDataFlags.length} limite(s) visibles`,
                    description: fiscalSummary.missingDataFlags[0]
                      ? getMissingDataFlagLabel(fiscalSummary.missingDataFlags[0])
                      : 'No hay limites estructurales dominando la lectura principal.',
                  },
                  {
                    id: 'integral-ai',
                    state: aiSummaryResult ? 'info' : 'pending',
                    label: aiSummaryResult ? 'Notas IA disponibles' : 'Notas IA bajo demanda',
                    description: aiSummaryResult
                      ? aiSummaryResult.summary.executiveSummary
                      : 'La IA interpreta el resumen cerrado del periodo, pero no recalcula importes ni sustituye validacion profesional.',
                  },
                  {
                    id: 'integral-validation',
                    state: 'warning',
                    label: 'Validacion profesional requerida',
                    description: 'El informe sirve para preparacion interna y entrega ordenada, no como asesorÃ­a fiscal definitiva.',
                  },
                ]}
              />
            </div>
          </article>
        </div>
      </section>
      </CollapsibleDetailSection>

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
                    Facturado {formatCurrency(quarter.invoicedTotal)} Â· IVA neto estimado {formatCurrency(quarter.estimatedNetVatPayable)} Â·
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
                    {expense.supplier_name} Â· {formatDateEs(expense.expense_date)} Â· {getExpenseDocumentSupportStatusLabel(expense.document_support_status)}
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
                    Revision {getExpenseFiscalReviewStatusLabel(expense.fiscal_review_status)} Â· riesgo {getExpenseFiscalRiskLevelLabel(expense.ai_fiscal_risk_level ?? expense.fiscal_risk_level).toLowerCase()}
                  </p>
                </article>
              ))}

              {summary.riskExpenses
                .filter((expense) => !summary.pendingReviewExpenses.some((item) => item.id === expense.id))
                .map((expense) => (
                  <article key={`risk-${expense.id}`} className="cc-export-folder-item">
                    <strong>{expense.display_code ?? expense.supplier_name}</strong>
                    <p>
                      Riesgo {getExpenseFiscalRiskLevelLabel(expense.ai_fiscal_risk_level ?? expense.fiscal_risk_level).toLowerCase()} Â· {formatDateEs(expense.expense_date)}
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




