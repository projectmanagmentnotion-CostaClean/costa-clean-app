import { useEffect, useRef, useState } from 'react'
import { attachExpenseCaptureDocument, cancelExpenseCaptureSession, createExpenseCaptureSession } from '../../features/expenses/expenseCaptureApi'
import { transitionExpenseCaptureState, validateExpenseCaptureFile, type ExpenseCaptureDocumentContract, type ExpenseCaptureSessionContract, type ExpenseCaptureSource, type ExpenseCaptureStatus } from '../../features/expenses/expenseCaptureFoundation'
import { V3ActionGroup, V3Page, V3PageTitle, V3SecondaryAction } from '../components/V3Primitives'

interface Props { onManual: () => void; onCancel: () => void }

export function V3ExpenseCaptureEntry({ onManual, onCancel }: Props) {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const previewUrlRef = useRef<string | null>(null)
  const [status, setStatus] = useState<ExpenseCaptureStatus>('IDLE')
  const [session, setSession] = useState<ExpenseCaptureSessionContract | null>(null)
  const [document, setDocument] = useState<ExpenseCaptureDocumentContract | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => () => { if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current) }, [])

  function move(next: ExpenseCaptureStatus) { setStatus((current) => transitionExpenseCaptureState(current, next)) }

  async function handleFile(source: Extract<ExpenseCaptureSource, 'camera' | 'upload'>, nextFile: File | undefined) {
    if (!nextFile) return
    setError(null)
    move('VALIDATING')
    const validationError = validateExpenseCaptureFile(nextFile)
    if (validationError) { setError(validationError); setStatus('ERROR'); return }
    let nextSession: ExpenseCaptureSessionContract | null = null
    try {
      move('UPLOADING')
      nextSession = await createExpenseCaptureSession(source)
      const nextDocument = await attachExpenseCaptureDocument(nextSession, nextFile)
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = nextFile.type.startsWith('image/') ? URL.createObjectURL(nextFile) : null
      setPreviewUrl(previewUrlRef.current)
      setSession(nextSession); setDocument(nextDocument); setFile(nextFile); move('UPLOADED'); move('READY_FOR_REVIEW')
    } catch (cause) {
      if (nextSession) await cancelExpenseCaptureSession(nextSession.id).catch(() => undefined)
      setError(cause instanceof Error ? cause.message : 'No se pudo preparar el documento.'); setStatus('ERROR')
    }
  }

  async function discardCapture() {
    try {
      if (session) await cancelExpenseCaptureSession(session.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo limpiar la captura.')
      setStatus('ERROR')
      return
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = null; setPreviewUrl(null); setSession(null); setDocument(null); setFile(null); setStatus('IDLE'); setError(null); onCancel()
  }

  if (session && document && file) return <V3Page className="v3-expense-capture-page"><V3PageTitle eyebrow="Captura documental" title="Documento preparado" description="N5.1 conserva el soporte y su metadata. No ejecuta OCR, no inventa datos y no crea el gasto." /><section className="v3-expense-capture-preview" aria-label="Revisión del documento"><div className="v3-expense-capture-preview__media">{previewUrl ? <img src={previewUrl} alt="Vista previa del documento seleccionado" /> : <span aria-hidden="true">PDF</span>}</div><dl><div><dt>Nombre</dt><dd>{file.name}</dd></div><div><dt>Tipo</dt><dd>{file.type}</dd></div><div><dt>Tamaño</dt><dd>{Math.ceil(file.size / 1024)} KB</dd></div><div><dt>Estado</dt><dd>Preparado · pendiente de revisión</dd></div><div><dt>Huella SHA-256</dt><dd className="v3-expense-capture-preview__hash">{document.sha256}</dd></div></dl></section><p className="v3-inline-message" role="status">Proveedor, fecha, número, base, IVA, total, forma de pago, categoría y observaciones: pendientes de revisión manual.</p><V3ActionGroup><V3SecondaryAction onClick={() => void discardCapture()}>Cancelar captura</V3SecondaryAction><V3SecondaryAction onClick={() => void discardCapture()}>Sustituir documento</V3SecondaryAction></V3ActionGroup></V3Page>

  return <V3Page className="v3-expense-capture-page"><V3PageTitle eyebrow="Captura documental" title="Preparar un gasto" description="El soporte se guarda de forma privada para revisión posterior. También puedes continuar con el alta manual." /><section className="v3-expense-capture-choices" aria-label="Opciones de captura"><button type="button" className="v3-expense-capture-choice v3-expense-capture-choice--primary" onClick={() => { move('SELECTING'); cameraInputRef.current?.click() }} disabled={status === 'UPLOADING' || status === 'VALIDATING'}><strong>Hacer foto</strong><span>Fotografía un ticket o factura</span></button><button type="button" className="v3-expense-capture-choice" onClick={() => { move('SELECTING'); uploadInputRef.current?.click() }} disabled={status === 'UPLOADING' || status === 'VALIDATING'}><strong>Subir ticket o factura</strong><span>PDF o imagen desde el dispositivo</span></button><V3SecondaryAction onClick={onManual} disabled={status === 'UPLOADING' || status === 'VALIDATING'}>Continuar manualmente</V3SecondaryAction></section><input ref={cameraInputRef} className="v3-visually-hidden" type="file" accept="image/*" capture="environment" aria-label="Hacer foto del ticket o factura" onChange={(event) => void handleFile('camera', event.target.files?.[0])} /><input ref={uploadInputRef} className="v3-visually-hidden" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" aria-label="Subir ticket o factura" onChange={(event) => void handleFile('upload', event.target.files?.[0])} />{error ? <p className="v3-inline-message" role="alert">{error} <button type="button" className="v3-expense-capture-inline-action" onClick={onManual}>Continuar manualmente</button></p> : null}<V3ActionGroup><V3SecondaryAction onClick={onCancel}>Cancelar</V3SecondaryAction></V3ActionGroup></V3Page>
}
