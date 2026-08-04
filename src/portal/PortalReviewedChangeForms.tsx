import { useMemo, useRef, useState, type FormEvent } from 'react'
import { submitProfileChangeRequest, submitPropertyChangeRequest } from './portalReadApi'
import type {
  PortalProfileSnapshot,
  PortalPropertyDetail,
  PortalReviewedChangeRequestSummary,
} from './portalWorkspaceData'

interface PortalReviewedChangeFormsProps {
  clientId: string
  profile: PortalProfileSnapshot
  property: PortalPropertyDetail | null
  profileRequests: PortalReviewedChangeRequestSummary[]
  propertyRequests: PortalReviewedChangeRequestSummary[]
  isUnavailable: boolean
  onRefreshData?: () => void | Promise<void>
}

type SubmitState = 'idle' | 'submitting' | 'success' | 'error'

export function PortalReviewedChangeForms({
  clientId,
  profile,
  property,
  profileRequests,
  propertyRequests,
  isUnavailable,
  onRefreshData,
}: PortalReviewedChangeFormsProps) {
  return (
    <>
      <PortalProfileChangeForm
        clientId={clientId}
        profile={profile}
        requests={profileRequests}
        onRefreshData={onRefreshData}
        isUnavailable={isUnavailable}
      />
      <PortalPropertyChangeForm
        clientId={clientId}
        property={property}
        requests={propertyRequests}
        onRefreshData={onRefreshData}
        isUnavailable={isUnavailable}
      />
    </>
  )
}

export function PortalProfileChangeForm({
  clientId,
  profile,
  requests,
  onRefreshData,
  isUnavailable,
}: {
  clientId: string
  profile: PortalProfileSnapshot
  requests: PortalReviewedChangeRequestSummary[]
  onRefreshData?: () => void | Promise<void>
  isUnavailable: boolean
}) {
  const [draft, setDraft] = useState({
    fullName: profile.fullName,
    phone: profile.phone,
    email: profile.email,
    taxId: profile.taxId,
    billingAddress: profile.billingAddress,
  })
  const [state, setState] = useState<SubmitState>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<null | {
    reference: string
    status: string
    requestedAt: string
    changedFields: string[]
  }>(null)
  const idempotencyRef = useRef(crypto.randomUUID())
  const payloadFingerprintRef = useRef('')

  const changes = useMemo(() => buildChangePayload(profile, draft), [draft, profile])

  const hasChanges = Object.keys(changes).length > 0

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!hasChanges) {
      setState('error')
      setMessage('No hay cambios nuevos para enviar.')
      return
    }

    const fingerprint = fingerprintPayload(changes)
    if (payloadFingerprintRef.current !== fingerprint) {
      payloadFingerprintRef.current = fingerprint
      idempotencyRef.current = crypto.randomUUID()
    }

    setState('submitting')
    setMessage(null)

    try {
      const result = await submitProfileChangeRequest({
        clientId,
        changes,
        idempotencyKey: idempotencyRef.current,
      })
      setReceipt(result)
      setState('success')
      setMessage('Solicitud de perfil registrada para revisión.')
      await onRefreshData?.()
    } catch {
      setState('error')
      setMessage('No se pudo enviar la solicitud de perfil.')
    }
  }

  return (
    <section className="portal-form-section" aria-label="Cambio de perfil">
      <header className="portal-page__header portal-page__header--compact">
        <p className="portal-eyebrow">Perfil</p>
        <h2>Solicitud revisable de perfil</h2>
        <p>{isUnavailable ? 'La lectura segura todavía no está conectada.' : 'La revisión crea un recibo estable y no escribe directamente en el CRM.'}</p>
      </header>

      <form className="portal-form" onSubmit={handleSubmit}>
        <label className="portal-field">
          Nombre completo
          <input
            autoComplete="name"
            value={draft.fullName}
            onChange={(event) => {
              setDraft((current) => ({ ...current, fullName: event.target.value }))
              setState('idle')
            }}
          />
        </label>
        <label className="portal-field">
          Teléfono
          <input
            autoComplete="tel"
            inputMode="tel"
            value={draft.phone}
            onChange={(event) => {
              setDraft((current) => ({ ...current, phone: event.target.value }))
              setState('idle')
            }}
          />
        </label>
        <label className="portal-field">
          Email
          <input
            autoComplete="email"
            inputMode="email"
            value={draft.email}
            onChange={(event) => {
              setDraft((current) => ({ ...current, email: event.target.value }))
              setState('idle')
            }}
          />
        </label>
        <label className="portal-field">
          NIF/CIF
          <input
            autoComplete="off"
            value={draft.taxId}
            onChange={(event) => {
              setDraft((current) => ({ ...current, taxId: event.target.value }))
              setState('idle')
            }}
          />
        </label>
        <label className="portal-field">
          Dirección de facturación
          <input
            autoComplete="street-address"
            value={draft.billingAddress}
            onChange={(event) => {
              setDraft((current) => ({ ...current, billingAddress: event.target.value }))
              setState('idle')
            }}
          />
        </label>

        <div className="portal-stepflow__actions">
          <button className="portal-button portal-button--primary" type="submit" disabled={!hasChanges || state === 'submitting'}>
            {state === 'submitting' ? 'Enviando…' : 'Enviar revisión'}
          </button>
        </div>

        {message ? (
          <p className={`portal-form-result ${state === 'error' ? 'portal-form-result--error' : 'portal-form-result--success'}`}>
            {message}
          </p>
        ) : null}

        {receipt ? (
          <section className="portal-request-receipt" aria-label="Recibo de perfil">
            <h3>Recibo estable</h3>
            <dl className="portal-detail-list portal-detail-list--compact">
              <DetailRow label="Referencia" value={receipt.reference} />
              <DetailRow label="Estado" value={receipt.status} />
              <DetailRow label="Solicitud" value={formatDateTime(receipt.requestedAt)} />
              <DetailRow label="Campos" value={receipt.changedFields.join(' · ')} />
            </dl>
          </section>
        ) : null}
      </form>

      <section className="portal-request-history" aria-label="Solicitudes de perfil">
        <h3>Solicitudes recientes</h3>
        {requests.length > 0 ? (
          <div className="portal-record-list">
            {requests.map((request) => (
              <article key={request.reference} className="portal-record">
                <div>
                  <h4>{request.referenceLabel}</h4>
                  <p>{request.fieldSummaryLabel}</p>
                </div>
                <span className="portal-status portal-status--info">{request.statusLabel}</span>
              </article>
            ))}
          </div>
        ) : (
          <section className="portal-empty-state">
            <p>No hay solicitudes de perfil activas.</p>
          </section>
        )}
      </section>
    </section>
  )
}

