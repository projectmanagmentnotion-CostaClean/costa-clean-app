import { createExpenseReceiptSignedUrl } from '../expenses/expenseAttachmentsApi'
import {
  getExpenseDocumentSupportStatusLabel,
  getExpenseFiscalRiskLevelLabel,
  getExpenseFiscalReviewStatusLabel,
  type ExpenseListItem,
} from '../expenses/types'
import { buildInvoicePrintDocumentHtml } from '../invoices/openInvoicePrintWindow'
import type { InvoiceListItem } from '../invoices/types'
import type { PaymentListItem } from '../payments/types'

type ExportScope = 'quarterly' | 'annual'

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
  pending_invoice_count: number
  unresolved_incidence_count: number
  invoiced_total: number
  collected_total: number
  outstanding_total: number
  expenses_total: number
}

interface ExportPackageInput {
  scope: ExportScope
  label: string
  folderName: string
  closingSavedAt: string | null
  closingNotes: string | null
  summaryMetrics: ExportSummaryMetrics
  invoices: InvoiceListItem[]
  payments: PaymentListItem[]
  expenses: ExpenseListItem[]
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
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: value.length > 10 ? 'short' : undefined }).format(date)
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
      <p>Paquete de gestoría generado desde CostaClean CRM.</p>
      <div class="grid">
        <section class="card">
          <h2>Contenido</h2>
          <ul>
            <li><code>01_resumen</code></li>
            <li><code>02_facturas_emitidas</code></li>
            <li><code>03_cobros</code></li>
            <li><code>04_gastos_y_soportes</code></li>
            <li><code>05_incidencias_pendientes</code></li>
          </ul>
        </section>
        <section class="card">
          <h2>Estado documental</h2>
          <ul>
            <li>Facturas: ${input.invoices.length}</li>
            <li>Cobros: ${input.payments.length}</li>
            <li>Gastos: ${input.expenses.length}</li>
            <li>Documentos/soportes faltantes: ${missingDocuments}</li>
          </ul>
        </section>
      </div>
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
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(input.label)} · Resumen</title>
    <style>
      body { font-family: Inter, Arial, sans-serif; margin: 0; padding: 24px; background: #f5f7fb; color: #0f172a; }
      main { max-width: 980px; margin: 0 auto; background: #fff; border-radius: 20px; padding: 24px; border: 1px solid #dbe3ee; }
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
      <p>Cierre guardado: ${escapeHtml(formatDate(input.closingSavedAt))}</p>
      <p>Notas: ${escapeHtml(input.closingNotes?.trim() || 'Sin notas de cierre.')}</p>
      <div class="grid">
        <article class="card"><span class="label">Facturado</span><strong>${escapeHtml(formatCurrency(metrics.invoiced_total))}</strong><p>${metrics.invoice_count} factura(s)</p></article>
        <article class="card"><span class="label">Cobrado</span><strong>${escapeHtml(formatCurrency(metrics.collected_total))}</strong><p>${metrics.payment_count} cobro(s)</p></article>
        <article class="card"><span class="label">Pendiente</span><strong>${escapeHtml(formatCurrency(metrics.outstanding_total))}</strong><p>${metrics.pending_invoice_count} factura(s) abiertas</p></article>
        <article class="card"><span class="label">Gastos</span><strong>${escapeHtml(formatCurrency(metrics.expenses_total))}</strong><p>${metrics.expense_count} gasto(s)</p></article>
      </div>
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
    const riskStatus = getExpenseFiscalRiskLevelLabel(expense.fiscal_risk_level)

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
        path: `${rootFolder}/04_gastos_y_soportes/adjuntos/${baseName}${extension}`,
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
  return {
    generated_at: new Date().toISOString(),
    scope: input.scope,
    label: input.label,
    folder_name: input.folderName,
    closing_saved_at: input.closingSavedAt,
    notes: input.closingNotes,
    summary_metrics: input.summaryMetrics,
    included_files: includedFiles,
    missing_documents: missingDocuments,
    warnings,
    sections: [
      '01_resumen',
      '02_facturas_emitidas',
      '03_cobros',
      '04_gastos_y_soportes',
      '05_incidencias_pendientes',
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
    // Keep the public path fallback for robustness in case the asset cannot be embedded.
  }

  entries.push(makeTextEntry(`${rootFolder}/00_indice.html`, buildIndexHtml(input, 0)))
  entries.push(makeTextEntry(`${rootFolder}/01_resumen/resumen.html`, buildSummaryHtml(input)))
  entries.push(makeTextEntry(`${rootFolder}/01_resumen/resumen.json`, JSON.stringify({
    label: input.label,
    closing_saved_at: input.closingSavedAt,
    notes: input.closingNotes,
    metrics: input.summaryMetrics,
  }, null, 2)))

  const invoiceCsv = buildCsv(
    ['invoice_ref', 'issue_date', 'client', 'status', 'total', 'document_file'],
    input.invoices.map((invoice) => {
      const invoiceRef = invoice.invoice_number ?? invoice.display_code ?? invoice.id
      const fileName = `factura_${sanitizePathPart(invoiceRef)}.html`
      const invoiceHtml = buildInvoicePrintDocumentHtml(invoice, 'pdf', { logoSrc: exportLogoSrc })
      entries.push(makeTextEntry(`${rootFolder}/02_facturas_emitidas/${fileName}`, invoiceHtml))
      return [
        invoiceRef,
        invoice.issue_date,
        invoice.client_name ?? invoice.client_display_code ?? invoice.client_id,
        invoice.status,
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
    ['expense_ref', 'supplier', 'total', 'document_support_status', 'fiscal_review_status', 'fiscal_risk_level', 'attachment_expected'],
    input.expenses.map((expense) => [
      expense.display_code ?? expense.id,
      expense.supplier_name,
      Number(expense.total || 0).toFixed(2),
      getExpenseDocumentSupportStatusLabel(expense.document_support_status),
      getExpenseFiscalReviewStatusLabel(expense.fiscal_review_status),
      getExpenseFiscalRiskLevelLabel(expense.fiscal_risk_level),
      expense.receipt_file_path ? 'included_if_downloadable' : 'missing',
    ]),
  )
  entries.push(makeTextEntry(`${rootFolder}/04_gastos_y_soportes/gastos.csv`, expensesCsv))

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
  entries.push(makeTextEntry(`${rootFolder}/05_incidencias_pendientes/incidencias.csv`, incidenceCsv))

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
    warnings: manifestWarnings,
  }
}
