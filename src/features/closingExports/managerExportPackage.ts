import type { ClientListItem } from '../clients/types'
import { createExpenseReceiptSignedUrl } from '../expenses/expenseAttachmentsApi'
import {
  getExpenseAiFiscalClassificationLabel,
  getExpenseDocumentSupportStatusLabel,
  getExpenseFiscalRiskLevelLabel,
  getExpenseFiscalReviewStatusLabel,
  type ExpenseListItem,
} from '../expenses/types'
import {
  buildExpenseFiscalSummary,
  getEstimatedDeductibleBase,
  getEstimatedDeductibleVat,
  hasMediumHighFiscalRisk,
  hasValidVatInvoiceSupport,
  needsFiscalReview,
} from '../expenses/fiscalIntelligenceSummary'
import { buildInvoicePrintDocumentHtml } from '../invoices/openInvoicePrintWindow'
import type { InvoiceListItem } from '../invoices/types'
import type { PaymentListItem } from '../payments/types'
import type { PropertyListItem } from '../properties/types'
import { buildQuotePrintDocumentHtml } from '../quotes/openQuotePrintWindow'
import type { QuoteListItem } from '../quotes/types'

type ExportScope = 'month' | 'quarterly' | 'annual' | 'custom'

interface ExportIncidence {
  id: string
  label: string
  detail: string
  count: number
  tone: 'neutral' | 'warning' | 'danger'
}

interface ExportSummaryMetrics {
  invoice_count: number
  payment_count: number
  expense_count: number
  quote_count?: number
  pending_invoice_count: number
  unresolved_incidence_count: number
  invoiced_total: number
  collected_total: number
  outstanding_total: number
  expenses_total: number
  total_vat_supported?: number
  estimated_deductible_vat?: number
  estimated_deductible_base?: number
  output_vat_total?: number
  estimated_net_vat_payable?: number
  fiscal_review_count?: number
  fiscal_risk_count?: number
  missing_valid_vat_invoice_count?: number
  supported_expense_count?: number
  missing_support_count?: number
  support_coverage_ratio?: number
}

interface ExportPackageInput {
  scope: ExportScope
  label: string
  folderName: string
  periodStartDate: string
  periodEndDate: string
  closingSavedAt: string | null
  closingNotes: string | null
  summaryMetrics: ExportSummaryMetrics
  invoices: InvoiceListItem[]
  payments: PaymentListItem[]
  expenses: ExpenseListItem[]
  quotes: QuoteListItem[]
  clients: ClientListItem[]
  properties: PropertyListItem[]
  incidences: ExportIncidence[]
}

export interface ManagerExportPackageResult {
  fileName: string
  includedFiles: number
  missingDocuments: number
  warnings: string[]
}

interface ZipEntry {
  path: string
  data: Uint8Array
  date: Date
}

const encoder = new TextEncoder()

function sanitizePathPart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Sin fecha'
  const normalized = value.length > 10 ? value : `${value}T00:00:00`
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: value.length > 10 ? 'short' : undefined,
  }).format(date)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function toCsvRow(values: Array<string | number | null | undefined>): string {
  return values
    .map((value) => {
      const stringValue = value == null ? '' : String(value)
      return `"${stringValue.replace(/"/g, '""')}"`
    })
    .join(',')
}

function buildCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  return [toCsvRow(headers), ...rows.map((row) => toCsvRow(row))].join('\n')
}

function getAttachmentExtension(path: string | null): string {
  if (!path) return ''
  const clean = path.split('?')[0]
  const fileName = clean.split('/').pop() ?? ''
  const dotIndex = fileName.lastIndexOf('.')
  return dotIndex >= 0 ? fileName.slice(dotIndex) : ''
}

function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}

async function fetchAsDataUrl(path: string): Promise<string> {
  const response = await fetch(path)
  if (!response.ok) {
    throw new Error(`No se pudo cargar el recurso ${path} (${response.status}).`)
  }

  const blob = await response.blob()

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error(`No se pudo leer el recurso ${path}.`))
    reader.readAsDataURL(blob)
  })
}

function makeTextEntry(path: string, content: string): ZipEntry {
  return {
    path,
    data: encoder.encode(content),
    date: new Date(),
  }
}

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const output = new Uint8Array(totalLength)
  let offset = 0

  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.length
  }

  return output
}

