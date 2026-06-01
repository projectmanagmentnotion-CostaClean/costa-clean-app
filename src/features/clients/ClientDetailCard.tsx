import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { buildClientRelationshipSummary } from '../../app/entityIntegrity'
import { getDisplayStatusLabel } from '../../app/displayFormat'
import { getStatusLabel } from '../../app/displayText'
import { formatClientLabel } from '../../app/relationshipLabels'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { FeedbackDialog } from '../../components/FeedbackDialog'
import type { InvoiceListItem } from '../invoices/types'
import type { JobListItem } from '../jobs/types'
import type { PropertyListItem } from '../properties/types'
import type { QuoteListItem } from '../quotes/types'
import type { ClientListItem } from './types'

interface ClientDetailCardProps {
  client: ClientListItem | null
  properties: PropertyListItem[]
  jobs: JobListItem[]
  quotes: QuoteListItem[]
  invoices: InvoiceListItem[]
  onClientUpdated: () => Promise<void>
}

interface EditFormState {
  full_name: string
  phone: string
  email: string
  status: string
}

export function ClientDetailCard({
  client,
  properties,
  jobs,
  quotes,
  invoices,
  onClientUpdated,
}: ClientDetailCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [pendingInactiveConfirmation, setPendingInactiveConfirmation] = useState(false)
  const [form, setForm] = useState<EditFormState>({
    full_name: '',
    phone: '',
    email: '',
    status: 'active',
  })

  useEffect(() => {
    if (!client) {
      setIsEditing(false)
      setSaveError(null)
      setSuccessMessage(null)
      setForm({
        full_name: '',
        phone: '',
        email: '',
        status: 'active',
      })
      return
    }

    setIsEditing(false)
    setSaveError(null)
    setSuccessMessage(null)
    setForm({
      full_name: client.full_name,
      phone: client.phone ?? '',
      email: client.email ?? '',
      status: client.status,
    })
  }, [client])

  const relationshipSummary = useMemo(() => {
    if (!client) return null
    return buildClientRelationshipSummary(client.id, properties, jobs, quotes, invoices)
  }, [client, properties, jobs, quotes, invoices])

  function updateField<K extends keyof EditFormState>(
    field: K,
    value: EditFormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function persistClient(nextStatus: string) {
    if (!client) return

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
        `${supabaseUrl}/rest/v1/clients?id=eq.${encodeURIComponent(client.id)}`,
        {
          method: 'PATCH',
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            full_name: form.full_name.trim(),
            phone: form.phone.trim() || null,
            email: form.email.trim() || null,
            status: nextStatus,
          }),
        },
      )

      if (!response.ok) {
        const errorText = await response.text()
        setSaveError(`REST ${response.status}: ${errorText || response.statusText}`)
        return
      }

      await onClientUpdated()
      setSuccessMessage(
        nextStatus === 'inactive'
          ? 'Cliente archivado correctamente como inactivo.'
          : 'Cliente actualizado correctamente.',
      )
      setIsEditing(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido actualizando el cliente.'
      setSaveError(message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (form.status === 'inactive' && client?.status !== 'inactive') {
      setPendingInactiveConfirmation(true)
      return
    }

    await persistClient(form.status)
  }

  const relationshipNotes = relationshipSummary
    ? [
        `${relationshipSummary.propertiesCount} propiedad(es)`,
        `${relationshipSummary.jobsCount} servicio(s)`,
        `${relationshipSummary.quotesCount} presupuesto(s)`,
        `${relationshipSummary.invoicesCount} factura(s)`,
      ].join(' · ')
    : null

  return (
    <section className="data-section">
      <div className="section-header page-header-actions">
        <div>
          <h2>Detalle del cliente</h2>
        </div>

        {client ? (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {client.status !== 'inactive' ? (
              <button
                type="button"
                className="secondary-button"
                onClick={() => setPendingInactiveConfirmation(true)}
              >
                Archivar cliente
              </button>
            ) : null}

            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setIsEditing((current) => !current)
                setSaveError(null)
                setSuccessMessage(null)
                setForm({
                  full_name: client.full_name,
                  phone: client.phone ?? '',
                  email: client.email ?? '',
                  status: client.status,
                })
              }}
            >
              {isEditing ? 'Cancelar edición' : 'Editar cliente'}
            </button>
          </div>
        ) : null}
      </div>

      {client ? (
        <div className="lead-detail-card">
          <div className="lead-detail-header">
            <div>
              <h3>{formatClientLabel(client)}</h3>
              <p>{relationshipNotes ?? 'Sin relaciones registradas'}</p>
            </div>

            <span className="lead-badge">{getDisplayStatusLabel(client.status)}</span>
          </div>

          {!isEditing && relationshipSummary ? (
            <div className="cc-detail-panel__summary">
              <div className="cc-detail-panel__summary-card">
                <span>Propiedades</span>
                <strong>{relationshipSummary.propertiesCount}</strong>
                <small>{relationshipSummary.activeJobsCount} servicio(s) activos</small>
              </div>
              <div className="cc-detail-panel__summary-card">
                <span>Presupuestos</span>
                <strong>{relationshipSummary.quotesCount}</strong>
                <small>{relationshipSummary.acceptedQuotesCount} aceptado(s)</small>
              </div>
              <div className="cc-detail-panel__summary-card">
                <span>Facturas</span>
                <strong>{relationshipSummary.invoicesCount}</strong>
                <small>Borrado físico no recomendado</small>
              </div>
            </div>
          ) : null}

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
                <span>Teléfono</span>
                <input
                  value={form.phone}
                  onChange={(event) => updateField('phone', event.target.value)}
                />
              </label>

              <label className="form-field">
                <span>Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
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
                  <strong>No se pudo actualizar el cliente</strong>
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
              <div className="lead-detail-grid">
                <div className="detail-row">
                  <span className="detail-label">Cliente</span>
                  <strong>{formatClientLabel(client)}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Código interno</span>
                  <strong>{client.display_code ?? client.id}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Teléfono</span>
                  <strong>{client.phone ?? 'Sin teléfono'}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Email</span>
                  <strong>{client.email ?? 'Sin email'}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Estado</span>
                  <strong>{getDisplayStatusLabel(client.status)}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Lead origen</span>
                  <strong>{client.source_lead_id ?? 'Sin lead origen'}</strong>
                </div>
              </div>

              {relationshipSummary ? (
                <div className="cc-alert cc-alert--info">
                  <strong>Política operativa</strong>
                  <p>
                    Este cliente tiene {relationshipSummary.propertiesCount} propiedad(es), {relationshipSummary.jobsCount} servicio(s),
                    {relationshipSummary.quotesCount} presupuesto(s) y {relationshipSummary.invoicesCount} factura(s). Para preservar
                    integridad relacional y trazabilidad financiera, el camino seguro es archivarlo como inactivo en lugar de borrarlo.
                  </p>
                </div>
              ) : null}
            </>
          )}

          <FeedbackDialog
            isOpen={!isEditing && Boolean(saveError)}
            tone="error"
            title="No se pudo actualizar el cliente"
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
          <strong>Ningún cliente seleccionado</strong>
          <p>Haz clic en una tarjeta del listado para ver su detalle.</p>
        </div>
      )}

      <ConfirmDialog
        isOpen={pendingInactiveConfirmation}
        title="Archivar cliente"
        description={
          relationshipSummary
            ? `Se dejará el cliente como inactivo. Mantendrá ${relationshipSummary.propertiesCount} propiedad(es), ${relationshipSummary.jobsCount} servicio(s), ${relationshipSummary.quotesCount} presupuesto(s) y ${relationshipSummary.invoicesCount} factura(s) sin romper relaciones históricas.`
            : 'Se dejará el cliente como inactivo para evitar un borrado riesgoso.'
        }
        confirmLabel="Sí, archivar cliente"
        tone="warning"
        isBusy={isSaving}
        onCancel={() => setPendingInactiveConfirmation(false)}
        onConfirm={() => {
          setPendingInactiveConfirmation(false)
          void persistClient('inactive')
        }}
      />
    </section>
  )
}
