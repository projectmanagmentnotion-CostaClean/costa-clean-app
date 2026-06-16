import { useMemo, useState } from 'react'
import type { ClientListItem } from '../clients/types'
import { FiscalPeriodSelector } from '../closing/FiscalPeriodSelector'
import type { FiscalPeriodSelection } from '../closing/fiscalPeriods'
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
  defaultSelection?: FiscalPeriodSelection
  selection?: FiscalPeriodSelection
  onSelectionChange?: (selection: FiscalPeriodSelection) => void
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
  showSelector?: boolean
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

function getDocumentHealthCopy(status: 'healthy' | 'review' | 'critical') {
  if (status === 'healthy') {
    return {
      label: 'Pack listo para revisión',
      detail: 'La cobertura documental del periodo es sana y el pack puede exportarse con buena trazabilidad.',
      toneClass: 'cc-kpi-card--success',
    }
  }

  if (status === 'critical') {
    return {
      label: 'Pack con huecos documentales',
      detail: 'El ZIP sigue siendo exportable, pero conviene resolver soportes faltantes antes de compartirlo con gestoría.',
      toneClass: 'cc-kpi-card--warning',
    }
  }

  return {
    label: 'Pack exportable con revisión previa',
    detail: 'La estructura está lista, aunque todavía hay gastos a revisar o riesgos que conviene contextualizar antes de entregar.',
    toneClass: 'cc-kpi-card--warning',
  }
}

function createDefaultSelection(): FiscalPeriodSelection {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  return {
    mode: 'quarter',
    year,
    month,
    quarter: Math.floor(now.getMonth() / 3) + 1,
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  }
}

