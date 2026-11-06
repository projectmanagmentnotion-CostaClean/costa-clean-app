export interface FiscalPeriodNoteDraft {
  periodKey: string
  value: string
}

export function readFiscalPeriodNote(
  draft: FiscalPeriodNoteDraft | null,
  periodKey: string,
  persistedNote: string | null | undefined,
): string {
  return draft?.periodKey === periodKey ? draft.value : persistedNote ?? ''
}

export function writeFiscalPeriodNote(periodKey: string, value: string): FiscalPeriodNoteDraft {
  return { periodKey, value }
}
