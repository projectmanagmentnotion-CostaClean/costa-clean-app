import { useEffect, useMemo, useState } from 'react'
import { formatCurrency } from '../../app/displayFormat'
import { buildClosingSummary, type ClosingIncidenceScope, type ClosingIncidenceView } from '../../features/closing/closingSummaryEngine'
import type { FiscalPeriodSelection } from '../../features/closing/fiscalPeriods'
import { V3DetailSection, V3EmptyState, V3EntityStatus, V3Field, V3Kpi, V3KpiGroup, V3Page, V3PageTitle, V3PrimaryAction, V3SecondaryAction, V3Select, V3Textarea } from '../components/V3Primitives'
import type { InvoiceListItem } from '../../features/invoices/types'
import type { PaymentListItem } from '../../features/payments/types'
import type { ExpenseListItem } from '../../features/expenses/types'
import type { QuoteListItem } from '../../features/quotes/types'
import type { JobListItem } from '../../features/jobs/types'
import type { QuarterlyClosingRecord, QuarterlyClosingSummary } from '../../features/quarterlyClosing/types'
import type { AnnualClosingRecord, AnnualClosingSummary } from '../../features/annualClosing/types'

interface V3ClosingPageProps { availableYears: number[]; initialSelection: FiscalPeriodSelection; quarterlySummaryByPeriod: Map<string, QuarterlyClosingSummary>; annualSummaryByYear: Map<number, AnnualClosingSummary>; quarterlyClosings: QuarterlyClosingRecord[]; annualClosings: AnnualClosingRecord[]; invoices: InvoiceListItem[]; payments: PaymentListItem[]; expenses: ExpenseListItem[]; quotes: QuoteListItem[]; jobs: JobListItem[]; error: string | null; onNavigateToIncidence: (view: ClosingIncidenceView, scope: ClosingIncidenceScope, selection: FiscalPeriodSelection) => void; onSaveQuarterlyClosing: (input: { fiscalYear: number; fiscalQuarter: number; notes: string | null }) => Promise<void>; onSaveAnnualClosing: (input: { fiscalYear: number; notes: string | null }) => Promise<void> }

export function V3ClosingPage(props: V3ClosingPageProps) {
  const [selection, setSelection] = useState(props.initialSelection)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => setSelection(props.initialSelection), [props.initialSelection])
  const summary = useMemo(() => buildClosingSummary({ selection, invoices: props.invoices, payments: props.payments, expenses: props.expenses, quotes: props.quotes, jobs: props.jobs, quarterlySummaryByPeriod: props.quarterlySummaryByPeriod, annualSummaryByYear: props.annualSummaryByYear }), [props, selection])
  const save = async () => { setSaving(true); setMessage(null); try { if (summary.snapshotMode === 'quarterly' && summary.fiscalQuarter) await props.onSaveQuarterlyClosing({ fiscalYear: summary.fiscalYear, fiscalQuarter: summary.fiscalQuarter, notes: notes.trim() || null }); else if (summary.snapshotMode === 'annual') await props.onSaveAnnualClosing({ fiscalYear: summary.fiscalYear, notes: notes.trim() || null }); else { setMessage('Selecciona trimestre o año para guardar un snapshot.'); return }; setMessage('Snapshot interno preparado guardado.') } finally { setSaving(false) } }
  const periodLabel = summary.period.label
  return <V3Page className="v3-closing-page"><V3PageTitle eyebrow="Control fiscal interno" title="Cierres" description="Resumen preparado con datos existentes de facturas, cobros, gastos y soportes." />
    <div className="v3-closing-selector"><V3Field label="Tipo de periodo"><V3Select value={selection.mode} onChange={(e) => setSelection({ ...selection, mode: e.target.value as FiscalPeriodSelection['mode'] })}><option value="quarter">Trimestre</option><option value="year">Año</option><option value="month">Mes</option><option value="custom">Personalizado</option></V3Select></V3Field><V3Field label="Año"><V3Select value={selection.year} onChange={(e) => setSelection({ ...selection, year: Number(e.target.value) })}>{[...new Set([...props.availableYears, selection.year])].sort((a, b) => b - a).map((year) => <option key={year} value={year}>{year}</option>)}</V3Select></V3Field>{selection.mode === 'quarter' ? <V3Field label="Trimestre"><V3Select value={selection.quarter} onChange={(e) => setSelection({ ...selection, quarter: Number(e.target.value) })}>{[1, 2, 3, 4].map((quarter) => <option key={quarter} value={quarter}>T{quarter}</option>)}</V3Select></V3Field> : null}</div>
    <V3KpiGroup><V3Kpi label="Facturado" value={formatCurrency(summary.invoicedTotal)} hint={periodLabel} /><V3Kpi label="Cobrado" value={formatCurrency(summary.collectedTotal)} hint="Cobros registrados" /><V3Kpi label="Pendiente" value={formatCurrency(summary.outstandingTotal)} hint={`${summary.pendingInvoiceCount} factura(s)`} /></V3KpiGroup>
    <V3DetailSection title="Estado del periodo"><V3EntityStatus label={summary.readinessLevel === 'ready' ? 'Listo' : summary.readinessLevel === 'review' ? 'Requiere revisión' : 'Bloqueado'} tone={summary.readinessLevel === 'ready' ? 'success' : summary.readinessLevel === 'review' ? 'warning' : 'danger'} /><p className="v3-section-copy">Lectura interna preparada. No es una certificación oficial.</p></V3DetailSection>
    <V3DetailSection title="Incidencias"><div className="v3-closing-incidences">{summary.incidences.filter((incidence) => incidence.count > 0).map((incidence) => <button type="button" className="v3-relation-row" key={incidence.id} onClick={() => props.onNavigateToIncidence(incidence.view, incidence.scope, selection)}><span><strong>{incidence.label}</strong><small>{incidence.detail}</small></span><strong>{incidence.count}</strong></button>)}</div>{summary.incidences.every((incidence) => incidence.count === 0) ? <V3EmptyState title="Sin incidencias" description="No hay incidencias abiertas en este periodo." /> : null}</V3DetailSection>
    <V3DetailSection title="Preparar snapshot"><V3Field label="Notas internas"><V3Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Contexto interno opcional" /></V3Field><div className="v3-workspace-actions"><V3PrimaryAction onClick={() => void save()} disabled={saving}>{saving ? 'Guardando…' : 'Guardar preparación'}</V3PrimaryAction><V3SecondaryAction onClick={() => props.onNavigateToIncidence('expenses', 'closure', selection)}>Revisar gastos de cierre</V3SecondaryAction></div>{message ? <p className="v3-inline-message" role="status">{message}</p> : null}</V3DetailSection>
  </V3Page>
}
