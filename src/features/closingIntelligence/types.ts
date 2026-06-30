export interface ClosingIntelligenceSummary {
  executiveSummary: string
  keyRisks: string[]
  recommendedActions: string[]
  missingDataNotes: string[]
  confidenceLevel: 'high' | 'medium' | 'low'
  confidenceNotes: string[]
  assistantNotice: string
  accountantNotes: string[]
  nextSteps: string[]
}

export interface ClosingIntelligenceResponse {
  summary: ClosingIntelligenceSummary
  generated_at: string
  model: string
}
