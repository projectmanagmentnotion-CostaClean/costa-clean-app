import { useEffect, useRef, useState } from 'react'
import { attachExpenseCaptureDocument, cancelExpenseCaptureSession, confirmExpenseCapture, createExpenseCaptureSession } from '../../features/expenses/expenseCaptureApi'
import { buildConfirmedExpensePayload, type DuplicateDecision } from '../../features/expenses/expenseConfirmation'
import { createOpenAiExpenseExtractionClient } from '../../features/expenses/expenseExtractionClient'
import type { ExtractionProposal } from '../../features/expenses/expenseExtractionContract'
import { createExpenseNormalizationClient } from '../../features/expenses/expenseNormalizationClient'
import type { NormalizedExpenseProposal } from '../../features/expenses/expenseNormalizationContract'
import { buildExpenseSupplierIntelligence, type SupplierIntelligenceResult } from '../../features/expenses/expenseSupplierIntelligence'
import { expenseCategories, expensePaymentMethods, type ExpenseListItem } from '../../features/expenses/types'
import { validateExpenseCaptureFile, type ExpenseCaptureDocumentContract, type ExpenseCaptureSessionContract, type ExpenseCaptureSource, type ExpenseCaptureStatus } from '../../features/expenses/expenseCaptureFoundation'
import { V3ActionGroup, V3Field, V3Input, V3Page, V3PageTitle, V3PrimaryAction, V3SecondaryAction, V3Select, V3Textarea } from '../components/V3Primitives'

interface Props { expenses: ExpenseListItem[]; onRefresh: () => Promise<void>; onComplete: () => void; onManual: () => void; onCancel: () => void }

const optionalProposalFields = (proposal: ExtractionProposal) => [
  { label: 'Dirección', field: proposal.supplier.address },
  { label: 'Vencimiento', field: proposal.invoice.dueDate },
  { label: 'Método de pago', field: proposal.payment.method },
]

const confidenceProposalFields = (proposal: ExtractionProposal) => [
  { label: 'Nombre documental', field: proposal.supplier.rawName },
  { label: 'Identificador fiscal', field: proposal.supplier.taxId },
  { label: 'Número de factura', field: proposal.invoice.number },
  ...proposal.vatLines.flatMap((line, index) => [
    { label: `Línea IVA ${index + 1} base`, field: line.base },
    { label: `Línea IVA ${index + 1} impuesto`, field: line.tax },
  ]),
]

function proposalValue<T>(field: { value: T | null }): string { return field.value === null ? 'No detectado' : String(field.value) }
function normalizedValue(field: { normalizedValue: string | null } | undefined): string { return field?.normalizedValue ?? 'No detectado' }
function amountValue<T>(field: { value: T | null }, currency: string | null): string {
  const value = proposalValue(field)
  return value === 'No detectado' || !currency ? value : `${value} ${currency}`
}

// La propuesta nunca crea el gasto automáticamente; requiere confirmación humana.

