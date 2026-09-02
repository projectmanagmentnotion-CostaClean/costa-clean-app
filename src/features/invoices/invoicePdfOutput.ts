import { businessRules } from '../../app/businessRules'
import { getStatusLabel } from '../../app/displayText'
import { getInvoiceFiscalDisplayData } from '../clients/clientFiscalData'
import type { InvoiceLineItem, InvoiceListItem } from './types'
import {
  buildBrandedDocumentTitle,
  sanitizeFilenamePart,
} from '../documents/utils'
import { deliverPdfFile, isIosStandaloneApp, type PdfDownloadResult } from '../documents/documentFileDelivery'
import { normalizeLineConcept, simplifyLineConcept } from '../quotes/lineConcepts'

export type InvoiceDocumentOutputIntent = 'print' | 'pdf'
export type InvoiceDocumentOutputResult = PdfDownloadResult | 'printed'

interface DocumentLine {
  id: string
  concept: string
  quantity: number
  unit: string | null
  unit_price: number
  line_subtotal: number
}

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 40
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const GUTTER = 14
const CARD_PADDING_X = 12
const CARD_PADDING_Y = 10

function formatDate(value: string): string {
  if (!value) return 'Sin fecha'

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

function getClientName(invoice: InvoiceListItem): string {
  return (
    invoice.client_name?.trim() ||
    invoice.client_display_code ||
    invoice.client_id ||
    'Cliente'
  )
}

function getInvoiceRef(invoice: InvoiceListItem): string {
  return sanitizeFilenamePart(invoice.invoice_number ?? 'Sin numero')
}

function getInvoiceDocumentTitle(invoice: InvoiceListItem): string {
  return buildBrandedDocumentTitle('Factura', getInvoiceRef(invoice), getClientName(invoice))
}

function sanitizeInvoiceFileNamePart(value: string): string {
  let sanitized = ''

  for (const char of value.normalize('NFC')) {
    const code = char.codePointAt(0) ?? 0
    if ('\\/:*?"<>|'.includes(char) || code <= 31) {
      continue
    }

    sanitized += char
  }

  return sanitized
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildInvoicePdfFileName(invoice: InvoiceListItem): string {
  const reference = sanitizeInvoiceFileNamePart(invoice.invoice_number ?? 'Sin numero')
  const client = sanitizeInvoiceFileNamePart(getClientName(invoice))
  const baseName = [reference, client, 'Factura CostaClean'].filter(Boolean).join(' - ')

  return `${baseName || 'Factura CostaClean'}.pdf`
}

function normalizeUnit(value: string | null | undefined): string | null {
  const rawUnit = value?.trim()
  if (!rawUnit) return null
  return rawUnit === 'service' ? 'servicio' : rawUnit
}

function getBillingQuantity(invoice: InvoiceListItem): number {
  const quantity = Number(invoice.billing_quantity)
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1
}

function getBillingUnitPrice(invoice: InvoiceListItem, quantity: number): number {
  const unitPrice = Number(invoice.billing_unit_price)
  if (Number.isFinite(unitPrice) && unitPrice >= 0) {
    return unitPrice
  }

  return quantity > 0 ? invoice.subtotal / quantity : invoice.subtotal
}

function getPersistedDocumentLines(invoice: InvoiceListItem): DocumentLine[] {
  const lines = invoice.lines?.length ? invoice.lines : invoice.invoice_lines ?? []

  return [...lines]
    .sort((left, right) => Number(left.sort_order) - Number(right.sort_order))
    .map((line: InvoiceLineItem) => ({
      id: line.id,
      concept: normalizeLineConcept(line.concept),
      quantity: Number(line.quantity),
      unit: normalizeUnit(line.unit),
      unit_price: Number(line.unit_price),
      line_subtotal: Number(line.line_subtotal),
    }))
    .filter((line) => (
      Number.isFinite(line.quantity) &&
      line.quantity > 0 &&
      Number.isFinite(line.unit_price) &&
      Number.isFinite(line.line_subtotal)
    ))
}

function getDocumentLines(invoice: InvoiceListItem): DocumentLine[] {
  const persistedLines = getPersistedDocumentLines(invoice)
  if (persistedLines.length > 0) {
    return persistedLines
  }

  const quantity = getBillingQuantity(invoice)
  const unitPrice = getBillingUnitPrice(invoice, quantity)

  return [{
    id: `${invoice.id}-fallback-line`,
    concept: simplifyLineConcept(invoice.billing_concept || invoice.service_description),
    quantity,
    unit: normalizeUnit(invoice.billing_unit),
    unit_price: unitPrice,
    line_subtotal: invoice.subtotal,
  }]
}

function buildConcept(invoice: InvoiceListItem): string {
  return getDocumentLines(invoice)[0]?.concept || 'Servicio de limpieza'
}

function formatQuantity(line: DocumentLine): string {
  const formattedQuantity = new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: 2,
  }).format(line.quantity)

  return line.unit ? `${formattedQuantity} ${line.unit}` : formattedQuantity
}

