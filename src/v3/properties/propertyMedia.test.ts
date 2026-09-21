import { describe, expect, it } from 'vitest'
import { fallbackPropertyMedia, getPropertyMedia } from './propertyMedia'

describe('property media registry', () => {
  it('maps supported types to local WebP assets', () => {
    for (const type of ['apartment', 'house', 'office', 'local', 'tourist_apartment', 'community', 'construction_site']) {
      const media = getPropertyMedia(type)
      expect(media.src).toMatch(/^\/assets\/properties\/.*\.webp$/)
      expect(media.src).not.toMatch(/^https?:/)
      expect(media.alt).toBeTruthy()
    }
  })

  it('uses a deterministic fallback for unknown and null types', () => {
    expect(getPropertyMedia('unknown')).toEqual(fallbackPropertyMedia)
    expect(getPropertyMedia(null)).toEqual(fallbackPropertyMedia)
  })
})
