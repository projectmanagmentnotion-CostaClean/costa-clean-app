import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { PortalProfileSnapshot, PortalPropertyDetail, PortalReviewedChangeRequestSummary, PortalCapabilityStatus } from './portalWorkspaceData'
import { submitProfileChangeRequest, submitPropertyChangeRequest } from './portalReadApi'
import type {
  ChangeErrorKind,
  ChangeFieldDefinition,
  ChangeScope,
  ChangeStep,
  StoredPortalChangeIntent,
} from './PortalReviewedChangeHelpers'
import {
  buildChanges,
  buildStorageKey,
  classifyReviewedChangeError,
  readStoredIntent,
  type PortalReviewedChangeReceipt,
} from './PortalReviewedChangeHelpers'

interface ReviewedChangeFlowProps {
  scope: ChangeScope
  scopeLabel: 'Perfil' | 'Propiedad'
  clientId: string
  capabilityStatus: PortalCapabilityStatus
  capabilityMessage: string
  requestHistory: PortalReviewedChangeRequestSummary[]
  pathname: string
  basePath: string
  returnPath: string
  resourceRef: string
  resourceId: string
  onRefreshData?: () => void | Promise<void>
}

interface ProfileFlowProps extends Omit<ReviewedChangeFlowProps, 'scope' | 'scopeLabel'> {
  profile: PortalProfileSnapshot
}

interface PropertyFlowProps extends Omit<ReviewedChangeFlowProps, 'scope' | 'scopeLabel'> {
  property: PortalPropertyDetail | null
}

const stepLabels: Record<ChangeStep, string> = {
  fields: 'Datos',
  values: 'Cambios',
  review: 'Revisar',
  success: 'Enviado',
}

export function PortalProfileChangeFlow(props: ProfileFlowProps) {
  return (
    <ReviewedChangeFlow
      scope="profile"
      scopeLabel="Perfil"
      fieldDefinitions={buildProfileFields(props.profile)}
      {...props}
    />
  )
}

export function PortalPropertyChangeFlow(props: PropertyFlowProps) {
  const property = props.property
  return (
    <ReviewedChangeFlow
      scope="property"
      scopeLabel="Propiedad"
      fieldDefinitions={buildPropertyFields(property)}
      {...props}
    />
  )
}

interface ReviewedChangeFlowBodyProps extends ReviewedChangeFlowProps {
  fieldDefinitions: ChangeFieldDefinition[]
}

