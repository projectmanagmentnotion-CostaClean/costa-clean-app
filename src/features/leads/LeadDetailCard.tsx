import { useEffect, useRef, useState, type FormEvent } from 'react'
import { getDisplayStatusLabel, formatDateEs } from '../../app/displayFormat'
import { getStatusLabel } from '../../app/displayText'
import type { ClientListItem } from '../clients/types'
import { FeedbackDialog } from '../../components/FeedbackDialog'
import { convertLeadToClient } from '../financial/financialWriteApi'
import { LeadDraftCards } from '../leadDrafts/LeadDraftCards'
import type { LeadDraftRecord } from '../leadDrafts/types'
import type { LeadListItem } from './types'

interface LeadDetailCardProps {
  lead: LeadListItem | null
  leadDraft: LeadDraftRecord | null
  clients: ClientListItem[]
  alreadyConverted: boolean
  onLeadUpdated: () => Promise<void>
  onLeadConverted: () => Promise<void>
}

interface EditFormState {
  full_name: string
  phone: string
  city: string
  status: string
}

export function LeadDetailCard({
  lead,
  leadDraft,
  clients,
  alreadyConverted,
  onLeadUpdated,
  onLeadConverted,
}: LeadDetailCardProps) {
  const previousLeadIdRef = useRef<string | null>(null)

  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [form, setForm] = useState<EditFormState>({
    full_name: '',
    phone: '',
    city: '',
    status: 'new',
  })

  useEffect(() => {
    const currentLeadId = lead?.id ?? null
    const leadChanged = previousLeadIdRef.current !== currentLeadId
    previousLeadIdRef.current = currentLeadId

    if (!lead) {
      setIsEditing(false)
      setSaveError(null)
      setSuccessMessage(null)
      setForm({
        full_name: '',
        phone: '',
        city: '',
        status: 'new',
      })
      return
    }

    setIsEditing(false)
    setSaveError(null)

    if (leadChanged) {
      setSuccessMessage(null)
    }

    setForm({
      full_name: lead.full_name,
      phone: lead.phone,
      city: lead.city ?? '',
      status: lead.status,
    })
  }, [lead])

  function updateField<K extends keyof EditFormState>(
    field: K,
    value: EditFormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function patchLead(payload: Record<string, unknown>, successText: string) {
    if (!lead) return

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
        `${supabaseUrl}/rest/v1/leads?id=eq.${encodeURIComponent(lead.id)}`,
        {
          method: 'PATCH',
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      )

      if (!response.ok) {
        const errorText = await response.text()
        setSaveError(`REST ${response.status}: ${errorText || response.statusText}`)
        return
      }

      await onLeadUpdated()
      setSuccessMessage(successText)
      setIsEditing(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido actualizando el lead.'
      setSaveError(message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    await patchLead(
      {
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        city: form.city.trim() || null,
        status: form.status,
      },
      'Lead actualizado correctamente.',
    )
  }

  async function handleArchiveToggle() {
    if (!lead) return

    const isArchived = Boolean(lead.archived_at)

    await patchLead(
      { archived_at: isArchived ? null : new Date().toISOString() },
      isArchived ? 'Lead restaurado correctamente.' : 'Lead archivado correctamente.',
    )
  }

  async function handleConvertToClient() {
    if (!lead) return

    if (
      leadDraft &&
      (leadDraft.status === 'ready_for_review' || leadDraft.status === 'matched_existing_lead') &&
      leadDraft.ai_draft_status !== 'reviewed'
    ) {
      setSaveError('Revisa manualmente el borrador de intake antes de convertir este lead a cliente.')
      setSuccessMessage(null)
      return
    }

    if (alreadyConverted || lead.status === 'won') {
      setSaveError(null)
      setSuccessMessage('Este lead ya fue convertido previamente a cliente.')
      return
    }

    setSaveError(null)
    setSuccessMessage(null)
    setIsSaving(true)

    try {
      const result = await convertLeadToClient(lead.id)
      await onLeadConverted()
      setSuccessMessage(`Lead convertido a cliente correctamente. Cliente: ${result.client_id}.`)
      setIsEditing(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido convirtiendo el lead.'
      setSaveError(message)
    } finally {
      setIsSaving(false)
    }
  }

  const convertDisabled =
    isSaving || lead?.archived_at !== null || alreadyConverted || lead?.status === 'won'

  const convertLabel =
    alreadyConverted || lead?.status === 'won'
      ? 'Ya convertido'
      : 'Convertir a cliente'

  return (
    <section className="data-section">
      <div className="section-header page-header-actions">
        <div>
          <h2>Detalle del lead</h2>
        </div>

        {lead ? (
          <div className="detail-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setIsEditing((current) => !current)
                setSaveError(null)
                setSuccessMessage(null)
                setForm({
                  full_name: lead.full_name,
                  phone: lead.phone,
                  city: lead.city ?? '',
                  status: lead.status,
                })
              }}
            >
              {isEditing ? 'Cancelar edición' : 'Editar lead'}
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() => void handleConvertToClient()}
              disabled={convertDisabled}
            >
              {convertLabel}
            </button>

            <button
              type="button"
              className="secondary-button danger-button"
              onClick={() => void handleArchiveToggle()}
              disabled={isSaving}
            >
              {lead.archived_at ? 'Restaurar lead' : 'Archivar lead'}
            </button>
          </div>
        ) : null}
      </div>

      {lead ? (
        <div className="lead-detail-card">
          <div className="lead-detail-header">
            <div>
              <h3>{lead.full_name}</h3>
              <p>{lead.display_code ?? lead.id}</p>
            </div>

            <div className="lead-item-badges">
              <span className="lead-badge">{getDisplayStatusLabel(lead.status)}</span>
              {lead.archived_at ? (
                <span className="lead-badge lead-badge-archived">Archivado</span>
              ) : null}
            </div>
          </div>

          {isEditing ? (
            <form className="lead-form" onSubmit={handleSubmit}>
              <label className="form-field">
                <span>Nombre completo *</span>
                <input
                  value={form.full_name}
                  onChange={(event) => updateField('full_name', event.target.value)}
                  required
                />
              </label>

              <label className="form-field">
                <span>Teléfono *</span>
                <input
                  value={form.phone}
                  onChange={(event) => updateField('phone', event.target.value)}
                  required
                />
              </label>

              <label className="form-field">
                <span>Ciudad</span>
                <input
                  value={form.city}
                  onChange={(event) => updateField('city', event.target.value)}
                />
              </label>

              <label className="form-field">
                <span>Estado</span>
                <select
                  value={form.status}
                  onChange={(event) => updateField('status', event.target.value)}
                >
                  <option value="new">{getStatusLabel('new')}</option>
                  <option value="contacted">{getStatusLabel('contacted')}</option>
                  <option value="quoted">{getStatusLabel('quoted')}</option>
                  <option value="won">{getStatusLabel('won')}</option>
                  <option value="lost">{getStatusLabel('lost')}</option>
                </select>
              </label>

              <div className="form-actions">
                <button
                  type="submit"
                  className="primary-button"
                  disabled={isSaving}
                >
                  {isSaving ? 'Guardando cambios...' : 'Guardar cambios'}
                </button>
              </div>

              {saveError ? (
                <div className="cc-alert cc-alert--error">
                  <strong>No se pudo actualizar el lead</strong>
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
            <div className="lead-detail-grid">
              <div className="detail-row">
                <span className="detail-label">Código</span>
                <strong>{lead.display_code ?? lead.id}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Nombre</span>
                <strong>{lead.full_name}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Teléfono</span>
                <strong>{lead.phone}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Email</span>
                <strong>{lead.email ?? 'Sin email'}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Ciudad</span>
                <strong>{lead.city ?? 'Sin ciudad'}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Estado</span>
                <strong>{getDisplayStatusLabel(lead.status)}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Archivado</span>
                <strong>{lead.archived_at ? 'Sí' : 'No'}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Fecha de archivado</span>
                <strong>{lead.archived_at ? formatDateEs(lead.archived_at) : 'No archivado'}</strong>
              </div>
            </div>
          )}

          {!isEditing ? (
            <LeadDraftCards
              lead={lead}
              leadDraft={leadDraft}
              clients={clients}
              onWorkflowUpdated={onLeadConverted}
            />
          ) : null}

          <FeedbackDialog
            isOpen={!isEditing && Boolean(saveError)}
            tone="error"
            title="No se pudo completar la operacion"
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
        </div>
      ) : (
        <div className="empty-state">
          <strong>Ningún lead seleccionado</strong>
          <p>Haz clic en una tarjeta del listado para ver su detalle.</p>
        </div>
      )}
    </section>
  )
}
