import { useEffect, useId, useMemo, useRef, useState } from 'react'

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

function MoreActionsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
      <path
        d="M7 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"
        fill="currentColor"
      />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="14" height="14">
      <path
        d="m7 10 5 5 5-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ActionGroup({
  actions,
  moreLabel = 'Mas acciones',
}: ActionGroupProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [collapseSecondaryActions, setCollapseSecondaryActions] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const menuId = useId()
  const primaryAction = resolvePrimaryAction(actions)
  const secondaryActions = useMemo(() => (
    primaryAction
      ? actions.filter((action) => action.key !== primaryAction.key)
      : []
  ), [actions, primaryAction])
  const visibleSecondaryActions = useMemo(
    () => (
      collapseSecondaryActions
        ? []
        : secondaryActions.slice(0, secondaryActions.length > 1 ? 1 : secondaryActions.length)
    ),
    [collapseSecondaryActions, secondaryActions],
  )
  const menuActions = useMemo(
    () => secondaryActions.slice(visibleSecondaryActions.length),
    [secondaryActions, visibleSecondaryActions.length],
  )

  useEffect(() => {
    if (!isMenuOpen) return

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMenuOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMenuOpen])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined
    }

    const mediaQuery = window.matchMedia('(max-width: 1024px)')
    const syncCollapseMode = () => {
      setCollapseSecondaryActions(mediaQuery.matches)
    }

    syncCollapseMode()
    mediaQuery.addEventListener('change', syncCollapseMode)

    return () => {
      mediaQuery.removeEventListener('change', syncCollapseMode)
    }
  }, [])

  if (!primaryAction) return null

  return (
    <div
      ref={rootRef}
      className="cc-action-group"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className={primaryAction.tone === 'primary' ? 'cc-record-card__inline-action is-primary' : 'cc-record-card__inline-action'}
        onClick={primaryAction.onClick}
        disabled={primaryAction.disabled}
      >
        {primaryAction.label}
      </button>

      {visibleSecondaryActions.map((action) => (
        <button
          key={action.key}
          type="button"
          className="cc-record-card__inline-action cc-record-card__inline-action--secondary"
          onClick={action.onClick}
          disabled={action.disabled}
        >
          {action.label}
        </button>
      ))}

      {menuActions.length > 0 ? (
        <div className="cc-action-group__more">
          <button
            type="button"
            className={isMenuOpen ? 'cc-record-card__inline-action cc-action-group__trigger is-open' : 'cc-record-card__inline-action cc-action-group__trigger'}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            aria-controls={menuId}
            onClick={() => setIsMenuOpen((current) => !current)}
          >
            <span className="cc-action-group__trigger-icon" aria-hidden="true">
              <MoreActionsIcon />
            </span>
            <span>{moreLabel}</span>
            <span className="cc-action-group__trigger-caret" aria-hidden="true">
              <ChevronDownIcon />
            </span>
          </button>

          {isMenuOpen ? (
            <div id={menuId} className="cc-action-group__menu" role="menu">
              {menuActions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  role="menuitem"
                  className="cc-action-group__menu-item"
                  onClick={() => {
                    action.onClick()
                    setIsMenuOpen(false)
                  }}
                  disabled={action.disabled}
                >
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
