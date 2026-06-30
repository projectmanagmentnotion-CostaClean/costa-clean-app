import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { buildClientRelationshipSummary } from '../../app/entityIntegrity'
import {
  formatCurrency,
  formatDateEs,
  getDisplayStatusLabel,
  getPaymentMethodLabel,
  getPropertyTypeLabel,
  getServiceTypeLabel,
} from '../../app/displayFormat'
import { getStatusLabel } from '../../app/displayText'
import { formatClientLabel } from '../../app/relationshipLabels'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { FeedbackDialog } from '../../components/FeedbackDialog'
import type { InvoiceListItem } from '../invoices/types'
import type { JobListItem } from '../jobs/types'
import type { PaymentListItem } from '../payments/types'
import type { PropertyListItem } from '../properties/types'
import type { QuoteListItem } from '../quotes/types'
import { updateClientRecord } from './clientWriteApi'
import type { ClientListItem } from './types'

interface ClientDetailCardProps {
  client: ClientListItem | null
  properties: PropertyListItem[]
  jobs: JobListItem[]
  quotes: QuoteListItem[]
  invoices: InvoiceListItem[]
  payments: PaymentListItem[]
  onClientUpdated: () => Promise<void>
  hideHeaderActions?: boolean
  editRequestToken?: number
  archiveRequestToken?: number
  onEditingStateChange?: (isEditing: boolean) => void
}

interface EditFormState {
  full_name: string
  phone: string
  email: string
  tax_id: string
  billing_address: string
  status: string
}

function buildListKey(title: string, item: string) {
  return `${title}:${item}`
}

