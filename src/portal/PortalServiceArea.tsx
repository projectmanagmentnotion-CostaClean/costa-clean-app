import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import type {
  PortalServiceRequestReceipt,
  PortalServiceRequestSummary,
  PortalServiceSummary,
} from './contracts'
import type { PortalFoundationData } from './portalWorkspaceData'
import {
  cancelServiceRequest,
  submitServiceRequest,
} from './portalReadApi'
import {
  getPortalServicePath,
  getPortalServiceRequestNewPath,
  getPortalServiceRequestPath,
  getPortalServiceRequestsPath,
  resolvePortalServiceRoute,
  resolvePortalServiceRequestRoute,
} from './portalNavigation'

type ServiceRequestStep = 'property' | 'service' | 'date' | 'details' | 'review' | 'success'

const serviceTypeOptions = [
  { value: 'regular_cleaning', label: 'Limpieza regular', hint: 'Mantenimiento periódico y estándar.' },
  { value: 'deep_cleaning', label: 'Limpieza profunda', hint: 'Más detalle en zonas con mayor carga.' },
  { value: 'move_cleaning', label: 'Limpieza por mudanza', hint: 'Para entrada o salida de vivienda.' },
  { value: 'commercial_cleaning', label: 'Limpieza comercial', hint: 'Espacios profesionales y locales.' },
  { value: 'other', label: 'Otro servicio', hint: 'Cuando la solicitud no encaja en las opciones anteriores.' },
] as const

const timeWindowOptions = [
  { value: 'morning', label: 'Mañana' },
  { value: 'afternoon', label: 'Tarde' },
  { value: 'flexible', label: 'Flexible' },
] as const

interface PortalServicesPageProps {
  pathname: string
  data: PortalFoundationData
  getHref: (page: 'services' | 'service-requests' | 'properties' | 'home') => string
  onRefreshData?: () => void | Promise<void>
}

interface PortalServiceRequestsPageProps {
  pathname: string
  data: PortalFoundationData
  getHref: (page: 'service-requests' | 'services' | 'home' | 'properties') => string
  onRefreshData?: () => void | Promise<void>
}

export function PortalServicesPage({
  pathname,
  data,
  getHref,
}: PortalServicesPageProps) {
  const route = resolvePortalServiceRoute(pathname)
  const service = route
    ? data.services.find((item) => item.reference === route.serviceRef) ?? null
    : null

  if (route && !service) {
    return (
      <PortalPageFrame
        eyebrow="Servicios"
        title="Servicio no disponible"
        description="No mostramos referencias internas ni servicios de otra cuenta."
      >
        <section className="portal-empty-state">
          <p>No encontramos un servicio público con esa referencia.</p>
          <a className="portal-button portal-button--primary" href={getHref('services')}>
            Volver a servicios
          </a>
        </section>
      </PortalPageFrame>
    )
  }

  if (service) {
    return (
      <PortalPageFrame
        eyebrow="Servicios"
        title="Detalle del servicio"
        description="Consulta segura de un servicio real sin exponer IDs internos del CRM."
      >
        <section className="portal-service-detail">
          <div className="portal-decision-block portal-decision-block--compact">
            <div>
              <span className="portal-decision-block__label">Referencia pública</span>
              <h2>{service.referenceLabel}</h2>
              <p>{service.serviceTypeLabel} · {service.propertyLabel}</p>
            </div>
            <span className="portal-status portal-status--info">{service.statusLabel}</span>
          </div>

          <section className="portal-detail-list portal-detail-list--compact" aria-label="Datos del servicio">
            <PortalDetailRow label="Propiedad" value={service.propertyLabel} />
            <PortalDetailRow label="Referencia propiedad" value={service.propertyPublicRef} />
            <PortalDetailRow label="Dirección" value={service.propertyAddressLabel} />
            <PortalDetailRow label="Tipo" value={service.serviceTypeLabel} />
            <PortalDetailRow label="Fecha" value={service.scheduleLabel} />
            <PortalDetailRow label="Estado" value={service.statusLabel} />
          </section>

          <div className="portal-inline-actions">
            <a className="portal-button portal-button--secondary" href={getHref('services')}>
              Volver a la lista
            </a>
            <a className="portal-button portal-button--primary" href={getHref('service-requests')}>
              Ver solicitudes
            </a>
          </div>
        </section>
      </PortalPageFrame>
    )
  }

  const [upcomingServices, previousServices] = partitionServices(data.services)

  return (
    <PortalPageFrame
      eyebrow="Servicios"
      title="Servicios"
      description="Listado real, compacto y orientado a la próxima decisión."
    >
      <section className="portal-decision-block">
        <div>
          <span className="portal-decision-block__label">Próximo servicio</span>
          <h2>{data.dashboard.nextServiceLabel}</h2>
          <p>Solo mostramos referencias públicas, fecha y estado. No hay botones administrativos.</p>
        </div>
        <div className="portal-inline-actions">
          <a className="portal-button portal-button--secondary" href={getHref('service-requests')}>
            Ver solicitudes
          </a>
          <a className="portal-button portal-button--primary" href={withCurrentSearch(getPortalServiceRequestNewPath('property'))}>
            Solicitar servicio
          </a>
        </div>
      </section>

      <section className="portal-service-columns">
        <PortalServiceListSection
          title="Próximos servicios"
          emptyMessage="No hay próximos servicios confirmados."
          services={upcomingServices}
          detailHref={(serviceRef) => getPortalServicePath(serviceRef)}
        />
        <PortalServiceListSection
          title="Servicios anteriores"
          emptyMessage="No hay servicios anteriores visibles."
          services={previousServices}
          detailHref={(serviceRef) => getPortalServicePath(serviceRef)}
        />
      </section>
    </PortalPageFrame>
  )
}

