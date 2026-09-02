export type PdfDownloadResult = 'downloaded' | 'shared' | 'cancelled'

function getStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }

  return window.matchMedia('(display-mode: standalone)').matches
}

export function isIosStandaloneApp(): boolean {
  if (typeof navigator === 'undefined') {
    return false
  }

  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean }

  return getStandaloneDisplayMode() && navigatorWithStandalone.standalone === true
}

function canSharePdfFile(file: File): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') {
    return false
  }

  try {
    return navigator.canShare({ files: [file] })
  } catch {
    return false
  }
}

async function sharePdfFile(file: File): Promise<PdfDownloadResult> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return 'cancelled'
  }

  try {
    await navigator.share({
      files: [file],
      title: file.name,
    })
    return 'shared'
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return 'cancelled'
    }

    return 'cancelled'
  }
}

function downloadFile(file: Blob, fileName: string): PdfDownloadResult {
  const objectUrl = URL.createObjectURL(file)
  const link = document.createElement('a')

  link.href = objectUrl
  link.download = fileName
  link.rel = 'noopener'
  link.style.display = 'none'

  document.body.appendChild(link)
  link.click()
  link.remove()

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl)
  }, 0)

  return 'downloaded'
}

export async function deliverPdfFile(file: File, fileName: string): Promise<PdfDownloadResult> {
  if (isIosStandaloneApp() && canSharePdfFile(file)) {
    return sharePdfFile(file)
  }

  return downloadFile(file, fileName)
}
