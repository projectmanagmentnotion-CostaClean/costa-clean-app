import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { formatDateEs, getDisplayStatusLabel, getServiceTypeLabel } from '../../app/displayFormat'
import { getStatusLabel } from '../../app/displayText'
import { formatClientLabel, formatPropertyLabel, formatQuoteLabel } from '../../app/relationshipLabels'
import { getStatusOptionLabel, jobStatusOptions } from '../../app/statusOptions'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { fetchAuthenticatedSupabaseWrite, readSingleAuthenticatedWriteRow } from '../../lib/authenticatedSupabaseWrite'
import { operationalWriteRpcPaths } from '../../lib/operationalWriteRpc'
import {
  buildBillingLinePayloads,
  calculateBillingLineSubtotal,
  calculateBillingSubtotal,
  createBlankBillingLine,
  formatBillingLineSubtotalInput,
  type BillingLineFormState,
} from '../shared/billingLineDrafts'
import { getJobBillingDisplayConcept, getJobBillingDraftLines, getJobBillingLines, getJobBillingDisplaySummary } from './jobBilling'
import {
  appendBillingLine,
  buildJobEditorValidation,
  buildOptimisticJobAfterSave,
  shouldShowJobLineDebug,
  type JobEditorRefreshResult,
} from './jobEditorLiveState'
import { getPersistedJobLines } from './jobEditableLines'
import { buildJobBillingSummary, saveJobWithLines } from './jobWriteApi'
import type { JobListItem } from './types'
import type { ClientListItem } from '../clients/types'
import type { PropertyListItem } from '../properties/types'
import type { QuoteListItem } from '../quotes/types'
import { useToast } from '../../shared/toasts/useToast'
import { patchLifecycleEntity } from '../../shared/lifecycle/lifecycleApi'
import { isArchivedEntity } from '../../shared/lifecycle/entityLifecycle'

