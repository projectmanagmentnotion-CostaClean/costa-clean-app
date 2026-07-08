interface BulkSelectionAction {
  id: string
  label: string
  tone?: 'default' | 'warning'
  disabled?: boolean
  onClick: () => void
}

interface BulkSelectionToolbarProps {
  selectedCount: number
  totalVisibleCount: number
  allVisibleSelected: boolean
  onToggleSelectAllVisible: () => void
  onClearSelection: () => void
  actions: BulkSelectionAction[]
}

export function BulkSelectionToolbar({
  selectedCount,
  totalVisibleCount,
  allVisibleSelected,
  onToggleSelectAllVisible,
  onClearSelection,
  actions,
}: BulkSelectionToolbarProps) {
  const hasSelection = selectedCount > 0

  return (
    <section className="data-section cc-bulk-toolbar" aria-label="Acciones masivas">
      <div className="cc-bulk-toolbar__summary">
        <strong>{hasSelection ? `${selectedCount} seleccionado(s)` : 'Modo seleccion activo'}</strong>
        <span>{hasSelection ? `${totalVisibleCount} visibles en la lista actual` : 'Marca facturas concretas o selecciona todos los visibles para operar en lote.'}</span>
      </div>

      <div className="cc-bulk-toolbar__actions">
        <button
          type="button"
          className="secondary-button"
          onClick={onToggleSelectAllVisible}
        >
          {allVisibleSelected ? 'Quitar visibles' : 'Seleccionar visibles'}
        </button>

        <button
          type="button"
          className="secondary-button"
          onClick={onClearSelection}
        >
          Limpiar seleccion
        </button>

        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            className={action.tone === 'warning' ? 'primary-button cc-confirm-dialog__confirm--warning' : 'primary-button'}
            onClick={action.onClick}
            disabled={action.disabled || !hasSelection}
          >
            {action.label}
          </button>
        ))}
      </div>
    </section>
  )
}
