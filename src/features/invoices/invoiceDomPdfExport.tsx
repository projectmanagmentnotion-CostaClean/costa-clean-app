import { renderToStaticMarkup } from 'react-dom/server'
import { A4_WIDTH_MM, CAPTURE_SCALE, addCanvasToA4Pdf } from '../documents/documentPdfPagination'
import { InvoiceDocumentA4 } from './InvoiceDocumentA4'
import type { InvoiceListItem } from './types'

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
    <InvoiceDocumentA4 invoice={invoice} variant="print" renderMode="pdf" />,
  )

  const documentElement = host.firstElementChild
  if (!(documentElement instanceof HTMLElement)) {
    throw new Error('No se pudo montar la factura A4 para exportarla.')
  }

  documentElement.classList.add('cc-invoice-a4--export')
  host.style.width = `${A4_WIDTH_MM}mm`
  host.style.height = 'auto'
  document.body.appendChild(host)

  try {
    await document.fonts.ready
    await waitForImages(documentElement)

    const captureWidth = host.offsetWidth
    const captureHeight = host.offsetHeight

    const canvas = await html2canvas(host, {
      backgroundColor: '#ffffff',
      height: captureHeight,
      scale: CAPTURE_SCALE,
      scrollX: 0,
      scrollY: 0,
      useCORS: true,
      width: captureWidth,
      windowHeight: captureHeight,
      windowWidth: captureWidth,
    })

    const pdf = new jsPDF({
      compress: true,
      format: 'a4',
      orientation: 'portrait',
      unit: 'mm',
    })
    addCanvasToA4Pdf(canvas, pdf)

    return new Blob([pdf.output('arraybuffer')], { type: 'application/pdf' })
  } finally {
    host.remove()
  }
}