export function PortalServiceRequestsPage({
  pathname,
  data,
  getHref,
  onRefreshData,
}: PortalServiceRequestsPageProps) {
  const route = resolvePortalServiceRequestRoute(pathname)

  if (route?.step) {
    return (
      <PortalPageFrame
        eyebrow="Solicitudes"
        title="Nueva solicitud de servicio"
        description="StepFlow real para pedir un servicio sin comprometer fecha, precio ni asignación."
      >
        <PortalServiceRequestFlow
          clientId={data.account.clientContextId}
          pathname={pathname}
          properties={data.properties.filter((property) => property.status === 'active')}
          requestHistory={data.requests}
          onRefreshData={onRefreshData}
        />
      </PortalPageFrame>
    )
  }

  const request = route?.reference
    ? data.requests.find((item) => item.reference === route.reference) ?? null
    : null

  if (route?.reference && !request) {
    return (
      <PortalPageFrame
        eyebrow="Solicitudes"
        title="Solicitud no disponible"
        description="No mostramos referencias internas ni solicitudes ajenas."
      >
        <section className="portal-empty-state">
          <p>No encontramos una solicitud pública con esa referencia.</p>
          <a className="portal-button portal-button--primary" href={getHref('service-requests')}>
            Volver a solicitudes
          </a>
        </section>
      </PortalPageFrame>
    )
  }

  if (request) {
    return (
      <PortalPageFrame
        eyebrow="Solicitudes"
        title="Detalle de la solicitud"
        description="Detalle público, seguro y con cancelación solo cuando el contrato lo permite."
      >
        <PortalServiceRequestDetail
          request={request}
          clientId={data.account.clientContextId}
          getHref={getHref}
          onRefreshData={onRefreshData}
        />
      </PortalPageFrame>
    )
  }

  return (
    <PortalPageFrame
      eyebrow="Solicitudes"
      title="Solicitudes de servicio"
      description="Historial seguro de solicitudes de servicio reales, con acceso al alta nueva."
    >
      <section className="portal-decision-block">
        <div>
          <span className="portal-decision-block__label">Alta nueva</span>
          <h2>Pedir un servicio</h2>
          <p>La disponibilidad la confirma Costa Clean. La solicitud no reserva fecha ni precio.</p>
        </div>
        <div className="portal-inline-actions">
          <a className="portal-button portal-button--secondary" href={getHref('services')}>
            Ver servicios
          </a>
          <a className="portal-button portal-button--primary" href={withCurrentSearch(getPortalServiceRequestNewPath('property'))}>
            Nueva solicitud
          </a>
        </div>
      </section>

      <PortalServiceRequestList
        requests={data.requests}
        emptyMessage="No hay solicitudes activas para esta cuenta."
      />
    </PortalPageFrame>
  )
}

