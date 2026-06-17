import type { ClientListItem } from '../clients/types'
import { createExpenseReceiptSignedUrl } from '../expenses/expenseAttachmentsApi'
import {
  getExpenseDocumentSupportStatusLabel,
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
import {
  buildInvoicePrintDocumentHtml,
  getInvoiceDocumentFileStem,
} from '../invoices/openInvoicePrintWindow'
import type { InvoiceListItem } from '../invoices/types'
import type { PaymentListItem } from '../payments/types'
import type { PropertyListItem } from '../properties/types'
import {
  buildQuotePrintDocumentHtml,
  getQuoteDocumentFileStem,
} from '../quotes/openQuotePrintWindow'
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

interface IncludedSupportItem {
  gasto: string
  adjunto_incluido: boolean
  archivo: string | null
  observacion: string
}

const encoder = new TextEncoder()

const exportSectionPaths = {
  cover: '00_guia_del_paquete',
  summary: '01_resumen',
  invoices: '02_facturas_emitidas',
  payments: '03_cobros',
  expenses: '04_gastos_y_soportes',
  quotes: '05_presupuestos_comerciales',
  pendingItems: '06_pendientes_de_revision',
  accountantReview: '07_resumen_para_gestoria',
} as const

const exportSectionLabels = [
  exportSectionPaths.summary,
  exportSectionPaths.invoices,
  exportSectionPaths.payments,
  exportSectionPaths.expenses,
  exportSectionPaths.quotes,
  exportSectionPaths.pendingItems,
  exportSectionPaths.accountantReview,
]

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

function formatPeriodRange(startDate: string, endDate: string): string {
  return `${formatDate(startDate)} - ${formatDate(endDate)}`
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

function buildReviewReason(expense: ExpenseListItem): string {
  const reasons: string[] = []

  if (!hasValidVatInvoiceSupport(expense)) {
    reasons.push('Revisar soporte documental del gasto')
  }
  if (needsFiscalReview(expense)) {
    reasons.push('Revision fiscal pendiente')
  }
  if (hasMediumHighFiscalRisk(expense)) {
    reasons.push('Confirmar el tratamiento fiscal')
  }

  return reasons.join(' / ') || 'Sin observaciones'
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
      <p>Documentacion preparada para revision fiscal del periodo ${escapeHtml(formatPeriodRange(input.periodStartDate, input.periodEndDate))}.</p>
      <div class="grid">
        <section class="card">
          <h2>Estructura</h2>
          <ul>${exportSectionLabels.map((section) => `<li><code>${section}</code></li>`).join('')}</ul>
        </section>
        <section class="card">
          <h2>Contenido</h2>
          <ul>
            <li>Facturas: ${input.invoices.length}</li>
            <li>Cobros: ${input.payments.length}</li>
            <li>Gastos: ${input.expenses.length}</li>
            <li>Presupuestos de apoyo: ${input.quotes.length}</li>
            <li>Soportes descargables: ${input.summaryMetrics.supported_expense_count ?? Math.max(input.expenses.length - missingDocuments, 0)}</li>
            <li>Soportes pendientes: ${missingDocuments}</li>
          </ul>
        </section>
      </div>
      <section class="card">
        <h2>Lectura recomendada</h2>
        <ul>
          <li>La documentacion fiscal principal queda separada del material comercial y de revision.</li>
          <li>Las cifras estimadas sirven como apoyo documental y deben confirmarse con el criterio final de gestoria.</li>
          <li>Los pendientes se agrupan aparte para facilitar la revision completa del periodo.</li>
        </ul>
      </section>
      <section class="card">
        <h2>Pendientes destacados</h2>
        <ul>${incidenceRows || '<li>Sin pendientes abiertos en el paquete.</li>'}</ul>
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
      <p>Periodo: ${escapeHtml(formatPeriodRange(input.periodStartDate, input.periodEndDate))}</p>
      <p>Resumen preparado: ${escapeHtml(formatDate(input.closingSavedAt))}</p>
      <div class="grid">
        <article class="card"><span class="label">Facturado</span><strong>${escapeHtml(formatCurrency(metrics.invoiced_total))}</strong><p>${metrics.invoice_count} factura(s)</p></article>
        <article class="card"><span class="label">Cobrado</span><strong>${escapeHtml(formatCurrency(metrics.collected_total))}</strong><p>${metrics.payment_count} cobro(s)</p></article>
        <article class="card"><span class="label">Pendiente</span><strong>${escapeHtml(formatCurrency(metrics.outstanding_total))}</strong><p>${metrics.pending_invoice_count} factura(s) abiertas</p></article>
        <article class="card"><span class="label">Gastos</span><strong>${escapeHtml(formatCurrency(metrics.expenses_total))}</strong><p>${metrics.expense_count} gasto(s)</p></article>
        <article class="card"><span class="label">IVA repercutido</span><strong>${escapeHtml(formatCurrency(metrics.output_vat_total ?? 0))}</strong><p>Segun facturas emitidas del periodo</p></article>
        <article class="card"><span class="label">IVA soportado</span><strong>${escapeHtml(formatCurrency(metrics.total_vat_supported ?? fiscalSummary.totalVatSupported))}</strong><p>Documentacion validada del periodo</p></article>
        <article class="card"><span class="label">IVA deducible estimado</span><strong>${escapeHtml(formatCurrency(metrics.estimated_deductible_vat ?? fiscalSummary.estimatedDeductibleVat))}</strong><p>Dato orientativo para revision</p></article>
        <article class="card"><span class="label">Base deducible estimada</span><strong>${escapeHtml(formatCurrency(metrics.estimated_deductible_base ?? fiscalSummary.estimatedDeductibleBase))}</strong><p>Base asociada a los gastos revisables</p></article>
        <article class="card"><span class="label">Presupuestos de apoyo</span><strong>${input.quotes.length}</strong><p>Se adjuntan aparte del bloque fiscal principal</p></article>
        <article class="card"><span class="label">Gastos con revision</span><strong>${metrics.fiscal_review_count ?? fiscalSummary.needsReviewCount}</strong><p>${metrics.fiscal_risk_count ?? fiscalSummary.mediumHighRiskCount} con observacion fiscal</p></article>
        <article class="card"><span class="label">Soportes incluidos</span><strong>${metrics.supported_expense_count ?? Math.max(input.expenses.length - (metrics.missing_support_count ?? 0), 0)}</strong><p>Cobertura documental ${(metrics.support_coverage_ratio ?? 100).toFixed(1)}%</p></article>
        <article class="card"><span class="label">Soportes pendientes</span><strong>${metrics.missing_support_count ?? 0}</strong><p>Documentos que conviene completar antes del cierre final</p></article>
      </div>
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
        <td>${escapeHtml(buildReviewReason(expense))}</td>
        <td>${escapeHtml(formatCurrency(getEstimatedDeductibleBase(expense)))}</td>
        <td>${escapeHtml(formatCurrency(getEstimatedDeductibleVat(expense)))}</td>
      </tr>`)
    .join('')

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(input.label)} · Revision</title>
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
      <h1>Resumen para gestoria</h1>
      <p>Vista de apoyo para revisar soporte documental y deducibilidad estimada de los gastos del periodo.</p>
      <div class="grid">
        <article class="card"><span class="label">IVA repercutido</span><strong>${escapeHtml(formatCurrency(input.summaryMetrics.output_vat_total ?? 0))}</strong></article>
        <article class="card"><span class="label">IVA soportado</span><strong>${escapeHtml(formatCurrency(fiscalSummary.totalVatSupported))}</strong></article>
        <article class="card"><span class="label">IVA deducible estimado</span><strong>${escapeHtml(formatCurrency(fiscalSummary.estimatedDeductibleVat))}</strong></article>
        <article class="card"><span class="label">IVA neto estimado</span><strong>${escapeHtml(formatCurrency((input.summaryMetrics.output_vat_total ?? 0) - fiscalSummary.estimatedDeductibleVat))}</strong></article>
      </div>
      <table>
        <thead>
          <tr>
            <th>Gasto</th><th>Proveedor</th><th>Total</th><th>Soporte</th><th>Observacion</th><th>Base deducible</th><th>IVA deducible</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="7">Sin gastos prioritarios para revisar en este paquete.</td></tr>'}</tbody>
      </table>
    </main>
  </body>
</html>`
}

async function buildExpenseEntries(expenses: ExpenseListItem[], rootFolder: string) {
  const entries: ZipEntry[] = []
  const warnings: string[] = []
  const includedSupports: IncludedSupportItem[] = []
  let missingDocuments = 0

  for (const expense of expenses) {
    const expenseRef = expense.display_code ?? expense.id
    const baseName = `gasto_${sanitizePathPart(expenseRef)}`

    if (!expense.receipt_file_path) {
      missingDocuments += 1
      includedSupports.push({
        gasto: expenseRef,
        adjunto_incluido: false,
        archivo: null,
        observacion: 'Sin adjunto disponible',
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
      const fileName = `${baseName}${extension}`
      entries.push({
        path: `${rootFolder}/${exportSectionPaths.expenses}/soportes/${fileName}`,
        data: buffer,
        date: new Date(),
      })
      includedSupports.push({
        gasto: expenseRef,
        adjunto_incluido: true,
        archivo: fileName,
        observacion: getExpenseDocumentSupportStatusLabel(expense.document_support_status),
      })
    } catch (error) {
      missingDocuments += 1
      warnings.push(`No se pudo incluir el soporte del gasto ${expenseRef}.`)
      includedSupports.push({
        gasto: expenseRef,
        adjunto_incluido: false,
        archivo: null,
        observacion: error instanceof Error ? error.message : 'Fallo descargando adjunto',
      })
    }
  }

  return { entries, warnings, missingDocuments, includedSupports }
}

function buildManifest(input: ExportPackageInput, includedFiles: number, missingDocuments: number, warnings: string[]) {
  return {
    paquete: input.label,
    periodo: {
      inicio: input.periodStartDate,
      fin: input.periodEndDate,
    },
    generado_el: new Date().toISOString(),
    archivos_incluidos: includedFiles,
    soportes_pendientes: missingDocuments,
    secciones: exportSectionLabels,
    contenido: {
      facturas: input.invoices.length,
      cobros: input.payments.length,
      gastos: input.expenses.length,
      presupuestos_apoyo: input.quotes.length,
    },
    advertencias: warnings,
  }
}

export async function downloadManagerExportPackage(input: ExportPackageInput): Promise<ManagerExportPackageResult> {
  const rootFolder = sanitizePathPart(input.folderName) || 'paquete_fiscal'
  const entries: ZipEntry[] = []
  let exportLogoSrc = '/branding/logo-costa-clean-web.png'

  try {
    exportLogoSrc = await fetchAsDataUrl('/branding/logo-costa-clean-web.png')
  } catch {
    // Keep fallback public path for robustness.
  }

  entries.push(makeTextEntry(`${rootFolder}/${exportSectionPaths.cover}.html`, buildIndexHtml(input, 0)))
  entries.push(makeTextEntry(`${rootFolder}/${exportSectionPaths.summary}/resumen_periodo.html`, buildSummaryHtml(input)))
  entries.push(makeTextEntry(`${rootFolder}/${exportSectionPaths.summary}/resumen_periodo.json`, JSON.stringify({
    paquete: input.label,
    periodo: {
      inicio: input.periodStartDate,
      fin: input.periodEndDate,
    },
    generado_el: new Date().toISOString(),
    totales: {
      facturado: input.summaryMetrics.invoiced_total,
      cobrado: input.summaryMetrics.collected_total,
      pendiente: input.summaryMetrics.outstanding_total,
      gastos: input.summaryMetrics.expenses_total,
      iva_repercutido: input.summaryMetrics.output_vat_total ?? 0,
      iva_deducible_estimado: input.summaryMetrics.estimated_deductible_vat ?? 0,
    },
  }, null, 2)))

  const invoiceCsv = buildCsv(
    ['Factura', 'Fecha de emision', 'Cliente', 'Estado', 'Base imponible', 'IVA', 'Total', 'Documento'],
    input.invoices.map((invoice) => {
      const invoiceRef = invoice.invoice_number ?? 'Sin numero'
      const fileStem = getInvoiceDocumentFileStem(invoice)
      const fileName = `${fileStem}.html`
      const invoiceHtml = buildInvoicePrintDocumentHtml(invoice, 'pdf', { logoSrc: exportLogoSrc })
      entries.push(makeTextEntry(`${rootFolder}/${exportSectionPaths.invoices}/documentos/${fileName}`, invoiceHtml))
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
  entries.push(makeTextEntry(`${rootFolder}/${exportSectionPaths.invoices}/facturas.csv`, invoiceCsv))

  const paymentsCsv = buildCsv(
    ['Cobro', 'Fecha', 'Factura', 'Importe', 'Metodo', 'Observaciones'],
    input.payments.map((payment) => [
      payment.display_code ?? payment.id,
      payment.payment_date,
      payment.invoice_number ?? payment.invoice_display_code ?? payment.invoice_id,
      Number(payment.amount || 0).toFixed(2),
      payment.payment_method ?? '',
      payment.notes ?? '',
    ]),
  )
  entries.push(makeTextEntry(`${rootFolder}/${exportSectionPaths.payments}/cobros.csv`, paymentsCsv))

  const expensesCsv = buildCsv(
    [
      'Gasto',
      'Fecha',
      'Proveedor',
      'Categoria',
      'Base imponible',
      'IVA',
      'Total',
      'Documento',
      'Soporte',
      'Base deducible estimada',
      'IVA deducible estimado',
      'Adjunto',
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
      getEstimatedDeductibleBase(expense).toFixed(2),
      getEstimatedDeductibleVat(expense).toFixed(2),
      expense.receipt_file_path ? 'Incluido si estaba disponible' : 'Pendiente',
    ]),
  )
  entries.push(makeTextEntry(`${rootFolder}/${exportSectionPaths.expenses}/gastos.csv`, expensesCsv))

  const quotesCsv = buildCsv(
    ['Presupuesto', 'Fecha', 'Estado', 'Cliente', 'Propiedad', 'Base imponible', 'IVA', 'Total', 'Documento'],
    input.quotes.map((quote) => {
      const fileStem = getQuoteDocumentFileStem(quote)
      const fileName = `${fileStem}.html`
      const quoteHtml = buildQuotePrintDocumentHtml(quote, input.clients, input.properties, 'pdf')
      entries.push(makeTextEntry(`${rootFolder}/${exportSectionPaths.quotes}/documentos/${fileName}`, quoteHtml))
      return [
        quote.display_code ?? quote.id,
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
  entries.push(makeTextEntry(`${rootFolder}/${exportSectionPaths.quotes}/presupuestos.csv`, quotesCsv))

  const fiscalReviewSummary = buildExpenseFiscalSummary(input.expenses)
  const fiscalReviewCsv = buildCsv(
    [
      'Gasto',
      'Proveedor',
      'Motivo de revision',
      'Soporte',
      'Base deducible estimada',
      'IVA deducible estimado',
    ],
    input.expenses
      .filter((expense) =>
        needsFiscalReview(expense)
        || hasMediumHighFiscalRisk(expense)
        || !hasValidVatInvoiceSupport(expense),
      )
      .map((expense) => [
        expense.display_code ?? expense.id,
        expense.supplier_name,
        buildReviewReason(expense),
        getExpenseDocumentSupportStatusLabel(expense.document_support_status),
        getEstimatedDeductibleBase(expense).toFixed(2),
        getEstimatedDeductibleVat(expense).toFixed(2),
      ]),
  )

  const accountantSummaryCsv = buildCsv(
    ['Concepto', 'Valor', 'Observacion'],
    [
      ['IVA repercutido total', (input.summaryMetrics.output_vat_total ?? 0).toFixed(2), 'Segun facturas emitidas del periodo'],
      ['IVA soportado total', fiscalReviewSummary.totalVatSupported.toFixed(2), 'Segun documentacion valida disponible'],
      ['IVA deducible estimado', fiscalReviewSummary.estimatedDeductibleVat.toFixed(2), 'Dato orientativo para revision'],
      ['IVA neto estimado', ((input.summaryMetrics.output_vat_total ?? 0) - fiscalReviewSummary.estimatedDeductibleVat).toFixed(2), 'Requiere validacion final'],
      ['Base deducible estimada', fiscalReviewSummary.estimatedDeductibleBase.toFixed(2), 'Base asociada a gastos revisables'],
      ['Gastos con revision', fiscalReviewSummary.needsReviewCount, 'Puntos a confirmar antes del cierre definitivo'],
      ['Gastos con observacion fiscal', fiscalReviewSummary.mediumHighRiskCount, 'Casos que conviene revisar con detalle'],
      ['Gastos sin soporte valido', fiscalReviewSummary.missingValidVatInvoiceCount, 'Pueden afectar la deducibilidad del IVA'],
    ],
  )

  entries.push(makeTextEntry(`${rootFolder}/${exportSectionPaths.accountantReview}/resumen_gestoria.html`, buildFiscalReviewHtml(input)))
  entries.push(makeTextEntry(`${rootFolder}/${exportSectionPaths.accountantReview}/gastos_para_revision.csv`, fiscalReviewCsv))
  entries.push(makeTextEntry(`${rootFolder}/${exportSectionPaths.accountantReview}/resumen_gestoria.csv`, accountantSummaryCsv))
  entries.push(makeTextEntry(`${rootFolder}/${exportSectionPaths.accountantReview}/resumen_gestoria.json`, JSON.stringify({
    paquete: input.label,
    generado_el: new Date().toISOString(),
    periodo: {
      inicio: input.periodStartDate,
      fin: input.periodEndDate,
    },
    metricas: {
      iva_repercutido: input.summaryMetrics.output_vat_total ?? 0,
      iva_soportado: fiscalReviewSummary.totalVatSupported,
      iva_deducible_estimado: fiscalReviewSummary.estimatedDeductibleVat,
      iva_neto_estimado: (input.summaryMetrics.output_vat_total ?? 0) - fiscalReviewSummary.estimatedDeductibleVat,
      base_deducible_estimada: fiscalReviewSummary.estimatedDeductibleBase,
      gastos_con_revision: fiscalReviewSummary.needsReviewCount,
      gastos_con_observacion: fiscalReviewSummary.mediumHighRiskCount,
      gastos_sin_soporte_valido: fiscalReviewSummary.missingValidVatInvoiceCount,
    },
  }, null, 2)))

  const incidenceCsv = buildCsv(
    ['Area', 'Detalle', 'Cantidad', 'Observacion'],
    input.incidences.map((incidence) => [
      incidence.label,
      incidence.id,
      incidence.count,
      incidence.detail,
    ]),
  )
  entries.push(makeTextEntry(`${rootFolder}/${exportSectionPaths.pendingItems}/pendientes_revision.csv`, incidenceCsv))

  const expenseAttachmentResult = await buildExpenseEntries(input.expenses, rootFolder)
  entries.push(...expenseAttachmentResult.entries)
  entries.push(makeTextEntry(
    `${rootFolder}/${exportSectionPaths.expenses}/soportes_incluidos.json`,
    JSON.stringify(expenseAttachmentResult.includedSupports, null, 2),
  ))

  const manifestWarnings = [...expenseAttachmentResult.warnings]
  const manifest = buildManifest(
    input,
    entries.length + 1,
    expenseAttachmentResult.missingDocuments,
    manifestWarnings,
  )
  entries.push(makeTextEntry(`${rootFolder}/00_resumen_paquete.json`, JSON.stringify(manifest, null, 2)))
  entries[0] = makeTextEntry(`${rootFolder}/${exportSectionPaths.cover}.html`, buildIndexHtml(input, expenseAttachmentResult.missingDocuments))

  const zipBlob = buildStoredZip(entries)
  const fileName = `${rootFolder}.zip`
  downloadBlob(zipBlob, fileName)

  return {
    fileName,
    includedFiles: entries.length,
    missingDocuments: expenseAttachmentResult.missingDocuments,
    warnings: [
      ...manifestWarnings,
      ...input.incidences
        .filter((incidence) => incidence.tone !== 'neutral')
        .map((incidence) => `${incidence.label}: ${incidence.count}.`),
    ],
  }
}
