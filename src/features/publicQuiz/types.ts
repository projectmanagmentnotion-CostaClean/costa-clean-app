import type { PublicQuizResult } from '../../../supabase/functions/_shared/publicQuizContract'

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

export interface PublicQuizDisplayResult extends PublicQuizResult {
  errors: PublicQuizErrorReview[]
}
