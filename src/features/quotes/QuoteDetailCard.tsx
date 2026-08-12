import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { QuoteListItem } from './types'
import type { ClientListItem } from '../clients/types'
import type { PropertyListItem } from '../properties/types'
import { getStatusLabel } from '../../app/displayText'
import { getStatusOptionLabel, quoteStatusOptions } from '../../app/statusOptions'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { FeedbackDialog } from '../../components/FeedbackDialog'
import { ActionGroup, type ActionGroupItem } from '../../components/ActionGroup'
import { buildJobCreatePrefillFromQuote } from '../jobs/jobCreatePrefill'
import { saveQuoteWithLines, updateQuoteStatus as updateQuoteStatusRpc } from '../financial/financialWriteApi'
import { acceptQuoteAndCreateInvoice, acceptQuoteOnly } from './quoteAcceptanceWorkflow'
import { useQuoteDocumentLines } from './useQuoteDocumentLines'
import {
  buildQuoteLinePayloads,
  calculateQuoteSubtotal,
  calculateQuoteTax,
  calculateQuoteTotal,
  createBlankQuoteLine,
  formatQuoteLineSubtotalDisplay,
  formatQuoteLineSubtotalInput,
  getFormLinesFromQuote,
} from './quoteLineUtils'
import type { QuoteLineFormState } from './quoteLineUtils'
import {
  formatQuoteCustomerFacingTotal,
  getQuoteCommercialSummary,
  getQuoteCustomerFacingTotalLabel,
} from './quoteCommercialPresentation'
import { patchLifecycleEntity } from '../../shared/lifecycle/lifecycleApi'
import './quotesOperations.css'
import { isArchivedEntity } from '../../shared/lifecycle/entityLifecycle'

