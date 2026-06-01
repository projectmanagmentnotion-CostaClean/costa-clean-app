import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { formatDateEs, getDisplayStatusLabel, getServiceTypeLabel } from '../../app/displayFormat'
import { getStatusLabel } from '../../app/displayText'
import { formatClientLabel, formatPropertyLabel, formatQuoteLabel } from '../../app/relationshipLabels'
import { getStatusOptionLabel, jobStatusOptions } from '../../app/statusOptions'
import { ConfirmDialog } from '../../components/ConfirmDialog'
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
  onUnsavedChange?: (hasUnsavedChanges: boolean) => void
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

function parseDecimalInput(value: string): number {
  const normalized = value.trim().replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function normalizeBillingUnit(value: string | null | undefined): string {
  return value === 'service' ? 'servicio' : value ?? 'servicio'
}

function getJobPrimaryReference(job: JobListItem): string {
  return job.billing_concept?.trim() || getServiceTypeLabel(job.service_type)
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
  onUnsavedChange,
}: JobDetailCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [pendingCancelledStatusUpdate, setPendingCancelledStatusUpdate] = useState<string | null>(null)
  const [pendingCancelledFormSave, setPendingCancelledFormSave] = useState(false)
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

    setIsEditing(false)
    setSaveError(null)
    setSuccessMessage(null)
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
    onUnsavedChange?.(isEditing)
    return () => onUnsavedChange?.(false)
  }, [isEditing, onUnsavedChange])

  const availableProperties = useMemo(() => {
    if (!form.client_id) return []
    return properties.filter((property) => property.client_id === form.client_id)
  }, [properties, form.client_id])

  const availableQuotes = useMemo(() => {
    if (!form.client_id) return []
    return quotes.filter((quote) => quote.client_id === form.client_id)
  }, [quotes, form.client_id])

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
        next.quote_id = ''
      }

      if (field === 'service_type') {
        const currentConcept = current.billing_concept.trim()
        const previousServiceConcept = getServiceTypeOptionLabel(current.service_type)
        if (!currentConcept || currentConcept === previousServiceConcept) {
          next.billing_concept = getServiceTypeOptionLabel(String(value))
        }
      }

      return next
    })
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
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseAnonKey) {
        setSaveError('Faltan las variables de entorno de Supabase.')
        return
      }

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

      const billingQuantity = parseDecimalInput(form.billing_quantity)
      const billingUnitPrice = form.billing_unit_price.trim()
        ? parseDecimalInput(form.billing_unit_price)
        : null

      if (Number.isNaN(billingQuantity) || billingQuantity <= 0) {
        setSaveError('La cantidad de facturación debe ser mayor que 0.')
        return
      }

      if (billingUnitPrice !== null && (Number.isNaN(billingUnitPrice) || billingUnitPrice < 0)) {
        setSaveError('El precio unitario debe estar vacío o ser mayor o igual que 0.')
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
          body: JSON.stringify({
            client_id: form.client_id,
            property_id: form.property_id,
            quote_id: form.quote_id || null,
            scheduled_date: form.scheduled_date,
            status: form.status,
            service_type: form.service_type,
            billing_concept: form.billing_concept.trim() || null,
            billing_quantity: billingQuantity,
            billing_unit: form.billing_unit.trim() || 'servicio',
            billing_unit_price: billingUnitPrice,
            notes: form.notes.trim() || null,
          }),
        },
      )

      if (!response.ok) {
        const errorText = await response.text()
        setSaveError(`REST ${response.status}: ${errorText || response.statusText}`)
        return
      }

      await onJobUpdated()
      setSuccessMessage('Servicio actualizado correctamente.')
      setIsEditing(false)
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

        {job ? (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="secondary-button"
              onClick={() => onCreateInvoiceFromJob(job)}
            >
              Crear factura desde servicio
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setIsEditing((current) => !current)
                setSaveError(null)
                setSuccessMessage(null)
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
                <span>Concepto de facturación</span>
                <input
                  value={form.billing_concept}
                  onChange={(event) => updateField('billing_concept', event.target.value)}
                  placeholder="Descripción profesional que se mostrará en factura"
                />
              </label>

              <label className="form-field">
                <span>Cantidad de facturación *</span>
                <input
                  value={form.billing_quantity}
                  onChange={(event) => updateField('billing_quantity', event.target.value)}
                  required
                />
              </label>

              <label className="form-field">
                <span>Unidad de facturación *</span>
                <input
                  value={form.billing_unit}
                  onChange={(event) => updateField('billing_unit', event.target.value)}
                  placeholder="servicio, hora, m²..."
                  required
                />
              </label>

              <label className="form-field">
                <span>Precio unitario</span>
                <input
                  value={form.billing_unit_price}
                  onChange={(event) => updateField('billing_unit_price', event.target.value)}
                  placeholder="Opcional"
                />
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
                <strong>{job.billing_concept ?? getServiceTypeLabel(job.service_type)}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Cantidad de facturación</span>
                <strong>{job.billing_quantity ?? 1}</strong>
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
