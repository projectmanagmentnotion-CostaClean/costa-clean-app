interface ModuleFilterBarProps {
  label: string
  onClear: () => void
}

export function ModuleFilterBar({ label, onClear }: ModuleFilterBarProps) {
  return (
    <section className="data-section cc-module-filter-bar" aria-label="Contexto de entrada">
      <div className="cc-module-filter-bar__content">
        <span className="cc-module-filter-bar__eyebrow">Mostrando</span>
        <strong className="cc-module-filter-bar__label">{label}</strong>
      </div>

      <button type="button" className="secondary-button" onClick={onClear}>
        Quitar filtro
      </button>
    </section>
  )
}
