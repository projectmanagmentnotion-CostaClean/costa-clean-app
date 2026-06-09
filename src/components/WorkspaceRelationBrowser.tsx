import { useMemo, useState, type ReactNode } from 'react'
import { ActionGroup, type ActionGroupItem } from './ActionGroup'

export type WorkspaceRelationAction = ActionGroupItem

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
  const [expandedId, setExpandedId] = useState<string | null>(items[0]?.id ?? null)
  const normalizedSelectedId = selectedId && items.some((item) => item.id === selectedId)
    ? selectedId
    : (items[0]?.id ?? null)
  const normalizedExpandedId = expandedId && items.some((item) => item.id === expandedId)
    ? expandedId
    : (items[0]?.id ?? null)

  const selectedItem = useMemo(
    () => items.find((item) => item.id === normalizedSelectedId) ?? items[0] ?? null,
    [items, normalizedSelectedId],
  )

  function renderDetail(item: WorkspaceRelationItem, mode: 'inline' | 'aside') {
    const isInline = mode === 'inline'

    return (
      <>
        <div className={isInline ? 'cc-workspace-browser__detail-header cc-workspace-browser__detail-header--inline' : 'cc-workspace-browser__detail-header'}>
          <div className="cc-workspace-browser__detail-copy">
            <span className="cc-client-workspace__eyebrow">Situacion actual</span>
            <h3>{item.title}</h3>
            {item.subtitle ? <p>{item.subtitle}</p> : null}
          </div>
          {item.statusLabel ? <span className="lead-badge">{item.statusLabel}</span> : null}
        </div>

        {item.context ? <p className="cc-workspace-browser__detail-context">{item.context}</p> : null}
        {item.detailSummary ? <p className="cc-workspace-browser__detail-summary">{item.detailSummary}</p> : null}

        <div className="cc-workspace-browser__detail-grid">
          {item.detailFields.map((field) => (
            <div key={`${item.id}-${field.label}`} className="detail-row">
              <span className="detail-label">{field.label}</span>
              <strong>{field.value}</strong>
            </div>
          ))}
        </div>

        {item.detailBody ? (
          <div className="cc-workspace-browser__detail-body">
            {item.detailBody}
          </div>
        ) : null}

        {item.actions?.length ? (
          <div className={isInline ? 'cc-workspace-browser__detail-actions cc-workspace-browser__detail-actions--inline' : 'cc-workspace-browser__detail-actions'}>
            <ActionGroup actions={item.actions} />
          </div>
        ) : null}
      </>
    )
  }

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
          const isExpanded = item.id === normalizedExpandedId

          return (
            <article
              key={item.id}
              className={isSelected ? 'cc-workspace-browser__row is-selected' : 'cc-workspace-browser__row'}
            >
              <button
                type="button"
                className="cc-workspace-browser__row-main"
                aria-pressed={isSelected}
                onClick={() => {
                  setSelectedId(item.id)
                  setExpandedId((current) => (current === item.id ? null : item.id))
                }}
              >
                <div className="cc-workspace-browser__row-head">
                  <div className="cc-workspace-browser__row-copy">
                    <strong>{item.title}</strong>
                    {item.subtitle ? <span>{item.subtitle}</span> : null}
                  </div>
                  {item.statusLabel ? <span className="lead-badge">{item.statusLabel}</span> : null}
                </div>

                {isSelected && item.context ? <p className="cc-workspace-browser__row-context">{item.context}</p> : null}

                {item.rowMeta?.length ? (
                  <div className="cc-workspace-browser__row-meta">
                    {item.rowMeta.slice(0, 2).map((meta) => (
                      <span key={meta}>{meta}</span>
                    ))}
                  </div>
                ) : null}
              </button>

              {isSelected && item.actions?.length ? (
                <div className="cc-workspace-browser__row-actions">
                  <ActionGroup actions={item.actions} />
                </div>
              ) : null}

              {isSelected && isExpanded ? (
                <div className="cc-workspace-browser__row-inline-detail">
                  {renderDetail(item, 'inline')}
                </div>
              ) : null}
            </article>
          )
        })}
      </div>

      {selectedItem ? (
        <aside className="data-section cc-workspace-browser__detail">
          {renderDetail(selectedItem, 'aside')}
        </aside>
      ) : null}
    </section>
  )
}
