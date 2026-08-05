import type { ReactNode } from 'react'
import type { PortalFoundationData } from './portalWorkspaceData'
import type { PortalPage } from './portalNavigation'
import {
  getPortalProfileRequestPath,
  getPortalProfileRequestsPath,
  getPortalPropertyPath,
  getPortalPropertyRequestPath,
  getPortalPropertyRequestsPath,
  resolvePortalRequestRoute,
} from './portalNavigation'
import { PortalProfileChangeFlow, PortalPropertyChangeFlow } from './PortalReviewedChangeForms'
import {
  PortalServiceRequestsPage,
  PortalServicesPage,
} from './PortalServiceArea'

interface PortalPagesProps {
  page: PortalPage | null
  pathname: string
  data: PortalFoundationData
  getHref: (page: PortalPage) => string
  onRefreshData?: () => void | Promise<void>
}

export function PortalPages({ page, pathname, data, getHref, onRefreshData }: PortalPagesProps) {
  if (!page) {
    return (
      <PortalPageFrame eyebrow="Área protegida" title="Página no disponible">
        <section className="portal-empty-state">
          <p>No podemos confirmar si este recurso existe.</p>
          <a className="portal-button portal-button--primary" href={getHref('home')}>
            Volver al inicio
          </a>
        </section>
      </PortalPageFrame>
    )
  }

  if (page === 'home') {
    const isReadReady = data.capabilities.profile.status === 'REAL' && data.capabilities.properties.status === 'REAL'
    return (
      <PortalPageFrame
        eyebrow="Resumen"
        title={`Hola, ${data.account.accountLabel}`}
        description="Un vistazo claro al siguiente paso, sin exponer información interna del CRM."
      >
        <section className="portal-decision-block">
          <div>
            <span className="portal-decision-block__label">Próximo servicio</span>
            <h2>{data.dashboard.nextServiceLabel}</h2>
            <p>{isReadReady ? 'Lectura real conectada por capacidades aisladas.' : 'Lectura parcial o en preparación; el portal sigue siendo utilizable.'}</p>
          </div>
          <a className="portal-button portal-button--primary" href={getHref('services')}>
            Revisar servicios
          </a>
        </section>

        <div className="portal-summary-grid" aria-label="Resumen de la cuenta">
          <PortalSummaryLink
            label="Cuenta"
            value={data.account.clientDisplayName}
            hint={data.profile.reviewStateLabel}
            href={getHref('account')}
          />
          <PortalSummaryLink
            label="Propiedades"
            value={String(data.properties.length)}
            hint="Espacios visibles"
            href={getHref('properties')}
          />
          <PortalSummaryLink
            label="Documentos"
            value={String(data.dashboard.availableDocumentCount)}
            hint="Vista base, sin descarga"
            href={getHref('documents')}
          />
        </div>
      </PortalPageFrame>
    )
  }

  if (page === 'account') {
    return (
      <PortalPageFrame
        eyebrow="Cuenta"
        title="Centro de cuenta"
        description="Accesos de perfil, seguridad y ayuda en un solo sitio."
      >
        <section className="portal-summary-grid portal-summary-grid--account">
          <PortalSummaryLink
            label="Perfil"
            value={data.profile.fullNameLabel}
            hint="Datos visibles"
            href={getHref('profile')}
          />
          <PortalSummaryLink
            label="Seguridad"
            value="Sesión protegida"
            hint={data.profile.reviewStateLabel}
            href={getHref('security')}
          />
          <PortalSummaryLink
            label="Ayuda"
            value="Contactar"
            hint="Entrada de soporte"
            href={getHref('help')}
          />
        </section>
        <section className="portal-detail-list portal-detail-list--compact" aria-label="Resumen de cuenta">
          <PortalDetailRow label="Cliente" value={data.account.clientDisplayName} />
          <PortalDetailRow label="Cuenta" value={data.account.accountLabel} />
          <PortalDetailRow
            label="Rol"
            value={data.account.role === 'client_admin' ? 'Administrador del cliente' : 'Miembro del cliente'}
          />
        </section>
      </PortalPageFrame>
    )
  }

  if (page === 'profile') {
    return renderProfilePage(pathname, data, onRefreshData)
  }

  if (page === 'properties') {
    return renderPropertiesPage(pathname, data, onRefreshData)
  }

  if (page === 'services') {
    return <PortalServicesPage pathname={pathname} data={data} getHref={getHref} onRefreshData={onRefreshData} />
  }

  if (page === 'service-requests') {
    return <PortalServiceRequestsPage pathname={pathname} data={data} getHref={getHref} onRefreshData={onRefreshData} />
  }

  if (page === 'documents' || page === 'invoices') {
    return (
      <PortalPageFrame
        eyebrow="Documentos"
        title="Documentos"
        description="Estados de demostración sin validez fiscal, importes reales, descarga ni modificación financiera."
      >
        <div className="portal-record-list">
          {data.invoices.length > 0 ? data.invoices.map((invoice) => (
            <article key={invoice.id} className="portal-record">
              <div>
                <h2>{invoice.referenceLabel}</h2>
                <p>{invoice.issuedLabel}</p>
              </div>
              <span className="portal-status portal-status--info">{invoice.paymentStatusLabel}</span>
            </article>
          )) : (
            <section className="portal-empty-state">
              <p>No hay documentos privados disponibles en esta vista.</p>
            </section>
          )}
        </div>
        <p className="portal-inline-note">
          La descarga privada con URL firmada de 60 segundos pertenece a CP-3B.4.
        </p>
      </PortalPageFrame>
    )
  }

  if (page === 'requests') {
    return (
      <PortalPageFrame
        eyebrow="Seguimiento"
        title="Solicitudes"
        description="Vista agregada de solicitudes de perfil y propiedades."
      >
        <div className="portal-record-list">
          {data.profileRequests.concat(data.propertyRequests).length > 0 ? (
            data.profileRequests.concat(data.propertyRequests).map((request) => (
              <article key={`${request.scopeLabel}-${request.referenceLabel}`} className="portal-record">
                <div>
                  <h2>{request.referenceLabel}</h2>
                  <p>{request.scopeLabel} · {request.fieldSummaryLabel}</p>
                </div>
                <span className="portal-status portal-status--warning">{request.statusLabel}</span>
              </article>
            ))
          ) : (
            <section className="portal-empty-state">
              <p>No hay solicitudes activas para esta cuenta.</p>
            </section>
          )}
        </div>
      </PortalPageFrame>
    )
  }

  if (page === 'security') {
    return (
      <PortalPageFrame
        eyebrow="Protección"
        title="Seguridad de la cuenta"
        description="Arquitectura preparada para sesiones, recuperación y MFA sin activarlos antes de CP-3B.1."
      >
        <section className="portal-security-list" aria-label="Controles de seguridad preparados">
          <PortalSecurityRow
            title="Separación CRM / portal"
            description="El portal usa un bootstrap y una navegación independientes."
            status="Activo en CP-3A"
          />
          <PortalSecurityRow
            title="Membresía explícita"
            description="El email nunca selecciona ni crea un cliente."
            status="Frontera definida"
          />
          <PortalSecurityRow
            title="MFA"
            description="La interfaz está preparada; la política y el flujo pertenecen a una fase posterior."
            status="No habilitado"
          />
        </section>
      </PortalPageFrame>
    )
  }

  if (page === 'preferences') {
    return (
      <PortalPageFrame
        eyebrow="Preferencias"
        title="Preferencias"
        description="Ajustes de experiencia y accesibilidad sin impacto operativo."
      >
        <section className="portal-empty-state">
          <p>Este panel se completará cuando existan preferencias reales para el portal.</p>
        </section>
      </PortalPageFrame>
    )
  }

  if (page === 'help') {
    return (
      <PortalPageFrame
        eyebrow="Ayuda"
        title="Ayuda y contacto"
        description="Canales claros para resolver dudas sin abrir acceso administrativo."
      >
        <section className="portal-detail-list">
          <PortalDetailRow label="Soporte" value="Atención Costa Clean" />
          <PortalDetailRow label="Horario" value="Lunes a viernes · 09:00–18:00" />
          <PortalDetailRow label="Respuesta" value="Se confirma por revisión manual" />
        </section>
      </PortalPageFrame>
    )
  }

  return (
    <PortalPageFrame
      eyebrow="Protección"
      title="Página no disponible"
      description="Esta ruta no está disponible todavía."
    >
      <section className="portal-empty-state">
        <p>La sección solicitada no está publicada para el portal.</p>
      </section>
    </PortalPageFrame>
  )
}