export function PortalPropertyChangeForm({
  clientId,
  property,
  requests,
  onRefreshData,
  isUnavailable,
}: {
  clientId: string
  property: PortalPropertyDetail | null
  requests: PortalReviewedChangeRequestSummary[]
  onRefreshData?: () => void | Promise<void>
  isUnavailable: boolean
}) {
  const [draft, setDraft] = useState(() => ({
    name: property?.name ?? '',
    propertyType: property?.propertyType ?? '',
    address: property?.address ?? '',
    city: property?.city ?? '',
    postalCode: property?.postalCode ?? '',
  }))
  const [state, setState] = useState<SubmitState>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<null | {
    reference: string
    status: string
    requestedAt: string
    changedFields: string[]
  }>(null)
  const idempotencyRef = useRef(crypto.randomUUID())
  const payloadFingerprintRef = useRef('')

  const changes = useMemo(() => {
    if (!property) return {}
    return buildPropertyChangePayload(property, draft)
  }, [draft, property])

  const hasChanges = Object.keys(changes).length > 0

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!property) {
      setState('error')
      setMessage('Esta propiedad no está disponible.')
      return
    }
    if (!hasChanges) {
      setState('error')
      setMessage('No hay cambios nuevos para enviar.')
      return
    }

    const fingerprint = fingerprintPayload(changes)
    if (payloadFingerprintRef.current !== fingerprint) {
      payloadFingerprintRef.current = fingerprint
      idempotencyRef.current = crypto.randomUUID()
    }

    setState('submitting')
    setMessage(null)

    try {
      const result = await submitPropertyChangeRequest({
        clientId,
        propertyId: property.id,
        changes,
        idempotencyKey: idempotencyRef.current,
      })
      setReceipt(result)
      setState('success')
      setMessage('Solicitud de propiedad registrada para revisión.')
      await onRefreshData?.()
    } catch {
      setState('error')
      setMessage('No se pudo enviar la solicitud de propiedad.')
    }
  }

  if (!property) {
    return (
      <section className="portal-form-section" aria-label="Cambio de propiedad">
        <header className="portal-page__header portal-page__header--compact">
          <p className="portal-eyebrow">Propiedad</p>
          <h2>Esta propiedad no está disponible.</h2>
          <p>Vuelve al listado para elegir una referencia pública válida.</p>
        </header>
      </section>
    )
  }

  return (
    <section className="portal-form-section" aria-label="Cambio de propiedad">
      <header className="portal-page__header portal-page__header--compact">
        <p className="portal-eyebrow">Propiedad · {property.publicRefLabel}</p>
        <h2>Solicitud revisable de propiedad</h2>
        <p>{isUnavailable ? 'La lectura segura todavía no está conectada.' : 'La corrección usa la referencia pública y no expone IDs internos.'}</p>
      </header>

      <form className="portal-form" onSubmit={handleSubmit}>
        <label className="portal-field">
          Nombre
          <input
            autoComplete="off"
            value={draft.name}
            onChange={(event) => {
              setDraft((current) => ({ ...current, name: event.target.value }))
              setState('idle')
            }}
          />
        </label>
        <label className="portal-field">
          Tipo de propiedad
          <input
            autoComplete="off"
            value={draft.propertyType}
            onChange={(event) => {
              setDraft((current) => ({ ...current, propertyType: event.target.value }))
              setState('idle')
            }}
          />
        </label>
        <label className="portal-field">
          Dirección
          <input
            autoComplete="street-address"
            value={draft.address}
            onChange={(event) => {
              setDraft((current) => ({ ...current, address: event.target.value }))
              setState('idle')
            }}
          />
        </label>
        <label className="portal-field">
          Ciudad
          <input
            autoComplete="address-level2"
            value={draft.city}
            onChange={(event) => {
              setDraft((current) => ({ ...current, city: event.target.value }))
              setState('idle')
            }}
          />
        </label>
        <label className="portal-field">
          Código postal
          <input
            autoComplete="postal-code"
            inputMode="numeric"
            value={draft.postalCode}
            onChange={(event) => {
              setDraft((current) => ({ ...current, postalCode: event.target.value }))
              setState('idle')
            }}
          />
        </label>

        <div className="portal-stepflow__actions">
          <button className="portal-button portal-button--primary" type="submit" disabled={!hasChanges || state === 'submitting'}>
            {state === 'submitting' ? 'Enviando…' : 'Enviar revisión'}
          </button>
        </div>

        {message ? (
          <p className={`portal-form-result ${state === 'error' ? 'portal-form-result--error' : 'portal-form-result--success'}`}>
            {message}
          </p>
        ) : null}

        {receipt ? (
          <section className="portal-request-receipt" aria-label="Recibo de propiedad">
            <h3>Recibo estable</h3>
            <dl className="portal-detail-list portal-detail-list--compact">
              <DetailRow label="Referencia" value={receipt.reference} />
              <DetailRow label="Estado" value={receipt.status} />
              <DetailRow label="Solicitud" value={formatDateTime(receipt.requestedAt)} />
              <DetailRow label="Campos" value={receipt.changedFields.join(' · ')} />
            </dl>
          </section>
        ) : null}
      </form>

      <section className="portal-request-history" aria-label="Solicitudes de propiedad">
        <h3>Solicitudes recientes</h3>
        {requests.length > 0 ? (
          <div className="portal-record-list">
            {requests.map((request) => (
              <article key={request.reference} className="portal-record">
                <div>
                  <h4>{request.referenceLabel}</h4>
                  <p>{request.fieldSummaryLabel}</p>
                </div>
                <span className="portal-status portal-status--info">{request.statusLabel}</span>
              </article>
            ))}
          </div>
        ) : (
          <section className="portal-empty-state">
            <p>No hay solicitudes de propiedad activas.</p>
          </section>
        )}
      </section>
    </section>
  )
}

