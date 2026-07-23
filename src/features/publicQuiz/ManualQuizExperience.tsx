import { useRef, useState } from 'react'
import { createQuizAttempt } from './manualQuizApi'
import { gymManualQuizQuestions, PASSING_PERCENTAGE } from './quizQuestions'
import {
  normalizePublicQuizWorkerName,
  PUBLIC_QUIZ_VERSION,
  type PublicQuizQuestionId,
} from '../../../supabase/functions/_shared/publicQuizContract'
import type { PublicQuizDisplayResult, PublicQuizErrorReview } from './types'

type QuizStep = 'intro' | 'quiz' | 'result'

function formatAttemptStatus(passed: boolean) {
  return passed ? 'Aprobado' : 'No aprobado'
}

export function ManualQuizExperience() {
  const [step, setStep] = useState<QuizStep>('intro')
  const [workerName, setWorkerName] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<PublicQuizDisplayResult | null>(null)
  const [honeypot, setHoneypot] = useState('')
  const interactionStartedAt = useRef<number | null>(null)

  function handleStart() {
    const normalizedName = normalizePublicQuizWorkerName(workerName)

    if (normalizedName.length < 2) {
      setNameError('Escribe tu nombre para comenzar.')
      return
    }

    setWorkerName(normalizedName)
    setNameError(null)
    interactionStartedAt.current = Date.now()
    setStep('quiz')
  }

  function handleSelectAnswer(questionId: string, optionId: string) {
    setAnswers((current) => ({
      ...current,
      [questionId]: optionId,
    }))
  }

  async function handleSubmit() {
    if (Object.keys(answers).length !== gymManualQuizQuestions.length) {
      setSubmitError('Debes responder todas las preguntas antes de enviar.')
      return
    }

    const startedAt = interactionStartedAt.current
    if (startedAt === null) {
      setSubmitError('No se pudo preparar el envío. Vuelve a comenzar la prueba.')
      return
    }

    try {
      setIsSubmitting(true)
      setSubmitError(null)

      const authoritativeResult = await createQuizAttempt({
        workerName,
        quizVersion: PUBLIC_QUIZ_VERSION,
        answers: answers as Record<PublicQuizQuestionId, 'a' | 'b' | 'c' | 'd'>,
        honeypot: honeypot as '',
        interactionStartedAt: startedAt,
        interactionDurationMs: Date.now() - startedAt,
        requestNonce: crypto.randomUUID(),
      })

      setResult({
        ...authoritativeResult,
        errors: buildErrorReview(authoritativeResult.incorrectQuestionIds, answers),
      })
      setStep('result')
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'No se pudo guardar el examen.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const answeredCount = Object.keys(answers).length
  const completionPercentage = Math.round((answeredCount / gymManualQuizQuestions.length) * 100)

  return (
    <div className="cc-public-quiz-layout">
      <section className="cc-public-quiz-panel cc-public-quiz-panel--intro">
        <div className="cc-public-quiz-heading">
          <p>Prueba operativa</p>
          <h1>Evaluación del manual de limpieza de gimnasio</h1>
          <span>
            Escribe tu nombre, responde la prueba completa y revisa tu resultado al instante.
            Aprobado con {PASSING_PERCENTAGE}% o más.
          </span>
        </div>

        {step === 'intro' ? (
          <div className="cc-public-quiz-start">
            <label className="cc-public-quiz-field">
              <span>Nombre del trabajador</span>
              <input
                type="text"
                name="workerName"
                value={workerName}
                onChange={(event) => setWorkerName(event.target.value)}
                placeholder="Escribe tu nombre completo"
                autoComplete="name"
              />
            </label>

            {nameError ? (
              <div className="cc-public-quiz-message cc-public-quiz-message--error">
                <strong>No se puede comenzar</strong>
                <p>{nameError}</p>
              </div>
            ) : null}

            <button type="button" className="cc-public-quiz-button cc-public-quiz-button--primary" onClick={handleStart}>
              Comenzar prueba
            </button>
          </div>
        ) : null}

        {step === 'quiz' ? (
          <div className="cc-public-quiz-flow">
            <div className="cc-public-quiz-progress" aria-label="Progreso de la prueba">
              <div className="cc-public-quiz-progress__meta">
                <strong>{workerName}</strong>
                <span>{answeredCount} de {gymManualQuizQuestions.length} respondidas</span>
              </div>
              <div className="cc-public-quiz-progress__bar" aria-hidden="true">
                <span style={{ width: `${completionPercentage}%` }} />
              </div>
            </div>

            <div className="cc-public-quiz-questions">
              {gymManualQuizQuestions.map((question, index) => (
                <article key={question.id} className="cc-public-quiz-question">
                  <div className="cc-public-quiz-question__header">
                    <span>Pregunta {index + 1}</span>
                    <strong>{question.topic}</strong>
                  </div>
                  <h2>{question.prompt}</h2>
                  <div className="cc-public-quiz-options" role="radiogroup" aria-label={question.prompt}>
                    {question.options.map((option) => {
                      const isSelected = answers[question.id] === option.id
                      return (
                        <button
                          key={option.id}
                          type="button"
                          className={isSelected ? 'cc-public-quiz-option is-selected' : 'cc-public-quiz-option'}
                          onClick={() => handleSelectAnswer(question.id, option.id)}
                          aria-pressed={isSelected}
                        >
                          <span>{option.id.toUpperCase()}</span>
                          <strong>{option.label}</strong>
                        </button>
                      )
                    })}
                  </div>
                </article>
              ))}
            </div>

            <label className="cc-public-quiz-honeypot" aria-hidden="true">
              No rellenar este campo
              <input
                type="text"
                name="companyWebsite"
                value={honeypot}
                onChange={(event) => setHoneypot(event.target.value)}
                tabIndex={-1}
                autoComplete="off"
              />
            </label>

            {submitError ? (
              <div className="cc-public-quiz-message cc-public-quiz-message--error" role="alert" aria-live="polite">
                <strong>No se pudo enviar</strong>
                <p>{submitError}</p>
              </div>
            ) : null}

            <button
              type="button"
              className="cc-public-quiz-button cc-public-quiz-button--primary"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Enviando...' : 'Enviar prueba'}
            </button>
          </div>
        ) : null}

        {step === 'result' && result ? (
          <div className="cc-public-quiz-result">
            <div className={result.passed ? 'cc-public-quiz-score is-pass' : 'cc-public-quiz-score is-fail'}>
              <p>{workerName}</p>
              <h2>{formatAttemptStatus(result.passed)}</h2>
              <strong>{result.score} / {result.totalQuestions}</strong>
              <span>{result.percentage}%</span>
            </div>

            <div className="cc-public-quiz-summary">
              <p><strong>Nombre:</strong> {workerName}</p>
              <p><strong>Puntuación:</strong> {result.score} de {result.totalQuestions}</p>
              <p><strong>Porcentaje:</strong> {result.percentage}%</p>
              <p><strong>Estado:</strong> {formatAttemptStatus(result.passed)}</p>
            </div>

            <section className="cc-public-quiz-review" aria-labelledby="quiz-review-title">
              <div className="cc-public-quiz-section-heading">
                <p>Repaso</p>
                <h3 id="quiz-review-title">Errores y respuestas correctas</h3>
              </div>

              {result.errors.length === 0 ? (
                <div className="cc-public-quiz-message cc-public-quiz-message--success">
                  <strong>Sin errores</strong>
                  <p>Respondiste correctamente todas las preguntas.</p>
                </div>
              ) : (
                <div className="cc-public-quiz-error-list">
                  {result.errors.map((error) => (
                    <article key={error.questionId} className="cc-public-quiz-error-card">
                      <strong>{error.prompt}</strong>
                      <p><span>Tu respuesta:</span> {error.selectedOptionLabel}</p>
                      <p><span>Respuesta correcta:</span> {error.correctOptionLabel}</p>
                      <p><span>Repasar:</span> {error.topic}</p>
                      <p>{error.explanation}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : null}
      </section>

      <section className="cc-public-quiz-panel cc-public-quiz-panel--attempts" aria-labelledby="quiz-privacy-title">
        <div className="cc-public-quiz-section-heading">
          <p>Privacidad</p>
          <h2 id="quiz-privacy-title">Tu resultado es privado</h2>
        </div>

        <p className="cc-public-quiz-muted">
          Solo veras el resultado del intento que acabas de completar. El historial queda reservado al equipo autenticado.
        </p>
      </section>
    </div>
  )
}

function buildErrorReview(
  incorrectQuestionIds: PublicQuizQuestionId[],
  answers: Record<string, string>,
): PublicQuizErrorReview[] {
  return incorrectQuestionIds.flatMap((questionId) => {
    const question = gymManualQuizQuestions.find((item) => item.id === questionId)
    if (!question) return []
    const selectedOptionId = answers[questionId] ?? null
    const selectedOption = question.options.find((option) => option.id === selectedOptionId)
    const correctOption = question.options.find((option) => option.id === question.correctOptionId)
    return [{
      questionId,
      topic: question.topic,
      prompt: question.prompt,
      selectedOptionId,
      selectedOptionLabel: selectedOption?.label ?? 'Sin respuesta',
      correctOptionId: question.correctOptionId,
      correctOptionLabel: correctOption?.label ?? '',
      explanation: question.explanation,
    }]
  })
}