function renderProfilePage(pathname: string, data: PortalFoundationData, onRefreshData?: () => void | Promise<void>) {
  const requestRoute = resolvePortalRequestRoute(pathname)
  if (requestRoute?.scope === 'profile') {
    if (requestRoute.reference) {
      const request = data.profileRequests.find((item) => item.reference === requestRoute.reference) ?? null
      return (
        <PortalPageFrame
          eyebrow="Cuenta"
          title="Solicitud de perfil"
          description="Detalle público de una corrección revisable sin exponer IDs internos."
        >
          <PortalRequestDetail
            request={request}
            scopeLabel="Perfil"
            backHref={getPortalProfileRequestsPath()}
            fallbackMessage="No encontramos una solicitud pública con esa referencia."
          />
        </PortalPageFrame>
      )
    }

    return (
      <PortalPageFrame
        eyebrow="Cuenta"
        title="Solicitudes de perfil"
        description="Historial público de correcciones revisables."
      >
        <PortalRequestHistoryList
          requests={data.profileRequests}
          emptyMessage="No hay solicitudes activas."
          detailHref={(reference) => getPortalProfileRequestPath(reference)}
        />
      </PortalPageFrame>
    )
  }

  const routeStep = resolveCorrectionStep(pathname, 'profile')
  if (routeStep) {
    return (
      <PortalPageFrame
        eyebrow="Cuenta"
        title={routeStep === 'success' ? 'Solicitud enviada' : 'Revisión de perfil'}
        description="StepFlow real para corregir datos del perfil sin escribir directamente en el CRM."
      >
        <PortalProfileChangeFlow
          clientId={data.account.clientContextId}
          profile={data.profile}
          requestHistory={data.profileRequests}
          capabilityStatus={data.capabilities.profile.status}
          capabilityMessage={data.capabilities.profile.message ?? 'Lectura real disponible'}
          pathname={pathname}
          basePath={withCurrentSearch('/portal/profile/correction')}
          returnPath={withCurrentSearch('/portal/profile')}
          resourceRef="profile"
          resourceId={data.account.clientContextId}
          onRefreshData={onRefreshData}
        />
      </PortalPageFrame>
    )
  }

  return (
    <PortalPageFrame
      eyebrow="Cuenta"
      title="Mi perfil"
      description="Vista oficial de solo lectura con corrección revisable."
    >
      <section className="portal-detail-list" aria-label="Datos del perfil">
        <PortalDetailRow label="Nombre" value={data.profile.fullNameLabel} />
        <PortalDetailRow label="Teléfono" value={data.profile.phoneLabel} />
        <PortalDetailRow label="Email" value={data.profile.emailLabel} />
        <PortalDetailRow label="NIF/CIF" value={data.profile.taxIdLabel} />
        <PortalDetailRow label="Facturación" value={data.profile.billingAddressLabel} />
      </section>

      <section className="portal-decision-block portal-decision-block--compact">
        <div>
          <span className="portal-decision-block__label">Corrección revisable</span>
          <h2>Solicitar cambios de perfil</h2>
          <p>Un StepFlow de cuatro pasos permite seleccionar campos, revisar valores y enviar la petición sin tocar tablas internas.</p>
        </div>
        <a className="portal-button portal-button--primary" href={withCurrentSearch('/portal/profile/correction/fields')}>
          Iniciar corrección
        </a>
      </section>

      <section className="portal-request-history" aria-label="Solicitudes de perfil">
        <h3>Solicitudes recientes</h3>
        <PortalRequestHistoryList
          requests={data.profileRequests}
          emptyMessage="No hay solicitudes activas."
          detailHref={(reference) => getPortalProfileRequestPath(reference)}
        />
      </section>
    </PortalPageFrame>
  )
}