interface JobDetailCardProps {
  job: JobListItem | null
  clients: ClientListItem[]
  properties: PropertyListItem[]
  quotes: QuoteListItem[]
  onJobUpdated: (optimisticJob?: JobListItem) => Promise<JobEditorRefreshResult>
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

interface JobEditorDebugState {
  source: 'billing_lines' | 'legacy' | 'unknown'
  initialEditableLines: number
  lastSubmitPayloadLines: number | null
  lastSubmitConcepts: string[]
}

type SaveState = 'idle' | 'saving' | 'refreshing' | 'saved' | 'refresh_warning' | 'error'

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

function createEmptyFormState(): EditFormState {
  return {
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
  }
}

function createDebugStateFromJob(job: JobListItem | null): JobEditorDebugState {
  if (!job) {
    return {
      source: 'unknown',
      initialEditableLines: 0,
      lastSubmitPayloadLines: null,
      lastSubmitConcepts: [],
    }
  }

  const initialBillingLines = getJobBillingDraftLines(job)
  const hasPersistedBillingLines = Boolean(job.billing_lines?.length || job.billingLines?.length || job.job_lines?.length)

  return {
    source: hasPersistedBillingLines ? 'billing_lines' : 'legacy',
    initialEditableLines: initialBillingLines.length,
    lastSubmitPayloadLines: null,
    lastSubmitConcepts: [],
  }
}

function createFormStateFromJob(job: JobListItem | null): EditFormState {
  if (!job) return createEmptyFormState()

  return {
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
  }
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
  const toast = useToast()
  const [isInlineEditing, setIsInlineEditing] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [pendingCancelledStatusUpdate, setPendingCancelledStatusUpdate] = useState<string | null>(null)
  const [pendingCancelledFormSave, setPendingCancelledFormSave] = useState(false)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)
  const [showTrashConfirm, setShowTrashConfirm] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [billingLines, setBillingLines] = useState<BillingLineFormState[]>([createBlankBillingLine()])
  const [debugState, setDebugState] = useState<JobEditorDebugState>(createDebugStateFromJob(job))
  const [form, setForm] = useState<EditFormState>(createFormStateFromJob(job))
  const lineInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const previousJobIdRef = useRef<string | null>(job?.id ?? null)
  const pendingFocusLineIdRef = useRef<string | null>(null)
  const isEditing = majorEditMode || isInlineEditing
  const isSaving = saveState === 'saving' || saveState === 'refreshing'

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!job) {
      previousJobIdRef.current = null
      setIsInlineEditing(false)
      setSaveState('idle')
      setSaveError(null)
      setSuccessMessage(null)
      setIsDirty(false)
      setBillingLines([createBlankBillingLine()])
      setDebugState(createDebugStateFromJob(null))
      setForm(createEmptyFormState())
      return
    }

    const initialBillingLines = getJobBillingDraftLines(job)
    const hasPersistedBillingLines = Boolean(job.billing_lines?.length || job.billingLines?.length || job.job_lines?.length)
    const isSameJob = previousJobIdRef.current === job.id
    previousJobIdRef.current = job.id

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

    setDebugState((current) => ({
      source: hasPersistedBillingLines ? 'billing_lines' : 'legacy',
      initialEditableLines: initialBillingLines.length,
      lastSubmitPayloadLines: current.lastSubmitPayloadLines,
      lastSubmitConcepts: current.lastSubmitConcepts,
    }))

    if (!isSameJob) {
      setIsInlineEditing(false)
      setSaveState('idle')
      setSaveError(null)
      setSuccessMessage(null)
      setIsDirty(false)
      setBillingLines(initialBillingLines)
      setForm(createFormStateFromJob(job))
      return
    }

    if (isEditing && isDirty) {
      return
    }

    setBillingLines(initialBillingLines)
    setForm(createFormStateFromJob(job))
  }, [isDirty, isEditing, job])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    onUnsavedChange?.(isDirty)
    return () => onUnsavedChange?.(false)
  }, [isDirty, onUnsavedChange])

  useEffect(() => {
    if (!pendingFocusLineIdRef.current) return

    const nextInput = lineInputRefs.current[pendingFocusLineIdRef.current]
    if (!nextInput) return

    nextInput.focus()
    nextInput.scrollIntoView({ behavior: 'smooth', block: 'center' })
    pendingFocusLineIdRef.current = null
  }, [billingLines])

  const availableProperties = useMemo(() => {
    if (!form.client_id) return []
    return properties.filter((property) => property.client_id === form.client_id)
  }, [properties, form.client_id])

  const availableQuotes = useMemo(() => {
    if (!form.client_id) return []
    return quotes.filter((quote) => quote.client_id === form.client_id)
  }, [quotes, form.client_id])
  const billingSubtotal = useMemo(() => calculateBillingSubtotal(billingLines), [billingLines])
  const persistedJobLines = useMemo(() => getPersistedJobLines(job), [job])
  const appDataJobLinesDebug = typeof window !== 'undefined'
    ? window.__COSTA_CLEAN_JOB_LINES_DEBUG__ ?? null
    : null
  const showJobLineDebug = shouldShowJobLineDebug(
    typeof window !== 'undefined' ? window.location.search : '',
    import.meta.env.DEV,
  )
  const validation = useMemo(
    () => buildJobEditorValidation(billingLines, form),
    [billingLines, form],
  )

  function clearTransientFeedback() {
    if (saveState === 'saved' || saveState === 'refresh_warning') {
      setSaveState('idle')
      setSuccessMessage(null)
    }
    if (saveState === 'error' && saveError) {
      setSaveState('idle')
      setSaveError(null)
    }
  }

  function resetEditorFromJob(nextJob: JobListItem) {
    setBillingLines(getJobBillingDraftLines(nextJob))
    setDebugState(createDebugStateFromJob(nextJob))
    setForm(createFormStateFromJob(nextJob))
  }

  function updateField<K extends keyof EditFormState>(
    field: K,
    value: EditFormState[K],
  ) {
    clearTransientFeedback()
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
    clearTransientFeedback()
    setIsDirty(true)
    setBillingLines((current) => current.map((line) => (
      line.local_id === localId ? { ...line, [field]: value } : line
    )))
  }

  function removeBillingLine(localId: string) {
    clearTransientFeedback()
    setIsDirty(true)
    setBillingLines((current) => (current.length > 1 ? current.filter((line) => line.local_id !== localId) : current))
  }

  function addBillingLine() {
    clearTransientFeedback()
    setIsDirty(true)
    setBillingLines((current) => {
      const next = appendBillingLine(current)
      pendingFocusLineIdRef.current = next[next.length - 1]?.local_id ?? null
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
    setSaveState('saving')
    const toastId = toast.loading('Guardando servicio...', 'Enviando lineas y resumen del servicio.')

    try {
      if (validation.blockingMessage) {
        setSaveState('error')
        setSaveError(validation.blockingMessage)
        toast.update(toastId, {
          type: 'error',
          title: 'No se pudo guardar el servicio',
          description: validation.blockingMessage,
          persistent: true,
        })
        return
      }

      const normalizedBillingLines = buildBillingLinePayloads(billingLines, (concept) => concept.trim())
      if (!normalizedBillingLines || normalizedBillingLines.length === 0) {
        setSaveState('error')
        setSaveError('Cada linea debe tener concepto, cantidad mayor que 0 y precio unitario valido.')
        toast.update(toastId, {
          type: 'error',
          title: 'No se pudo guardar el servicio',
          description: 'Cada linea debe tener concepto, cantidad mayor que 0 y precio unitario valido.',
          persistent: true,
        })
        return
      }
      setDebugState((current) => ({
        ...current,
        lastSubmitPayloadLines: normalizedBillingLines.length,
        lastSubmitConcepts: normalizedBillingLines.map((line) => line.concept),
      }))
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
      const savedLines = normalizedBillingLines.map((line, index) => ({
        ...line,
        id: line.id || `JOB-LINE-${job.id}-${index + 1}`,
        job_id: job.id,
      }))
      const optimisticJob = buildOptimisticJobAfterSave({
        job,
        form,
        lines: savedLines,
        billingSummary,
      })

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
        savedLines,
      )

      setSaveState('refreshing')
      setSuccessMessage('Guardando servicio y refrescando vista...')
      toast.update(toastId, {
        type: 'info',
        title: 'Servicio guardado',
        description: 'Actualizando datos en pantalla...',
        persistent: true,
      })
      const refreshResult = await onJobUpdated(optimisticJob)
      const refreshedJobLines = getJobBillingDraftLines(refreshResult.job)
      setBillingLines(refreshedJobLines)
      setForm(createFormStateFromJob(refreshResult.job))
      setSaveState(refreshResult.status === 'synced' ? 'saved' : 'refresh_warning')
      setSuccessMessage(refreshResult.message)
      toast.update(toastId, {
        type: refreshResult.status === 'synced' ? 'success' : 'warning',
        title: refreshResult.status === 'synced' ? 'Servicio guardado' : 'Guardado con refresh pendiente',
        description: refreshResult.message,
        persistent: refreshResult.status !== 'synced',
      })
      setIsDirty(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido actualizando el servicio.'
      setSaveState('error')
      setSaveError(message)
      toast.update(toastId, {
        type: 'error',
        title: 'No se pudo guardar el servicio',
        description: `${message} Tus lineas siguen en pantalla.`,
        persistent: true,
      })
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
    setSaveState('saving')
    const toastId = toast.loading('Actualizando estado del servicio...', 'Guardando el nuevo estado operativo.')

    try {
      const statusResponse = await fetchAuthenticatedSupabaseWrite(
        operationalWriteRpcPaths.updateJobStatus,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_job_id: job.id, p_status: nextStatus }),
        },
      )
      await readSingleAuthenticatedWriteRow(
        statusResponse,
        'No se actualizo el estado del servicio. Tu sesion puede no tener permisos para este cambio.',
      )

      setSaveState('refreshing')
      setSuccessMessage('Actualizando estado y refrescando vista...')
      toast.update(toastId, {
        type: 'info',
        title: 'Estado guardado',
        description: 'Actualizando datos en pantalla...',
        persistent: true,
      })
      const refreshResult = await onJobUpdated({
        ...job,
        status: nextStatus,
      })
      setSaveState(refreshResult.status === 'synced' ? 'saved' : 'refresh_warning')
      setSuccessMessage(
        refreshResult.status === 'synced'
          ? `Estado del servicio actualizado a ${getStatusLabel(nextStatus)}.`
          : `${getStatusLabel(nextStatus)} guardado. La vista mantiene el estado local mientras llega el refresco.`,
      )
      toast.update(toastId, {
        type: refreshResult.status === 'synced' ? 'success' : 'warning',
        title: refreshResult.status === 'synced' ? 'Estado actualizado' : 'Estado guardado con refresh pendiente',
        description: refreshResult.status === 'synced'
          ? `Estado del servicio actualizado a ${getStatusLabel(nextStatus)}.`
          : `${getStatusLabel(nextStatus)} guardado. La vista mantiene el estado local mientras llega el refresco.`,
        persistent: refreshResult.status !== 'synced',
      })
      setIsInlineEditing(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido actualizando el estado del servicio.'
      setSaveState('error')
      setSaveError(message)
      toast.update(toastId, {
        type: 'error',
        title: 'No se pudo actualizar el estado',
        description: message,
        persistent: true,
      })
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

  async function handleArchiveJob() {
    if (!job) return
    setSaveError(null)
    setSuccessMessage(null)
    setSaveState('saving')
    const toastId = toast.loading('Archivando servicio...', 'Saldra de la agenda operativa activa.')

    try {
      await patchLifecycleEntity('jobs', job.id, { archived_at: new Date().toISOString() })
      const refreshResult = await onJobUpdated({ ...job, archived_at: new Date().toISOString() })
      setSaveState(refreshResult.status === 'synced' ? 'saved' : 'refresh_warning')
      setSuccessMessage('Servicio archivado. Ya no aparece en la agenda activa.')
      toast.update(toastId, { type: 'success', title: 'Servicio archivado', description: 'Ya no aparece en la agenda activa.' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo archivar el servicio.'
      setSaveState('error')
      setSaveError(message)
      toast.update(toastId, { type: 'error', title: 'No se pudo archivar', description: message, persistent: true })
    }
  }

  async function handleRestoreJob() {
    if (!job) return
    setSaveError(null)
    setSuccessMessage(null)
    setSaveState('saving')
    const toastId = toast.loading('Restaurando servicio...', 'Volvera al circuito operativo.')

    try {
      await patchLifecycleEntity('jobs', job.id, { archived_at: null, deleted_at: null })
      const refreshResult = await onJobUpdated({ ...job, archived_at: null, deleted_at: null })
      setSaveState(refreshResult.status === 'synced' ? 'saved' : 'refresh_warning')
      setSuccessMessage('Servicio restaurado correctamente.')
      toast.update(toastId, { type: 'success', title: 'Servicio restaurado', description: 'Vuelve a estar disponible.' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo restaurar el servicio.'
      setSaveState('error')
      setSaveError(message)
      toast.update(toastId, { type: 'error', title: 'No se pudo restaurar', description: message, persistent: true })
    }
  }

  async function handleTrashJob() {
    if (!job) return
    setSaveError(null)
    setSuccessMessage(null)
    setSaveState('saving')
    const toastId = toast.loading('Moviendo servicio a papelera...', 'Quedara oculto de las vistas diarias.')

    try {
      await patchLifecycleEntity('jobs', job.id, { deleted_at: new Date().toISOString() })
      const refreshResult = await onJobUpdated({ ...job, deleted_at: new Date().toISOString() })
      setSaveState(refreshResult.status === 'synced' ? 'saved' : 'refresh_warning')
      setSuccessMessage('Servicio movido a papelera.')
      toast.update(toastId, { type: 'success', title: 'Servicio en papelera', description: 'Queda oculto de las vistas diarias.' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo mover el servicio a papelera.'
      setSaveState('error')
      setSaveError(message)
      toast.update(toastId, { type: 'error', title: 'No se pudo mover a papelera', description: message, persistent: true })
    }
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

            {isArchivedEntity(job) ? (
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowRestoreConfirm(true)}
              >
                Restaurar servicio
              </button>
            ) : (
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowArchiveConfirm(true)}
              >
                Archivar servicio
              </button>
            )}

            {!job.invoice_id ? (
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowTrashConfirm(true)}
              >
                Mover a papelera
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

                setIsInlineEditing((current) => !current)
                setSaveState('idle')
                setSaveError(null)
                setSuccessMessage(null)
                setIsDirty(false)
                resetEditorFromJob(job)
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
                {showJobLineDebug ? (
                  <>
                    <div
                      style={{
                        border: '2px solid #ff3b30',
                        background: 'rgba(255,59,48,0.18)',
                        color: '#fff',
                        padding: '12px',
                        borderRadius: '12px',
                        marginBottom: '12px',
                        fontWeight: 800,
                      }}
                    >
                      DEV TRACE ACTIVO - COMPONENTE REAL: JobDetailCard.tsx - JOB EDITOR LINES
                    </div>
                    <pre
                      style={{
                        whiteSpace: 'pre-wrap',
                        background: 'rgba(0,0,0,0.35)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        padding: '12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        lineHeight: 1.5,
                        color: '#fff',
                        margin: '0 0 12px',
                      }}
                    >
                      {JSON.stringify({
                        component: 'JobDetailCard.tsx',
                        jobId: job.id,
                        displayCode: job.display_code,
                        billingLinesLength: persistedJobLines.length,
                        billingLinesConcepts: persistedJobLines.map((line) => line.concept),
                        editableLinesLength: billingLines.length,
                        editableLinesConcepts: billingLines.map((line) => line.concept),
                        jobKeys: Object.keys(job ?? {}),
                        billing_lines_length: Array.isArray(job.billing_lines) ? job.billing_lines.length : 'not-array',
                        billingLines_length: Array.isArray(job.billingLines) ? job.billingLines.length : 'not-array',
                        job_lines_length: Array.isArray(job.job_lines) ? job.job_lines.length : 'not-array',
                        rawBillingLinesSample: job.billing_lines?.slice?.(0, 3) ?? null,
                        rawBillingLinesCamelSample: job.billingLines?.slice?.(0, 3) ?? null,
                        rawJobLinesSample: job.job_lines?.slice?.(0, 3) ?? null,
                        appDataJobLinesDebug,
                        importMetaDev: import.meta.env.DEV,
                        debugJobLinesFlag: typeof window !== 'undefined'
                          ? window.location.search.includes('debugJobLines=1')
                          : false,
                      }, null, 2)}
                    </pre>
                  </>
                ) : null}

                {billingLines.map((line, index) => (
                  <article key={line.local_id} className="cc-create-flow__line-card">
                    <label className="form-field form-field-full">
                      <span>Concepto {index + 1}</span>
                      <input
                        ref={(node) => {
                          lineInputRefs.current[line.local_id] = node
                        }}
                        value={line.concept}
                        placeholder="Ej. Limpieza general, cristales, lavanderia..."
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
                      {validation.lineWarnings[line.local_id]?.length ? (
                        <small className="cc-create-flow__helper" style={{ color: '#b42318' }}>
                          {validation.lineWarnings[line.local_id].join(' ')}
                        </small>
                      ) : null}
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => removeBillingLine(line.local_id)}
                        disabled={billingLines.length === 1 || isSaving}
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
                  <button type="button" className="secondary-button" onClick={addBillingLine} disabled={isSaving}>
                    Añadir linea
                  </button>
                  <small className="cc-create-flow__helper">Total actual {billingSubtotal.toFixed(2)} EUR</small>
                </div>
              </div>

              {validation.globalWarnings.map((warning) => (
                <div key={warning} className="cc-alert cc-alert--warning">
                  <strong>Revisa el servicio antes de guardar</strong>
                  <p>{warning}</p>
                </div>
              ))}

              {showJobLineDebug ? (
                <div className="cc-create-flow__panel form-field-full" style={{ marginTop: '0.75rem' }}>
                  <strong>Debug lineas servicio</strong>
                  <small>Componente: JobDetailCard/EditForm</small>
                  <div className="cc-create-flow__summary-list">
                    <div className="cc-create-flow__summary-item">
                      <span>Job</span>
                      <strong>{job.display_code ?? job.id}</strong>
                    </div>
                    <div className="cc-create-flow__summary-item">
                      <span>Fuente</span>
                      <strong>{debugState.source}</strong>
                    </div>
                    <div className="cc-create-flow__summary-item">
                      <span>job.billing_lines</span>
                      <strong>{Array.isArray(job.billing_lines) ? job.billing_lines.length : 0}</strong>
                    </div>
                    <div className="cc-create-flow__summary-item">
                      <span>job.billingLines</span>
                      <strong>{Array.isArray(job.billingLines) ? job.billingLines.length : 0}</strong>
                    </div>
                    <div className="cc-create-flow__summary-item">
                      <span>job.job_lines</span>
                      <strong>{Array.isArray(job.job_lines) ? job.job_lines.length : 0}</strong>
                    </div>
                    <div className="cc-create-flow__summary-item">
                      <span>initialEditableLines</span>
                      <strong>{debugState.initialEditableLines}</strong>
                    </div>
                    <div className="cc-create-flow__summary-item">
                      <span>stateLines</span>
                      <strong>{billingLines.length}</strong>
                    </div>
                    <div className="cc-create-flow__summary-item">
                      <span>renderedLines</span>
                      <strong>{billingLines.length}</strong>
                    </div>
                    <div className="cc-create-flow__summary-item">
                      <span>Ultimo submit p_lines</span>
                      <strong>{debugState.lastSubmitPayloadLines ?? 'sin submit'}</strong>
                    </div>
                    <div className="cc-create-flow__summary-item">
                      <span>fallbackLegacy</span>
                      <strong>{debugState.source === 'legacy' ? 'si' : 'no'}</strong>
                    </div>
                  </div>
                  <p className="cc-create-flow__helper">
                    conceptos job: {persistedJobLines.map((line) => line.concept).join(' | ') || 'sin lineas'}
                  </p>
                  <p className="cc-create-flow__helper">
                    conceptos state: {billingLines.map((line) => line.concept || '[vacio]').join(' | ') || 'sin lineas'}
                  </p>
                  <p className="cc-create-flow__helper">
                    conceptos submit: {debugState.lastSubmitConcepts.join(' | ') || 'sin submit'}
                  </p>
                  {appDataJobLinesDebug ? (
                    <pre
                      style={{
                        whiteSpace: 'pre-wrap',
                        background: 'rgba(0,0,0,0.25)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        padding: '12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        lineHeight: 1.45,
                        color: '#fff',
                        margin: '0.5rem 0 0',
                      }}
                    >
                      {JSON.stringify(appDataJobLinesDebug, null, 2)}
                    </pre>
                  ) : null}
                  {persistedJobLines.length > 1 && billingLines.length === 1 ? (
                    <p className="cc-create-flow__helper" style={{ color: '#b42318' }}>
                      Invariante rota: job tiene {persistedJobLines.length} lineas pero el formulario renderiza 1.
                    </p>
                  ) : null}
                  {billingLines.length > 1 && debugState.lastSubmitPayloadLines === 1 ? (
                    <p className="cc-create-flow__helper" style={{ color: '#b42318' }}>
                      Invariante rota: el submit compacto lineas.
                    </p>
                  ) : null}
                </div>
              ) : null}

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
                      setSaveState('idle')
                      setSaveError(null)
                      setSuccessMessage(null)
                      resetEditorFromJob(job)
                      onMajorEditClose?.()
                      return
                    }

                    setIsInlineEditing(false)
                    setSaveState('idle')
                    setSaveError(null)
                    setSuccessMessage(null)
                    setIsDirty(false)
                    resetEditorFromJob(job)
                  }}
                >
                  Cancelar
                </button>
                <button type="submit" className="primary-button" disabled={isSaving}>
                  {saveState === 'refreshing' ? 'Refrescando vista...' : saveState === 'saving' ? 'Guardando cambios...' : 'Guardar cambios'}
                </button>
              </div>

              {saveState === 'saving' ? (
                <div className="cc-alert cc-alert--warning">
                  <strong>Guardando servicio</strong>
                  <p>Se estan enviando las lineas y el resumen del servicio.</p>
                </div>
              ) : null}

              {saveState === 'refreshing' ? (
                <div className="cc-alert cc-alert--warning">
                  <strong>Refrescando vista</strong>
                  <p>{successMessage ?? 'El servicio ya se guardo. Esperando a que el refresh confirme la version remota.'}</p>
                </div>
              ) : null}

              {saveError ? (
                <div className="cc-alert cc-alert--error">
                  <strong>No se pudo actualizar el servicio</strong>
                  <p>{saveError}</p>
                </div>
              ) : null}

              {successMessage && (saveState === 'saved' || saveState === 'refresh_warning') ? (
                <div className={`cc-alert ${saveState === 'refresh_warning' ? 'cc-alert--warning' : 'cc-alert--success'}`}>
                  <strong>{saveState === 'refresh_warning' ? 'Guardado con refresh pendiente' : 'Operacion correcta'}</strong>
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

          {!isEditing && successMessage && (saveState === 'saved' || saveState === 'refresh_warning') ? (
            <div className={`cc-alert ${saveState === 'refresh_warning' ? 'cc-alert--warning' : 'cc-alert--success'}`}>
              <strong>{saveState === 'refresh_warning' ? 'Guardado con refresh pendiente' : 'Operación correcta'}</strong>
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
          setSaveState('idle')
          setSaveError(null)
          setSuccessMessage(null)
          if (job) {
            resetEditorFromJob(job)
          }
          if (majorEditMode) {
            onMajorEditClose?.()
            return
          }

          setIsInlineEditing(false)
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

      <ConfirmDialog
        isOpen={showArchiveConfirm}
        title="Archivar servicio"
        description="Este servicio dejara de aparecer en la agenda activa. Podras revisarlo desde los archivados."
        confirmLabel="Archivar servicio"
        tone="warning"
        isBusy={isSaving}
        onCancel={() => setShowArchiveConfirm(false)}
        onConfirm={() => {
          setShowArchiveConfirm(false)
          void handleArchiveJob()
        }}
      />

      <ConfirmDialog
        isOpen={showRestoreConfirm}
        title="Restaurar servicio"
        description="El servicio volvera a estar visible en los flujos operativos."
        confirmLabel="Restaurar servicio"
        tone="warning"
        isBusy={isSaving}
        onCancel={() => setShowRestoreConfirm(false)}
        onConfirm={() => {
          setShowRestoreConfirm(false)
          void handleRestoreJob()
        }}
      />

      <ConfirmDialog
        isOpen={showTrashConfirm}
        title="Mover servicio a papelera"
        description="Solo deberias usar esta accion en servicios sin factura asociada. Quedara oculto de las vistas diarias."
        confirmLabel="Mover a papelera"
        tone="warning"
        isBusy={isSaving}
        onCancel={() => setShowTrashConfirm(false)}
        onConfirm={() => {
          setShowTrashConfirm(false)
          void handleTrashJob()
        }}
      />
    </section>
  )
}