function createCrc32Table(): Uint32Array {
  const table = new Uint32Array(256)

  for (let index = 0; index < 256; index += 1) {
    let current = index
    for (let bit = 0; bit < 8; bit += 1) {
      current = (current & 1) !== 0 ? 0xedb88320 ^ (current >>> 1) : current >>> 1
    }
    table[index] = current >>> 0
  }

  return table
}

const crc32Table = createCrc32Table()

function crc32(data: Uint8Array): number {
  let current = 0xffffffff

  for (let index = 0; index < data.length; index += 1) {
    current = crc32Table[(current ^ data[index]) & 0xff] ^ (current >>> 8)
  }

  return (current ^ 0xffffffff) >>> 0
}

function getDosDateTime(date: Date) {
  const year = Math.max(date.getFullYear(), 1980)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const seconds = Math.floor(date.getSeconds() / 2)

  return {
    dosTime: (hours << 11) | (minutes << 5) | seconds,
    dosDate: ((year - 1980) << 9) | (month << 5) | day,
  }
}

function writeUint16(buffer: DataView, offset: number, value: number) {
  buffer.setUint16(offset, value, true)
}

function writeUint32(buffer: DataView, offset: number, value: number) {
  buffer.setUint32(offset, value >>> 0, true)
}

function buildStoredZip(entries: ZipEntry[]): Blob {
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const fileNameBytes = encoder.encode(entry.path)
    const crc = crc32(entry.data)
    const { dosDate, dosTime } = getDosDateTime(entry.date)

    const localHeader = new Uint8Array(30 + fileNameBytes.length)
    const localView = new DataView(localHeader.buffer)
    writeUint32(localView, 0, 0x04034b50)
    writeUint16(localView, 4, 20)
    writeUint16(localView, 6, 0x0800)
    writeUint16(localView, 8, 0)
    writeUint16(localView, 10, dosTime)
    writeUint16(localView, 12, dosDate)
    writeUint32(localView, 14, crc)
    writeUint32(localView, 18, entry.data.length)
    writeUint32(localView, 22, entry.data.length)
    writeUint16(localView, 26, fileNameBytes.length)
    writeUint16(localView, 28, 0)
    localHeader.set(fileNameBytes, 30)

    const centralHeader = new Uint8Array(46 + fileNameBytes.length)
    const centralView = new DataView(centralHeader.buffer)
    writeUint32(centralView, 0, 0x02014b50)
    writeUint16(centralView, 4, 20)
    writeUint16(centralView, 6, 20)
    writeUint16(centralView, 8, 0x0800)
    writeUint16(centralView, 10, 0)
    writeUint16(centralView, 12, dosTime)
    writeUint16(centralView, 14, dosDate)
    writeUint32(centralView, 16, crc)
    writeUint32(centralView, 20, entry.data.length)
    writeUint32(centralView, 24, entry.data.length)
    writeUint16(centralView, 28, fileNameBytes.length)
    writeUint16(centralView, 30, 0)
    writeUint16(centralView, 32, 0)
    writeUint16(centralView, 34, 0)
    writeUint16(centralView, 36, 0)
    writeUint32(centralView, 38, 0)
    writeUint32(centralView, 42, offset)
    centralHeader.set(fileNameBytes, 46)

    localParts.push(localHeader, entry.data)
    centralParts.push(centralHeader)
    offset += localHeader.length + entry.data.length
  }

  const centralDirectory = concatUint8Arrays(centralParts)
  const endRecord = new Uint8Array(22)
  const endView = new DataView(endRecord.buffer)
  writeUint32(endView, 0, 0x06054b50)
  writeUint16(endView, 4, 0)
  writeUint16(endView, 6, 0)
  writeUint16(endView, 8, entries.length)
  writeUint16(endView, 10, entries.length)
  writeUint32(endView, 12, centralDirectory.length)
  writeUint32(endView, 16, offset)
  writeUint16(endView, 20, 0)

  const blobParts = [...localParts, centralDirectory, endRecord].map(
    (chunk) => new Uint8Array(chunk).buffer,
  )

  return new Blob(blobParts, { type: 'application/zip' })
}

