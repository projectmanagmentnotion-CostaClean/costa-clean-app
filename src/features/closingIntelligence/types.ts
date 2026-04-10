export interface ClosingIntelligenceSummary {
  executive_summary: string
  key_risks: string[]
  documentation_warnings: string[]
  suggested_manager_notes: string[]
  suggested_next_actions: string[]
  assistive_notice: string
}

export interface ClosingIntelligenceResponse {
  summary: ClosingIntelligenceSummary
  generated_at: string
  model: string
}