function ReviewedChangeFlow({
  scope,
  scopeLabel,
  clientId,
  capabilityStatus,
  capabilityMessage,
  requestHistory,
  pathname,
  basePath,
  returnPath,
  resourceRef,
  resourceId,
  onRefreshData,
  fieldDefinitions,
}: ReviewedChangeFlowBodyProps) {
  const step = resolveChangeStep(pathname)
  const storageKey = useMemo(() => buildStorageKey(clientId, scope, resourceRef), [clientId, resourceRef, scope])
  const [intent, setIntent] = useState<StoredPortalChangeIntent>(() => readStoredIntent(storageKey, fieldDefinitions))
  const [state, setState] = useState<'idle' | 'submitting' | 'success' | 'error'>(step === 'success' ? 'success' : 'idle')
  const [message, setMessage] = useState<string | null>(intent.receipt ? 'Solicitud registrada para revisión.' : null)
  const [errorKind, setErrorKind] = useState<ChangeErrorKind | null>(null)

  const currentFieldMap = useMemo(() => new Map(fieldDefinitions.map((field) => [field.key, field.currentValue])), [fieldDefinitions])
  const selectedFields = useMemo(
    () => fieldDefinitions.filter((field) => intent.selectedFields.includes(field.key)),
    [fieldDefinitions, intent.selectedFields],
  )
  const hasSelectedFields = selectedFields.length > 0
  const changes = useMemo(() => buildChanges(selectedFields, intent.draftValues), [intent.draftValues, selectedFields])
  const hasChanges = Object.keys(changes).length > 0
  const recentReceipt = intent.receipt

  useEffect(() => {
    writeStoredIntent(storageKey, intent)
  }, [intent, storageKey])

  function updateSelectedField(fieldKey: string, selected: boolean) {
    setIntent((current) => {
      const selectedFields = selected
        ? Array.from(new Set([...current.selectedFields, fieldKey]))
        : current.selectedFields.filter((key) => key !== fieldKey)
      const draftValues = { ...current.draftValues }
      if (selected) {
        draftValues[fieldKey] = draftValues[fieldKey] ?? currentFieldMap.get(fieldKey) ?? ''
      } else {
        delete draftValues[fieldKey]
      }
      return {
        ...current,
        selectedFields,
        draftValues,
      }
    })
    setMessage(null)
    setErrorKind(null)
  }

  function updateDraft(fieldKey: string, value: string) {
    setIntent((current) => ({
      ...current,
      draftValues: {
        ...current.draftValues,
        [fieldKey]: value,
      },
    }))
    setMessage(null)
    setErrorKind(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (capabilityStatus !== 'REAL') {
      setState('error')
      setErrorKind(capabilityStatus === 'UNAVAILABLE' ? 'unavailable' : 'unknown')
      setMessage('Esta capacidad todavía no está disponible para enviar cambios.')
      return
    }

    if (!hasSelectedFields) {
      setState('error')
      setErrorKind('validation')
      setMessage('Selecciona al menos un campo para continuar.')
      return
    }

    if (!hasChanges) {
      setState('error')
      setErrorKind('validation')
      setMessage('Selecciona un cambio distinto del valor actual.')
      return
    }

    setState('submitting')
    setMessage(null)
    setErrorKind(null)

    try {
      const receipt = scope === 'profile'
        ? await submitProfileChangeRequest({
            clientId,
            changes,
            idempotencyKey: intent.idempotencyKey,
          })
        : await submitPropertyChangeRequest({
            clientId,
            propertyId: resourceId,
            changes,
            idempotencyKey: intent.idempotencyKey,
          })

      setIntent((current) => ({
        ...current,
        receipt,
      }))
      setState('success')
      setMessage('Solicitud registrada para revisión.')
      await onRefreshData?.()
      window.location.assign(`${basePath}/success`)
    } catch (error) {
      const classified = classifyReviewedChangeError(error)
      setState('error')
      setErrorKind(classified.kind)
      setMessage(classified.message)
    }
  }

  if (scope === 'property' && fieldDefinitions.length === 0) {
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

  const currentStepLabel = stepLabels[step]
  const capabilityTone = capabilityStatus === 'REAL' ? 'success' : capabilityStatus === 'UNAVAILABLE' ? 'warning' : 'danger'

  return (
    <section className="portal-form-section" aria-label={scope === 'profile' ? 'Cambio de perfil' : 'Cambio de propiedad'}>
      <header className="portal-page__header portal-page__header--compact">
        <p className="portal-eyebrow">{scopeLabel}</p>
        <h2>{scope === 'profile' ? 'Solicitud revisable de perfil' : 'Solicitud revisable de propiedad'}</h2>
        <p>{capabilityMessage}</p>
        <span className={`portal-status portal-status--${capabilityTone}`}>{capabilityStatus}</span>
      </header>

      <div className="portal-stepflow">
        <ol className="portal-stepflow__steps" aria-label="Pasos de revisión">
          {stepOrder.map((stepKey, index) => {
            const stepState = getStepState(stepKey, step, hasSelectedFields, hasChanges, recentReceipt)
            const href = `${basePath}/${stepKey}`
            return (
              <li key={stepKey} className="portal-stepflow__step-item">
                <a
                  href={href}
                  className={stepState === 'current' ? 'portal-stepflow__step is-active' : 'portal-stepflow__step'}
                  aria-current={stepKey === step ? 'step' : undefined}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  {stepLabels[stepKey]}
                </a>
              </li>
            )
          })}
        </ol>

        <section className="portal-stepflow__surface">
          <div className="portal-stepflow__surface-header">
            <p className="portal-eyebrow">Paso {currentStepLabel}</p>
            <h3>{currentStepLabel}</h3>
          </div>

          {step === 'fields' ? (
            <section className="portal-change-step">
              <p>Selecciona uno o varios campos para preparar una solicitud revisable.</p>
              <div className="portal-change-checklist" role="list" aria-label="Campos disponibles">
                {fieldDefinitions.map((field) => {
                  const checked = intent.selectedFields.includes(field.key)
                  return (
                    <label key={field.key} className="portal-change-checklist__item">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => updateSelectedField(field.key, event.target.checked)}
                      />
                      <span>
                        <strong>{field.label}</strong>
                        <small>Valor actual: {field.currentValue || 'No disponible'}</small>
                      </span>
                    </label>
                  )
                })}
              </div>
            </section>
          ) : null}

          {step === 'values' ? (
            <section className="portal-change-step">
              {!hasSelectedFields ? (
                <section className="portal-empty-state">
                  <p>Primero elige los campos que quieres revisar.</p>
                  <a className="portal-button portal-button--secondary" href={`${basePath}/fields`}>
                    Volver a datos
                  </a>
                </section>
              ) : (
                <>
                  <p>Solo se muestran los campos seleccionados.</p>
                  <div className="portal-change-fields">
                    {selectedFields.map((field) => (
                      <label key={field.key} className="portal-field portal-change-field">
                        <span>{field.label}</span>
                        <strong className="portal-change-field__current">Actual: {field.currentValue || 'No disponible'}</strong>
                        <input
                          autoComplete={field.autoComplete}
                          inputMode={field.inputMode}
                          value={intent.draftValues[field.key] ?? ''}
                          onChange={(event) => updateDraft(field.key, event.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                </>
              )}
            </section>
          ) : null}

          {step === 'review' ? (
            <section className="portal-change-step">
              {!hasSelectedFields ? (
                <section className="portal-empty-state">
                  <p>Primero elige los campos que quieres revisar.</p>
                </section>
              ) : (
                <>
                  <p>Revisa el cambio antes de enviar.</p>
                  <dl className="portal-detail-list portal-detail-list--compact">
                    {selectedFields.map((field) => {
                      const requested = intent.draftValues[field.key] ?? ''
                      return (
                        <div key={field.key} className="portal-change-review-row">
                          <dt>{field.label}</dt>
                          <dd>
                            <strong>Actual:</strong> {field.currentValue || 'No disponible'}
                            <br />
                            <strong>Solicitado:</strong> {requested || 'Sin valor'}
                          </dd>
                        </div>
                      )
                    })}
                  </dl>
                </>
              )}
            </section>
          ) : null}

          {step === 'success' ? (
            <section className="portal-change-step">
              <span className="portal-status portal-status--success">Solicitud registrada</span>
              <h3>Tu solicitud quedó enviada</h3>
              <p>{recentReceipt ? `${recentReceipt.reference} · ${recentReceipt.status}` : 'La revisión se completó correctamente.'}</p>
              {recentReceipt ? (
                <dl className="portal-detail-list portal-detail-list--compact">
                  <DetailRow label="Referencia" value={recentReceipt.reference} />
                  <DetailRow label="Estado" value={recentReceipt.status} />
                  <DetailRow label="Solicitud" value={formatDateTime(recentReceipt.requestedAt)} />
                  <DetailRow label="Campos" value={recentReceipt.changedFields.join(' · ')} />
                </dl>
              ) : null}
            </section>
          ) : null}

          {message ? (
            <p className={`portal-form-result ${state === 'error' ? 'portal-form-result--error' : 'portal-form-result--success'}`}>
              {message}
            </p>
          ) : null}

          {errorKind ? <p className="portal-form-result portal-form-result--error">Tipo de error: {errorKind}</p> : null}

          <form className="portal-stepflow__actions" onSubmit={handleSubmit}>
            {step !== 'fields' ? (
              <a className="portal-button portal-button--secondary" href={`${basePath}/${previousStep(step)}`}>
                Volver
              </a>
            ) : null}

            {step === 'fields' ? (
              <button
                className="portal-button portal-button--primary"
                type="button"
                disabled={!hasSelectedFields || capabilityStatus !== 'REAL'}
                onClick={() => window.location.assign(`${basePath}/values`)}
              >
                Continuar a cambios
              </button>
            ) : null}

            {step === 'values' ? (
              <button
                className="portal-button portal-button--primary"
                type="button"
                disabled={!hasSelectedFields || !hasChanges || capabilityStatus !== 'REAL'}
                onClick={() => window.location.assign(`${basePath}/review`)}
              >
                Revisar cambios
              </button>
            ) : null}

            {step === 'review' ? (
              <button
                className="portal-button portal-button--primary"
                type="submit"
                disabled={!hasSelectedFields || !hasChanges || state === 'submitting' || capabilityStatus !== 'REAL'}
              >
                {state === 'submitting' ? 'Enviando…' : 'Enviar revisión'}
              </button>
            ) : null}

            {step === 'success' ? (
              <a className="portal-button portal-button--primary" href={returnPath}>
                Volver a la vista
              </a>
            ) : null}
          </form>
        </section>

        <section className="portal-request-history" aria-label={scope === 'profile' ? 'Solicitudes de perfil' : 'Solicitudes de propiedad'}>
          <h3>Solicitudes recientes</h3>
          {requestHistory.length > 0 ? (
            <div className="portal-record-list">
              {requestHistory.map((item) => (
                <article key={item.reference} className="portal-record">
                  <div>
                    <h4>{item.referenceLabel}</h4>
                    <p>{item.fieldSummaryLabel}</p>
                  </div>
                  <span className="portal-status portal-status--info">{item.statusLabel}</span>
                </article>
              ))}
            </div>
          ) : (
            <section className="portal-empty-state">
              <p>No hay solicitudes activas.</p>
            </section>
          )}
        </section>
      </div>
    </section>
  )
}

function buildProfileFields(profile: PortalProfileSnapshot): ChangeFieldDefinition[] {
  return [
    { key: 'fullName', label: 'Nombre completo', autoComplete: 'name', currentValue: profile.fullName },
    { key: 'phone', label: 'Teléfono', autoComplete: 'tel', inputMode: 'tel', currentValue: profile.phone },
    { key: 'email', label: 'Email', autoComplete: 'email', inputMode: 'email', currentValue: profile.email },
    { key: 'taxId', label: 'NIF/CIF', autoComplete: 'off', currentValue: profile.taxId },
    { key: 'billingAddress', label: 'Dirección de facturación', autoComplete: 'street-address', currentValue: profile.billingAddress },
  ]
}

function buildPropertyFields(property: PortalPropertyDetail | null): ChangeFieldDefinition[] {
  if (!property) return []
  return [
    { key: 'name', label: 'Nombre', autoComplete: 'off', currentValue: property.name },
    { key: 'propertyType', label: 'Tipo de propiedad', autoComplete: 'off', currentValue: property.propertyType },
    { key: 'address', label: 'Dirección', autoComplete: 'street-address', currentValue: property.address },
    { key: 'city', label: 'Ciudad', autoComplete: 'address-level2', currentValue: property.city },
    { key: 'postalCode', label: 'Código postal', autoComplete: 'postal-code', inputMode: 'numeric', currentValue: property.postalCode },
  ]
}

function writeStoredIntent(storageKey: string, intent: StoredPortalChangeIntent) {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(storageKey, JSON.stringify(intent))
}

function getStepState(
  stepKey: ChangeStep,
  currentStep: ChangeStep,
  hasSelectedFields: boolean,
  hasChanges: boolean,
  receipt: PortalReviewedChangeReceipt | null,
): 'complete' | 'current' | 'blocked' | 'pending' {
  const currentIndex = stepOrder.indexOf(currentStep)
  const stepIndex = stepOrder.indexOf(stepKey)
  if (stepKey === 'success') {
    return receipt ? 'complete' : 'pending'
  }
  if (stepIndex < currentIndex) return 'complete'
  if (stepKey === 'fields') return 'current'
  if (stepKey === 'values') return hasSelectedFields ? (stepKey === currentStep ? 'current' : 'pending') : 'blocked'
  if (stepKey === 'review') return hasSelectedFields && hasChanges ? (stepKey === currentStep ? 'current' : 'pending') : 'blocked'
  return 'pending'
}

function resolveChangeStep(pathname: string): ChangeStep {
  if (pathname.endsWith('/values')) return 'values'
  if (pathname.endsWith('/review')) return 'review'
  if (pathname.endsWith('/success')) return 'success'
  return 'fields'
}

function previousStep(step: ChangeStep): ChangeStep {
  if (step === 'success') return 'review'
  if (step === 'review') return 'values'
  return 'fields'
}

function formatDateTime(value: string) {
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
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

const stepOrder: ChangeStep[] = ['fields', 'values', 'review', 'success']