export function V3ExpenseCaptureEntry({ expenses, onRefresh, onComplete, onManual, onCancel }: Props) {
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
  const [normalizationId, setNormalizationId] = useState<string | null>(null)
  const [normalizationState, setNormalizationState] = useState<'IDLE' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED'>('IDLE')
  const [normalizedProposal, setNormalizedProposal] = useState<NormalizedExpenseProposal | null>(null)
  const [supplierIntelligence, setSupplierIntelligence] = useState<SupplierIntelligenceResult | null>(null)
  const [category, setCategory] = useState('otros')
  const [description, setDescription] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('other')
  const [notes, setNotes] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [duplicateDecision, setDuplicateDecision] = useState<DuplicateDecision>('CREATE_NEW')
  const [confirming, setConfirming] = useState(false)
  const [confirmationError, setConfirmationError] = useState<string | null>(null)
  const [confirmationResult, setConfirmationResult] = useState<{ expense_id: string; reused: boolean } | null>(null)

  useEffect(() => () => { if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current) }, [])
  function move(next: ExpenseCaptureStatus) { setStatus(next) }

  async function handleFile(source: Extract<ExpenseCaptureSource, 'camera' | 'upload'>, nextFile: File | undefined) {
    if (!nextFile) return
    setError(null); move('VALIDATING')
    const validationError = validateExpenseCaptureFile(nextFile)
    if (validationError) { setError(validationError); setStatus('ERROR'); return }
    let nextSession: ExpenseCaptureSessionContract | null = null
    try {
      move('UPLOADING'); nextSession = await createExpenseCaptureSession(source)
      const nextDocument = await attachExpenseCaptureDocument(nextSession, nextFile)
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = nextFile.type.startsWith('image/') ? URL.createObjectURL(nextFile) : null
      setPreviewUrl(previewUrlRef.current); setSession(nextSession); setDocument(nextDocument); setFile(nextFile); setStatus('READY_FOR_REVIEW')
    } catch (cause) {
      if (nextSession) await cancelExpenseCaptureSession(nextSession.id).catch(() => undefined)
      setError(cause instanceof Error ? cause.message : 'No se pudo preparar el documento.'); setStatus('ERROR')
    }
  }

  async function discardCapture() {
    try { if (session) await cancelExpenseCaptureSession(session.id) } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo limpiar la captura.'); setStatus('ERROR'); return
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = null; setPreviewUrl(null); setSession(null); setDocument(null); setFile(null); setStatus('IDLE'); setExtractionState('IDLE'); setProposal(null); setNormalizationId(null); setNormalizationState('IDLE'); setNormalizedProposal(null); setSupplierIntelligence(null); setConfirmationResult(null); setConfirmationError(null); setError(null); onCancel()
  }

  async function extractDocument() {
    if (!session || !document || !file) return
    setError(null); setExtractionState('PROCESSING'); setNormalizationState('IDLE'); setNormalizationId(null); setNormalizedProposal(null); setSupplierIntelligence(null); setConfirmationResult(null); setConfirmed(false); setDuplicateDecision('CREATE_NEW')
    const result = await createOpenAiExpenseExtractionClient().requestExtraction({ captureDocumentId: document.id, captureSessionId: session.id, originalFilename: file.name, mimeType: file.type, sizeBytes: file.size, sha256: document.sha256 })
    if (!result.ok) { setProposal(null); setExtractionState('FAILED'); setError(result.errorMessageSafe); return }
    setProposal(result.proposal); setExtractionState('SUCCEEDED'); setNormalizationState('PROCESSING'); setConfirmationError(null)
    const normalized = await createExpenseNormalizationClient().requestNormalization(result.extractionId)
    if (!normalized.ok) { setNormalizationState('FAILED'); setError(normalized.errorMessageSafe); return }
    setNormalizationId(normalized.normalizationId); setNormalizedProposal(normalized.normalizedProposal)
    const intelligence = buildExpenseSupplierIntelligence(normalized.normalizedProposal, expenses)
    setSupplierIntelligence(intelligence); setDuplicateDecision(intelligence.duplicates.length ? 'USE_EXISTING' : 'CREATE_NEW')
    setDescription(normalized.normalizedProposal.supplier.legalNameCandidate.normalizedValue ? `Gasto de ${normalized.normalizedProposal.supplier.legalNameCandidate.normalizedValue}` : 'Gasto documentado')
    setNormalizationState('SUCCEEDED')
  }

  async function confirmCapture() {
    if (!session || !document || !normalizedProposal || !normalizationId) return
    const duplicateCandidate = duplicateDecision === 'USE_EXISTING' ? supplierIntelligence?.duplicates[0] ?? null : null
    const input = { confirmed, supplierCandidate: supplierIntelligence?.candidates[0] ?? null, duplicateDecision, duplicateCandidate, category, description, paymentMethod, notes }
    const built = buildConfirmedExpensePayload(normalizedProposal, input)
    if (!built.ok) { setConfirmationError(built.errors.join(' ')); return }
    setConfirming(true); setConfirmationError(null)
    try {
      const result = await confirmExpenseCapture(session, document, normalizationId, `N55-CONFIRM-${session.id}`, { ...input, payload: built.payload })
      setConfirmationResult(result); await onRefresh()
    } catch (cause) {
      setConfirmationError(cause instanceof Error ? cause.message : 'No se pudo guardar el gasto confirmado.')
    } finally { setConfirming(false) }
  }

  if (session && document && file) {
    const currency = proposal?.invoice.currency.value ?? null
    const missingFields = proposal ? optionalProposalFields(proposal).filter(({ field }) => field.value === null) : []
    const lowConfidenceFields = proposal ? confidenceProposalFields(proposal).filter(({ field }) => field.confidence !== null && field.confidence < 0.85) : []
    const confidenceLabel = proposal?.confidence.overall === null ? 'Confianza no disponible' : `Confianza global: ${Math.round((proposal?.confidence.overall ?? 0) * 100)}%`
    return <V3Page className="v3-expense-capture-page"><V3PageTitle eyebrow="Captura documental" title={confirmationResult ? 'Gasto confirmado' : 'Documento preparado'} description={confirmationResult ? 'La captura quedó vinculada al gasto y registrada con trazabilidad.' : 'La extracción y normalización preparan una propuesta. El gasto solo se guarda después de tu confirmación explícita.'} /><section className="v3-expense-capture-preview" aria-label="Revisión del documento"><div className="v3-expense-capture-preview__media">{previewUrl ? <img src={previewUrl} alt="Vista previa del documento seleccionado" /> : <span aria-hidden="true">PDF</span>}</div><dl><div><dt>Nombre</dt><dd>{file.name}</dd></div><div><dt>Tipo</dt><dd>{file.type}</dd></div><div><dt>Tamaño</dt><dd>{Math.ceil(file.size / 1024)} KB</dd></div><div><dt>Estado</dt><dd>{normalizationState === 'PROCESSING' ? 'Normalizando documento…' : confirmationResult ? 'Gasto confirmado' : extractionState === 'PROCESSING' ? 'Analizando documento…' : normalizedProposal ? 'Propuesta lista para confirmar' : 'Preparado · pendiente de revisión'}</dd></div><div><dt>Huella SHA-256</dt><dd className="v3-expense-capture-preview__hash">{document.sha256}</dd></div></dl></section><p className="v3-inline-message" role="status">La extracción y normalización son propuestas. La persistencia exige revisión y confirmación humana.</p>{proposal ? <section className="v3-expense-extraction-proposal" aria-label="Propuesta de extracción"><h2>Propuesta para revisión</h2><p className="v3-inline-message">Datos detectados · pendientes de confirmar.</p><div className="v3-expense-extraction-group"><h3>Proveedor</h3><dl><div><dt>Nombre documental</dt><dd>{proposalValue(proposal.supplier.rawName)}</dd></div><div><dt>Identificador fiscal candidato</dt><dd>{proposalValue(proposal.supplier.taxId)}</dd></div></dl></div><div className="v3-expense-extraction-group"><h3>Factura</h3><dl><div><dt>Número</dt><dd>{proposalValue(proposal.invoice.number)}</dd></div><div><dt>Fecha de emisión</dt><dd>{proposalValue(proposal.invoice.issueDate)}</dd></div><div><dt>Moneda</dt><dd>{proposalValue(proposal.invoice.currency)}</dd></div></dl></div><div className="v3-expense-extraction-group"><h3>Importes e IVA</h3><dl><div><dt>Base</dt><dd>{amountValue(proposal.amounts.net, currency)}</dd></div><div><dt>IVA</dt><dd>{amountValue(proposal.amounts.tax, currency)}</dd></div><div><dt>Total</dt><dd>{amountValue(proposal.amounts.gross, currency)}</dd></div><div><dt>Líneas IVA</dt><dd>{proposal.vatLines.length}</dd></div></dl><ul className="v3-expense-extraction-vat-lines" aria-label="Líneas IVA detectadas">{proposal.vatLines.map((line, index) => <li key={`${line.rate.value ?? 'iva'}-${index}`}><span>{proposalValue(line.rate)}%</span><span>Base {amountValue(line.base, currency)}</span><span>IVA {amountValue(line.tax, currency)}</span></li>)}</ul></div><div className="v3-expense-extraction-confidence" role="status"><p className="v3-inline-message">{confidenceLabel}</p>{missingFields.length ? <p className="v3-inline-message">Campos no detectados: {missingFields.map(({ label }) => label).join(', ')}.</p> : null}{lowConfidenceFields.length ? <p className="v3-inline-message v3-inline-message--warning">Confianza baja: {lowConfidenceFields.map(({ label }) => label).join(', ')}. Revisión manual requerida.</p> : null}</div></section> : null}{normalizedProposal && !confirmationResult ? <section className="v3-expense-extraction-proposal" aria-label="Confirmación humana"><h2>Confirmación humana</h2><p className="v3-inline-message">Normalizado: {normalizedProposal.reviewStatus}. Comprueba los campos antes de guardar.</p><dl><div><dt>Proveedor normalizado</dt><dd>{normalizedValue(normalizedProposal.supplier.legalNameCandidate ?? normalizedProposal.supplier.rawName)}</dd></div><div><dt>Fecha</dt><dd>{normalizedValue(normalizedProposal.invoice.issueDate)}</dd></div><div><dt>Total</dt><dd>{normalizedValue(normalizedProposal.amounts.gross)} {normalizedValue(normalizedProposal.invoice.currency)}</dd></div></dl>{supplierIntelligence?.duplicates.length ? <p className="v3-inline-message v3-inline-message--warning">Se encontraron {supplierIntelligence.duplicates.length} posible(s) duplicado(s). Elige si reutilizas el primero o creas uno nuevo.</p> : null}<V3Field label="Categoría"><V3Select value={category} onChange={(event) => setCategory(event.target.value)}>{expenseCategories.map((value) => <option key={value} value={value}>{value}</option>)}</V3Select></V3Field><V3Field label="Descripción"><V3Input value={description} onChange={(event) => setDescription(event.target.value)} required /></V3Field><V3Field label="Método de pago"><V3Select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>{expensePaymentMethods.map((value) => <option key={value} value={value}>{value}</option>)}</V3Select></V3Field><V3Field label="Decisión de duplicado"><V3Select value={duplicateDecision} onChange={(event) => setDuplicateDecision(event.target.value as DuplicateDecision)}><option value="CREATE_NEW">Crear gasto nuevo</option><option value="USE_EXISTING" disabled={!supplierIntelligence?.duplicates.length}>Usar el gasto existente detectado</option><option value="CANCEL">Cancelar</option></V3Select></V3Field><V3Field label="Notas"><V3Textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></V3Field><label className="v3-field"><span><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> Confirmo que he revisado la propuesta y quiero guardarla</span></label>{confirmationError ? <p className="v3-inline-message" role="alert">{confirmationError}</p> : null}<V3ActionGroup><V3PrimaryAction onClick={() => void confirmCapture()} disabled={confirming || normalizationState !== 'SUCCEEDED'}>{confirming ? 'Guardando gasto…' : 'Confirmar y guardar gasto'}</V3PrimaryAction></V3ActionGroup></section> : null}{confirmationResult ? <section className="v3-expense-extraction-proposal" aria-label="Resultado de confirmación" data-entity-id={confirmationResult.expense_id}><p className="v3-inline-message" role="status">Gasto guardado correctamente{confirmationResult.reused ? ' mediante una confirmación repetida segura' : ''}.</p><V3PrimaryAction onClick={onComplete}>Volver a gastos</V3PrimaryAction></section> : null}{error ? <p className="v3-inline-message" role="alert">{error} <button type="button" className="v3-expense-capture-inline-action" onClick={onManual}>Continuar manualmente</button></p> : null}<V3ActionGroup>{!confirmationResult ? <V3PrimaryAction onClick={() => void extractDocument()} disabled={extractionState === 'PROCESSING' || normalizationState === 'PROCESSING'}>{normalizationState === 'PROCESSING' ? 'Normalizando documento…' : extractionState === 'PROCESSING' ? 'Analizando documento…' : normalizedProposal ? 'Volver a analizar' : 'Extraer datos'}</V3PrimaryAction> : null}{!confirmationResult ? <><V3SecondaryAction onClick={() => void discardCapture()}>Cancelar captura</V3SecondaryAction><V3SecondaryAction onClick={() => void discardCapture()}>Sustituir documento</V3SecondaryAction></> : null}</V3ActionGroup></V3Page>
  }

  return <V3Page className="v3-expense-capture-page"><V3PageTitle eyebrow="Captura documental" title="Preparar un gasto" description="El soporte se guarda de forma privada para revisión posterior. También puedes continuar con el alta manual." /><section className="v3-expense-capture-choices" aria-label="Opciones de captura"><button type="button" className="v3-expense-capture-choice v3-expense-capture-choice--primary" onClick={() => { move('SELECTING'); cameraInputRef.current?.click() }} disabled={status === 'UPLOADING' || status === 'VALIDATING'}><strong>Hacer foto</strong><span>Fotografía un ticket o factura</span></button><button type="button" className="v3-expense-capture-choice" onClick={() => { move('SELECTING'); uploadInputRef.current?.click() }} disabled={status === 'UPLOADING' || status === 'VALIDATING'}><strong>Subir ticket o factura</strong><span>PDF o imagen desde el dispositivo</span></button><V3SecondaryAction onClick={onManual} disabled={status === 'UPLOADING' || status === 'VALIDATING'}>Continuar manualmente</V3SecondaryAction></section><input ref={cameraInputRef} className="v3-visually-hidden" type="file" accept="image/*" capture="environment" aria-label="Hacer foto del ticket o factura" onChange={(event) => void handleFile('camera', event.target.files?.[0])} /><input ref={uploadInputRef} className="v3-visually-hidden" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" aria-label="Subir ticket o factura" onChange={(event) => void handleFile('upload', event.target.files?.[0])} />{error ? <p className="v3-inline-message" role="alert">{error} <button type="button" className="v3-expense-capture-inline-action" onClick={onManual}>Continuar manualmente</button></p> : null}<V3ActionGroup><V3SecondaryAction onClick={onCancel}>Cancelar</V3SecondaryAction></V3ActionGroup></V3Page>
}
