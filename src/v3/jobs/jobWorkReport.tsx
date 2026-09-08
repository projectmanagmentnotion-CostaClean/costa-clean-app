import { renderToStaticMarkup } from 'react-dom/server'
import { formatCurrency, formatDateEs, getServiceTypeLabel } from '../../app/displayFormat'
import { formatClientLabel, formatInvoiceLabel, formatPropertyLabel, formatQuoteLabel } from '../../app/relationshipLabels'
import { buildInvoicePaymentSummary } from '../../features/invoices/paymentState'
import type { ClientListItem } from '../../features/clients/types'
import type { InvoiceListItem } from '../../features/invoices/types'
import type { PaymentListItem } from '../../features/payments/types'
import type { PropertyListItem } from '../../features/properties/types'
import type { QuoteListItem } from '../../features/quotes/types'
import { getJobBillingLines, getJobBillingDisplayConcept } from '../../features/jobs/jobBilling'
import type { JobListItem } from '../../features/jobs/types'

const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297
const CAPTURE_SCALE = 3

function sanitize(value: string): string {
  return Array.from(value.normalize('NFC')).filter((character) => character.charCodeAt(0) > 31).join('').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim()
}

export function buildJobWorkReportPdfFileName(job: JobListItem): string {
  return `parte-trabajo-${sanitize(job.display_code ?? job.id)}.pdf`
}

export async function buildJobWorkReportPdfFile(job: JobListItem, client: ClientListItem | null, property: PropertyListItem | null, quote: QuoteListItem | null, invoice: InvoiceListItem | null, payments: PaymentListItem[]): Promise<File> {
  const blob = await buildJobWorkReportPdfBlob(job, client, property, quote, invoice, payments)
  return new File([blob], buildJobWorkReportPdfFileName(job), { type: 'application/pdf' })
}

function reportMarkup(job: JobListItem, client: ClientListItem | null, property: PropertyListItem | null, quote: QuoteListItem | null, invoice: InvoiceListItem | null, payments: PaymentListItem[]) {
  const lines = getJobBillingLines(job)
  const payment = invoice ? buildInvoicePaymentSummary(invoice, payments) : null
  const facts = [
    ['Código', job.display_code ?? job.id],
    ['Fecha', formatDateEs(job.scheduled_date)],
    ['Estado', job.status],
    ['Servicio', getServiceTypeLabel(job.service_type)],
    ['Concepto', getJobBillingDisplayConcept(job)],
  ]
  return <main style={{ background: 'white', color: 'black', fontFamily: 'Arial, sans-serif', minHeight: '297mm', padding: '18mm', width: '210mm' }}><header style={{ borderBottom: '1px solid black', paddingBottom: '8mm' }}><strong style={{ fontSize: '22px' }}>Costa Clean</strong><h1 style={{ fontSize: '26px', margin: '16mm 0 2mm' }}>Parte de trabajo</h1><p style={{ margin: 0 }}>Resumen operativo del servicio</p></header><section><h2>Servicio</h2>{facts.map(([label, value]) => <p key={label}><strong>{label}: </strong>{value}</p>)}</section><section><h2>Cliente e inmueble</h2><p>{client ? formatClientLabel(client) : 'Sin cliente relacionado'}</p><p>{property ? formatPropertyLabel(property) : 'Sin inmueble relacionado'}</p></section><section><h2>Detalle de trabajo</h2>{lines.length ? lines.map((line) => <p key={line.id ?? line.concept}><strong>{line.concept}</strong> · {line.quantity} {line.unit} · {formatCurrency(line.line_subtotal)}</p>) : <p>{getJobBillingDisplayConcept(job)}</p>}</section>{job.notes?.trim() ? <section><h2>Notas</h2><p>{job.notes.trim()}</p></section> : null}<section><h2>Relaciones</h2><p>{quote ? `Presupuesto: ${formatQuoteLabel(quote)}` : 'Sin presupuesto de origen'}</p><p>{invoice ? `Factura: ${formatInvoiceLabel(invoice)} · ${payment ? `Pendiente ${formatCurrency(payment.outstandingAmount)}` : 'Estado financiero disponible'}` : 'Facturación: Sin facturar'}</p></section><footer style={{ borderTop: '1px solid black', marginTop: '18mm', paddingTop: '5mm' }}>Documento operativo generado el {formatDateEs(new Date().toISOString())}. No es un certificado de ejecución.</footer></main>
}

export async function buildJobWorkReportPdfBlob(job: JobListItem, client: ClientListItem | null, property: PropertyListItem | null, quote: QuoteListItem | null, invoice: InvoiceListItem | null, payments: PaymentListItem[]): Promise<Blob> {
  if (typeof document === 'undefined') throw new Error('La exportación del parte requiere un navegador.')
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
  const host = document.createElement('div')
  host.innerHTML = renderToStaticMarkup(reportMarkup(job, client, property, quote, invoice, payments))
  host.style.position = 'fixed'
  host.style.left = '-100000px'
  document.body.appendChild(host)
  try {
    await document.fonts.ready
    const canvas = await html2canvas(host, { backgroundColor: 'white', height: host.offsetHeight, scale: CAPTURE_SCALE, width: host.offsetWidth, windowHeight: host.offsetHeight, windowWidth: host.offsetWidth })
    const pdf = new jsPDF({ compress: true, format: 'a4', orientation: 'portrait', unit: 'mm' })
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM, undefined, 'FAST')
    return new Blob([pdf.output('arraybuffer')], { type: 'application/pdf' })
  } finally { host.remove() }
}
