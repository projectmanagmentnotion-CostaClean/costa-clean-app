import { useMemo, useRef, useState } from 'react'
import { FullscreenStepFlow } from '../../components/FullscreenStepFlow'
import type { ClientListItem } from '../clients/types'
import type { PropertyListItem } from '../properties/types'
import type { QuoteListItem } from '../quotes/types'
import { createAtomicFinancialOperation } from './financialWriteApi'
import { buildAtomicOperationPayload, createAtomicFlowDraft, mapAtomicFinancialError, type AtomicFlowDraft } from './atomicFinancialFlow'

interface AtomicFinancialOperationFlowProps {
  clients: ClientListItem[]
  properties: PropertyListItem[]
  quotes: QuoteListItem[]
  onCompleted: () => Promise<void>
  onCancel: () => void
}

const steps = [
  { id: 'service', label: 'Servicio', description: 'Cliente, propiedad y servicio.' },
  { id: 'billing', label: 'Facturación', description: 'Concepto, cantidad y precio.' },
  { id: 'payment', label: 'Cobro opcional', description: 'Registra el cobro ahora o déjalo pendiente.' },
  { id: 'review', label: 'Confirmar', description: 'Una única operación transaccional.' },
]

function updateDraft<K extends keyof AtomicFlowDraft>(draft: AtomicFlowDraft, key: K, value: AtomicFlowDraft[K]) {
  return { ...draft, [key]: value }
}

