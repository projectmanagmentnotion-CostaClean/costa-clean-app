import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { buildPropertyRelationshipSummary } from '../../app/entityIntegrity'
import { getPropertyTypeLabel } from '../../app/displayFormat'
import { formatClientLabel, formatPropertyLabel } from '../../app/relationshipLabels'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import type { ClientListItem } from '../clients/types'
import type { InvoiceListItem } from '../invoices/types'
import type { JobListItem } from '../jobs/types'
import type { QuoteListItem } from '../quotes/types'
import type { PropertyListItem } from './types'

interface PropertyDetailCardProps {
  property: PropertyListItem | null
  clients: ClientListItem[]
  jobs: JobListItem[]
  quotes: QuoteListItem[]
  invoices: InvoiceListItem[]
  onPropertyUpdated: () => Promise<void>
}

interface EditFormState {
  client_id: string
  name: string
  property_type: string
  address: string
  city: string
  postal_code: string
  notes: string
}

function getPropertyTypeOptionLabel(value: string): string {
  switch (value) {
    case 'apartment': return 'Apartamento'
    case 'house': return 'Casa'
    case 'office': return 'Oficina'
    case 'local': return 'Local'
    case 'tourist_apartment': return 'Piso turístico'
    case 'community': return 'Comunidad'
    case 'construction_site': return 'Obra'
    default: return value
  }
}

