import { describe, expect, it } from 'vitest'
import { isV3FeatureFlagEnabled } from './useV3FeatureFlag'

describe('V3 presentation flag', () => {
  it('is opt-in and only accepts v3=1', () => {
    expect(isV3FeatureFlagEnabled('')).toBe(false)
    expect(isV3FeatureFlagEnabled('?v3=0')).toBe(false)
    expect(isV3FeatureFlagEnabled('?v3=1')).toBe(true)
  })
})