function PortalServiceRequestFlow({
  clientId,
  pathname,
  properties,
  requestHistory,
  onRefreshData,
}: {
  clientId: string
  pathname: string
  properties: PortalFoundationData['properties']
  requestHistory: PortalServiceRequestSummary[]
  onRefreshData?: () => void | Promise<void>
}) {
  const route = resolvePortalServiceRequestRoute(pathname)
  const step: ServiceRequestStep = route?.step ?? 'property'
  const storageKey = useMemo(() => `portal:service-request:${clientId}`, [clientId])
  const [intent, setIntent] = useState(() => readStoredServiceRequestIntent(storageKey))
  const [state, setState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(intent.receipt ? 'Solicitud registrada para revisión.' : null)
  const [errorKind, setErrorKind] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(storageKey, JSON.stringify(intent))
  }, [intent, storageKey])

  const effectivePropertyPublicRef = intent.propertyPublicRef || properties[0]?.publicRef || ''
  const selectedProperty = properties.find((property) => property.publicRef === effectivePropertyPublicRef) ?? null
  const selectedService = serviceTypeOptions.find((option) => option.value === intent.serviceType) ?? null
  const canReview = Boolean(selectedProperty && selectedService && intent.preferredDate)

  function goTo(stepTarget: ServiceRequestStep) {
    window.location.assign(withCurrentSearch(getPortalServiceRequestNewPath(stepTarget)))
  }

  function updateIntent(patch: Partial<typeof intent>) {
    setIntent((current) => ({ ...current, ...patch }))
    setMessage(null)
    setErrorKind(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedProperty) {
      setState('error')
      setErrorKind('validation')
      setMessage('Selecciona una propiedad antes de continuar.')
      return
    }
    if (!selectedService) {
      setState('error')
      setErrorKind('validation')
      setMessage('Selecciona un tipo de servicio antes de continuar.')
      return
    }
    if (!intent.preferredDate) {
      setState('error')
      setErrorKind('validation')
      setMessage('Selecciona una fecha preferida.')
      return
    }

    setState('submitting')
    setMessage(null)
    setErrorKind(null)

    try {
      const receipt = await submitServiceRequest({
        clientId,
        propertyPublicRef: selectedProperty.publicRef,
        serviceType: selectedService.value,
        preferredDate: intent.preferredDate,
        preferredTimeWindow: intent.preferredTimeWindow,
        notes: intent.details,
        idempotencyKey: intent.idempotencyKey,
      })

      const nextIntent = {
        ...intent,
        receipt,
      }
      setIntent(nextIntent)
      setState('success')
      setMessage('Solicitud registrada para revisión.')
      await onRefreshData?.()
      window.location.assign(withCurrentSearch(getPortalServiceRequestNewPath('success')))
    } catch (error) {
      const classified = classifyServiceRequestError(error)
      setState('error')
      setErrorKind(classified.kind)
      setMessage(classified.message)
    }
  }

  if (step === 'success') {
    return (
      <section className="portal-service-flow">
        {intent.receipt ? (
          <section className="portal-service-receipt">
            <span className="portal-status portal-status--success">Solicitud enviada</span>
            <h3>{intent.receipt.reference}</h3>
            <p>{intent.receipt.status}</p>
            <dl className="portal-detail-list portal-detail-list--compact">
              <PortalDetailRow label="Propiedad" value={intent.receipt.propertyLabel} />
              <PortalDetailRow label="Tipo" value={intent.receipt.serviceTypeLabel} />
              <PortalDetailRow label="Fecha preferida" value={intent.receipt.preferredDateLabel} />
              <PortalDetailRow label="Franja" value={intent.receipt.preferredTimeWindowLabel} />
              <PortalDetailRow label="Solicitada" value={formatDateTime(intent.receipt.requestedAt)} />
            </dl>
            <a className="portal-button portal-button--primary" href={withCurrentSearch(getPortalServiceRequestPath(intent.receipt.reference))}>
              Ver detalle
            </a>
          </section>
        ) : (
          <section className="portal-empty-state">
            <p>No encontramos un recibo para esta solicitud.</p>
            <a className="portal-button portal-button--primary" href={withCurrentSearch(getPortalServiceRequestNewPath('property'))}>
              Volver al inicio
            </a>
          </section>
        )}
      </section>
    )
  }

  return (
    <section className="portal-service-flow" aria-label="Nueva solicitud de servicio">
      <ol className="portal-stepflow__steps portal-stepflow__steps--service" aria-label="Pasos de la solicitud">
        {serviceRequestSteps.map((flowStep, index) => (
          <li key={flowStep} className="portal-stepflow__step-item">
            <a
              href={withCurrentSearch(getPortalServiceRequestNewPath(flowStep))}
              className={flowStep === step ? 'portal-stepflow__step is-active' : 'portal-stepflow__step'}
              aria-current={flowStep === step ? 'step' : undefined}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              {serviceRequestStepLabels[flowStep]}
            </a>
          </li>
        ))}
      </ol>

      <section className="portal-stepflow__surface">
        <div className="portal-stepflow__surface-header">
          <p className="portal-eyebrow">Paso {serviceRequestStepLabels[step]}</p>
          <h3>{serviceRequestStepTitles[step]}</h3>
        </div>

        {step === 'property' ? (
          <section className="portal-change-step">
            <p>Elige una propiedad autorizada para esta cuenta.</p>
            {properties.length > 0 ? (
              <div className="portal-change-checklist portal-change-checklist--cards">
                {properties.map((property) => {
                  const checked = property.publicRef === intent.propertyPublicRef
                  return (
                    <label key={property.publicRef} className="portal-change-checklist__item portal-service-choice">
                      <input
                        type="radio"
                        name="service-property"
                        checked={checked}
                        onChange={() => updateIntent({ propertyPublicRef: property.publicRef })}
                      />
                      <span>
                        <strong>{property.displayName}</strong>
                        <small>{property.addressLabel}</small>
                      </span>
                    </label>
                  )
                })}
              </div>
            ) : (
              <section className="portal-empty-state">
                <p>No hay propiedades activas disponibles para pedir un servicio.</p>
              </section>
            )}
          </section>
        ) : null}

        {step === 'service' ? (
          <section className="portal-change-step">
            <p>Selecciona el tipo de servicio que necesitas.</p>
            <div className="portal-service-option-grid">
              {serviceTypeOptions.map((option) => {
                const checked = option.value === intent.serviceType
                return (
                  <label key={option.value} className={checked ? 'portal-service-option is-active' : 'portal-service-option'}>
                    <input
                      type="radio"
                      name="service-type"
                      checked={checked}
                      onChange={() => updateIntent({ serviceType: option.value })}
                    />
                    <span>
                      <strong>{option.label}</strong>
                      <small>{option.hint}</small>
                    </span>
                  </label>
                )
              })}
            </div>
          </section>
        ) : null}

        {step === 'date' ? (
          <section className="portal-change-step">
            <p>Selecciona una fecha preferida y una franja orientativa. Costa Clean confirmará la disponibilidad.</p>
            <div className="portal-change-fields">
              <label className="portal-field portal-change-field">
                <span>Fecha preferida</span>
                <input
                  type="date"
                  value={intent.preferredDate}
                  onChange={(event) => updateIntent({ preferredDate: event.target.value })}
                />
              </label>
              <label className="portal-field portal-change-field">
                <span>Franja preferida</span>
                <select
                  value={intent.preferredTimeWindow}
                  onChange={(event) => updateIntent({ preferredTimeWindow: event.target.value })}
                >
                  <option value="">Sin franja preferida</option>
                  {timeWindowOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
        ) : null}

        {step === 'details' ? (
          <section className="portal-change-step">
            <p>Detalles opcionales. No incluyas llaves, contraseñas ni códigos de acceso.</p>
            <label className="portal-field portal-change-field">
              <span>Detalles</span>
              <textarea
                rows={5}
                maxLength={1000}
                value={intent.details}
                onChange={(event) => updateIntent({ details: event.target.value })}
                placeholder="Cuéntanos lo imprescindible para revisar la solicitud."
              />
            </label>
          </section>
        ) : null}

        {step === 'review' ? (
          <section className="portal-change-step">
            <p>Revisa la solicitud antes de enviarla.</p>
            <dl className="portal-detail-list portal-detail-list--compact">
              <PortalDetailRow label="Propiedad" value={selectedProperty?.displayName ?? 'No seleccionada'} />
              <PortalDetailRow label="Servicio" value={selectedService?.label ?? 'No seleccionado'} />
              <PortalDetailRow label="Fecha" value={intent.preferredDate || 'Sin fecha'} />
              <PortalDetailRow label="Franja" value={resolveTimeWindowLabel(intent.preferredTimeWindow)} />
              <PortalDetailRow label="Detalles" value={intent.details || 'Sin detalles adicionales'} />
            </dl>
          </section>
        ) : null}

        {message ? (
          <p className={`portal-form-result ${state === 'error' ? 'portal-form-result--error' : 'portal-form-result--success'}`}>
            {message}
          </p>
        ) : null}
        {errorKind ? <p className="portal-form-result portal-form-result--error">Tipo de error: {errorKind}</p> : null}

        <form className="portal-stepflow__actions" onSubmit={handleSubmit}>
          {step !== 'property' ? (
            <a className="portal-button portal-button--secondary" href={withCurrentSearch(getPortalServiceRequestNewPath(previousServiceStep(step)))}>
              Volver
            </a>
          ) : (
            <a className="portal-button portal-button--secondary" href={withCurrentSearch(getPortalServiceRequestsPath())}>
              Cancelar
            </a>
          )}

          {step === 'property' ? (
            <button
              type="button"
              className="portal-button portal-button--primary"
              disabled={!selectedProperty}
              onClick={() => goTo('service')}
            >
              Seguir
            </button>
          ) : null}

          {step === 'service' ? (
            <button
              type="button"
              className="portal-button portal-button--primary"
              disabled={!selectedService}
              onClick={() => goTo('date')}
            >
              Seguir
            </button>
          ) : null}

          {step === 'date' ? (
            <button
              type="button"
              className="portal-button portal-button--primary"
              disabled={!intent.preferredDate}
              onClick={() => goTo('details')}
            >
              Seguir
            </button>
          ) : null}

          {step === 'details' ? (
            <button type="button" className="portal-button portal-button--primary" onClick={() => goTo('review')}>
              Revisar
            </button>
          ) : null}

          {step === 'review' ? (
            <button className="portal-button portal-button--primary" type="submit" disabled={!canReview || state === 'submitting'}>
              {state === 'submitting' ? 'Enviando…' : 'Enviar solicitud'}
            </button>
          ) : null}
        </form>
      </section>

      <section className="portal-request-history" aria-label="Solicitudes recientes">
        <h3>Solicitudes recientes</h3>
        <PortalServiceRequestList requests={requestHistory} emptyMessage="No hay solicitudes activas." />
      </section>
    </section>
  )
}

