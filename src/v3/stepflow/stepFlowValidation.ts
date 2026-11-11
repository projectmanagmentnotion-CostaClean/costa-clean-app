export interface StepValidationErrorSnapshot {
  message: string
  revision: string | undefined
}

export function getVisibleStepValidationError(
  error: StepValidationErrorSnapshot | null,
  currentRevision: string | undefined,
): string | null {
  if (!error) return null
  return error.revision === currentRevision ? error.message : null
}
