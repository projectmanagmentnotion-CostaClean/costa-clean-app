import { describe, expect, it } from 'vitest'
import { buildCsv } from './csvExport'

describe('buildCsv', () => {
  it('adds a UTF-8 BOM and escapes values for spreadsheet import', () => {
    expect(buildCsv(['Nombre', 'Nota'], [['Costa Clean', '"Revisar", urgente']])).toBe(
      '\uFEFF"Nombre","Nota"\n"Costa Clean","""Revisar"", urgente"',
    )
  })
})
