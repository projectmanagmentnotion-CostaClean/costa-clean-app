import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { QuoteListItem } from './types'
import type { ClientListItem } from '../clients/types'
import type { PropertyListItem } from '../properties/types'
import { businessRules } from '../../app/businessRules'
import { getStatusLabel } from '../../app/displayText'
import { getStatusOptionLabel, quoteStatusOptions } from '../../app/statusOptions'
import { formatCurrency } from '../../app/displayFormat'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { buildJobCreatePrefillFromQuote } from '../jobs/jobCreatePrefill'
import { saveQuoteWithLines, updateQuoteStatus as updateQuoteStatusRpc } from '../financial/financialWriteApi'
import { acceptQuoteAndCreateInvoice, acceptQuoteOnly } from './quoteAcceptanceWorkflow'
import { useQuoteDocumentLines } from './useQuoteDocumentLines'
import {
  buildQuoteLinePayloads,
  calculateQuoteSubtotal,
  createBlankQuoteLine,
  formatMoneyInput,
  formatQuoteLineSubtotalDisplay,
  formatQuoteLineSubtotalInput,
  getFormLinesFromQuote,
  roundMoney,
} from './quoteLineUtils'
import type { QuoteLineFormState } from './quoteLineUtils'

interface QuoteDetailCardProps {
  quote: QuoteListItem | null
  clients: ClientListItem[]
  properties: PropertyListItem[]
  onQuoteUpdated: () => Promise<void>
  onOpenDocument: () => void
  onCreateJobFromQuote: (quote: QuoteListItem) => void
  onUnsavedChange?: (hasUnsavedChanges: boolean) => void
}

interface EditFormState {
  client_id: string | null
  property_id: string
  status: string
  notes: string
}

function buildClientLabel(quote: QuoteListItem, clients: ClientListItem[]): string {
  const client = clients.find((item) => item.id === quote.client_id)
  return client?.full_name?.trim()
    || quote.client_display_code
    || quote.lead_name
    || quote.lead_display_code
    || quote.client_id
    || 'Lead sin cliente'
}

function buildPropertyLabel(quote: QuoteListItem, properties: PropertyListItem[]): string {
  if (!quote.property_id) return 'Sin propiedad'

  const property = properties.find((item) => item.id === quote.property_id)
  return property?.name?.trim() || quote.property_display_code || quote.property_id
}

export function QuoteDetailCard({
  quote,
  clients,
  properties,
  onQuoteUpdated,
  onOpenDocument,
  onCreateJobFromQuote,
  onUnsavedChange,
}: QuoteDetailCardProps) {
  if (!quote) {
    return (
      <section className="data-section">
        <div className="section-header page-header-actions">
          <div>
            <h2>Detalle del presupuesto</h2>
          </div>
        </div>

        <div className="empty-state">
          <strong>Ningún presupuesto seleccionado</strong>
          <p>Haz clic en una tarjeta del listado para ver su detalle.</p>
        </div>
      </section>
    )
  }

  return (
    <QuoteDetailCardContent
      quote={quote}
      clients={clients}
      properties={properties}
      onQuoteUpdated={onQuoteUpdated}
      onOpenDocument={onOpenDocument}
      onCreateJobFromQuote={onCreateJobFromQuote}
      onUnsavedChange={onUnsavedChange}
    />
  )
}