function PortalServiceRequestDetail({
  request,
  clientId,
  getHref,
  onRefreshData,
}: {
  request: PortalServiceRequestSummary
  clientId: string
  getHref: (page: 'service-requests' | 'services' | 'home' | 'properties') => string
  onRefreshData?: () => void | Promise<void>
}) {
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [state, setState] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [requestState, setRequestState] = useState(request)

  useEffect(() => {
    setRequestState(request)
  }, [request])

  async function handleCancel() {
    setState('submitting')
    setMessage(null)
    try {
      const receipt = await cancelServiceRequest({
        clientId,
        reference: requestState.reference,
        version: requestState.version,
      })
      setRequestState((current) => ({
        ...current,
        status: 'cancelled',
        statusLabel: 'Cancelada',
        resolvedAt: receipt.resolvedAt ?? current.resolvedAt,
        resolvedAtLabel: receipt.resolvedAt ? formatDateTime(receipt.resolvedAt) : current.resolvedAtLabel,
        canCancel: false,
      }))
      setState('idle')
      setConfirmCancel(false)
      setMessage('Solicitud cancelada.')
      await onRefreshData?.()
    } catch (error) {
      setState('error')
      setMessage(classifyServiceRequestError(error).message)
    }
  }

  return (
    <section className="portal-service-detail">
      <div className="portal-decision-block portal-decision-block--compact">
        <div>
          <span className="portal-decision-block__label">Referencia pública</span>
          <h2>{requestState.referenceLabel}</h2>
          <p>{requestState.serviceTypeLabel} · {requestState.propertyLabel}</p>
        </div>
        <span className="portal-status portal-status--info">{requestState.statusLabel}</span>
      </div>

      <section className="portal-detail-list portal-detail-list--compact" aria-label="Datos de la solicitud">
        <PortalDetailRow label="Propiedad" value={requestState.propertyLabel} />
        <PortalDetailRow label="Referencia propiedad" value={requestState.propertyPublicRef} />
        <PortalDetailRow label="Dirección" value={requestState.propertyAddressLabel} />
        <PortalDetailRow label="Tipo" value={requestState.serviceTypeLabel} />
        <PortalDetailRow label="Fecha preferida" value={requestState.preferredDateLabel} />
        <PortalDetailRow label="Franja preferida" value={requestState.preferredTimeWindowLabel} />
        <PortalDetailRow label="Solicitada" value={requestState.requestedAtLabel} />
        <PortalDetailRow label="Resuelta" value={requestState.resolvedAtLabel ?? 'Pendiente'} />
        <PortalDetailRow label="Estado" value={requestState.statusLabel} />
        <PortalDetailRow label="Detalles" value={requestState.notesLabel} />
      </section>

      {message ? <p className="portal-form-result portal-form-result--success">{message}</p> : null}

      <div className="portal-inline-actions">
        <a className="portal-button portal-button--secondary" href={getHref('service-requests')}>
          Volver a solicitudes
        </a>
        {requestState.canCancel && requestState.status === 'pending_review' ? (
          <button
            type="button"
            className="portal-button portal-button--danger"
            onClick={() => setConfirmCancel(true)}
            disabled={state === 'submitting'}
          >
            Cancelar solicitud
          </button>
        ) : null}
      </div>

      {confirmCancel ? (
        <PortalModal title="Cancelar solicitud" onDismiss={() => setConfirmCancel(false)}>
          <p>Solo puedes cancelar una solicitud pendiente de revisión. Esta acción no elimina el historial.</p>
          <div className="portal-inline-actions">
            <button type="button" className="portal-button portal-button--secondary" onClick={() => setConfirmCancel(false)}>
              Volver
            </button>
            <button type="button" className="portal-button portal-button--danger" onClick={handleCancel} disabled={state === 'submitting'}>
              {state === 'submitting' ? 'Cancelando…' : 'Confirmar cancelación'}
            </button>
          </div>
        </PortalModal>
      ) : null}
    </section>
  )
}

