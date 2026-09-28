import { useEffect, useRef, useState } from 'react'
import { attachExpenseCaptureDocument, cancelExpenseCaptureSession, createExpenseCaptureSession } from '../../features/expenses/expenseCaptureApi'
import { createFixtureExtractionProvider } from '../../features/expenses/expenseExtractionProvider'
import type { ExtractionProposal } from '../../features/expenses/expenseExtractionContract'
import { transitionExpenseCaptureState, validateExpenseCaptureFile, type ExpenseCaptureDocumentContract, type ExpenseCaptureSessionContract, type ExpenseCaptureSource, type ExpenseCaptureStatus } from '../../features/expenses/expenseCaptureFoundation'
import { V3ActionGroup, V3Page, V3PageTitle, V3PrimaryAction, V3SecondaryAction } from '../components/V3Primitives'

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
  const [extractionState, setExtractionState] = useState<'IDLE' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED'>('IDLE')
  const [proposal, setProposal] = useState<ExtractionProposal | null>(null)

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
    previewUrlRef.current = null; setPreviewUrl(null); setSession(null); setDocument(null); setFile(null); setStatus('IDLE'); setExtractionState('IDLE'); setProposal(null); setError(null); onCancel()
  }

  async function extractDocument() {
    if (!session || !document || !file) return
    setError(null)
    setExtractionState('PROCESSING')
    const result = await createFixtureExtractionProvider().extractDocument({ captureDocumentId: document.id, captureSessionId: session.id, originalFilename: file.name, mimeType: file.type, sizeBytes: file.size, sha256: document.sha256 })
    if (result.ok) { setProposal(result.proposal); setExtractionState('SUCCEEDED'); return }
    setProposal(null); setExtractionState('FAILED'); setError(result.errorMessageSafe)
  }

  function proposalValue<T>(field: { value: T | null }): string {
    return field.value === null ? 'No detectado' : String(field.value)
  }

  if (session && document && file) return <V3Page className="v3-expense-capture-page"><V3PageTitle eyebrow="Captura documental" title="Documento preparado" description="N5.1 conserva el soporte y su metadata. N5.2 solo propone datos para revisión humana; nunca crea el gasto automáticamente." /><section className="v3-expense-capture-preview" aria-label="Revisión del documento"><div className="v3-expense-capture-preview__media">{previewUrl ? <img src={previewUrl} alt="Vista previa del documento seleccionado" /> : <span aria-hidden="true">PDF</span>}</div><dl><div><dt>Nombre</dt><dd>{file.name}</dd></div><div><dt>Tipo</dt><dd>{file.type}</dd></div><div><dt>Tamaño</dt><dd>{Math.ceil(file.size / 1024)} KB</dd></div><div><dt>Estado</dt><dd>{extractionState === 'PROCESSING' ? 'Analizando documento…' : proposal ? 'Propuesta lista para revisar' : 'Preparado · pendiente de revisión'}</dd></div><div><dt>Huella SHA-256</dt><dd className="v3-expense-capture-preview__hash">{document.sha256}</dd></div></dl></section><p className="v3-inline-message" role="status">El proveedor fixture local es solo de prueba: no es OCR real, no usa servicios externos y no escribe datos financieros.</p>{proposal ? <section className="v3-expense-extraction-proposal" aria-label="Propuesta de extracción"><h2>Propuesta para revisión</h2><p className="v3-inline-message">Detectado por proveedor local · no confirmado.</p><div className="v3-expense-extraction-group"><h3>Proveedor</h3><dl><div><dt>Nombre documental</dt><dd>{proposalValue(proposal.supplier.rawName)}</dd></div><div><dt>Identificador fiscal candidato</dt><dd>{proposalValue(proposal.supplier.taxId)}</dd></div></dl></div><div className="v3-expense-extraction-group"><h3>Factura</h3><dl><div><dt>Número</dt><dd>{proposalValue(proposal.invoice.number)}</dd></div><div><dt>Fecha de emisión</dt><dd>{proposalValue(proposal.invoice.issueDate)}</dd></div><div><dt>Moneda</dt><dd>{proposalValue(proposal.invoice.currency)}</dd></div></dl></div><div className="v3-expense-extraction-group"><h3>Importes e IVA</h3><dl><div><dt>Base</dt><dd>{proposalValue(proposal.amounts.net)}</dd></div><div><dt>IVA</dt><dd>{proposalValue(proposal.amounts.tax)}</dd></div><div><dt>Total</dt><dd>{proposalValue(proposal.amounts.gross)}</dd></div><div><dt>Líneas IVA</dt><dd>{proposal.vatLines.length}</dd></div></dl><ul className="v3-expense-extraction-vat-lines" aria-label="Líneas IVA detectadas">{proposal.vatLines.map((line, index) => <li key={`${line.rate.value ?? 'iva'}-${index}`}><span>{proposalValue(line.rate)}%</span><span>Base {proposalValue(line.base)} €</span><span>IVA {proposalValue(line.tax)} €</span></li>)}</ul></div><p className="v3-inline-message">Confianza global: {Math.round(Number(proposal.confidence.overall) * 100)}%. Campos opcionales no detectados: dirección, vencimiento y método de pago. Revisión manual requerida.</p></section> : null}{error ? <p className="v3-inline-message" role="alert">{error} <button type="button" className="v3-expense-capture-inline-action" onClick={onManual}>Continuar manualmente</button></p> : null}<V3ActionGroup><V3PrimaryAction onClick={() => void extractDocument()} disabled={extractionState === 'PROCESSING'}>{extractionState === 'PROCESSING' ? 'Analizando documento…' : 'Extraer datos'}</V3PrimaryAction><V3SecondaryAction onClick={() => void discardCapture()}>Cancelar captura</V3SecondaryAction><V3SecondaryAction onClick={() => void discardCapture()}>Sustituir documento</V3SecondaryAction></V3ActionGroup></V3Page>

  return <V3Page className="v3-expense-capture-page"><V3PageTitle eyebrow="Captura documental" title="Preparar un gasto" description="El soporte se guarda de forma privada para revisión posterior. También puedes continuar con el alta manual." /><section className="v3-expense-capture-choices" aria-label="Opciones de captura"><button type="button" className="v3-expense-capture-choice v3-expense-capture-choice--primary" onClick={() => { move('SELECTING'); cameraInputRef.current?.click() }} disabled={status === 'UPLOADING' || status === 'VALIDATING'}><strong>Hacer foto</strong><span>Fotografía un ticket o factura</span></button><button type="button" className="v3-expense-capture-choice" onClick={() => { move('SELECTING'); uploadInputRef.current?.click() }} disabled={status === 'UPLOADING' || status === 'VALIDATING'}><strong>Subir ticket o factura</strong><span>PDF o imagen desde el dispositivo</span></button><V3SecondaryAction onClick={onManual} disabled={status === 'UPLOADING' || status === 'VALIDATING'}>Continuar manualmente</V3SecondaryAction></section><input ref={cameraInputRef} className="v3-visually-hidden" type="file" accept="image/*" capture="environment" aria-label="Hacer foto del ticket o factura" onChange={(event) => void handleFile('camera', event.target.files?.[0])} /><input ref={uploadInputRef} className="v3-visually-hidden" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" aria-label="Subir ticket o factura" onChange={(event) => void handleFile('upload', event.target.files?.[0])} />{error ? <p className="v3-inline-message" role="alert">{error} <button type="button" className="v3-expense-capture-inline-action" onClick={onManual}>Continuar manualmente</button></p> : null}<V3ActionGroup><V3SecondaryAction onClick={onCancel}>Cancelar</V3SecondaryAction></V3ActionGroup></V3Page>
}
