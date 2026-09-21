export type BrandAssetName = 'logoPrimary' | 'brandSymbol' | 'favicon' | 'appIcon180' | 'appIcon192' | 'appIcon512'

export interface BrandAsset {
  name: BrandAssetName
  src: `/branding/${string}`
  kind: 'logo' | 'icon'
  background: 'light' | 'dark' | 'any'
  alt: string
  format: 'png'
  width: number
  height: number
  sha256: string
}

export const COSTA_CLEAN_BRAND_PRIMITIVES = {
  blue: '#00AEF0',
  black: '#000000',
  white: '#FFFFFF',
} as const

export const COSTA_CLEAN_UI_DERIVATIVES = {
  blueAccessibleOnWhite: '#006B8F',
} as const

export const brandAssets: Record<BrandAssetName, BrandAsset> = {
  logoPrimary: { name: 'logoPrimary', src: '/branding/logo-primary.png', kind: 'logo', background: 'light', alt: 'Costa Clean', format: 'png', width: 2558, height: 2317, sha256: 'ab8bfd8f69321e756e639795333e1350922b962c677f38e80d6309a3d25854e6' },
  brandSymbol: { name: 'brandSymbol', src: '/branding/brand-symbol.png', kind: 'icon', background: 'light', alt: 'Costa Clean', format: 'png', width: 2522, height: 2560, sha256: '7170ff85ac6e059f917b4c1c915321228fbb20ed174a5e933a07b82c9b37088b' },
  favicon: { name: 'favicon', src: '/branding/favicon.png', kind: 'icon', background: 'light', alt: 'Costa Clean', format: 'png', width: 64, height: 64, sha256: '4977e26c882da58c4705a849e2ceeaea88909cbd591eb7c3c47fc7fcc042eb9d' },
  appIcon180: { name: 'appIcon180', src: '/branding/app-icon-180.png', kind: 'icon', background: 'light', alt: 'Costa Clean', format: 'png', width: 180, height: 180, sha256: 'dd9119c86ec236fbf64dc819bef49da0fb7cd71e977ef31f85734a8e86a2688e' },
  appIcon192: { name: 'appIcon192', src: '/branding/app-icon-192.png', kind: 'icon', background: 'light', alt: 'Costa Clean', format: 'png', width: 192, height: 192, sha256: '39ffbcf9437a95f95e57a6bbc3b56580028cab9283bc388df60cbfbf2840b805' },
  appIcon512: { name: 'appIcon512', src: '/branding/app-icon-512.png', kind: 'icon', background: 'light', alt: 'Costa Clean', format: 'png', width: 512, height: 512, sha256: 'a1158df2b1bef8e37688423a0d54f2aba2a6347a6791bbd4217b519ffe71973e' },
}
