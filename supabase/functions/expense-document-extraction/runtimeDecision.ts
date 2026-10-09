export type ExistingExtractionDecision = 'REUSE' | 'FAILED' | 'DISPATCH' | 'PROCESSING'

export const resolveExistingExtractionDecision = (status: string, claimWon = false): ExistingExtractionDecision => {
  if (status === 'SUCCEEDED') return 'REUSE'
  if (status === 'FAILED') return 'FAILED'
  if (status === 'PENDING' && claimWon) return 'DISPATCH'
  return 'PROCESSING'
}