function QuoteDetailCardContent({
  quote,
  clients,
  properties,
  onQuoteUpdated,
  onOpenDocument,
  onCreateJobFromQuote,
  onUnsavedChange,
}: {
  quote: QuoteListItem
  clients: ClientListItem[]
  properties: PropertyListItem[]
  onQuoteUpdated: () => Promise<void>
  onOpenDocument: () => void
  onCreateJobFromQuote: (quote: QuoteListItem) => void
  onUnsavedChange?: (hasUnsavedChanges: boolean) => void
}) {
  const {
    quote: hydratedQuote,
    isLoadingLines,
    linesError,
  } = useQuoteDocumentLines(quote)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [pendingRejectedStatusUpdate, setPendingRejectedStatusUpdate] = useState<string | null>(null)
  const [pendingAcceptanceAction, setPendingAcceptanceAction] = useState<'accept' | 'invoice' | null>(null)
  const [pendingRejectedFormSave, setPendingRejectedFormSave] = useState(false)
  const [form, setForm] = useState<EditFormState>({
    client_id: null,
    property_id: '',
    status: 'draft',
    notes: '',
  })
  const [lines, setLines] = useState<QuoteLineFormState[]>([createBlankQuoteLine()])

  useEffect(() => {
    setIsEditing(false)
    setSaveError(null)
    setSuccessMessage(null)
    setForm({
      client_id: hydratedQuote.client_id ?? null,
      property_id: hydratedQuote.property_id ?? '',
      status: hydratedQuote.status,
      notes: hydratedQuote.notes ?? '',
    })
    setLines(getFormLinesFromQuote(hydratedQuote, properties))
  }, [hydratedQuote, properties])

  useEffect(() => {
    onUnsavedChange?.(isEditing)
    return () => onUnsavedChange?.(false)
  }, [isEditing, onUnsavedChange])

  const availableProperties = useMemo(() => {
    if (!form.client_id) {
      return []
    }

    return properties.filter((property) => property.client_id === form.client_id)
  }, [properties, form.client_id])

  const subtotalValue = useMemo(() => calculateQuoteSubtotal(lines), [lines])
  const taxAmountValue = useMemo(
    () => roundMoney(subtotalValue * businessRules.defaultTaxRate),
    [subtotalValue],
  )
  const totalValue = useMemo(
    () => roundMoney(subtotalValue + taxAmountValue),
    [subtotalValue, taxAmountValue],
  )

  const displayLines = useMemo(
    () => getFormLinesFromQuote(hydratedQuote, properties),
    [hydratedQuote, properties],
  )

  function updateField<K extends keyof EditFormState>(
    field: K,
    value: EditFormState[K],
  ) {
    setForm((current) => {
      const next = {
        ...current,
        [field]: value,
      }

      if (field === 'client_id') {
        next.property_id = ''
      }

      return next
    })
  }

  function updateLine<K extends keyof QuoteLineFormState>(
    localId: string,
    field: K,
    value: QuoteLineFormState[K],
  ) {
    setLines((current) => current.map((line) => (
      line.local_id === localId ? { ...line, [field]: value } : line
    )))
  }

  function removeLine(localId: string) {
    setLines((current) => (
      current.length > 1 ? current.filter((line) => line.local_id !== localId) : current
    ))
  }

  function resetFormFromQuote() {
    setForm({
      client_id: hydratedQuote.client_id ?? null,
      property_id: hydratedQuote.property_id ?? '',
      status: hydratedQuote.status,
      notes: hydratedQuote.notes ?? '',
    })
    setLines(getFormLinesFromQuote(hydratedQuote, properties))
  }

  function handleCreateJobFromQuote() {
    setSaveError(null)
    setSuccessMessage(null)

    const prefill = buildJobCreatePrefillFromQuote(hydratedQuote)
    if (!prefill) {
      setSaveError('El presupuesto necesita cliente y propiedad para poder crear un trabajo.')
      return
    }

    onCreateJobFromQuote(hydratedQuote)
  }

  async function updateQuoteStatus(nextStatus: string) {
    if (hydratedQuote.status === nextStatus) return

    setSaveError(null)
    setSuccessMessage(null)
    setIsSaving(true)

    try {
      await updateQuoteStatusRpc(hydratedQuote.id, nextStatus)

      await onQuoteUpdated()
      setSuccessMessage(`Estado del presupuesto actualizado a ${getStatusLabel(nextStatus)}.`)
      setIsEditing(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido actualizando el estado del presupuesto.'

      setSaveError(message)
    } finally {
      setIsSaving(false)
    }
  }

  function requestQuoteStatusUpdate(nextStatus: string) {
    if (hydratedQuote.status !== 'accepted' && nextStatus === 'accepted') {
      setPendingAcceptanceAction('accept')
      return
    }

    if (hydratedQuote.status !== 'rejected' && nextStatus === 'rejected') {
      setPendingRejectedStatusUpdate(nextStatus)
      return
    }

    void updateQuoteStatus(nextStatus)
  }

  async function handleConfirmAcceptedStatusUpdate(createInvoice: boolean) {
    setPendingAcceptanceAction(null)
    setSaveError(null)
    setSuccessMessage(null)
    setIsSaving(true)

    try {
      const result = createInvoice
        ? await acceptQuoteAndCreateInvoice(hydratedQuote)
        : await acceptQuoteOnly(hydratedQuote)
      await onQuoteUpdated()
      setSuccessMessage(
        createInvoice
          ? `Presupuesto aceptado. Factura ${result.invoiceId} creada y cliente ${result.clientId} confirmado.`
          : `Presupuesto aceptado. Cliente ${result.clientId} confirmado.`,
      )
      setIsEditing(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido aceptando el presupuesto y creando la factura.'
      setSaveError(message)
    } finally {
      setIsSaving(false)
    }
  }

  function handleConfirmRejectedStatusUpdate() {
    if (!pendingRejectedStatusUpdate) return

    const nextStatus = pendingRejectedStatusUpdate
    setPendingRejectedStatusUpdate(null)
    void updateQuoteStatus(nextStatus)
  }

  async function saveQuoteEdits(confirmedRejectedStatus = false) {
    if (form.status === 'rejected' && hydratedQuote.status !== 'rejected' && !confirmedRejectedStatus) {
      setPendingRejectedFormSave(true)
      return
    }

    setSaveError(null)
    setSuccessMessage(null)
    setIsSaving(true)

    try {
      if (!form.client_id && !hydratedQuote.lead_id) {
        setSaveError('El presupuesto necesita cliente o lead vinculado.')
        return
      }

      const linePayloads = buildQuoteLinePayloads(lines, hydratedQuote.id)

      if (!linePayloads || linePayloads.length === 0) {
        setSaveError('Cada línea debe tener concepto, cantidad mayor que 0 y precio unitario válido.')
        return
      }

      await saveQuoteWithLines(
        {
          id: hydratedQuote.id,
          client_id: form.client_id,
          lead_id: hydratedQuote.lead_id ?? null,
          property_id: form.property_id || null,
          status: form.status,
          subtotal: subtotalValue,
          tax_amount: taxAmountValue,
          total: totalValue,
          notes: form.notes.trim() || null,
        },
        linePayloads,
      )

      await onQuoteUpdated()
      setSuccessMessage('Presupuesto actualizado correctamente.')
      setIsEditing(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido actualizando el presupuesto.'

      setSaveError(message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await saveQuoteEdits()
  }

  const clientLabel = buildClientLabel(hydratedQuote, clients)
  const propertyLabel = buildPropertyLabel(hydratedQuote, properties)

  return (
    <section className="data-section">
      <div className="section-header page-header-actions">
        <div>
          <h2>Detalle del presupuesto</h2>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            className="primary-button"
            onClick={onOpenDocument}
          >
            Abrir documento
          </button>

            <button
              type="button"
              className="secondary-button"
              onClick={handleCreateJobFromQuote}
            >
            Crear trabajo desde presupuesto
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setIsEditing((current) => !current)
              setSaveError(null)
              setSuccessMessage(null)
              resetFormFromQuote()
            }}
            disabled={isLoadingLines || Boolean(linesError)}
          >
            {isEditing ? 'Cancelar edición' : 'Editar presupuesto'}
          </button>
        </div>
      </div>

      <div className="lead-detail-card">
        <div className="lead-detail-header">
          <div>
            <h3>{hydratedQuote.display_code ?? hydratedQuote.id}</h3>
            <p>{clientLabel}</p>
          </div>

          <span className="lead-badge">{getStatusLabel(hydratedQuote.status)}</span>
        </div>

        {isLoadingLines ? (
          <div className="empty-state">
            <strong>Cargando líneas de presupuesto</strong>
            <p>Preparando el detalle editable con los conceptos reales.</p>
          </div>
        ) : linesError ? (
          <div className="empty-state">
            <strong>No se pudieron cargar las líneas</strong>
            <p>{linesError}</p>
          </div>
        ) : isEditing ? (
          <form className="lead-form" onSubmit={handleSubmit}>
            <label className="form-field">
              <span>Cliente *</span>
              <select
                value={form.client_id ?? ''}
                onChange={(event) => updateField('client_id', event.target.value || null)}
              >
                {hydratedQuote.lead_id ? (
                  <option value="">Lead sin cliente hasta aceptacion</option>
                ) : null}
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.full_name} · {client.display_code ?? client.id}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Propiedad</span>
              <select
                value={form.property_id}
                onChange={(event) => updateField('property_id', event.target.value)}
              >
                <option value="">Sin propiedad</option>
                {availableProperties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name} · {property.display_code ?? property.id}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Estado</span>
              <select
                value={form.status}
                onChange={(event) => updateField('status', event.target.value)}
              >
                {quoteStatusOptions.map((status) => (
                  <option key={status} value={status}>{getStatusOptionLabel(status)}</option>
                ))}
              </select>
            </label>

            <div className="form-field form-field-full">
              <span>Líneas de presupuesto *</span>
              {lines.map((line, index) => (
                <div key={line.local_id} className="lead-form" style={{ marginTop: '0.75rem' }}>
                  <label className="form-field form-field-full">
                    <span>Concepto {index + 1}</span>
                    <input
                      value={line.concept}
                      onChange={(event) => updateLine(line.local_id, 'concept', event.target.value)}
                      required
                    />
                  </label>

                  <label className="form-field">
                    <span>Cantidad</span>
                    <input
                      value={line.quantity}
                      onChange={(event) => updateLine(line.local_id, 'quantity', event.target.value)}
                      required
                    />
                  </label>

                  <label className="form-field">
                    <span>Unidad</span>
                    <input
                      value={line.unit}
                      onChange={(event) => updateLine(line.local_id, 'unit', event.target.value)}
                      required
                    />
                  </label>

                  <label className="form-field">
                    <span>Precio unitario</span>
                    <input
                      value={line.unit_price}
                      onChange={(event) => updateLine(line.local_id, 'unit_price', event.target.value)}
                      required
                    />
                  </label>

                  <label className="form-field">
                    <span>Importe</span>
                    <input value={formatQuoteLineSubtotalInput(line)} readOnly />
                  </label>

                  <div className="form-actions form-field-full">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => removeLine(line.local_id)}
                      disabled={lines.length === 1}
                    >
                      Quitar línea
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                className="secondary-button"
                onClick={() => setLines((current) => [...current, createBlankQuoteLine()])}
                style={{ marginTop: '0.75rem' }}
              >
                Añadir línea
              </button>
            </div>

            <label className="form-field">
              <span>Subtotal</span>
              <input value={formatMoneyInput(subtotalValue)} readOnly />
            </label>

            <label className="form-field">
              <span>IVA (automático)</span>
              <input value={formatMoneyInput(taxAmountValue)} readOnly />
            </label>

            <label className="form-field">
              <span>Total (automático)</span>
              <input value={formatMoneyInput(totalValue)} readOnly />
            </label>

            <label className="form-field form-field-full">
              <span>Notas</span>
              <textarea
                value={form.notes}
                onChange={(event) => updateField('notes', event.target.value)}
                rows={4}
              />
            </label>

            <div className="form-actions">
              <button type="submit" className="primary-button" disabled={isSaving}>
                {isSaving ? 'Guardando cambios...' : 'Guardar cambios'}
              </button>
            </div>

            {saveError ? (
              <div className="cc-alert cc-alert--error">
                <strong>No se pudo actualizar el presupuesto</strong>
                <p>{saveError}</p>
              </div>
            ) : null}

            {successMessage ? (
              <div className="cc-alert cc-alert--success">
                <strong>Operación correcta</strong>
                <p>{successMessage}</p>
              </div>
            ) : null}
          </form>
        ) : (
          <>
            <div className="form-actions" style={{ marginBottom: '1rem' }}>
              {hydratedQuote.status !== 'accepted' ? (
                <>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => setPendingAcceptanceAction('accept')}
                    disabled={isSaving || isLoadingLines || Boolean(linesError)}
                  >
                    Aceptar presupuesto
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => setPendingAcceptanceAction('invoice')}
                    disabled={isSaving || isLoadingLines || Boolean(linesError)}
                  >
                    Aceptar y convertir a factura
                  </button>
                </>
              ) : null}

              {quoteStatusOptions.map((status) => (
                <button
                  key={status}
                  type="button"
                  className={status === hydratedQuote.status ? 'primary-button' : 'secondary-button'}
                  onClick={() => requestQuoteStatusUpdate(status)}
                  disabled={
                    isSaving ||
                    status === hydratedQuote.status ||
                    status === 'accepted' ||
                    isLoadingLines ||
                    Boolean(linesError)
                  }
                >
                  {getStatusOptionLabel(status)}
                </button>
              ))}
            </div>

          <div className="lead-detail-grid">
            <div className="detail-row">
              <span className="detail-label">Referencia</span>
              <strong>{hydratedQuote.display_code ?? hydratedQuote.id}</strong>
            </div>

            <div className="detail-row">
              <span className="detail-label">Cliente</span>
              <strong>{clientLabel}</strong>
            </div>

            <div className="detail-row">
              <span className="detail-label">Ref. CRM cliente</span>
              <strong>{hydratedQuote.client_display_code ?? 'Sin referencia CRM'}</strong>
            </div>

            <div className="detail-row">
              <span className="detail-label">Lead origen</span>
              <strong>{hydratedQuote.lead_display_code ?? hydratedQuote.lead_id ?? 'Sin lead vinculado'}</strong>
            </div>

            <div className="detail-row">
              <span className="detail-label">Propiedad</span>
              <strong>{propertyLabel}</strong>
            </div>

            <div className="detail-row">
              <span className="detail-label">Ref. CRM propiedad</span>
              <strong>{hydratedQuote.property_display_code ?? 'Sin referencia CRM'}</strong>
            </div>

            <div className="detail-row">
              <span className="detail-label">Estado</span>
              <strong>{getStatusLabel(hydratedQuote.status)}</strong>
            </div>

            <div className="detail-row">
              <span className="detail-label">Líneas</span>
              <strong>
                {displayLines.map((line) => `${line.concept} · ${line.quantity} ${line.unit} · ${formatQuoteLineSubtotalDisplay(line)}`).join(' | ')}
              </strong>
            </div>

            <div className="detail-row">
              <span className="detail-label">Subtotal</span>
              <strong>{formatCurrency(hydratedQuote.subtotal)}</strong>
            </div>

            <div className="detail-row">
              <span className="detail-label">IVA</span>
              <strong>{formatCurrency(hydratedQuote.tax_amount ?? 0)}</strong>
            </div>

            <div className="detail-row">
              <span className="detail-label">Total</span>
              <strong>{formatCurrency(hydratedQuote.total)}</strong>
            </div>

            <div className="detail-row">
              <span className="detail-label">Notas</span>
              <strong>{hydratedQuote.notes ?? 'Sin notas'}</strong>
            </div>
          </div>
          </>
        )}

        {!isEditing && saveError ? (
          <div className="cc-alert cc-alert--error">
            <strong>No se pudo actualizar el presupuesto</strong>
            <p>{saveError}</p>
          </div>
        ) : null}

        {!isEditing && successMessage ? (
          <div className="cc-alert cc-alert--success">
            <strong>Operación correcta</strong>
            <p>{successMessage}</p>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        isOpen={Boolean(pendingAcceptanceAction)}
        title={pendingAcceptanceAction === 'invoice' ? 'Aceptar y convertir a factura' : 'Aceptar presupuesto'}
        description={
          pendingAcceptanceAction === 'invoice'
            ? 'Esta accion acepta el presupuesto, convierte el lead en cliente si hace falta, vincula el presupuesto al cliente y crea una factura emitida desde sus lineas. No envia comunicaciones.'
            : 'Esta accion acepta el presupuesto, convierte el lead en cliente si hace falta y vincula el presupuesto al cliente. No crea factura ni envia comunicaciones.'
        }
        confirmLabel={pendingAcceptanceAction === 'invoice' ? 'Aceptar y crear factura' : 'Aceptar presupuesto'}
        tone="warning"
        isBusy={isSaving}
        onCancel={() => setPendingAcceptanceAction(null)}
        onConfirm={() => void handleConfirmAcceptedStatusUpdate(pendingAcceptanceAction === 'invoice')}
      />

      <ConfirmDialog
        isOpen={Boolean(pendingRejectedStatusUpdate)}
        title="Rechazar presupuesto"
        description="Esta acción marca el presupuesto como rechazado y cambia su seguimiento comercial. Confirma solo si ya no debe tratarse como oportunidad activa."
        confirmLabel="Sí, rechazar"
        tone="warning"
        isBusy={isSaving}
        onCancel={() => setPendingRejectedStatusUpdate(null)}
        onConfirm={handleConfirmRejectedStatusUpdate}
      />

      <ConfirmDialog
        isOpen={pendingRejectedFormSave}
        title="Guardar presupuesto como rechazado"
        description="Vas a guardar la edición dejando el presupuesto en estado rechazado. Confirma solo si ya no debe tratarse como oportunidad activa."
        confirmLabel="Guardar como rechazado"
        tone="warning"
        isBusy={isSaving}
        onCancel={() => setPendingRejectedFormSave(false)}
        onConfirm={() => {
          setPendingRejectedFormSave(false)
          void saveQuoteEdits(true)
        }}
      />
    </section>
  )
}
