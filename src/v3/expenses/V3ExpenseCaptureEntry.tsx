import { useEffect, useRef, useState } from 'react'
import {
  V3ActionGroup,
  V3Page,
  V3PageTitle,
  V3SecondaryAction,
} from '../components/V3Primitives'
import {
  attachExpenseCaptureDocument,
  cancelExpenseCaptureSession,
  createExpenseCaptureIdempotencyKey,
  createExpenseCaptureSession,
  type ExpenseCaptureDocument,
  type ExpenseCaptureSession,
  type ExpenseCaptureSource,
  validateExpenseCaptureFile,
} from '../../features/expenses/expenseCaptureApi'

interface Props {
  onManual: () => void
  onCancel: () => void
}

export function V3ExpenseCaptureEntry({ onManual, onCancel }: Props) {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const previewUrlRef = useRef<string | null>(null)
  const captureKeyRef = useRef<string | null>(null)
  const [session, setSession] = useState<ExpenseCaptureSession | null>(null)
  const [document, setDocument] = useState<ExpenseCaptureDocument | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
  }, [])

  async function handleFile(source: ExpenseCaptureSource, nextFile: File | undefined) {
    if (!nextFile) return
    setError(null)
    const validationError = validateExpenseCaptureFile(nextFile)
    if (validationError) {
      setError(validationError)
      return
    }
    setBusy(true)
    const idempotencyKey = captureKeyRef.current ?? createExpenseCaptureIdempotencyKey()
    captureKeyRef.current = idempotencyKey
    let nextSession: ExpenseCaptureSession | null = null
    try {
      nextSession = await createExpenseCaptureSession(source, idempotencyKey)
      const nextDocument = await attachExpenseCaptureDocument(nextSession, nextFile)
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = nextFile.type.startsWith('image/') ? URL.createObjectURL(nextFile) : null
      setSession(nextSession)
      setDocument(nextDocument)
      setFile(nextFile)
    } catch (cause) {
      if (nextSession) {
        await cancelExpenseCaptureSession(nextSession.id).catch(() => undefined)
      }
      setError(cause instanceof Error ? cause.message : 'No se pudo preparar el documento.')
    } finally {
      setBusy(false)
    }
  }

  function clearLocalCaptureState() {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = null
    captureKeyRef.current = null
    setSession(null)
    setDocument(null)
    setFile(null)
  }

  async function handleCancel() {
    if (session) {
      setBusy(true)
      try {
      await cancelExpenseCaptureSession(session.id)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'No se pudo cancelar la captura.')
        setBusy(false)
        return
      }
      setBusy(false)
    }
    clearLocalCaptureState()
    onCancel()
  }

  async function handleReplace() {
    if (!session) return
    setBusy(true)
    try {
      await cancelExpenseCaptureSession(session.id)
      clearLocalCaptureState()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo sustituir el documento.')
    } finally {
      setBusy(false)
    }
  }

  if (session && document && file) {
    return <V3Page className="v3-expense-capture-page"><V3PageTitle eyebrow="Captura documental" title="Documento preparado" description="El documento queda temporalmente preparado para análisis. N5.1 no interpreta ni crea el gasto todavía." /><section className="v3-expense-capture-preview" aria-label="Vista previa del documento"><div className="v3-expense-capture-preview__media">{previewUrlRef.current ? <img src={previewUrlRef.current} alt="Vista previa del documento seleccionado" /> : <span aria-hidden="true">PDF</span>}</div><dl><div><dt>Nombre</dt><dd>{file.name}</dd></div><div><dt>Tipo</dt><dd>{file.type}</dd></div><div><dt>Tamaño</dt><dd>{Math.ceil(file.size / 1024)} KB</dd></div><div><dt>Huella SHA-256</dt><dd className="v3-expense-capture-preview__hash">{document.sha256}</dd></div></dl></section><p className="v3-inline-message" role="status">Documento preparado para análisis · sin OCR · sin gasto creado.</p><V3ActionGroup><V3SecondaryAction onClick={() => void handleCancel()} disabled={busy}>Cancelar captura</V3SecondaryAction><V3SecondaryAction onClick={() => void handleReplace()} disabled={busy}>Sustituir documento</V3SecondaryAction></V3ActionGroup></V3Page>
  }

  return <V3Page className="v3-expense-capture-page"><V3PageTitle eyebrow="Captura documental" title="Nuevo gasto" description="Elige cómo quieres preparar el soporte. También puedes introducir el gasto manualmente sin documento." /><section className="v3-expense-capture-choices" aria-label="Opciones de alta de gasto"><button type="button" className="v3-expense-capture-choice v3-expense-capture-choice--primary" onClick={() => cameraInputRef.current?.click()} disabled={busy}><strong>Hacer foto</strong><span>Fotografía un ticket o factura</span></button><button type="button" className="v3-expense-capture-choice" onClick={() => uploadInputRef.current?.click()} disabled={busy}><strong>Subir ticket o factura</strong><span>PDF o imagen desde el dispositivo</span></button><V3SecondaryAction onClick={() => { captureKeyRef.current = null; onManual() }} disabled={busy}>Introducir gasto manualmente</V3SecondaryAction></section><input ref={cameraInputRef} className="v3-visually-hidden" type="file" accept="image/*" capture="environment" aria-label="Hacer foto del ticket o factura" onChange={(event) => void handleFile('camera', event.target.files?.[0])} /><input ref={uploadInputRef} className="v3-visually-hidden" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" aria-label="Subir ticket o factura" onChange={(event) => void handleFile('upload', event.target.files?.[0])} />{error ? <p className="v3-inline-message" role="alert">{error}</p> : null}<V3ActionGroup><V3SecondaryAction onClick={() => void handleCancel()} disabled={busy}>Cancelar</V3SecondaryAction></V3ActionGroup></V3Page>
}