export function AtomicFinancialOperationFlow({ clients, properties, quotes, onCompleted, onCancel }: AtomicFinancialOperationFlowProps) {
  const [draft, setDraft] = useState<AtomicFlowDraft>(() => createAtomicFlowDraft())
  const [currentStep, setCurrentStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const idempotencyKey = useRef(draft.idempotencyKey)
  const selectedProperties = useMemo(() => properties.filter((property) => property.client_id === draft.clientId), [draft.clientId, properties])
  const subtotal = Math.round(draft.quantity * draft.unitPrice * 100) / 100
  const total = Math.round((subtotal + draft.taxAmount) * 100) / 100

  function setField<K extends keyof AtomicFlowDraft>(key: K, value: AtomicFlowDraft[K]) {
    setDraft((current) => updateDraft(current, key, value))
    setError(null)
    setSuccess(null)
  }

  function validateStep(step: number): string | null {
    if (step === 0 && (!draft.clientId || !draft.propertyId || !draft.scheduledDate)) return 'Selecciona cliente, propiedad y fecha del servicio.'
    if (step === 1 && (!draft.concept.trim() || draft.quantity <= 0 || draft.unitPrice < 0)) return 'Completa concepto, cantidad y precio válidos.'
    if (step === 2 && draft.paymentEnabled && (draft.paymentAmount <= 0 || draft.paymentAmount > total + 0.01)) return 'El cobro debe ser positivo y no superar el total.'
    return null
  }

  async function submit() {
    if (isSubmitting) return
    const invalid = [0, 1, 2].map(validateStep).find(Boolean)
    if (invalid) { setError(invalid); return }
    setIsSubmitting(true)
    setError(null)
    try {
      const payload = buildAtomicOperationPayload({ ...draft, idempotencyKey: idempotencyKey.current })
      const result = await createAtomicFinancialOperation(payload)
      setSuccess(`Operación creada correctamente. Servicio ${result.job_id}; factura ${result.invoice_id}; ${result.payment_created ? 'cobro registrado.' : 'cobro pendiente.'}`)
      await onCompleted()
    } catch (submissionError) {
      setError(mapAtomicFinancialError(submissionError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <FullscreenStepFlow
      eyebrow="Operación financiera"
      title="Nueva operación"
      description="Servicio, factura y cobro opcional en una única confirmación atómica."
      steps={steps}
      currentStep={currentStep}
      onStepSelect={(step) => { if (step <= currentStep) setCurrentStep(step) }}
      contextItems={[
        { label: 'Total', value: `${total.toFixed(2)} €` },
        { label: 'Idempotencia', value: 'Estable durante este flujo' },
      ]}
      footerContent={(
        <div className="page-header-actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={isSubmitting}>Cancelar</button>
          {currentStep > 0 ? <button type="button" className="secondary-button" onClick={() => setCurrentStep((step) => step - 1)} disabled={isSubmitting}>Atrás</button> : null}
          {currentStep < steps.length - 1 ? (
            <button type="button" className="primary-button" onClick={() => { const invalid = validateStep(currentStep); if (invalid) setError(invalid); else { setError(null); setCurrentStep((step) => step + 1) } }} disabled={isSubmitting}>Continuar</button>
          ) : (
            <button type="button" className="primary-button" onClick={() => void submit()} disabled={isSubmitting}>{isSubmitting ? 'Guardando operación...' : 'Confirmar operación'}</button>
          )}
        </div>
      )}
    >
      {currentStep === 0 ? (
        <div className="lead-form cc-form-shell__grid">
          <label>Cliente<select value={draft.clientId} onChange={(event) => { setField('clientId', event.target.value); setField('propertyId', '') }}><option value="">Selecciona cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.full_name}</option>)}</select></label>
          <label>Propiedad<select value={draft.propertyId} onChange={(event) => setField('propertyId', event.target.value)} disabled={!draft.clientId}><option value="">Selecciona propiedad</option>{selectedProperties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>
          <label>Presupuesto opcional<select value={draft.quoteId} onChange={(event) => setField('quoteId', event.target.value)}><option value="">Sin presupuesto</option>{quotes.filter((quote) => quote.client_id === draft.clientId).map((quote) => <option key={quote.id} value={quote.id}>{quote.display_code ?? quote.id}</option>)}</select></label>
          <label>Fecha<input type="date" value={draft.scheduledDate} onChange={(event) => setField('scheduledDate', event.target.value)} /></label>
        </div>
      ) : null}
      {currentStep === 1 ? (
        <div className="lead-form cc-form-shell__grid">
          <label>Concepto<input value={draft.concept} onChange={(event) => setField('concept', event.target.value)} placeholder="Limpieza de vivienda" /></label>
          <label>Cantidad<input type="number" min="0.01" step="0.01" value={draft.quantity} onChange={(event) => setField('quantity', Number(event.target.value))} /></label>
          <label>Precio unitario<input type="number" min="0" step="0.01" value={draft.unitPrice} onChange={(event) => setField('unitPrice', Number(event.target.value))} /></label>
          <label>IVA<input type="number" min="0" step="0.01" value={draft.taxAmount} onChange={(event) => setField('taxAmount', Number(event.target.value))} /></label>
        </div>
      ) : null}
      {currentStep === 2 ? (
        <div className="lead-form cc-form-shell__grid">
          <label className="cc-checkbox-field"><input type="checkbox" checked={draft.paymentEnabled} onChange={(event) => setField('paymentEnabled', event.target.checked)} /> Registrar cobro ahora</label>
          {draft.paymentEnabled ? <><label>Importe<input type="number" min="0.01" max={total} step="0.01" value={draft.paymentAmount} onChange={(event) => setField('paymentAmount', Number(event.target.value))} /></label><label>Método<select value={draft.paymentMethod} onChange={(event) => setField('paymentMethod', event.target.value)}><option value="transfer">Transferencia</option><option value="cash">Efectivo</option><option value="bizum">Bizum</option><option value="card">Tarjeta</option></select></label></> : <p>La factura se creará con el cobro pendiente.</p>}
        </div>
      ) : null}
      {currentStep === 3 ? <div className="data-section"><h3>Revisión final</h3><p>{draft.concept || 'Servicio'} · {total.toFixed(2)} € · {draft.paymentEnabled ? `cobro de ${draft.paymentAmount.toFixed(2)} €` : 'sin cobro inicial'}</p></div> : null}
      {error ? <p role="alert" className="form-error">{error}</p> : null}
      {success ? <p role="status" className="form-success">{success}</p> : null}
    </FullscreenStepFlow>
  )
}
