import { useState, type FormEvent } from 'react'
import { useEffect } from 'react'
import { getStatusLabel } from '../../app/displayText'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { findClientDuplicateGroups } from '../duplicates/duplicateEngine'
import { DuplicateReviewOverlay } from '../duplicates/DuplicateReviewOverlay'
import type { ClientListItem } from './types'

interface ClientCreateFormProps {
  onCreated: () => Promise<void>
  onCreatedClient?: (client: ClientListItem) => void | Promise<void>
  onCancel?: () => void
  onDirtyChange?: (isDirty: boolean) => void
  title?: string
  description?: string
  submitLabel?: string
  existingClients?: ClientListItem[]
  onOpenExistingClient?: (clientId: string) => void
}

interface FormState {
  full_name: string
  phone: string
  email: string
  tax_id: string
  billing_address: string
  status: string
}

const initialFormState: FormState = {
  full_name: '',
  phone: '',
  email: '',
  tax_id: '',
  billing_address: '',
  status: 'active',
}

export function ClientCreateForm({
  onCreated,
  onCreatedClient,
  onCancel,
  onDirtyChange,
  title = 'Nuevo cliente',
  description,
  submitLabel = 'Guardar cliente',
  existingClients = [],
  onOpenExistingClient,
}: ClientCreateFormProps) {
  const [form, setForm] = useState<FormState>(initialFormState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [pendingDuplicateGroups, setPendingDuplicateGroups] = useState<ReturnType<typeof findClientDuplicateGroups>>([])

  useEffect(() => {
    onDirtyChange?.(isDirty)
    return () => onDirtyChange?.(false)
  }, [isDirty, onDirtyChange])

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setIsDirty(true)
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function submitClient(skipDuplicateReview = false) {
    setSubmitError(null)
    setSuccessMessage(null)
    setIsSubmitting(true)

    try {
      if (!skipDuplicateReview) {
        const duplicateGroups = findClientDuplicateGroups({
          id: 'CLIENT-DRAFT',
          full_name: form.full_name.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          tax_id: form.tax_id.trim() || null,
          billing_address: form.billing_address.trim() || null,
          status: form.status,
          source_lead_id: null,
        }, existingClients)

        if (duplicateGroups.length > 0) {
          setPendingDuplicateGroups(duplicateGroups)
          return
        }
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseAnonKey) {
        setSubmitError('Faltan las variables de entorno de Supabase.')
        return
      }

      const clientId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? `CLIENT-${crypto.randomUUID()}`
          : `CLIENT-${Date.now()}`

      const response = await fetch(`${supabaseUrl}/rest/v1/clients`, {
        method: 'POST',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: clientId,
          full_name: form.full_name.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          tax_id: form.tax_id.trim() || null,
          billing_address: form.billing_address.trim() || null,
          status: form.status,
          source_lead_id: null,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        setSubmitError(`REST ${response.status}: ${errorText || response.statusText}`)
        return
      }

      await onCreated()
      await onCreatedClient?.({
        id: clientId,
        display_code: null,
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        tax_id: form.tax_id.trim() || null,
        billing_address: form.billing_address.trim() || null,
        status: form.status,
        source_lead_id: null,
      })
      setForm(initialFormState)
      setIsDirty(false)
      setSuccessMessage('Cliente creado correctamente.')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido creando el cliente.'

      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await submitClient()
  }

  function requestCancel() {
    if (!onCancel) return
    if (!isDirty) {
      onCancel()
      return
    }

    setShowCancelConfirm(true)
  }

  return (
    <section className="data-section">
      <div className="section-header">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>

      <form className="lead-form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Nombre completo *</span>
          <input
            value={form.full_name}
            onChange={(event) => updateField('full_name', event.target.value)}
            placeholder="Ej. Marta López"
            required
          />
        </label>

        <label className="form-field">
          <span>Teléfono</span>
          <input
            value={form.phone}
            onChange={(event) => updateField('phone', event.target.value)}
            placeholder="Ej. 600123123"
          />
        </label>

        <label className="form-field">
          <span>Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(event) => updateField('email', event.target.value)}
            placeholder="Ej. cliente@email.com"
          />
        </label>

        <label className="form-field">
          <span>DNI/NIF/CIF</span>
          <input
            value={form.tax_id}
            onChange={(event) => updateField('tax_id', event.target.value)}
            placeholder="Ej. B12345678"
          />
        </label>

        <label className="form-field form-field-full">
          <span>Dirección fiscal</span>
          <textarea
            value={form.billing_address}
            onChange={(event) => updateField('billing_address', event.target.value)}
            placeholder="Dirección completa para facturación"
            rows={3}
          />
        </label>

        <label className="form-field">
          <span>Estado</span>
          <select
            value={form.status}
            onChange={(event) => updateField('status', event.target.value)}
          >
            <option value="active">{getStatusLabel('active')}</option>
            <option value="inactive">{getStatusLabel('inactive')}</option>
          </select>
        </label>

        <div className="form-actions">
          {onCancel ? (
            <button type="button" className="secondary-button" onClick={requestCancel}>
              Cancelar
            </button>
          ) : null}
          <button type="submit" className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : submitLabel}
          </button>
        </div>

        {submitError ? (
          <div className="empty-state">
            <strong>No se pudo crear el cliente</strong>
            <p>{submitError}</p>
          </div>
        ) : null}

        {successMessage ? (
          <div className="empty-state">
            <strong>Operación correcta</strong>
            <p>{successMessage}</p>
          </div>
        ) : null}
      </form>

      <ConfirmDialog
        isOpen={showCancelConfirm}
        title="Descartar cliente en curso"
        description="Has empezado a completar este cliente. Si cierras ahora, perderas los cambios no guardados."
        confirmLabel="Descartar cambios"
        tone="warning"
        onCancel={() => setShowCancelConfirm(false)}
        onConfirm={() => {
          setShowCancelConfirm(false)
          onCancel?.()
        }}
      />

      <DuplicateReviewOverlay
        isOpen={pendingDuplicateGroups.length > 0}
        title="Posible cliente duplicado"
        description="Antes de crear otra ficha, revisa si ya existe un cliente que puedas reutilizar."
        groups={pendingDuplicateGroups}
        onClose={() => setPendingDuplicateGroups([])}
        onOpenRecord={onOpenExistingClient ? (clientId) => {
          setPendingDuplicateGroups([])
          onOpenExistingClient(clientId)
        } : undefined}
        onUseRecord={onOpenExistingClient ? (clientId) => {
          setPendingDuplicateGroups([])
          onOpenExistingClient(clientId)
        } : undefined}
        onContinueAnyway={() => {
          setPendingDuplicateGroups([])
          void submitClient(true)
        }}
      />
    </section>
  )
}
