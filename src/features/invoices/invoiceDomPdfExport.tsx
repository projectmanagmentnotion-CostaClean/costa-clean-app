import { renderToStaticMarkup } from 'react-dom/server'
import { InvoiceDocumentA4 } from './InvoiceDocumentA4'
import type { InvoiceListItem } from './types'

const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297
const CAPTURE_SCALE = 3

function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'))

  return Promise.all(images.map(async (image) => {
    if (!image.complete) {
      await new Promise<void>((resolve) => {
        image.addEventListener('load', () => resolve(), { once: true })
        image.addEventListener('error', () => resolve(), { once: true })
      })
    }

    if (typeof image.decode === 'function') {
      await image.decode().catch(() => undefined)
    }
  })).then(() => undefined)
}

export async function renderInvoiceDocumentPdf(invoice: InvoiceListItem): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('La exportacion visual del PDF requiere un navegador.')
  }

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  const host = document.createElement('div')
  host.className = 'cc-invoice-pdf-export-host'
  host.innerHTML = renderToStaticMarkup(
    <InvoiceDocumentA4 invoice={invoice} variant="embedded" />,
  )

  const documentElement = host.firstElementChild
  if (!(documentElement instanceof HTMLElement)) {
    throw new Error('No se pudo montar la factura A4 para exportarla.')
  }

  documentElement.classList.add('cc-invoice-a4--export')
  host.style.width = `${A4_WIDTH_MM}mm`
  host.style.height = `${A4_HEIGHT_MM}mm`
  document.body.appendChild(host)

  try {
    await document.fonts.ready
    await waitForImages(documentElement)

    const canvas = await html2canvas(documentElement, {
      backgroundColor: '#ffffff',
      height: documentElement.scrollHeight,
      scale: CAPTURE_SCALE,
      useCORS: true,
      width: documentElement.scrollWidth,
      windowHeight: documentElement.scrollHeight,
      windowWidth: Math.max(document.documentElement.clientWidth, 1200),
    })

    const pdf = new jsPDF({
      compress: true,
      format: 'a4',
      orientation: 'portrait',
      unit: 'mm',
    })
    pdf.addImage(canvas, 'PNG', 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM, undefined, 'FAST')

    return new Blob([pdf.output('arraybuffer')], { type: 'application/pdf' })
  } finally {
    host.remove()
  }
}