function buildChangePayload(
  profile: PortalProfileSnapshot,
  draft: {
    fullName: string
    phone: string
    email: string
    taxId: string
    billingAddress: string
  },
): Record<string, string> {
  const payload: Record<string, string> = {}

  if (normalizeText(draft.fullName) !== normalizeText(profile.fullName)) payload.fullName = draft.fullName.trim()
  if (normalizeText(draft.phone) !== normalizeText(profile.phone)) payload.phone = draft.phone.trim()
  if (normalizeText(draft.email) !== normalizeText(profile.email)) payload.email = draft.email.trim()
  if (normalizeText(draft.taxId) !== normalizeText(profile.taxId)) payload.taxId = draft.taxId.trim()
  if (normalizeText(draft.billingAddress) !== normalizeText(profile.billingAddress)) {
    payload.billingAddress = draft.billingAddress.trim()
  }

  return payload
}

function buildPropertyChangePayload(
  property: PortalPropertyDetail,
  draft: {
    name: string
    propertyType: string
    address: string
    city: string
    postalCode: string
  },
): Record<string, string> {
  const payload: Record<string, string> = {}

  if (normalizeText(draft.name) !== normalizeText(property.name)) payload.name = draft.name.trim()
  if (normalizeText(draft.propertyType) !== normalizeText(property.propertyType)) {
    payload.propertyType = draft.propertyType.trim()
  }
  if (normalizeText(draft.address) !== normalizeText(property.address)) payload.address = draft.address.trim()
  if (normalizeText(draft.city) !== normalizeText(property.city)) payload.city = draft.city.trim()
  if (normalizeText(draft.postalCode) !== normalizeText(property.postalCode)) {
    payload.postalCode = draft.postalCode.trim()
  }

  return payload
}

function fingerprintPayload(value: Record<string, string>): string {
  return JSON.stringify(Object.keys(value).sort().reduce<Record<string, string>>((acc, key) => {
    acc[key] = value[key]
    return acc
  }, {}))
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/gu, ' ')
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="portal-detail-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