export function FiscalPeriodExportSection({
  availableYears,
  defaultSelection,
  selection: controlledSelection,
  onSelectionChange,
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
  showSelector = true,
}: FiscalPeriodExportSectionProps) {
  const [internalSelection, setInternalSelection] = useState<FiscalPeriodSelection>(
    defaultSelection ?? controlledSelection ?? createDefaultSelection(),
  )
  const [isExporting, setIsExporting] = useState(false)
  const [exportResult, setExportResult] = useState<ManagerExportPackageResult | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const selection = controlledSelection ?? internalSelection

  function handleSelectionChange(nextSelection: FiscalPeriodSelection) {
    if (!controlledSelection) {
      setInternalSelection(nextSelection)
    }

    onSelectionChange?.(nextSelection)
    setExportResult(null)
    setExportError(null)
  }

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
  const documentHealthCopy = useMemo(
    () => getDocumentHealthCopy(exportData.documentHealth.status),
    [exportData.documentHealth.status],
  )
  const fiscalPackGroups = useMemo(
    () => exportData.packGroups.filter((group) => group.category === 'fiscal'),
    [exportData.packGroups],
  )
  const administrativePackGroups = useMemo(
    () => exportData.packGroups.filter((group) => group.category === 'administrative'),
    [exportData.packGroups],
  )

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
      {showSelector ? (
        <FiscalPeriodSelector
          availableYears={availableYears}
          selection={selection}
          onChange={handleSelectionChange}
          title={title}
          description={description}
        />
      ) : null}

      <section className="cc-dashboard-block">
        <div className="cc-dashboard-block__header">
          <div>
            <h2>{showSelector ? 'Export fiscal' : title}</h2>
            <p>{showSelector ? 'El paquete usa exactamente el mismo periodo activo del cierre.' : description}</p>
          </div>
          <button type="button" className="primary-button" onClick={handleDownload} disabled={isExporting}>
            {isExporting ? 'Generando ZIP...' : 'Descargar paquete ZIP'}
          </button>
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

      <section className="cc-dashboard-block">
        <div className="cc-dashboard-block__header">
          <div>
            <h2>Preflight del pack gestor</h2>
            <p>Antes de descargar, esta vista deja claro qué entrará en el ZIP y con qué salud documental llegará a gestoría.</p>
          </div>
        </div>

        <div className="cc-kpi-grid cc-quarterly-metrics">
          <article className={`cc-kpi-card ${documentHealthCopy.toneClass}`}>
            <span className="cc-kpi-label">Estado del pack</span>
            <strong className="cc-kpi-value">{documentHealthCopy.label}</strong>
            <p className="cc-kpi-footnote">{documentHealthCopy.detail}</p>
          </article>
          <article className="cc-kpi-card">
            <span className="cc-kpi-label">Cobertura documental</span>
            <strong className="cc-kpi-value">{exportData.documentHealth.supportCoverageRatio}%</strong>
            <p className="cc-kpi-footnote">{exportData.documentHealth.supportedExpenseCount} de {exportData.metrics.expense_count} gasto(s) con soporte descargable.</p>
          </article>
          <article className="cc-kpi-card">
            <span className="cc-kpi-label">Factura válida para IVA</span>
            <strong className="cc-kpi-value">{exportData.documentHealth.validVatInvoiceCount}</strong>
            <p className="cc-kpi-footnote">{exportData.metrics.missing_valid_vat_invoice_count} gasto(s) siguen sin cobertura válida para deducción.</p>
          </article>
          <article className="cc-kpi-card">
            <span className="cc-kpi-label">Incidencias abiertas</span>
            <strong className="cc-kpi-value">{exportData.metrics.unresolved_incidence_count}</strong>
            <p className="cc-kpi-footnote">Se exportan en carpeta separada para no perder trazabilidad de revisión.</p>
          </article>
        </div>
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
        <article className="cc-kpi-card">
          <span className="cc-kpi-label">Soportes descargables</span>
          <strong className="cc-kpi-value">{exportData.metrics.supported_expense_count}</strong>
          <p className="cc-kpi-footnote">{exportData.metrics.missing_support_count} gasto(s) siguen con huecos documentales.</p>
        </article>
      </section>

      <section className="cc-dashboard-block">
        <div className="cc-dashboard-block__header">
          <div>
            <h2>Qué entra en el pack</h2>
            <p>Separación visual entre contenido fiscal duro y material administrativo o de trazabilidad.</p>
          </div>
        </div>

        <div className="cc-quarterly-summary-grid">
          <article className="cc-dashboard-block">
            <div className="cc-dashboard-block__header">
              <div>
                <h2>Contenido fiscal duro</h2>
                <p>Lo que compone el núcleo fiscal del periodo y sustenta la lectura de IVA y saldos.</p>
              </div>
            </div>

            <div className="cc-export-folder-list cc-bounded-list">
              <article className="cc-export-folder-item">
                <strong>01_resumen</strong>
                <p>Resumen HTML/JSON del periodo, con KPIs, rango seleccionado y notas asociadas al cierre si existen.</p>
              </article>
              {fiscalPackGroups.map((group) => (
                <article key={group.id} className="cc-export-folder-item">
                  <strong>{group.title}</strong>
                  <p>{group.detail}</p>
                </article>
              ))}
            </div>
          </article>

          <article className="cc-dashboard-block">
            <div className="cc-dashboard-block__header">
              <div>
                <h2>Trazabilidad y revisión</h2>
                <p>Material administrativo y de control que acompaña el paquete sin contaminar la base puramente fiscal.</p>
              </div>
            </div>

            <div className="cc-export-folder-list cc-bounded-list">
              {administrativePackGroups.map((group) => (
                <article key={group.id} className="cc-export-folder-item">
                  <strong>{group.title}</strong>
                  <p>{group.detail}</p>
                </article>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="cc-dashboard-block">
        <div className="cc-dashboard-block__header">
          <div>
            <h2>Estructura final del ZIP</h2>
            <p>La estructura actual del paquete se mantiene, pero ahora se explica antes de descargar para reducir incertidumbre.</p>
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
