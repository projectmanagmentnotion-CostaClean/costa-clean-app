import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { formatDateEs, getDisplayStatusLabel, getServiceTypeLabel } from '../../app/displayFormat'
import { getStatusLabel } from '../../app/displayText'
import { formatClientLabel, formatPropertyLabel, formatQuoteLabel } from '../../app/relationshipLabels'
import { getStatusOptionLabel, jobStatusOptions } from '../../app/statusOptions'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import {
  buildBillingLinePayloads,
  calculateBillingLineSubtotal,
  calculateBillingSubtotal,
  createBlankBillingLine,
  formatBillingLineSubtotalInput,
  type BillingLineFormState,
} from '../shared/billingLineDrafts'
import { getJobBillingDisplayConcept, getJobBillingDraftLines, getJobBillingLines, getJobBillingDisplaySummary } from './jobBilling'
import { buildJobBillingSummary, saveJobWithLines } from './jobWriteApi'
import type { JobListItem } from './types'
import type { ClientListItem } from '../clients/types'
import type { PropertyListItem } from '../properties/types'
import type { QuoteListItem } from '../quotes/types'

interface JobDetailCardProps {
  job: JobListItem | null
  clients: ClientListItem[]
  properties: PropertyListItem[]
  quotes: QuoteListItem[]
  onJobUpdated: () => Promise<void>
  onCreateInvoiceFromJob: (job: JobListItem) => void
  onCreateSimilarJob?: (job: JobListItem) => void
  onUnsavedChange?: (hasUnsavedChanges: boolean) => void
  hideHeaderActions?: boolean
  majorEditMode?: boolean
  onRequestMajorEdit?: () => void
  onMajorEditClose?: () => void
}

interface EditFormState {
  client_id: string
  property_id: string
  quote_id: string
  scheduled_date: string
  status: string
  service_type: string
  billing_concept: string
  billing_quantity: string
  billing_unit: string
  billing_unit_price: string
  notes: string
}

function getServiceTypeOptionLabel(value: string): string {
  switch (value) {
    case 'standard_cleaning': return 'Limpieza estándar'
    case 'deep_cleaning': return 'Limpieza profunda'
    case 'post_construction': return 'Limpieza fin de obra'
    case 'check_out_cleaning': return 'Limpieza check-out'
    case 'airbnb_turnover': return 'Cambio Airbnb'
    case 'glass_cleaning': return 'Limpieza de cristales'
    default: return value
  }
}

function normalizeBillingUnit(value: string | null | undefined): string {
  return value === 'service' ? 'servicio' : value ?? 'servicio'
}

function getJobPrimaryReference(job: JobListItem): string {
  return getJobBillingDisplayConcept(job)
}

function getJobSecondaryReference(job: JobListItem): string {
  return [
    formatClientLabel(job),
    formatPropertyLabel({ id: job.property_id, display_code: job.property_display_code, name: job.property_name }),
    formatDateEs(job.scheduled_date),
  ].join(' · ')
}

