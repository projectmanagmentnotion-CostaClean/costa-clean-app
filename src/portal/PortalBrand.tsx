export function PortalBrand({ variant }: { variant?: 'auth' }) {
  return (
    <div className={`portal-brand${variant ? ` portal-brand--${variant}` : ''}`}>
      <img
        src={variant === 'auth' ? '/branding/Costa_Clean-LOGO-AZUL.png' : '/branding/logo-costa-clean.svg'}
        alt="Costa Clean"
        className="portal-brand__logo"
        width={variant === 'auth' ? 5952 : 64}
        height={variant === 'auth' ? 4380 : 46}
        fetchPriority="high"
      />
      {variant === 'auth' ? <span className="portal-brand__name">Costa Clean.</span> : null}
      <span className="portal-brand__surface">Área de clientes</span>
    </div>
  )
}
