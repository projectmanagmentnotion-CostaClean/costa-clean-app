import { describe, expect, it } from 'vitest'
import { buildV3ListWindow } from './useV3ListWindow'

describe('V3 list window', () => {
  it.each([100, 500, 1000])('caps the rendered collection at 25 rows for %i records', (size) => {
    const result = buildV3ListWindow(Array.from({ length: size }, (_, index) => index + 1), 1)
    expect(result.pageItems).toHaveLength(25)
    expect(result.rangeStart).toBe(1)
    expect(result.rangeEnd).toBe(25)
    expect(result.totalCount).toBe(size)
  })

  it('supports the final page without leaking rows or ranges', () => {
    const result = buildV3ListWindow(Array.from({ length: 1000 }, (_, index) => index), 40)
    expect(result.pageCount).toBe(40)
    expect(result.pageItems).toHaveLength(25)
    expect(result.pageItems[0]).toBe(975)
    expect(result.rangeStart).toBe(976)
    expect(result.rangeEnd).toBe(1000)
  })

  it('clamps a stale page after a search or filter shrinks the result', () => {
    const result = buildV3ListWindow(Array.from({ length: 12 }, (_, index) => index), 4)
    expect(result.page).toBe(1)
    expect(result.pageItems).toHaveLength(12)
    expect(result.rangeStart).toBe(1)
    expect(result.rangeEnd).toBe(12)
  })

  it('renders an empty result as an honest zero range', () => {
    const result = buildV3ListWindow([], 3)
    expect(result.pageCount).toBe(1)
    expect(result.rangeStart).toBe(0)
    expect(result.rangeEnd).toBe(0)
    expect(result.pageItems).toEqual([])
  })
})
