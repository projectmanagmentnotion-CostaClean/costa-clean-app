import { describe, expect, it } from 'vitest'
import {
  createInvoicePdfPageRanges,
  getInvoicePdfPageHeightMm,
  type InvoicePdfSemanticBlock,
} from './invoicePdfPagination'

function block(
  id: string,
  start: number,
  end: number,
  kind: InvoicePdfSemanticBlock['kind'] = 'table-row',
): InvoicePdfSemanticBlock {
  return { id, kind, start, end }
}

describe('invoice PDF semantic pagination', () => {
  it('keeps a short invoice on one page', () => {
    expect(createInvoicePdfPageRanges([
      block('header', 0, 160, 'header'),
      block('footer', 160, 540, 'footer'),
    ], 1000, 540)).toEqual([
      { start: 0, end: 540, reason: 'semantic-boundary' },
    ])
  })

  it('breaks between table rows near the page boundary', () => {
    const ranges = createInvoicePdfPageRanges([
      block('header', 0, 150, 'header'),
      block('row-1', 150, 410),
      block('row-2', 410, 690),
      block('row-3', 690, 970),
      block('row-4', 970, 1240),
      block('footer', 1240, 1500, 'footer'),
    ], 1000, 1500)

    expect(ranges).toEqual([
      { start: 0, end: 970, reason: 'semantic-boundary' },
      { start: 970, end: 1500, reason: 'semantic-boundary' },
    ])
    expect(ranges[0].end).toBe(970)
    expect(ranges[1].start).toBe(970)
  })

  it('moves the complete footer to the next page when it cannot fit', () => {
    const ranges = createInvoicePdfPageRanges([
      block('header', 0, 300, 'header'),
      block('row-1', 300, 820),
      block('footer', 820, 1450, 'footer'),
    ], 1000, 1450)

    expect(ranges[0]).toEqual({ start: 0, end: 820, reason: 'semantic-boundary' })
    expect(ranges[1].start).toBe(820)
    expect(ranges[1].end).toBe(1450)
  })

  it('keeps totals, observations and legal note together through the footer block', () => {
    const footer = block('footer', 850, 1400, 'footer')
    const ranges = createInvoicePdfPageRanges([
      block('header', 0, 250, 'header'),
      block('table-row-1', 250, 850),
      footer,
    ], 1000, 1400)

    expect(ranges.map(({ start, end }) => [start, end])).toEqual([[0, 850], [850, 1400]])
  })

  it('supports three or more pages without dropping or duplicating ranges', () => {
    const blocks = Array.from({ length: 9 }, (_, index) => block(
      `row-${index + 1}`,
      index * 300,
      (index + 1) * 300,
    ))
    const ranges = createInvoicePdfPageRanges(blocks, 1000, 2700)

    expect(ranges).toHaveLength(3)
    expect(ranges.map(({ start, end }) => [start, end])).toEqual([[0, 900], [900, 1800], [1800, 2700]])
    expect(ranges[0].end).toBe(ranges[1].start)
    expect(ranges[1].end).toBe(ranges[2].start)
  })

  it('falls back deterministically for a block taller than a complete page', () => {
    expect(createInvoicePdfPageRanges([
      block('oversized-row', 0, 2400),
    ], 1000, 2400)).toEqual([
      { start: 0, end: 1000, reason: 'oversized-block-fallback' },
      { start: 1000, end: 2000, reason: 'oversized-block-fallback' },
      { start: 2000, end: 2400, reason: 'semantic-boundary' },
    ])
  })

  it('preserves every vertical pixel exactly once', () => {
    const ranges = createInvoicePdfPageRanges([
      block('row-1', 0, 450),
      block('row-2', 450, 880),
      block('row-3', 880, 1310),
    ], 800, 1310)

    expect(ranges[0].start).toBe(0)
    expect(ranges.at(-1)?.end).toBe(1310)
    expect(ranges.slice(1).every((range, index) => range.start === ranges[index].end)).toBe(true)
    expect(ranges.reduce((sum, range) => sum + (range.end - range.start), 0)).toBe(1310)
  })

  it('uses a proportional height for the final partial page', () => {
    expect(getInvoicePdfPageHeightMm({ start: 1000, end: 1500 }, 1000)).toBe(148.5)
    expect(getInvoicePdfPageHeightMm({ start: 0, end: 1000 }, 1000)).toBe(297)
  })

  it('covers a long invoice structure without splitting protected panels', () => {
    const rows = Array.from({ length: 16 }, (_, index) => block(
      `row-${index + 1}`,
      300 + index * 72,
      300 + (index + 1) * 72,
    ))
    const footerStart = 300 + rows.length * 72
    const ranges = createInvoicePdfPageRanges([
      block('header', 0, 120, 'header'),
      block('parties', 120, 210, 'parties'),
      block('references', 210, 300, 'references'),
      ...rows,
      block('footer', footerStart, footerStart + 420, 'footer'),
    ], 1000, footerStart + 420)

    expect(ranges.length).toBeGreaterThanOrEqual(2)
    expect(ranges[0].start).toBe(0)
    expect(ranges.at(-1)?.end).toBe(footerStart + 420)
    expect(ranges.slice(1).every((range, index) => range.start === ranges[index].end)).toBe(true)
    const footerRange = ranges.find((range) => range.end === footerStart + 420)
    expect(footerRange).toBeDefined()
    expect(footerRange!.start).toBeLessThanOrEqual(footerStart)
  })
})
