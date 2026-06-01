import type { QuizQuestion } from './quizQuestions'

export interface PublicQuizAttempt {
  id: string
  nombre_trabajador: string
  puntuacion: number
  porcentaje: number
  aprobado: boolean
  fecha: string
  respuestas_json: Record<string, string>
  errores_json: PublicQuizErrorReview[]
  total_preguntas: number
}

export interface PublicQuizErrorReview {
  questionId: string
  topic: string
  prompt: string
  selectedOptionId: string | null
  selectedOptionLabel: string
  correctOptionId: string
  correctOptionLabel: string
  explanation: string
}

export interface PublicQuizComputedResult {
  score: number
  percentage: number
  passed: boolean
  totalQuestions: number
  answerMap: Record<string, string>
  errors: PublicQuizErrorReview[]
}

export function buildQuizResult(
  questions: QuizQuestion[],
  answerMap: Record<string, string>,
  passingPercentage: number,
): PublicQuizComputedResult {
  let score = 0
  const errors: PublicQuizErrorReview[] = []

  for (const question of questions) {
    const selectedOptionId = answerMap[question.id] ?? null
    const correctOption = question.options.find((option) => option.id === question.correctOptionId)
    const selectedOption = question.options.find((option) => option.id === selectedOptionId)

    if (selectedOptionId === question.correctOptionId) {
      score += 1
      continue
    }

    errors.push({
      questionId: question.id,
      topic: question.topic,
      prompt: question.prompt,
      selectedOptionId,
      selectedOptionLabel: selectedOption?.label ?? 'Sin respuesta',
      correctOptionId: question.correctOptionId,
      correctOptionLabel: correctOption?.label ?? '',
      explanation: question.explanation,
    })
  }

  const totalQuestions = questions.length
  const percentage = Math.round((score / totalQuestions) * 100)

  return {
    score,
    percentage,
    passed: percentage >= passingPercentage,
    totalQuestions,
    answerMap,
    errors,
  }
}
