import type { ReactNode } from 'react'
import '../features/workspaces/workspaceSurfaceStyles'

interface WorkspaceMetaCard {
  label: string
  value: string
  detail: string
}

interface WorkspaceSnapshotCard {
  label: string
  value: string
  detail: string
}

interface WorkspaceTabItem<TTab extends string> {
  id: TTab
  label: string
}

interface WorkspaceScaffoldProps<TTab extends string> {
  backLabel: string
  eyebrow: string
  kicker: string
  title: string
  subtitle: string
  statusBadge: ReactNode
  statusMeta: string
  metaCards: WorkspaceMetaCard[]
  snapshotCards: WorkspaceSnapshotCard[]
  nextStepTitle: string
  nextStepDetail: string
  heroActions: ReactNode
  tabs: WorkspaceTabItem<TTab>[]
  activeTab: TTab
  onTabChange: (tab: TTab) => void
  tabAriaLabel: string
  onClose: () => void
  overlay?: ReactNode
  children: ReactNode
}

export function WorkspaceScaffold<TTab extends string>({
  backLabel,
  eyebrow,
  kicker,
  title,
  subtitle,
  statusBadge,
  statusMeta,
  metaCards,
  snapshotCards,
  nextStepTitle,
  nextStepDetail,
  heroActions,
  tabs,
  activeTab,
  onTabChange,
  tabAriaLabel,
  onClose,
  overlay,
  children,
}: WorkspaceScaffoldProps<TTab>) {
  return (
    <section className="cc-client-workspace">
      <div className="cc-client-workspace__topline">
        <button type="button" className="secondary-button" onClick={onClose}>
          {backLabel}
        </button>
        <span className="cc-client-workspace__eyebrow">{eyebrow}</span>
      </div>

      <header className="cc-client-workspace__hero">
        <div className="cc-client-workspace__identity">
          <div className="cc-client-workspace__identity-copy">
            <span className="cc-client-workspace__kicker">{kicker}</span>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>

          <div className="cc-client-workspace__status">
            {statusBadge}
            <span className="cc-client-workspace__status-meta">{statusMeta}</span>
          </div>
        </div>

        <div className="cc-client-workspace__meta">
          {metaCards.map((card) => (
            <article key={`${card.label}-${card.value}`} className="cc-client-workspace__meta-card">
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.detail}</small>
            </article>
          ))}
        </div>
      </header>

      <section className="cc-client-workspace__snapshot">
        {snapshotCards.map((card) => (
          <article key={`${card.label}-${card.value}`} className="cc-client-workspace__snapshot-card">
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.detail}</small>
          </article>
        ))}
      </section>

      <section className="cc-client-workspace__next-step">
        <div>
          <span>Siguiente paso recomendado</span>
          <strong>{nextStepTitle}</strong>
          <small>{nextStepDetail}</small>
        </div>
        {heroActions}
      </section>

      <nav className="cc-client-workspace__tabs" aria-label={tabAriaLabel}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={tab.id === activeTab ? 'cc-client-workspace__tab is-active' : 'cc-client-workspace__tab'}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {overlay}
      {children}
    </section>
  )
}
