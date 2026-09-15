import { describe, expect, it } from 'vitest'
import { COSTA_CLEAN_BRAND_PRIMITIVES, brandAssets } from './brandAssets'

describe('Costa Clean brand registry', () => {
  it('keeps official primitives separate and explicit', () => {
    expect(COSTA_CLEAN_BRAND_PRIMITIVES).toEqual({ blue: '#00AEF0', black: '#000000', white: '#FFFFFF' })
  })

  it('contains only local branding paths with accessible alt text', () => {
    for (const asset of Object.values(brandAssets)) {
      expect(asset.src).toMatch(/^\/branding\//)
      expect(asset.src).not.toMatch(/^https?:/)
      expect(asset.alt).toBe('Costa Clean')
    }
  })
})
