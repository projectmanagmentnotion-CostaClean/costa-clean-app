import { useEffect, useMemo, useState } from 'react'
import { formatClientLabel, formatPropertyLabel } from '../../app/relationshipLabels'
import { createBlankBillingLine, formatMoneyInput, type BillingLineFormState } from './billingLineDrafts'
import './quick-create-document-flow.css'

export interface QuickCreateDocumentFlowProps {
  documentLabel: 'factura' | 'presupuesto'
  clients: Array<{ id: string; full_name?: string | null; display_code?: string | null }>
  properties: Array<{ id: string; client_id: string; name?: string | null; display_code?: string | null }>
  clientId: string
  propertyId: string
  initialLines: BillingLineFormState[]
  initialNotes?: string
  lockedContextLabel?: string | null
  onChangeContext?: (field: 'client_id' | 'property_id', value: string) => void
  onSave: (input: {
    clientId: string
    propertyId: string
    notes: string
    lines: BillingLineFormState[]
  }) => Promise<void>
  onOpenAdvanced: (input: {
    clientId: string
    propertyId: string
    notes: string
    lines: BillingLineFormState[]
  }) => void
  onCancel?: () => void
  onDirtyChange?: (dirty: boolean) => void
}

export function QuickCreateDocumentFlow({
  documentLabel,
  clients,
  properties,
  clientId: initialClientId,
  propertyId: initialPropertyId,
  initialLines,
  initialNotes = '',
  lockedContextLabel,
  onChangeContext,
  onSave,
  onOpenAdvanced,
  onCancel,
  onDirtyChange,
}: QuickCreateDocumentFlowProps) {
  const [clientId, setClientId] = useState(initialClientId)
  const [propertyId, setPropertyId] = useState(initialPropertyId)
  const [notes, setNotes] = useState(initialNotes)
  const [lines, setLines] = useState(initialLines.length > 0 ? initialLines : [createBlankBillingLine()])
  const [showOptions, setShowOptions] = useState(false)
  const [showLineOptions, setShowLineOptions] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    onDirtyChange?.(dirty)
    return () => onDirtyChange?.(false)
  }, [dirty, onDirtyChange])

  const availableProperties = useMemo(
    () => properties.filter((property) => property.client_id === clientId),
    [clientId, properties],
  )
  const total = useMemo(
    () => lines.reduce((sum, line) => sum + (Number(line.quantity.replace(',', '.')) || 0) * (Number(line.unit_price.replace(',', '.')) || 0), 0),
    [lines],
  )

  function markDirty() {
    setDirty(true)
    setError(null)
  }

  function updateLine(localId: string, field: keyof BillingLineFormState, value: string) {
    markDirty()
    setLines((current) => current.map((line) => line.local_id === localId ? { ...line, [field]: value } : line))
  }

  function updateClient(value: string) {
    markDirty()
    setClientId(value)
    setPropertyId('')
    onChangeContext?.('client_id', value)
    onChangeContext?.('property_id', '')
  }

  async function handleSave() {
    if (!clientId) {
      setError(`Selecciona un cliente para crear el ${documentLabel}.`)
      return
    }
    if (lines.some((line) => !line.concept.trim() || !Number.isFinite(Number(line.quantity.replace(',', '.'))) || Number(line.quantity.replace(',', '.')) <= 0 || !Number.isFinite(Number(line.unit_price.replace(',', '.'))) || Number(line.unit_price.replace(',', '.')) < 0)) {
      setError('Completa el concepto y un importe válido en cada línea.')
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      await onSave({ clientId, propertyId, notes, lines })
      setDirty(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : `No se pudo crear el ${documentLabel}.`)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="cc-quick-create">
      <div className="cc-quick-create__context">
        {lockedContextLabel ? <span>{lockedContextLabel}</span> : null}
        <strong>{documentLabel === 'factura' ? 'Crea un borrador en segundos.' : 'Prepara una propuesta en segundos.'}</strong>
      </div>

      <div className="cc-quick-create__fields">
        <label>
          <span>Cliente</span>
          {lockedContextLabel ? (
            <strong className="cc-quick-create__locked-value">
              {formatClientLabel(clients.find((client) => client.id === clientId) ?? { id: clientId })}
            </strong>
          ) : (
            <select value={clientId} onChange={(event) => updateClient(event.target.value)}>
              <option value="">Buscar cliente...</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{formatClientLabel(client)}</option>)}
            </select>
          )}
        </label>

        {lines.map((line, index) => (
          <div className="cc-quick-create__line" key={line.local_id}>
            <label>
              <span>{index === 0 ? 'Concepto' : `Concepto ${index + 1}`}</span>
              <input value={line.concept} placeholder="Limpieza..." onChange={(event) => updateLine(line.local_id, 'concept', event.target.value)} />
            </label>
            <label>
              <span>Importe</span>
              <input inputMode="decimal" value={line.unit_price} placeholder="0,00 €" onChange={(event) => updateLine(line.local_id, 'unit_price', event.target.value)} />
            </label>
            {lines.length > 1 ? <button type="button" className="tertiary-button" onClick={() => { markDirty(); setLines((current) => current.filter((item) => item.local_id !== line.local_id)) }}>Quitar</button> : null}
          </div>
        ))}
      </div>

      <div className="cc-quick-create__line-tools">
        <button type="button" className="secondary-button" onClick={() => { markDirty(); setLines((current) => [...current, createBlankBillingLine()]) }}>+ Añadir línea</button>
        {lines.length > 0 ? <button type="button" className="tertiary-button" onClick={() => setShowLineOptions((current) => !current)}>Detalles de línea</button> : null}
      </div>

      {showLineOptions ? (
        <div className="cc-quick-create__advanced-lines">
          {lines.map((line) => (
            <div className="cc-quick-create__advanced-line" key={line.local_id}>
              <label><span>Cantidad</span><input value={line.quantity} onChange={(event) => updateLine(line.local_id, 'quantity', event.target.value)} /></label>
              <label><span>Unidad</span><input value={line.unit} onChange={(event) => updateLine(line.local_id, 'unit', event.target.value)} /></label>
            </div>
          ))}
        </div>
      ) : null}

      <button type="button" className="cc-quick-create__options" onClick={() => setShowOptions((current) => !current)}>
        {showOptions ? 'Ocultar opciones' : 'Más opciones'}
      </button>

      {showOptions ? (
        <div className="cc-quick-create__options-panel">
          <label>
            <span>Propiedad (opcional)</span>
            <select value={propertyId} onChange={(event) => { markDirty(); setPropertyId(event.target.value); onChangeContext?.('property_id', event.target.value) }} disabled={!clientId}>
              <option value="">Sin propiedad</option>
              {availableProperties.map((property) => <option key={property.id} value={property.id}>{formatPropertyLabel(property)}</option>)}
            </select>
          </label>
          <label>
            <span>Notas (opcional)</span>
            <textarea value={notes} onChange={(event) => { markDirty(); setNotes(event.target.value) }} rows={3} />
          </label>
        </div>
      ) : null}

      {error ? <p className="cc-quick-create__error" role="alert">{error}</p> : null}

      <div className="cc-quick-create__summary">
        <span>Total estimado</span>
        <strong>{formatMoneyInput(total)} €</strong>
      </div>

      <div className="cc-quick-create__actions">
        <button type="button" className="tertiary-button" onClick={() => onOpenAdvanced({ clientId, propertyId, notes, lines })}>Abrir editor avanzado</button>
        {onCancel ? <button type="button" className="secondary-button" onClick={onCancel}>Cancelar</button> : null}
        <button type="button" className="primary-button" onClick={() => void handleSave()} disabled={isSaving}>{isSaving ? 'Guardando...' : documentLabel === 'factura' ? 'Crear factura' : 'Crear presupuesto'}</button>
      </div>
    </div>
  )
}
