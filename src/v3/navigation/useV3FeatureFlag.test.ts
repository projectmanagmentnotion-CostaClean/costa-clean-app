import { describe, expect, it } from 'vitest'
import { isV3FeatureFlagEnabled } from './useV3FeatureFlag'

describe('V3 presentation flag', () => {
  it('is enabled by default with an explicit v2 escape hatch', () => {
    expect(isV3FeatureFlagEnabled('')).toBe(true)
    expect(isV3FeatureFlagEnabled('?v3=0')).toBe(true)
    expect(isV3FeatureFlagEnabled('?v3=1')).toBe(true)
    expect(isV3FeatureFlagEnabled('?v2=1')).toBe(false)
    expect(isV3FeatureFlagEnabled('?v2=1&v3=1')).toBe(false)
    expect(isV3FeatureFlagEnabled('?view=clients&client=client-1')).toBe(true)
  })
})
