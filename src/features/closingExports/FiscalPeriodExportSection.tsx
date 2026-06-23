import { useMemo, useState } from 'react'
import type { ClientListItem } from '../clients/types'
import { FiscalPeriodSelector } from '../closing/FiscalPeriodSelector'
import type { FiscalPeriodSelection } from '../closing/fiscalPeriods'
import {
  buildFiscalPeriodExportData,
  buildFiscalPeriodIncidences,
} from './fiscalPeriodExport'
import type { ManagerExportPackageResult } from './managerExportPackage'
import type { ExpenseListItem } from '../expenses/types'
import type { InvoiceListItem } from '../invoices/types'
import type { PaymentListItem } from '../payments/types'
import type { PropertyListItem } from '../properties/types'
import type { QuoteListItem } from '../quotes/types'
import {
  buildExternalAccountingPackageStem,
  externalAccountingSectionPaths,
  getExportAudienceLabel,
} from './externalExportPolicy'
import { downloadManagerExportPackageOnDemand } from './exportPackageRuntime'

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
      label: 'Paquete listo para compartir',
      detail: 'La cobertura documental del periodo permite entregar el dossier con buena trazabilidad.',
      toneClass: 'cc-kpi-card--success',
    }
  }

  if (status === 'critical') {
    return {
      label: 'Paquete con documentacion pendiente',
      detail: 'El ZIP puede descargarse, pero conviene completar soportes faltantes antes de compartirlo.',
      toneClass: 'cc-kpi-card--warning',
    }
  }

  return {
    label: 'Paquete listo con observaciones',
    detail: 'La salida externa esta preparada, aunque todavia hay puntos a revisar antes del cierre final.',
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
      const result = await downloadManagerExportPackageOnDemand({
        audience: 'accounting_external',
        scope:
          exportData.period.mode === 'quarter' ? 'quarterly'
            : exportData.period.mode === 'year' ? 'annual'
              : exportData.period.mode,
        label: `Paquete fiscal ${exportData.period.label}`,
        folderName: buildExternalAccountingPackageStem(exportData.period.folderLabel),
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
      setExportError(error instanceof Error ? error.message : 'No se pudo generar el paquete externo del periodo.')
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
            <h2>{showSelector ? 'Paquete externo' : title}</h2>
            <p>{showSelector ? 'La descarga usa exactamente el mismo periodo activo del cierre.' : description}</p>
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
              {exportResult.fileName} - {exportResult.includedFiles} archivo(s) incluidos - {exportResult.missingDocuments} soporte(s) pendiente(s).
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
            <h2>Destino y politica de salida</h2>
            <p>La separacion entre material externo e interno queda resuelta antes de generar el ZIP.</p>
          </div>
        </div>

        <div className="cc-quarterly-summary-grid">
          <article className="cc-dashboard-block">
            <div className="cc-dashboard-block__header">
              <div>
                <h2>Material externo</h2>
                <p>{getExportAudienceLabel('accounting_external')}.</p>
              </div>
            </div>

            <div className="cc-export-folder-list cc-bounded-list">
              <article className="cc-export-folder-item">
                <strong>Incluido</strong>
                <p>Facturas, cobros, gastos, soportes, presupuestos de apoyo y resumen para gestoria.</p>
              </article>
              <article className="cc-export-folder-item">
                <strong>Formato</strong>
                <p>Solo nombres limpios, documentos compartibles y payloads reducidos a informacion util para terceros.</p>
              </article>
            </div>
          </article>

          <article className="cc-dashboard-block">
            <div className="cc-dashboard-block__header">
              <div>
                <h2>Material interno</h2>
                <p>Se mantiene dentro de la aplicacion y no viaja en la descarga externa.</p>
              </div>
            </div>

            <div className="cc-export-folder-list cc-bounded-list">
              <article className="cc-export-folder-item">
                <strong>Excluido</strong>
                <p>Snapshots persistidos, notas internas, paneles operativos, payloads internos y razonamiento interno de IA.</p>
              </article>
              <article className="cc-export-folder-item">
                <strong>Motivo</strong>
                <p>La descarga externa no debe mezclar revision operativa con material destinado a cliente, gestoria o terceros.</p>
              </article>
            </div>
          </article>
        </div>
      </section>

      <section className="cc-dashboard-block">
        <div className="cc-dashboard-block__header">
          <div>
            <h2>Estado previo al envio</h2>
            <p>Antes de descargar, esta vista resume que entra en el ZIP y con que salud documental llegara a terceros.</p>
          </div>
        </div>

        <div className="cc-kpi-grid cc-quarterly-metrics">
          <article className={`cc-kpi-card ${documentHealthCopy.toneClass}`}>
            <span className="cc-kpi-label">Estado del paquete</span>
            <strong className="cc-kpi-value">{documentHealthCopy.label}</strong>
            <p className="cc-kpi-footnote">{documentHealthCopy.detail}</p>
          </article>
          <article className="cc-kpi-card">
            <span className="cc-kpi-label">Cobertura documental</span>
            <strong className="cc-kpi-value">{exportData.documentHealth.supportCoverageRatio}%</strong>
            <p className="cc-kpi-footnote">{exportData.documentHealth.supportedExpenseCount} de {exportData.metrics.expense_count} gasto(s) con soporte descargable.</p>
          </article>
          <article className="cc-kpi-card">
            <span className="cc-kpi-label">Factura valida para IVA</span>
            <strong className="cc-kpi-value">{exportData.documentHealth.validVatInvoiceCount}</strong>
            <p className="cc-kpi-footnote">{exportData.metrics.missing_valid_vat_invoice_count} gasto(s) siguen sin cobertura valida para deduccion.</p>
          </article>
          <article className="cc-kpi-card">
            <span className="cc-kpi-label">Pendientes abiertos</span>
            <strong className="cc-kpi-value">{exportData.metrics.unresolved_incidence_count}</strong>
            <p className="cc-kpi-footnote">Se agrupan en una carpeta propia para facilitar la revision final.</p>
          </article>
        </div>
      </section>

      <section className="cc-kpi-grid cc-quarterly-metrics" aria-label="KPIs del paquete externo por periodo">
        <article className="cc-kpi-card cc-kpi-card--finance">
          <span className="cc-kpi-label">Periodo activo</span>
          <strong className="cc-kpi-value">{exportData.period.label}</strong>
          <p className="cc-kpi-footnote">{exportData.period.startDate} {'->'} {exportData.period.endDate}</p>
        </article>
        <article className="cc-kpi-card cc-kpi-card--finance">
          <span className="cc-kpi-label">IVA repercutido</span>
          <strong className="cc-kpi-value">{formatCurrency(exportData.metrics.output_vat_total)}</strong>
          <p className="cc-kpi-footnote">Segun facturas emitidas del periodo</p>
        </article>
        <article className="cc-kpi-card">
          <span className="cc-kpi-label">IVA deducible estimado</span>
          <strong className="cc-kpi-value">{formatCurrency(exportData.metrics.estimated_deductible_vat)}</strong>
          <p className="cc-kpi-footnote">Estimacion documental basada en gastos y soporte</p>
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
          <span className="cc-kpi-label">Presupuestos de apoyo</span>
          <strong className="cc-kpi-value">{exportData.metrics.quote_count}</strong>
          <p className="cc-kpi-footnote">Se entregan aparte del bloque fiscal principal</p>
        </article>
        <article className="cc-kpi-card">
          <span className="cc-kpi-label">Soportes descargables</span>
          <strong className="cc-kpi-value">{exportData.metrics.supported_expense_count}</strong>
          <p className="cc-kpi-footnote">{exportData.metrics.missing_support_count} gasto(s) siguen con documentacion pendiente.</p>
        </article>
      </section>

      <section className="cc-dashboard-block">
        <div className="cc-dashboard-block__header">
          <div>
            <h2>Que entra en el paquete</h2>
            <p>Separacion visual entre documentacion fiscal principal y material de apoyo para revision.</p>
          </div>
        </div>

        <div className="cc-quarterly-summary-grid">
          <article className="cc-dashboard-block">
            <div className="cc-dashboard-block__header">
              <div>
                <h2>Bloque fiscal principal</h2>
                <p>Documentos y listados que sustentan la lectura fiscal del periodo.</p>
              </div>
            </div>

            <div className="cc-export-folder-list cc-bounded-list">
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
                <h2>Material de apoyo y revision</h2>
                <p>Contenido complementario que acompana el dossier sin mezclarse con material interno.</p>
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
            <p>La descarga conserva la utilidad del paquete, pero con naming externo unificado y sin semantica interna.</p>
          </div>
        </div>

        <div className="cc-export-folder-list cc-bounded-list">
          <article className="cc-export-folder-item">
            <strong>{externalAccountingSectionPaths.summary}</strong>
            <p>Resumen del periodo y sintesis de cifras clave.</p>
          </article>
          <article className="cc-export-folder-item">
            <strong>{externalAccountingSectionPaths.invoices}</strong>
            <p>{`${exportData.metrics.invoice_count} factura(s) con CSV resumen y HTML listo para imprimir o guardar como PDF.`}</p>
          </article>
          <article className="cc-export-folder-item">
            <strong>{externalAccountingSectionPaths.payments}</strong>
            <p>{`${exportData.metrics.payment_count} cobro(s) con CSV de seguimiento y referencia a la factura vinculada.`}</p>
          </article>
          <article className="cc-export-folder-item">
            <strong>{externalAccountingSectionPaths.expenses}</strong>
            <p>{`${exportData.metrics.expense_count} gasto(s) con CSV limpio, JSON de soportes incluidos y adjuntos descargables cuando existen.`}</p>
          </article>
          <article className="cc-export-folder-item">
            <strong>{externalAccountingSectionPaths.quotes}</strong>
            <p>{`${exportData.metrics.quote_count} presupuesto(s) del periodo en carpeta separada como referencia comercial.`}</p>
          </article>
          <article className="cc-export-folder-item">
            <strong>{externalAccountingSectionPaths.pendingItems}</strong>
            <p>{`${exportData.metrics.unresolved_incidence_count} pendiente(s) resumidos para cerrar huecos antes de la entrega final.`}</p>
          </article>
          <article className="cc-export-folder-item">
            <strong>{externalAccountingSectionPaths.accountantReview}</strong>
            <p>Resumen fiscal del periodo y listado de gastos que conviene revisar con mas detalle.</p>
          </article>
        </div>
      </section>
    </>
  )
}
