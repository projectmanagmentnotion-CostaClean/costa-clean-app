export function V3GlobalLoadingState({
  label = 'Preparando tu espacio de trabajo',
  description = 'Cargando sesión y experiencia operativa.',
}: {
  label?: string
  description?: string
}) {
  return (
    <main className="v3-global-state v3-global-state--loading" aria-label="Iniciando CostaClean CRM">
      <section className="v3-global-state__content" role="status" aria-live="polite" aria-busy="true">
        <p className="v3-global-state__eyebrow">CostaClean</p>
        <h1>{label}</h1>
        <p className="v3-global-state__description">{description}</p>
        <span className="v3-global-state__progress" aria-hidden="true" />
      </section>
    </main>
  )
}

export function V3GlobalErrorState() {
  return (
    <main className="v3-global-state v3-global-state--error" aria-label="Error de arranque">
      <section className="v3-global-state__content" role="alert" aria-live="assertive">
        <p className="v3-global-state__eyebrow">CostaClean</p>
        <h1>No se pudo iniciar el espacio de trabajo</h1>
        <p className="v3-global-state__description">
          Recarga la página para volver a intentarlo. No se han modificado tus datos.
        </p>
        <button type="button" className="v3-action v3-action--primary" onClick={() => window.location.reload()}>
          Recargar
        </button>
      </section>
    </main>
  )
}
