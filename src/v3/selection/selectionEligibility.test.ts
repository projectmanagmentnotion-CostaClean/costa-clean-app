import { describe, expect, it } from 'vitest'
import { getV3SelectionEligibility } from './selectionEligibility'

describe('V3 selection eligibility', () => {
  it('separates eligible and ineligible selected records', () => {
    expect(getV3SelectionEligibility([{ id: 'a', ok: true }, { id: 'b', ok: false }, { id: 'c', ok: true }], ['a', 'b'], (item) => item.ok)).toEqual({ eligibleIds: ['a'], ineligibleIds: ['b'] })
  })
  it('does not include unselected records', () => {
    expect(getV3SelectionEligibility([{ id: 'a', ok: true }], [], () => true)).toEqual({ eligibleIds: [], ineligibleIds: [] })
  })
})
