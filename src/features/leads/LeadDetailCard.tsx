import { useEffect, useRef, useState, type FormEvent } from 'react'
import { getDisplayStatusLabel, formatDateEs } from '../../app/displayFormat'
import type { LeadListItem } from './types'

interface LeadDetailCardProps {
  lead: LeadListItem | null
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
    if (!lead) {
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
    if (!lead) {
      return
    }

    const isArchived = Boolean(lead.archived_at)

    await patchLead(
      {
        archived_at: isArchived ? null : new Date().toISOString(),
      },
      isArchived ? 'Lead restaurado correctamente.' : 'Lead archivado correctamente.',
    )
  }

  async function handleConvertToClient() {
    if (!lead) {
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
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseAnonKey) {
        setSaveError('Faltan las variables de entorno de Supabase.')
        return
      }

      const existingClientResponse = await fetch(
        `${supabaseUrl}/rest/v1/clients?select=id,full_name,source_lead_id&source_lead_id=eq.${encodeURIComponent(lead.id)}&limit=1`,
        {
          method: 'GET',
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
        },
      )

      if (!existingClientResponse.ok) {
        const errorText = await existingClientResponse.text()
        setSaveError(`REST ${existingClientResponse.status}: ${errorText || existingClientResponse.statusText}`)
        return
      }

      const existingClients = (await existingClientResponse.json()) as Array<{
        id: string
        full_name: string
        source_lead_id: string | null
      }>

      if (existingClients.length > 0) {
        const leadResponse = await fetch(
          `${supabaseUrl}/rest/v1/leads?id=eq.${encodeURIComponent(lead.id)}`,
          {
            method: 'PATCH',
            headers: {
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${supabaseAnonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              status: 'won',
            }),
          },
        )

        if (!leadResponse.ok) {
          const errorText = await leadResponse.text()
          setSaveError(`REST ${leadResponse.status}: ${errorText || leadResponse.statusText}`)
          return
        }

        await onLeadConverted()
        setSuccessMessage('Este lead ya tenía un cliente asociado. Se sincronizó como convertido.')
        setIsEditing(false)
        return
      }

      const clientId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? `CLIENT-${crypto.randomUUID()}`
          : `CLIENT-${Date.now()}`

      const clientResponse = await fetch(`${supabaseUrl}/rest/v1/clients`, {
        method: 'POST',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: clientId,
          full_name: lead.full_name,
          phone: lead.phone,
          email: lead.email,
          status: 'active',
          source_lead_id: lead.id,
        }),
      })

      if (!clientResponse.ok) {
        const errorText = await clientResponse.text()
        setSaveError(`REST ${clientResponse.status}: ${errorText || clientResponse.statusText}`)
        return
      }

      const leadResponse = await fetch(
        `${supabaseUrl}/rest/v1/leads?id=eq.${encodeURIComponent(lead.id)}`,
        {
          method: 'PATCH',
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'won',
          }),
        },
      )

      if (!leadResponse.ok) {
        const errorText = await leadResponse.text()
        setSaveError(`REST ${leadResponse.status}: ${errorText || leadResponse.statusText}`)
        return
      }

      await onLeadConverted()
      setSuccessMessage('Lead convertido a cliente correctamente.')
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
          <p>Vista inicial de detalle del lead seleccionado.</p>
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
                  <option value="new">new</option>
                  <option value="contacted">contacted</option>
                  <option value="quoted">quoted</option>
                  <option value="won">won</option>
                  <option value="lost">lost</option>
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
                <div className="empty-state">
                  <strong>No se pudo actualizar el lead</strong>
                  <p>{saveError}</p>
                </div>
              ) : null}

              {successMessage ? (
                <div className="empty-state">
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

          {!isEditing && saveError ? (
            <div className="empty-state">
              <strong>No se pudo completar la operación</strong>
              <p>{saveError}</p>
            </div>
          ) : null}

          {!isEditing && successMessage ? (
            <div className="empty-state">
              <strong>Operación correcta</strong>
              <p>{successMessage}</p>
            </div>
          ) : null}
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
