interface BulkSelectionAction {
  id: string
  label: string
  tone?: 'default' | 'warning'
  disabled?: boolean
  onClick: () => void
}

interface BulkSelectionToolbarProps {
  entityLabel?: string
  selectedCount: number
  totalVisibleCount: number
  allVisibleSelected: boolean
  onToggleSelectAllVisible: () => void
  onClearSelection: () => void
  actions: BulkSelectionAction[]
}

export function BulkSelectionToolbar({
  entityLabel = 'registros',
  selectedCount,
  totalVisibleCount,
  allVisibleSelected,
  onToggleSelectAllVisible,
  onClearSelection,
  actions,
}: BulkSelectionToolbarProps) {
  if (selectedCount === 0) return null

  const [primaryAction, ...secondaryActions] = actions

  return (
    <section className="data-section cc-bulk-toolbar cc-bulk-toolbar--active" aria-label={`Acciones masivas para ${selectedCount} ${entityLabel}`}>
      <div className="cc-bulk-toolbar__summary">
        <strong>{selectedCount} seleccionadas</strong>
        <span>{totalVisibleCount} visibles</span>
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

        {primaryAction ? (
          <button
            key={primaryAction.id}
            type="button"
            className={primaryAction.tone === 'warning' ? 'primary-button cc-confirm-dialog__confirm--warning' : 'primary-button'}
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
          >
            {primaryAction.label}
          </button>
        ) : null}

        {secondaryActions.length > 0 ? (
          <details className="cc-bulk-toolbar__more">
            <summary>Más</summary>
            <div className="cc-bulk-toolbar__more-actions">
              {secondaryActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className={action.tone === 'warning' ? 'secondary-button cc-confirm-dialog__confirm--warning' : 'secondary-button'}
                  onClick={action.onClick}
                  disabled={action.disabled}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </section>
  )
}
