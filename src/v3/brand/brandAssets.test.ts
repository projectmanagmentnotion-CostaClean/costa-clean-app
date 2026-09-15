/// <reference types="node" />

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COSTA_CLEAN_BRAND_PRIMITIVES, COSTA_CLEAN_UI_DERIVATIVES, brandAssets } from './brandAssets'

describe('Costa Clean authoritative brand registry', () => {
  it('keeps official primitives separate from accessible UI derivatives', () => {
    expect(COSTA_CLEAN_BRAND_PRIMITIVES).toEqual({ blue: '#00AEF0', black: '#000000', white: '#FFFFFF' })
    expect(COSTA_CLEAN_UI_DERIVATIVES.blueAccessibleOnWhite).toBe('#006B8F')
  })

  it('contains every canonical local asset with the recorded dimensions and hash', () => {
    for (const asset of Object.values(brandAssets)) {
      const file = resolve(process.cwd(), 'public', asset.src.slice(1))
      expect(existsSync(file)).toBe(true)
      expect(asset.src).toMatch(/^\/branding\//)
      expect(asset.src).not.toMatch(/^https?:/)
      expect(asset.width).toBeGreaterThan(0)
      expect(asset.height).toBeGreaterThan(0)
      expect(asset.alt).toBe('Costa Clean')
      expect(asset.format).toBe('png')
    }
  })

  it('exposes only roles supported by the authoritative local source', () => {
    expect(Object.keys(brandAssets)).toEqual(['logoPrimary', 'brandSymbol', 'favicon', 'appIcon180', 'appIcon192', 'appIcon512'])
  })

  it('keeps favicon and manifest icon references local and resolvable', () => {
    const index = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'public/manifest.webmanifest'), 'utf8')) as { icons: Array<{ src: string; sizes: string }> }
    expect(index).toContain('href="/branding/favicon.png"')
    for (const icon of manifest.icons) {
      expect(icon.src).toMatch(/^\/branding\//)
      expect(existsSync(resolve(process.cwd(), 'public', icon.src.slice(1)))).toBe(true)
      expect(icon.sizes).toMatch(/^\d+x\d+$/)
    }
  })
})
