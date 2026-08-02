import { describe, expect, it } from 'vitest'
import {
  getStitchInitials,
  resolveStitchAvatarSource,
  stitchAssetPaths,
  stitchVisualMetrics,
} from './stitchAssets'

describe('Stitch visual asset helpers', () => {
  it('keeps canonical visual measurements stable', () => {
    expect(stitchVisualMetrics.shell.desktopRail).toBe(72)
    expect(stitchVisualMetrics.shell.desktopTopbar).toBe(64)
    expect(stitchVisualMetrics.shell.mobileDock).toBe(72)
    expect(stitchVisualMetrics.avatar.clientWorkspace).toBe(72)
  })

  it('uses authorized avatar URLs before local fallbacks', () => {
    expect(resolveStitchAvatarSource(' https://example.com/avatar.webp ', 'account'))
      .toBe('https://example.com/avatar.webp')
  })

  it('uses local fallbacks when no avatar is available', () => {
    expect(resolveStitchAvatarSource(null, 'account'))
      .toBe(stitchAssetPaths.avatars.accountFallback)
    expect(resolveStitchAvatarSource('', 'client'))
      .toBe(stitchAssetPaths.avatars.clientFallback)
  })

  it('builds safe initials without inventing profile data', () => {
    expect(getStitchInitials('Marta López')).toBe('ML')
    expect(getStitchInitials('Costa Clean BCN')).toBe('CC')
    expect(getStitchInitials(null)).toBe('CC')
  })
})