function PortalServiceRequestList({
  requests,
  emptyMessage,
}: {
  requests: PortalServiceRequestSummary[]
  emptyMessage: string
}) {
  return requests.length > 0 ? (
    <div className="portal-record-list">
      {requests.map((request) => (
        <a
          key={request.reference}
          className="portal-record portal-record--link"
          href={withCurrentSearch(getPortalServiceRequestPath(request.reference))}
        >
          <div>
            <h2>{request.referenceLabel}</h2>
            <p>{request.serviceTypeLabel} · {request.propertyLabel}</p>
          </div>
          <span className="portal-status portal-status--warning">{request.statusLabel}</span>
        </a>
      ))}
    </div>
  ) : (
    <section className="portal-empty-state">
      <p>{emptyMessage}</p>
    </section>
  )
}

function PortalServiceListSection({
  title,
  emptyMessage,
  services,
  detailHref,
}: {
  title: string
  emptyMessage: string
  services: PortalServiceSummary[]
  detailHref: (serviceRef: string) => string
}) {
  return (
    <section className="portal-service-list-section" aria-label={title}>
      <h3>{title}</h3>
      {services.length > 0 ? (
        <div className="portal-record-list">
          {services.map((service) => (
            <a key={service.reference} className="portal-record portal-record--link" href={withCurrentSearch(detailHref(service.reference))}>
              <div>
                <h2>{service.referenceLabel}</h2>
                <p>{service.serviceTypeLabel} · {service.propertyLabel}</p>
              </div>
              <span className="portal-status portal-status--info">{service.statusLabel}</span>
            </a>
          ))}
        </div>
      ) : (
        <section className="portal-empty-state">
          <p>{emptyMessage}</p>
        </section>
      )}
    </section>
  )
}

