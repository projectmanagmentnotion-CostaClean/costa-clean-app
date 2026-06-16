import { useMemo, useState } from 'react'
import type { ClientListItem } from '../clients/types'
import { getMonthOptions, type FiscalPeriodMode, type FiscalPeriodSelection } from '../closing/fiscalPeriods'
import {
  buildFiscalPeriodExportData,
  buildFiscalPeriodIncidences,
} from './fiscalPeriodExport'
import { downloadManagerExportPackage, type ManagerExportPackageResult } from './managerExportPackage'
import type { ExpenseListItem } from '../expenses/types'
import type { InvoiceListItem } from '../invoices/types'
import type { PaymentListItem } from '../payments/types'
import type { PropertyListItem } from '../properties/types'
import type { QuoteListItem } from '../quotes/types'

interface FiscalPeriodExportSectionProps {
  availableYears: number[]
  defaultSelection: FiscalPeriodSelection
  title: string
  description: string
  invoices: InvoiceListItem[]
  payments: PaymentListItem[]
  expenses: ExpenseListItem[]
  quotes: QuoteListItem[]
  clients: ClientListItem[]
  properties: PropertyListItem[]
  closingSavedAt?: string | null
  closingNotes?: string | null
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

const monthOptions = getMonthOptions()

export function FiscalPeriodExportSection({
  availableYears,
  defaultSelection,
  title,
  description,
  invoices,
  payments,
  expenses,
  quotes,
  clients,
  properties,
  closingSavedAt = null,
  closingNotes = null,
}: FiscalPeriodExportSectionProps) {
  const [selection, setSelection] = useState<FiscalPeriodSelection>(defaultSelection)
  const [isExporting, setIsExporting] = useState(false)
  const [exportResult, setExportResult] = useState<ManagerExportPackageResult | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  const exportData = useMemo(
    () => buildFiscalPeriodExportData({
      selection,
      invoices,
      payments,
      expenses,
      quotes,
    }),
    [expenses, invoices, payments, quotes, selection],
  )
  const incidences = useMemo(() => buildFiscalPeriodIncidences(exportData), [exportData])

  const yearOptions = useMemo(() => {
    const values = new Set<number>([...availableYears, new Date().getFullYear(), selection.year])
    return [...values].sort((left, right) => right - left)
  }, [availableYears, selection.year])

  function handleModeChange(mode: FiscalPeriodMode) {
    setSelection((current) => ({ ...current, mode }))
    setExportResult(null)
    setExportError(null)
  }

  async function handleDownload() {
    setIsExporting(true)
    setExportResult(null)
    setExportError(null)

    try {
      const result = await downloadManagerExportPackage({
        scope:
          exportData.period.mode === 'quarter' ? 'quarterly'
            : exportData.period.mode === 'year' ? 'annual'
              : exportData.period.mode,
        label: `Paquete fiscal ${exportData.period.label}`,
        folderName: `CostaClean_Cierre_Fiscal_${exportData.period.folderLabel}`,
        periodStartDate: exportData.period.startDate,
        periodEndDate: exportData.period.endDate,
        closingSavedAt,
        closingNotes,
        summaryMetrics: exportData.metrics,
        invoices: exportData.invoices,
        payments: exportData.payments,
        expenses: exportData.expenses,
        quotes: exportData.quotes,
        clients,
        properties,
        incidences,
      })
      setExportResult(result)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'No se pudo generar el paquete fiscal del periodo.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <>
      <section className="cc-dashboard-block">
        <div className="cc-dashboard-block__header">
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          <button type="button" className="primary-button" onClick={handleDownload} disabled={isExporting}>
            {isExporting ? 'Generando ZIP...' : 'Descargar paquete ZIP'}
          </button>
        </div>

        <div className="cc-quarterly-pack-grid">
          <article className="cc-quarterly-persistence__card">
            <span className="cc-dashboard-panel__label">Tipo de periodo</span>
            <div className="cc-inline-toggle-group" role="tablist" aria-label="Selector de periodo fiscal">
              {([
                ['month', 'Mes'],
                ['quarter', 'Trimestre'],
                ['year', 'Año'],
                ['custom', 'Personalizado'],
              ] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  className={selection.mode === mode ? 'secondary-button is-active' : 'secondary-button'}
                  onClick={() => handleModeChange(mode)}
                >
                  {label}
                </button>
              ))}
            </div>
          </article>

          <article className="cc-quarterly-persistence__card">
            <span className="cc-dashboard-panel__label">Configuración</span>
            <div className="cc-inline-form-grid">
              <label className="cc-inline-field">
                <span>Año</span>
                <select
                  value={selection.year}
                  onChange={(event) => setSelection((current) => ({ ...current, year: Number(event.target.value) }))}
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </label>

              {selection.mode === 'month' ? (
                <label className="cc-inline-field">
                  <span>Mes</span>
                  <select
                    value={selection.month}
                    onChange={(event) => setSelection((current) => ({ ...current, month: Number(event.target.value) }))}
                  >
                    {monthOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              ) : null}

              {selection.mode === 'quarter' ? (
                <label className="cc-inline-field">
                  <span>Trimestre</span>
                  <select
                    value={selection.quarter}
                    onChange={(event) => setSelection((current) => ({ ...current, quarter: Number(event.target.value) }))}
                  >
                    {[1, 2, 3, 4].map((quarter) => (
                      <option key={quarter} value={quarter}>{`T${quarter}`}</option>
                    ))}
                  </select>
                </label>
              ) : null}

              {selection.mode === 'custom' ? (
                <>
                  <label className="cc-inline-field">
                    <span>Desde</span>
                    <input
                      type="date"
                      value={selection.startDate}
                      onChange={(event) => setSelection((current) => ({ ...current, startDate: event.target.value }))}
                    />
                  </label>
                  <label className="cc-inline-field">
                    <span>Hasta</span>
                    <input
                      type="date"
                      value={selection.endDate}
                      onChange={(event) => setSelection((current) => ({ ...current, endDate: event.target.value }))}
                    />
                  </label>
                </>
              ) : null}
            </div>
          </article>
        </div>

        {exportError ? (
          <div className="cc-alert cc-alert--error">
            <strong>No se pudo generar el paquete</strong>
            <p>{exportError}</p>
          </div>
        ) : null}

        {exportResult ? (
          <div className="cc-alert cc-alert--success">
            <strong>Paquete descargado</strong>
            <p>
              {exportResult.fileName} · {exportResult.includedFiles} archivo(s) incluidos · {exportResult.missingDocuments} soporte(s) faltante(s).
            </p>
            {exportResult.warnings.length > 0 ? (
              <p>{exportResult.warnings.join(' ')}</p>
            ) : null}
          </div>
        ) : null}

        {exportData.warnings.length > 0 ? (
          <div className="cc-alert cc-alert--warning">
            <strong>Observaciones del periodo</strong>
            <p>{exportData.warnings.join(' ')}</p>
          </div>
        ) : null}
      </section>

      <section className="cc-kpi-grid cc-quarterly-metrics" aria-label="KPIs del paquete fiscal por periodo">
        <article className="cc-kpi-card cc-kpi-card--finance">
          <span className="cc-kpi-label">Periodo activo</span>
          <strong className="cc-kpi-value">{exportData.period.label}</strong>
          <p className="cc-kpi-footnote">{exportData.period.startDate} → {exportData.period.endDate}</p>
        </article>
        <article className="cc-kpi-card cc-kpi-card--finance">
          <span className="cc-kpi-label">IVA repercutido</span>
          <strong className="cc-kpi-value">{formatCurrency(exportData.metrics.output_vat_total)}</strong>
          <p className="cc-kpi-footnote">Según facturas emitidas del periodo</p>
        </article>
        <article className="cc-kpi-card">
          <span className="cc-kpi-label">IVA deducible estimado</span>
          <strong className="cc-kpi-value">{formatCurrency(exportData.metrics.estimated_deductible_vat)}</strong>
          <p className="cc-kpi-footnote">Estimación operativa basada en gastos y soporte</p>
        </article>
        <article className="cc-kpi-card cc-kpi-card--warning">
          <span className="cc-kpi-label">IVA neto estimado</span>
          <strong className="cc-kpi-value">{formatCurrency(exportData.metrics.estimated_net_vat_payable)}</strong>
          <p className="cc-kpi-footnote">IVA repercutido menos IVA deducible estimado</p>
        </article>
        <article className="cc-kpi-card">
          <span className="cc-kpi-label">Facturas incluidas</span>
          <strong className="cc-kpi-value">{exportData.metrics.invoice_count}</strong>
          <p className="cc-kpi-footnote">Facturado: {formatCurrency(exportData.metrics.invoiced_total)}</p>
        </article>
        <article className="cc-kpi-card">
          <span className="cc-kpi-label">Cobros incluidos</span>
          <strong className="cc-kpi-value">{exportData.metrics.payment_count}</strong>
          <p className="cc-kpi-footnote">Cobrado: {formatCurrency(exportData.metrics.collected_total)}</p>
        </article>
        <article className="cc-kpi-card">
          <span className="cc-kpi-label">Gastos incluidos</span>
          <strong className="cc-kpi-value">{exportData.metrics.expense_count}</strong>
          <p className="cc-kpi-footnote">Gasto: {formatCurrency(exportData.metrics.expenses_total)}</p>
        </article>
        <article className="cc-kpi-card">
          <span className="cc-kpi-label">Presupuestos admin.</span>
          <strong className="cc-kpi-value">{exportData.metrics.quote_count}</strong>
          <p className="cc-kpi-footnote">Se exportan en carpeta separada para no mezclar lo fiscal</p>
        </article>
      </section>

      <section className="cc-dashboard-block">
        <div className="cc-dashboard-block__header">
          <div>
            <h2>Estructura final del paquete</h2>
            <p>Organización pensada para revisión interna o entrega directa al gestor.</p>
          </div>
        </div>

        <div className="cc-export-folder-list cc-bounded-list">
          <article className="cc-export-folder-item">
            <strong>01_resumen</strong>
            <p>Resumen HTML/JSON del periodo, con KPIs, rango seleccionado y notas asociadas al cierre si existen.</p>
          </article>
          <article className="cc-export-folder-item">
            <strong>02_facturas_emitidas</strong>
            <p>{`${exportData.metrics.invoice_count} factura(s) con CSV resumen y documento HTML listo para imprimir/PDF.`}</p>
          </article>
          <article className="cc-export-folder-item">
            <strong>03_cobros</strong>
            <p>{`${exportData.metrics.payment_count} cobro(s) con CSV operativo y referencia a la factura vinculada.`}</p>
          </article>
          <article className="cc-export-folder-item">
            <strong>04_gastos_y_soportes</strong>
            <p>{`${exportData.metrics.expense_count} gasto(s) con CSV, manifest de soportes y adjuntos descargables cuando existen.`}</p>
          </article>
          <article className="cc-export-folder-item">
            <strong>05_presupuestos_administrativos</strong>
            <p>{`${exportData.metrics.quote_count} presupuesto(s) relevantes del periodo en carpeta separada para no contaminar el bloque fiscal.`}</p>
          </article>
          <article className="cc-export-folder-item">
            <strong>06_incidencias_pendientes</strong>
            <p>{`${exportData.metrics.unresolved_incidence_count} incidencia(s) resumidas para cerrar huecos antes de entregar.`}</p>
          </article>
          <article className="cc-export-folder-item">
            <strong>07_revision_gestoria</strong>
            <p>Checklist fiscal, IVA repercutido, IVA deducible estimado y focos de revisión documental/fiscal.</p>
          </article>
        </div>
      </section>
    </>
  )
}
