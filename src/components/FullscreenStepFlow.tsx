import type { ReactNode } from 'react'
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
  const current = steps[currentStep]
  const completionRatio = ((currentStep + 1) / steps.length) * 100
  const remainingSteps = steps.length - (currentStep + 1)

  return (
    <section className="cc-step-flow">
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
                  {state === 'complete' ? 'Listo' : state === 'blocked' ? 'Bloqueado' : index === currentStep ? 'Ahora' : 'Pendiente'}
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

          {sideContent}
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