function PortalPageFrame({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="portal-page" data-portal-page={title}>
      <header className="portal-page__header">
        <p className="portal-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </header>
      {children}
    </div>
  )
}

function PortalDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="portal-detail-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function PortalModal({
  title,
  onDismiss,
  children,
}: {
  title: string
  onDismiss: () => void
  children: ReactNode
}) {
  return (
    <div className="portal-modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="portal-modal__backdrop" onClick={onDismiss} aria-hidden="true" />
      <div className="portal-modal__surface">
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  )
}

function classifyServiceRequestError(error: unknown): { kind: string; message: string } {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  if (lower.includes('idempotency') || lower.includes('conflict') || lower.includes('duplicate')) {
    return { kind: 'idempotency', message: 'Ya existe una solicitud para esa misma intención.' }
  }
  if (lower.includes('timeout')) {
    return { kind: 'timeout', message: 'La red tardó demasiado. Conservamos el borrador.' }
  }
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('failed to fetch')) {
    return { kind: 'network', message: 'Se perdió la conexión. Tu borrador sigue guardado.' }
  }
  if (lower.includes('session') || lower.includes('auth')) {
    return { kind: 'session_expired', message: 'La sesión caducó. Vuelve a iniciar sesión.' }
  }
  if (lower.includes('available') || lower.includes('rpc_denied') || lower.includes('rpc_empty_response')) {
    return { kind: 'unavailable', message: 'Esta capacidad todavía no está disponible.' }
  }
  if (lower.includes('resource_not_found')) {
    return { kind: 'neutral_not_found', message: 'No encontramos una solicitud activa con esa referencia.' }
  }
  return { kind: 'unknown', message: 'No pudimos enviar la solicitud. Revisa los datos e inténtalo de nuevo.' }
}