function renderRelationList(title: string, emptyLabel: string, items: string[]) {
  return (
    <section>
      <h4>{title}</h4>
      {items.length === 0 ? (
        <p>{emptyLabel}</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={buildListKey(title, item)}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function ClientDetailCard({
  client,
  properties,
  jobs,
  quotes,
  invoices,
  payments,
  onClientUpdated,
  hideHeaderActions = false,
  editRequestToken = 0,
  archiveRequestToken = 0,
  onEditingStateChange,
}: ClientDetailCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [pendingInactiveConfirmation, setPendingInactiveConfirmation] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [form, setForm] = useState<EditFormState>({
    full_name: '',
    phone: '',
    email: '',
    tax_id: '',
    billing_address: '',
    status: 'active',
  })

  useEffect(() => {
    if (!client) {
      setIsEditing(false)
      setSaveError(null)
      setSuccessMessage(null)
      setIsDirty(false)
      setForm({
        full_name: '',
        phone: '',
        email: '',
        tax_id: '',
        billing_address: '',
        status: 'active',
      })
      return
    }

    setIsEditing(false)
    setSaveError(null)
    setSuccessMessage(null)
    setIsDirty(false)
    setForm({
      full_name: client.full_name,
      phone: client.phone ?? '',
      email: client.email ?? '',
      tax_id: client.tax_id ?? '',
      billing_address: client.billing_address ?? '',
      status: client.status,
    })
  }, [client])

  useEffect(() => {
    onEditingStateChange?.(isDirty)
    return () => onEditingStateChange?.(false)
  }, [isDirty, onEditingStateChange])

  useEffect(() => {
    if (!client || editRequestToken === 0) return

    setIsEditing(true)
    setSaveError(null)
    setSuccessMessage(null)
    setForm({
      full_name: client.full_name,
      phone: client.phone ?? '',
      email: client.email ?? '',
      tax_id: client.tax_id ?? '',
      billing_address: client.billing_address ?? '',
      status: client.status,
    })
  }, [client, editRequestToken])

  useEffect(() => {
    if (!client || archiveRequestToken === 0 || client.status === 'inactive') return
    setPendingInactiveConfirmation(true)
  }, [archiveRequestToken, client])

  const relationshipSummary = useMemo(() => {
    if (!client) return null
    return buildClientRelationshipSummary(client.id, properties, jobs, quotes, invoices)
  }, [client, properties, jobs, quotes, invoices])

  const relatedProperties = useMemo(
    () => (client ? properties.filter((property) => property.client_id === client.id) : []),
    [client, properties],
  )
  const relatedJobs = useMemo(
    () => (client ? jobs.filter((job) => job.client_id === client.id) : []),
    [client, jobs],
  )
  const relatedQuotes = useMemo(
    () => (client ? quotes.filter((quote) => quote.client_id === client.id) : []),
    [client, quotes],
  )
  const relatedInvoices = useMemo(
    () => (client ? invoices.filter((invoice) => invoice.client_id === client.id) : []),
    [client, invoices],
  )
  const relatedPayments = useMemo(() => {
    const invoiceIds = new Set(relatedInvoices.map((invoice) => invoice.id))
    return payments.filter((payment) => invoiceIds.has(payment.invoice_id))
  }, [payments, relatedInvoices])

  const totalInvoiced = useMemo(
    () => relatedInvoices.reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0),
    [relatedInvoices],
  )
  const totalCollected = useMemo(
    () => relatedPayments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0),
    [relatedPayments],
  )

  function updateField<K extends keyof EditFormState>(
    field: K,
    value: EditFormState[K],
  ) {
    setIsDirty(true)
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
      await updateClientRecord(client.id, {
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        tax_id: form.tax_id.trim() || null,
        billing_address: form.billing_address.trim() || null,
        status: nextStatus,
      })
      await onClientUpdated()
      setSuccessMessage(
        nextStatus === 'inactive'
          ? 'Cliente archivado correctamente como inactivo.'
          : 'Cliente actualizado correctamente.',
      )
      setIsEditing(false)
      setIsDirty(false)
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

  if (!client) {
    return (
      <section className="data-section">
        <div className="section-header page-header-actions">
          <div>
            <h2>Detalle del cliente</h2>
          </div>
        </div>

        <div className="empty-state">
          <strong>Ningún cliente seleccionado</strong>
          <p>Haz clic en una tarjeta del listado para ver su detalle.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="data-section">
      <div className="section-header page-header-actions">
        <div>
          <h2>Detalle del cliente</h2>
        </div>

        {!hideHeaderActions ? (
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
                if (isEditing && isDirty) {
                  setShowDiscardConfirm(true)
                  return
                }

                setIsEditing((current) => !current)
                setSaveError(null)
                setSuccessMessage(null)
                setIsDirty(false)
                setForm({
                  full_name: client.full_name,
                  phone: client.phone ?? '',
                  email: client.email ?? '',
                  tax_id: client.tax_id ?? '',
                  billing_address: client.billing_address ?? '',
                  status: client.status,
                })
              }}
            >
              {isEditing ? 'Cancelar edición' : 'Editar cliente'}
            </button>
          </div>
        ) : null}
      </div>

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
              <span>Facturado / cobrado</span>
              <strong>{formatCurrency(totalInvoiced)}</strong>
              <small>{formatCurrency(totalCollected)} cobrados</small>
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
              <span>DNI/NIF/CIF</span>
              <input
                value={form.tax_id}
                onChange={(event) => updateField('tax_id', event.target.value)}
              />
            </label>

            <label className="form-field form-field-full">
              <span>Dirección fiscal</span>
              <textarea
                value={form.billing_address}
                onChange={(event) => updateField('billing_address', event.target.value)}
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
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  if (isDirty) {
                    setShowDiscardConfirm(true)
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
                <span className="detail-label">DNI/NIF/CIF</span>
                <strong>{client.tax_id ?? 'Sin dato fiscal'}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Dirección fiscal</span>
                <strong>{client.billing_address ?? 'Sin dirección fiscal'}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Estado</span>
                <strong>{getDisplayStatusLabel(client.status)}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Lead origen</span>
                <strong>{client.source_lead_id ?? 'Sin lead origen'}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Facturado</span>
                <strong>{formatCurrency(totalInvoiced)}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Cobrado</span>
                <strong>{formatCurrency(totalCollected)}</strong>
              </div>
            </div>

            {relationshipSummary ? (
              <div className="cc-alert cc-alert--info">
                <strong>Política operativa</strong>
                <p>
                  Este cliente tiene {relationshipSummary.propertiesCount} propiedad(es), {relationshipSummary.jobsCount} servicio(s),
                  {' '}{relationshipSummary.quotesCount} presupuesto(s) y {relationshipSummary.invoicesCount} factura(s). Para preservar
                  integridad relacional y trazabilidad financiera, el camino seguro es archivarlo como inactivo en lugar de borrarlo.
                </p>
              </div>
            ) : null}

            <div className="lead-detail-grid" style={{ marginTop: '1rem' }}>
              {renderRelationList(
                'Propiedades vinculadas',
                'Sin propiedades vinculadas.',
                relatedProperties.map((property) => `${property.display_code ?? property.id} · ${property.name} · ${getPropertyTypeLabel(property.property_type)}`),
              )}
              {renderRelationList(
                'Servicios',
                'Sin servicios vinculados.',
                relatedJobs.map((job) => `${job.display_code ?? job.id} · ${job.billing_concept ?? getServiceTypeLabel(job.service_type)} · ${formatDateEs(job.scheduled_date)}`),
              )}
              {renderRelationList(
                'Presupuestos',
                'Sin presupuestos vinculados.',
                relatedQuotes.map((quote) => `${quote.display_code ?? quote.id} · ${getStatusLabel(quote.status)} · ${formatCurrency(quote.total)}`),
              )}
              {renderRelationList(
                'Facturas',
                'Sin facturas vinculadas.',
                relatedInvoices.map((invoice) => `${invoice.invoice_number ?? invoice.display_code ?? invoice.id} · ${getStatusLabel(invoice.status)} · ${formatCurrency(invoice.total)}`),
              )}
              {renderRelationList(
                'Cobros',
                'Sin cobros registrados.',
                relatedPayments.map((payment) => `${payment.invoice_number ?? payment.invoice_display_code ?? payment.invoice_id} · ${formatDateEs(payment.payment_date)} · ${formatCurrency(payment.amount)} · ${getPaymentMethodLabel(payment.payment_method)}`),
              )}
            </div>
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

      <ConfirmDialog
        isOpen={showDiscardConfirm}
        title="Descartar cambios de cliente"
        description="Has modificado este cliente. Si cierras ahora, perderas los cambios no guardados."
        confirmLabel="Descartar cambios"
        tone="warning"
        isBusy={isSaving}
        onCancel={() => setShowDiscardConfirm(false)}
        onConfirm={() => {
          setShowDiscardConfirm(false)
          setIsEditing(false)
          setIsDirty(false)
        }}
      />

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
