import { describe, expect, it } from 'vitest'
import { readFiscalPeriodNote, writeFiscalPeriodNote } from './fiscalPeriodNotes'

describe('fiscal period note contract', () => {
  it('switches between persisted notes without leaking the previous period', () => {
    const draftA = writeFiscalPeriodNote('2026-Q1', 'Nota A editada')

    expect(readFiscalPeriodNote(draftA, '2026-Q1', 'Nota A')).toBe('Nota A editada')
    expect(readFiscalPeriodNote(draftA, '2026-Q2', 'Nota B')).toBe('Nota B')
    expect(readFiscalPeriodNote(draftA, '2026-Q1', 'Nota A')).toBe('Nota A editada')
  })

  it('preserves an empty persisted period and isolates subsequent edits', () => {
    const draftB = writeFiscalPeriodNote('2026', 'Nota B')

    expect(readFiscalPeriodNote(null, '2026', '')).toBe('')
    expect(readFiscalPeriodNote(draftB, '2026', '')).toBe('Nota B')
    expect(readFiscalPeriodNote(draftB, '2025', 'Nota 2025')).toBe('Nota 2025')
  })
})
