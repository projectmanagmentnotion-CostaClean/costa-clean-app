export type ShareDocumentResult = 'shared' | 'downloaded' | 'cancelled'

export interface ShareDocumentInput {
  blob: Blob
  filename: string
  title: string
}

export function buildShareDocumentPayload(input: ShareDocumentInput): { file: File; title: string } | null {
  if (typeof File === 'undefined' || input.blob.type !== 'application/pdf' || input.blob.size <= 0) return null
  return {
    file: new File([input.blob], input.filename, { type: 'application/pdf' }),
    title: input.title,
  }
}

export function canShareDocumentFile(file: File): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false
  if (typeof navigator.canShare !== 'function') return true
  try { return navigator.canShare({ files: [file] }) } catch { return false }
}

function downloadDocument(file: File): ShareDocumentResult {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.rel = 'noopener'
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
  return 'downloaded'
}

export async function shareDocument(input: ShareDocumentInput): Promise<ShareDocumentResult> {
  const payload = buildShareDocumentPayload(input)
  if (!payload) throw new Error('El documento PDF no es válido para compartir.')

  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return downloadDocument(payload.file)

  if (!canShareDocumentFile(payload.file)) return downloadDocument(payload.file)

  try {
    await navigator.share({ files: [payload.file], title: payload.title })
    return 'shared'
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    return 'cancelled'
  }
}