export function JobDetailCard({
  job,
  clients,
  properties,
  quotes,
  onJobUpdated,
  onCreateInvoiceFromJob,
  onCreateSimilarJob,
  onUnsavedChange,
  hideHeaderActions = false,
  majorEditMode = false,
  onRequestMajorEdit,
  onMajorEditClose,
}: JobDetailCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [pendingCancelledStatusUpdate, setPendingCancelledStatusUpdate] = useState<string | null>(null)
  const [pendingCancelledFormSave, setPendingCancelledFormSave] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [billingLines, setBillingLines] = useState<BillingLineFormState[]>([createBlankBillingLine()])
  const [form, setForm] = useState<EditFormState>({
    client_id: '',
    property_id: '',
    quote_id: '',
    scheduled_date: '',
    status: 'scheduled',
    service_type: 'standard_cleaning',
    billing_concept: '',
    billing_quantity: '1',
    billing_unit: 'servicio',
    billing_unit_price: '',
    notes: '',
  })

  useEffect(() => {
    if (!job) {
      setIsEditing(false)
      setSaveError(null)
      setSuccessMessage(null)
      setIsDirty(false)
      setBillingLines([createBlankBillingLine()])
      setForm({
        client_id: '',
        property_id: '',
        quote_id: '',
        scheduled_date: '',
        status: 'scheduled',
        service_type: 'standard_cleaning',
        billing_concept: '',
        billing_quantity: '1',
        billing_unit: 'servicio',
        billing_unit_price: '',
        notes: '',
      })
      return
    }

    const initialBillingLines = getJobBillingDraftLines(job)
    const hasPersistedBillingLines = Boolean(job.billing_lines?.length)

    if (import.meta.env.DEV) {
      console.info('[JobDetailCard] open edit job', {
        jobId: job.id,
        displayCode: job.display_code ?? null,
        billingLinesOnJob: job.billing_lines?.length ?? 0,
      })
      console.info('[JobDetailCard] initial billing lines', {
        jobId: job.id,
        incomingBillingLines: job.billing_lines?.length ?? 0,
        initialLines: initialBillingLines.length,
        source: hasPersistedBillingLines ? 'billing_lines' : 'legacy',
      })
    }

    setIsEditing(false)
    setSaveError(null)
    setSuccessMessage(null)
    setIsDirty(false)
    setBillingLines(initialBillingLines)
    setForm({
      client_id: job.client_id,
      property_id: job.property_id,
      quote_id: job.quote_id ?? '',
      scheduled_date: job.scheduled_date,
      status: job.status,
      service_type: job.service_type,
      billing_concept: job.billing_concept ?? getServiceTypeOptionLabel(job.service_type),
      billing_quantity: String(job.billing_quantity ?? 1),
      billing_unit: normalizeBillingUnit(job.billing_unit),
      billing_unit_price: job.billing_unit_price === null || job.billing_unit_price === undefined
        ? ''
        : String(job.billing_unit_price),
      notes: job.notes ?? '',
    })
  }, [job])

  useEffect(() => {
    onUnsavedChange?.(isDirty)
    return () => onUnsavedChange?.(false)
  }, [isDirty, onUnsavedChange])

  useEffect(() => {
    if (!job || !majorEditMode) return
    setIsEditing(true)
  }, [job, majorEditMode])

  const availableProperties = useMemo(() => {
    if (!form.client_id) return []
    return properties.filter((property) => property.client_id === form.client_id)
  }, [properties, form.client_id])

  const availableQuotes = useMemo(() => {
    if (!form.client_id) return []
    return quotes.filter((quote) => quote.client_id === form.client_id)
  }, [quotes, form.client_id])
  const billingSubtotal = useMemo(() => calculateBillingSubtotal(billingLines), [billingLines])

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
        next.quote_id = ''
      }

      return next
    })
  }

  function updateBillingLine<K extends keyof BillingLineFormState>(localId: string, field: K, value: BillingLineFormState[K]) {
    setIsDirty(true)
    setBillingLines((current) => current.map((line) => (
      line.local_id === localId ? { ...line, [field]: value } : line
    )))
  }

  function removeBillingLine(localId: string) {
    setIsDirty(true)
    setBillingLines((current) => (current.length > 1 ? current.filter((line) => line.local_id !== localId) : current))
  }

  function addBillingLine() {
    setIsDirty(true)
    setBillingLines((current) => [...current, createBlankBillingLine()])
  }

  async function saveJobEdits(confirmedCancelledStatus = false) {
    if (!job) return

    if (form.status === 'cancelled' && job.status !== 'cancelled' && !confirmedCancelledStatus) {
      setPendingCancelledFormSave(true)
      return
    }

    setSaveError(null)
    setSuccessMessage(null)
    setIsSaving(true)

    try {
      if (!form.client_id) {
        setSaveError('Debes seleccionar un cliente.')
        return
      }

      if (!form.property_id) {
        setSaveError('Debes seleccionar una propiedad.')
        return
      }

      if (!form.scheduled_date) {
        setSaveError('Debes indicar la fecha programada.')
        return
      }

      const normalizedBillingLines = buildBillingLinePayloads(billingLines, (concept) => concept.trim())
      if (!normalizedBillingLines || normalizedBillingLines.length === 0) {
        setSaveError('Cada linea debe tener concepto, cantidad mayor que 0 y precio unitario valido.')
        return
      }
      if (import.meta.env.DEV) {
        console.info('[JobDetailCard] submit lines', {
          jobId: job.id,
          stateLines: billingLines.length,
          payloadLines: normalizedBillingLines.length,
          concepts: normalizedBillingLines.map((line) => line.concept),
          total: billingSubtotal,
        })
      }
      const billingSummary = buildJobBillingSummary(
        normalizedBillingLines,
        getServiceTypeOptionLabel(form.service_type),
      )

      await saveJobWithLines(
        {
          id: job.id,
          client_id: form.client_id,
          property_id: form.property_id,
          quote_id: form.quote_id || null,
          scheduled_date: form.scheduled_date,
          status: form.status,
          service_type: form.service_type,
          billing_concept: billingSummary.billing_concept,
          billing_quantity: billingSummary.billing_quantity,
          billing_unit: billingSummary.billing_unit,
          billing_unit_price: billingSummary.billing_unit_price,
          notes: form.notes.trim() || null,
        },
        normalizedBillingLines.map((line, index) => ({
          ...line,
          id: line.id || `JOB-LINE-${job.id}-${index + 1}`,
          job_id: job.id,
        })),
      )

      await onJobUpdated()
      setSuccessMessage('Servicio actualizado correctamente.')
      if (majorEditMode) {
        onMajorEditClose?.()
      } else {
        setIsEditing(false)
      }
      setIsDirty(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido actualizando el servicio.'
      setSaveError(message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await saveJobEdits()
  }

  async function updateJobStatus(nextStatus: string) {
    if (!job || job.status === nextStatus) return

    setSaveError(null)
    setSuccessMessage(null)
    setIsSaving(true)

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseAnonKey) {
        setSaveError('Faltan las variables de entorno de Supabase.')
        return
      }

      const response = await fetch(
        `${supabaseUrl}/rest/v1/jobs?id=eq.${encodeURIComponent(job.id)}`,
        {
          method: 'PATCH',
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: nextStatus }),
        },
      )

      if (!response.ok) {
        const errorText = await response.text()
        setSaveError(`REST ${response.status}: ${errorText || response.statusText}`)
        return
      }

      await onJobUpdated()
      setSuccessMessage(`Estado del servicio actualizado a ${getStatusLabel(nextStatus)}.`)
      setIsEditing(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido actualizando el estado del servicio.'
      setSaveError(message)
    } finally {
      setIsSaving(false)
    }
  }

  function requestJobStatusUpdate(nextStatus: string) {
    if (job?.status !== 'cancelled' && nextStatus === 'cancelled') {
      setPendingCancelledStatusUpdate(nextStatus)
      return
    }

    void updateJobStatus(nextStatus)
  }

  function handleConfirmCancelledStatusUpdate() {
    if (!pendingCancelledStatusUpdate) return

    const nextStatus = pendingCancelledStatusUpdate
    setPendingCancelledStatusUpdate(null)
    void updateJobStatus(nextStatus)
  }

  return (
    <section className="data-section">
      <div className="section-header page-header-actions">
        <div>
          <h2>Detalle del servicio</h2>
        </div>

        {job && !hideHeaderActions ? (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="secondary-button"
              onClick={() => onCreateInvoiceFromJob(job)}
            >
              Crear factura desde servicio
            </button>

            {onCreateSimilarJob ? (
              <button
                type="button"
                className="secondary-button"
                onClick={() => onCreateSimilarJob(job)}
              >
                Crear servicio como este
              </button>
            ) : null}

            <button
              type="button"
              className="secondary-button"
              onClick={() => {
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
                setBillingLines(getJobBillingDraftLines(job))
                setForm({
                  client_id: job.client_id,
                  property_id: job.property_id,
                  quote_id: job.quote_id ?? '',
                  scheduled_date: job.scheduled_date,
                  status: job.status,
                  service_type: job.service_type,
                  billing_concept: job.billing_concept ?? getServiceTypeOptionLabel(job.service_type),
                  billing_quantity: String(job.billing_quantity ?? 1),
                  billing_unit: normalizeBillingUnit(job.billing_unit),
                  billing_unit_price: job.billing_unit_price === null || job.billing_unit_price === undefined
                    ? ''
                    : String(job.billing_unit_price),
                  notes: job.notes ?? '',
                })
              }}
            >
              {isEditing ? 'Cancelar edición' : 'Editar servicio'}
            </button>
          </div>
        ) : null}
      </div>

      {job ? (
        <div className="lead-detail-card">
          <div className="lead-detail-header">
            <div>
              <h3>{getJobPrimaryReference(job)}</h3>
              <p>{getJobSecondaryReference(job)}</p>
            </div>

            <span className="lead-badge">{getDisplayStatusLabel(job.status)}</span>
          </div>

          {isEditing ? (
            <form className="lead-form" onSubmit={handleSubmit}>
              <label className="form-field">
                <span>Cliente *</span>
                <select
                  value={form.client_id}
                  onChange={(event) => updateField('client_id', event.target.value)}
                >
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {formatClientLabel(client)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span>Propiedad *</span>
                <select
                  value={form.property_id}
                  onChange={(event) => updateField('property_id', event.target.value)}
                >
                  <option value="">Selecciona una propiedad</option>
                  {availableProperties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {formatPropertyLabel(property)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span>Presupuesto</span>
                <select
                  value={form.quote_id}
                  onChange={(event) => updateField('quote_id', event.target.value)}
                >
                  <option value="">Sin presupuesto</option>
                  {availableQuotes.map((quote) => (
                    <option key={quote.id} value={quote.id}>
                      {formatQuoteLabel(quote)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span>Fecha programada *</span>
                <input
                  type="date"
                  value={form.scheduled_date}
                  onChange={(event) => updateField('scheduled_date', event.target.value)}
                  required
                />
              </label>

              <label className="form-field">
                <span>Estado</span>
                <select
                  value={form.status}
                  onChange={(event) => updateField('status', event.target.value)}
                >
                  {jobStatusOptions.map((status) => (
                    <option key={status} value={status}>{getStatusOptionLabel(status)}</option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span>Tipo de servicio</span>
                <select
                  value={form.service_type}
                  onChange={(event) => updateField('service_type', event.target.value)}
                >
                  <option value="standard_cleaning">{getServiceTypeOptionLabel('standard_cleaning')}</option>
                  <option value="deep_cleaning">{getServiceTypeOptionLabel('deep_cleaning')}</option>
                  <option value="post_construction">{getServiceTypeOptionLabel('post_construction')}</option>
                  <option value="check_out_cleaning">{getServiceTypeOptionLabel('check_out_cleaning')}</option>
                  <option value="airbnb_turnover">{getServiceTypeOptionLabel('airbnb_turnover')}</option>
                  <option value="glass_cleaning">{getServiceTypeOptionLabel('glass_cleaning')}</option>
                </select>
              </label>

              <label className="form-field form-field-full">
                <span>Notas</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => updateField('notes', event.target.value)}
                  rows={4}
                />
              </label>

              <div className="cc-create-flow__line-list form-field-full">
                {billingLines.map((line, index) => (
                  <article key={line.local_id} className="cc-create-flow__line-card">
                    <label className="form-field form-field-full">
                      <span>Concepto {index + 1}</span>
                      <input
                        value={line.concept}
                        onChange={(event) => updateBillingLine(line.local_id, 'concept', event.target.value)}
                        required
                      />
                    </label>

                    <label className="form-field">
                      <span>Cantidad</span>
                      <input
                        value={line.quantity}
                        onChange={(event) => updateBillingLine(line.local_id, 'quantity', event.target.value)}
                        required
                      />
                    </label>

                    <label className="form-field">
                      <span>Unidad</span>
                      <input
                        value={line.unit}
                        onChange={(event) => updateBillingLine(line.local_id, 'unit', event.target.value)}
                        required
                      />
                    </label>

                    <label className="form-field">
                      <span>Precio unitario</span>
                      <input
                        value={line.unit_price}
                        onChange={(event) => updateBillingLine(line.local_id, 'unit_price', event.target.value)}
                        required
                      />
                    </label>

                    <label className="form-field">
                      <span>Importe</span>
                      <input value={formatBillingLineSubtotalInput(line)} readOnly />
                    </label>

                    <div className="cc-create-flow__line-actions">
                      <small className="cc-create-flow__helper">
                        {Number.isNaN(calculateBillingLineSubtotal(line)) ? 'Revisa cantidad o precio.' : 'Linea lista para guardar.'}
                      </small>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => removeBillingLine(line.local_id)}
                        disabled={billingLines.length === 1}
                      >
                        Quitar linea
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              <div className="cc-create-flow__microactions form-field-full">
                <strong>Microacciones</strong>
                <div className="cc-create-flow__microactions-row">
                  <button type="button" className="secondary-button" onClick={addBillingLine}>
                    Añadir linea
                  </button>
                  <small className="cc-create-flow__helper">Total actual {billingSubtotal.toFixed(2)} €</small>
                </div>
              </div>

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
                  <strong>No se pudo actualizar el servicio</strong>
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
                {jobStatusOptions.map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={status === job.status ? 'primary-button' : 'secondary-button'}
                    onClick={() => requestJobStatusUpdate(status)}
                    disabled={isSaving || status === job.status}
                  >
                    {getStatusOptionLabel(status)}
                  </button>
                ))}
              </div>

            <div className="lead-detail-grid">
              <div className="detail-row">
                <span className="detail-label">Referencia</span>
                <strong>{getJobPrimaryReference(job)}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Cliente</span>
                <strong>{formatClientLabel(job)}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Propiedad</span>
                <strong>{formatPropertyLabel({ id: job.property_id, display_code: job.property_display_code, name: job.property_name })}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Presupuesto</span>
                <strong>{job.quote_display_code ?? formatQuoteLabel({ id: job.quote_id })}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Fecha programada</span>
                <strong>{formatDateEs(job.scheduled_date)}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Código interno</span>
                <strong>{job.display_code ?? job.id}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Estado</span>
                <strong>{getDisplayStatusLabel(job.status)}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Tipo de servicio</span>
                <strong>{getServiceTypeLabel(job.service_type)}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Concepto de facturación</span>
                <strong>{getJobBillingDisplayConcept(job)}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Cantidad de facturación</span>
                <strong>{getJobBillingDisplaySummary(job)}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Unidad de facturación</span>
                <strong>{normalizeBillingUnit(job.billing_unit)}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Precio unitario</span>
                <strong>{job.billing_unit_price ?? 'Sin precio definido'}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Notas</span>
                <strong>{job.notes ?? 'Sin notas'}</strong>
              </div>
            </div>

            {getJobBillingLines(job).map((line, index) => (
              <article key={line.id ?? `${job.id}-line-${index + 1}`} className="cc-create-flow__panel" style={{ marginTop: '0.75rem' }}>
                <strong>Línea {index + 1}</strong>
                <small>{line.concept}</small>
                <div className="cc-create-flow__summary-list">
                  <div className="cc-create-flow__summary-item">
                    <span>Cantidad</span>
                    <strong>{line.quantity}</strong>
                  </div>
                  <div className="cc-create-flow__summary-item">
                    <span>Unidad</span>
                    <strong>{line.unit}</strong>
                  </div>
                  <div className="cc-create-flow__summary-item">
                    <span>Precio</span>
                    <strong>{line.unit_price}</strong>
                  </div>
                  <div className="cc-create-flow__summary-item">
                    <span>Importe</span>
                    <strong>{line.line_subtotal}</strong>
                  </div>
                </div>
              </article>
            ))}
            </>
          )}

          {!isEditing && saveError ? (
            <div className="cc-alert cc-alert--error">
              <strong>No se pudo actualizar el servicio</strong>
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
      ) : (
        <div className="empty-state">
          <strong>Ningún servicio seleccionado</strong>
          <p>Haz clic en una tarjeta del listado para ver su detalle.</p>
        </div>
      )}

      <ConfirmDialog
        isOpen={showDiscardConfirm}
        title="Descartar cambios de servicio"
        description="Has modificado este servicio. Si cierras ahora, perderas los cambios no guardados."
        confirmLabel="Descartar cambios"
        tone="warning"
        onCancel={() => setShowDiscardConfirm(false)}
        onConfirm={() => {
          setShowDiscardConfirm(false)
          setIsDirty(false)
          if (majorEditMode) {
            onMajorEditClose?.()
            return
          }

          setIsEditing(false)
        }}
      />

      <ConfirmDialog
        isOpen={Boolean(pendingCancelledStatusUpdate)}
        title="Cancelar servicio"
        description="Esta acción marca el servicio como cancelado y lo aparta del seguimiento operativo activo. Confirma solo si el servicio no debe ejecutarse."
        confirmLabel="Sí, cancelar servicio"
        tone="warning"
        isBusy={isSaving}
        onCancel={() => setPendingCancelledStatusUpdate(null)}
        onConfirm={handleConfirmCancelledStatusUpdate}
      />

      <ConfirmDialog
        isOpen={pendingCancelledFormSave}
        title="Guardar servicio como cancelado"
        description="Vas a guardar la edición dejando el servicio en estado cancelado. Confirma solo si el servicio no debe ejecutarse."
        confirmLabel="Guardar como cancelado"
        tone="warning"
        isBusy={isSaving}
        onCancel={() => setPendingCancelledFormSave(false)}
        onConfirm={() => {
          setPendingCancelledFormSave(false)
          void saveJobEdits(true)
        }}
      />
    </section>
  )
}
