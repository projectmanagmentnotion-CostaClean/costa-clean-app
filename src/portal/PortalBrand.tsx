export function PortalBrand() {
  return (
    <div className="portal-brand">
      <img
        src="/branding/logo-costa-clean.svg"
        alt="Costa Clean"
        className="portal-brand__logo"
        width="64"
        height="46"
        fetchPriority="high"
      />
      <span className="portal-brand__surface">Área de clientes</span>
    </div>
  )
}
