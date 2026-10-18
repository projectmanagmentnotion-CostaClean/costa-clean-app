import { useEffect, useRef, useState, type ReactNode } from 'react'
import { V3PrimaryAction, V3SecondaryAction } from '../components/V3Primitives'

export interface V3StepDefinition {
  id: string
  title: string
  description?: string
  content: ReactNode
}

interface Props {
  title: string
  steps: V3StepDefinition[]
  onCancel: () => void
  onComplete: () => void | Promise<void>
  validateStep?: (stepIndex: number) => string | null
  error?: string | null
  busy?: boolean
  completeLabel: string
}

export function V3StepFlow({ title, steps, onCancel, onComplete, validateStep, error, busy = false, completeLabel }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [stepError, setStepError] = useState<string | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const current = steps[currentIndex] ?? steps[0]
  const isLast = currentIndex === steps.length - 1
  const progress = steps.length > 1 ? ((currentIndex + 1) / steps.length) * 100 : 100

  useEffect(() => {
    headingRef.current?.focus()
  }, [currentIndex])

  function next() {
    const validationError = validateStep?.(currentIndex) ?? null
    if (validationError) {
      setStepError(validationError)
      return
    }
    setStepError(null)
    if (isLast) {
      void onComplete()
      return
    }
    setCurrentIndex((index) => Math.min(index + 1, steps.length - 1))
  }

  function back() {
    setStepError(null)
    setCurrentIndex((index) => Math.max(index - 1, 0))
  }

  return <div className="v3-step-flow__layer">
    <button type="button" tabIndex={-1} className="v3-step-flow__backdrop" aria-label={`Cerrar ${title}`} onClick={onCancel} />
    <section className="v3-step-flow" role="dialog" aria-modal="true" aria-labelledby="v3-step-flow-title" data-step-body-scroll="0">
      <header className="v3-step-flow__header">
        <div className="v3-step-flow__context"><span className="v3-page-title__eyebrow">Costa Clean · Flujo guiado</span><h1 id="v3-step-flow-title">{title}</h1></div>
        <V3SecondaryAction onClick={onCancel} disabled={busy}>Cancelar</V3SecondaryAction>
      </header>
      <div className="v3-step-flow__progress" aria-label={`Progreso: paso ${currentIndex + 1} de ${steps.length}`}>
        <div className="v3-step-flow__progress-copy"><strong>Paso {currentIndex + 1} de {steps.length}</strong><span>{current.title}</span></div>
        <div className="v3-step-flow__progress-track" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
        <ol className="v3-step-flow__dots" aria-label="Pasos del flujo">{steps.map((step, index) => <li key={step.id} className={index < currentIndex ? 'is-complete' : index === currentIndex ? 'is-current' : ''}><span aria-hidden="true">{index + 1}</span><span className="v3-visually-hidden">{step.title}: {index < currentIndex ? 'completado' : index === currentIndex ? 'actual' : 'pendiente'}</span></li>)}</ol>
      </div>
      <main className="v3-step-flow__body" aria-live="polite">
        <div className="v3-step-flow__step-heading"><h2 ref={headingRef} tabIndex={-1}>{current.title}</h2>{current.description ? <p>{current.description}</p> : null}</div>
        <div className="v3-step-flow__step-body">{current.content}</div>
        {stepError || error ? <p className="v3-inline-message v3-inline-message--error" role="alert">{stepError ?? error}</p> : null}
      </main>
      <footer className="v3-step-flow__actions">
        {currentIndex > 0 ? <V3SecondaryAction onClick={back} disabled={busy}>Atrás</V3SecondaryAction> : <span />}
        <V3PrimaryAction onClick={next} disabled={busy}>{busy ? 'Guardando…' : isLast ? completeLabel : 'Continuar'}</V3PrimaryAction>
      </footer>
    </section>
  </div>
}
