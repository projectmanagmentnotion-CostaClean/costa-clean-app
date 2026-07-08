import { useContext, useId, useRef } from 'react'
import { gsap, useGSAP } from '../design-system/motion'
import { createMotionPreset, getReducedMotionSetVars } from '../design-system/motion/motionPresets'
import { useReducedMotion } from '../design-system/motion/useReducedMotion'
import type {
  StepFlowStatus,
  StepFlowStep,
  StepFlowSummaryItem,
  StepFlowSurfaceProps,
} from '../features/stepflow/types'
import { NestedFlowSurfaceContext } from './NestedFlowSurfaceContext'
import './fullscreen-step-flow.css'

export type FullscreenStepFlowStep = StepFlowStep
export type FullscreenStepFlowContextItem = StepFlowSummaryItem
export type FullscreenStepFlowProps = StepFlowSurfaceProps

function getStepStateLabel(state: StepFlowStatus, isCurrent: boolean): string {
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
  const surfaceRef = useRef<HTMLElement | null>(null)
  const currentStepRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const footerRef = useRef<HTMLElement | null>(null)
  const prefersReducedMotion = useReducedMotion()
  const titleId = useId()
  const descriptionId = useId()
  const currentStepId = useId()
  const current = steps[currentStep]
  const completionRatio = ((currentStep + 1) / steps.length) * 100
  const remainingSteps = steps.length - (currentStep + 1)
  const currentState = stepStates?.[currentStep] ?? 'current'
  const currentStateLabel = getStepStateLabel(currentState, true)
  const shouldShowSideContent = !isNested && Boolean(sideContent)
  const shouldShowMobileSide = Boolean(contextItems.length > 0 || shouldShowSideContent)
  const shouldUseDenseDesktopHeader = !isNested && steps.length > 6
  const shouldShowDesktopContextStrip = contextItems.length > 0 && !(shouldUseDenseDesktopHeader && shouldShowSideContent)
  const surfaceClassName = [
    'cc-step-flow',
    isNested ? 'cc-step-flow--nested' : null,
    shouldUseDenseDesktopHeader ? 'cc-step-flow--dense-header' : null,
  ].filter(Boolean).join(' ')

  useGSAP(() => {
    if (!surfaceRef.current || !currentStepRef.current || !contentRef.current) return

    const targets = footerRef.current
      ? [currentStepRef.current, contentRef.current, footerRef.current]
      : [currentStepRef.current, contentRef.current]

    if (prefersReducedMotion) {
      gsap.set(targets, getReducedMotionSetVars())
      return
    }

    const stepMotion = createMotionPreset('stepTransition', {
      duration: currentStep === 0 ? 0.22 : 0.2,
      x: currentStep === 0 ? 12 : 10,
    })

    gsap.fromTo(targets, stepMotion.from, {
      ...stepMotion.to,
      stagger: 0.03,
    })
  }, { dependencies: [currentStep, prefersReducedMotion], scope: surfaceRef, revertOnUpdate: true })

  return (
    <section
      ref={surfaceRef}
      className={surfaceClassName}
      data-qa="fullscreen-step-flow"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <header className="cc-step-flow__header">
        <div className="cc-step-flow__headline">
          <div className="cc-step-flow__intro">
            <span className="cc-step-flow__eyebrow">{eyebrow}</span>
            <h2 id={titleId}>{title}</h2>
            <p id={descriptionId}>{description}</p>
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
            {current?.description ? <p>{current.description}</p> : null}
          </div>
          <div className="cc-step-flow__mobile-hero-status">
            <span className={`cc-step-flow__mobile-state cc-step-flow__mobile-state--${currentState}`}>
              {currentStateLabel}
            </span>
            <strong>{Math.round(completionRatio)}%</strong>
          </div>
        </div>

        {shouldShowDesktopContextStrip ? (
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
                aria-label={`Paso ${index + 1} de ${steps.length}: ${step.label}. ${getStepStateLabel(state, index === currentStep)}.`}
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
                aria-label={`Paso ${index + 1} de ${steps.length}: ${step.label}. ${getStepStateLabel(state, index === currentStep)}.`}
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
          <div
            ref={currentStepRef}
            className="cc-step-flow__current-step"
            id={currentStepId}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <span>Paso {currentStep + 1}</span>
            <strong>{current?.label}</strong>
            <small>{current?.description}</small>
          </div>
          <div ref={contentRef} className="cc-step-flow__content">
            {children}

            {shouldShowMobileSide ? (
              <details className="cc-step-flow__mobile-side">
                <summary className="cc-step-flow__mobile-side-summary" aria-describedby={currentStepId}>
                  <div className="cc-step-flow__mobile-side-copy">
                    <span>Resumen</span>
                    <strong>Ver contexto</strong>
                  </div>
                  <span className="cc-step-flow__mobile-side-toggle">Abrir</span>
                </summary>

                <div className="cc-step-flow__mobile-side-body">
                  {contextItems.length > 0 ? (
                    <section className="cc-step-flow__context cc-step-flow__context--mobile">
                      <div className="cc-step-flow__context-head">
                        <span>Contexto heredado</span>
                        <strong>Visible en este paso</strong>
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

        <aside className="cc-step-flow__side" aria-label="Contexto del flujo">
          {contextItems.length > 0 ? (
            <section className="cc-step-flow__context">
              <div className="cc-step-flow__context-head">
                <span>Contexto heredado</span>
                <strong>Visible durante el flujo</strong>
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
        <footer ref={footerRef} className="cc-step-flow__footer">
          {footerContent}
        </footer>
      ) : null}
    </section>
  )
}
