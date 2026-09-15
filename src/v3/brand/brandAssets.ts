export type BrandAssetName =
  | 'favicon'
  | 'logoBlue'
  | 'logoWhite'
  | 'logoHorizontal'
  | 'logo'
  | 'icon180'
  | 'icon192'
  | 'icon512'
  | 'webLogo'
  | 'webLogoSvg'
  | 'logoPng'

export interface BrandAsset {
  name: BrandAssetName
  src: `/branding/${string}`
  kind: 'logo' | 'icon'
  background: 'light' | 'dark' | 'any'
  alt: string
}

export const COSTA_CLEAN_BRAND_PRIMITIVES = {
  blue: '#00AEF0',
  black: '#000000',
  white: '#FFFFFF',
} as const

export const brandAssets: Record<BrandAssetName, BrandAsset> = {
  favicon: { name: 'favicon', src: '/branding/Costa_Clean-FAVICON.png', kind: 'icon', background: 'any', alt: 'Costa Clean' },
  logoBlue: { name: 'logoBlue', src: '/branding/Costa_Clean-LOGO-AZUL.png', kind: 'logo', background: 'light', alt: 'Costa Clean' },
  logoWhite: { name: 'logoWhite', src: '/branding/Costa_Clean-LOGO-BLANCO.png', kind: 'logo', background: 'dark', alt: 'Costa Clean' },
  logoHorizontal: { name: 'logoHorizontal', src: '/branding/Costa_Clean-LOGO-HORIZONTAL.png', kind: 'logo', background: 'light', alt: 'Costa Clean' },
  logo: { name: 'logo', src: '/branding/Costa_Clean-LOGO.png', kind: 'logo', background: 'light', alt: 'Costa Clean' },
  icon180: { name: 'icon180', src: '/branding/costaclean-icon-180.png', kind: 'icon', background: 'any', alt: 'Costa Clean' },
  icon192: { name: 'icon192', src: '/branding/costaclean-icon-192.png', kind: 'icon', background: 'any', alt: 'Costa Clean' },
  icon512: { name: 'icon512', src: '/branding/costaclean-icon-512.png', kind: 'icon', background: 'any', alt: 'Costa Clean' },
  webLogo: { name: 'webLogo', src: '/branding/logo-costa-clean-web.png', kind: 'logo', background: 'light', alt: 'Costa Clean' },
  webLogoSvg: { name: 'webLogoSvg', src: '/branding/logo-costa-clean-web.svg', kind: 'logo', background: 'light', alt: 'Costa Clean' },
  logoPng: { name: 'logoPng', src: '/branding/logo-costa-clean.png', kind: 'logo', background: 'light', alt: 'Costa Clean' },
}
