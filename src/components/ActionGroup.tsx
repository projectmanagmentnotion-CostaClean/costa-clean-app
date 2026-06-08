export interface ActionGroupItem {
  key: string
  label: string
  onClick: () => void
  tone?: 'primary' | 'default'
  disabled?: boolean
}

interface ActionGroupProps {
  actions: ActionGroupItem[]
  moreLabel?: string
}

function resolvePrimaryAction(actions: ActionGroupItem[]) {
  return actions.find((action) => action.tone === 'primary') ?? actions[0] ?? null
}

export function ActionGroup({
  actions,
  moreLabel = 'Mas',
}: ActionGroupProps) {
  const primaryAction = resolvePrimaryAction(actions)
  const secondaryActions = primaryAction
    ? actions.filter((action) => action.key !== primaryAction.key)
    : []

  if (!primaryAction) return null

  return (
    <div className="cc-action-group">
      <button
        type="button"
        className={primaryAction.tone === 'primary' ? 'cc-record-card__inline-action is-primary' : 'cc-record-card__inline-action'}
        onClick={primaryAction.onClick}
        disabled={primaryAction.disabled}
      >
        {primaryAction.label}
      </button>

      {secondaryActions.length > 0 ? (
        <details className="cc-action-group__more">
          <summary className="cc-record-card__inline-action">{moreLabel}</summary>
          <div className="cc-action-group__menu">
            {secondaryActions.map((action) => (
              <button
                key={action.key}
                type="button"
                className="cc-action-group__menu-item"
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
  )
}
