import { describe, expect, it } from 'vitest'
import { readFiscalPeriodNote, writeFiscalPeriodNote } from './fiscalPeriodNotes'

describe('fiscal period note contract', () => {
  it('switches between persisted notes without leaking a draft into another period', () => {
    const draft = writeFiscalPeriodNote('2026-Q1', 'Nota Q1 editada')

    expect(readFiscalPeriodNote(draft, '2026-Q1', 'Nota Q1')).toBe('Nota Q1 editada')
    expect(readFiscalPeriodNote(draft, '2026-Q2', 'Nota Q2')).toBe('Nota Q2')
    expect(readFiscalPeriodNote(draft, '2026-Q1', 'Nota Q1')).toBe('Nota Q1 editada')
  })

  it('preserves empty persisted notes and scopes annual drafts to their year', () => {
    const draft = writeFiscalPeriodNote('2026', 'Nota anual')

    expect(readFiscalPeriodNote(null, '2026', '')).toBe('')
    expect(readFiscalPeriodNote(draft, '2026', '')).toBe('Nota anual')
    expect(readFiscalPeriodNote(draft, '2025', 'Nota anterior')).toBe('Nota anterior')
  })
})
