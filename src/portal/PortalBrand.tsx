import { brandAssets } from '../v3/brand/brandAssets'

export function PortalBrand() {
  return (
    <div className="portal-brand">
      <img
        src={brandAssets.logoPrimary.src}
        alt="Costa Clean"
        className="portal-brand__logo"
      />
      <span className="portal-brand__surface">Área de clientes</span>
    </div>
  )
}
