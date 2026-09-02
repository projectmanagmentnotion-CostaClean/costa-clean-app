import { getInvoiceFiscalDisplayData } from '../clients/clientFiscalData'
import type { InvoiceListItem } from './types'
import { deliverPdfFile, isIosStandaloneApp, type PdfDownloadResult } from '../documents/documentFileDelivery'
import { renderInvoiceDocumentPdf } from './invoiceDomPdfExport'

export type InvoiceDocumentOutputIntent = 'print' | 'pdf'
export type InvoiceDocumentOutputResult = PdfDownloadResult | 'printed'

function getClientName(invoice: InvoiceListItem): string {
  const fiscalData = getInvoiceFiscalDisplayData(invoice)
  return (
    fiscalData.clientName?.trim() ||
    invoice.client_name?.trim() ||
    invoice.client_display_code ||
    invoice.client_id ||
    'Cliente'
  )
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

  return sanitized.replace(/\s+/g, ' ').trim()
}

export function buildInvoicePdfFileName(invoice: InvoiceListItem): string {
  const reference = sanitizeInvoiceFileNamePart(invoice.invoice_number ?? 'Sin numero')
  const client = sanitizeInvoiceFileNamePart(getClientName(invoice))
  const baseName = [reference, client, 'Factura CostaClean'].filter(Boolean).join(' - ')

  return `${baseName || 'Factura CostaClean'}.pdf`
}

export async function buildInvoicePdfBlob(invoice: InvoiceListItem): Promise<Blob> {
  return renderInvoiceDocumentPdf(invoice)
}

export async function buildInvoicePdfFile(invoice: InvoiceListItem): Promise<File> {
  const blob = await buildInvoicePdfBlob(invoice)
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

      window.setTimeout(() => settle(), 1200)
    }

    document.body.appendChild(iframe)
  })
}

export async function downloadInvoicePdf(invoice: InvoiceListItem): Promise<PdfDownloadResult> {
  const file = await buildInvoicePdfFile(invoice)
  return deliverPdfFile(file, file.name)
}

export async function printInvoicePdf(invoice: InvoiceListItem): Promise<InvoiceDocumentOutputResult> {
  const file = await buildInvoicePdfFile(invoice)

  if (isIosStandaloneApp()) {
    return await deliverPdfFile(file, file.name)
  }

  return printPdfBlob(file)
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
