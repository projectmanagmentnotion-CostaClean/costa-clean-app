import type { ReactNode } from 'react'
import { ExecutiveHeader } from '../../components/ExecutiveHeader'
import type { SeverityTone } from '../../components/SeverityBadge'

interface DSPageHeaderAction {
  label: string
  onClick: () => void
}

interface DSPageHeaderProps {
  title: string
  eyebrow?: string
  summary: string
  statusLabel?: string
  statusTone?: SeverityTone
  primaryAction?: DSPageHeaderAction
  secondaryAction?: DSPageHeaderAction
  metricLabel?: string
  metricValue?: string
  metricHint?: string
  children?: ReactNode
}

export function DSPageHeader(props: DSPageHeaderProps) {
  return <ExecutiveHeader {...props} />
}