function readStoredServiceRequestIntent(storageKey: string) {
  const defaults = {
    propertyPublicRef: '',
    serviceType: '',
    preferredDate: '',
    preferredTimeWindow: '',
    details: '',
    idempotencyKey: crypto.randomUUID(),
    receipt: null as PortalServiceRequestReceipt | null,
  }

  if (typeof window === 'undefined') return defaults
  const raw = window.sessionStorage.getItem(storageKey)
  if (!raw) return defaults

  try {
    const parsed = JSON.parse(raw) as Partial<typeof defaults>
    return {
      propertyPublicRef: typeof parsed.propertyPublicRef === 'string' ? parsed.propertyPublicRef : defaults.propertyPublicRef,
      serviceType: typeof parsed.serviceType === 'string' ? parsed.serviceType : defaults.serviceType,
      preferredDate: typeof parsed.preferredDate === 'string' ? parsed.preferredDate : defaults.preferredDate,
      preferredTimeWindow: typeof parsed.preferredTimeWindow === 'string' ? parsed.preferredTimeWindow : defaults.preferredTimeWindow,
      details: typeof parsed.details === 'string' ? parsed.details : defaults.details,
      idempotencyKey: typeof parsed.idempotencyKey === 'string' && parsed.idempotencyKey ? parsed.idempotencyKey : defaults.idempotencyKey,
      receipt: parsed.receipt && typeof parsed.receipt === 'object' ? sanitizeReceipt(parsed.receipt) : null,
    }
  } catch {
    return defaults
  }
}

