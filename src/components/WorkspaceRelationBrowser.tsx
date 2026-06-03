import { useMemo, useState, type ReactNode } from 'react'

export interface WorkspaceRelationAction {
  key: string
  label: string
  onClick: () => void
  tone?: 'primary' | 'default'
}

export interface WorkspaceRelationField {
  label: string
  value: string
}

export interface WorkspaceRelationItem {
  id: string
  title: string
  subtitle?: string
  statusLabel?: string
  context?: string
  rowMeta?: string[]
  detailSummary?: string
  detailFields: WorkspaceRelationField[]
  actions?: WorkspaceRelationAction[]
  detailBody?: ReactNode
}

interface WorkspaceRelationBrowserProps {
  ariaLabel: string
  emptyTitle: string
  emptyDescription: string
  items: WorkspaceRelationItem[]
}

export function WorkspaceRelationBrowser({
  ariaLabel,
  emptyTitle,
  emptyDescription,
  items,
}: WorkspaceRelationBrowserProps) {
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null)
  const normalizedSelectedId = selectedId && items.some((item) => item.id === selectedId)
    ? selectedId
    : (items[0]?.id ?? null)

  const selectedItem = useMemo(
    () => items.find((item) => item.id === normalizedSelectedId) ?? items[0] ?? null,
    [items, normalizedSelectedId],
  )

  if (items.length === 0) {
    return (
      <section className="cc-workspace-browser cc-workspace-browser--empty">
        <div className="empty-state">
          <strong>{emptyTitle}</strong>
          <p>{emptyDescription}</p>
        </div>
      </section>
    )
  }

  return (
    <section className="cc-workspace-browser">
      <div className="cc-workspace-browser__list" role="listbox" aria-label={ariaLabel}>
        {items.map((item) => {
          const isSelected = item.id === selectedItem?.id

          return (
            <article
              key={item.id}
              className={isSelected ? 'cc-workspace-browser__row is-selected' : 'cc-workspace-browser__row'}
            >
              <button
                type="button"
                className="cc-workspace-browser__row-main"
                aria-pressed={isSelected}
                onClick={() => setSelectedId(item.id)}
              >
                <div className="cc-workspace-browser__row-head">
                  <div className="cc-workspace-browser__row-copy">
                    <strong>{item.title}</strong>
                    {item.subtitle ? <span>{item.subtitle}</span> : null}
                  </div>
                  {item.statusLabel ? <span className="lead-badge">{item.statusLabel}</span> : null}
                </div>

                {item.context ? <p className="cc-workspace-browser__row-context">{item.context}</p> : null}

                {item.rowMeta?.length ? (
                  <div className="cc-workspace-browser__row-meta">
                    {item.rowMeta.map((meta) => (
                      <span key={meta}>{meta}</span>
                    ))}
                  </div>
                ) : null}
              </button>

              {item.actions?.length ? (
                <div className="cc-workspace-browser__row-actions">
                  {item.actions.map((action) => (
                    <button
                      key={action.key}
                      type="button"
                      className={action.tone === 'primary' ? 'cc-record-card__inline-action is-primary' : 'cc-record-card__inline-action'}
                      onClick={action.onClick}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </article>
          )
        })}
      </div>

      {selectedItem ? (
        <aside className="data-section cc-workspace-browser__detail">
          <div className="cc-workspace-browser__detail-header">
            <div className="cc-workspace-browser__detail-copy">
              <span className="cc-client-workspace__eyebrow">Seleccionado</span>
              <h3>{selectedItem.title}</h3>
              {selectedItem.subtitle ? <p>{selectedItem.subtitle}</p> : null}
            </div>
            {selectedItem.statusLabel ? <span className="lead-badge">{selectedItem.statusLabel}</span> : null}
          </div>

          {selectedItem.context ? <p className="cc-workspace-browser__detail-context">{selectedItem.context}</p> : null}
          {selectedItem.detailSummary ? <p className="cc-workspace-browser__detail-summary">{selectedItem.detailSummary}</p> : null}

          <div className="cc-workspace-browser__detail-grid">
            {selectedItem.detailFields.map((field) => (
              <div key={`${selectedItem.id}-${field.label}`} className="detail-row">
                <span className="detail-label">{field.label}</span>
                <strong>{field.value}</strong>
              </div>
            ))}
          </div>

          {selectedItem.detailBody ? (
            <div className="cc-workspace-browser__detail-body">
              {selectedItem.detailBody}
            </div>
          ) : null}

          {selectedItem.actions?.length ? (
            <div className="cc-workspace-browser__detail-actions">
              {selectedItem.actions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  className={action.tone === 'primary' ? 'cc-record-card__inline-action is-primary' : 'cc-record-card__inline-action'}
                  onClick={action.onClick}
                >
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}
        </aside>
      ) : null}
    </section>
  )
}
