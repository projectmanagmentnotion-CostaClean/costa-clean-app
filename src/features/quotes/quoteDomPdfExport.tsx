import { renderToStaticMarkup } from 'react-dom/server'
import { QuoteDocumentA4 } from './QuoteDocumentA4'
import type { ClientListItem } from '../clients/types'
import type { PropertyListItem } from '../properties/types'
import type { QuoteListItem } from './types'

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

    if (typeof image.decode === 'function') await image.decode().catch(() => undefined)
  })).then(() => undefined)
}

export async function renderQuoteDocumentPdf(
  quote: QuoteListItem,
  clients: ClientListItem[],
  properties: PropertyListItem[],
): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('La exportacion visual del PDF requiere un navegador.')
  }

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  const host = document.createElement('div')
  host.className = 'cc-quote-pdf-export-host'
  host.innerHTML = renderToStaticMarkup(
    <QuoteDocumentA4
      quote={quote}
      clients={clients}
      properties={properties}
      variant="print"
    />,
  )

  const documentElement = host.firstElementChild
  if (!(documentElement instanceof HTMLElement)) {
    throw new Error('No se pudo montar el presupuesto A4 para exportarlo.')
  }

  documentElement.classList.add('cc-invoice-a4--export')
  host.style.width = `${A4_WIDTH_MM}mm`
  host.style.height = `${A4_HEIGHT_MM}mm`
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
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM, undefined, 'FAST')

    return new Blob([pdf.output('arraybuffer')], { type: 'application/pdf' })
  } finally {
    host.remove()
  }
}