export function PropertyDetailCard({
  property,
  clients,
  jobs,
  quotes,
  invoices,
  onPropertyUpdated,
}: PropertyDetailCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [pendingClientReassignment, setPendingClientReassignment] = useState(false)
  const [form, setForm] = useState<EditFormState>({
    client_id: '',
    name: '',
    property_type: 'apartment',
    address: '',
    city: '',
    postal_code: '',
    notes: '',
  })

  useEffect(() => {
    if (!property) {
      setIsEditing(false)
      setSaveError(null)
      setSuccessMessage(null)
      setForm({
        client_id: '',
        name: '',
        property_type: 'apartment',
        address: '',
        city: '',
        postal_code: '',
        notes: '',
      })
      return
    }

    setIsEditing(false)
    setSaveError(null)
    setSuccessMessage(null)
    setForm({
      client_id: property.client_id,
      name: property.name,
      property_type: property.property_type,
      address: property.address,
      city: property.city ?? '',
      postal_code: property.postal_code ?? '',
      notes: property.notes ?? '',
    })
  }, [property])

  const relationshipSummary = useMemo(() => {
    if (!property) return null
    return buildPropertyRelationshipSummary(property.id, jobs, quotes, invoices)
  }, [property, jobs, quotes, invoices])

  const previousClient = useMemo(
    () => property ? clients.find((client) => client.id === property.client_id) ?? null : null,
    [clients, property],
  )
  const nextClient = useMemo(
    () => clients.find((client) => client.id === form.client_id) ?? null,
    [clients, form.client_id],
  )

  function updateField<K extends keyof EditFormState>(
    field: K,
    value: EditFormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function persistProperty() {
    if (!property) return

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

      if (form.client_id !== property.client_id) {
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/reassign_property_client`, {
          method: 'POST',
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            p_property_id: property.id,
            p_client_id: form.client_id,
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          setSaveError(`REST ${response.status}: ${errorText || response.statusText}`)
          return
        }
      }

      const response = await fetch(
        `${supabaseUrl}/rest/v1/properties?id=eq.${encodeURIComponent(property.id)}`,
        {
          method: 'PATCH',
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: form.client_id,
            name: form.name.trim(),
            property_type: form.property_type,
            address: form.address.trim(),
            city: form.city.trim() || null,
            postal_code: form.postal_code.trim() || null,
            notes: form.notes.trim() || null,
          }),
        },
      )

      if (!response.ok) {
        const errorText = await response.text()
        setSaveError(`REST ${response.status}: ${errorText || response.statusText}`)
        return
      }

      await onPropertyUpdated()
      setSuccessMessage(
        form.client_id !== property.client_id
          ? 'Propiedad reasignada y actualizada correctamente.'
          : 'Propiedad actualizada correctamente.',
      )
      setIsEditing(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido actualizando la propiedad.'
      setSaveError(message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (property && form.client_id !== property.client_id) {
      setPendingClientReassignment(true)
      return
    }

    await persistProperty()
  }

  return (
    <section className="data-section">
      <div className="section-header page-header-actions">
        <div>
          <h2>Detalle de la propiedad</h2>
        </div>

        {property ? (
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setIsEditing((current) => !current)
              setSaveError(null)
              setSuccessMessage(null)
              setForm({
                client_id: property.client_id,
                name: property.name,
                property_type: property.property_type,
                address: property.address,
                city: property.city ?? '',
                postal_code: property.postal_code ?? '',
                notes: property.notes ?? '',
              })
            }}
          >
            {isEditing ? 'Cancelar edición' : 'Editar propiedad'}
          </button>
        ) : null}
      </div>

      {property ? (
        <div className="lead-detail-card">
          <div className="lead-detail-header">
            <div>
              <h3>{formatPropertyLabel(property)}</h3>
              <p>{property.address}</p>
            </div>

            <span className="lead-badge">{getPropertyTypeLabel(property.property_type)}</span>
          </div>

          {!isEditing && relationshipSummary ? (
            <div className="cc-detail-panel__summary">
              <div className="cc-detail-panel__summary-card">
                <span>Servicios</span>
                <strong>{relationshipSummary.jobsCount}</strong>
                <small>{relationshipSummary.activeJobsCount} activo(s)</small>
              </div>
              <div className="cc-detail-panel__summary-card">
                <span>Presupuestos</span>
                <strong>{relationshipSummary.quotesCount}</strong>
                <small>{relationshipSummary.openQuotesCount} abierto(s)</small>
              </div>
              <div className="cc-detail-panel__summary-card">
                <span>Facturas</span>
                <strong>{relationshipSummary.invoicesCount}</strong>
                <small>Histórico protegido</small>
              </div>
            </div>
          ) : null}

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
                <span>Nombre *</span>
                <input
                  value={form.name}
                  onChange={(event) => updateField('name', event.target.value)}
                  required
                />
              </label>

              <label className="form-field">
                <span>Tipo *</span>
                <select
                  value={form.property_type}
                  onChange={(event) => updateField('property_type', event.target.value)}
                >
                  <option value="apartment">{getPropertyTypeOptionLabel('apartment')}</option>
                  <option value="house">{getPropertyTypeOptionLabel('house')}</option>
                  <option value="office">{getPropertyTypeOptionLabel('office')}</option>
                  <option value="local">{getPropertyTypeOptionLabel('local')}</option>
                  <option value="tourist_apartment">{getPropertyTypeOptionLabel('tourist_apartment')}</option>
                  <option value="community">{getPropertyTypeOptionLabel('community')}</option>
                  <option value="construction_site">{getPropertyTypeOptionLabel('construction_site')}</option>
                </select>
              </label>

              <label className="form-field form-field-full">
                <span>Dirección *</span>
                <input
                  value={form.address}
                  onChange={(event) => updateField('address', event.target.value)}
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
                <span>Código postal</span>
                <input
                  value={form.postal_code}
                  onChange={(event) => updateField('postal_code', event.target.value)}
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
                  <strong>No se pudo actualizar la propiedad</strong>
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
                  <span className="detail-label">Propiedad</span>
                  <strong>{formatPropertyLabel(property)}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Dirección</span>
                  <strong>{property.address}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Tipo</span>
                  <strong>{getPropertyTypeLabel(property.property_type)}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Ciudad</span>
                  <strong>{property.city ?? 'Sin ciudad'}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Código postal</span>
                  <strong>{property.postal_code ?? 'Sin código postal'}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Cliente</span>
                  <strong>{formatClientLabel(property)}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Código interno</span>
                  <strong>{property.display_code ?? property.id}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Notas</span>
                  <strong>{property.notes ?? 'Sin notas'}</strong>
                </div>
              </div>

              {relationshipSummary ? (
                <div className="cc-alert cc-alert--info">
                  <strong>Política operativa</strong>
                  <p>
                    Los servicios completados, presupuestos aceptados y facturas vinculadas se mantienen como histórico.
                    La reasignación de cliente solo reorienta la propiedad y realinea servicios/presupuestos abiertos para
                    no romper la integridad relacional ni el histórico financiero.
                  </p>
                </div>
              ) : null}
            </>
          )}

          {!isEditing && saveError ? (
            <div className="cc-alert cc-alert--error">
              <strong>No se pudo actualizar la propiedad</strong>
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
          <strong>Ninguna propiedad seleccionada</strong>
          <p>Haz clic en una tarjeta del listado para ver su detalle.</p>
        </div>
      )}

      <ConfirmDialog
        isOpen={pendingClientReassignment}
        title="Reasignar propiedad a otro cliente"
        description={
          property && relationshipSummary
            ? `La propiedad pasará de ${formatClientLabel(previousClient ?? property)} a ${formatClientLabel(nextClient ?? { id: form.client_id })}. Se realinearán ${relationshipSummary.activeJobsCount} servicio(s) activo(s) y ${relationshipSummary.openQuotesCount} presupuesto(s) abierto(s). El histórico completado o facturado se mantendrá sin alterarse.`
            : 'La propiedad cambiará de cliente y se preservará el histórico relacionado.'
        }
        confirmLabel="Sí, reasignar propiedad"
        tone="warning"
        isBusy={isSaving}
        onCancel={() => setPendingClientReassignment(false)}
        onConfirm={() => {
          setPendingClientReassignment(false)
          void persistProperty()
        }}
      />
    </section>
  )
}
