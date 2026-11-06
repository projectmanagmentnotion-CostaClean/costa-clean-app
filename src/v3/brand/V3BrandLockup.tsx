import { brandAssets } from './brandAssets'

export function V3BrandLockup({ compact = false }: { compact?: boolean }) {
  return <div className={`v3-brand-lockup${compact ? ' v3-brand-lockup--compact' : ''}`} data-brand-lockup="CostaClean" aria-label="Costa Clean">
    <img src={brandAssets.brandSymbol.src} alt="" aria-hidden="true" />
    <span>Costa Clean</span>
  </div>
}
