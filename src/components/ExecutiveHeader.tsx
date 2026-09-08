import type { ReactNode } from 'react'
import { DSButton } from '../design-system/components/DSButton'
import { SeverityBadge, type SeverityTone } from './SeverityBadge'
import './visual-ux-system.css'

interface HeaderAction {
  label: string
  onClick: () => void
  tone?: 'primary' | 'secondary'
}

interface ExecutiveHeaderProps {
  title: string
  eyebrow?: string
  summary: string
  statusLabel?: string
  statusTone?: SeverityTone
  primaryAction?: HeaderAction
  secondaryAction?: HeaderAction
  metricLabel?: string
  metricValue?: string
  metricHint?: string
  metricDataQa?: string
  children?: ReactNode
}

export function ExecutiveHeader({
  title,
  eyebrow,
  summary,
  statusLabel,
  statusTone = 'neutral',
  primaryAction,
  secondaryAction,
  metricLabel,
  metricValue,
  metricHint,
  metricDataQa,
  children,
}: ExecutiveHeaderProps) {
  const hasAside = Boolean(metricLabel || children)

  return (
    <header className={['cc-visual-executive-header', hasAside ? 'cc-visual-executive-header--with-aside' : ''].filter(Boolean).join(' ')}>
      <div className="cc-visual-executive-header__main">
        {eyebrow ? <span className="cc-visual-executive-header__eyebrow">{eyebrow}</span> : null}
        <div className="cc-visual-executive-header__topline">
          <h1 className="cc-visual-executive-header__title">{title}</h1>
          {statusLabel ? <SeverityBadge label={statusLabel} tone={statusTone} /> : null}
        </div>
        <p className="cc-visual-executive-header__summary">{summary}</p>
        {(primaryAction || secondaryAction) ? (
          <div className="cc-visual-executive-header__actions">
            {primaryAction ? (
              <DSButton tone="primary" onClick={primaryAction.onClick}>
                {primaryAction.label}
              </DSButton>
            ) : null}
            {secondaryAction ? (
              <DSButton tone="secondary" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </DSButton>
            ) : null}
          </div>
        ) : null}
      </div>

      {hasAside ? (
        <aside className="cc-visual-executive-header__extra">
          {metricLabel && metricValue ? (
            <section className="cc-visual-executive-header__metric" aria-label={metricLabel} data-qa={metricDataQa}>
              <span className="cc-visual-executive-header__metric-label">{metricLabel}</span>
              <strong className="cc-visual-executive-header__metric-value">{metricValue}</strong>
              {metricHint ? <p className="cc-visual-executive-header__metric-hint">{metricHint}</p> : null}
            </section>
          ) : null}
          {children}
        </aside>
      ) : null}
    </header>
  )
}