function renderPropertiesPage(pathname: string, data: PortalFoundationData, onRefreshData?: () => void | Promise<void>) {
  const requestRoute = resolvePortalRequestRoute(pathname)
  const routeStep = resolveCorrectionStep(pathname, 'property')
  const selectedProperty = data.propertyDetail
  const propertyRef = requestRoute?.propertyRef ?? ''
  const propertyBasePath = withCurrentSearch(getPortalPropertyPath(propertyRef))
  if (requestRoute?.scope === 'property') {
    if (requestRoute.reference) {
      const request = data.propertyRequests.find((item) => item.reference === requestRoute.reference) ?? null
      return (
        <PortalPageFrame
          eyebrow="Espacios"
          title="Solicitud de propiedad"
          description="Detalle público de una corrección revisable sin exponer IDs internos."
        >
          <PortalRequestDetail
            request={request}
            scopeLabel="Propiedad"
            backHref={getPortalPropertyRequestsPath(propertyRef)}
            fallbackMessage="No encontramos una solicitud pública con esa referencia."
          />
        </PortalPageFrame>
      )
    }

    return (
      <PortalPageFrame
        eyebrow="Espacios"
        title="Solicitudes de propiedad"
        description="Historial público de correcciones revisables para la propiedad seleccionada."
      >
        <PortalRequestHistoryList
          requests={data.propertyRequests}
          emptyMessage="No hay solicitudes activas para esta propiedad."
          detailHref={(reference) => getPortalPropertyRequestPath(propertyRef, reference)}
        />
      </PortalPageFrame>
    )
  }

  if (routeStep) {
    return (
      <PortalPageFrame
        eyebrow="Espacios"
        title={routeStep === 'success' ? 'Solicitud enviada' : 'Revisión de propiedad'}
        description="StepFlow real para corregir datos de la propiedad visible sin exponer IDs internos."
      >
        <PortalPropertyChangeFlow
          clientId={data.account.clientContextId}
          property={selectedProperty}
          requestHistory={data.propertyRequests}
          capabilityStatus={data.capabilities.properties.status}
          capabilityMessage={data.capabilities.properties.message ?? 'Lectura real disponible'}
          pathname={pathname}
          basePath={`${propertyBasePath}/correction`}
          returnPath={propertyBasePath}
          resourceRef={propertyRef}
          resourceId={selectedProperty?.id ?? ''}
          onRefreshData={onRefreshData}
        />
      </PortalPageFrame>
    )
  }

  return (
    <PortalPageFrame
      eyebrow="Espacios"
      title="Propiedades"
      description="Listado compacto y aislado. No existe acceso directo a la tabla canónica de propiedades."
    >
      <div className="portal-record-list">
        {data.properties.length > 0 ? data.properties.map((property) => (
          <a
            key={property.id}
            className="portal-record portal-record--link"
            href={withCurrentSearch(getPortalPropertyPath(property.publicRef))}
          >
            <div>
              <h2>{property.displayName}</h2>
              <p>{property.addressLabel}</p>
            </div>
            <span className="portal-status portal-status--info">{property.statusLabel}</span>
          </a>
        )) : (
          <section className="portal-empty-state">
            <p>Esta propiedad no está disponible.</p>
            <p>¿Falta una propiedad? Contactar con Costa Clean.</p>
          </section>
        )}
      </div>

      {data.propertyDetail ? (
        <section className="portal-property-detail">
          <div className="portal-property-detail__header">
            <div>
              <p className="portal-eyebrow">Referencia pública {data.propertyDetail.publicRefLabel}</p>
              <h2>{data.propertyDetail.nameLabel}</h2>
            </div>
            <span className="portal-status portal-status--info">{data.propertyDetail.reviewStateLabel}</span>
          </div>
          <div className="portal-detail-list portal-detail-list--compact">
            <PortalDetailRow label="Tipo" value={data.propertyDetail.propertyTypeLabel} />
            <PortalDetailRow label="Dirección" value={data.propertyDetail.addressLabel} />
            <PortalDetailRow label="Ciudad" value={data.propertyDetail.cityLabel} />
            <PortalDetailRow label="Código postal" value={data.propertyDetail.postalCodeLabel} />
          </div>

          <section className="portal-decision-block portal-decision-block--compact">
            <div>
              <span className="portal-decision-block__label">Corrección revisable</span>
              <h2>Solicitar cambios de propiedad</h2>
              <p>La referencia pública visible queda aislada del identificador interno y la corrección se tramita mediante revisión.</p>
            </div>
            <a className="portal-button portal-button--primary" href={`${propertyBasePath}/correction/fields`}>
              Iniciar corrección
            </a>
          </section>
        </section>
      ) : null}

      <section className="portal-request-history" aria-label="Solicitudes de propiedad">
        <h3>Solicitudes recientes</h3>
        <PortalRequestHistoryList
          requests={data.propertyRequests}
          emptyMessage="No hay solicitudes activas para esta propiedad."
          detailHref={(reference) => getPortalPropertyRequestPath(propertyRef, reference)}
        />
      </section>
    </PortalPageFrame>
  )
}