function getClientMeta(invoice: InvoiceListItem): string[] {
  const fiscalData = getInvoiceFiscalDisplayData(invoice)
  const lines: string[] = []

  if (fiscalData.taxId) {
    lines.push(`NIF/CIF: ${fiscalData.taxId}`)
  }

  if (fiscalData.billingAddress) {
    lines.push(...fiscalData.billingAddress.split('\n'))
  }

  if (fiscalData.email) {
    lines.push(fiscalData.email)
  }

  return lines
}

function buildReferenceTitle(invoice: InvoiceListItem): string {
  return invoice.service_reference || invoice.quote_display_code || invoice.job_display_code || invoice.job_id || 'Servicio realizado'
}

function normalizePdfText(text: string): string {
  const normalized = text
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/€/g, '\x80')

  let result = ''

  for (const char of normalized) {
    if (char === '\n') {
      result += char
      continue
    }

    const code = char.codePointAt(0)
    result += code !== undefined && code <= 255 ? char : '?'
  }

  return result
}

function escapePdfLiteral(text: string): string {
  return normalizePdfText(text).replace(/[\\()]/g, '\\$&')
}

function estimateTextWidth(text: string, fontSize: number, isBold = false): number {
  let width = 0

  for (const char of text) {
    if (char === ' ') {
      width += fontSize * 0.28
      continue
    }

    if ('.,:;|!'.includes(char)) {
      width += fontSize * 0.22
      continue
    }

    if ('ijlftI1'.includes(char)) {
      width += fontSize * 0.26
      continue
    }

    if ('mwMW@#%&'.includes(char)) {
      width += fontSize * 0.72
      continue
    }

    if (/\d/.test(char)) {
      width += fontSize * 0.5
      continue
    }

    if (/[A-ZÁÉÍÓÚÜÑ]/.test(char)) {
      width += fontSize * (isBold ? 0.7 : 0.64)
      continue
    }

    width += fontSize * (isBold ? 0.56 : 0.5)
  }

  return width
}

function breakLongWord(word: string, maxWidth: number, fontSize: number, isBold = false): string[] {
  const chunks: string[] = []
  let current = ''

  for (const char of word) {
    const candidate = `${current}${char}`
    if (estimateTextWidth(candidate, fontSize, isBold) <= maxWidth || current.length === 0) {
      current = candidate
      continue
    }

    chunks.push(current)
    current = char
  }

  if (current) {
    chunks.push(current)
  }

  return chunks.length > 0 ? chunks : [word]
}