function sanitizeReceipt(value: unknown): PortalServiceRequestReceipt | null {
  const record = value as Partial<PortalServiceRequestReceipt>
  if (
    typeof record.reference !== 'string'
    || typeof record.status !== 'string'
    || typeof record.requestedAt !== 'string'
    || typeof record.propertyPublicRef !== 'string'
    || typeof record.propertyLabel !== 'string'
    || typeof record.serviceType !== 'string'
  ) {
    return null
  }
  return {
    reference: record.reference,
    status: record.status,
    requestedAt: record.requestedAt,
    resolvedAt: record.resolvedAt ?? null,
    propertyPublicRef: record.propertyPublicRef,
    propertyLabel: record.propertyLabel,
    serviceType: record.serviceType,
    serviceTypeLabel: record.serviceTypeLabel ?? 'Servicio no disponible',
    preferredDate: record.preferredDate ?? '',
    preferredDateLabel: record.preferredDateLabel ?? 'Fecha no disponible',
    preferredTimeWindow: record.preferredTimeWindow ?? '',
    preferredTimeWindowLabel: record.preferredTimeWindowLabel ?? 'Sin franja preferida',
    notes: record.notes ?? '',
    notesLabel: record.notesLabel ?? 'Sin detalles adicionales',
    version: typeof record.version === 'number' ? record.version : 1,
  }
}

function resolveTimeWindowLabel(value: string) {
  const match = timeWindowOptions.find((option) => option.value === value)
  return match ? match.label : 'Sin franja preferida'
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function previousServiceStep(step: ServiceRequestStep): ServiceRequestStep {
  if (step === 'success') return 'review'
  if (step === 'review') return 'details'
  if (step === 'details') return 'date'
  if (step === 'date') return 'service'
  return 'property'
}

function partitionServices(services: PortalServiceSummary[]): [PortalServiceSummary[], PortalServiceSummary[]] {
  const today = startOfDay(new Date())
  const upcoming: PortalServiceSummary[] = []
  const previous: PortalServiceSummary[] = []

  for (const service of services) {
    const serviceDate = parseDate(service.scheduledDate)
    if (serviceDate && serviceDate >= today && service.status !== 'cancelled') {
      upcoming.push(service)
    } else {
      previous.push(service)
    }
  }

  upcoming.sort((left, right) => left.scheduledDate.localeCompare(right.scheduledDate))
  previous.sort((left, right) => right.scheduledDate.localeCompare(left.scheduledDate))

  return [upcoming, previous]
}

function parseDate(value: string): Date | null {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function startOfDay(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function withCurrentSearch(pathname: string): string {
  const search = typeof window !== 'undefined' ? window.location.search : ''
  return search ? `${pathname}${search}` : pathname
}

const serviceRequestSteps: ServiceRequestStep[] = ['property', 'service', 'date', 'details', 'review']

const serviceRequestStepLabels: Record<ServiceRequestStep, string> = {
  property: 'Propiedad',
  service: 'Servicio',
  date: 'Fecha',
  details: 'Detalles',
  review: 'Revisar',
  success: 'Enviado',
}

const serviceRequestStepTitles: Record<ServiceRequestStep, string> = {
  property: 'Elige la propiedad',
  service: 'Elige el servicio',
  date: 'Fecha y franja',
  details: 'Detalles opcionales',
  review: 'Revisar antes de enviar',
  success: 'Solicitud enviada',
}
