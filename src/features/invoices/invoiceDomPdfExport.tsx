import { renderToStaticMarkup } from 'react-dom/server'
import type { jsPDF } from 'jspdf'
import { InvoiceDocumentA4 } from './InvoiceDocumentA4'
import {
  collectInvoicePdfSemanticBlocks,
  createInvoicePdfPageRanges,
  getInvoicePdfPageHeightMm,
} from './invoicePdfPagination'
import type { InvoiceListItem } from './types'

const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297
const CAPTURE_SCALE = 3

function addCanvasRangeToPdf(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  start: number,
  end: number,
  pageHeightCss: number,
  captureScale: number,
  isFirstPage: boolean,
): void {
  if (!isFirstPage) {
    pdf.addPage('a4', 'portrait')
  }

  const sourceY = Math.max(0, Math.round(start * captureScale))
  const sourceHeight = Math.max(1, Math.round((end - start) * captureScale))
  const slice = document.createElement('canvas')
  slice.width = canvas.width
  slice.height = Math.min(sourceHeight, Math.max(1, canvas.height - sourceY))

  const context = slice.getContext('2d')
  if (!context) {
    throw new Error('No se pudo preparar una pagina semantica del PDF.')
  }

  context.drawImage(
    canvas,
    0,
    sourceY,
    canvas.width,
    slice.height,
    0,
    0,
    slice.width,
    slice.height,
  )

  const pageHeightMm = getInvoicePdfPageHeightMm({ start, end }, pageHeightCss)
  pdf.addImage(
    slice.toDataURL('image/jpeg', 0.95),
    'JPEG',
    0,
    0,
    A4_WIDTH_MM,
    pageHeightMm,
    undefined,
    'FAST',
  )
}

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

function measureRenderedDocumentHeight(root: HTMLElement, host: HTMLElement): number {
  const rootTop = root.getBoundingClientRect().top
  const descendantBottom = Array.from(root.querySelectorAll<HTMLElement>('*')).reduce(
    (maximum, element) => Math.max(maximum, element.getBoundingClientRect().bottom - rootTop),
    0,
  )

  return Math.ceil(Math.max(
    host.scrollHeight,
    host.offsetHeight,
    root.scrollHeight,
    root.offsetHeight,
    descendantBottom,
  ))
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

  const documentElement = host.querySelector<HTMLElement>('[data-pdf-document]')
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
    const captureHeight = measureRenderedDocumentHeight(documentElement, host)
    const pageHeightCss = captureWidth * (A4_HEIGHT_MM / A4_WIDTH_MM)
    const semanticBlocks = collectInvoicePdfSemanticBlocks(documentElement)
    const semanticContentHeight = semanticBlocks.reduce(
      (maximum, block) => Math.max(maximum, block.end),
      0,
    )
    const pageRanges = createInvoicePdfPageRanges(
      semanticBlocks,
      pageHeightCss,
      semanticContentHeight > 0 ? semanticContentHeight : captureHeight,
    )

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

    if (canvas.height < captureHeight * CAPTURE_SCALE - 1) {
      throw new Error('El canvas del PDF no contiene toda la altura semantica capturada.')
    }

    const pdf = new jsPDF({
      compress: true,
      format: 'a4',
      orientation: 'portrait',
      unit: 'mm',
    })
    pageRanges.forEach((range, index) => {
      addCanvasRangeToPdf(
        pdf,
        canvas,
        range.start,
        range.end,
        pageHeightCss,
        CAPTURE_SCALE,
        index === 0,
      )
    })

    return new Blob([pdf.output('arraybuffer')], { type: 'application/pdf' })
  } finally {
    host.remove()
  }
}