function wrapPdfText(text: string, maxWidth: number, fontSize: number, isBold = false): string[] {
  const normalized = normalizePdfText(text).trim()
  if (!normalized) return ['']

  const words = normalized.split(/\s+/)
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word

    if (estimateTextWidth(candidate, fontSize, isBold) <= maxWidth) {
      currentLine = candidate
      continue
    }

    if (currentLine) {
      lines.push(currentLine)
      currentLine = ''
    }

    if (estimateTextWidth(word, fontSize, isBold) <= maxWidth) {
      currentLine = word
      continue
    }

    const wordChunks = breakLongWord(word, maxWidth, fontSize, isBold)
    lines.push(...wordChunks.slice(0, -1))
    currentLine = wordChunks[wordChunks.length - 1] ?? ''
  }

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines.length > 0 ? lines : ['']
}

function createPageBuilder() {
  const commands: string[] = []

  return {
    commands,
    drawText(
      x: number,
      y: number,
      text: string,
      options?: {
        size?: number
        font?: 'F1' | 'F2'
        color?: string
      },
    ) {
      const size = options?.size ?? 10
      const font = options?.font ?? 'F1'
      const color = options?.color ?? '0 g'
      commands.push(`BT ${color} /${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${escapePdfLiteral(text)}) Tj ET`)
    },
    drawRect(
      x: number,
      y: number,
      width: number,
      height: number,
      options?: {
        stroke?: string
        fill?: string
        lineWidth?: number
      },
    ) {
      const stroke = options?.stroke ?? '0.83 G'
      const fill = options?.fill
      const lineWidth = options?.lineWidth ?? 0.9
      commands.push('q')
      if (fill) {
        commands.push(fill)
      }
      commands.push(stroke)
      commands.push(`${lineWidth} w`)
      commands.push(`${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re ${fill ? 'B' : 'S'}`)
      commands.push('Q')
    },
    drawLine(
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      options?: {
        stroke?: string
        lineWidth?: number
      },
    ) {
      const stroke = options?.stroke ?? '0.83 G'
      const lineWidth = options?.lineWidth ?? 0.8
      commands.push('q')
      commands.push(stroke)
      commands.push(`${lineWidth} w`)
      commands.push(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`)
      commands.push('Q')
    },
  }
}

function measureInfoCardHeight(title: string, lines: string[], width: number): number {
  const titleLines = wrapPdfText(title, width - CARD_PADDING_X * 2, 11, true)
  const bodyLines = lines.flatMap((line) => wrapPdfText(line, width - CARD_PADDING_X * 2, 9.4))
  return CARD_PADDING_Y * 2 + titleLines.length * 13 + 6 + bodyLines.length * 11 + 2
}

function drawInfoCard(
  page: ReturnType<typeof createPageBuilder>,
  x: number,
  topY: number,
  width: number,
  label: string,
  title: string,
  lines: string[],
) {
  const height = measureInfoCardHeight(title, lines, width)
  const bottomY = topY - height
  const innerLeft = x + CARD_PADDING_X
  let cursorY = topY - CARD_PADDING_Y

  page.drawRect(x, bottomY, width, height)
  page.drawText(innerLeft, cursorY - 2, label.toUpperCase(), { size: 7.5, font: 'F2', color: '0.40 g' })
  cursorY -= 15

  for (const titleLine of wrapPdfText(title, width - CARD_PADDING_X * 2, 11, true)) {
    page.drawText(innerLeft, cursorY, titleLine, { size: 11, font: 'F2', color: '0.08 g' })
    cursorY -= 13
  }

  cursorY -= 2

  for (const line of lines.flatMap((item) => wrapPdfText(item, width - CARD_PADDING_X * 2, 9.4))) {
    page.drawText(innerLeft, cursorY, line, { size: 9.4, font: 'F1', color: '0.28 g' })
    cursorY -= 11
  }

  return { height, bottomY }
}

function measureTableRowHeight(line: DocumentLine, conceptWidth: number): number {
  const wrappedConcept = wrapPdfText(line.concept, conceptWidth - 8, 9.6)
  return Math.max(22, wrappedConcept.length * 10 + 8)
}

function drawInvoiceTable(
  page: ReturnType<typeof createPageBuilder>,
  topY: number,
  lines: DocumentLine[],
) {
  const tableX = MARGIN
  const tableWidth = CONTENT_WIDTH
  const headerHeight = 24
  const conceptWidth = 270
  const quantityWidth = 70
  const unitPriceWidth = 100
  const rowHeights = lines.map((line) => measureTableRowHeight(line, conceptWidth))
  const tableHeight = headerHeight + rowHeights.reduce((sum, value) => sum + value, 0)
  const bottomY = topY - tableHeight

  page.drawRect(tableX, topY - headerHeight, tableWidth, headerHeight, {
    fill: '0.08 g',
    stroke: '0.08 g',
    lineWidth: 0.4,
  })
  page.drawRect(tableX, bottomY, tableWidth, tableHeight)
  page.drawLine(tableX, topY - headerHeight, tableX + tableWidth, topY - headerHeight, {
    stroke: '0.82 G',
    lineWidth: 0.7,
  })

  page.drawText(tableX + 8, topY - 16, 'Concepto', { size: 8.5, font: 'F2', color: '1 g' })
  page.drawText(tableX + conceptWidth + 6, topY - 16, 'Cantidad', { size: 8.5, font: 'F2', color: '1 g' })
  page.drawText(tableX + conceptWidth + quantityWidth + 6, topY - 16, 'Precio unitario', { size: 8.5, font: 'F2', color: '1 g' })
  page.drawText(tableX + conceptWidth + quantityWidth + unitPriceWidth + 6, topY - 16, 'Importe', { size: 8.5, font: 'F2', color: '1 g' })

  let rowTopY = topY - headerHeight

  lines.forEach((line, index) => {
    const rowHeight = rowHeights[index] ?? 22
    const rowBottomY = rowTopY - rowHeight

    if (index > 0) {
      page.drawLine(tableX, rowTopY, tableX + tableWidth, rowTopY, {
        stroke: '0.90 G',
        lineWidth: 0.5,
      })
    }

    const conceptLines = wrapPdfText(line.concept, conceptWidth - 10, 9.6)
    let textY = rowTopY - 15
    conceptLines.forEach((conceptLine) => {
      page.drawText(tableX + 8, textY, conceptLine, { size: 9.6, font: 'F1', color: '0.14 g' })
      textY -= 10
    })

    page.drawText(tableX + conceptWidth + 6, rowTopY - 15, formatQuantity(line), {
      size: 9.6,
      font: 'F1',
      color: '0.14 g',
    })
    page.drawText(tableX + conceptWidth + quantityWidth + 6, rowTopY - 15, formatCurrency(line.unit_price), {
      size: 9.6,
      font: 'F1',
      color: '0.14 g',
    })
    page.drawText(tableX + conceptWidth + quantityWidth + unitPriceWidth + 6, rowTopY - 15, formatCurrency(line.line_subtotal), {
      size: 9.6,
      font: 'F1',
      color: '0.14 g',
    })

    rowTopY = rowBottomY
  })

  return tableHeight
}

function buildPdfBytes(pages: string[]): Uint8Array {
  const header = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  ]

  const firstPageObjectNumber = 5
  const pageObjectNumbers = pages.map((_, index) => firstPageObjectNumber + index * 2)
  const contentObjectNumbers = pageObjectNumbers.map((pageNumber) => pageNumber + 1)

  objects[1] = `<< /Type /Pages /Kids [${pageObjectNumbers.map((pageNumber) => `${pageNumber} 0 R`).join(' ')}] /Count ${pages.length} >>`

  pages.forEach((pageContent, index) => {
    const pageObjectNumber = pageObjectNumbers[index]
    const contentObjectNumber = contentObjectNumbers[index]

    objects[pageObjectNumber - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH.toFixed(2)} ${PAGE_HEIGHT.toFixed(2)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`
    objects[contentObjectNumber - 1] = `<< /Length ${pageContent.length} >>\nstream\n${pageContent}\nendstream`
  })

  const chunks = [header]
  const offsets = ['0000000000 65535 f \n']
  let currentOffset = header.length

  for (let objectNumber = 1; objectNumber <= objects.length; objectNumber += 1) {
    const objectBody = objects[objectNumber - 1]
    if (!objectBody) {
      offsets.push('0000000000 00000 f \n')
      continue
    }

    const serializedObject = `${objectNumber} 0 obj\n${objectBody}\nendobj\n`
    offsets.push(`${String(currentOffset).padStart(10, '0')} 00000 n \n`)
    chunks.push(serializedObject)
    currentOffset += serializedObject.length
  }

  const xrefStart = currentOffset
  const xref = `xref\n0 ${offsets.length}\n${offsets.join('')}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  chunks.push(xref)

  const pdfString = chunks.join('')
  const bytes = new Uint8Array(pdfString.length)

  for (let index = 0; index < pdfString.length; index += 1) {
    bytes[index] = pdfString.charCodeAt(index) & 0xff
  }

  return bytes
}

export function buildInvoicePdfBlob(invoice: InvoiceListItem): Blob {
  const page = createPageBuilder()
  const headerTop = PAGE_HEIGHT - MARGIN

  page.drawText(MARGIN, headerTop, 'CostaClean BCN', {
    size: 10.5,
    font: 'F2',
    color: '0.42 g',
  })
  page.drawText(MARGIN, headerTop - 16, 'FACTURA', {
    size: 24,
    font: 'F2',
    color: '0.08 g',
  })
  page.drawText(MARGIN, headerTop - 32, 'Documento fiscal emitido conforme a las condiciones acordadas.', {
    size: 9.2,
    font: 'F1',
    color: '0.33 g',
  })

  const metaCardWidth = 164
  drawInfoCard(
    page,
    PAGE_WIDTH - MARGIN - metaCardWidth,
    headerTop + 5,
    metaCardWidth,
    'Numero',
    invoice.invoice_number ?? 'Sin numero',
    [
      `Fecha: ${formatDate(invoice.issue_date)}`,
      `Estado: ${getStatusLabel(invoice.status)}`,
    ],
  )

  page.drawLine(MARGIN, headerTop - 44, PAGE_WIDTH - MARGIN, headerTop - 44, {
    stroke: '0.84 G',
    lineWidth: 0.8,
  })

  let cursorY = headerTop - 58
  const columnWidth = (CONTENT_WIDTH - GUTTER) / 2

  const issuerHeight = drawInfoCard(
    page,
    MARGIN,
    cursorY,
    columnWidth,
    'Emisor',
    'VILMA TIBISAY GARCIA JIMENEZ',
    [
      'NIF: 60356434H',
      'C/Raval 35, 2-2',
      '08370 Barcelona',
    ],
  ).height

  const clientHeight = drawInfoCard(
    page,
    MARGIN + columnWidth + GUTTER,
    cursorY,
    columnWidth,
    'Cliente',
    getClientName(invoice),
    getClientMeta(invoice),
  ).height

  cursorY -= Math.max(issuerHeight, clientHeight) + 14

  const referenceHeight = drawInfoCard(
    page,
    MARGIN,
    cursorY,
    columnWidth,
    'Servicio / referencia',
    buildReferenceTitle(invoice),
    [buildConcept(invoice)],
  ).height

  const propertyHeight = drawInfoCard(
    page,
    MARGIN + columnWidth + GUTTER,
    cursorY,
    columnWidth,
    'Propiedad / ubicacion',
    invoice.property_name ?? invoice.property_display_code ?? 'Sin propiedad vinculada',
    [invoice.property_address_line ?? 'Direccion pendiente de ampliar'],
  ).height

  cursorY -= Math.max(referenceHeight, propertyHeight) + 14

  const tableLines = getDocumentLines(invoice)
  const tableHeight = drawInvoiceTable(page, cursorY, tableLines)
  cursorY -= tableHeight + 14

  const notesWidth = columnWidth
  const totalsWidth = columnWidth
  const notesBody = [
    invoice.notes?.trim() ? invoice.notes.trim() : 'Sin observaciones adicionales.',
    'Forma de pago: Transferencia bancaria',
    'IBAN ES32 0049 0183 6124 1084 6130',
    businessRules.defaultInvoiceLegalNote,
  ]

  const notesHeight = drawInfoCard(
    page,
    MARGIN,
    cursorY,
    notesWidth,
    'Observaciones',
    'Notas y condiciones',
    notesBody,
  ).height

  const totalsHeight = drawInfoCard(
    page,
    MARGIN + notesWidth + GUTTER,
    cursorY,
    totalsWidth,
    'Importes',
    'Resumen economico',
    [
      `Base imponible: ${formatCurrency(invoice.subtotal)}`,
      `IVA (21%): ${formatCurrency(invoice.tax_amount)}`,
      `Total: ${formatCurrency(invoice.total)}`,
    ],
  ).height

  cursorY -= Math.max(notesHeight, totalsHeight) + 8

  page.drawText(MARGIN, Math.max(28, cursorY), getInvoiceDocumentTitle(invoice), {
    size: 8.8,
    font: 'F1',
    color: '0.45 g',
  })

  const bytes = buildPdfBytes([page.commands.join('\n')])
  const pdfBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer

  return new Blob([pdfBuffer], {
    type: 'application/pdf',
  })
}

export function buildInvoicePdfFile(invoice: InvoiceListItem): File {
  const blob = buildInvoicePdfBlob(invoice)
  const fileName = buildInvoicePdfFileName(invoice)

  if (typeof File !== 'undefined') {
    return new File([blob], fileName, { type: 'application/pdf' })
  }

  return blob as File
}

async function printPdfBlob(blob: Blob): Promise<'printed'> {
  const objectUrl = URL.createObjectURL(blob)

  return await new Promise<'printed'>((resolve, reject) => {
    const iframe = document.createElement('iframe')
    let settled = false

    const cleanup = () => {
      iframe.remove()
      URL.revokeObjectURL(objectUrl)
    }

    const settle = () => {
      if (settled) return
      settled = true
      cleanup()
      resolve('printed')
    }

    iframe.style.position = 'fixed'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.style.opacity = '0'
    iframe.src = objectUrl

    iframe.onload = () => {
      const contentWindow = iframe.contentWindow
      if (!contentWindow) {
        settle()
        return
      }

      const handleAfterPrint = () => settle()
      window.addEventListener('afterprint', handleAfterPrint, { once: true })

      try {
        contentWindow.focus()
        contentWindow.print()
      } catch (error) {
        cleanup()
        reject(error)
        return
      }

      window.setTimeout(() => {
        settle()
      }, 1200)
    }

    document.body.appendChild(iframe)
  })
}

export async function downloadInvoicePdf(invoice: InvoiceListItem): Promise<PdfDownloadResult> {
  const file = buildInvoicePdfFile(invoice)
  return deliverPdfFile(file, file.name)
}

export async function printInvoicePdf(invoice: InvoiceListItem): Promise<InvoiceDocumentOutputResult> {
  const file = buildInvoicePdfFile(invoice)

  if (isIosStandaloneApp()) {
    return await deliverPdfFile(file, file.name)
  }

  return await printPdfBlob(file)
}

export async function openInvoiceDocumentOutput(
  invoice: InvoiceListItem,
  intent: InvoiceDocumentOutputIntent = 'print',
): Promise<InvoiceDocumentOutputResult> {
  if (intent === 'pdf') {
    return downloadInvoicePdf(invoice)
  }

  return printInvoicePdf(invoice)
}