interface QuoteDetailCardProps {
  quote: QuoteListItem | null
  clients: ClientListItem[]
  properties: PropertyListItem[]
  onQuoteUpdated: () => Promise<void>
  onOpenDocument: () => void
  onCreateJobFromQuote: (quote: QuoteListItem) => void
  onCreateSimilarQuote?: (quote: QuoteListItem) => void
  onUnsavedChange?: (hasUnsavedChanges: boolean) => void
  hideHeaderActions?: boolean
  majorEditMode?: boolean
  onRequestMajorEdit?: () => void
  onMajorEditClose?: () => void
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
  onCreateSimilarQuote,
  onUnsavedChange,
  hideHeaderActions = false,
  majorEditMode = false,
  onRequestMajorEdit,
  onMajorEditClose,
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
      onCreateSimilarQuote={onCreateSimilarQuote}
      onUnsavedChange={onUnsavedChange}
      hideHeaderActions={hideHeaderActions}
      majorEditMode={majorEditMode}
      onRequestMajorEdit={onRequestMajorEdit}
      onMajorEditClose={onMajorEditClose}
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
  onCreateSimilarQuote,
  onUnsavedChange,
  hideHeaderActions,
  majorEditMode,
  onRequestMajorEdit,
  onMajorEditClose,
}: {
  quote: QuoteListItem
  clients: ClientListItem[]
  properties: PropertyListItem[]
  onQuoteUpdated: () => Promise<void>
  onOpenDocument: () => void
  onCreateJobFromQuote: (quote: QuoteListItem) => void
  onCreateSimilarQuote?: (quote: QuoteListItem) => void
  onUnsavedChange?: (hasUnsavedChanges: boolean) => void
  hideHeaderActions: boolean
  majorEditMode: boolean
  onRequestMajorEdit?: () => void
  onMajorEditClose?: () => void
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
  const [isDirty, setIsDirty] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)
  const [showTrashConfirm, setShowTrashConfirm] = useState(false)
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
    setIsDirty(false)
    setForm({
      client_id: hydratedQuote.client_id ?? null,
      property_id: hydratedQuote.property_id ?? '',
      status: hydratedQuote.status,
      notes: hydratedQuote.notes ?? '',
    })
    setLines(getFormLinesFromQuote(hydratedQuote, properties))
  }, [hydratedQuote, properties])

  useEffect(() => {
    onUnsavedChange?.(isDirty)
    return () => onUnsavedChange?.(false)
  }, [isDirty, onUnsavedChange])

  useEffect(() => {
    if (!majorEditMode) return
    setIsEditing(true)
  }, [hydratedQuote.id, majorEditMode])

  const availableProperties = useMemo(() => {
    if (!form.client_id) {
      return []
    }

    return properties.filter((property) => property.client_id === form.client_id)
  }, [properties, form.client_id])

  const subtotalValue = useMemo(() => calculateQuoteSubtotal(lines), [lines])
  const taxAmountValue = useMemo(() => calculateQuoteTax(lines), [lines])
  const totalValue = useMemo(() => calculateQuoteTotal(lines), [lines])
  const commercialSummary = useMemo(
    () => getQuoteCommercialSummary({
      subtotal: subtotalValue,
      taxAmount: taxAmountValue,
      total: totalValue,
    }),
    [subtotalValue, taxAmountValue, totalValue],
  )

  const displayLines = useMemo(
    () => getFormLinesFromQuote(hydratedQuote, properties),
    [hydratedQuote, properties],
  )

  function updateField<K extends keyof EditFormState>(
    field: K,
    value: EditFormState[K],
  ) {
    setIsDirty(true)
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
    setIsDirty(true)
    setLines((current) => current.map((line) => (
      line.local_id === localId ? { ...line, [field]: value } : line
    )))
  }

  function removeLine(localId: string) {
    setIsDirty(true)
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
    setIsDirty(false)
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
          : `Presupuesto aceptado. Cliente ${result.clientId} confirmado. Siguiente paso recomendado: crear servicio.`,
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

  async function handleArchiveQuote() {
    setSaveError(null)
    setSuccessMessage(null)
    setIsSaving(true)
    try {
      await patchLifecycleEntity('quotes', hydratedQuote.id, { archived_at: new Date().toISOString() })
      await onQuoteUpdated()
      setSuccessMessage('Presupuesto archivado correctamente.')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'No se pudo archivar el presupuesto.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRestoreQuote() {
    setSaveError(null)
    setSuccessMessage(null)
    setIsSaving(true)
    try {
      await patchLifecycleEntity('quotes', hydratedQuote.id, { archived_at: null, deleted_at: null })
      await onQuoteUpdated()
      setSuccessMessage('Presupuesto restaurado correctamente.')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'No se pudo restaurar el presupuesto.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleTrashQuote() {
    setSaveError(null)
    setSuccessMessage(null)
    setIsSaving(true)
    try {
      await patchLifecycleEntity('quotes', hydratedQuote.id, { deleted_at: new Date().toISOString() })
      await onQuoteUpdated()
      setSuccessMessage('Borrador movido a papelera.')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'No se pudo mover el borrador a papelera.')
    } finally {
      setIsSaving(false)
    }
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
          internal_notes: hydratedQuote.internal_notes ?? null,
          pricing_metadata: hydratedQuote.pricing_metadata ?? null,
        },
        linePayloads,
      )

      await onQuoteUpdated()
      setSuccessMessage('Presupuesto actualizado correctamente.')
      if (majorEditMode) {
        onMajorEditClose?.()
      } else {
        setIsEditing(false)
      }
      setIsDirty(false)
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
  const quoteNextStep = hydratedQuote.status !== 'accepted'
    ? 'Confirmar aceptacion y preparar la conversion a servicio o factura.'
    : hydratedQuote.job_id
      ? 'El presupuesto ya genero servicio. Revisa la operativa asociada o abre el documento para compartirlo.'
      : 'El presupuesto ya esta aceptado. El siguiente paso natural es crear el servicio.'
  const quoteNextStepActions: ActionGroupItem[] = []
  const headerActions: ActionGroupItem[] = []

  if (hydratedQuote.status === 'accepted' && !hydratedQuote.job_id) {
    quoteNextStepActions.push({
      key: 'next-step-create-job',
      label: 'Crear servicio',
      tone: 'primary',
      onClick: handleCreateJobFromQuote,
    })
    headerActions.push({
      key: 'open-document-primary',
      label: 'Abrir documento',
      tone: 'primary',
      onClick: onOpenDocument,
    })
  } else if (hydratedQuote.status !== 'accepted') {
    quoteNextStepActions.push({
      key: 'next-step-accept',
      label: 'Aceptar presupuesto',
      tone: 'primary',
      onClick: () => setPendingAcceptanceAction('accept'),
    })
    quoteNextStepActions.push({
      key: 'next-step-invoice',
      label: 'Aceptar y facturar',
      onClick: () => setPendingAcceptanceAction('invoice'),
      disabled: isSaving || isLoadingLines || Boolean(linesError),
    })
    headerActions.push({
      key: 'open-document-primary',
      label: 'Abrir documento',
      tone: 'primary',
      onClick: onOpenDocument,
    })
  } else {
    headerActions.push({
      key: 'open-document-primary',
      label: 'Abrir documento',
      tone: 'primary',
      onClick: onOpenDocument,
    })
  }

  if (!hideHeaderActions) {
    headerActions.push(
      isArchivedEntity(hydratedQuote)
        ? {
            key: 'restore-quote',
            label: 'Restaurar presupuesto',
            onClick: () => setShowRestoreConfirm(true),
          }
        : {
            key: 'archive-quote',
            label: 'Archivar presupuesto',
            onClick: () => setShowArchiveConfirm(true),
          },
    )

    if (hydratedQuote.status === 'draft') {
      headerActions.push({
        key: 'trash-quote',
        label: 'Mover borrador a papelera',
        onClick: () => setShowTrashConfirm(true),
      })
    }

    if (onCreateSimilarQuote) {
      headerActions.push({
        key: 'duplicate-quote',
        label: 'Crear presupuesto como este',
        onClick: () => onCreateSimilarQuote(hydratedQuote),
      })
    }

    headerActions.push({
      key: 'edit-quote',
      label: isEditing ? 'Cancelar edicion' : 'Editar presupuesto',
      onClick: () => {
        if (onRequestMajorEdit && !majorEditMode) {
          onRequestMajorEdit()
          return
        }

        if (isEditing && isDirty) {
          setShowDiscardConfirm(true)
          return
        }

        setIsEditing((current) => !current)
        setSaveError(null)
        setSuccessMessage(null)
        setIsDirty(false)
        resetFormFromQuote()
      },
      disabled: isLoadingLines || Boolean(linesError),
    })
  }

  const dedupedHeaderActions = headerActions.filter(
    (action, index, actions) => actions.findIndex((candidate) => candidate.label === action.label) === index,
  )

  const statusActions: ActionGroupItem[] = []

  quoteStatusOptions
    .filter((status) => status !== hydratedQuote.status && status !== 'accepted')
    .forEach((status) => {
      statusActions.push({
        key: `status-${status}`,
        label: getStatusOptionLabel(status),
        onClick: () => requestQuoteStatusUpdate(status),
        disabled: isSaving || isLoadingLines || Boolean(linesError),
      })
    })

  return (
    <section className="data-section cc-detail-panel cc-detail-panel--quote">
      <div className="section-header page-header-actions">
        <div>
          <h2>Detalle del presupuesto</h2>
        </div>

        {!hideHeaderActions ? (
        <div className="cc-detail-panel__actions">
          <ActionGroup actions={dedupedHeaderActions} moreLabel="Mas acciones" />
        </div>
        ) : null}
      </div>

      <div className="lead-detail-card">
        <div className="lead-detail-header">
          <div className="cc-detail-panel__identity">
            <span className="cc-detail-panel__eyebrow">Workspace de gestion</span>
            <h3>{hydratedQuote.display_code ?? hydratedQuote.id}</h3>
            <p>{clientLabel}</p>
          </div>

          <span className={`lead-badge cc-status-badge cc-status-badge--${hydratedQuote.status}`}>{getStatusLabel(hydratedQuote.status)}</span>
        </div>

        {!isLoadingLines && !linesError && !isEditing ? (
          <div className="cc-detail-panel__summary">
            <div className="cc-detail-panel__summary-card">
              <span>Cliente</span>
              <strong>{clientLabel}</strong>
              <small>{hydratedQuote.status === 'accepted' ? 'Listo para operativa' : 'Pendiente de decision comercial'}</small>
            </div>
            <div className="cc-detail-panel__summary-card">
              <span>Propiedad</span>
              <strong>{propertyLabel}</strong>
              <small>{displayLines.length} linea(s)</small>
            </div>
            <div className="cc-detail-panel__summary-card">
              <span>{getQuoteCustomerFacingTotalLabel(Number(hydratedQuote.tax_amount || 0))}</span>
              <strong>{formatQuoteCustomerFacingTotal({
                subtotal: Number(hydratedQuote.subtotal || 0),
                taxAmount: Number(hydratedQuote.tax_amount || 0),
                total: Number(hydratedQuote.total || 0),
              })}</strong>
              <small>{hydratedQuote.job_id ? 'Servicio ya generado' : 'Todavia sin servicio asociado'}</small>
            </div>
          </div>
        ) : null}

        {!isLoadingLines && !linesError && !isEditing ? (
          <div className="cc-detail-panel__next-step">
            <span>Siguiente paso recomendado</span>
            <strong>{quoteNextStep}</strong>
            {quoteNextStepActions.length > 0 ? (
              <div className="form-actions">
                <ActionGroup actions={quoteNextStepActions} moreLabel="Mas acciones" />
              </div>
            ) : null}
          </div>
        ) : null}

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
          <form className="lead-form cc-detail-panel__editor" onSubmit={handleSubmit}>
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
              <p className="cc-line-editor-note">Los conceptos editados manualmente se guardan y se reabren sin simplificarse.</p>
              <div className="cc-detail-panel__line-items">
              {lines.map((line, index) => (
                <div key={line.local_id} className="lead-form cc-detail-panel__line-item" style={{ marginTop: '0.75rem' }}>
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
              </div>

              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setIsDirty(true)
                  setLines((current) => [...current, createBlankQuoteLine()])
                }}
                style={{ marginTop: '0.75rem' }}
              >
                Añadir línea
              </button>
            </div>

            <label className="form-field">
              <span>{commercialSummary.subtotalLabel}</span>
              <input value={commercialSummary.subtotalValue} readOnly />
            </label>

            <label className="form-field">
              <span>{commercialSummary.taxLabel}</span>
              <input value={commercialSummary.taxValue} readOnly />
            </label>

            <label className="form-field">
              <span>{commercialSummary.totalLabel}</span>
              <input value={commercialSummary.totalValue} readOnly />
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
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  if (isDirty) {
                    setShowDiscardConfirm(true)
                    return
                  }

                  if (majorEditMode) {
                    onMajorEditClose?.()
                    return
                  }

                  setIsEditing(false)
                  setIsDirty(false)
                }}
              >
                Cancelar
              </button>
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
            {statusActions.length > 0 && hydratedQuote.status === 'accepted' ? (
              <div className="form-actions cc-detail-panel__status-actions" style={{ marginBottom: '1rem' }}>
                <ActionGroup actions={statusActions} moreLabel="Gestionar estado" />
              </div>
            ) : null}

<div className="lead-detail-grid cc-detail-panel__grid">
            <div className="detail-row">
              <span className="detail-label">Referencia</span>
              <strong>{hydratedQuote.display_code ?? hydratedQuote.id}</strong>
            </div>

            <div className="detail-row">
              <span className="detail-label">Lead origen</span>
              <strong>{hydratedQuote.lead_display_code ?? hydratedQuote.lead_id ?? 'Sin lead vinculado'}</strong>
            </div>

            <div className="detail-row">
              <span className="detail-label">Servicio generado</span>
              <strong>{hydratedQuote.job_id ?? 'Todavia no generado'}</strong>
            </div>

            <div className="detail-row">
              <span className="detail-label">Líneas</span>
              <strong>
                {displayLines.slice(0, 2).map((line) => `${line.concept} · ${formatQuoteLineSubtotalDisplay(line)}`).join(' | ')}
                {displayLines.length > 2 ? ` | +${displayLines.length - 2} linea(s)` : ''}
              </strong>
            </div>

            <div className="detail-row">
              <span className="detail-label">Notas</span>
              <strong>{hydratedQuote.notes ?? 'Sin notas'}</strong>
            </div>
          </div>
          </>
        )}

      </div>

      <FeedbackDialog
        isOpen={!isEditing && Boolean(saveError)}
        tone="error"
        title="No se pudo actualizar el presupuesto"
        message={saveError ?? ''}
        onClose={() => setSaveError(null)}
      />

      <FeedbackDialog
        isOpen={!isEditing && Boolean(successMessage)}
        tone="success"
        title="Operacion correcta"
        message={successMessage ?? ''}
        onClose={() => setSuccessMessage(null)}
      />

      <ConfirmDialog
        isOpen={showDiscardConfirm}
        title="Descartar cambios de presupuesto"
        description="Has modificado este presupuesto. Si cierras ahora, perderas los cambios no guardados."
        confirmLabel="Descartar cambios"
        tone="warning"
        isBusy={isSaving}
        onCancel={() => setShowDiscardConfirm(false)}
        onConfirm={() => {
          setShowDiscardConfirm(false)
          setIsDirty(false)
          resetFormFromQuote()
          if (majorEditMode) {
            onMajorEditClose?.()
            return
          }

          setIsEditing(false)
        }}
      />

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

      <ConfirmDialog
        isOpen={showArchiveConfirm}
        title="Archivar presupuesto"
        description="El presupuesto dejara de aparecer en el seguimiento comercial activo."
        confirmLabel="Archivar presupuesto"
        tone="warning"
        isBusy={isSaving}
        onCancel={() => setShowArchiveConfirm(false)}
        onConfirm={() => {
          setShowArchiveConfirm(false)
          void handleArchiveQuote()
        }}
      />

      <ConfirmDialog
        isOpen={showRestoreConfirm}
        title="Restaurar presupuesto"
        description="El presupuesto volvera a las vistas comerciales activas."
        confirmLabel="Restaurar presupuesto"
        tone="warning"
        isBusy={isSaving}
        onCancel={() => setShowRestoreConfirm(false)}
        onConfirm={() => {
          setShowRestoreConfirm(false)
          void handleRestoreQuote()
        }}
      />

      <ConfirmDialog
        isOpen={showTrashConfirm}
        title="Eliminar borrador"
        description="Esta accion movera el borrador a papelera."
        confirmLabel="Mover a papelera"
        tone="warning"
        isBusy={isSaving}
        onCancel={() => setShowTrashConfirm(false)}
        onConfirm={() => {
          setShowTrashConfirm(false)
          void handleTrashQuote()
        }}
      />
    </section>
  )
}
