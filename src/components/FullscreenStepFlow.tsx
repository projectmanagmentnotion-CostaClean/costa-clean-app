import { useContext, type ReactNode } from 'react'
import { NestedFlowSurfaceContext } from './NestedFlowSurfaceContext'
import './fullscreen-step-flow.css'

export interface FullscreenStepFlowStep {
  id: string
  label: string
  description: string
}

export interface FullscreenStepFlowContextItem {
  label: string
  value: string
  hint?: string
}

type FullscreenStepState = 'complete' | 'current' | 'blocked' | 'pending'

interface FullscreenStepFlowProps {
  eyebrow: string
  title: string
  description: string
  steps: FullscreenStepFlowStep[]
  currentStep: number
  stepStates?: FullscreenStepState[]
  onStepSelect?: (stepIndex: number) => void
  children: ReactNode
  sideContent?: ReactNode
  footerContent?: ReactNode
  contextItems?: FullscreenStepFlowContextItem[]
}

function getStepStateLabel(state: FullscreenStepState, isCurrent: boolean): string {
  if (state === 'complete') return 'Listo'
  if (state === 'blocked') return 'Bloqueado'
  if (isCurrent) return 'En curso'
  return 'Pendiente'
}

export function FullscreenStepFlow({
  eyebrow,
  title,
  description,
  steps,
  currentStep,
  stepStates,
  onStepSelect,
  children,
  sideContent,
  footerContent,
  contextItems = [],
}: FullscreenStepFlowProps) {
  const isNested = useContext(NestedFlowSurfaceContext)
  const current = steps[currentStep]
  const completionRatio = ((currentStep + 1) / steps.length) * 100
  const remainingSteps = steps.length - (currentStep + 1)
  const currentState = stepStates?.[currentStep] ?? 'current'
  const currentStateLabel = getStepStateLabel(currentState, true)
  const shouldShowSideContent = !isNested && Boolean(sideContent)
  const shouldShowMobileSide = Boolean(contextItems.length > 0 || shouldShowSideContent)

  return (
    <section className={isNested ? 'cc-step-flow cc-step-flow--nested' : 'cc-step-flow'}>
      <header className="cc-step-flow__header">
        <div className="cc-step-flow__headline">
          <div className="cc-step-flow__intro">
            <span className="cc-step-flow__eyebrow">{eyebrow}</span>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>

          <div className="cc-step-flow__hero-meta" aria-label="Resumen del progreso">
            <div className="cc-step-flow__hero-stat">
              <span>Paso actual</span>
              <strong>{currentStep + 1} de {steps.length}</strong>
            </div>
            <div className="cc-step-flow__hero-stat">
              <span>Queda</span>
              <strong>{remainingSteps === 0 ? 'Listo para cerrar' : `${remainingSteps} paso(s)`}</strong>
            </div>
            <div className="cc-step-flow__hero-stat">
              <span>Progreso</span>
              <strong>{Math.round(completionRatio)}%</strong>
            </div>
          </div>
        </div>

        <div className="cc-step-flow__mobile-hero" aria-label="Resumen movil del progreso">
          <div className="cc-step-flow__mobile-hero-copy">
            <span className="cc-step-flow__eyebrow">{eyebrow}</span>
            <h2>{title}</h2>
            <div className="cc-step-flow__mobile-hero-meta">
              <span>Paso {currentStep + 1} de {steps.length}</span>
              <strong>{current?.label}</strong>
            </div>
            <p>{current?.description}</p>
          </div>
          <div className="cc-step-flow__mobile-hero-status">
            <span className={`cc-step-flow__mobile-state cc-step-flow__mobile-state--${currentState}`}>
              {currentStateLabel}
            </span>
            <strong>{Math.round(completionRatio)}%</strong>
          </div>
        </div>

        {contextItems.length > 0 ? (
          <div className="cc-step-flow__context-strip" aria-label="Contexto siempre visible">
            {contextItems.map((item) => (
              <article key={`header-${item.label}-${item.value}`} className="cc-step-flow__context-pill">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>
        ) : null}

        <div className="cc-step-flow__meter" aria-hidden="true">
          <span className="cc-step-flow__meter-bar" style={{ width: `${completionRatio}%` }} />
        </div>

        <div className="cc-step-flow__mobile-progress" aria-label="Progreso movil del flujo">
          {steps.map((step, index) => {
            const state = stepStates?.[index] ?? (
              index < currentStep ? 'complete' : index === currentStep ? 'current' : 'pending'
            )

            return (
              <button
                key={`mobile-${step.id}`}
                type="button"
                className={`cc-step-flow__mobile-progress-step cc-step-flow__mobile-progress-step--${state}`}
                onClick={() => onStepSelect?.(index)}
                disabled={!onStepSelect}
                aria-current={index === currentStep ? 'step' : undefined}
              >
                <span className="cc-step-flow__mobile-progress-index">{index + 1}</span>
                <span className="cc-step-flow__mobile-progress-label">{step.label}</span>
              </button>
            )
          })}
        </div>

        <div className="cc-step-flow__progress" aria-label="Progreso del flujo">
          {steps.map((step, index) => {
            const state = stepStates?.[index] ?? (
              index < currentStep ? 'complete' : index === currentStep ? 'current' : 'pending'
            )

            return (
              <button
                key={step.id}
                type="button"
                className={`cc-step-flow__progress-step cc-step-flow__progress-step--${state}`}
                onClick={() => onStepSelect?.(index)}
                disabled={!onStepSelect}
                aria-current={index === currentStep ? 'step' : undefined}
              >
                <span className="cc-step-flow__progress-index">{index + 1}</span>
                <span className="cc-step-flow__progress-copy">
                  <strong>{step.label}</strong>
                  <small>{step.description}</small>
                </span>
                <span className={`cc-step-flow__progress-state cc-step-flow__progress-state--${state}`}>
                  {getStepStateLabel(state, index === currentStep)}
                </span>
              </button>
            )
          })}
        </div>
      </header>

      <div className="cc-step-flow__layout">
        <div className="cc-step-flow__main">
          <div className="cc-step-flow__current-step">
            <span>Paso {currentStep + 1}</span>
            <strong>{current?.label}</strong>
            <small>{current?.description}</small>
          </div>
          <div className="cc-step-flow__content">
            {children}

            {shouldShowMobileSide ? (
              <details className="cc-step-flow__mobile-side">
                <summary className="cc-step-flow__mobile-side-summary">
                  <div className="cc-step-flow__mobile-side-copy">
                    <span>Contexto y apoyo</span>
                    <strong>Ver resumen del flujo</strong>
                  </div>
                  <span className="cc-step-flow__mobile-side-toggle">Abrir</span>
                </summary>

                <div className="cc-step-flow__mobile-side-body">
                  {contextItems.length > 0 ? (
                    <section className="cc-step-flow__context cc-step-flow__context--mobile">
                      <div className="cc-step-flow__context-head">
                        <span>Contexto heredado</span>
                        <strong>Visible sin salir del paso</strong>
                      </div>
                      <div className="cc-step-flow__context-list">
                        {contextItems.map((item) => (
                          <article key={`mobile-${item.label}-${item.value}`} className="cc-step-flow__context-card">
                            <span>{item.label}</span>
                            <strong>{item.value}</strong>
                            {item.hint ? <small>{item.hint}</small> : null}
                          </article>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {shouldShowSideContent ? sideContent : null}
                </div>
              </details>
            ) : null}
          </div>
        </div>

        <aside className="cc-step-flow__side">
          {contextItems.length > 0 ? (
            <section className="cc-step-flow__context">
              <div className="cc-step-flow__context-head">
                <span>Contexto heredado</span>
                <strong>Visible durante todo el flujo</strong>
              </div>
              <div className="cc-step-flow__context-list">
                {contextItems.map((item) => (
                  <article key={`${item.label}-${item.value}`} className="cc-step-flow__context-card">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                    {item.hint ? <small>{item.hint}</small> : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {shouldShowSideContent ? sideContent : null}
        </aside>
      </div>

      {footerContent ? (
        <footer className="cc-step-flow__footer">
          {footerContent}
        </footer>
      ) : null}
    </section>
  )
}
