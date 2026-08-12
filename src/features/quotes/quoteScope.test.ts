import { describe, expect, it } from 'vitest'
import { formatQuoteLabel } from '../../app/relationshipLabels'
import { buildQuoteScopeLabel } from './quoteScope'

describe('quote scope handling', () => {
  it('uses quote notes as the commercial scope and ignores line concepts', () => {
    const quote = {
      id: 'QUOTE-1',
      display_code: 'QUO-0001',
      notes: 'Servicio de camareros',
      quote_lines: [
        { concept: 'Jornada 8 horas · Días trabajados: 18, 19, 22 y 23 de agosto' },
      ],
    }

    expect(buildQuoteScopeLabel(quote as never)).toBe('Servicio de camareros')
    expect(formatQuoteLabel(quote as never)).toBe('QUO-0001 - Servicio de camareros')
  })

  it('does not fall back to the first quote line concept when notes are missing', () => {
    const quote = {
      id: 'QUOTE-2',
      display_code: 'QUO-0002',
      notes: null,
      quote_lines: [
        { concept: 'Jornada 9 horas · Días trabajados: 20 y 21 de agosto' },
      ],
    }

    expect(buildQuoteScopeLabel(quote as never)).toBe('Sin alcance definido')
    expect(formatQuoteLabel(quote as never)).toBe('QUO-0002')
  })
})
