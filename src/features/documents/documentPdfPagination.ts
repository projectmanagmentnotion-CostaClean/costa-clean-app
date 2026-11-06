import type { jsPDF } from 'jspdf'

export const A4_WIDTH_MM = 210
export const A4_HEIGHT_MM = 297
export const CAPTURE_SCALE = 3

export function addCanvasToA4Pdf(canvas: HTMLCanvasElement, pdf: Pick<jsPDF, 'addPage' | 'addImage'>): number {
  const pageHeightPx = Math.ceil(canvas.width * A4_HEIGHT_MM / A4_WIDTH_MM)
  let pageCount = 0

  for (let sourceY = 0; sourceY < canvas.height; sourceY += pageHeightPx) {
    const sliceHeight = Math.min(pageHeightPx, canvas.height - sourceY)
    const pageCanvas = document.createElement('canvas')
    pageCanvas.width = canvas.width
    pageCanvas.height = sliceHeight

    const context = pageCanvas.getContext('2d')
    if (!context) {
      throw new Error('No se pudo preparar una página A4 para el PDF.')
    }

    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
    context.drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, 0, 0, pageCanvas.width, pageCanvas.height)

    if (pageCount > 0) pdf.addPage()

    const pageHeightMm = sliceHeight / canvas.width * A4_WIDTH_MM
    pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, A4_WIDTH_MM, pageHeightMm, undefined, 'FAST')
    pageCount += 1
  }

  return pageCount
}
