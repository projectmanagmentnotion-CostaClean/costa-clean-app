import type { ReactNode } from 'react'
import type { PortalFoundationData } from './portalWorkspaceData'
import type { PortalPage } from './portalNavigation'

interface PortalPagesProps {
  page: PortalPage | null
  pathname: string
  data: PortalFoundationData
  getHref: (page: PortalPage) => string
  isUnavailable: boolean
}

export function PortalPages({
  page,
  pathname,
  data,
  getHref,
  isUnavailable,
}: PortalPagesProps) {
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
            <p>{isUnavailable ? 'La lectura segura todavía no está conectada.' : 'Datos sintéticos exclusivos de la vista previa local.'}</p>
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
    return renderProfilePage(pathname, data, getHref, isUnavailable)
  }

  if (page === 'properties') {
    return renderPropertiesPage(pathname, data, getHref, isUnavailable)
  }

  if (page === 'services') {
    return (
      <PortalPageFrame
        eyebrow="Actividad"
        title="Servicios"
        description="La vista base diferencia agenda y estado sin prometer cambios, fechas o guardados."
      >
        <div className="portal-record-list">
          {data.services.length > 0 ? data.services.map((service) => (
            <article key={service.id} className="portal-record">
              <div>
                <h2>{service.serviceLabel}</h2>
                <p>{service.propertyLabel} · {service.scheduleLabel}</p>
              </div>
              <span className="portal-status portal-status--info">{service.statusLabel}</span>
            </article>
          )) : (
            <section className="portal-empty-state">
              <p>No hay servicios visibles para esta cuenta todavía.</p>
            </section>
          )}
        </div>
      </PortalPageFrame>
    )
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

function renderProfilePage(
  pathname: string,
  data: PortalFoundationData,
  getHref: (page: PortalPage) => string,
  isUnavailable: boolean,
) {
  const routeStep = resolveCorrectionStep(pathname, 'profile')
  if (routeStep) {
    return renderCorrectionFlow('Perfil', routeStep, data.profileRequests[0] ?? null, getHref, isUnavailable)
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

      <section className="portal-correction-callout">
        <div>
          <p className="portal-eyebrow">Corrección revisable</p>
          <h2>Solicitar cambio de perfil</h2>
          <p>{isUnavailable ? 'La lectura segura todavía no está conectada.' : 'Los cambios se revisan antes de tocar el CRM.'}</p>
        </div>
        <div className="portal-correction-callout__actions">
          <a className="portal-button portal-button--primary" href={getHref('profile')}>
            Revisar campos
          </a>
          <a className="portal-button portal-button--secondary" href="/portal/profile/correction/fields">
            Iniciar revisión
          </a>
        </div>
      </section>

      <section className="portal-request-history" aria-label="Solicitudes de perfil">
        <h2>Solicitudes recientes</h2>
        {data.profileRequests.length > 0 ? (
          <div className="portal-record-list">
            {data.profileRequests.map((request) => (
              <article key={request.referenceLabel} className="portal-record">
                <div>
                  <h3>{request.referenceLabel}</h3>
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
    </PortalPageFrame>
  )
}

function renderPropertiesPage(
  pathname: string,
  data: PortalFoundationData,
  getHref: (page: PortalPage) => string,
  isUnavailable: boolean,
) {
  const routeStep = resolveCorrectionStep(pathname, 'property')
  if (routeStep) {
    return renderCorrectionFlow('Propiedad', routeStep, data.propertyRequests[0] ?? null, getHref, isUnavailable)
  }

  return (
    <PortalPageFrame
      eyebrow="Espacios"
      title="Propiedades"
      description="Listado compacto y aislado. No existe acceso directo a la tabla canónica de propiedades."
    >
      <div className="portal-record-list">
        {data.properties.length > 0 ? data.properties.map((property) => (
          <article key={property.id} className="portal-record">
            <div>
              <h2>{property.displayName}</h2>
              <p>{property.addressLabel}</p>
            </div>
            <span className="portal-status portal-status--info">{property.statusLabel}</span>
          </article>
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
        </section>
      ) : null}

      <section className="portal-correction-callout">
        <div>
          <p className="portal-eyebrow">Corrección revisable</p>
          <h2>Solicitar cambio de propiedad</h2>
          <p>{isUnavailable ? 'La lectura segura todavía no está conectada.' : 'Solo se exponen campos permitidos y la revisión evita escritura directa.'}</p>
        </div>
        <div className="portal-correction-callout__actions">
          <a className="portal-button portal-button--primary" href="/portal/properties/espacio-demo/correction/fields">
            Iniciar revisión
          </a>
          <a className="portal-button portal-button--secondary" href={getHref('properties')}>
            Volver al listado
          </a>
        </div>
      </section>

      <section className="portal-request-history" aria-label="Solicitudes de propiedad">
        <h2>Solicitudes recientes</h2>
        {data.propertyRequests.length > 0 ? (
          <div className="portal-record-list">
            {data.propertyRequests.map((request) => (
              <article key={request.referenceLabel} className="portal-record">
                <div>
                  <h3>{request.referenceLabel}</h3>
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
    </PortalPageFrame>
  )
}

function renderCorrectionFlow(
  scopeLabel: 'Perfil' | 'Propiedad',
  step: 'fields' | 'values' | 'review' | 'success',
  request: PortalFoundationData['profileRequests'][number] | PortalFoundationData['propertyRequests'][number] | null,
  getHref: (page: PortalPage) => string,
  isUnavailable: boolean,
) {
  const stepIndex = {
    fields: 1,
    values: 2,
    review: 3,
    success: 4,
  }[step]

  return (
    <PortalPageFrame
      eyebrow={`${scopeLabel} · revisión`}
      title={step === 'success' ? 'Solicitud enviada' : 'Revisión de cambios'}
      description="Un StepFlow compacto guía la corrección sin escribir directamente en el CRM."
    >
      <div className="portal-stepflow">
        <div className="portal-stepflow__steps" aria-label="Pasos de revisión">
          {['Datos', 'Cambios', 'Revisar', 'Enviado'].map((label, index) => (
            <span key={label} className={index + 1 === stepIndex ? 'portal-stepflow__step is-active' : 'portal-stepflow__step'}>
              {label}
            </span>
          ))}
        </div>

        <section className="portal-stepflow__surface">
          {step === 'fields' ? (
            <>
              <p className="portal-eyebrow">Paso 1</p>
              <h2>Selecciona los campos que quieres revisar</h2>
              <div className="portal-field-pills" aria-label={`Campos del ${scopeLabel.toLowerCase()}`}>
                {(scopeLabel === 'Perfil'
                  ? ['Nombre', 'Teléfono', 'Email', 'NIF/CIF', 'Facturación']
                  : ['Nombre', 'Tipo de propiedad', 'Dirección', 'Ciudad', 'Código postal']
                ).map((label) => (
                  <span key={label} className="portal-field-pill">{label}</span>
                ))}
              </div>
            </>
          ) : null}

          {step === 'values' ? (
            <>
              <p className="portal-eyebrow">Paso 2</p>
              <h2>Revisa los valores antes de continuar</h2>
              <p>{isUnavailable ? 'La lectura segura todavía no está conectada.' : 'Los valores visibles se limitan a datos permitidos y no exponen IDs internos.'}</p>
            </>
          ) : null}

          {step === 'review' ? (
            <>
              <p className="portal-eyebrow">Paso 3</p>
              <h2>Confirma la solicitud</h2>
              <p>Se generará un recibo estable y la revisión quedará pendiente de validación manual.</p>
            </>
          ) : null}

          {step === 'success' ? (
            <>
              <span className="portal-status portal-status--success">Solicitud registrada</span>
              <h2>Tu solicitud quedó enviada</h2>
              <p>{request ? `${request.referenceLabel} · ${request.statusLabel}` : 'La revisión se completó correctamente.'}</p>
            </>
          ) : null}

          <div className="portal-stepflow__actions">
            {step !== 'fields' ? (
              <a className="portal-button portal-button--secondary" href={scopeLabel === 'Perfil' ? '/portal/profile/correction/fields' : '/portal/properties/espacio-demo/correction/fields'}>
                Volver
              </a>
            ) : null}
            {step !== 'success' ? (
              <a
                className="portal-button portal-button--primary"
                href={
                  step === 'fields'
                    ? scopeLabel === 'Perfil'
                      ? '/portal/profile/correction/values'
                      : '/portal/properties/espacio-demo/correction/values'
                    : step === 'values'
                      ? scopeLabel === 'Perfil'
                        ? '/portal/profile/correction/review'
                        : '/portal/properties/espacio-demo/correction/review'
                      : scopeLabel === 'Perfil'
                        ? '/portal/profile/correction/success'
                        : '/portal/properties/espacio-demo/correction/success'
                }
              >
                Continuar
              </a>
            ) : (
              <a className="portal-button portal-button--primary" href={scopeLabel === 'Perfil' ? getHref('profile') : getHref('properties')}>
                Volver a la vista
              </a>
            )}
          </div>
        </section>
      </div>
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

interface PortalSummaryLinkProps {
  label: string
  value: string
  hint: string
  href: string
}

function PortalSummaryLink({ label, value, hint, href }: PortalSummaryLinkProps) {
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