function resolveCorrectionStep(pathname: string, scope: 'profile' | 'property') {
  if (!pathname.includes(`/portal/${scope}/correction/`)) return null
  if (pathname.endsWith('/fields')) return 'fields' as const
  if (pathname.endsWith('/values')) return 'values' as const
  if (pathname.endsWith('/review')) return 'review' as const
  if (pathname.endsWith('/success')) return 'success' as const
  return null
}

interface PortalPageFrameProps {
  eyebrow: string
  title: string
  description?: string
  children: ReactNode
}

function PortalPageFrame({ eyebrow, title, description, children }: PortalPageFrameProps) {
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

function PortalSummaryLink({ label, value, hint, href }: { label: string; value: string; hint: string; href: string }) {
  return (
    <a className="portal-summary-link" href={href}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </a>
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

function PortalRequestHistoryList({
  requests,
  emptyMessage,
  detailHref,
}: {
  requests: PortalFoundationData['profileRequests']
  emptyMessage: string
  detailHref: (reference: string) => string
}) {
  return requests.length > 0 ? (
    <div className="portal-record-list">
      {requests.map((request) => (
        <a key={request.reference} className="portal-record portal-record--link" href={detailHref(request.reference)}>
          <div>
            <h4>{request.referenceLabel}</h4>
            <p>{request.fieldSummaryLabel}</p>
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

function PortalRequestDetail({
  request,
  scopeLabel,
  backHref,
  fallbackMessage,
}: {
  request: PortalFoundationData['profileRequests'][number] | PortalFoundationData['propertyRequests'][number] | null
  scopeLabel: 'Perfil' | 'Propiedad'
  backHref: string
  fallbackMessage: string
}) {
  if (!request) {
    return (
      <section className="portal-empty-state">
        <p>{fallbackMessage}</p>
        <a className="portal-button portal-button--primary" href={backHref}>
          Volver al listado
        </a>
      </section>
    )
  }

  return (
    <section className="portal-request-detail" aria-label={`Solicitud de ${scopeLabel.toLowerCase()}`}>
      <div className="portal-decision-block portal-decision-block--compact">
        <div>
          <span className="portal-decision-block__label">Referencia pública</span>
          <h2>{request.referenceLabel}</h2>
          <p>{request.fieldSummaryLabel}</p>
        </div>
        <span className="portal-status portal-status--info">{request.statusLabel}</span>
      </div>

      <section className="portal-detail-list portal-detail-list--compact">
        <PortalDetailRow label="Tipo" value={request.scopeLabel} />
        <PortalDetailRow label="Solicitada" value={formatDateTime(request.requestedAt)} />
        <PortalDetailRow label="Resuelta" value={request.resolvedAt ? formatDateTime(request.resolvedAt) : 'Pendiente'} />
        <PortalDetailRow label="Campos" value={request.changedFields.length > 0 ? request.changedFields.join(' · ') : 'Sin campos visibles'} />
        <PortalDetailRow label="Estado" value={request.statusLabel} />
      </section>

      <a className="portal-button portal-button--primary" href={backHref}>
        Volver al listado
      </a>
    </section>
  )
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function withCurrentSearch(pathname: string): string {
  const search = window.location.search
  return search ? `${pathname}${search}` : pathname
}

function PortalSecurityRow({
  title,
  description,
  status,
}: {
  title: string
  description: string
  status: string
}) {
  return (
    <article className="portal-security-row">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <span className="portal-status portal-status--info">{status}</span>
    </article>
  )
}