function buildIndexHtml(input: ExportPackageInput, missingDocuments: number): string {
  const incidenceRows = input.incidences
    .map((incidence) => `<li><strong>${escapeHtml(incidence.label)}:</strong> ${incidence.count} · ${escapeHtml(incidence.detail)}</li>`)
    .join('')

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(input.folderName)}</title>
    <style>
      body { font-family: Inter, Arial, sans-serif; margin: 0; padding: 24px; background: #f5f7fb; color: #0f172a; }
      main { max-width: 980px; margin: 0 auto; background: #fff; border-radius: 20px; padding: 24px; border: 1px solid #dbe3ee; }
      h1, h2 { margin: 0 0 12px; }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin: 20px 0; }
      .card { border: 1px solid #dbe3ee; border-radius: 16px; padding: 16px; background: #fbfdff; }
      ul { margin: 8px 0 0; padding-left: 20px; }
      code { background: #eef2f7; padding: 2px 6px; border-radius: 8px; }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(input.label)}</h1>
      <p>Paquete fiscal generado desde CostaClean CRM para el periodo ${escapeHtml(formatDate(input.periodStartDate))} - ${escapeHtml(formatDate(input.periodEndDate))}.</p>
      <div class="grid">
        <section class="card">
          <h2>Estructura</h2>
          <ul>
            <li><code>01_resumen</code></li>
            <li><code>02_facturas_emitidas</code></li>
            <li><code>03_cobros</code></li>
            <li><code>04_gastos_y_soportes</code></li>
            <li><code>05_presupuestos_administrativos</code></li>
            <li><code>06_incidencias_pendientes</code></li>
            <li><code>07_revision_gestoria</code></li>
          </ul>
        </section>
        <section class="card">
          <h2>Estado documental</h2>
          <ul>
            <li>Facturas: ${input.invoices.length}</li>
            <li>Cobros: ${input.payments.length}</li>
            <li>Gastos: ${input.expenses.length}</li>
            <li>Presupuestos administrativos: ${input.quotes.length}</li>
            <li>Soportes descargables: ${input.summaryMetrics.supported_expense_count ?? Math.max(input.expenses.length - missingDocuments, 0)}</li>
            <li>Soportes faltantes o no descargables: ${missingDocuments}</li>
          </ul>
        </section>
      </div>
      <section class="card">
        <h2>Lectura previa a gestoría</h2>
        <ul>
          <li>Este paquete separa el núcleo fiscal de la trazabilidad administrativa.</li>
          <li>Las cifras de IVA son una lectura operativa del periodo, no una liquidación definitiva.</li>
          <li>Las incidencias abiertas viajan en carpeta separada para no ocultar huecos documentales o de revisión.</li>
        </ul>
      </section>
      <section class="card">
        <h2>Incidencias</h2>
        <ul>${incidenceRows || '<li>Sin incidencias abiertas en el paquete.</li>'}</ul>
      </section>
    </main>
  </body>
</html>`
}

function buildSummaryHtml(input: ExportPackageInput): string {
  const metrics = input.summaryMetrics
  const fiscalSummary = buildExpenseFiscalSummary(input.expenses)

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(input.label)} · Resumen</title>
    <style>
      body { font-family: Inter, Arial, sans-serif; margin: 0; padding: 24px; background: #f5f7fb; color: #0f172a; }
      main { max-width: 1120px; margin: 0 auto; background: #fff; border-radius: 20px; padding: 24px; border: 1px solid #dbe3ee; }
      .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-top: 20px; }
      .card { border: 1px solid #dbe3ee; border-radius: 16px; padding: 16px; background: #fbfdff; }
      .label { display: block; font-size: 12px; text-transform: uppercase; color: #64748b; margin-bottom: 8px; }
      strong { font-size: 22px; }
      p { margin: 6px 0 0; color: #475569; }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(input.label)}</h1>
      <p>Periodo: ${escapeHtml(formatDate(input.periodStartDate))} - ${escapeHtml(formatDate(input.periodEndDate))}</p>
      <p>Cierre guardado: ${escapeHtml(formatDate(input.closingSavedAt))}</p>
      <p>Notas: ${escapeHtml(input.closingNotes?.trim() || 'Sin notas de cierre asociadas al paquete.')}</p>
      <div class="grid">
        <article class="card"><span class="label">Facturado</span><strong>${escapeHtml(formatCurrency(metrics.invoiced_total))}</strong><p>${metrics.invoice_count} factura(s)</p></article>
        <article class="card"><span class="label">Cobrado</span><strong>${escapeHtml(formatCurrency(metrics.collected_total))}</strong><p>${metrics.payment_count} cobro(s)</p></article>
        <article class="card"><span class="label">Pendiente</span><strong>${escapeHtml(formatCurrency(metrics.outstanding_total))}</strong><p>${metrics.pending_invoice_count} factura(s) abiertas</p></article>
        <article class="card"><span class="label">Gastos</span><strong>${escapeHtml(formatCurrency(metrics.expenses_total))}</strong><p>${metrics.expense_count} gasto(s)</p></article>
        <article class="card"><span class="label">IVA repercutido</span><strong>${escapeHtml(formatCurrency(metrics.output_vat_total ?? 0))}</strong><p>Segun facturas emitidas del periodo</p></article>
        <article class="card"><span class="label">IVA soportado</span><strong>${escapeHtml(formatCurrency(metrics.total_vat_supported ?? fiscalSummary.totalVatSupported))}</strong><p>Base fiscal de revision</p></article>
        <article class="card"><span class="label">IVA deducible estimado</span><strong>${escapeHtml(formatCurrency(metrics.estimated_deductible_vat ?? fiscalSummary.estimatedDeductibleVat))}</strong><p>Estimacion operativa, no liquidacion definitiva</p></article>
        <article class="card"><span class="label">IVA neto estimado</span><strong>${escapeHtml(formatCurrency(metrics.estimated_net_vat_payable ?? 0))}</strong><p>IVA repercutido menos IVA deducible estimado</p></article>
        <article class="card"><span class="label">Base deducible estimada</span><strong>${escapeHtml(formatCurrency(metrics.estimated_deductible_base ?? fiscalSummary.estimatedDeductibleBase))}</strong><p>Segun campos fiscales disponibles</p></article>
        <article class="card"><span class="label">Presupuestos administrativos</span><strong>${input.quotes.length}</strong><p>Separados del bloque puramente fiscal</p></article>
        <article class="card"><span class="label">Gastos a revisar</span><strong>${metrics.fiscal_review_count ?? fiscalSummary.needsReviewCount}</strong><p>Riesgo medio/alto: ${metrics.fiscal_risk_count ?? fiscalSummary.mediumHighRiskCount}</p></article>
        <article class="card"><span class="label">Sin factura valida IVA</span><strong>${metrics.missing_valid_vat_invoice_count ?? fiscalSummary.missingValidVatInvoiceCount}</strong><p>Requieren revision documental</p></article>
        <article class="card"><span class="label">Soportes descargables</span><strong>${metrics.supported_expense_count ?? Math.max(input.expenses.length - (metrics.missing_support_count ?? 0), 0)}</strong><p>Cobertura documental: ${(metrics.support_coverage_ratio ?? 100).toFixed(1)}%</p></article>
        <article class="card"><span class="label">Huecos documentales</span><strong>${metrics.missing_support_count ?? 0}</strong><p>Soportes faltantes o no descargables dentro del periodo</p></article>
      </div>
      <section class="card" style="margin-top:16px;">
        <h2>Cómo leer este resumen</h2>
        <p>Las cifras fiscales sirven para revisión operativa del cierre. Donde se indica “estimado”, el dato orienta validación interna y preparación del pack, pero no reemplaza el criterio final de gestoría ni la liquidación oficial.</p>
      </section>
    </main>
  </body>
</html>`
}

function buildFiscalReviewHtml(input: ExportPackageInput): string {
  const fiscalSummary = buildExpenseFiscalSummary(input.expenses)
  const rows = input.expenses
    .filter((expense) =>
      needsFiscalReview(expense)
      || hasMediumHighFiscalRisk(expense)
      || !hasValidVatInvoiceSupport(expense),
    )
    .map((expense) => `
      <tr>
        <td>${escapeHtml(expense.display_code ?? expense.id)}</td>
        <td>${escapeHtml(expense.supplier_name)}</td>
        <td>${escapeHtml(formatCurrency(Number(expense.total || 0)))}</td>
        <td>${escapeHtml(getExpenseDocumentSupportStatusLabel(expense.document_support_status))}</td>
        <td>${escapeHtml(getExpenseFiscalReviewStatusLabel(expense.fiscal_review_status))}</td>
        <td>${escapeHtml(getExpenseFiscalRiskLevelLabel(expense.ai_fiscal_risk_level ?? expense.fiscal_risk_level))}</td>
        <td>${escapeHtml(formatCurrency(getEstimatedDeductibleBase(expense)))}</td>
        <td>${escapeHtml(formatCurrency(getEstimatedDeductibleVat(expense)))}</td>
      </tr>`)
    .join('')

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(input.label)} · Revision fiscal</title>
    <style>
      body { font-family: Inter, Arial, sans-serif; margin: 0; padding: 24px; background: #f5f7fb; color: #0f172a; }
      main { max-width: 1120px; margin: 0 auto; background: #fff; border-radius: 20px; padding: 24px; border: 1px solid #dbe3ee; }
      .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin: 20px 0; }
      .card { border: 1px solid #dbe3ee; border-radius: 16px; padding: 16px; background: #fbfdff; }
      .label { display: block; font-size: 12px; text-transform: uppercase; color: #64748b; margin-bottom: 8px; }
      strong { font-size: 20px; }
      p { color: #475569; }
      table { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 13px; }
      th, td { border-bottom: 1px solid #e2e8f0; padding: 10px; text-align: left; vertical-align: top; }
      th { color: #475569; text-transform: uppercase; font-size: 11px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Revision fiscal para gestoria</h1>
      <p>Vista de apoyo para revisar gastos, soporte documental, riesgo fiscal e importes deducibles estimados. Es una estimacion operativa y no sustituye la revision profesional.</p>
      <div class="grid">
        <article class="card"><span class="label">IVA repercutido</span><strong>${escapeHtml(formatCurrency(input.summaryMetrics.output_vat_total ?? 0))}</strong></article>
        <article class="card"><span class="label">IVA soportado</span><strong>${escapeHtml(formatCurrency(fiscalSummary.totalVatSupported))}</strong></article>
        <article class="card"><span class="label">IVA deducible estimado</span><strong>${escapeHtml(formatCurrency(fiscalSummary.estimatedDeductibleVat))}</strong></article>
        <article class="card"><span class="label">IVA neto estimado</span><strong>${escapeHtml(formatCurrency((input.summaryMetrics.output_vat_total ?? 0) - fiscalSummary.estimatedDeductibleVat))}</strong></article>
      </div>
      <table>
        <thead>
          <tr>
            <th>Gasto</th><th>Proveedor</th><th>Total</th><th>Soporte</th><th>Revision</th><th>Riesgo</th><th>Base deducible</th><th>IVA deducible</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="8">Sin puntos fiscales prioritarios en este paquete.</td></tr>'}</tbody>
      </table>
    </main>
  </body>
</html>`
}

async function buildExpenseEntries(expenses: ExpenseListItem[], rootFolder: string) {
  const entries: ZipEntry[] = []
  const warnings: string[] = []
  const manifestDocs: Array<Record<string, string | boolean>> = []
  let missingDocuments = 0

  for (const expense of expenses) {
    const baseName = `gasto_${sanitizePathPart(expense.display_code ?? expense.id)}`
    const documentStatus = getExpenseDocumentSupportStatusLabel(expense.document_support_status)
    const reviewStatus = getExpenseFiscalReviewStatusLabel(expense.fiscal_review_status)
    const riskStatus = getExpenseFiscalRiskLevelLabel(expense.ai_fiscal_risk_level ?? expense.fiscal_risk_level)

    if (!expense.receipt_file_path) {
      missingDocuments += 1
      manifestDocs.push({
        expense: expense.display_code ?? expense.id,
        included: false,
        detail: 'Sin adjunto en la aplicación',
      })
      continue
    }

    try {
      const signedUrl = await createExpenseReceiptSignedUrl(expense.receipt_file_path)
      const response = await fetch(signedUrl)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const buffer = new Uint8Array(await response.arrayBuffer())
      const extension = getAttachmentExtension(expense.receipt_file_path) || '.bin'
      entries.push({
        path: `${rootFolder}/04_gastos_y_soportes/soportes/${baseName}${extension}`,
        data: buffer,
        date: new Date(),
      })
      manifestDocs.push({
        expense: expense.display_code ?? expense.id,
        included: true,
        detail: `${documentStatus} · ${reviewStatus} · riesgo ${riskStatus}`,
      })
    } catch (error) {
      missingDocuments += 1
      warnings.push(`No se pudo incluir el soporte del gasto ${expense.display_code ?? expense.id}.`)
      manifestDocs.push({
        expense: expense.display_code ?? expense.id,
        included: false,
        detail: error instanceof Error ? error.message : 'Fallo descargando adjunto',
      })
    }
  }

  return { entries, warnings, missingDocuments, manifestDocs }
}

function buildManifest(input: ExportPackageInput, includedFiles: number, missingDocuments: number, warnings: string[]) {
  const fiscalSummary = buildExpenseFiscalSummary(input.expenses)
  return {
    generated_at: new Date().toISOString(),
    scope: input.scope,
    label: input.label,
    folder_name: input.folderName,
    period_start_date: input.periodStartDate,
    period_end_date: input.periodEndDate,
    closing_saved_at: input.closingSavedAt,
    notes: input.closingNotes,
    summary_metrics: input.summaryMetrics,
    fiscal_review_metrics: {
      total_vat_supported: fiscalSummary.totalVatSupported,
      estimated_deductible_vat: fiscalSummary.estimatedDeductibleVat,
      estimated_deductible_base: fiscalSummary.estimatedDeductibleBase,
      needs_review_count: fiscalSummary.needsReviewCount,
      medium_high_risk_count: fiscalSummary.mediumHighRiskCount,
      missing_valid_vat_invoice_count: fiscalSummary.missingValidVatInvoiceCount,
      analyzed_count: fiscalSummary.analyzedCount,
      unanalyzed_count: fiscalSummary.unanalyzedCount,
    },
    included_files: includedFiles,
    missing_documents: missingDocuments,
    warnings,
    sections: [
      '01_resumen',
      '02_facturas_emitidas',
      '03_cobros',
      '04_gastos_y_soportes',
      '05_presupuestos_administrativos',
      '06_incidencias_pendientes',
      '07_revision_gestoria',
    ],
    incidences: input.incidences.map((incidence) => ({
      id: incidence.id,
      label: incidence.label,
      detail: incidence.detail,
      count: incidence.count,
      tone: incidence.tone,
    })),
  }
}

export async function downloadManagerExportPackage(input: ExportPackageInput): Promise<ManagerExportPackageResult> {
  const rootFolder = sanitizePathPart(input.folderName) || 'costa_clean_export'
  const entries: ZipEntry[] = []
  let exportLogoSrc = '/branding/logo-costa-clean-web.png'

  try {
    exportLogoSrc = await fetchAsDataUrl('/branding/logo-costa-clean-web.png')
  } catch {
    // Keep fallback public path for robustness.
  }

  entries.push(makeTextEntry(`${rootFolder}/00_indice.html`, buildIndexHtml(input, 0)))
  entries.push(makeTextEntry(`${rootFolder}/01_resumen/resumen.html`, buildSummaryHtml(input)))
  entries.push(makeTextEntry(`${rootFolder}/01_resumen/resumen.json`, JSON.stringify({
    label: input.label,
    period_start_date: input.periodStartDate,
    period_end_date: input.periodEndDate,
    closing_saved_at: input.closingSavedAt,
    notes: input.closingNotes,
    metrics: input.summaryMetrics,
  }, null, 2)))

  const invoiceCsv = buildCsv(
    ['invoice_ref', 'issue_date', 'client', 'status', 'subtotal', 'tax_amount', 'total', 'document_file'],
    input.invoices.map((invoice) => {
      const invoiceRef = invoice.invoice_number ?? invoice.display_code ?? invoice.id
      const fileName = `factura_${sanitizePathPart(invoiceRef)}.html`
      const invoiceHtml = buildInvoicePrintDocumentHtml(invoice, 'pdf', { logoSrc: exportLogoSrc })
      entries.push(makeTextEntry(`${rootFolder}/02_facturas_emitidas/documentos/${fileName}`, invoiceHtml))
      return [
        invoiceRef,
        invoice.issue_date,
        invoice.client_name ?? invoice.client_display_code ?? invoice.client_id,
        invoice.status,
        Number(invoice.subtotal || 0).toFixed(2),
        Number(invoice.tax_amount || 0).toFixed(2),
        Number(invoice.total || 0).toFixed(2),
        fileName,
      ]
    }),
  )
  entries.push(makeTextEntry(`${rootFolder}/02_facturas_emitidas/facturas.csv`, invoiceCsv))

  const paymentsCsv = buildCsv(
    ['payment_ref', 'payment_date', 'invoice_ref', 'amount', 'payment_method', 'notes'],
    input.payments.map((payment) => [
      payment.display_code ?? payment.id,
      payment.payment_date,
      payment.invoice_number ?? payment.invoice_display_code ?? payment.invoice_id,
      Number(payment.amount || 0).toFixed(2),
      payment.payment_method ?? '',
      payment.notes ?? '',
    ]),
  )
  entries.push(makeTextEntry(`${rootFolder}/03_cobros/cobros.csv`, paymentsCsv))

  const expensesCsv = buildCsv(
    [
      'expense_ref',
      'date',
      'supplier',
      'category',
      'subtotal',
      'tax_amount',
      'total',
      'document_type',
      'document_support_status',
      'fiscal_review_status',
      'fiscal_risk_level',
      'ai_classification',
      'ai_confidence',
      'estimated_deductible_base',
      'estimated_deductible_vat',
      'attachment_expected',
      'manager_note',
    ],
    input.expenses.map((expense) => [
      expense.display_code ?? expense.id,
      expense.expense_date,
      expense.supplier_name,
      expense.category,
      Number(expense.subtotal || 0).toFixed(2),
      Number(expense.tax_amount || 0).toFixed(2),
      Number(expense.total || 0).toFixed(2),
      expense.document_type,
      getExpenseDocumentSupportStatusLabel(expense.document_support_status),
      getExpenseFiscalReviewStatusLabel(expense.fiscal_review_status),
      getExpenseFiscalRiskLevelLabel(expense.ai_fiscal_risk_level ?? expense.fiscal_risk_level),
      getExpenseAiFiscalClassificationLabel(expense.ai_fiscal_classification),
      typeof expense.ai_fiscal_confidence === 'number' ? `${Math.round(expense.ai_fiscal_confidence * 100)}%` : '',
      getEstimatedDeductibleBase(expense).toFixed(2),
      getEstimatedDeductibleVat(expense).toFixed(2),
      expense.receipt_file_path ? 'included_if_downloadable' : 'missing',
      expense.manager_note ?? '',
    ]),
  )
  entries.push(makeTextEntry(`${rootFolder}/04_gastos_y_soportes/gastos.csv`, expensesCsv))

  const quotesCsv = buildCsv(
    ['quote_ref', 'created_at', 'status', 'client', 'property', 'subtotal', 'tax_amount', 'total', 'document_file'],
    input.quotes.map((quote) => {
      const quoteRef = quote.display_code ?? quote.id
      const fileName = `presupuesto_${sanitizePathPart(quoteRef)}.html`
      const quoteHtml = buildQuotePrintDocumentHtml(quote, input.clients, input.properties, 'pdf')
      entries.push(makeTextEntry(`${rootFolder}/05_presupuestos_administrativos/documentos/${fileName}`, quoteHtml))
      return [
        quoteRef,
        quote.created_at ?? '',
        quote.status,
        quote.client_name ?? quote.client_display_code ?? quote.client_id ?? '',
        quote.property_display_code ?? quote.property_id ?? '',
        Number(quote.subtotal || 0).toFixed(2),
        Number(quote.tax_amount || 0).toFixed(2),
        Number(quote.total || 0).toFixed(2),
        fileName,
      ]
    }),
  )
  entries.push(makeTextEntry(`${rootFolder}/05_presupuestos_administrativos/presupuestos.csv`, quotesCsv))

  const fiscalReviewSummary = buildExpenseFiscalSummary(input.expenses)
  const fiscalReviewCsv = buildCsv(
    [
      'expense_ref',
      'supplier',
      'reason',
      'document_support_status',
      'fiscal_review_status',
      'risk_level',
      'ai_classification',
      'estimated_deductible_base',
      'estimated_deductible_vat',
      'ai_reasoning',
      'flags',
    ],
    input.expenses
      .filter((expense) =>
        needsFiscalReview(expense)
        || hasMediumHighFiscalRisk(expense)
        || !hasValidVatInvoiceSupport(expense),
      )
      .map((expense) => {
        const reasons = [
          needsFiscalReview(expense) ? 'requires_review' : null,
          hasMediumHighFiscalRisk(expense) ? 'medium_high_risk' : null,
          !hasValidVatInvoiceSupport(expense) ? 'missing_valid_vat_invoice' : null,
        ].filter(Boolean)

        return [
          expense.display_code ?? expense.id,
          expense.supplier_name,
          reasons.join('|'),
          getExpenseDocumentSupportStatusLabel(expense.document_support_status),
          getExpenseFiscalReviewStatusLabel(expense.fiscal_review_status),
          getExpenseFiscalRiskLevelLabel(expense.ai_fiscal_risk_level ?? expense.fiscal_risk_level),
          getExpenseAiFiscalClassificationLabel(expense.ai_fiscal_classification),
          getEstimatedDeductibleBase(expense).toFixed(2),
          getEstimatedDeductibleVat(expense).toFixed(2),
          expense.ai_fiscal_reasoning ?? '',
          expense.ai_fiscal_flags?.join('|') ?? '',
        ]
      }),
  )
  const gestorReviewChecklist = buildCsv(
    ['check', 'status', 'count', 'detail'],
    [
      ['iva_repercutido_total', 'informativo', (input.summaryMetrics.output_vat_total ?? 0).toFixed(2), 'IVA repercutido total segun facturas emitidas del periodo.'],
      ['iva_soportado_total', 'informativo', fiscalReviewSummary.totalVatSupported.toFixed(2), 'IVA soportado total en gastos del paquete.'],
      ['iva_deducible_estimado', 'estimacion', fiscalReviewSummary.estimatedDeductibleVat.toFixed(2), 'Estimacion operativa, no liquidacion definitiva.'],
      ['iva_neto_estimado', 'estimacion', ((input.summaryMetrics.output_vat_total ?? 0) - fiscalReviewSummary.estimatedDeductibleVat).toFixed(2), 'IVA repercutido menos IVA deducible estimado.'],
      ['base_deducible_estimada', 'estimacion', fiscalReviewSummary.estimatedDeductibleBase.toFixed(2), 'Base deducible estimada por campos fiscales y/o IA.'],
      ['gastos_requieren_revision', fiscalReviewSummary.needsReviewCount > 0 ? 'revisar' : 'ok', fiscalReviewSummary.needsReviewCount, 'Gastos pendientes o marcados por IA como requiere revision.'],
      ['gastos_riesgo_medio_alto', fiscalReviewSummary.mediumHighRiskCount > 0 ? 'revisar' : 'ok', fiscalReviewSummary.mediumHighRiskCount, 'Gastos con riesgo fiscal medio/alto.'],
      ['gastos_sin_factura_valida_iva', fiscalReviewSummary.missingValidVatInvoiceCount > 0 ? 'revisar' : 'ok', fiscalReviewSummary.missingValidVatInvoiceCount, 'Gastos sin factura valida para deducibilidad de IVA.'],
      ['gastos_sin_analisis_ia', fiscalReviewSummary.unanalyzedCount > 0 ? 'informativo' : 'ok', fiscalReviewSummary.unanalyzedCount, 'Gastos todavia no analizados fiscalmente por IA.'],
    ],
  )
  entries.push(makeTextEntry(`${rootFolder}/07_revision_gestoria/resumen_revision_fiscal.html`, buildFiscalReviewHtml(input)))
  entries.push(makeTextEntry(`${rootFolder}/07_revision_gestoria/gastos_revision_fiscal.csv`, fiscalReviewCsv))
  entries.push(makeTextEntry(`${rootFolder}/07_revision_gestoria/checklist_gestoria.csv`, gestorReviewChecklist))
  entries.push(makeTextEntry(`${rootFolder}/07_revision_gestoria/resumen_revision_fiscal.json`, JSON.stringify({
    generated_at: new Date().toISOString(),
    assistive_notice: 'Estimacion operativa para revision. No sustituye asesoramiento fiscal ni revision de gestoria.',
    metrics: fiscalReviewSummary,
  }, null, 2)))

  const incidenceCsv = buildCsv(
    ['incidence_id', 'label', 'count', 'tone', 'detail'],
    input.incidences.map((incidence) => [
      incidence.id,
      incidence.label,
      incidence.count,
      incidence.tone,
      incidence.detail,
    ]),
  )
  entries.push(makeTextEntry(`${rootFolder}/06_incidencias_pendientes/incidencias.csv`, incidenceCsv))

  const expenseAttachmentResult = await buildExpenseEntries(input.expenses, rootFolder)
  entries.push(...expenseAttachmentResult.entries)
  entries.push(makeTextEntry(
    `${rootFolder}/04_gastos_y_soportes/manifest_soportes.json`,
    JSON.stringify(expenseAttachmentResult.manifestDocs, null, 2),
  ))

  const manifestWarnings = [...expenseAttachmentResult.warnings]
  const manifest = buildManifest(
    input,
    entries.length + 1,
    expenseAttachmentResult.missingDocuments,
    manifestWarnings,
  )
  entries.push(makeTextEntry(`${rootFolder}/00_manifest.json`, JSON.stringify(manifest, null, 2)))
  entries[0] = makeTextEntry(`${rootFolder}/00_indice.html`, buildIndexHtml(input, expenseAttachmentResult.missingDocuments))

  const zipBlob = buildStoredZip(entries)
  const fileName = `${rootFolder}.zip`
  downloadBlob(zipBlob, fileName)

  return {
    fileName,
    includedFiles: entries.length,
    missingDocuments: expenseAttachmentResult.missingDocuments,
    warnings: [...manifestWarnings, ...input.incidences.filter((incidence) => incidence.tone !== 'neutral').map((incidence) => `${incidence.label}: ${incidence.count}.`)],
  }
}
